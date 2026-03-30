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
      const url = `${AUTH_GATEWAY_URL}/api/v1/internal/integracoes/codigo/PROTHEUS/endpoints-ativos`;
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

  async buscarColaborador(matricula: string): Promise<{ matricula: string; nome: string } | null> {
    const config = await this.getConfig();

    let url: string;
    let authHeader: string;
    let timeoutMs: number;

    if (config) {
      const ep = config.endpoints.find((e) => e.operacao === 'INFOCLIENTES');
      if (ep) {
        url = `${ep.url}?CODCLIENTE=${encodeURIComponent(matricula)}`;
        timeoutMs = ep.timeoutMs || 8000;
      } else {
        this.logger.warn('Endpoint INFOCLIENTES nao encontrado na config, usando endpoints disponiveis');
        return null;
      }
      authHeader = this.buildAuthHeader(config);
    } else {
      this.logger.warn('Config Protheus indisponivel');
      return null;
    }

    this.logger.log(`Buscando colaborador ${matricula} em ${url} (ambiente: ${config.ambiente})`);

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
            this.logger.warn(`Protheus retornou status ${res.statusCode} para matricula ${matricula}`);
            resolve(null);
            return;
          }

          try {
            const data = JSON.parse(body);
            if (!data || !data.nome) {
              this.logger.warn(`Protheus nao retornou nome para matricula ${matricula}`);
              resolve(null);
              return;
            }
            resolve({
              matricula: data.matricula || matricula,
              nome: (data.nome || '').trim(),
            });
          } catch {
            this.logger.error(`Erro ao parsear resposta Protheus para matricula ${matricula}`);
            resolve(null);
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        this.logger.error(`Timeout ao buscar colaborador ${matricula}`);
        resolve(null);
      });

      req.on('error', (err) => {
        this.logger.error(`Erro ao buscar colaborador ${matricula}: ${err.message}`);
        resolve(null);
      });

      req.end();
    });
  }
}
