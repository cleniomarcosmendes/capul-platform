/**
 * Shape canônica de um CT-e 4.00 parseado.
 * Referência: manual CT-e 3.00/4.00 — modelo 57.
 *
 * Bloco raiz: `<cteProc><CTe><infCte>...</infCte></CTe><protCTe>...</protCTe></cteProc>`.
 *
 * Cobertura: paridade com o portal SEFAZ — todas as 17 seções.
 */

export interface CteDadosGerais {
  chave: string;            // 44 dígitos
  modelo: string;           // 57 (CT-e) ou 67 (CT-e OS)
  serie: string;
  numero: string;
  dataEmissao: string;
  tipoCte: '0' | '1' | '2' | '3';  // 0=normal, 1=complemento, 2=anulação, 3=substituto
  tipoCteDescricao: string;
  tipoServico: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7';
  tipoServicoDescricao: string;
  modalidade: '01' | '02' | '03' | '04' | '05' | '06';
  modalidadeDescricao: string;
  naturezaOperacao: string;
  ufInicio: string;
  ufFim: string;
  ambiente: '1' | '2';
  cfop: string;
  // Forma de emissão (Normal/Contingência)
  tipoEmissao?: string | null;          // tpEmis: 1=Normal, 4=EPEC, 5=FSDA, 7=SVCRS, 8=SVCSP
  tipoEmissaoDescricao?: string | null;
  dataContingencia?: string | null;     // dhCont (só quando contingência)
  justificativaContingencia?: string | null;  // xJust
  digestValue?: string | null;          // hash do CT-e (Signature)
  // Locais — pareado com o portal
  municipioInicioCodigo?: string | null;     // cMunIni
  municipioInicioNome?: string | null;       // xMunIni
  municipioFimCodigo?: string | null;        // cMunFim
  municipioFimNome?: string | null;          // xMunFim
}

export interface CteEndereco {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  codigoMunicipio?: string | null;
  uf?: string | null;
  cep?: string | null;
  pais?: string | null;
  codigoPais?: string | null;
  fone?: string | null;
}

export interface CteParticipante {
  cnpj?: string | null;
  cpf?: string | null;
  razaoSocial: string;
  nomeFantasia?: string | null;             // xFant (emitente)
  inscricaoEstadual?: string | null;        // IE
  inscricaoEstadualST?: string | null;      // IEST
  inscricaoSUFRAMA?: string | null;         // ISUF (destinatário)
  crt?: string | null;                      // emitente: 1=SN MEI, 2=SN normal, 3=Regime Normal
  crtDescricao?: string | null;
  email?: string | null;
  endereco?: CteEndereco | null;
}

export interface CteCargaQuantidade {
  tipoMedida: string; // cUnid: 00, 01, 02, 03, 04, 05
  descricao: string;
  quantidade: number;
}

export interface CteCarga {
  valorCarga: number;
  produtoPredominante: string;
  outrasCaracteristicas?: string | null;
  quantidades: CteCargaQuantidade[];
}

export interface CteIcms {
  // Vário CST/CSOSN
  cst?: string | null;          // ICMS00, ICMS20, ICMS45, ICMS60, ICMS90, ICMSOutraUF
  csosn?: string | null;        // ICMSSN (Simples Nacional)
  modalidadeBase?: string | null;     // modBC
  vBC?: number | null;
  pICMS?: number | null;
  vICMS?: number | null;
  vBCSTRet?: number | null;
  vICMSSTRet?: number | null;
  pRedBC?: number | null;
  vBCSubstituidoPorOutraUF?: number | null;
  vICMSSubstituidoPorOutraUF?: number | null;
  pCredSN?: number | null;
  vCredICMSSN?: number | null;
  // Texto livre quando o emitente coloca crédito presumido / informação extra
  outrosCampos?: Record<string, string | number> | null;
}

export interface CteIcmsUFFim {
  vBCUFFim?: number | null;
  pFCPUFFim?: number | null;
  pICMSUFFim?: number | null;
  pICMSInter?: number | null;
  vFCPUFFim?: number | null;
  vICMSUFFim?: number | null;
  vICMSUFIni?: number | null;
}

