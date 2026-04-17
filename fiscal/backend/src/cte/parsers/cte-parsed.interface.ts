/**
 * Shape canônica de um CT-e 4.00 parseado.
 * Referência: manual CT-e 3.00/4.00 — modelo 57.
 *
 * Bloco raiz: `<cteProc><CTe><infCte>...</infCte></CTe><protCTe>...</protCTe></cteProc>`.
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
}

export interface CteParticipante {
  cnpj?: string | null;
  cpf?: string | null;
  razaoSocial: string;
  inscricaoEstadual?: string | null;
  endereco?: {
    logradouro?: string | null;
    numero?: string | null;
    bairro?: string | null;
    municipio?: string | null;
    codigoMunicipio?: string | null;
    uf?: string | null;
    cep?: string | null;
  } | null;
}

export interface CteCarga {
  valorCarga: number;
  produtoPredominante: string;
  outrasCaracteristicas?: string | null;
  quantidades: Array<{
    tipoMedida: string; // cUnid: 00, 01, 02, 03, 04, 05
    descricao: string;
    quantidade: number;
  }>;
}

export interface CteValores {
  valorTotalPrestacao: number;
  valorReceber: number;
  componentes: Array<{
    nome: string;
    valor: number;
  }>;
  icmsCst?: string | null;
  icmsBase?: number | null;
  icmsAliquota?: number | null;
  icmsValor?: number | null;
}

export interface CteDocumentoTransportado {
  chaveNFe?: string | null;
  numeroNF?: string | null;
  serie?: string | null;
  valor?: number | null;
  pesoTotal?: number | null;
}

export interface CteProtocoloAutorizacao {
  protocolo: string;
  dataRecebimento: string;
  cStat: string;
  motivo: string;
  ambiente: '1' | '2';
}

export interface CteParsed {
  dadosGerais: CteDadosGerais;
  emitente: CteParticipante;
  remetente: CteParticipante;
  expedidor?: CteParticipante | null;
  recebedor?: CteParticipante | null;
  destinatario: CteParticipante;
  tomador: 'Remetente' | 'Expedidor' | 'Recebedor' | 'Destinatário' | 'Outros';
  carga: CteCarga;
  valores: CteValores;
  documentosTransportados: CteDocumentoTransportado[];
  observacoes?: string | null;
  protocoloAutorizacao?: CteProtocoloAutorizacao | null;
}
