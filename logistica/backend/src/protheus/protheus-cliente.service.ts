import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';

const AUTH_GATEWAY_URL = process.env.AUTH_GATEWAY_URL || 'http://auth-gateway:3000';

interface ProtheusEndpoint { operacao: string; url: string; metodo: string; timeoutMs: number }
interface ProtheusConfig { ambiente: string; tipoAuth: string; authConfig: string | null; endpoints: ProtheusEndpoint[] }

export interface EnderecoCliente {
  logradouro: string;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  rotulo: string; // origem do endereço (SA1 = "Cadastro")
}

export interface ClienteProtheus {
  matricula: string;
  nome: string;
  cpfCnpj: string | null;
  telefone: string | null;
  enderecos: EnderecoCliente[]; // endereço do SA1 (operador escolhe ou digita novo)
}

// Cache de config (TTL 5 min) — igual ao gestao-ti.
let configCache: ProtheusConfig | null = null;
let configCacheTs = 0;
const CACHE_TTL = 300_000;
const trim = (v: unknown) => String(v ?? '').trim();

/**
 * Consulta de cliente (SA1) no Protheus via a operação `clienteEndereco`
 * (resolvida dinamicamente no Configurador, módulo LOGISTICA). Endpoint
 * DEDICADO entregue pela equipe Protheus (06/2026):
 *   GET /api/INFOCLIENTES/LOGISTICA/clienteEndereco?MATRICULA|TELEFONE|NOME=...
 * Busca clientes ATIVOS da SA1 (bloqueados A1_MSBLQL='1' nunca aparecem),
 * por matrícula (exata), telefone (parcial) ou nome (parcial), devolvendo
 * endereço + contatos. Máx. 200 registros. Somente LEITURA, sem SEFAZ.
 */
@Injectable()
export class ProtheusClienteService {
  private readonly logger = new Logger(ProtheusClienteService.name);

  private async getConfig(): Promise<ProtheusConfig | null> {
    const now = Date.now();
    if (configCache && now - configCacheTs < CACHE_TTL) return configCache;
    try {
      const url = `${AUTH_GATEWAY_URL}/api/v1/internal/integracoes/codigo/PROTHEUS/endpoints-ativos?modulo=LOGISTICA`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        configCache = await res.json();
        configCacheTs = now;
        return configCache;
      }
      this.logger.warn(`API integracoes retornou ${res.status}`);
    } catch (err) {
      this.logger.warn(`Config Protheus indisponível: ${err instanceof Error ? err.message : String(err)}`);
    }
    return configCache;
  }

  private auth(c: ProtheusConfig): string {
    if (!c.authConfig) return '';
    if (c.tipoAuth === 'BASIC') return `Basic ${c.authConfig}`;
    if (c.tipoAuth === 'BEARER') return `Bearer ${c.authConfig}`;
    return c.authConfig;
  }

  private requestJson(url: string, authHeader: string, timeoutMs: number): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      const u = new URL(url);
      const transport = u.protocol === 'https:' ? https : http;
      const req = transport.request(
        {
          hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
          path: u.pathname + u.search, method: 'GET',
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          timeout: timeoutMs, rejectUnauthorized: false,
        },
        (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            if (!res.statusCode || res.statusCode >= 400) { this.logger.warn(`Protheus ${res.statusCode} em ${u.pathname}`); return resolve(null); }
            try { resolve(JSON.parse(body)); } catch { this.logger.error('Falha ao parsear resposta Protheus'); resolve(null); }
          });
        },
      );
      req.on('timeout', () => { req.destroy(); this.logger.error('Timeout Protheus'); resolve(null); });
      req.on('error', (e) => { this.logger.error(`Erro Protheus: ${e.message}`); resolve(null); });
      req.end();
    });
  }

  /** Mapeia a resposta `{ total, itens: [...] }` do clienteEndereco (SA1). */
  private mapItens(j: Record<string, unknown>): ClienteProtheus[] {
    const itens = (((j.itens ?? []) as unknown[]).filter(Boolean)) as Record<string, unknown>[];
    return itens.map((it) => this.mapItem(it)).filter((c): c is ClienteProtheus => !!c);
  }

  private mapItem(it: Record<string, unknown>): ClienteProtheus | null {
    const matricula = trim(it.matricula);
    const nome = trim(it.nome);
    if (!matricula && !nome) return null;

    const end = ((it.endereco ?? {}) as Record<string, unknown>);
    const logradouro = trim(end.logrado);
    const enderecos: EnderecoCliente[] = logradouro
      ? [{
          logradouro,
          complemento: trim(end.complem) || null,
          bairro: trim(end.bairro) || null,
          cidade: trim(end.municip) || null,
          uf: trim(end.uf) || null,
          cep: trim(end.cep) || null,
          rotulo: 'Cadastro',
        }]
      : [];

    // contatos = lista de números já normalizados (DDD+número), sem duplicatas.
    const contatos = (((it.contatos ?? []) as unknown[]).filter(Boolean)) as Record<string, unknown>[];
    const telefone = contatos.map((c) => trim(c.numero)).find((n) => n) ?? null;

    return {
      matricula,
      nome,
      cpfCnpj: trim(it.cpfcnpj) || null,
      telefone,
      enderecos,
    };
  }

  /**
   * Busca clientes (SA1) por UM de: matrícula (exata), telefone (parcial) ou
   * nome (parcial). Retorna lista (até 200). [] se config ausente / nada achado.
   */
  async buscar(params: { matricula?: string; telefone?: string; nome?: string }): Promise<ClienteProtheus[]> {
    const config = await this.getConfig();
    if (!config) { this.logger.warn('Config Protheus LOGISTICA indisponível'); return []; }
    const ep = config.endpoints.find((e) => e.operacao === 'clienteEndereco');
    if (!ep) { this.logger.warn('Operação clienteEndereco não cadastrada (LOGISTICA)'); return []; }

    let qs = '';
    let alvo = '';
    if (params.matricula?.trim()) { alvo = `matrícula ${params.matricula.trim()}`; qs = `MATRICULA=${encodeURIComponent(params.matricula.trim())}`; }
    else if (params.telefone?.trim()) { const t = params.telefone.replace(/\D/g, ''); alvo = `telefone ${t}`; qs = `TELEFONE=${encodeURIComponent(t)}`; }
    else if (params.nome?.trim()) { alvo = `nome ${params.nome.trim()}`; qs = `NOME=${encodeURIComponent(params.nome.trim())}`; }
    else return [];

    const url = `${ep.url}?${qs}`;
    this.logger.log(`Consultando cliente por ${alvo} (ambiente ${config.ambiente})`);
    const data = await this.requestJson(url, this.auth(config), ep.timeoutMs || 5000);
    if (!data) return [];
    return this.mapItens(data);
  }

  /** Busca cliente por matrícula (exata). Retorna null se não encontrado. */
  async porMatricula(matricula: string): Promise<ClienteProtheus | null> {
    const mat = trim(matricula);
    if (!mat) return null;
    const list = await this.buscar({ matricula: mat });
    return list.find((c) => c.matricula.toUpperCase() === mat.toUpperCase()) ?? list[0] ?? null;
  }
}