export interface CteIssqn {
  vBC?: number | null;
  vAliq?: number | null;
  vISSQN?: number | null;
  cMunFG?: string | null;
  cListServ?: string | null;
  vDeducao?: number | null;
  vOutro?: number | null;
  vDescIncond?: number | null;
  vDescCond?: number | null;
  cSitTrib?: string | null;
  indISS?: string | null;
  cServico?: string | null;
  indIncentivo?: string | null;
}

export interface CteInfTribFed {
  vPIS?: number | null;
  vCOFINS?: number | null;
  vIR?: number | null;
  vCSLL?: number | null;
  vINSS?: number | null;
  infAdFisco?: string | null;
}

export interface CteValores {
  valorTotalPrestacao: number;
  valorReceber: number;
  componentes: Array<{
    nome: string;
    valor: number;
  }>;
  // Tributos consolidados
  vTotTrib?: number | null;
  icms?: CteIcms | null;
  icmsUFFim?: CteIcmsUFFim | null;
  issqn?: CteIssqn | null;
  infTribFed?: CteInfTribFed | null;
  // Atalhos legados — preservados pra UI antiga não quebrar
  icmsCst?: string | null;
  icmsBase?: number | null;
  icmsAliquota?: number | null;
  icmsValor?: number | null;
}

export interface CteDocumentoTransportado {
  // NF-e (modelo 55) — referenciada por chave
  chaveNFe?: string | null;
  // NF (modelo 1/1A) — legado
  numeroNF?: string | null;
  serie?: string | null;
  pin?: string | null;       // pin do NF mod1
  // Outros documentos (Conhecimento Aéreo Internacional, AWB, etc)
  tipoOutro?: string | null; // tpDoc
  descOutro?: string | null;
  numeroOutro?: string | null;
  // Comuns
  valor?: number | null;
  pesoTotal?: number | null;
}

export interface CteUnidadeTransporte {
  tipoUnidade?: string | null;     // tpUnidTransp: 1=Rodoviário Tração, 2=Reboque, 3=Navio, etc
  identificacao?: string | null;   // idUnidTransp (placa, etc)
  lacres: string[];                // lacUnidTransp[].nLacre
  qtdRat?: number | null;          // qtdRat
}

export interface CteUnidadeCarga {
  tipoUnidade?: string | null;     // tpUnidCarga: 1=Container, 2=ULD, 3=Pallet, 4=Outros
  identificacao?: string | null;   // idUnidCarga
  lacres: string[];                // lacUnidCarga[].nLacre
  qtdRat?: number | null;          // qtdRat
}

export interface CteSeguro {
  responsavelSeguro?: string | null;     // respSeg: 4=Remetente, 5=Expedidor, 6=Recebedor, 7=Destinatário
  responsavelDescricao?: string | null;
  nomeSeguradora?: string | null;        // xSeg
  cnpjSeguradora?: string | null;        // CNPJ (raro)
  numeroApolice?: string | null;         // nApol
  numeroAverbacao?: string | null;       // nAver
  valorCarga?: number | null;            // vCarga
  valorAverbado?: number | null;         // vMerc (cobertura)
}

// ====================== MODAIS ======================
// Cada CT-e tem exatamente UM modal (definido em ide.modal):
//   01=Rodoviário, 02=Aéreo, 03=Aquaviário, 04=Ferroviário, 05=Dutoviário, 06=Multimodal

export interface CteModalRodoviarioVeiculo {
  placa?: string | null;
  renavam?: string | null;
  ufPlaca?: string | null;
  proprietario?: {
    cnpj?: string | null;
    cpf?: string | null;
    razaoSocial?: string | null;
    rntrc?: string | null;
    inscricaoEstadual?: string | null;
    uf?: string | null;
    tipoProprietario?: string | null;  // tpProp
  } | null;
  tipoRodado?: string | null;          // tpRod
  tipoCarroceria?: string | null;      // tpCar
  tara?: number | null;
  capacidadeKG?: number | null;        // capKG
  capacidadeM3?: number | null;        // capM3
}

