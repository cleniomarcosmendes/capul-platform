/**
 * Contrato do POST `grvXML` recebido em 18/04/2026.
 *
 * POST /rest/api/INFOCLIENTES/FISCAL/grvXML
 *   Content-Type: application/json
 *   Body: { itens: GrvXmlItem[] }
 *
 * O body é uma coleção heterogênea:
 *   - 1 item com alias="XMLCAB" contendo o xmlBase64 e os campos SZR010 (cabeçalho)
 *   - N itens com alias="XMLIT" contendo os campos SZQ010 (itens da NF)
 *
 * Observação: a documentação recebida (szr010-szq010.txt) usa
 * "XMLCAB (SZQ)" e "XMLIT (SZR)" no texto descritivo — isso é erro de
 * digitação. Pelos prefixos dos campos (`ZR_*` = SZR, `ZQ_*` = SZQ) e pelo
 * dicionário do Protheus, o correto é:
 *   XMLCAB = SZR010 (cabeçalho)  →  campos ZR_*
 *   XMLIT  = SZQ010 (itens)       →  campos ZQ_*
 */

export interface GrvXmlCampo {
  campo: string;
  valor: string;
}

export interface GrvXmlItemCabecalho {
  alias: 'XMLCAB';
  xmlBase64: string;
  campos: GrvXmlCampo[];
}

export interface GrvXmlItemDetalhe {
  alias: 'XMLIT';
  campos: GrvXmlCampo[];
}

export type GrvXmlItem = GrvXmlItemCabecalho | GrvXmlItemDetalhe;

export interface GrvXmlBody {
  itens: GrvXmlItem[];
}

/**
 * Dados externos ao XML exigidos pelo body do grvXML.
 *
 * Pendências formais para a equipe Protheus (ver
 * `docs/PENDENCIAS_PROTHEUS_18ABR2026.md` §3.1, §3.2, §3.3):
 *   - codFor/lojSig: a Capul prefere que o Protheus resolva pelo CNPJ do
 *     emitente. Enquanto isso não for confirmado, estes campos são opcionais
 *     e podem ser preenchidos pelo caller (consulta prévia a
 *     `/cadastroFiscal?cnpj=`).
 *   - campos "siga" (codSig/qtSiga/vlSiga/pedCom): a Capul prefere que sejam
 *     opcionais no payload — são reservados para casamento NF × pedido
 *     durante a entrada de mercadoria no Protheus.
 */
export interface GrvXmlContext {
  /** Filial destino da gravação (ex: "02"). */
  filial: string;
  /** Nome do usuário fiscal que disparou a operação (campo ZR_USRREC). */
  usuarioRec: string;
  /** Data/hora da gravação. Default: agora. */
  dataHoraRec?: Date;
  /** Código do fornecedor SA2010. Se omitido, será string vazia — aguarda decisão Protheus. */
  codFor?: string;
  /** Loja do fornecedor SA2010. Se omitida, será "0001" como default Protheus. */
  lojSig?: string;
  /** Indicador de "terceiro" (F = físico/fornecedor?, V = virtual?). Default: "F". */
  terceir?: string;
  /** Campos SIGA por item (map por número do item, ex: "001", "002", ...). */
  siga?: Record<string, GrvXmlSigaItem>;
}

export interface GrvXmlSigaItem {
  codSig?: string;
  qtSiga?: string;
  vlSiga?: string;
  pedCom?: string;
}

/**
 * Dados extraídos do XML para alimentar o body do grvXML.
 * Útil para inspeção/debug sem precisar montar o body completo.
 */
export interface GrvXmlExtracted {
  tipoXml: 'NFe' | 'CTe';
  modelo: string;
  chave: string;
  serie: string;
  numeroNF: string;
  dataEmissao: string; // YYYYMMDD
  tipoNF: string; // '0' Entrada, '1' Saída
  emitente: {
    cnpj: string;
    nome: string;
    ie: string;
    logradouro: string;
    numero: string;
    bairro: string;
    codMunicipio: string;
    municipio: string;
    uf: string;
    cep: string;
    fone: string;
  };
  itens: Array<{
    numItem: string;
    cProd: string;
    cEAN: string;
    xProd: string;
    uCom: string;
    qCom: string;
    vUnCom: string;
    vProd: string;
    cfop: string;
  }>;
}
