import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

/**
 * Cliente HTTP do Gestão TI para consumir o módulo Fiscal.
 *
 * Hoje há um único caso de uso: ao cadastrar/editar NF de Compras, o usuário
 * pode informar a chave NF-e (44 dígitos) e queremos:
 *   1. Validar via Fiscal (que faz SZR/SZQ no Protheus → fallback SEFAZ → grava)
 *   2. Retornar preview (emitente, número, valor, produtos) pro frontend
 *
 * O endpoint Fiscal `POST /api/v1/fiscal/nfe/consulta` exige role mínima
 * fiscal (`OPERADOR_ENTRADA`). Propagamos o JWT do usuário do Gestão TI —
 * portanto quem cadastra NF e vincula chave precisa também ter role no
 * módulo Fiscal. Sem role: 403 retornado tal qual ao chamador.
 *
 * Não usamos `@nestjs/axios` — Node 22 já tem `fetch` global; basta envolver
 * com tratamento de erro tipado.
 */
@Injectable()
export class FiscalNfeClient {
  private readonly logger = new Logger(FiscalNfeClient.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor() {
    // Default cobre o ambiente Docker Compose interno. Sobrescrita em
    // produção/HOM via env (ver docker-compose.yml).
    this.baseUrl = process.env.FISCAL_API_URL ?? 'http://fiscal-backend:3002/api/v1/fiscal';
    this.timeoutMs = Number(process.env.FISCAL_API_TIMEOUT_MS ?? 15_000);
  }

  /**
   * Chama POST /nfe/consulta no módulo Fiscal.
   *
   * @param chave 44 dígitos (assumimos já validados pelo chamador — mod-11)
   * @param jwt   Token Bearer do usuário corrente
   * @param filial Código de filial (opcional — Fiscal usa a do JWT senão)
   * @returns Resposta crua do Fiscal (NfeConsultaResult). Tipagem fraca de
   *          propósito: o Gestão TI extrai só o que precisa (emitente,
   *          destinatário, valor, produtos, status SEFAZ).
   */
  async consultarChave(
    chave: string,
    jwt: string,
    filial?: string,
  ): Promise<FiscalConsultaRetorno> {
    const url = `${this.baseUrl}/nfe/consulta`;
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chave, filial, tentarTodasFiliais: true }),
        signal: controller.signal,
      });

      if (resp.status === 401) {
        // Token expirado / inválido aos olhos do Fiscal. Geralmente reflete
        // o mesmo problema que apareceria no Gestão TI — mas vale logar.
        this.logger.warn(`Fiscal devolveu 401 ao consultar chave ${chave.slice(0, 8)}…`);
        throw new ForbiddenException('Sessão expirada — faça login novamente');
      }
      if (resp.status === 403) {
        throw new ForbiddenException(
          'Usuário sem permissão no módulo Fiscal. Para vincular chave de NF-e ' +
          'aqui no Compras, é necessário ter role mínima OPERADOR_ENTRADA no Fiscal.',
        );
      }
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        this.logger.error(`Fiscal /nfe/consulta status ${resp.status}: ${text.slice(0, 300)}`);
        throw new BadGatewayException(
          `Módulo Fiscal retornou erro ${resp.status} ao consultar chave. ` +
          'Tente novamente em alguns instantes.',
        );
      }

      return (await resp.json()) as FiscalConsultaRetorno;
    } catch (err: unknown) {
      if (err instanceof ForbiddenException || err instanceof BadGatewayException) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        this.logger.warn(`Timeout (${this.timeoutMs}ms) ao consultar Fiscal para chave ${chave.slice(0, 8)}…`);
        throw new ServiceUnavailableException(
          'Módulo Fiscal não respondeu a tempo (timeout). SEFAZ pode estar lento; tente novamente.',
        );
      }
      this.logger.error(`Falha inesperada ao chamar Fiscal: ${String(err)}`);
      throw new InternalServerErrorException('Falha ao consultar módulo Fiscal');
    } finally {
      clearTimeout(tid);
    }
  }
}

/**
 * Resposta esperada de POST /nfe/consulta. Tipagem mínima — só as partes
 * que o Gestão TI lê. Campos extras do Fiscal são ignorados (forward-compat).
 * Shape espelha `NfeParsed` em fiscal/.../nfe-parsed.interface.ts.
 */
export interface FiscalConsultaRetorno {
  origem: string;
  parsed: {
    dadosGerais: {
      chave: string;
      numero: string;
      serie: string;
      dataEmissao?: string;
    };
    emitente: {
      cnpj?: string | null;
      cpf?: string | null;
      razaoSocial: string;
      inscricaoEstadual?: string | null;
    };
    destinatario: {
      cnpj?: string | null;
      cpf?: string | null;
      razaoSocial: string;
    };
    totais: {
      valorNota: number;
      valorProdutos?: number;
    };
    /**
     * `cStat` é STRING (ex: "100" = autorizada, "101" = cancelada).
     * Cancelamentos pós-autorização aparecem em `eventos` (não aqui).
     */
    protocoloAutorizacao?: {
      protocolo: string;
      dataRecebimento: string;
      cStat: string;
      motivo: string;
      ambiente: '1' | '2';
    } | null;
    produtos: Array<{
      item: number;
      codigo: string;
      descricao: string;
      ncm?: string | null;
      cfop?: string | null;
      unidadeComercial?: string;
      quantidadeComercial: number;
      valorUnitarioComercial: number;
      valorTotalBruto: number;
    }>;
    /**
     * Eventos pós-autorização (cancelamento, CC-e, manifestação). Usado pra
     * detectar cancelamento via tpEvento=110111.
     */
    eventos?: Array<{
      tpEvento?: string;
      cStat?: string;
      motivo?: string;
    }>;
  };
}
