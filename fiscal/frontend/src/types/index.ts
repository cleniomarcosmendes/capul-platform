/**
 * Tipos do Módulo Fiscal — espelho simplificado dos DTOs do backend.
 * Evitamos importar do backend para manter o frontend standalone.
 */

// ----- Auth -----

export interface ModuloAcesso {
  codigo: string;
  role: string;
}

export interface FilialUsuario {
  id: string;
  codigo: string;
  nome: string;
}

export interface UsuarioLogado {
  id: string;
  email: string;
  nome: string;
  filialId?: string;
  filialCodigo?: string;
  filialAtual: FilialUsuario | null;
  modulos: ModuloAcesso[];
}

export type RoleFiscal = 'OPERADOR_ENTRADA' | 'ANALISTA_CADASTRO' | 'GESTOR_FISCAL' | 'ADMIN_TI';

// ----- Ambiente -----

export type AmbienteSefaz = 'PRODUCAO' | 'HOMOLOGACAO';

export interface AmbienteStatus {
  ambienteAtivo: AmbienteSefaz;
  bootstrapConcluido: boolean;
  bootstrapConcluidoEm: string | null;
  pauseSync: boolean;
  janelaSemanalCron: string;
  janelaDiariaCron: string;
  ultimaAlteracaoEm: string;
  ultimaAlteracaoPor: string | null;
}

// ----- SEFAZ TLS CA status -----

export type SefazCaModo = 'VALIDACAO_ATIVA' | 'INSEGURO_SEM_CADEIA' | 'BLOQUEADO';
export type SefazCaSeveridade = 'OK' | 'ATENCAO' | 'CRITICO';

export interface SefazCertificadoInfo {
  arquivo: string;
  commonName: string | null;
  issuer: string | null;
  validoDe: string;
  validoAte: string;
  diasParaVencer: number;
  serial: string;
}

export interface SefazRefreshLog {
  timestamp: string;
  origem: 'BOOT' | 'CRON' | 'MANUAL';
  usuarioEmail: string | null;
  endpointsProcessados: number;
  certificadosExtraidos: number;
  sucesso: boolean;
  mensagem: string;
}

export interface SefazCaStatus {
  modo: SefazCaModo;
  severidade: SefazCaSeveridade;
  mensagem: string;
  totalCertificados: number;
  idadeDias: number | null;
  ultimoRefresh: string | null;
  proximaVerificacaoAutomatica: string | null;
  autoRefreshAtivo: boolean;
  tlsStrict: boolean;
  caPath: string;
  certificados: SefazCertificadoInfo[];
  ultimasAtualizacoes: SefazRefreshLog[];
}

export interface SefazRefreshResult {
  sucesso: boolean;
  certificadosExtraidos: number;
  arquivosSalvos: string[];
  mensagem: string;
  logs: string[];
}

// ----- Protheus integration status -----

export type ProtheusLeituraStatus =
  | 'CACHE_HIT'
  | 'CACHE_MISS'
  | 'NAO_CONSULTADO'
  | 'FALHA_TECNICA';

export type ProtheusGravacaoStatus =
  | 'GRAVADO'
  | 'GRAVADO_PRENOTA_FALHOU'
  | 'GRAVADO_AGUARDANDO_AMARRACAO'
  | 'JA_EXISTIA'
  | 'NAO_APLICAVEL'
  | 'NAO_TENTADO'
  | 'FALHA_TECNICA';

export interface ProtheusStatus {
  leitura: ProtheusLeituraStatus;
  leituraMensagem: string | null;
  leituraErro: string | null;
  gravacao: ProtheusGravacaoStatus;
  gravacaoMensagem: string | null;
  gravacaoErro: string | null;
  permiteReexecucao: boolean;
  modoMock: boolean;
  /** Body JSON da última tentativa grvXML — pra debug fiscal autoatendido. */
  grvRequest: string | null;
}

// ----- NF-e parsed -----

export type OrigemConsulta = 'PROTHEUS_CACHE' | 'PROTHEUS_CACHE_RACE' | 'SEFAZ_DOWNLOAD';

export interface NfeEndereco {
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
}

