import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProtheusHttpClient, ProtheusHttpError } from './protheus-http.client.js';
import { ProtheusXmlMock } from './mocks/protheus-xml.mock.js';
import {
  XmlFiscalProtheusError,
  type XmlFiscalErrorBody,
  type XmlFiscalExistsResponse,
  type XmlFiscalGetResponse,
  type XmlFiscalPostBody,
  type XmlFiscalPostResponse,
} from './interfaces/xml-fiscal.interface.js';
import {
  XmlNfeProtheusError,
  type XmlNfeResult,
} from './interfaces/xml-nfe.interface.js';
import type { GrvXmlBody } from './interfaces/grv-xml.interface.js';

/**
 * Adapter da frente `xmlFiscal` (Especificação API v2.0 §3.6/§3.7/§3.8).
 *
 * Toggle por env `FISCAL_PROTHEUS_MOCK`:
 *   - true  → usa stub em memória (ProtheusXmlMock)
 *   - false → faz chamadas reais ao Protheus via undici
 *
 * O mock permanece ATIVO até a reunião com o time Protheus em 13/04/2026
 * confirmar a publicação dos endpoints reais. A interface pública
 * (`exists`, `get`, `post`) é idêntica nos dois modos — qualquer código que
 * consume este service não precisa saber qual modo está ativo.
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
      this.logger.warn('ProtheusXmlService MOCK ATIVO — chamadas xmlFiscal não atingem o Protheus real.');
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
   * Cache check leve. NUNCA trafega o conteúdo de ZR_XML.
   * "Não existe" é resposta normal HTTP 200 — ver §3.6 da Especificação.
   *
   * @deprecated O contrato `xmlFiscal` da v2.0 foi substituído por `/xmlNfe`
   * (recebido em 20/04/2026). Use `buscarXml(chave)` que faz a chamada única
   * e devolve `{ found, origem, xmlBase64 }`. Será removido após a migração
   * de `nfe.service.ts`.
   */
  async exists(chave: string): Promise<XmlFiscalExistsResponse> {
    if (this.mockMode) return this.mock.exists(chave);

    try {
      return await this.http.request<XmlFiscalExistsResponse>({
        operacao: 'xmlFiscal',
        method: 'GET',
        pathSuffix: `/${chave}/exists`,
      });
    } catch (err) {
      throw this.convertError(err, 'exists', chave);
    }
  }

  /**
   * Recupera XML completo + metadados (ZR_XML + colunas de SZR010 + count SZQ010).
   * 404 → CHAVE_NAO_ENCONTRADA, tratado como exceção tipada.
   */
  async get(chave: string): Promise<XmlFiscalGetResponse> {
    if (this.mockMode) return this.mock.get(chave);

    try {
      return await this.http.request<XmlFiscalGetResponse>({
        operacao: 'xmlFiscal',
        method: 'GET',
        pathSuffix: `/${chave}`,
      });
    } catch (err) {
      throw this.convertError(err, 'get', chave);
    }
  }

  /**
   * Grava XML em SZR010 (cabeçalho) + SZQ010 (itens) via `POST /grvXML`
   * (contrato 18/04/2026).
   *
   * O body segue o formato `{ itens: [XMLCAB, XMLIT, XMLIT, ...] }` conforme
   * `grv-xml.interface.ts`. A montagem é responsabilidade do caller (geralmente
   * via `XmlParserToSzrSzqService.montarBody`). Este método apenas transporta
   * o body e traduz erros.
   *
   * Retorna a resposta do Protheus (formato ainda parcialmente em aberto — ver
   * `PENDENCIAS_PROTHEUS_18ABR2026.md` §3.8). Em modo MOCK, reusa o cache
   * interno e devolve stub compatível.
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

  /**
   * Grava XML novo em SZR010 (cabeçalho) + SZQ010 (itens) transacional.
   * 201 GRAVADO ou 200 JA_EXISTENTE — ambos são SUCESSO, distinguem o caminho.
   *
   * @deprecated Contrato `xmlFiscal` da v2.0 foi substituído por `POST /grvXML`
   * (recebido em 18/04). Use `grvXml(body)` com body montado via
   * `XmlParserToSzrSzqService.montarBody()`. Será removido após a migração do
   * ProtheusGravacaoHelper.
   */
  async post(body: XmlFiscalPostBody): Promise<XmlFiscalPostResponse> {
    if (this.mockMode) return this.mock.post(body);

    try {
      return await this.http.request<XmlFiscalPostResponse>({
        operacao: 'xmlFiscal',
        method: 'POST',
        body,
      });
    } catch (err) {
      throw this.convertError(err, 'post', body.chave);
    }
  }

  // ----- erro: converte ProtheusHttpError em XmlFiscalProtheusError -----

  private convertError(err: unknown, op: string, chave: string): Error {
    if (err instanceof XmlFiscalProtheusError) return err;

    if (err instanceof ProtheusHttpError) {
      const body = err.body as XmlFiscalErrorBody | null;
      if (body?.erro) {
        return new XmlFiscalProtheusError(
          body.erro,
          body.mensagem ?? `Falha em xmlFiscal.${op} para chave ${chave}`,
          err.statusCode,
          body.detalhe,
        );
      }
      // Sem corpo estruturado — devolve erro genérico
      const isUnavailable = err.statusCode >= 500;
      return new XmlFiscalProtheusError(
        isUnavailable ? 'PROTHEUS_INDISPONIVEL' : 'NAO_AUTORIZADO',
        `xmlFiscal.${op} retornou HTTP ${err.statusCode}`,
        err.statusCode,
      );
    }

    // Erro de rede / timeout
    this.logger.error(`xmlFiscal.${op} erro inesperado para chave ${chave}: ${(err as Error).message}`);
    return new XmlFiscalProtheusError(
      'PROTHEUS_INDISPONIVEL',
      `Protheus inacessível em xmlFiscal.${op}`,
      503,
    );
  }
}
