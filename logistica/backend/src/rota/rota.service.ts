import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { GeocodeService } from './geocode.service.js';
import { OsrmService } from './osrm.service.js';

interface Ponto {
  id: string;
  lat: number;
  lng: number;
  /** Índice na matriz OSRM (0 = origem). Atribuído antes de ordenar. */
  mi?: number;
}

/** Custo entre dois pontos — abstrai matriz OSRM (rua) × haversine (linha reta). */
type Custo = (a: Ponto, b: Ponto) => number;

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
    private readonly osrm: OsrmService,
  ) {}

  async sugerirOrdem(filialId: string, entregaIds: string[]) {
    // Mínimo 2: com 0/1 entrega não há ordem a sugerir. Defesa em profundidade —
    // o frontend já desabilita o botão; aqui barra chamada direta à API.
    if (!entregaIds || entregaIds.length < 2) {
      throw new BadRequestException('Selecione ao menos 2 entregas para sugerir a ordem da rota.');
    }
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
    // Unifica o "Recalcular" com o "Sugerir": ao sugerir a ordem também gravamos
    // geoLat/geoLng das entregas DA ROTA (escopado — não a filial toda) quando
    // mudou. Assim o pin fica correto nas telas com mapa (Painel/Monitor) sem
    // exigir o botão de manutenção do gestor. Derivado do endereço, determinístico.
    const r7 = (n: number) => Math.round(n * 1e7) / 1e7; // geo_lat/lng = Decimal(10,7)
    const pinsParaSalvar: { id: string; lat: number; lng: number }[] = [];
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
      if (c) {
        pontos.push({ id, lat: c.lat, lng: c.lng });
        const lat = r7(c.lat);
        const lng = r7(c.lng);
        if (e.geoLat == null || e.geoLng == null || Number(e.geoLat) !== lat || Number(e.geoLng) !== lng) {
          pinsParaSalvar.push({ id, lat, lng });
        }
      } else {
        semCoordenada.push(id);
      }
    }
    if (pinsParaSalvar.length) {
      await Promise.all(
        pinsParaSalvar.map((p) => this.prisma.entrega.update({ where: { id: p.id }, data: { geoLat: p.lat, geoLng: p.lng } })),
      );
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

    // Matriz de distância de RUA (OSRM) sobre [partida, ...pontos]; null = OSRM
    // off/indisponível → cai no haversine. Índices da matriz vão em `mi`.
    const coords = [partida, ...pontos];
    const matriz = await this.osrm.matrizDistancia(coords.map((p) => ({ lat: p.lat, lng: p.lng })));
    coords.forEach((p, i) => { p.mi = i; });
    // custo em METROS (OSRM) ou KM (haversine) — unidade consistente dentro da
    // mesma execução (nunca se misturam); só converte no total exibido.
    const custo: Custo = matriz
      ? (a, b) => matriz[a.mi ?? 0][b.mi ?? 0]
      : (a, b) => haversineKm(a, b);

    const rota = this.duasOpt(this.vizinhoMaisProximo(partida, pontos, custo), partida, custo);
    const ordemGeo = rota.map((p) => p.id);

    let dist = 0;
    let ant: Ponto = partida;
    for (const p of rota) {
      dist += custo(ant, p);
      ant = p;
    }
    const distanciaKm = matriz ? dist / 1000 : dist; // OSRM vem em metros

    return {
      ordem: [...ordemGeo, ...semCoordenada],
      semCoordenada,
      geocodificadas: pontos.length,
      origemRota: origem ? 'FILIAL' : 'PRIMEIRA_ENTREGA',
      fonteDistancia: matriz ? 'OSRM' : 'HAVERSINE',
      distanciaKm: Math.round(distanciaKm * 10) / 10,
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
  private vizinhoMaisProximo(partida: Ponto, pontos: Ponto[], custo: Custo): Ponto[] {
    const restantes = [...pontos];
    const rota: Ponto[] = [];
    let atual = partida;
    while (restantes.length) {
      let melhor = 0;
      let melhorD = Infinity;
      for (let i = 0; i < restantes.length; i++) {
        const d = custo(atual, restantes[i]);
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
  private duasOpt(rota: Ponto[], partida: Ponto, custo: Custo): Ponto[] {
    const r = [...rota];
    const dist = (i: number) => (i < 0 ? partida : r[i]);
    let melhorou = true;
    let guard = 0;
    while (melhorou && guard++ < 50) {
      melhorou = false;
      for (let i = -1; i < r.length - 2; i++) {
        for (let j = i + 2; j < r.length - 1; j++) {
          const atual = custo(dist(i), r[i + 1]) + custo(r[j], r[j + 1]);
          const trocado = custo(dist(i), r[j]) + custo(r[i + 1], r[j + 1]);
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
