import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProtheusHttpClient, ProtheusHttpError } from './protheus-http.client.js';
import { ProtheusXmlMock } from './mocks/protheus-xml.mock.js';
import { XmlFiscalProtheusError } from './interfaces/xml-fiscal.interface.js';
import {
  XmlNfeProtheusError,
  type XmlNfeResult,
} from './interfaces/xml-nfe.interface.js';
import type { GrvXmlBody } from './interfaces/grv-xml.interface.js';

/**
 * Adapter da frente XML fiscal Protheus — contrato v2 (22/04/2026):
 *   - `buscarXml(chave)` → GET /xmlNfe (unificado NF-e + CT-e, resolve SZR010 ou SPED156)
 *   - `grvXml(body)`     → POST /grvXML (grava SZR010 + SZQ010)
 *
 * Toggle por env `FISCAL_PROTHEUS_MOCK`:
 *   - true  → usa stub em memória (ProtheusXmlMock)
 *   - false → faz chamadas reais ao Protheus via undici
 *
 * A interface pública é idêntica nos dois modos — qualquer código que
 * consome este service não precisa saber qual modo está ativo.
 */
@Injectable()
export class ProtheusXmlService {
  private readonly logger = new Logger(ProtheusXmlService.name);
  private readonly mockMode: boolean;
  private readonly mock = new ProtheusXmlMock();

  constructor(
    private readonly http: ProtheusHttpClient,
    config: ConfigService,
  ) {
    this.mockMode = config.get<string>('FISCAL_PROTHEUS_MOCK') === 'true';
    if (this.mockMode) {
      this.logger.warn('ProtheusXmlService MOCK ATIVO — chamadas xmlNfe/grvXML não atingem o Protheus real.');
    }
  }

  /**
   * Expoe se o service esta operando em modo mock (stub em memoria) ou
   * chamando o Protheus real. Usado por callers que precisam refletir esse
   * estado ao usuario final (ex: OrigemBadge no frontend).
   */
  isMockAtivo(): boolean {
    return this.mockMode;
  }

  /**
   * Busca XML de NF-e via `GET /xmlNfe?CHAVENFEE=...` (contrato 20/04/2026).
   *
   * O Protheus tenta SZR010 primeiro; se não houver, faz fallback para
   * SPED156.DOCXMLRET. Quando origem = SPED156, o caller é responsável por
   * chamar `POST /grvXML` para popular SZR/SZQ (Protheus não auto-grava).
   *
   * Retorna `{ found: false }` em vez de exceção para 404 — o caller decide
   * se cai para fallback SEFAZ.
   */
  async buscarXml(chave: string): Promise<XmlNfeResult> {
    if (this.mockMode) return this.mock.buscarXml(chave);

    try {
      const resp = await this.http.request<{
        chave: string;
        origem: 'SZR010' | 'SPED156';
        xmlBase64: string;
      }>({
        operacao: 'xmlNfe',
        method: 'GET',
        query: { CHAVENFEE: chave },
      });
      return {
        found: true,
        chave: resp.chave,
        origem: resp.origem,
        xmlBase64: resp.xmlBase64,
      };
    } catch (err) {
      if (err instanceof ProtheusHttpError) {
        if (err.statusCode === 404) {
          const body = err.body as { message?: string } | string | null;
          const message =
            typeof body === 'object' && body?.message
              ? body.message
              : 'XML não localizado em SZR010 nem em SPED156.';
          return { found: false, chave, message };
        }
        if (err.statusCode === 400) {
          throw new XmlNfeProtheusError(
            'CHAVE_INVALIDA',
            typeof err.body === 'string'
              ? err.body
              : 'Chave inválida para xmlNfe.',
            400,
          );
        }
        if (err.statusCode === 401 || err.statusCode === 403) {
          throw new XmlNfeProtheusError(
            'NAO_AUTORIZADO',
            `xmlNfe retornou HTTP ${err.statusCode}`,
            err.statusCode,
          );
        }
      }
      this.logger.error(
        `xmlNfe erro inesperado para chave ${chave.slice(0, 6)}…: ${(err as Error).message}`,
      );
      throw new XmlNfeProtheusError(
        'PROTHEUS_INDISPONIVEL',
        `Protheus inacessível em xmlNfe: ${(err as Error).message}`,
        503,
      );
    }
  }

