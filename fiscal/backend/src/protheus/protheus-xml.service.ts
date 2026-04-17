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
   * Cache check leve. NUNCA trafega o conteúdo de ZR_XML.
   * "Não existe" é resposta normal HTTP 200 — ver §3.6 da Especificação.
   */
  async exists(chave: string): Promise<XmlFiscalExistsResponse> {
    if (this.mockMode) return this.mock.exists(chave);

    try {
      return await this.http.get<XmlFiscalExistsResponse>(`/xmlFiscal/${chave}/exists`);
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
      return await this.http.get<XmlFiscalGetResponse>(`/xmlFiscal/${chave}`);
    } catch (err) {
      throw this.convertError(err, 'get', chave);
    }
  }

  /**
   * Grava XML novo em SZR010 (cabeçalho) + SZQ010 (itens) transacional.
   * 201 GRAVADO ou 200 JA_EXISTENTE — ambos são SUCESSO, distinguem o caminho.
   */
  async post(body: XmlFiscalPostBody): Promise<XmlFiscalPostResponse> {
    if (this.mockMode) return this.mock.post(body);

    try {
      return await this.http.post<XmlFiscalPostResponse>('/xmlFiscal', body);
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
