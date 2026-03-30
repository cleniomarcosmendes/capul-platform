import { coreApi } from './api';

export interface IntegracaoApi {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  ambiente: 'PRODUCAO' | 'HOMOLOGACAO';
  tipoAuth: 'BASIC' | 'BEARER' | 'API_KEY' | 'NONE';
  authConfig: string | null;
  ativo: boolean;
  endpoints: IntegracaoEndpoint[];
  createdAt: string;
  updatedAt: string;
}

export interface IntegracaoEndpoint {
  id: string;
  ambiente: 'PRODUCAO' | 'HOMOLOGACAO';
  operacao: string;
  descricao: string | null;
  url: string;
  metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  timeoutMs: number;
  headers: Record<string, string> | null;
  ativo: boolean;
  integracaoId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TesteConexaoResult {
  sucesso: boolean;
  status: number;
  statusText: string;
  duracao: number;
  url: string;
}

export const integracaoService = {
  async listar(): Promise<IntegracaoApi[]> {
    const { data } = await coreApi.get('/integracoes');
    return data;
  },

  async buscar(id: string): Promise<IntegracaoApi> {
    const { data } = await coreApi.get(`/integracoes/${id}`);
    return data;
  },

  async criar(dto: Partial<IntegracaoApi>): Promise<IntegracaoApi> {
    const { data } = await coreApi.post('/integracoes', dto);
    return data;
  },

  async atualizar(id: string, dto: Partial<IntegracaoApi>): Promise<IntegracaoApi> {
    const { data } = await coreApi.patch(`/integracoes/${id}`, dto);
    return data;
  },

  async excluir(id: string): Promise<void> {
    await coreApi.delete(`/integracoes/${id}`);
  },

  async adicionarEndpoint(integracaoId: string, dto: Partial<IntegracaoEndpoint>): Promise<IntegracaoEndpoint> {
    const { data } = await coreApi.post(`/integracoes/${integracaoId}/endpoints`, dto);
    return data;
  },

  async atualizarEndpoint(endpointId: string, dto: Partial<IntegracaoEndpoint>): Promise<IntegracaoEndpoint> {
    const { data } = await coreApi.patch(`/integracoes/endpoints/${endpointId}`, dto);
    return data;
  },

  async excluirEndpoint(endpointId: string): Promise<void> {
    await coreApi.delete(`/integracoes/endpoints/${endpointId}`);
  },

  async testarConexao(dto: { url: string; metodo: string; headers?: Record<string, string>; authHeader?: string; timeoutMs?: number }): Promise<TesteConexaoResult> {
    const { data } = await coreApi.post('/integracoes/testar-conexao', dto);
    return data;
  },
};
