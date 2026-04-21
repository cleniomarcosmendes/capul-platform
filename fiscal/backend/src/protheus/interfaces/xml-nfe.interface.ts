/**
 * Contrato do `GET /xmlNfe` recebido em 20/04/2026.
 *
 * GET /rest/api/INFOCLIENTES/FISCAL/xmlNfe?CHAVENFEE={chave}
 *
 * Comportamento (confirmado com a equipe Protheus):
 *   - Busca primeiro em SZR010.ZR_XML; se não encontrar, faz fallback para
 *     SPED156.DOCXMLRET. Retorna `origem` indicando de onde veio.
 *   - Quando origem = SPED156, o Protheus NÃO grava em SZR/SZQ
 *     automaticamente — quem grava é a plataforma via POST /grvXML.
 *   - 404 quando chave não está em nenhuma das duas tabelas.
 *   - Aceita apenas NF-e (modelo 55). Para CT-e, ver decisão na Seção 2.7
 *     do `docs/PLANO_MODULO_FISCAL_v2.0.md`.
 */

export type XmlNfeOrigem = 'SZR010' | 'SPED156';

export interface XmlNfeFound {
  found: true;
  chave: string;
  origem: XmlNfeOrigem;
  xmlBase64: string;
}

export interface XmlNfeNotFound {
  found: false;
  chave: string;
  message: string;
}

export type XmlNfeResult = XmlNfeFound | XmlNfeNotFound;

export type XmlNfeErrorCode =
  | 'CHAVE_INVALIDA'
  | 'NAO_AUTORIZADO'
  | 'PROTHEUS_INDISPONIVEL';

export class XmlNfeProtheusError extends Error {
  constructor(
    public readonly code: XmlNfeErrorCode,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = 'XmlNfeProtheusError';
  }
}
