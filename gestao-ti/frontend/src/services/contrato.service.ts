import { gestaoApi } from './api';
import type {
  Contrato,
  StatusContrato,
  ParcelaContrato,
  RateioTemplate,
  ModalidadeRateio,
  SoftwareLicenca,
  NaturezaContrato,
  TipoContratoConfig,
  ParcelaRateioItem,
  AnexoContrato,
  ContratoRenovacaoReg,
} from '../types';

interface ListFilters {
  tipoContratoId?: string;
  status?: StatusContrato;
  softwareId?: string;
  fornecedor?: string;
  vencendoEm?: number;
}

interface CreateContratoPayload {
  titulo: string;
  tipoContratoId: string;
  fornecedor: string;
  filialId: string;
  modalidadeValor?: string;
  numeroContrato?: string;
  codigoFornecedor?: string;
  lojaFornecedor?: string;
  valorTotal: number;
  valorMensal?: number;
  dataInicio: string;
  dataFim: string;
  dataAssinatura?: string;
  renovacaoAutomatica?: boolean;
  diasAlertaVencimento?: number;
  softwareId?: string;
  equipeId?: string;
  descricao?: string;
  observacoes?: string;
  gerarParcelas?: boolean;
  quantidadeParcelas?: number;
  primeiroVencimento?: string;
}

interface RateioItemPayload {
  centroCustoId: string;
  percentual?: number;
  valorFixo?: number;
  parametro?: number;
  naturezaId?: string;
}

interface RateioPayload {
  modalidade: ModalidadeRateio;
  criterio?: string;
  itens: RateioItemPayload[];
}

interface RenovarPayload {
  indiceReajuste?: string;
  percentualReajuste?: number;
  novoValorTotal?: number;
  novaDataInicio?: string;
  novaDataFim?: string;
  gerarParcelas?: boolean;
  quantidadeParcelas?: number;
  primeiroVencimento?: string;
}

