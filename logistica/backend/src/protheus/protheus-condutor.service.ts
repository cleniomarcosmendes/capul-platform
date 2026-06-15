import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';

const AUTH_GATEWAY_URL = process.env.AUTH_GATEWAY_URL || 'http://auth-gateway:3000';

interface ProtheusEndpoint { operacao: string; url: string; metodo: string; timeoutMs: number; ambiente: string }
interface ProtheusConfig { tipoAuth: string; authConfig: string | null; endpoints: ProtheusEndpoint[] }

export type ResultadoCondutor =
  | { status: 'VALIDO'; matricula: string; nome: string }
  | { status: 'INVALIDO' }
  | { status: 'INDISPONIVEL' };

let configCache: ProtheusConfig | null = null;
let configCacheTs = 0;
const CACHE_TTL = 300_000;

/**
 * Condutor da FROTA: identifica o funcionário pela MATRÍCULA (nome via
 * `infoFuncionario`) e valida a SENHA no portal RH (`loginPortal`) — só
 * funcionário ATIVO passa. Reusa o mesmo conceito do Chamado PADRAO / app do
 * entregador. Endpoints `loginPortal`/`infoFuncionario` são do PROTHEUS
 * (cadastro GESTAO_TI) — por isso a config é buscada SEM filtro de módulo.
 * NUNCA loga a senha.
 */
@Injectable()
export class ProtheusCondutorService {
  private readonly logger = new Logger(ProtheusCondutorService.name);

  /** Matrícula digitada (só números) → chapa E-prefixada do portal (E+5díg). */
  private toChapaPortal(matricula: string): string {
    return 'E' + (matricula || '').replace(/\D/g, '').slice(-5).padStart(5, '0');
  }

