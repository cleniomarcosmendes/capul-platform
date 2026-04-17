/**
 * Shape canônica de uma NF-e parseada, estruturada por abas — equivalente ao
 * que o portal SEFAZ mostra ao visualizar uma chave avulsa.
 *
 * Fontes dos campos: layout NF-e 4.00 (nota técnica 2015/003).
 * Bloco raiz normal: `<nfeProc><NFe><infNFe>...</infNFe></NFe><protNFe>...</protNFe></nfeProc>`.
 * Também funciona quando recebemos só `<NFe>` sem o `<nfeProc>` (sem protocolo).
 */

export interface NfeDadosGerais {
  chave: string;            // 44 dígitos (do atributo Id, removendo 'NFe')
  versaoXml?: string | null; // @_versao
  modelo: string;           // 55
  serie: string;
  numero: string;           // nNF (sem zero-pad)
  dataEmissao: string;      // ISO 8601
  dataSaidaEntrada?: string | null;
  tipoOperacao: '0' | '1'; // 0=entrada, 1=saída
  tipoOperacaoDescricao: 'Entrada' | 'Saída';
  finalidade: string;       // finNFe: 1=Normal, 2=Complementar, 3=Ajuste, 4=Devolução
  finalidadeDescricao: string;
  naturezaOperacao: string; // natOp
  ufEmitente: string;
  codigoMunicipioFatoGerador: string;
  digitoChave: string;
  ambiente: '1' | '2';      // tpAmb: 1=Prod, 2=Hom
  processoEmissao: string;  // procEmi
  processoEmissaoDescricao?: string | null;
  versaoProcesso: string;
  indicadorPresenca: string; // indPres
  indicadorPresencaDescricao?: string | null;
  indicadorDestino?: string | null;    // idDest: 1=interna, 2=interestadual, 3=exterior
  indicadorDestinoDescricao?: string | null;
  consumidorFinal?: string | null;     // indFinal: 0=normal, 1=consumidor final
  consumidorFinalDescricao?: string | null;
  indicadorIntermediador?: string | null; // indIntermed
  indicadorIntermediadorDescricao?: string | null;
  digestValue?: string | null;
}

export interface NfeEmitenteDestinatario {
  cnpj?: string | null;
  cpf?: string | null;
  razaoSocial: string;
  nomeFantasia?: string | null;
  inscricaoEstadual?: string | null;
  inscricaoEstadualSubstituto?: string | null;
  inscricaoMunicipal?: string | null;
  cnae?: string | null;
  regimeTributario?: string | null;
  regimeTributarioDescricao?: string | null;
  endereco: {
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    codigoMunicipio?: string | null;
    municipio?: string | null;
    uf?: string | null;
    cep?: string | null;
    codigoPais?: string | null;
    pais?: string | null;
    telefone?: string | null;
  };
  indicadorIE?: string | null; // indIEDest (destinatário)
  indicadorIEDescricao?: string | null;
  suframa?: string | null;
  email?: string | null;
}

export interface NfeIcmsProduto {
  cst?: string | null;                 // CST ou CSOSN
  cstDescricao?: string | null;
  orig?: string | null;
  origDescricao?: string | null;
  modBC?: string | null;
  modBCDescricao?: string | null;
  base?: number | null;                // vBC
  aliquota?: number | null;            // pICMS
  valor?: number | null;               // vICMS
  // FCP
  baseFcp?: number | null;             // vBCFCP
  percentualFcp?: number | null;       // pFCP
  valorFcp?: number | null;            // vFCP
  // ST
  modBCST?: string | null;             // modBCST
  modBCSTDescricao?: string | null;
  percentualReducaoBCST?: number | null; // pRedBCST
  percentualMvaST?: number | null;     // pMVAST
  baseST?: number | null;              // vBCST
  aliquotaST?: number | null;          // pICMSST
  valorST?: number | null;             // vICMSST
  baseFcpST?: number | null;           // vBCFCPST
  percentualFcpST?: number | null;     // pFCPST
  valorFcpST?: number | null;          // vFCPST
  baseFcpStRetido?: number | null;     // vBCFCPSTRet
  percentualFcpStRetido?: number | null; // pFCPSTRet
  valorFcpStRetido?: number | null;    // vFCPSTRet
  valorIcmsSTDesonerado?: number | null; // vICMSSTDeson
  motivoDesoneracaoST?: string | null; // motDesICMSST
  valorIcmsDesonerado?: number | null; // vICMSDeson
  motivoDesoneracao?: string | null;   // motDesICMS
}

