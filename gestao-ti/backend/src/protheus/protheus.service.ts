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

  async buscarColaborador(
    matricula: string,
  ): Promise<{ matricula: string; nome: string; cc: string | null } | null> {
    const config = await this.getConfig();

    let url: string;
    let authHeader: string;
    let timeoutMs: number;

    if (config) {
      // Operação `infoFuncionario` (portal RH): GET ?MATRICULA= → {matricula,nome,cc}.
      // Distinta de `INFOCLIENTES` (getLimite), que é cadastro de CLIENTES (SA1).
      const ep = config.endpoints.find((e) => e.operacao === 'infoFuncionario');
      if (ep) {
        url = `${ep.url}?MATRICULA=${encodeURIComponent(matricula)}`;
        // Default 3s — UX: usuário espera no máximo 3s antes do fallback liberar.
        // Configurável via Configurador → Integrações API (`timeoutMs` por endpoint).
        timeoutMs = ep.timeoutMs || 3000;
      } else {
        this.logger.warn('Endpoint infoFuncionario nao encontrado na config Protheus (GESTAO_TI)');
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
            // Sempre HTTP 200: matrícula inválida vem como { mensagem: ... }
            // (sem `nome`). Detecção de erro é pela ausência de `nome`.
            if (!data || !data.nome) {
              this.logger.warn(
                `Protheus infoFuncionario sem nome p/ matricula ${matricula}${data?.mensagem ? ` (${data.mensagem})` : ''}`,
              );
              resolve(null);
              return;
            }
            resolve({
              matricula: (data.matricula || matricula).trim(),
              nome: (data.nome || '').trim(),
              cc: data.cc ? String(data.cc).trim() : null,
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
