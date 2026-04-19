import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Agent, request as undiciRequest, type Dispatcher } from 'undici';
import { IntegracaoApiResolver } from './integracao-api.resolver.js';

/**
 * Agent reutilizável para HOM/PROD Protheus com `rejectUnauthorized: false`.
 * Servidores HOM da CAPUL usam certificados auto-assinados ou com IP sem SAN —
 * o mesmo comportamento é replicado em gestao-ti/src/protheus/protheus.service.ts
 * (https.request com `rejectUnauthorized: false`).
 */
const protheusTlsAgent = new Agent({
  connect: { rejectUnauthorized: false },
});

type QueryMap = Record<string, string | number | boolean | undefined>;

export interface ProtheusRequestOptions {
  operacao: string;
  method?: Dispatcher.HttpMethod;
  pathSuffix?: string;
  query?: QueryMap;
  body?: unknown;
}

/**
 * Cliente HTTP base para a API REST do Protheus.
 *
 * Resolve endpoints dinamicamente via IntegracaoApiResolver (cadastro centralizado
 * em `core.integracoes_api_endpoints` do auth-gateway). Mantém fallback para as env
 * vars PROTHEUS_API_URL/PROTHEUS_API_AUTH durante o período de transição.
 *
 * Decisões técnicas:
 * - undici (built-in Node 22), sem dependência nova de axios
 * - Retry exponencial em 5xx/429 (até 3 tentativas)
 * - Timeouts: 5s headers, 30s body (override via endpoint.timeoutMs)
 */
@Injectable()
export class ProtheusHttpClient {
  private readonly logger = new Logger(ProtheusHttpClient.name);
  private readonly fallbackBaseUrl: string | null;
  private readonly fallbackAuthHeader: string | null;

  constructor(
    private readonly resolver: IntegracaoApiResolver,
    config: ConfigService,
  ) {
    const url = config.get<string>('PROTHEUS_API_URL');
    const auth = config.get<string>('PROTHEUS_API_AUTH');
    this.fallbackBaseUrl = url ? url.replace(/\/+$/, '') : null;
    this.fallbackAuthHeader = auth ?? null;
    if (this.fallbackBaseUrl) {
      this.logger.log('Fallback env var PROTHEUS_API_URL disponivel (usado se resolver indisponivel).');
    }
  }

  /**
   * Executa uma chamada ao Protheus resolvendo o endpoint via IntegracaoApiResolver.
   * Se o resolver falhar, cai para o fallback via env var (PROTHEUS_API_URL),
   * montando `{fallbackBaseUrl}/{operacao}{pathSuffix}`.
   */
  async request<T>(opts: ProtheusRequestOptions): Promise<T> {
    const { operacao, method = 'GET', pathSuffix = '', query, body } = opts;

    const resolved = await this.resolver.resolve(operacao);
    let baseUrl: string;
    let authHeader: string;
    let timeoutMs = 30_000;
    let extraHeaders: Record<string, string> | null = null;

    if (resolved) {
      baseUrl = resolved.url;
      authHeader = resolved.authHeader || this.fallbackAuthHeader || '';
      timeoutMs = resolved.timeoutMs;
      extraHeaders = resolved.headers ?? null;
    } else if (this.fallbackBaseUrl && this.fallbackAuthHeader) {
      baseUrl = `${this.fallbackBaseUrl}/${operacao}`;
      authHeader = this.fallbackAuthHeader;
      this.logger.warn(`Resolver indisponivel para "${operacao}" — usando fallback env var.`);
    } else {
      throw new Error(
        `Nao foi possivel resolver o endpoint Protheus para operacao="${operacao}". ` +
          'Cadastre em core.integracoes_api_endpoints ou configure PROTHEUS_API_URL/PROTHEUS_API_AUTH.',
      );
    }

    const url = this.buildUrl(baseUrl, pathSuffix, query);
    return this.requestWithRetry<T>(method, url, authHeader, timeoutMs, extraHeaders, body);
  }

  /**
   * @deprecated Usar request({ operacao, pathSuffix, query }) — disponivel durante transicao.
   * Resolve legado: extrai operacao do primeiro segmento do path.
   */
  async get<T>(path: string, query?: QueryMap): Promise<T> {
    const { operacao, pathSuffix } = this.splitLegacyPath(path);
    return this.request<T>({ operacao, method: 'GET', pathSuffix, query });
  }

  /**
   * @deprecated Usar request({ operacao, method: 'POST', body }) — disponivel durante transicao.
   */
  async post<T>(path: string, body: unknown): Promise<T> {
    const { operacao, pathSuffix } = this.splitLegacyPath(path);
    return this.request<T>({ operacao, method: 'POST', pathSuffix, body });
  }

  private splitLegacyPath(path: string): { operacao: string; pathSuffix: string } {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const slashIdx = cleanPath.indexOf('/');
    if (slashIdx === -1) return { operacao: cleanPath, pathSuffix: '' };
    return { operacao: cleanPath.slice(0, slashIdx), pathSuffix: `/${cleanPath.slice(slashIdx + 1)}` };
  }

  private buildUrl(baseUrl: string, pathSuffix: string, query?: QueryMap): string {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const cleanSuffix = pathSuffix ? (pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`) : '';
    const url = new URL(`${cleanBase}${cleanSuffix}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  private async requestWithRetry<T>(
    method: Dispatcher.HttpMethod,
    url: string,
    authHeader: string,
    timeoutMs: number,
    extraHeaders: Record<string, string> | null,
    body?: unknown,
    attempt = 1,
  ): Promise<T> {
    const maxAttempts = 3;
    const baseBackoffMs = 500;

    try {
      const headers: Record<string, string> = {
        accept: 'application/json',
        'content-type': 'application/json',
        ...(authHeader ? { authorization: authHeader } : {}),
        ...(extraHeaders ?? {}),
      };

      const { statusCode, body: respBody } = await undiciRequest(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        bodyTimeout: timeoutMs,
        headersTimeout: 5_000,
        dispatcher: protheusTlsAgent,
      });

      const text = await respBody.text();
      const parsed = text.length > 0 ? (JSON.parse(text) as unknown) : (null as unknown);

      if (statusCode >= 200 && statusCode < 300) {
        return parsed as T;
      }

      if (statusCode >= 400 && statusCode < 500) {
        throw new ProtheusHttpError(statusCode, parsed, `${method} ${url} -> ${statusCode}`);
      }

      if (attempt < maxAttempts) {
        const wait = baseBackoffMs * Math.pow(2, attempt - 1);
        this.logger.warn(`Protheus ${statusCode} em ${method} ${url} — retry ${attempt}/${maxAttempts - 1} em ${wait}ms`);
        await sleep(wait);
        return this.requestWithRetry<T>(method, url, authHeader, timeoutMs, extraHeaders, body, attempt + 1);
      }

      throw new ProtheusHttpError(statusCode, parsed, `${method} ${url} -> ${statusCode} (${attempt} tentativas)`);
    } catch (err) {
      if (err instanceof ProtheusHttpError) throw err;
      if (attempt < maxAttempts) {
        const wait = baseBackoffMs * Math.pow(2, attempt - 1);
        this.logger.warn(`Protheus erro de rede em ${method} ${url}: ${(err as Error).message} — retry ${attempt}/${maxAttempts - 1} em ${wait}ms`);
        await sleep(wait);
        return this.requestWithRetry<T>(method, url, authHeader, timeoutMs, extraHeaders, body, attempt + 1);
      }
      throw err;
    }
  }
}

export class ProtheusHttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'ProtheusHttpError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