export interface NfeParticipante {
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
  indicadorIE?: string | null;
  indicadorIEDescricao?: string | null;
  suframa?: string | null;
  email?: string | null;
  endereco: NfeEndereco;
}

export interface NfeDadosGerais {
  chave: string;
  versaoXml?: string | null;
  modelo: string;
  serie: string;
  numero: string;
  dataEmissao: string;
  dataSaidaEntrada?: string | null;
  tipoOperacao: '0' | '1';
  tipoOperacaoDescricao: 'Entrada' | 'Saída';
  finalidade: string;
  finalidadeDescricao: string;
  naturezaOperacao: string;
  ufEmitente: string;
  codigoMunicipioFatoGerador: string;
  digitoChave: string;
  ambiente: '1' | '2';
  processoEmissao: string;
  processoEmissaoDescricao?: string | null;
  versaoProcesso: string;
  indicadorPresenca: string;
  indicadorPresencaDescricao?: string | null;
  indicadorDestino?: string | null;
  indicadorDestinoDescricao?: string | null;
  consumidorFinal?: string | null;
  consumidorFinalDescricao?: string | null;
  indicadorIntermediador?: string | null;
  indicadorIntermediadorDescricao?: string | null;
  digestValue?: string | null;
}

export interface NfeIcmsProduto {
  cst?: string | null;
  cstDescricao?: string | null;
  orig?: string | null;
  origDescricao?: string | null;
  modBC?: string | null;
  modBCDescricao?: string | null;
  base?: number | null;
  aliquota?: number | null;
  valor?: number | null;
  percentualReducaoBC?: number | null;
  baseFcp?: number | null;
  percentualFcp?: number | null;
  valorFcp?: number | null;
  modBCST?: string | null;
  modBCSTDescricao?: string | null;
  percentualReducaoBCST?: number | null;
  percentualMvaST?: number | null;
  baseST?: number | null;
  aliquotaST?: number | null;
  valorST?: number | null;
  baseFcpST?: number | null;
  percentualFcpST?: number | null;
  valorFcpST?: number | null;
  baseFcpStRetido?: number | null;
  percentualFcpStRetido?: number | null;
  valorFcpStRetido?: number | null;
  valorIcmsSTDesonerado?: number | null;
  motivoDesoneracaoST?: string | null;
  motivoDesoneracaoSTDescricao?: string | null;
  valorIcmsDesonerado?: number | null;
  motivoDesoneracao?: string | null;
  motivoDesoneracaoDescricao?: string | null;
  // Simples Nacional (ICMSSN101/201/900)
  aliquotaCreditoSN?: number | null;
  valorCreditoICMSSN?: number | null;
}

export interface NfeIbsCbsProduto {
  cst?: string | null;
  cClassTrib?: string | null;
  operacaoDoacao?: string | null;
  base?: number | null;
  aliquotaIbsUF?: number | null;
  valorIbsUF?: number | null;
  aliquotaIbsMun?: number | null;
  valorIbsMun?: number | null;
  valorIbsTotal?: number | null;
  aliquotaCbs?: number | null;
  valorCbs?: number | null;
}

export interface NfeProdutoImpostos {
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
  // Imposto Devolvido (devolução de mercadoria) — det/imposto/impostoDevol.
  impostoDevolPercentual?: number | null;
  impostoDevolValorIpi?: number | null;
  // legacy — mantido por compat (vem preenchido no backend)
  icmsCst?: string | null;
  icmsOrig?: string | null;
  icmsBase?: number | null;
  icmsAliquota?: number | null;
  icmsValor?: number | null;
}

export interface NfeProduto {
  item: number;
  codigo: string;
  ean?: string | null;
  descricao: string;
  ncm?: string | null;
  cest?: string | null;
  cBenef?: string | null;
  cnpjFabricante?: string | null;
  exTipi?: string | null;
  indEscala?: string | null;
  indEscalaDescricao?: string | null;
  indTotal?: string | null;
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
  valorAproximadoTributosItem?: number | null;
  impostos: NfeProdutoImpostos;
  informacoesAdicionais?: string | null;
}

