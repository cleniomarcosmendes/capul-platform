import { gestaoApi } from './api';
import type { OrdemServico, StatusOS } from '../types';

interface CreateOsPayload {
  titulo: string;
  descricao?: string;
  filialId: string;
  tecnicoId?: string;
  dataAgendamento?: string;
  observacoes?: string;
}

interface UpdateOsPayload {
  titulo?: string;
  descricao?: string;
  dataAgendamento?: string;
  observacoes?: string;
}

export const ordemServicoService = {
  async listar(status?: StatusOS, filialId?: string): Promise<OrdemServico[]> {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (filialId) params.filialId = filialId;
    const { data } = await gestaoApi.get('/ordens-servico', { params });
    return data;
  },

  async buscar(id: string): Promise<OrdemServico> {
    const { data } = await gestaoApi.get(`/ordens-servico/${id}`);
    return data;
  },

  async criar(payload: CreateOsPayload): Promise<OrdemServico> {
    const { data } = await gestaoApi.post('/ordens-servico', payload);
    return data;
  },

  async atualizar(id: string, payload: UpdateOsPayload): Promise<OrdemServico> {
    const { data } = await gestaoApi.patch(`/ordens-servico/${id}`, payload);
    return data;
  },

  // Workflow
  async iniciar(id: string): Promise<OrdemServico> {
    const { data } = await gestaoApi.post(`/ordens-servico/${id}/iniciar`);
    return data;
  },

  async encerrar(id: string, observacoes?: string): Promise<OrdemServico> {
    const { data } = await gestaoApi.post(`/ordens-servico/${id}/encerrar`, { observacoes });
    return data;
  },

  async cancelar(id: string): Promise<OrdemServico> {
    const { data } = await gestaoApi.post(`/ordens-servico/${id}/cancelar`);
    return data;
  },

  // Chamados N:N
  async vincularChamado(osId: string, chamadoId: string): Promise<OrdemServico> {
    const { data } = await gestaoApi.post(`/ordens-servico/${osId}/chamados`, { chamadoId });
    return data;
  },

  async desvincularChamado(osId: string, chamadoId: string): Promise<void> {
    await gestaoApi.delete(`/ordens-servico/${osId}/chamados/${chamadoId}`);
  },

  // Tecnicos N:N
  async adicionarTecnico(osId: string, tecnicoId: string): Promise<OrdemServico> {
    const { data } = await gestaoApi.post(`/ordens-servico/${osId}/tecnicos`, { tecnicoId });
    return data;
  },

  async removerTecnico(osId: string, tecnicoId: string): Promise<void> {
    await gestaoApi.delete(`/ordens-servico/${osId}/tecnicos/${tecnicoId}`);
  },

  // Comentarios
  async comentar(osId: string, descricao: string): Promise<OrdemServico> {
    const { data } = await gestaoApi.post(`/ordens-servico/${osId}/comentar`, { descricao });
    return data;
  },

  async editarComentario(osId: string, historicoId: string, descricao: string): Promise<OrdemServico> {
    const { data } = await gestaoApi.patch(`/ordens-servico/${osId}/comentarios/${historicoId}`, { descricao });
    return data;
  },

  async downloadRelatorio(osId: string, osNumero: number): Promise<void> {
    const { data } = await gestaoApi.get(`/export/ordem-servico/${osId}/relatorio`, {
      responseType: 'blob',
    });
    const blob = new Blob([data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `OS_${osNumero}_relatorio_${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};