export const contratoService = {
  async listar(filters: ListFilters = {}): Promise<Contrato[]> {
    const params: Record<string, string> = {};
    if (filters.tipoContratoId) params.tipoContratoId = filters.tipoContratoId;
    if (filters.status) params.status = filters.status;
    if (filters.softwareId) params.softwareId = filters.softwareId;
    if (filters.fornecedor) params.fornecedor = filters.fornecedor;
    if (filters.vencendoEm) params.vencendoEm = String(filters.vencendoEm);
    const { data } = await gestaoApi.get('/contratos', { params });
    return data;
  },

  async buscar(id: string): Promise<Contrato> {
    const { data } = await gestaoApi.get(`/contratos/${id}`);
    return data;
  },

  async criar(payload: CreateContratoPayload): Promise<Contrato> {
    const { data } = await gestaoApi.post('/contratos', payload);
    return data;
  },

  async atualizar(id: string, payload: Partial<CreateContratoPayload>): Promise<Contrato> {
    const { data } = await gestaoApi.patch(`/contratos/${id}`, payload);
    return data;
  },

  async alterarStatus(id: string, status: StatusContrato): Promise<Contrato> {
    const { data } = await gestaoApi.patch(`/contratos/${id}/status`, { status });
    return data;
  },

  async renovar(id: string, payload: RenovarPayload): Promise<Contrato> {
    const { data } = await gestaoApi.post(`/contratos/${id}/renovar`, payload);
    return data;
  },

  // Parcelas
  async listarParcelas(contratoId: string): Promise<ParcelaContrato[]> {
    const { data } = await gestaoApi.get(`/contratos/${contratoId}/parcelas`);
    return data;
  },

  async criarParcela(contratoId: string, payload: { numero: number; descricao?: string; valor: number; dataVencimento: string; notaFiscal?: string; observacoes?: string }): Promise<ParcelaContrato> {
    const { data } = await gestaoApi.post(`/contratos/${contratoId}/parcelas`, payload);
    return data;
  },

  async atualizarParcela(contratoId: string, parcelaId: string, payload: Record<string, unknown>): Promise<ParcelaContrato> {
    const { data } = await gestaoApi.patch(`/contratos/${contratoId}/parcelas/${parcelaId}`, payload);
    return data;
  },

  async pagarParcela(contratoId: string, parcelaId: string, payload?: { dataPagamento?: string; notaFiscal?: string }): Promise<ParcelaContrato> {
    const { data } = await gestaoApi.post(`/contratos/${contratoId}/parcelas/${parcelaId}/pagar`, payload || {});
    return data;
  },

  async cancelarParcela(contratoId: string, parcelaId: string): Promise<ParcelaContrato> {
    const { data } = await gestaoApi.post(`/contratos/${contratoId}/parcelas/${parcelaId}/cancelar`);
    return data;
  },

  // Rateio Template
  async obterRateioTemplate(contratoId: string): Promise<RateioTemplate | null> {
    const { data } = await gestaoApi.get(`/contratos/${contratoId}/rateio-template`);
    return data;
  },

  async simularRateioTemplate(contratoId: string, payload: RateioPayload): Promise<RateioItemPayload[]> {
    const { data } = await gestaoApi.post(`/contratos/${contratoId}/rateio-template/simular`, payload);
    return data;
  },

  async configurarRateioTemplate(contratoId: string, payload: RateioPayload): Promise<RateioTemplate> {
    const { data } = await gestaoApi.post(`/contratos/${contratoId}/rateio-template`, payload);
    return data;
  },

  // Rateio por Parcela
  async obterRateioParcela(contratoId: string, parcelaId: string): Promise<ParcelaRateioItem[]> {
    const { data } = await gestaoApi.get(`/contratos/${contratoId}/parcelas/${parcelaId}/rateio`);
    return data;
  },

  async configurarRateioParcela(contratoId: string, parcelaId: string, payload: RateioPayload): Promise<ParcelaRateioItem[]> {
    const { data } = await gestaoApi.post(`/contratos/${contratoId}/parcelas/${parcelaId}/rateio`, payload);
    return data;
  },

  async gerarRateioParcela(contratoId: string, parcelaId: string, usarTemplate: boolean): Promise<ParcelaRateioItem[]> {
    const { data } = await gestaoApi.post(`/contratos/${contratoId}/parcelas/${parcelaId}/rateio/gerar`, { usarTemplate });
    return data;
  },

  async copiarRateioParaPendentes(contratoId: string, parcelaId: string): Promise<{ parcelasCopied: number }> {
    const { data } = await gestaoApi.post(`/contratos/${contratoId}/parcelas/${parcelaId}/rateio/copiar-pendentes`);
    return data;
  },

  // Anexos
  async listarAnexos(contratoId: string): Promise<AnexoContrato[]> {
    const { data } = await gestaoApi.get(`/contratos/${contratoId}/anexos`);
    return data;
  },

  async uploadAnexo(contratoId: string, file: File): Promise<AnexoContrato> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await gestaoApi.post(`/contratos/${contratoId}/anexos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async downloadAnexo(contratoId: string, anexoId: string): Promise<Blob> {
    const { data } = await gestaoApi.get(`/contratos/${contratoId}/anexos/${anexoId}/download`, {
      responseType: 'blob',
    });
    return data;
  },

  async excluirAnexo(contratoId: string, anexoId: string): Promise<void> {
    await gestaoApi.delete(`/contratos/${contratoId}/anexos/${anexoId}`);
  },

  // Renovacoes
  async listarRenovacoes(contratoId: string): Promise<ContratoRenovacaoReg[]> {
    const { data } = await gestaoApi.get(`/contratos/${contratoId}/renovacoes`);
    return data;
  },

  // Licencas
  async vincularLicenca(contratoId: string, licencaId: string): Promise<SoftwareLicenca> {
    const { data } = await gestaoApi.post(`/contratos/${contratoId}/licencas`, { licencaId });
    return data;
  },

  async desvincularLicenca(contratoId: string, licencaId: string): Promise<void> {
    await gestaoApi.delete(`/contratos/${contratoId}/licencas/${licencaId}`);
  },

  // Naturezas
  async listarNaturezas(): Promise<NaturezaContrato[]> {
    const { data } = await gestaoApi.get('/contratos/naturezas', { params: { status: 'ATIVO' } });
    return data;
  },
  async listarTodasNaturezas(): Promise<NaturezaContrato[]> {
    const { data } = await gestaoApi.get('/contratos/naturezas');
    return data;
  },
  async criarNatureza(payload: { codigo: string; nome: string }): Promise<NaturezaContrato> {
    const { data } = await gestaoApi.post('/contratos/naturezas', payload);
    return data;
  },
  async atualizarNatureza(id: string, payload: Record<string, unknown>): Promise<NaturezaContrato> {
    const { data } = await gestaoApi.patch(`/contratos/naturezas/${id}`, payload);
    return data;
  },

  // Tipos Contrato
  async listarTiposContrato(): Promise<TipoContratoConfig[]> {
    const { data } = await gestaoApi.get('/contratos/tipos-contrato', { params: { status: 'ATIVO' } });
    return data;
  },
  async listarTodosTiposContrato(): Promise<TipoContratoConfig[]> {
    const { data } = await gestaoApi.get('/contratos/tipos-contrato');
    return data;
  },
  async criarTipoContrato(payload: { codigo: string; nome: string }): Promise<TipoContratoConfig> {
    const { data } = await gestaoApi.post('/contratos/tipos-contrato', payload);
    return data;
  },
  async atualizarTipoContrato(id: string, payload: Record<string, unknown>): Promise<TipoContratoConfig> {
    const { data } = await gestaoApi.patch(`/contratos/tipos-contrato/${id}`, payload);
    return data;
  },
};