export interface NfeIbsCbsTotais {
  baseCalculo: number;
  ibsEstadualDiferimento: number;
  ibsEstadualDevolucao: number;
  ibsEstadualValor: number;
  ibsMunicipalDiferimento: number;
  ibsMunicipalDevolucao: number;
  ibsMunicipalValor: number;
  ibsTotal: number;
  ibsCreditoPresumido: number;
  ibsCreditoPresumidoCondSus: number;
  cbsDiferimento: number;
  cbsDevolucao: number;
  cbsValor: number;
  cbsCreditoPresumido: number;
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
  modalidadeFrete: string;
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
    indicadorPagamento?: string | null;
    indicadorPagamentoDescricao?: string | null;
    meioPagamento?: string | null;
    meioPagamentoDescricao?: string | null;
    descricaoMeioPagamento?: string | null;
    valorPagamento?: number | null;
    valorTroco?: number | null;
  }>;
}

export interface NfeEventoInfo {
  id?: string;
  tipoEvento: string;
  descricao: string;
  dataEvento?: string | null;
  sequencial?: number | null;
  protocolo?: string | null;
  cStat?: string | null;
  xMotivo?: string | null;
  justificativa?: string | null;
  possuiDetalhe?: boolean;
}

export interface NfeEventoDetalhe {
  orgaoRecepcao?: string | null;
  orgaoRecepcaoDescricao?: string | null;
  ambiente: '1' | '2';
  ambienteDescricao: string;
  versao?: string | null;
  chave: string;
  idEvento: string | null;
  autorCnpj?: string | null;
  autorCpf?: string | null;
  dataEvento: string;
  tipoEvento: string;
  tipoEventoDescricao: string;
  sequencial: number | null;
  versaoEvento?: string | null;
  descricaoEvento?: string | null;
  justificativa?: string | null;
  correcao?: string | null;
  condicoesUso?: string | null;
  autorizacaoCStat?: string | null;
  autorizacaoMotivo?: string | null;
  autorizacaoMensagem?: string | null;
  autorizacaoProtocolo?: string | null;
  autorizacaoDataHora?: string | null;
}

export interface NfeEventoDetalheResponse {
  id: string;
  tipoEvento: string;
  descricao: string;
  dataEvento: string;
  protocolo: string | null;
  cStat: string | null;
  xMotivo: string | null;
  detalhe: NfeEventoDetalhe | null;
}

export interface NfeAutorizadoXml {
  cnpj?: string | null;
  cpf?: string | null;
}

export interface NfeProtocoloAutorizacao {
  protocolo: string;
  dataRecebimento: string;
  cStat: string;
  motivo: string;
  ambiente?: '1' | '2';
}

export interface NfeInformacoesAdicionais {
  informacoesComplementares?: string | null;
  informacoesFisco?: string | null;
  formatoImpressaoDanfe?: string | null;
  formatoImpressaoDanfeDescricao?: string | null;
}

export interface NfeParsed {
  dadosGerais: NfeDadosGerais;
  emitente: NfeParticipante;
  destinatario: NfeParticipante;
  produtos: NfeProduto[];
  totais: NfeTotais;
  transporte: NfeTransporte;
  cobranca: NfeCobranca;
  eventos: NfeEventoInfo[];
  protocoloAutorizacao?: NfeProtocoloAutorizacao | null;
  autorizadosXml: NfeAutorizadoXml[];
  informacoesAdicionais?: NfeInformacoesAdicionais | null;
}

export interface TimelineEvento {
  tipoEvento: string;
  tipoEventoLabel: string;
  descricao: string;
  dataEvento: string;
  protocolo: string | null;
  cStat: string | null;
  xMotivo: string | null;
}

export interface ConsultaProtocoloStatus {
  executado: boolean;
  sucesso: boolean;
  erro?: string | null;
}

// ---------------------------------------------------------------------------
// Timeline vinda do Protheus (contrato `/eventosNfe` recebido 18/04/2026)
// ---------------------------------------------------------------------------

export type OrigemEventoProtheus =
  | 'SPED150'
  | 'SPED156'
  | 'SPED156/CCE'
  | 'SZR010'
  | 'SF1010'
  | (string & {});

export interface EventoProtheusNfe {
  /** Formato `YYYYMMDD HH:MM:SS` (timezone America/Sao_Paulo). */
  quando: string;
  origem: OrigemEventoProtheus;
  tipo: string;
  ator: string;
  detalhes: string;
}