export interface NfeIbsCbsProduto {
  cst?: string | null;                 // IBSCBS/CST
  cClassTrib?: string | null;
  operacaoDoacao?: string | null;
  base?: number | null;                // gIBSCBS/vBC
  // IBS Estadual
  aliquotaIbsUF?: number | null;       // pIBSUF
  valorIbsUF?: number | null;          // vIBSUF
  // IBS Municipal
  aliquotaIbsMun?: number | null;      // pIBSMun
  valorIbsMun?: number | null;         // vIBSMun
  valorIbsTotal?: number | null;       // vIBS
  // CBS
  aliquotaCbs?: number | null;         // pCBS
  valorCbs?: number | null;            // vCBS
}

export interface NfeProduto {
  item: number;            // nItem
  codigo: string;          // cProd (do fornecedor)
  ean?: string | null;
  descricao: string;       // xProd
  ncm?: string | null;
  cest?: string | null;
  cBenef?: string | null;
  cnpjFabricante?: string | null;
  exTipi?: string | null;
  indEscala?: string | null;           // S / N
  indEscalaDescricao?: string | null;
  indTotal?: string | null;            // indTot
  indTotalDescricao?: string | null;
  nFci?: string | null;
  cfop: string;
  unidadeComercial: string;
  quantidadeComercial: number;
  valorUnitarioComercial: number;
  valorTotalBruto: number;
  eanTributavel?: string | null;
  unidadeTributavel?: string | null;
  quantidadeTributavel?: number | null;
  valorUnitarioTributavel?: number | null;
  valorDesconto?: number | null;
  valorFrete?: number | null;
  valorSeguro?: number | null;
  valorOutros?: number | null;
  pedidoCompra?: string | null;
  numeroItemPedido?: string | null;
  /** Valor aproximado dos tributos por item (det/vItem). */
  valorAproximadoTributosItem?: number | null;
  impostos: {
    icms: NfeIcmsProduto;
    ibsCbs?: NfeIbsCbsProduto | null;
    ipiCst?: string | null;
    ipiAliquota?: number | null;
    ipiValor?: number | null;
    pisCst?: string | null;
    pisBase?: number | null;
    pisAliquota?: number | null;
    pisValor?: number | null;
    cofinsCst?: string | null;
    cofinsBase?: number | null;
    cofinsAliquota?: number | null;
    cofinsValor?: number | null;
    // campos antigos mantidos por compatibilidade com código consumidor
    icmsCst?: string | null;
    icmsOrig?: string | null;
    icmsBase?: number | null;
    icmsAliquota?: number | null;
    icmsValor?: number | null;
    rawXml?: string | null;
  };
  informacoesAdicionais?: string | null;
}

export interface NfeIbsCbsTotais {
  baseCalculo: number;          // vBCIBSCBS
  // IBS Estadual
  ibsEstadualDiferimento: number; // gIBSUF/vDif
  ibsEstadualDevolucao: number;   // gIBSUF/vDevTrib
  ibsEstadualValor: number;       // gIBSUF/vIBSUF
  // IBS Municipal
  ibsMunicipalDiferimento: number;
  ibsMunicipalDevolucao: number;
  ibsMunicipalValor: number;
  // IBS total
  ibsTotal: number;               // gIBS/vIBS
  ibsCreditoPresumido: number;    // gIBS/vCredPres
  ibsCreditoPresumidoCondSus: number; // gIBS/vCredPresCondSus
  // CBS
  cbsDiferimento: number;         // gCBS/vDif
  cbsDevolucao: number;           // gCBS/vDevTrib
  cbsValor: number;               // gCBS/vCBS
  cbsCreditoPresumido: number;    // gCBS/vCredPres
  cbsCreditoPresumidoCondSus: number;
}

export interface NfeTotais {
  baseCalculoIcms: number;
  valorIcms: number;
  valorIcmsDesonerado: number;
  valorFcp: number;
  baseCalculoIcmsSt: number;
  valorIcmsSt: number;
  valorFcpSt: number;
  valorFcpStRetido: number;
  valorProdutos: number;
  valorFrete: number;
  valorSeguro: number;
  valorDesconto: number;
  valorII: number;
  valorIpi: number;
  valorIpiDevolvido: number;
  valorPis: number;
  valorCofins: number;
  valorOutros: number;
  valorNota: number;
  valorTotalTributos?: number | null;
  ibsCbs?: NfeIbsCbsTotais | null;
}

