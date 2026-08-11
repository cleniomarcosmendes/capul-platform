import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GeocodeService, type EnderecoGeo } from './geocode.service.js';

/**
 * Aprendizado de campo: o endereço fica mais preciso a cada entrega feita nele.
 *
 * Ideia do Clenio (11/08/2026): *"seria possível utilizar a coordenada da entrega
 * realizada para aprimorar as entregas futuras, gerando uma precisão maior com o
 * passar do tempo?"*. Sim — e é a melhor fonte que temos. O geocoder acerta a
 * rua e erra o ponto (cai no centro do CEP, do bairro, às vezes do município);
 * quem esteve na porta do cliente sabe onde é de verdade.
 *
 * Como decide (parâmetros escolhidos pelo Clenio):
 *  - precisa de **{@link MIN_AMOSTRAS} baixas com GPS** no mesmo endereço;
 *  - as amostras precisam CONCORDAR: pelo menos esse tanto dentro de
 *    {@link RAIO_CONCORDANCIA_M} do medóide. Uma entrega baixada no carro, a três
 *    quadras dali, não arrasta o ponto sozinha;
 *  - divergindo mais de {@link DESVIO_SINALIZAR_M} do que o provedor dava, **usa
 *    assim mesmo e SINALIZA** — o entregador esteve lá; provavelmente o endereço
 *    cadastrado é que está errado, e o operador precisa saber disso.
 *
 * **Medóide, não média.** A média de coordenadas é puxada por um único ponto
 * ruim (GPS que pegou a torre errada); o medóide — a amostra com menor soma de
 * distâncias às demais — é sempre um ponto REAL e resiste a outlier. Mesmo
 * critério já usado no `LocalCliente` do RDV.
 *
 * **MANUAL vence CAMPO.** Pin arrastado à mão é decisão explícita do operador e
 * não é revogada por estatística.
 */
@Injectable()
export class LocalAprendidoService {
  private readonly logger = new Logger(LocalAprendidoService.name);

  /** Baixas com GPS necessárias para promover o ponto aprendido. */
  static readonly MIN_AMOSTRAS = 3;
  /** Raio (m) dentro do qual as amostras são consideradas concordantes. */
  static readonly RAIO_CONCORDANCIA_M = 80;
  /** Acima disto, o ponto aprendido diverge do endereço e a parada sai marcada. */
  static readonly DESVIO_SINALIZAR_M = 300;

  constructor(
    private readonly prisma: PrismaService,
    private readonly geocode: GeocodeService,
  ) {}