/**
 * Resposta do endpoint `GET /api/v1/fiscal/nfe/:chave/timeline`.
 * SF1010 é separado em `alertasEntrada` (regra interna: timeline estrita
 * contém apenas SPED150/156/SZR/CCE).
 */
export interface TimelineNfeProtheusResponse {
  chave: string;
  quantidade: number;
  timeline: EventoProtheusNfe[];
  alertasEntrada: EventoProtheusNfe[];
}

export interface InconsistenciaOverlay {
  temPendencia: boolean;
  preNotaFalhou: boolean;
  pendenteAmarracao: boolean;
  mensagemProtheus: string | null;
  resolvidaEm: string | null;
  resolvidaPorNome: string | null;
  observacao: string | null;
}

export interface NfeConsultaResult {
  chave: string;
  filial: string;
  origem: OrigemConsulta;
  documentoConsultaId: string;
  parsed: NfeParsed;
  xml: string;
  protheusStatus: ProtheusStatus;
  /** @deprecated — usar protheusStatus */
  alertaProtheus?: string;
  /** Overlay de pendência registrada anteriormente (08/05/2026) */
  inconsistencia: InconsistenciaOverlay;
}

// ===========================================================================
// CT-e — paridade com o portal SEFAZ (todas as 17 seções).
// Espelha CteParsed do backend (fiscal/backend/src/cte/parsers/cte-parsed.interface.ts).
// ===========================================================================

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
  nomeFantasia?: string | null;
  inscricaoEstadual?: string | null;
  inscricaoEstadualST?: string | null;
  inscricaoSUFRAMA?: string | null;
  crt?: string | null;
  crtDescricao?: string | null;
  email?: string | null;
  endereco?: CteEndereco | null;
}

export interface CteDadosGerais {
  chave: string;
  modelo: string;
  serie: string;
  numero: string;
  dataEmissao: string;
  tipoCte: '0' | '1' | '2' | '3';
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
  tipoEmissao?: string | null;
  tipoEmissaoDescricao?: string | null;
  dataContingencia?: string | null;
  justificativaContingencia?: string | null;
  digestValue?: string | null;
  municipioInicioCodigo?: string | null;
  municipioInicioNome?: string | null;
  municipioFimCodigo?: string | null;
  municipioFimNome?: string | null;
}

export interface CteCargaQuantidade {
  tipoMedida: string;
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
  cst?: string | null;
  csosn?: string | null;
  modalidadeBase?: string | null;
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
  componentes: Array<{ nome: string; valor: number }>;
  vTotTrib?: number | null;
  icms?: CteIcms | null;
  icmsUFFim?: CteIcmsUFFim | null;
  issqn?: CteIssqn | null;
  infTribFed?: CteInfTribFed | null;
  // legados
  icmsCst?: string | null;
  icmsBase?: number | null;
  icmsAliquota?: number | null;
  icmsValor?: number | null;
}

export interface CteDocumentoTransportado {
  chaveNFe?: string | null;
  numeroNF?: string | null;
  serie?: string | null;
  pin?: string | null;
  tipoOutro?: string | null;
  descOutro?: string | null;
  numeroOutro?: string | null;
  valor?: number | null;
  pesoTotal?: number | null;
}

export interface CteUnidadeTransporte {
  tipoUnidade?: string | null;
  identificacao?: string | null;
  lacres: string[];
  qtdRat?: number | null;
}

export interface CteUnidadeCarga {
  tipoUnidade?: string | null;
  identificacao?: string | null;
  lacres: string[];
  qtdRat?: number | null;
}

export interface CteSeguro {
  responsavelSeguro?: string | null;
  responsavelDescricao?: string | null;
  nomeSeguradora?: string | null;
  cnpjSeguradora?: string | null;
  numeroApolice?: string | null;
  numeroAverbacao?: string | null;
  valorCarga?: number | null;
  valorAverbado?: number | null;
}

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
    tipoProprietario?: string | null;
  } | null;
  tipoRodado?: string | null;
  tipoCarroceria?: string | null;
  tara?: number | null;
  capacidadeKG?: number | null;
  capacidadeM3?: number | null;
}

