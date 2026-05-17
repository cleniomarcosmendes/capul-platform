import { Injectable, Logger } from '@nestjs/common';
import { onlyDigits } from '../common/helpers/cnpj.helper.js';

/**
 * Dados obtidos via Receita Federal (BrasilAPI ou ReceitaWS).
 * Complementam os dados do SEFAZ CCC com campos que não existem no CCC:
 * situação do CNPJ, porte, CNAE oficial, razão/fantasia da Receita, etc.
 */
export interface ReceitaFederalData {
  cnpj: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  situacao: string | null;           // "ATIVA" | "BAIXADA" | "SUSPENSA" | "INAPTA" | "NULA"
  dataSituacao: string | null;
  motivoSituacao: string | null;
  naturezaJuridica: string | null;
  porte: string | null;              // "MICRO EMPRESA" | "EMPRESA DE PEQUENO PORTE" | "DEMAIS"
  capitalSocial: number | null;
  cnaeFiscal: string | null;
  cnaeFiscalDescricao: string | null;
  cnaesSecundarios: Array<{ codigo: string; descricao: string }>;
  dataAbertura: string | null;
  endereco: {
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    municipio: string | null;
    uf: string | null;
    cep: string | null;
  } | null;
  telefone: string | null;
  email: string | null;
  fonte: 'BRASILAPI' | 'RECEITAWS' | 'RFB_LOCAL';
  consultadoEm: string;
}

interface CacheEntry {
  data: ReceitaFederalData;
  expiresAt: number;
}

/**
 * Cliente para enriquecer dados de cadastro com informações da Receita Federal
 * via APIs públicas gratuitas. Estratégia: tenta BrasilAPI primeiro (mais estável);
 * se falhar, cai para ReceitaWS.
 *
 * Limitações conhecidas:
 *  - **Apenas CNPJ**. Nenhuma API pública gratuita oferece dados de CPF.
 *  - Rate limits: BrasilAPI é generoso, ReceitaWS limita a 3 req/min gratuito.
 *  - Cache de 24h em memória para reduzir chamadas repetidas (auditoria 10/05/2026 #M2 — antes era 6h).
 *  - Retry interno: 1 tentativa adicional com backoff 500ms em erros de rede/5xx
 *    (auditoria 10/05/2026 #M2 — glitches pontuais não derrubam mais a consulta).
 */
@Injectable()
export class ReceitaClient {
  private readonly logger = new Logger(ReceitaClient.name);
  private readonly cache = new Map<string, CacheEntry>();
  // Estendido de 6h pra 24h (auditoria 10/05/2026 #M2). Receita Federal raramente
  // muda dados em 1 dia; cache mais longo reduz chamadas externas.
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

  async consultarCnpj(cnpj: string): Promise<ReceitaFederalData | null> {
    const digits = onlyDigits(cnpj);
    if (digits.length !== 14) {
      return null;
    }

    // Cache hit
    const cached = this.cache.get(digits);
    if (cached && cached.expiresAt > Date.now()) {
      this.logger.debug(`Receita cache HIT para ${digits.slice(0, 8)}…`);
      return cached.data;
    }

    // Tenta BrasilAPI
    try {
      const data = await this.consultarBrasilApi(digits);
      if (data) {
        this.cache.set(digits, { data, expiresAt: Date.now() + this.CACHE_TTL_MS });
        return data;
      }
    } catch (err) {
      this.logger.warn(
        `BrasilAPI falhou para ${digits.slice(0, 8)}… : ${(err as Error).message} — tentando ReceitaWS.`,
      );
    }

    // Fallback ReceitaWS
    try {
      const data = await this.consultarReceitaWs(digits);
      if (data) {
        this.cache.set(digits, { data, expiresAt: Date.now() + this.CACHE_TTL_MS });
        return data;
      }
    } catch (err) {
      this.logger.warn(
        `ReceitaWS falhou para ${digits.slice(0, 8)}… : ${(err as Error).message}`,
      );
    }

    return null;
  }

