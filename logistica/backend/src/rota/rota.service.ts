import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { GeocodeService } from './geocode.service.js';

interface Ponto {
  id: string;
  lat: number;
  lng: number;
}

/** Distância haversine em km (linha reta — suficiente p/ ORDENAR paradas na cidade). */
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la = (a.lat * Math.PI) / 180;
  const lb = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Sugestão de ordem de rota (Fase 1c, parte 1): geocodifica as entregas
 * selecionadas e ordena por heurística de distância — nearest-neighbor a
 * partir da FILIAL (origem) + refinamento 2-opt. Distância em LINHA RETA
 * (haversine): pra decidir a ORDEM dentro da cidade é uma aproximação boa;
 * a distância real de rua (OSRM) é o refinamento da parte 2 da Fase 1c.
 *
 * Sugestão, não imposição: o operador revisa e pode reordenar. Entregas sem
 * coordenada (CEP/endereço não geocodificável) vão pro FIM, na ordem original.
 */
@Injectable()
export class RotaService {
  private readonly logger = new Logger(RotaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geocode: GeocodeService,
  ) {}

  async sugerirOrdem(filialId: string, entregaIds: string[]) {
    if (!entregaIds?.length) throw new BadRequestException('Informe as entregas da rota.');
    if (entregaIds.length > 60) {
      throw new BadRequestException('Máximo de 60 entregas por sugestão de rota.');
    }

    const entregas = await this.prisma.entrega.findMany({
      where: { id: { in: entregaIds }, filialId },
    });
    const porId = new Map(entregas.map((e) => [e.id, e]));
    // Mantém a ordem enviada (= ordem de clique) como base p/ os sem coordenada.
    const idsValidos = entregaIds.filter((id) => porId.has(id));
    if (!idsValidos.length) throw new BadRequestException('Nenhuma entrega válida da filial.');

    // Geocodifica (cache faz repetidas serem instantâneas).
    const pontos: Ponto[] = [];
    const semCoordenada: string[] = [];
    for (const id of idsValidos) {
      const e = porId.get(id)!;
      const c = await this.geocode.geocodificar({
        logradouro: e.endLogradouro,
        numero: e.endNumero,
        bairro: e.endBairro,
        cidade: e.endCidade,
        uf: e.endUf,
        cep: e.endCep,
      });
      if (c) pontos.push({ id, lat: c.lat, lng: c.lng });
      else semCoordenada.push(id);
    }

    if (pontos.length < 2) {
      // Nada (ou um só) geocodificado — não há o que ordenar.
      return {
        ordem: idsValidos,
        semCoordenada,
        geocodificadas: pontos.length,
        origemRota: null,
        distanciaKm: null,
      };
    }

    // Origem = endereço da FILIAL (core, read-only). Sem coordenada da filial,
    // parte da primeira entrega geocodificada (rota ainda faz sentido).
    const origem = await this.origemDaFilial(filialId);
    const partida = origem ?? pontos[0];

    const rota = this.duasOpt(this.vizinhoMaisProximo(partida, pontos), partida);
    const ordemGeo = rota.map((p) => p.id);

    let dist = 0;
    let ant: { lat: number; lng: number } = partida;
    for (const p of rota) {
      dist += haversineKm(ant, p);
      ant = p;
    }

    return {
      ordem: [...ordemGeo, ...semCoordenada],
      semCoordenada,
      geocodificadas: pontos.length,
      origemRota: origem ? 'FILIAL' : 'PRIMEIRA_ENTREGA',
      distanciaKm: Math.round(dist * 10) / 10,
    };
  }

  private async origemDaFilial(filialId: string): Promise<Ponto | null> {
    const rows = await this.prisma.$queryRaw<
      { endereco: string | null; cidade: string | null; estado: string | null; cep: string | null }[]
    >(Prisma.sql`SELECT endereco, cidade, estado, cep FROM "core"."filiais" WHERE id = ${filialId}`);
    const f = rows[0];
    if (!f) return null;
    const c = await this.geocode.geocodificar({
      logradouro: f.endereco,
      cidade: f.cidade,
      uf: f.estado,
      cep: f.cep,
    });
    return c ? { id: 'FILIAL', lat: c.lat, lng: c.lng } : null;
  }

  /** Heurística construtiva: sempre vai pra entrega mais próxima ainda não visitada. */
  private vizinhoMaisProximo(partida: { lat: number; lng: number }, pontos: Ponto[]): Ponto[] {
    const restantes = [...pontos];
    const rota: Ponto[] = [];
    let atual = partida;
    while (restantes.length) {
      let melhor = 0;
      let melhorD = Infinity;
      for (let i = 0; i < restantes.length; i++) {
        const d = haversineKm(atual, restantes[i]);
        if (d < melhorD) {
          melhorD = d;
          melhor = i;
        }
      }
      const [p] = restantes.splice(melhor, 1);
      rota.push(p);
      atual = p;
    }
    return rota;
  }

  /** Refinamento 2-opt: desfaz cruzamentos invertendo trechos enquanto melhorar. */
  private duasOpt(rota: Ponto[], partida: { lat: number; lng: number }): Ponto[] {
    const r = [...rota];
    const dist = (i: number) => (i < 0 ? partida : r[i]);
    let melhorou = true;
    let guard = 0;
    while (melhorou && guard++ < 50) {
      melhorou = false;
      for (let i = -1; i < r.length - 2; i++) {
        for (let j = i + 2; j < r.length - 1; j++) {
          const atual = haversineKm(dist(i), r[i + 1]) + haversineKm(r[j], r[j + 1]);
          const trocado = haversineKm(dist(i), r[j]) + haversineKm(r[i + 1], r[j + 1]);
          if (trocado < atual - 1e-9) {
            // inverte o trecho i+1..j
            let a = i + 1;
            let b = j;
            while (a < b) {
              [r[a], r[b]] = [r[b], r[a]];
              a++;
              b--;
            }
            melhorou = true;
          }
        }
      }
    }
    return r;
  }
}