export interface CteModalRodoviario {
  modalidade: '01';
  rntrc?: string | null;
  ocorrencias: Array<{ descricao: string; data: string }>;
  veiculo?: CteModalRodoviarioVeiculo | null;
  reboques: CteModalRodoviarioVeiculo[];
  motoristas: Array<{ cpf?: string | null; nome?: string | null }>;
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
  numeroMinuta?: string | null;
  numeroOperacionalAWB?: string | null;
  dataPrevistaEntrega?: string | null;
  natCarga?: { xDime?: string | null; cInfManu: string[] } | null;
  tarifa?: {
    classeTarifa?: string | null;
    codigoTarifa?: string | null;
    valorTarifa?: number | null;
  } | null;
}

export interface CteModalAquaviario {
  modalidade: '03';
  vPrest?: number | null;
  vAFRMM?: number | null;
  xNavio?: string | null;
  balsas: Array<{ xBalsa?: string | null }>;
  numeroBookings?: string | null;
  numeroCE?: string | null;
  numeroBL?: string | null;
  direcao?: string | null;
  irinNavio?: string | null;
  tipoNavegacao?: string | null;
  detContainers: Array<{
    nCont?: string | null;
    lacres: string[];
    detNFe: Array<{ nNF?: string | null; chave?: string | null }>;
  }>;
}

export interface CteModalFerroviario {
  modalidade: '04';
  tipoTrafego?: string | null;
  trafegoMutuo?: {
    respFat?: string | null;
    ferrEmi?: string | null;
    fluxoPagamento?: string | null;
    icmsTransporte?: number | null;
    chaveCTe?: string | null;
  } | null;
  fluxoFerroviario?: string | null;
}

export interface CteModalDutoviario {
  modalidade: '05';
  valorTarifa?: number | null;
  dataInicio?: string | null;
  dataFim?: string | null;
}

export interface CteModalMultimodal {
  modalidade: '06';
  cotm?: string | null;
  indicadorNegociavel?: string | null;
  seguro?: CteSeguro | null;
}

export type CteModal =
  | CteModalRodoviario
  | CteModalAereo
  | CteModalAquaviario
  | CteModalFerroviario
  | CteModalDutoviario
  | CteModalMultimodal
  | null;

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

export interface CteInfoAdicionais {
  observacoes?: string | null;
  infAdFisco?: string | null;
  infCpl?: string | null;
  emailEntrega?: string | null;
  observacoesFiscais: Array<{ xTexto: string; xCampo?: string | null }>;
  observacoesContribuinte: Array<{ xTexto: string; xCampo?: string | null }>;
  autorizadosBaixarXml: Array<{ cnpj?: string | null; cpf?: string | null }>;
}

export interface CteParsed {
  dadosGerais: CteDadosGerais;
  emitente: CteParticipante;
  remetente: CteParticipante;
  expedidor?: CteParticipante | null;
  recebedor?: CteParticipante | null;
  destinatario: CteParticipante;
  tomador: 'Remetente' | 'Expedidor' | 'Recebedor' | 'Destinatário' | 'Outros';
  tomadorOutros?: CteParticipante | null;
  carga: CteCarga;
  valores: CteValores;
  documentosTransportados: CteDocumentoTransportado[];
  unidadesTransporte: CteUnidadeTransporte[];
  unidadesCarga: CteUnidadeCarga[];
  documentosAnteriores: CteDocumentoAnterior[];
  modal: CteModal;
  seguro?: CteSeguro | null;
  infoAdicionais: CteInfoAdicionais;
  protocoloAutorizacao?: CteProtocoloAutorizacao | null;
  observacoes?: string | null;
}

export interface CteConsultaResult {
  chave: string;
  filial: string;
  origem: 'PROTHEUS_CACHE' | 'PROTHEUS_CACHE_RACE' | 'SEFAZ_DOWNLOAD' | 'SEFAZ_STATUS_ONLY';
  documentoConsultaId: string;
  parsed: CteParsed | null;
  xml: string | null;
  xmlDisponivel: boolean;
  protheusStatus: ProtheusStatus;
  eventos: TimelineEvento[];
  consultaProtocoloStatus: ConsultaProtocoloStatus;
  avisoXmlIndisponivel?: string | null;
  alertaProtheus?: string;
}

