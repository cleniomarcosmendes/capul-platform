import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';

const AUTH_GATEWAY_URL = process.env.AUTH_GATEWAY_URL || 'http://auth-gateway:3000';

interface ProtheusEndpoint { operacao: string; url: string; metodo: string; timeoutMs: number }
interface ProtheusConfig { ambiente: string; tipoAuth: string; authConfig: string | null; endpoints: ProtheusEndpoint[] }

export interface EnderecoCliente {
  logradouro: string;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  rotulo: string; // origem: "Cobrança", "Loja 0001"...
}

export interface ClienteProtheus {
  matricula: string;
  nome: string;
  cpfCnpj: string | null;
  telefone: string | null;
  enderecos: EnderecoCliente[]; // pode ter mais de um — operador escolhe (ou digita novo)
}

// Cache de config (TTL 5 min) — igual ao gestao-ti.
let configCache: ProtheusConfig | null = null;
let configCacheTs = 0;
const CACHE_TTL = 300_000;
const trim = (v: unknown) => String(v ?? '').trim();

/**
 * Consulta de cliente (SA1) no Protheus por MATRÍCULA (CODCLIENTE), via a
 * operação `clienteEndereco` (resolvida dinamicamente no Configurador, módulo
 * LOGISTICA). Hoje aponta para `getLimite`, que já devolve nome + endereço +
 * telefone + CPF do cliente. INTERINO: quando o Protheus entregar um endpoint
 * dedicado (ver docs/SOLICITACAO_PROTHEUS_enderecos_SA1.md), troca-se só a
 * operação no Configurador — o mapeamento abaixo é o ponto único de ajuste.
 * Somente LEITURA, sem SEFAZ.
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

  /** Mapeia a resposta do getLimite (clientes/SA1) para o formato normalizado. */
  private mapGetLimite(j: Record<string, unknown>, matriculaBusca: string): ClienteProtheus | null {
    const matricula = trim((j as { matricula?: unknown }).matricula);
    // Não encontrado: getLimite cai no CLIENTE PADRÃO (000001) quando o código
    // não casa — guardamos pela divergência de matrícula echo.
    if (!matricula || matricula.toUpperCase() !== matriculaBusca.trim().toUpperCase()) return null;

    const mc = ((j.manutencaocompartilhada ?? {}) as Record<string, unknown>);
    const cads = (((j.cadastrosativos ?? []) as unknown[]).filter(Boolean)) as Record<string, unknown>[];
    // DDD vem com zero de discagem ("038") — o DDD real é 2 dígitos. Limpa não
    // dígitos e tira o zero à esquerda antes de juntar com o número.
    const ddd = trim(mc.ddd).replace(/\D/g, '').replace(/^0+/, '');
    const num = trim(mc.tel).replace(/\D/g, '');
    const tel = `${ddd}${num}`;

    // Monta a lista de endereços: o de COBRANÇA (mais completo — tem bairro/CEP)
    // + cada cadastro/loja. Dedupe por logradouro+cidade. O operador escolhe um
    // ou digita um novo no cadastro da entrega.
    // Chave de dedupe tolerante: o mesmo endereço aparece no bloco de cobrança
    // ("475 APTO 108") e no cadastro/loja ("475 AP 108") com formatações
    // diferentes. Normaliza abreviações comuns + remove pontuação/espaços.
    const chaveDedupe = (logradouro: string, cidade: string | null) =>
      `${logradouro} ${cidade ?? ''}`
        .toUpperCase()
        .replace(/APARTAMENTO|APTO/g, 'AP')
        .replace(/[^A-Z0-9]/g, '');

    const enderecos: EnderecoCliente[] = [];
    // Cobrança primeiro (mais completo: tem bairro/CEP) → vence no dedupe.
    const logCob = trim(mc.endcob);
    if (logCob) {
      enderecos.push({
        logradouro: logCob,
        bairro: trim(mc.bairroc) || null,
        cidade: trim(mc.munc) || null,
        uf: trim(mc.estc) || null,
        cep: trim(mc.cepc) || null,
        rotulo: 'Cadastro',
      });
    }
    for (const c of cads) {
      const log = trim(c.endereco);
      if (!log) continue;
      enderecos.push({
        logradouro: log,
        bairro: null,
        cidade: trim(c.municipio) || null,
        uf: trim(c.estado) || null,
        cep: null,
        rotulo: cads.length > 1 ? `Loja ${trim(c.loja)}`.trim() : 'Cadastro',
      });
    }
    const vistos = new Set<string>();
    const enderecosUnicos = enderecos.filter((e) => {
      const k = chaveDedupe(e.logradouro, e.cidade);
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });

    return {
      matricula,
      nome: trim(j.nome),
      cpfCnpj: trim((cads[0] ?? {}).cgc) || null,
      telefone: tel || null,
      enderecos: enderecosUnicos,
    };
  }

  /** Busca cliente por matrícula (CODCLIENTE). Retorna null se config ausente / não encontrado. */
  async porMatricula(matricula: string): Promise<ClienteProtheus | null> {
    const mat = trim(matricula);
    if (!mat) return null;
    const config = await this.getConfig();
    if (!config) { this.logger.warn('Config Protheus LOGISTICA indisponível'); return null; }
    const ep = config.endpoints.find((e) => e.operacao === 'clienteEndereco');
    if (!ep) { this.logger.warn('Operação clienteEndereco não cadastrada (LOGISTICA)'); return null; }

    const url = `${ep.url}?CODCLIENTE=${encodeURIComponent(mat)}`;
    this.logger.log(`Consultando cliente ${mat} (ambiente ${config.ambiente})`);
    const data = await this.requestJson(url, this.auth(config), ep.timeoutMs || 5000);
    if (!data) return null;
    return this.mapGetLimite(data, mat);
  }
}