  private async getConfig(): Promise<ProtheusConfig | null> {
    const now = Date.now();
    if (configCache && now - configCacheTs < CACHE_TTL) return configCache;
    try {
      // SEM ?modulo= → traz todos os endpoints PROTHEUS (loginPortal/infoFuncionario
      // estão cadastrados no módulo GESTAO_TI, não LOGISTICA).
      const url = `${AUTH_GATEWAY_URL}/api/v1/internal/integracoes/codigo/PROTHEUS/endpoints-ativos`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) { configCache = await res.json(); configCacheTs = now; return configCache; }
      this.logger.warn(`API integracoes retornou ${res.status}`);
    } catch (err) {
      this.logger.warn(`Config Protheus indisponível: ${err instanceof Error ? err.message : String(err)}`);
    }
    return configCache;
  }

  private auth(c: ProtheusConfig): string {
    if (!c.authConfig) return '';
    if (c.tipoAuth === 'BEARER') return `Bearer ${c.authConfig}`;
    return `Basic ${c.authConfig}`;
  }

  /** Busca o NOME do funcionário pela matrícula (infoFuncionario). null se não achar. */
  async buscarNome(matricula: string): Promise<{ matricula: string; nome: string } | null> {
    const cfg = await this.getConfig();
    if (!cfg) return null;
    const ep = cfg.endpoints.find((e) => e.operacao === 'infoFuncionario');
    if (!ep) { this.logger.warn('infoFuncionario não cadastrado'); return null; }
    const chapa = this.toChapaPortal(matricula);
    const url = `${ep.url}?MATRICULA=${encodeURIComponent(chapa)}`;
    const data = await this.request(url, this.auth(cfg), ep.timeoutMs || 8000, ep.metodo || 'GET', `infoFuncionario MATRICULA=${chapa}`);
    if (!data) return null;
    // Resposta: { matricula, nome, cc } OU { funcionarios: [...] }.
    const f = Array.isArray((data as { funcionarios?: unknown[] }).funcionarios)
      ? (data as { funcionarios: Record<string, unknown>[] }).funcionarios[0]
      : (data as Record<string, unknown>);
    const nome = String(f?.nome ?? '').trim();
    if (!nome) return null;
    return { matricula: String(f?.matricula ?? chapa).trim(), nome };
  }

  /**
   * Busca funcionários por NOME — exceção da portaria (apontar saída sem senha).
   * Reusa a operacao `infoFuncionario` (mapeada p/ .../infoPortal em HOM+PROD; o
   * mesmo endpoint aceita ?MATRICULA= e ?NOME=). Resposta: { funcionarios:
   * [{matricula, nome, cc}] } (ordenada por nome) ou { mensagem: "...não
   * encontrado..." } → lista vazia. Campos vêm com espaços à direita — trim.
   */
  async buscarPorNome(nome: string): Promise<{ matricula: string; nome: string; cc: string | null }[]> {
    const cfg = await this.getConfig();
    if (!cfg) return [];
    const ep = cfg.endpoints.find((e) => e.operacao === 'infoFuncionario');
    if (!ep) { this.logger.warn('infoFuncionario não cadastrado'); return []; }
    const url = `${ep.url}?NOME=${encodeURIComponent(nome.trim())}`;
    const data = await this.request(url, this.auth(cfg), ep.timeoutMs || 8000, ep.metodo || 'GET', `infoFuncionario NOME=${nome.trim()}`);
    if (!data) return [];
    const lista = (data as { funcionarios?: Record<string, unknown>[] }).funcionarios;
    if (!Array.isArray(lista)) return []; // { mensagem: "não encontrado..." }
    return lista
      .map((f) => ({
        matricula: String(f?.matricula ?? '').trim(),
        nome: String(f?.nome ?? '').trim(),
        cc: f?.cc != null ? String(f.cc).trim() || null : null,
      }))
      .filter((f) => f.matricula && f.nome);
  }

  /** Valida matrícula+senha (loginPortal) e, se válido, retorna o nome. */
  async validar(matricula: string, senha: string): Promise<ResultadoCondutor> {
    const cfg = await this.getConfig();
    if (!cfg) return { status: 'INDISPONIVEL' };
    const ep = cfg.endpoints.find((e) => e.operacao === 'loginPortal');
    if (!ep) { this.logger.warn('loginPortal não cadastrado'); return { status: 'INDISPONIVEL' }; }
    const chapa = this.toChapaPortal(matricula);
    const url = `${ep.url}?MATRICULA=${encodeURIComponent(chapa)}&SENHA=${encodeURIComponent(senha)}`;
    this.logger.log(`Validando condutor (chapa ${chapa}, ambiente ${ep.ambiente})`);
    const data = await this.request(url, this.auth(cfg), ep.timeoutMs || 8000, ep.metodo || 'POST', `loginPortal MATRICULA=${chapa} (senha omitida)`);
    if (!data) return { status: 'INDISPONIVEL' };
    const bruto = String((data as Record<string, unknown>).autenticacao ?? '');
    const auth = bruto
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const _st = auth.includes('invalid') ? 'INVALIDO' : (auth.includes('valid') ? 'VALIDO' : 'INESPERADO');
    this.logger.log(`loginPortal chapa=${chapa} -> ${_st}`);
    if (_st === 'INVALIDO') return { status: 'INVALIDO' };
    if (_st === 'INESPERADO') { this.logger.warn(`loginPortal resposta inesperada (chapa ${chapa})`); return { status: 'INDISPONIVEL' }; }
    // Válido → pega o nome (best-effort; se infoFuncionario falhar, usa a chapa).
    const info = await this.buscarNome(matricula);
    return { status: 'VALIDO', matricula: info?.matricula ?? chapa, nome: info?.nome ?? chapa };
  }

  private request(url: string, authHeader: string, timeoutMs: number, metodo: string, logLabel: string): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      const u = new URL(url);
      const transport = u.protocol === 'https:' ? https : http;
      const req = transport.request(
        {
          hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
          path: u.pathname + u.search, method: metodo,
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          timeout: timeoutMs, rejectUnauthorized: false,
        },
        (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            if (!res.statusCode || res.statusCode >= 400) { this.logger.warn(`Protheus ${res.statusCode} em ${logLabel}`); return resolve(null); }
            try { resolve(JSON.parse(body)); } catch { this.logger.error(`Falha ao parsear ${logLabel}`); resolve(null); }
          });
        },
      );
      req.on('timeout', () => { req.destroy(); this.logger.error(`Timeout ${logLabel}`); resolve(null); });
      req.on('error', (e) => { this.logger.error(`Erro Protheus (${logLabel}): ${e.message}`); resolve(null); });
      req.end();
    });
  }
}
