/**
 * Contratos da frente `xmlFiscal` da Especificação API Protheus v2.0.
 * Estrutura real das tabelas SZR010 (cabeçalho com ZR_XML Memo) e SZQ010 (itens).
 * Ver: docs/ESPECIFICACAO_API_PROTHEUS_FISCAL_v2.0.md §3.6/§3.7/§3.8 e Anexo C.
 */

export type TipoDocumentoFiscalProtheus = 'NFE' | 'CTE';

// ----- GET /xmlFiscal/{chave}/exists -----

export interface XmlFiscalExistsResponse {
  existe: boolean;
  chave: string;
  tipoDocumento?: TipoDocumentoFiscalProtheus;
  modelo?: string;
  filial?: string;
  gravadoEm?: string;
  usuarioRecebedor?: string;
  totalItens?: number;
}

// ----- GET /xmlFiscal/{chave} -----

export interface XmlFiscalEmitente {
  cnpj: string;
  razaoSocial: string;
  inscricaoEstadual?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  codigoMunicipio?: string | null;
  uf?: string | null;
  cep?: string | null;
  telefone?: string | null;
}

export interface XmlFiscalFornecedorProtheus {
  codigo: string;
  loja: string;
}

export interface XmlFiscalTransporte {
  ufOrigem?: string | null;
  municipioOrigem?: string | null;
  ufDestino?: string | null;
  municipioDestino?: string | null;
  valorCte?: number | null;
}

export interface XmlFiscalRecebimento {
  data: string; // ISO date
  hora: string; // HH:MM:SS
  usuario: string;
}

export interface XmlFiscalGetResponse {
  chave: string;
  filial: string;
  tipoDocumento: TipoDocumentoFiscalProtheus;
  modelo: string;
  tipoNF?: string | null;
  serie?: string | null;
  numeroNF?: string | null;
  dataEmissao?: string | null;
  xml: string; // conteúdo de ZR_XML
  emitente: XmlFiscalEmitente;
  fornecedorProtheus?: XmlFiscalFornecedorProtheus | null;
  terceiro: boolean;
  transporte: XmlFiscalTransporte;
  recebimento: XmlFiscalRecebimento;
  totalItens: number;
}

// ----- POST /xmlFiscal -----

export interface XmlFiscalPostBody {
  chave: string;
  tipoDocumento: TipoDocumentoFiscalProtheus;
  filial: string;
  xml: string;
  usuarioCapulQueDisparou?: string;
}

export type XmlFiscalPostStatus = 'GRAVADO' | 'JA_EXISTENTE';

export interface XmlFiscalPostResponseGravado {
  status: 'GRAVADO';
  chave: string;
  filial: string;
  tipoDocumento: TipoDocumentoFiscalProtheus;
  modelo: string;
  itensGravados: number;
  fornecedorProtheus: XmlFiscalFornecedorProtheus;
  gravadoEm: string;
}

export interface XmlFiscalPostResponseJaExistente {
  status: 'JA_EXISTENTE';
  chave: string;
  filial: string;
  gravadoEmOriginal: string;
  usuarioRecebedorOriginal: string;
}

export type XmlFiscalPostResponse = XmlFiscalPostResponseGravado | XmlFiscalPostResponseJaExistente;

// ----- Erros estruturados -----

export type XmlFiscalErrorCode =
  | 'CHAVE_INVALIDA'
  | 'FILIAL_INVALIDA'
  | 'XML_MALFORMADO'
  | 'XML_NAO_VALIDA_XSD'
  | 'CHAVE_NAO_BATE_XML'
  | 'TIPO_NAO_BATE_XML'
  | 'ASSINATURA_INVALIDA'
  | 'NAO_AUTORIZADO'
  | 'NAO_RELACIONADO_CAPUL'
  | 'CONTRAPARTE_NAO_CADASTRADA'
  | 'CHAVE_NAO_ENCONTRADA'
  | 'FALHA_GRAVACAO'
  | 'PROTHEUS_INDISPONIVEL';

export interface XmlFiscalErrorBody {
  erro: XmlFiscalErrorCode;
  mensagem: string;
  detalhe?: string;
}

/**
 * Exceção específica para falhas semânticas do endpoint xmlFiscal,
 * carregando o código estruturado do Protheus.
 */
export class XmlFiscalProtheusError extends Error {
  constructor(
    public readonly code: XmlFiscalErrorCode,
    message: string,
    public readonly httpStatus: number,
    public readonly detalhe?: string,
  ) {
    super(message);
    this.name = 'XmlFiscalProtheusError';
  }
}