export interface CteModalRodoviario {
  modalidade: '01';
  rntrc?: string | null;               // RNTRC do emitente
  ocorrencias: Array<{ descricao: string; data: string }>;  // ocorr[]
  // Placas e veículos
  veiculo?: CteModalRodoviarioVeiculo | null;
  reboques: CteModalRodoviarioVeiculo[];
  // Motoristas — CT-e 4.00 permite múltiplos
  motoristas: Array<{ cpf?: string | null; nome?: string | null }>;
  // Vale-pedágio
  valesPedagio: Array<{
    cnpjFornecedor?: string | null;
    cnpjResponsavel?: string | null;
    numeroComprovante?: string | null;
    valor?: number | null;
    tipoVale?: string | null;
  }>;
}

export interface CteModalAereo {
  modalidade: '02';
  numeroMinuta?: string | null;        // nMinu
  numeroOperacionalAWB?: string | null; // nOCA
  dataPrevistaEntrega?: string | null; // dPrevAereo
  natCarga?: {
    xDime?: string | null;
    cInfManu: string[];
  } | null;
  tarifa?: {
    classeTarifa?: string | null;      // CL
    codigoTarifa?: string | null;      // cTar
    valorTarifa?: number | null;       // vTar
  } | null;
}

export interface CteModalAquaviario {
  modalidade: '03';
  vPrest?: number | null;
  vAFRMM?: number | null;             // valor adicional ao frete pra renovação Marinha Mercante
  xNavio?: string | null;
  balsas: Array<{ xBalsa?: string | null }>;
  numeroBookings?: string | null;     // nBooking
  numeroCE?: string | null;           // nCtrl
  numeroBL?: string | null;           // nBL (Bill of Lading)
  direcao?: string | null;            // direc: N=Norte, S=Sul, L=Leste, O=Oeste
  irinNavio?: string | null;          // irin
  tipoNavegacao?: string | null;      // tpNav: 0=Interior, 1=Cabotagem
  detContainers: Array<{
    nCont?: string | null;
    lacres: string[];
    detNFe: Array<{ nNF?: string | null; chave?: string | null }>;
  }>;
}

export interface CteModalFerroviario {
  modalidade: '04';
  tipoTrafego?: string | null;        // tpTraf: 0=Próprio, 1=Mútuo, 2=Rodoferroviário, 3=Rodoviário
  trafegoMutuo?: {
    respFat?: string | null;          // 1=Ferrovia de Origem, 2=Ferrovia Destino
    ferrEmi?: string | null;          // identificação ferrovia emitente
    fluxoPagamento?: string | null;   // fluxo
    icmsTransporte?: number | null;   // vFrete
    chaveCTe?: string | null;
  } | null;
  fluxoFerroviario?: string | null;   // fluxo
}

export interface CteModalDutoviario {
  modalidade: '05';
  valorTarifa?: number | null;        // vTar
  dataInicio?: string | null;         // dIni
  dataFim?: string | null;            // dFim
}

export interface CteModalMultimodal {
  modalidade: '06';
  cotm?: string | null;               // certificado operador transportador multimodal
  indicadorNegociavel?: string | null; // indNegociavel: 0=Não, 1=Sim
  seguro?: CteSeguro | null;          // seg específico do multimodal
}

export type CteModal =
  | CteModalRodoviario
  | CteModalAereo
  | CteModalAquaviario
  | CteModalFerroviario
  | CteModalDutoviario
  | CteModalMultimodal
  | null;

// ====================== DOCUMENTOS ANTERIORES ======================
// Quando CT-e é Complemento/Substituição/Anulação, referencia outros documentos

export interface CteDocumentoAnterior {
  tipo: 'CTe' | 'NFe' | 'NF';
  chave?: string | null;
  serie?: string | null;
  numero?: string | null;
  dataEmissao?: string | null;
  cnpjEmitente?: string | null;
  modelo?: string | null;
  subserie?: string | null;
}

// ====================== PROTOCOLO ======================

export interface CteProtocoloAutorizacao {
  protocolo: string;
  dataRecebimento: string;
  cStat: string;
  motivo: string;
  ambiente: '1' | '2';
  digestValue?: string | null;
  versaoAplicacao?: string | null;
  chave?: string | null;
}