// ----- Cadastro (CCC) -----

export type SituacaoCadastral =
  | 'HABILITADO'
  | 'NAO_HABILITADO'
  | 'SUSPENSO'
  | 'INAPTO'
  | 'BAIXADO'
  | 'DESCONHECIDO';

export type TipoCadastroProtheus = 'SA1010' | 'SA2010';

export interface VinculoProtheus {
  origem: 'SA1010' | 'SA2010';
  origemDescricao: 'Cliente' | 'Fornecedor';
  /** SA1/SA2 são tabelas compartilhadas entre filiais — campo pode vir vazio ou null. */
  filial: string | null;
  codigo: string;
  loja: string;
  bloqueado: boolean;
  razaoSocial?: string | null;
  inscricaoEstadual?: string | null;
  /** UF da IE deste vínculo (inscUF do Protheus) — usada na auditoria multi-UF. */
  uf: string | null;
}

export interface DivergenciaEntreTabelas {
  campo: string;
  valorSA1010: string | null;
  valorSA2010: string | null;
}

export interface DadosReceitaFederal {
  cnpj: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  situacao: string | null;
  dataSituacao: string | null;
  motivoSituacao: string | null;
  naturezaJuridica: string | null;
  porte: string | null;
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
  /** Quando fonte='RFB_LOCAL': versão AAAA-MM do snapshot da base RFB. */
  versaoRfb?: string;
  consultadoEm: string;
}

/** Uma inscrição estadual retornada pelo CCC/SEFAZ. */
export interface InscricaoEstadualSefaz {
  inscricaoEstadual: string;
  /** UF da SEFAZ que retornou esta IE. */
  uf: string;
  situacao: SituacaoCadastral;
  situacaoRaw: string;
  cSit: string | null;
  dataSituacao: string | null;
  dataFimAtividade: string | null;
  inicioAtividade: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  cnae: string | null;
  regimeApuracao: string | null;
  ieDestinatario: string | null;
  ieDestinatarioCTe: string | null;
  ieAtual: string | null;
  dfeHabilitados: string[];
  endereco: NfeEndereco | null;
}

export type StatusCruzamentoIe = 'AMBOS' | 'APENAS_PROTHEUS' | 'APENAS_SEFAZ';

export interface CruzamentoIeProtheusSefaz {
  inscricaoEstadual: string;
  status: StatusCruzamentoIe;
  vinculosProtheus: VinculoProtheus[];
  sefaz: InscricaoEstadualSefaz | null;
  alertas: string[];
}

export interface CadastroConsultaResult {
  cnpj: string;
  /** UF principal do resultado (onde está a IE habilitada ou a 1ª UF consultada). */
  uf: string;
  /** Todas as UFs consultadas nesta requisição. */
  ufsConsultadas: string[];
  /** UFs ignoradas por exceder o cap de 5 UFs por consulta. */
  ufsIgnoradasPorCap: string[];
  /** UFs que tiveram erro técnico na consulta (timeout, circuit breaker, etc). */
  ufsComFalha: Array<{ uf: string; erro: string }>;
  situacao: SituacaoCadastral;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  cnae: string | null;
  inscricaoEstadual: string | null;
  endereco: NfeEndereco | null;
  inicioAtividade: string | null;
  dataSituacao: string | null;
  dataFimAtividade: string | null;
  regimeApuracao: string | null;
  ieDestinatario: string | null;
  ieDestinatarioCTe: string | null;

  // Todas as IEs retornadas pelo CCC/SEFAZ + cruzamento com vínculos Protheus.
  // Introduzido em 24/04/2026 após feedback do setor fiscal: CCC pode devolver
  // N inscrições para o mesmo CPF/CNPJ (produtor rural com várias propriedades,
  // empresa com IEs por filial). Antes mostrávamos só a 1ª.
  inscricoesSefaz: InscricaoEstadualSefaz[];
  cruzamentoInscricoes: CruzamentoIeProtheusSefaz[];