  /**
   * Reavalia UM endereço a partir das entregas já baixadas nele e promove o
   * ponto aprendido quando houver evidência suficiente.
   *
   * Chamado depois da baixa (best-effort, fora do caminho crítico): a entrega
   * que acabou de acontecer é justamente a amostra nova.
   */
  async reavaliar(endereco: EnderecoGeo): Promise<{ promovido: boolean; amostras: number; desvioM: number | null }> {
    const { chave } = this.geocode.chavePublica(endereco);

    const cache = await this.prisma.geocodeCache.findUnique({ where: { chave } });
    // Correção manual manda. Quem arrastou o pin decidiu por este endereço.
    if (cache?.fonte === 'MANUAL') return { promovido: false, amostras: 0, desvioM: null };

    const amostras = await this.amostrasDoEndereco(endereco);
    if (amostras.length < LocalAprendidoService.MIN_AMOSTRAS) {
      return { promovido: false, amostras: amostras.length, desvioM: null };
    }

    const medoide = medoideDe(amostras);
    const concordantes = amostras.filter(
      (p) => distanciaM(p, medoide) <= LocalAprendidoService.RAIO_CONCORDANCIA_M,
    );
    if (concordantes.length < LocalAprendidoService.MIN_AMOSTRAS) {
      // Há entregas, mas espalhadas: endereço ambíguo (condomínio grande, zona
      // rural) ou baixas feitas longe da porta. Não promove — e não estraga o
      // que já existe.
      return { promovido: false, amostras: concordantes.length, desvioM: null };
    }

    // Recalcula o medóide só entre as concordantes: o outlier não desloca o ponto.
    const ponto = medoideDe(concordantes);
    const anterior = cache?.lat != null && cache.lng != null ? { lat: Number(cache.lat), lng: Number(cache.lng) } : null;
    const desvioM = anterior ? Math.round(distanciaM(anterior, ponto)) : null;

    // Já aprendido e praticamente no mesmo lugar: nada a fazer (evita escrita a
    // cada baixa e mantém `aprendidoEm` como a data em que o ponto de fato mudou).
    if (cache?.fonte === 'CAMPO' && desvioM != null && desvioM < 10) {
      return { promovido: false, amostras: concordantes.length, desvioM };
    }

    await this.prisma.geocodeCache.upsert({
      where: { chave },
      create: {
        chave,
        endereco: this.geocode.chavePublica(endereco).texto,
        lat: ponto.lat,
        lng: ponto.lng,
        fonte: 'CAMPO',
        precisao: 'CAMPO',
        aprendidoEm: new Date(),
        aprendidoAmostras: concordantes.length,
        aprendidoDesvioM: desvioM,
      },
      update: {
        lat: ponto.lat,
        lng: ponto.lng,
        fonte: 'CAMPO',
        precisao: 'CAMPO',
        aprendidoEm: new Date(),
        aprendidoAmostras: concordantes.length,
        aprendidoDesvioM: desvioM,
      },
    });

    this.logger.log(
      `Local aprendido em campo: ${concordantes.length} entregas concordantes` +
        (desvioM != null ? ` · ${desvioM}m do ponto anterior` : '') +
        ` · ${this.geocode.chavePublica(endereco).texto}`,
    );
    return { promovido: true, amostras: concordantes.length, desvioM };
  }

  /**
   * GPS das entregas JÁ BAIXADAS neste endereço. Casa pelo endereço normalizado
   * (mesma regra da chave do geocode), não pelo cliente: quem manda é o LUGAR —
   * clientes diferentes no mesmo prédio ensinam o mesmo ponto.
   */
  private async amostrasDoEndereco(e: EnderecoGeo): Promise<Ponto[]> {
    const norm = (v?: string | null) => (v ?? '').trim().toUpperCase();
    const linhas = await this.prisma.entrega.findMany({
      where: {
        status: { in: ['ENTREGUE', 'NAO_ENTREGUE'] },
        baixaGeoLat: { not: null },
        baixaGeoLng: { not: null },
        endLogradouro: { equals: norm(e.logradouro), mode: 'insensitive' },
        endNumero: e.numero ? { equals: norm(e.numero), mode: 'insensitive' } : undefined,
        endCidade: e.cidade ? { equals: norm(e.cidade), mode: 'insensitive' } : undefined,
      },
      select: { baixaGeoLat: true, baixaGeoLng: true },
      // Teto: um endereço muito atendido não precisa de mais que isso para
      // decidir, e limita o custo da consulta.
      take: 50,
      orderBy: { dataHoraEntrega: 'desc' },
    });
    return linhas.map((l) => ({ lat: Number(l.baixaGeoLat), lng: Number(l.baixaGeoLng) }));
  }
}

export interface Ponto {
  lat: number;
  lng: number;
}

/** Distância em METROS (haversine) — precisa o bastante nas escalas urbanas. */
export function distanciaM(a: Ponto, b: Ponto): number {
  const R = 6371000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Medóide: a amostra com MENOR soma de distâncias às demais. É um ponto real
 * (não inventa uma posição no meio do nada) e um outlier isolado não o desloca —
 * ao contrário da média, que ele puxa na proporção do erro.
 */
export function medoideDe(pontos: Ponto[]): Ponto {
  if (pontos.length === 1) return pontos[0];
  let melhor = pontos[0];
  let melhorSoma = Infinity;
  for (const p of pontos) {
    let soma = 0;
    for (const q of pontos) soma += distanciaM(p, q);
    if (soma < melhorSoma) {
      melhorSoma = soma;
      melhor = p;
    }
  }
  return melhor;
}