  /**
   * Wrapper de fetch com 1 retry e backoff 500ms em erros transitorios
   * (auditoria 10/05/2026 #M2). Não retry em 4xx (definitivo) — apenas em
   * erros de rede (timeout, connection refused) ou 5xx (servidor instável).
   */
  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    const RETRIES = 1;
    const BACKOFF_MS = 500;
    let lastErr: Error | undefined;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      try {
        const res = await fetch(url, init);
        // 5xx é transitório — pode retry
        if (res.status >= 500 && attempt < RETRIES) {
          this.logger.warn(`Receita ${url.split('/')[2]}: HTTP ${res.status} (tentativa ${attempt + 1}/${RETRIES + 1}) — retry em ${BACKOFF_MS}ms`);
          await new Promise((r) => setTimeout(r, BACKOFF_MS));
          continue;
        }
        return res;
      } catch (err) {
        lastErr = err as Error;
        if (attempt < RETRIES) {
          this.logger.warn(`Receita ${url.split('/')[2]}: erro de rede (${lastErr.message}) — retry em ${BACKOFF_MS}ms`);
          await new Promise((r) => setTimeout(r, BACKOFF_MS));
        }
      }
    }
    throw lastErr ?? new Error('Falha sem detalhes');
  }

  private async consultarBrasilApi(cnpj: string): Promise<ReceitaFederalData | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await this.fetchWithRetry(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      if (res.status === 404) {
        this.logger.warn(`BrasilAPI: CNPJ ${cnpj.slice(0, 8)}… não encontrado.`);
        return null;
      }
      if (!res.ok) {
        throw new Error(`BrasilAPI HTTP ${res.status}`);
      }
      const j = (await res.json()) as any;
      return {
        cnpj,
        razaoSocial: j.razao_social ?? null,
        nomeFantasia: j.nome_fantasia ?? null,
        situacao: j.descricao_situacao_cadastral ?? null,
        dataSituacao: j.data_situacao_cadastral ?? null,
        motivoSituacao: j.descricao_motivo_situacao_cadastral ?? null,
        naturezaJuridica: j.natureza_juridica ?? null,
        porte: j.porte ?? null,
        capitalSocial: typeof j.capital_social === 'number' ? j.capital_social : null,
        cnaeFiscal: j.cnae_fiscal ? String(j.cnae_fiscal) : null,
        cnaeFiscalDescricao: j.cnae_fiscal_descricao ?? null,
        cnaesSecundarios: Array.isArray(j.cnaes_secundarios)
          ? j.cnaes_secundarios.map((c: any) => ({
              codigo: String(c.codigo ?? ''),
              descricao: String(c.descricao ?? ''),
            }))
          : [],
        dataAbertura: j.data_inicio_atividade ?? null,
        endereco: {
          logradouro: j.logradouro ?? null,
          numero: j.numero ?? null,
          complemento: j.complemento ?? null,
          bairro: j.bairro ?? null,
          municipio: j.municipio ?? null,
          uf: j.uf ?? null,
          cep: j.cep ?? null,
        },
        telefone: j.ddd_telefone_1 ?? null,
        email: j.email ?? null,
        fonte: 'BRASILAPI',
        consultadoEm: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async consultarReceitaWs(cnpj: string): Promise<ReceitaFederalData | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await this.fetchWithRetry(`https://receitaws.com.br/v1/cnpj/${cnpj}`, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`ReceitaWS HTTP ${res.status}`);
      }
      const j = (await res.json()) as any;
      if (j.status === 'ERROR') {
        this.logger.warn(`ReceitaWS: ${j.message ?? 'erro desconhecido'}`);
        return null;
      }
      return {
        cnpj,
        razaoSocial: j.nome ?? null,
        nomeFantasia: j.fantasia ?? null,
        situacao: j.situacao ?? null,
        dataSituacao: j.data_situacao ?? null,
        motivoSituacao: j.motivo_situacao ?? null,
        naturezaJuridica: j.natureza_juridica ?? null,
        porte: j.porte ?? null,
        capitalSocial: j.capital_social ? Number(String(j.capital_social).replace(/[^\d.]/g, '')) : null,
        cnaeFiscal: j.atividade_principal?.[0]?.code?.replace(/\D/g, '') ?? null,
        cnaeFiscalDescricao: j.atividade_principal?.[0]?.text ?? null,
        cnaesSecundarios: Array.isArray(j.atividades_secundarias)
          ? j.atividades_secundarias.map((c: any) => ({
              codigo: String(c.code ?? '').replace(/\D/g, ''),
              descricao: String(c.text ?? ''),
            }))
          : [],
        dataAbertura: j.abertura ?? null,
        endereco: {
          logradouro: j.logradouro ?? null,
          numero: j.numero ?? null,
          complemento: j.complemento ?? null,
          bairro: j.bairro ?? null,
          municipio: j.municipio ?? null,
          uf: j.uf ?? null,
          cep: j.cep ?? null,
        },
        telefone: j.telefone ?? null,
        email: j.email ?? null,
        fonte: 'RECEITAWS',
        consultadoEm: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