// ====================== INFO ADICIONAIS ======================

export interface CteInfoAdicionais {
  observacoes?: string | null;        // xObs
  infAdFisco?: string | null;         // informação adicional fisco
  infCpl?: string | null;             // informação complementar contribuinte
  emailEntrega?: string | null;       // emailE
  observacoesFiscais: Array<{ xTexto: string; xCampo?: string | null }>;
  observacoesContribuinte: Array<{ xTexto: string; xCampo?: string | null }>;
  autorizadosBaixarXml: Array<{ cnpj?: string | null; cpf?: string | null }>; // autXML[]
}

// ====================== ROOT ======================

export interface CteParsed {
  dadosGerais: CteDadosGerais;
  emitente: CteParticipante;
  remetente: CteParticipante;
  expedidor?: CteParticipante | null;
  recebedor?: CteParticipante | null;
  destinatario: CteParticipante;
  // Tomador — string descritiva pra UI rápida
  tomador: 'Remetente' | 'Expedidor' | 'Recebedor' | 'Destinatário' | 'Outros';
  // Tomador — dados quando toma=4 (Outros), com participante completo
  tomadorOutros?: CteParticipante | null;
  carga: CteCarga;
  valores: CteValores;
  documentosTransportados: CteDocumentoTransportado[];
  unidadesTransporte: CteUnidadeTransporte[];
  unidadesCarga: CteUnidadeCarga[];
  documentosAnteriores: CteDocumentoAnterior[];
  modal: CteModal;
  seguro?: CteSeguro | null;          // seg do modal Rodoviário ou direto em infCTeNorm
  infoAdicionais: CteInfoAdicionais;
  protocoloAutorizacao?: CteProtocoloAutorizacao | null;
  // Atalhos legados
  observacoes?: string | null;        // = infoAdicionais.observacoes (backwards compat)
}

/**
 * Detalhe completo de um evento de CT-e — extraído do XML procEventoCTe
 * armazenado em fiscal.cte_evento (chega via CTeDistribuicaoDFe/distNSU).
 * Espelha NfeEventoDetalhe, com o adicional `observacao` (xObs) usado pela
 * Prestação de Serviço em Desacordo (tpEvento 610110). Renderiza a tela
 * "AUTOR DO EVENTO" + "Observação" igual ao portal SEFAZ.
 */
export interface CteEventoDetalhe {
  // Cabeçalho do evento (infEvento do request)
  orgaoRecepcao?: string | null;          // cOrgao (código IBGE do órgão)
  orgaoRecepcaoDescricao?: string | null;
  ambiente: '1' | '2';                    // tpAmb
  ambienteDescricao: string;              // 1-Produção / 2-Homologação
  versao?: string | null;                 // @versao do evento
  chave: string;                          // chCTe
  idEvento: string | null;                // @Id — "ID" + tpEvento + chCTe + nSeqEvento
  autorCnpj?: string | null;              // CNPJ
  autorCpf?: string | null;               // CPF
  dataEvento: string;                     // dhEvento
  tipoEvento: string;                     // tpEvento
  tipoEventoDescricao: string;
  sequencial: number | null;              // nSeqEvento
  versaoEvento?: string | null;           // @versaoEvento do detEvento
  descricaoEvento?: string | null;        // detEvento/descEvento
  // Campos específicos por tipo de evento (preenchidos conforme aplicável):
  observacao?: string | null;             // detEvento/.../xObs (Prestação em Desacordo 610110)
  justificativa?: string | null;          // detEvento/.../xJust (cancelamento 110111)
  correcao?: string | null;               // detEvento/.../xCorrecao ou grupoAlterado (CC-e 110110)
  condicoesUso?: string | null;           // detEvento/.../xCondUso (CC-e 110110)
  // Autorização pela SEFAZ (retEventoCTe)
  autorizacaoCStat?: string | null;
  autorizacaoMotivo?: string | null;      // xMotivo
  autorizacaoMensagem?: string | null;    // cStat + " - " + xMotivo
  autorizacaoProtocolo?: string | null;   // nProt
  autorizacaoDataHora?: string | null;    // dhRegEvento
}
