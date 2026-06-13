import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';

export interface EnderecoGeo {
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
}

export interface Coordenada {
  lat: number;
  lng: number;
  precisao: 'CEP' | 'LOGRADOURO';
}

/**
 * Geocodificação de endereço (Fase 1c) com CACHE em banco — cada endereço só
 * bate no provedor uma vez (inclusive os que NÃO resolvem: miss também é
 * cacheado, lat/lng null).
 *
 * Provedores (gratuitos, proxiados pelo backend — CSP/uso responsável):
 *  1. BrasilAPI cep/v2: CEP → coordenadas (quando a base tem). Sem rate
 *     agressivo, cobre a maioria (todo endereço de balcão tem CEP).
 *  2. Nominatim (OpenStreetMap) como fallback por TEXTO: política pública
 *     exige User-Agent identificado e ≤1 req/s — respeitado com sleep entre
 *     chamadas. Volume é mínimo (só primeira vez de cada endereço).
 */
@Injectable()
export class GeocodeService {
  private readonly logger = new Logger(GeocodeService.name);
  // Serializa chamadas Nominatim (política 1 req/s) mesmo com requests concorrentes.
  private nominatimChain: Promise<unknown> = Promise.resolve();

  constructor(private readonly prisma: PrismaService) {}

  private chaveDe(e: EnderecoGeo): { chave: string; texto: string } {
    const norm = (v?: string | null) => (v ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
    const texto = [norm(e.logradouro), norm(e.numero), norm(e.bairro), norm(e.cidade), norm(e.uf), (e.cep ?? '').replace(/\D/g, '')]
      .join('|');
    return { chave: createHash('sha256').update(texto).digest('hex'), texto };
  }

  /**
   * Consulta SÓ o cache, em lote (sem bater em provedor — instantâneo):
   * true = geocodificável, false = já tentou e não resolveu, null = nunca
   * tentado. Pro badge de "entra na rota automática?" nas listas.
   */
  async statusCacheLote(enderecos: EnderecoGeo[]): Promise<(boolean | null)[]> {
    if (!enderecos.length) return [];
    const chaves = enderecos.map((e) => this.chaveDe(e).chave);
    const rows = await this.prisma.geocodeCache.findMany({
      where: { chave: { in: [...new Set(chaves)] } },
      select: { chave: true, lat: true },
    });
    const m = new Map(rows.map((r) => [r.chave, r.lat != null]));
    return chaves.map((c) => (m.has(c) ? (m.get(c) as boolean) : null));
  }

  /** Geocodifica com cache. null = não foi possível resolver (segue sem coordenada). */
  async geocodificar(e: EnderecoGeo): Promise<Coordenada | null> {
    const { chave, texto } = this.chaveDe(e);

    const cached = await this.prisma.geocodeCache.findUnique({ where: { chave } });
    if (cached) {
      if (cached.lat == null || cached.lng == null) return null; // miss cacheado
      return {
        lat: Number(cached.lat),
        lng: Number(cached.lng),
        precisao: (cached.precisao as Coordenada['precisao']) ?? 'LOGRADOURO',
      };
    }

    let coord: (Coordenada & { fonte: string }) | null = null;

    const cep = (e.cep ?? '').replace(/\D/g, '');
    if (cep.length === 8) {
      coord = await this.viaBrasilApi(cep);
    }
    if (!coord) {
      coord = await this.viaNominatim(e);
    }

    await this.prisma.geocodeCache
      .create({
        data: {
          chave,
          endereco: texto,
          lat: coord?.lat ?? null,
          lng: coord?.lng ?? null,
          fonte: coord?.fonte ?? null,
          precisao: coord?.precisao ?? null,
        },
      })
      .catch(() => undefined); // corrida com request concorrente — cache é best-effort

    return coord ? { lat: coord.lat, lng: coord.lng, precisao: coord.precisao } : null;
  }

  private async viaBrasilApi(cep: string): Promise<(Coordenada & { fonte: string }) | null> {
    try {
      const resp = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) return null;
      const data = (await resp.json()) as {
        location?: { coordinates?: { latitude?: string | number; longitude?: string | number } };
      };
      const lat = Number(data.location?.coordinates?.latitude);
      const lng = Number(data.location?.coordinates?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng, precisao: 'CEP', fonte: 'BRASILAPI_CEP' };
    } catch {
      return null;
    }
  }

  private async viaNominatim(e: EnderecoGeo): Promise<(Coordenada & { fonte: string }) | null> {
    // Cadastro de balcão vem com ruído no logradouro ("RUA X, 475 AP 108") —
    // corta no 1º separador: a RUA é o que importa pro Nominatim.
    const ruaLimpa = (e.logradouro ?? '').split(/[,;–-]/)[0].trim();
    const rua = [ruaLimpa, (e.numero ?? '').trim()].filter(Boolean).join(' ');
    const bairro = (e.bairro ?? '').trim();
    const base = [e.cidade, e.uf].map((p) => (p ?? '').toString().trim()).filter(Boolean);
    if (!rua || base.length === 0) return null; // texto pobre demais — não adianta

    // Tentativa 1 com bairro; bairro divergente do OSM derruba o match → 2ª
    // tentativa sem ele (rua+cidade costuma bastar).
    const consultas = [
      [rua, bairro, ...base].filter(Boolean).join(', ') + ', Brasil',
      ...(bairro ? [[rua, ...base].join(', ') + ', Brasil'] : []),
    ];

    // Entra na fila serializada (1 req/s) e devolve o resultado desta chamada.
    const run = async (): Promise<(Coordenada & { fonte: string }) | null> => {
      for (const consulta of consultas) {
        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(consulta)}`,
            {
              headers: { 'User-Agent': 'capul-platform-logistica/1.0 (TI CAPUL)' },
              signal: AbortSignal.timeout(8000),
            },
          );
          if (resp.ok) {
            const data = (await resp.json()) as Array<{ lat?: string; lon?: string }>;
            const lat = Number(data[0]?.lat);
            const lng = Number(data[0]?.lon);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              return { lat, lng, precisao: 'LOGRADOURO', fonte: 'NOMINATIM' };
            }
          }
        } catch (err) {
          this.logger.warn(`Nominatim falhou: ${(err as Error).message}`);
        } finally {
          // espaçamento da política pública (1 req/s) entre TODAS as chamadas
          await new Promise((r) => setTimeout(r, 1100));
        }
      }
      return null;
    };
    const resultado = this.nominatimChain.then(run, run);
    this.nominatimChain = resultado;
    return resultado as Promise<(Coordenada & { fonte: string }) | null>;
  }
}
