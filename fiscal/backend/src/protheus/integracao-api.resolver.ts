import { Injectable, Logger } from '@nestjs/common';

const AUTH_GATEWAY_URL = process.env.AUTH_GATEWAY_URL || 'http://auth-gateway:3000';
const CODIGO_INTEGRACAO = 'PROTHEUS';
const MODULO_CONSUMIDOR = 'FISCAL';
const CACHE_TTL_MS = 5 * 60_000;

interface IntegracaoEndpointRaw {
  operacao: string;
  ambiente: 'PRODUCAO' | 'HOMOLOGACAO';
  url: string;
  metodo: string;
  timeoutMs: number;
  headers?: Record<string, string> | null;
}

interface IntegracaoConfigRaw {
  codigo: string;
  nome: string;
  ambiente: 'PRODUCAO' | 'HOMOLOGACAO' | 'MIXED';
  tipoAuth: 'BASIC' | 'BEARER' | 'API_KEY' | 'NONE';
  authConfig: string | null;
  endpoints: IntegracaoEndpointRaw[];
}

export interface IntegracaoEndpointResolved {
  operacao: string;
  url: string;
  metodo: string;
  timeoutMs: number;
  headers?: Record<string, string> | null;
  authHeader: string;
  ambiente: 'PRODUCAO' | 'HOMOLOGACAO';
}

/**
 * Resolve endpoints da API Protheus a partir do cadastro centralizado no
 * auth-gateway (`core.integracoes_api_endpoints`), evitando hardcode em env vars.
 *
 * Padrão replicado do `gestao-ti` (protheus.service.ts) — consulta o endpoint
 * interno sem JWT, cache em memória por 5 minutos, retorna último cache conhecido
 * em caso de falha transitória.
 */
@Injectable()
export class IntegracaoApiResolver {
  private readonly logger = new Logger(IntegracaoApiResolver.name);
  private cache: IntegracaoConfigRaw | null = null;
  private cacheTs = 0;

  async resolve(operacao: string): Promise<IntegracaoEndpointResolved | null> {
    const config = await this.getConfig();
    if (!config) return null;

    const ep = config.endpoints.find((e) => e.operacao === operacao);
    if (!ep) {
      this.logger.warn(`Operacao "${operacao}" nao cadastrada em integracoes_api_endpoints.`);
      return null;
    }

    return {
      operacao: ep.operacao,
      url: ep.url.replace(/\/+$/, ''),
      metodo: ep.metodo,
      timeoutMs: ep.timeoutMs || 30_000,
      headers: ep.headers ?? null,
      authHeader: this.buildAuthHeader(config),
      ambiente: ep.ambiente,
    };
  }

  async health(): Promise<{ ok: boolean; ambiente?: string; endpointsCount?: number; erro?: string }> {
    try {
      const config = await this.getConfig({ bypassCache: true });
      if (!config) return { ok: false, erro: 'Sem resposta do auth-gateway.' };
      return { ok: true, ambiente: config.ambiente, endpointsCount: config.endpoints.length };
    } catch (err) {
      return { ok: false, erro: (err as Error).message };
    }
  }

  invalidateCache(): void {
    this.cache = null;
    this.cacheTs = 0;
  }

  private async getConfig(opts?: { bypassCache?: boolean }): Promise<IntegracaoConfigRaw | null> {
    const now = Date.now();
    if (!opts?.bypassCache && this.cache && now - this.cacheTs < CACHE_TTL_MS) {
      return this.cache;
    }

    const url = `${AUTH_GATEWAY_URL}/api/v1/internal/integracoes/codigo/${CODIGO_INTEGRACAO}/endpoints-ativos?modulo=${MODULO_CONSUMIDOR}`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      if (!response.ok) {
        this.logger.warn(`Auth-gateway ${response.status} em ${url} — usando cache antigo se houver.`);
        return this.cache;
      }
      const data = (await response.json()) as IntegracaoConfigRaw;
      this.cache = data;
      this.cacheTs = now;
      this.logger.log(`Config Protheus carregada: ambiente=${data.ambiente}, endpoints=${data.endpoints.length}`);
      return data;
    } catch (err) {
      this.logger.warn(`Falha ao buscar config Protheus: ${(err as Error).message}`);
      return this.cache;
    }
  }

  private buildAuthHeader(config: IntegracaoConfigRaw): string {
    if (!config.authConfig) return '';
    switch (config.tipoAuth) {
      case 'BASIC':
        return `Basic ${config.authConfig}`;
      case 'BEARER':
        return `Bearer ${config.authConfig}`;
      case 'API_KEY':
      case 'NONE':
      default:
        return config.authConfig;
    }
  }
}