  // Enriquecimento via Receita Federal (BrasilAPI / ReceitaWS)
  dadosReceita: DadosReceitaFederal | null;
  enriquecimentoReceitaDisponivel: boolean;
  enriquecimentoReceitaMotivo: string | null;

  jaCadastradoNoProtheus: boolean;
  enriquecimentoProtheusFalhou: boolean;
  vinculosProtheus: VinculoProtheus[];
  divergenciasEntreTabelas: DivergenciaEntreTabelas[];

  persistidoComoId: string;
  mudouSituacao: boolean;
  situacaoAnterior: SituacaoCadastral | null;
}

// ----- Cruzamento / Onda 2 -----

export type TipoSincronizacao =
  | 'MOVIMENTO_MEIO_DIA'
  | 'MOVIMENTO_MANHA_SEGUINTE'
  | 'MANUAL'
  | 'PONTUAL';

export type StatusSincronizacao =
  | 'AGENDADA'
  | 'EM_EXECUCAO'
  | 'CONCLUIDA'
  | 'CONCLUIDA_COM_ERROS'
  | 'FALHADA'
  | 'CANCELADA';

export interface CadastroSincronizacao {
  id: string;
  tipo: TipoSincronizacao;
  status: StatusSincronizacao;
  disparadoPor: string | null;
  iniciadoEm: string;
  finalizadoEm: string | null;
  totalContribuintes: number | null;
  sucessos: number;
  erros: number;
  errosPorUf: Record<string, number> | null;
  observacoes: string | null;
  createdAt: string;
}

export interface AlertaEnviado {
  id: string;
  sincronizacaoId: string;
  enviadoEm: string;
  destinatarios: Array<{ email: string; nome: string }>;
  totalDestinatarios: number;
  totalMudancas: number;
  fallback: boolean;
  assunto: string;
  smtpResponse: string | null;
  erro: string | null;
  sincronizacao?: CadastroSincronizacao;
}

export type CircuitStateEnum = 'FECHADO' | 'MEIO_ABERTO' | 'ABERTO';

export interface UfCircuit {
  uf: string;
  estado: CircuitStateEnum;
  errosRecentes: number;
  abertoEm: string | null;
  retomadaEm: string | null;
  motivoBloqueio: string | null;
  ultimaAtualizacao: string;
}

export interface SchedulerStatus {
  meioDia: { cron: string; proxima: string | null } | null;
  manhaSeguinte: { cron: string; proxima: string | null } | null;
}

/**
 * Overview agregado do Dashboard (endpoint GET /api/v1/fiscal/dashboard).
 * Evita 6+ requests paralelos da pagina inicial.
 */
export interface DashboardOverview {
  ambiente: {
    ativo: 'PRODUCAO' | 'HOMOLOGACAO';
    pauseSync: boolean;
  };
  consumoDiario: {
    contador: number;
    limite: number;
    alertaAmarelo: number;
    alertaVermelho: number;
    percentual: number;
    nivel: 'ok' | 'amarelo' | 'vermelho' | 'critico';
    pausadoAutomatico: boolean;
  };
  divergencias: {
    abertasTotal: number;
    porCriticidade: {
      CRITICA: number;
      ALTA: number;
      MEDIA: number;
      BAIXA: number;
    };
  };
  certificado: {
    cnpj: string;
    validoAte: string;
    diasParaVencer: number;
    vencendoEmMenosDe60Dias: boolean;
  } | null;
  ufsBloqueadas: Array<{
    uf: string;
    estado: 'ABERTO' | 'MEIO_ABERTO';
    retomadaEm: string | null;
  }>;
  scheduler: SchedulerStatus;
  ultimasExecucoes: Array<{
    id: string;
    tipo: TipoSincronizacao;
    status: StatusSincronizacao;
    iniciadoEm: string;
    finalizadoEm: string | null;
    totalContribuintes: number | null;
    sucessos: number;
    erros: number;
  }>;
}

// ----- Certificado -----

export interface CertificadoPublico {
  id: string;
  nomeArquivo: string;
  cnpj: string;
  cnpjMascarado: string;
  validoDe: string;
  validoAte: string;
  ativo: boolean;
  diasParaVencer: number;
  vencendoEmMenosDe60Dias: boolean;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
}