  /**
   * Filial de DESTINO de nota de SAÍDA Capul via `GET /xmlFilDestino?CHAVENFEE=`
   * (SPED050 — endpoint entregue 12/06/2026). Pra transferência entre filiais:
   * o NFeDistribuicaoDFe só entrega o XML pra parte com interesse (destinatária)
   * — com o CNPJ dela fazemos UMA consulta SEFAZ direcionada em vez do 641 da
   * emitente + varredura de filiais.
   *
   * Best-effort: 404 = chave não é saída Capul na SPED050 (ex.: nota de
   * fornecedor) → `{found:false}` e o fluxo segue normal. Erros técnicos
   * também viram `{found:false}` (não derrubam a consulta).
   */
  async buscarFilialDestino(chave: string): Promise<{
    found: boolean;
    cnpjDestino?: string;
    codFilial?: string;
    numeroNF?: string;
  }> {
    if (this.mockMode) return { found: false };

    try {
      const resp = await this.http.request<{
        chave: string;
        cnpjOrigem: string;
        cnpjDestino: string;
        numeroNF: string;
        serie: string;
        codFilial: string;
      }>({
        operacao: 'xmlFilDestino',
        method: 'GET',
        query: { CHAVENFEE: chave },
      });
      const cnpj = (resp.cnpjDestino ?? '').replace(/\D/g, '');
      if (cnpj.length !== 14) return { found: false };
      return {
        found: true,
        cnpjDestino: cnpj,
        codFilial: (resp.codFilial ?? '').trim() || undefined,
        numeroNF: (resp.numeroNF ?? '').trim() || undefined,
      };
    } catch (err) {
      if (!(err instanceof ProtheusHttpError && err.statusCode === 404)) {
        this.logger.warn(
          `xmlFilDestino falhou para chave ${chave.slice(0, 6)}…: ${(err as Error).message} — seguindo fluxo normal.`,
        );
      }
      return { found: false };
    }
  }

  /**
   * Grava XML em SZR010 (cabeçalho) + SZQ010 (itens) via `POST /grvXML`
   * (contrato simplificado 08/05/2026).
   *
   * Body: `{ itens: [{ xmlBase64 }] }` — Protheus extrai os campos do XML
   * (chave, emitente, itens, etc.). Permite batch.
   *
   * Resposta: `GrvXmlResponse` com `{ totalSucesso, totalFalha, resultados[] }`.
   * Cada resultado tem `sucesso`, `xmlGravado`, `pendenteAmarracao`,
   * `preNotaFalhou`, `mensagem`.
   */
  async grvXml(body: GrvXmlBody): Promise<unknown> {
    if (this.mockMode) return this.mock.grvXml(body);

    try {
      return await this.http.request<unknown>({
        operacao: 'grvXML',
        method: 'POST',
        body,
      });
    } catch (err) {
      if (err instanceof ProtheusHttpError) {
        throw new XmlFiscalProtheusError(
          err.statusCode >= 500 ? 'PROTHEUS_INDISPONIVEL' : 'FALHA_GRAVACAO',
          `grvXML retornou HTTP ${err.statusCode}: ${
            typeof err.body === 'string'
              ? err.body.slice(0, 200)
              : JSON.stringify(err.body).slice(0, 200)
          }`,
          err.statusCode,
        );
      }
      this.logger.error(
        `grvXML erro inesperado: ${(err as Error).message}`,
      );
      throw new XmlFiscalProtheusError(
        'PROTHEUS_INDISPONIVEL',
        `Protheus inacessível em grvXML: ${(err as Error).message}`,
        503,
      );
    }
  }

}
