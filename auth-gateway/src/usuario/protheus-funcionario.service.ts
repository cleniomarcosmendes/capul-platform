import { Injectable, Logger } from '@nestjs/common';
import * as http from 'http';
import * as https from 'https';
import { IntegracaoService } from '../integracao/integracao.service';

export interface FuncionarioProtheus { matricula: string; nome: string }

/**
 * Mapeia os `itens` do SA1 (clienteEndereco) para funcionários: mantém SÓ as chapas
 * que começam com `E` (E = "E"mpregado; cliente é A…), normaliza p/ maiúscula, faz
 * dedup (a mesma chapa vem em vários endereços/lojas) e aplica um teto. Pura/testável.
 */
export function mapFuncionariosSA1(itens: unknown, limite = 25): FuncionarioProtheus[] {
  const lista = Array.isArray(itens) ? itens : [];
  const vistos = new Set<string>();
  const out: FuncionarioProtheus[] = [];
  for (const it of lista as Array<{ matricula?: unknown; nome?: unknown }>) {
    const matricula = String(it?.matricula ?? '').trim().toUpperCase();
    const nome = String(it?.nome ?? '').trim();
    if (!matricula.startsWith('E')) continue; // só EMPREGADOS
    if (vistos.has(matricula)) continue;
    vistos.add(matricula);
    out.push({ matricula, nome });
    if (out.length >= limite) break;
  }
  return out;
}

/**
 * Busca FUNCIONÁRIO por NOME no Protheus — para o cadastro de usuário do Configurador
 * (quem cadastra sabe o nome, não a chapa).
 *
 * Reusa a operação SA1 `clienteEndereco` (que aceita busca por NOME): a resposta traz
 * tanto CLIENTES (código A…) quanto EMPREGADOS (código E… = "E"mpregado) — filtramos
 * só os que começam com `E`. Assim há busca de funcionário por nome SEM endpoint novo no
 * Protheus. A config (URL + auth) mora no próprio auth-gateway (IntegracaoApi/PROTHEUS),
 * mesmo caminho do loginPortal — resolvemos direto do banco, sem HTTP intermediário.
 */
@Injectable()
export class ProtheusFuncionarioService {
  private readonly logger = new Logger(ProtheusFuncionarioService.name);

  constructor(private readonly integracao: IntegracaoService) {}

  async buscarPorNome(nome: string): Promise<FuncionarioProtheus[]> {
    const termo = (nome ?? '').trim();
    if (termo.length < 3) return []; // evita varredura pesada no Protheus com termo curto

    let cfg: Awaited<ReturnType<IntegracaoService['getEndpointsAtivos']>>;
    try {
      cfg = await this.integracao.getEndpointsAtivos('PROTHEUS');
    } catch {
      this.logger.warn('Integração PROTHEUS não cadastrada — busca de funcionário indisponível');
      return [];
    }
    const ep = cfg?.endpoints.find((e) => e.operacao === 'clienteEndereco');
    if (!ep) { this.logger.warn('Operação clienteEndereco não cadastrada (PROTHEUS) — busca por nome indisponível'); return []; }

    const authHeader = cfg.tipoAuth === 'BEARER' ? `Bearer ${cfg.authConfig}` : `Basic ${cfg.authConfig}`;
    const url = `${ep.url}?NOME=${encodeURIComponent(termo)}`;
    const data = await this.requestJson(url, authHeader, ep.timeoutMs || 8000, ep.metodo || 'GET', `clienteEndereco NOME=${termo}`);
    if (!data) return [];
    return mapFuncionariosSA1((data as { itens?: unknown }).itens);
  }

  /** Requisição JSON (http/https), null em erro/timeout/status>=400. Igual ao PortalAuthService. */
  private requestJson(
    url: string,
    authHeader: string,
    timeoutMs: number,
    metodo: string,
    logLabel: string,
  ): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const transport = isHttps ? https : http;
      const options: https.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: metodo,
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        timeout: timeoutMs,
        rejectUnauthorized: false,
      };
      const req = transport.request(options, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          if (!res.statusCode || res.statusCode >= 400) {
            this.logger.warn(`Protheus retornou status ${res.statusCode} para ${logLabel}`);
            resolve(null);
            return;
          }
          try { resolve(JSON.parse(body)); }
          catch { this.logger.error(`Erro ao parsear resposta Protheus de ${logLabel}`); resolve(null); }
        });
      });
      req.on('timeout', () => { req.destroy(); this.logger.error(`Timeout Protheus ${logLabel}`); resolve(null); });
      req.on('error', (err) => { this.logger.error(`Erro Protheus (${logLabel}): ${err.message}`); resolve(null); });
      req.end();
    });
  }
}
