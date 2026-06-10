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
   * Resolve uma operação Protheus (GESTAO_TI) pela `operacao`: base URL + auth +
   * timeout + método. Default 3s de timeout (configurável por endpoint no
   * Configurador). Retorna null se a config ou o endpoint não existirem.
   */
  private async resolveEndpoint(operacao: string): Promise<{
    baseUrl: string;
    authHeader: string;
    timeoutMs: number;
    ambiente: string;
    metodo: string;
  } | null> {
    const config = await this.getConfig();
    if (!config) {
      this.logger.warn('Config Protheus indisponivel');
      return null;
    }
    const ep = config.endpoints.find((e) => e.operacao === operacao);
    if (!ep) {
      this.logger.warn(`Endpoint ${operacao} nao encontrado na config Protheus (GESTAO_TI)`);
      return null;
    }
    return {
      baseUrl: ep.url,
      authHeader: this.buildAuthHeader(config),
      timeoutMs: ep.timeoutMs || 3000,
      ambiente: config.ambiente,
      metodo: ep.metodo || 'GET',
    };
  }

  /**
   * Resolve a operação `infoFuncionario` (portal RH): base URL + auth + timeout.
   * GET ?MATRICULA= → {matricula,nome,cc} | GET ?NOME= → {funcionarios:[...]}.
   * Distinta de `INFOCLIENTES` (getLimite), que é cadastro de CLIENTES (SA1).
   */
  private resolveInfoFuncionario() {
    return this.resolveEndpoint('infoFuncionario');
  }

  /**
   * Requisição genérica que devolve o JSON parseado (ou null em
   * erro/timeout/status>=400). Default GET. `logLabel` substitui a URL nas
   * mensagens de log — OBRIGATÓRIO quando a query string carrega segredo
   * (ex.: SENHA do loginPortal), pra nunca vazar credencial em log.
   */
  private requestJson(
    url: string,
    authHeader: string,
    timeoutMs: number,
    opts: { method?: string; logLabel?: string } = {},
  ): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const transport = isHttps ? https : http;
      const label = opts.logLabel ?? `${urlObj.pathname}${urlObj.search}`;

      const options: https.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: opts.method ?? 'GET',
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
            this.logger.warn(`Protheus retornou status ${res.statusCode} para ${label}`);
            resolve(null);
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch {
            this.logger.error(`Erro ao parsear resposta Protheus de ${label}`);
            resolve(null);
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        this.logger.error(`Timeout ao consultar Protheus ${label}`);
        resolve(null);
      });
      req.on('error', (err) => {
        this.logger.error(`Erro ao consultar Protheus (${label}): ${err.message}`);
        resolve(null);
      });
      req.end();
    });
  }

  /**
   * Valida matrícula+senha do colaborador no portal RH (operação `loginPortal`,
   * POST). Usado na abertura de Chamado por usuário de perfil PADRAO: prova que
   * quem está abrindo é mesmo o dono da matrícula (a conta logada é genérica).
   *
   * O portal autentica pela CHAPA numérica (ex.: 002873), não pela matrícula
   * E-prefixada que o usuário digita (ex.: E05111) — normalizamos pra dígitos +
   * zero-pad 6 (o 'E' ocupa o lugar do zero à esquerda: E05111 → 005111).
   *
   * Resposta: { autenticacao: "Credenciais válidas!" | "Credenciais inválidas!" }.
   * Distingue INDISPONIVEL (Protheus fora / endpoint não cadastrado / resposta
   * inesperada) de CREDENCIAIS_INVALIDAS — o chamador decide o que fazer com
   * cada caso (bloquear vs. permitir com ressalva). NUNCA loga a senha.
   */
  async validarCredencialPortal(
    matricula: string,
    senha: string,
  ): Promise<
    | { valida: true; matricula: string }
    | { valida: false; motivo: 'CREDENCIAIS_INVALIDAS' | 'INDISPONIVEL' }
  > {
    const ep = await this.resolveEndpoint('loginPortal');
    if (!ep) return { valida: false, motivo: 'INDISPONIVEL' };

    const chapa = matricula.replace(/\D/g, '').padStart(6, '0');
    const url = `${ep.baseUrl}?MATRICULA=${encodeURIComponent(chapa)}&SENHA=${encodeURIComponent(senha)}`;
    // Label redigido: a query string acima carrega a SENHA — não pode ir pro log.
    const logLabel = `loginPortal MATRICULA=${chapa} (senha omitida)`;
    this.logger.log(`Validando credencial portal (chapa ${chapa}, ambiente: ${ep.ambiente})`);

    const data = await this.requestJson(url, ep.authHeader, ep.timeoutMs, {
      method: ep.metodo || 'POST',
      logLabel,
    });
    if (!data) return { valida: false, motivo: 'INDISPONIVEL' };

    // Normaliza acento + caixa. Atenção: "invalidas" CONTÉM "validas" — testar
    // 'invalid' ANTES de 'valid'.
    const auth = String(data.autenticacao ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (auth.includes('invalid')) {
      return { valida: false, motivo: 'CREDENCIAIS_INVALIDAS' };
    }
    if (auth.includes('valid')) {
      return { valida: true, matricula: String(data.matricula ?? chapa).trim() };
    }
    this.logger.warn(
      `loginPortal resposta inesperada (chapa ${chapa}): ${JSON.stringify(data).slice(0, 120)}`,
    );
    return { valida: false, motivo: 'INDISPONIVEL' };
  }

  /**
   * Normaliza um registro de funcionário do portal RH ({matricula,nome,cc} com
   * espaços à direita). Retorna null se faltar matrícula ou nome (ex.: registro
   * de erro). Compartilhado entre busca por matrícula e por nome.
   */
  private mapFuncionario(
    raw: Record<string, unknown> | null | undefined,
  ): { matricula: string; nome: string; cc: string | null } | null {
    if (!raw) return null;
    const norm = (v: unknown) => String(v ?? '').trim();
    const matricula = norm(raw.matricula);
    const nome = norm(raw.nome);
    if (!matricula || !nome) return null;
    return { matricula, nome, cc: raw.cc ? norm(raw.cc) : null };
  }

  async buscarColaborador(
    matricula: string,
  ): Promise<{ matricula: string; nome: string; cc: string | null } | null> {
    const ep = await this.resolveInfoFuncionario();
    if (!ep) return null;

    const url = `${ep.baseUrl}?MATRICULA=${encodeURIComponent(matricula)}`;
    this.logger.log(`Buscando colaborador ${matricula} (ambiente: ${ep.ambiente})`);

    const data = await this.requestJson(url, ep.authHeader, ep.timeoutMs);
    if (!data) return null;

    // Desde 05/06 o portal RH unificou o retorno: ?MATRICULA= passou a vir
    // embrulhado em { funcionarios: [...] } (como o ?NOME=), não mais flat
    // { matricula,nome,cc }. Toleramos ambos os formatos — DEV/HOM/PROD já
    // divergiram antes. Matrícula inválida → { mensagem: ... } (sem funcionarios).
    const candidatos: Array<Record<string, unknown>> = Array.isArray(data.funcionarios)
      ? (data.funcionarios as Array<Record<string, unknown>>)
      : data.nome
        ? [data]
        : [];
    // ?MATRICULA= é busca específica (1 item), mas preferimos o match exato e
    // caímos no 1º como fallback (prefixo 'E'/zero-padding diverge por ambiente).
    const norm = (v: unknown) => String(v ?? '').trim();
    const escolhido =
      candidatos.find((f) => norm(f.matricula) === norm(matricula)) ?? candidatos[0];
    const alvo = this.mapFuncionario(escolhido);
    if (!alvo) {
      if (data.mensagem) this.logger.warn(`Protheus infoFuncionario: ${String(data.mensagem)} (matricula ${matricula})`);
      return null;
    }
    return alvo;
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
      .map((f) => this.mapFuncionario(f as Record<string, unknown>))
      .filter((f): f is { matricula: string; nome: string; cc: string | null } => f !== null);
  }
}
