import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';

const AUTH_GATEWAY_URL = process.env.AUTH_GATEWAY_URL || 'http://auth-gateway:3000';

interface ProtheusEndpoint {
  operacao: string;
  url: string;
  metodo: string;
  timeoutMs: number;
}

interface ProtheusConfigData {
  ambiente: string;
  tipoAuth: string;
  authConfig: string | null;
  endpoints: ProtheusEndpoint[];
}

// Cache em memoria (TTL 5 minutos)
let configCache: ProtheusConfigData | null = null;
let configCacheTs = 0;
const CACHE_TTL = 300_000;

@Injectable()
export class ProtheusService {
  private readonly logger = new Logger(ProtheusService.name);

  private async getConfig(): Promise<ProtheusConfigData | null> {
    const now = Date.now();
    if (configCache && (now - configCacheTs) < CACHE_TTL) {
      return configCache;
    }

    try {
      const url = `${AUTH_GATEWAY_URL}/api/v1/internal/integracoes/codigo/PROTHEUS/endpoints-ativos?modulo=GESTAO_TI`;
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const data = await response.json();
        configCache = data;
        configCacheTs = now;
        this.logger.log(`Config Protheus carregada: ambiente=${data.ambiente}, ${data.endpoints?.length} endpoints`);
        return data;
      }
      this.logger.warn(`API integracoes retornou ${response.status}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Nao foi possivel buscar config Protheus da API: ${msg}`);
    }
    return configCache; // retorna cache antigo se existir
  }

  private buildAuthHeader(config: ProtheusConfigData): string {
    if (!config.authConfig) return '';
    if (config.tipoAuth === 'BASIC') return `Basic ${config.authConfig}`;
    if (config.tipoAuth === 'BEARER') return `Bearer ${config.authConfig}`;
    return config.authConfig;
  }

  /**
   * Resolve a operação `infoFuncionario` (portal RH): base URL + auth + timeout.
   * GET ?MATRICULA= → {matricula,nome,cc} | GET ?NOME= → {funcionarios:[...]}.
   * Distinta de `INFOCLIENTES` (getLimite), que é cadastro de CLIENTES (SA1).
   * Default 3s de timeout (configurável por endpoint no Configurador).
   */
  private async resolveInfoFuncionario(): Promise<{
    baseUrl: string;
    authHeader: string;
    timeoutMs: number;
    ambiente: string;
  } | null> {
    const config = await this.getConfig();
    if (!config) {
      this.logger.warn('Config Protheus indisponivel');
      return null;
    }
    const ep = config.endpoints.find((e) => e.operacao === 'infoFuncionario');
    if (!ep) {
      this.logger.warn('Endpoint infoFuncionario nao encontrado na config Protheus (GESTAO_TI)');
      return null;
    }
    return {
      baseUrl: ep.url,
      authHeader: this.buildAuthHeader(config),
      timeoutMs: ep.timeoutMs || 3000,
      ambiente: config.ambiente,
    };
  }

  /** GET genérico que devolve o JSON parseado (ou null em erro/timeout/status>=400). */
  private requestJson(
    url: string,
    authHeader: string,
    timeoutMs: number,
  ): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const transport = isHttps ? https : http;

      const options: https.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        timeout: timeoutMs,
        rejectUnauthorized: false,
      };

      const req = transport.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (!res.statusCode || res.statusCode >= 400) {
            this.logger.warn(`Protheus retornou status ${res.statusCode} para ${urlObj.pathname}${urlObj.search}`);
            resolve(null);
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch {
            this.logger.error(`Erro ao parsear resposta Protheus de ${urlObj.pathname}`);
            resolve(null);
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        this.logger.error(`Timeout ao consultar Protheus ${urlObj.pathname}${urlObj.search}`);
        resolve(null);
      });
      req.on('error', (err) => {
        this.logger.error(`Erro ao consultar Protheus: ${err.message}`);
        resolve(null);
      });
      req.end();
    });
  }

  async buscarColaborador(
    matricula: string,
  ): Promise<{ matricula: string; nome: string; cc: string | null } | null> {
    const ep = await this.resolveInfoFuncionario();
    if (!ep) return null;

    const url = `${ep.baseUrl}?MATRICULA=${encodeURIComponent(matricula)}`;
    this.logger.log(`Buscando colaborador ${matricula} (ambiente: ${ep.ambiente})`);

    const data = await this.requestJson(url, ep.authHeader, ep.timeoutMs);
    // Sempre HTTP 200: matrícula inválida vem como { mensagem: ... } (sem `nome`).
    if (!data || !data.nome) {
      if (data?.mensagem) this.logger.warn(`Protheus infoFuncionario: ${String(data.mensagem)} (matricula ${matricula})`);
      return null;
    }
    return {
      matricula: String(data.matricula || matricula).trim(),
      nome: String(data.nome || '').trim(),
      cc: data.cc ? String(data.cc).trim() : null,
    };
  }

  /**
   * Busca funcionários por parte do NOME (portal RH, `?NOME=`). Retorna a lista
   * ordenada por nome (a ordenação vem do Protheus). Trim em todos os campos
   * (a resposta vem com espaços à direita). Não encontrado / sem acesso ao
   * portal → `{ mensagem }` → lista vazia. Pra autocomplete na alocação de
   * licença (usuário não precisa saber a matrícula).
   */
  async buscarPorNome(
    nome: string,
  ): Promise<Array<{ matricula: string; nome: string; cc: string | null }>> {
    const ep = await this.resolveInfoFuncionario();
    if (!ep) return [];

    const url = `${ep.baseUrl}?NOME=${encodeURIComponent(nome)}`;
    this.logger.log(`Buscando funcionarios por nome "${nome}" (ambiente: ${ep.ambiente})`);

    const data = await this.requestJson(url, ep.authHeader, ep.timeoutMs);
    const lista = Array.isArray(data?.funcionarios) ? (data!.funcionarios as unknown[]) : [];
    return lista
      .map((f) => f as { matricula?: unknown; nome?: unknown; cc?: unknown })
      .map((f) => ({
        matricula: String(f.matricula ?? '').trim(),
        nome: String(f.nome ?? '').trim(),
        cc: f.cc ? String(f.cc).trim() : null,
      }))
      .filter((f) => f.matricula && f.nome);
  }
}
