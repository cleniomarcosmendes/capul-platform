import { gestaoApi } from './api';
import type {
  Contrato,
  TipoContrato,
  StatusContrato,
  ParcelaContrato,
  ContratoRateioConfig,
  ModalidadeRateio,
  SoftwareLicenca,
} from '../types';

interface ListFilters {
  tipo?: TipoContrato;
  status?: StatusContrato;
  softwareId?: string;
  fornecedor?: string;
  vencendoEm?: number;
}

interface CreateContratoPayload {
  titulo: string;
  tipo: TipoContrato;
  fornecedor: string;
  cnpjFornecedor?: string;
  valorTotal: number;
  valorMensal?: number;
  dataInicio: string;
  dataFim: string;
  dataAssinatura?: string;
  indiceReajuste?: string;
  percentualReajuste?: number;
  renovacaoAutomatica?: boolean;
  diasAlertaVencimento?: number;
  softwareId?: string;
  descricao?: string;
  observacoes?: string;
}

interface RateioItemPayload {
  centroCustoId: string;
  percentual?: number;
  valorFixo?: number;
  parametro?: number;
}

interface RateioPayload {
  modalidade: ModalidadeRateio;
  criterio?: string;
  itens: RateioItemPayload[];
}

export const contratoService = {
  async listar(filters: ListFilters = {}): Promise<Contrato[]> {
    const params: Record<string, string> = {};
    if (filters.tipo) params.tipo = filters.tipo;
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

  async renovar(id: string): Promise<Contrato> {
    const { data } = await gestaoApi.post(`/contratos/${id}/renovar`);
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

  // Rateio
  async obterRateio(contratoId: string): Promise<ContratoRateioConfig | null> {
    const { data } = await gestaoApi.get(`/contratos/${contratoId}/rateio`);
    return data;
  },

  async simularRateio(contratoId: string, payload: RateioPayload): Promise<RateioItemPayload[]> {
    const { data } = await gestaoApi.post(`/contratos/${contratoId}/rateio/simular`, payload);
    return data;
  },

  async configurarRateio(contratoId: string, payload: RateioPayload): Promise<ContratoRateioConfig> {
    const { data } = await gestaoApi.post(`/contratos/${contratoId}/rateio`, payload);
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
};
