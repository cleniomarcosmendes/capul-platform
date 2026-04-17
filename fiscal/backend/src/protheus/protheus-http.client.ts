import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { request as undiciRequest, type Dispatcher } from 'undici';

/**
 * Cliente HTTP base para a API REST do Protheus.
 *
 * Decisões alinhadas com o addendum v1.5 item 6:
 * - Usa undici (built-in Node 22), evita dependência nova de axios.
 * - Retry exponencial em 5xx/429 (até 3 tentativas).
 * - Timeouts: 5s conexão, 30s request.
 * - Credencial via PROTHEUS_API_AUTH (header Authorization completo).
 */
@Injectable()
export class ProtheusHttpClient {
  private readonly logger = new Logger(ProtheusHttpClient.name);
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(config: ConfigService) {
    const url = config.get<string>('PROTHEUS_API_URL');
    const auth = config.get<string>('PROTHEUS_API_AUTH');
    if (!url) throw new Error('PROTHEUS_API_URL ausente.');
    if (!auth) throw new Error('PROTHEUS_API_AUTH ausente.');
    this.baseUrl = url.replace(/\/+$/, '');
    this.authHeader = auth;
  }

  async get<T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const url = this.buildUrl(path, query);
    return this.requestWithRetry<T>('GET', url);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const url = this.buildUrl(path);
    return this.requestWithRetry<T>('POST', url, body);
  }

  private buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${cleanPath}`);
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
    body?: unknown,
    attempt = 1,
  ): Promise<T> {
    const maxAttempts = 3;
    const baseBackoffMs = 500;

    try {
      const { statusCode, body: respBody } = await undiciRequest(url, {
        method,
        headers: {
          authorization: this.authHeader,
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        bodyTimeout: 30_000,
        headersTimeout: 5_000,
      });

      const text = await respBody.text();
      const parsed = text.length > 0 ? (JSON.parse(text) as unknown) : (null as unknown);

      if (statusCode >= 200 && statusCode < 300) {
        return parsed as T;
      }

      // 4xx — não faz retry; deixa o caller decidir o tratamento semântico.
      if (statusCode >= 400 && statusCode < 500) {
        const err = new ProtheusHttpError(statusCode, parsed, `${method} ${url} -> ${statusCode}`);
        throw err;
      }

      // 5xx ou 429 — retry com backoff exponencial.
      if (attempt < maxAttempts) {
        const wait = baseBackoffMs * Math.pow(2, attempt - 1);
        this.logger.warn(`Protheus ${statusCode} em ${method} ${url} — retry ${attempt}/${maxAttempts - 1} em ${wait}ms`);
        await sleep(wait);
        return this.requestWithRetry<T>(method, url, body, attempt + 1);
      }

      throw new ProtheusHttpError(statusCode, parsed, `${method} ${url} -> ${statusCode} (${attempt} tentativas)`);
    } catch (err) {
      if (err instanceof ProtheusHttpError) throw err;
      // Erros de rede / timeout — retry
      if (attempt < maxAttempts) {
        const wait = baseBackoffMs * Math.pow(2, attempt - 1);
        this.logger.warn(`Protheus erro de rede em ${method} ${url}: ${(err as Error).message} — retry ${attempt}/${maxAttempts - 1} em ${wait}ms`);
        await sleep(wait);
        return this.requestWithRetry<T>(method, url, body, attempt + 1);
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