export interface NfeTransporte {
  modalidadeFrete: string;   // modFrete: 0-9
  modalidadeFreteDescricao: string;
  transportador?: {
    cnpj?: string | null;
    cpf?: string | null;
    razaoSocial?: string | null;
    inscricaoEstadual?: string | null;
    endereco?: string | null;
    municipio?: string | null;
    uf?: string | null;
  } | null;
  veiculo?: {
    placa?: string | null;
    uf?: string | null;
    rntc?: string | null;
  } | null;
  volumes: Array<{
    quantidade?: number | null;
    especie?: string | null;
    marca?: string | null;
    numeracao?: string | null;
    pesoLiquido?: number | null;
    pesoBruto?: number | null;
  }>;
}

export interface NfeCobranca {
  fatura?: {
    numero?: string | null;
    valorOriginal?: number | null;
    valorDesconto?: number | null;
    valorLiquido?: number | null;
  } | null;
  duplicatas: Array<{
    numero?: string | null;
    vencimento?: string | null;
    valor?: number | null;
  }>;
  formasPagamento: Array<{
    indicadorPagamento?: string | null;     // indPag: 0=vista, 1=prazo
    indicadorPagamentoDescricao?: string | null;
    meioPagamento?: string | null;          // tPag
    meioPagamentoDescricao?: string | null;
    descricaoMeioPagamento?: string | null; // xPag
    valorPagamento?: number | null;         // vPag
    valorTroco?: number | null;             // vTroco
  }>;
}

export interface NfeAutorizadoXml {
  cnpj?: string | null;
  cpf?: string | null;
}

export interface NfeEventoInfo {
  /** ID do registro em fiscal.documento_evento — usado pelo frontend para abrir detalhe. */
  id?: string;
  tipoEvento: string;       // 110111 cancelamento, 110110 CCe, 210210 ciencia, etc.
  descricao: string;
  dataEvento?: string | null;
  sequencial?: number | null;
  protocolo?: string | null;
  cStat?: string | null;
  xMotivo?: string | null;
  justificativa?: string | null;
  /** `true` quando há xmlEvento persistido e o detalhe pode ser carregado sob demanda. */
  possuiDetalhe?: boolean;
}

export interface NfeProtocoloAutorizacao {
  protocolo: string;
  dataRecebimento: string;
  cStat: string;
  motivo: string;
  ambiente: '1' | '2';
}

/**
 * Detalhe completo de um procEventoNFe — equivalente à tela que o portal
 * SEFAZ abre quando o usuário clica no protocolo de um evento (imagem 2).
 */
export interface NfeEventoDetalhe {
  // Cabeçalho do evento (infEvento do request)
  orgaoRecepcao?: string | null;          // cOrgao (código IBGE do órgão — 91=AN)
  orgaoRecepcaoDescricao?: string | null;
  ambiente: '1' | '2';                    // tpAmb
  ambienteDescricao: string;              // 1-Produção / 2-Homologação
  versao?: string | null;                 // @versao do evento
  chave: string;                          // chNFe
  idEvento: string;                       // @Id — "ID" + tpEvento + chNFe + nSeqEvento
  autorCnpj?: string | null;              // CNPJ
  autorCpf?: string | null;               // CPF
  dataEvento: string;                     // dhEvento
  tipoEvento: string;                     // tpEvento
  tipoEventoDescricao: string;
  sequencial: number;                     // nSeqEvento
  versaoEvento?: string | null;           // verEvento
  descricaoEvento?: string | null;        // detEvento/descEvento
  justificativa?: string | null;          // detEvento/xJust
  // Autorização pela SEFAZ (retEvento)
  autorizacaoCStat?: string | null;
  autorizacaoMotivo?: string | null;      // xMotivo
  autorizacaoMensagem?: string | null;    // cStat + " - " + xMotivo (helper)
  autorizacaoProtocolo?: string | null;   // nProt
  autorizacaoDataHora?: string | null;    // dhRegEvento
}

export interface NfeParsed {
  dadosGerais: NfeDadosGerais;
  emitente: NfeEmitenteDestinatario;
  destinatario: NfeEmitenteDestinatario;
  produtos: NfeProduto[];
  totais: NfeTotais;
  transporte: NfeTransporte;
  cobranca: NfeCobranca;
  eventos: NfeEventoInfo[];            // vazio no XML recém-baixado
  protocoloAutorizacao?: NfeProtocoloAutorizacao | null;
  autorizadosXml: NfeAutorizadoXml[];
  informacoesAdicionais?: {
    informacoesComplementares?: string | null;
    informacoesFisco?: string | null;
    formatoImpressaoDanfe?: string | null;
    formatoImpressaoDanfeDescricao?: string | null;
  } | null;
}
