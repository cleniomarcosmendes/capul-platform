import { Injectable, Logger } from '@nestjs/common';
import * as http from 'http';
import * as https from 'https';
import { IntegracaoService } from '../integracao/integracao.service';

export type ResultadoPortal = 'VALIDA' | 'INVALIDA' | 'INDISPONIVEL';

/**
 * Interpreta o campo `autenticacao` da resposta do loginPortal, tolerante a
 * acento/caixa. Retorna null quando a resposta é inesperada (→ INDISPONIVEL).
 * ATENÇÃO: "invalidas" CONTÉM "validas" — testar 'invalid' ANTES de 'valid'.
 */
export function interpretarAutenticacao(raw: unknown): 'VALIDA' | 'INVALIDA' | null {
  const a = String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (a.includes('invalid')) return 'INVALIDA';
  if (a.includes('valid')) return 'VALIDA';
  return null;
}

/**
 * Valida matrícula + senha no portal RH do Protheus (operação `loginPortal`),
 * para o login do app do entregador. Mesmo endpoint usado no Chamado PADRAO —
 * a config (URL + auth) mora no próprio auth-gateway (IntegracaoApi/PROTHEUS),
 * então resolvemos direto do banco, sem HTTP intermediário.
 *
 * NUNCA loga a senha. Distingue VALIDA / INVALIDA / INDISPONIVEL (Protheus fora,
 * endpoint não cadastrado ou resposta inesperada) para o login decidir 401 x 503.
 */
@Injectable()
export class PortalAuthService {
  private readonly logger = new Logger(PortalAuthService.name);

  constructor(private readonly integracao: IntegracaoService) {}

  /**
   * Matrícula digitada (só números, ex.: 001047) → chapa E-prefixada do portal
   * ('E' + 5 dígitos zero-pad → E01047). Idempotente p/ entrada já E-prefixada.
   * Validado no Chamado PADRAO: a numérica pura volta "não encontrada".
   */
  private toChapaPortal(matricula: string): string {
    return 'E' + (matricula || '').replace(/\D/g, '').slice(-5).padStart(5, '0');
  }

  async validar(matricula: string, senha: string): Promise<ResultadoPortal> {
    let cfg: Awaited<ReturnType<IntegracaoService['getEndpointsAtivos']>>;
    try {
      // Reusa o cadastro PROTHEUS (mesmo loginPortal do Chamado), sem filtrar
      // módulo — pega o endpoint cadastrado independente de quem o registrou.
      cfg = await this.integracao.getEndpointsAtivos('PROTHEUS');
    } catch {
      this.logger.warn('Integração PROTHEUS não cadastrada — loginPortal indisponível');
      return 'INDISPONIVEL';
    }
    const ep = cfg.endpoints.find((e) => e.operacao === 'loginPortal');
    if (!ep) {
      this.logger.warn('Endpoint loginPortal não cadastrado na integração PROTHEUS');
      return 'INDISPONIVEL';
    }

    const authHeader =
      cfg.tipoAuth === 'BEARER' ? `Bearer ${cfg.authConfig}` : `Basic ${cfg.authConfig}`;
    const chapa = this.toChapaPortal(matricula);
    const url = `${ep.url}?MATRICULA=${encodeURIComponent(chapa)}&SENHA=${encodeURIComponent(senha)}`;
    // Label redigido: a query string acima carrega a SENHA — nunca vai pro log.
    const logLabel = `loginPortal MATRICULA=${chapa} (senha omitida)`;
    this.logger.log(`Validando credencial portal (chapa ${chapa}, ambiente ${ep.ambiente})`);

    const data = await this.requestJson(url, authHeader, ep.timeoutMs || 8000, ep.metodo || 'POST', logLabel);
    if (!data) return 'INDISPONIVEL';

    const r = interpretarAutenticacao(data.autenticacao);
    if (r) return r;
    this.logger.warn(`loginPortal resposta inesperada (chapa ${chapa})`);
    return 'INDISPONIVEL';
  }

  /** Requisição JSON (http/https), null em erro/timeout/status>=400. */
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
          try {
            resolve(JSON.parse(body));
          } catch {
            this.logger.error(`Erro ao parsear resposta Protheus de ${logLabel}`);
            resolve(null);
          }
        });
      });
      req.on('timeout', () => { req.destroy(); this.logger.error(`Timeout Protheus ${logLabel}`); resolve(null); });
      req.on('error', (err) => { this.logger.error(`Erro Protheus (${logLabel}): ${err.message}`); resolve(null); });
      req.end();
    });
  }
}
