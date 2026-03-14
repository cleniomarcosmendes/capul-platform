import { gestaoApi } from './api';

export interface MonitorChamado {
  id: string;
  numero: number;
  titulo: string;
  status: string;
  prioridade: string;
  createdAt: string;
  equipeAtual: { id: string; sigla: string; nome: string };
  filial: { id: string; codigo: string };
  solicitante: { id: string; nome: string };
}

export interface MonitorAtividade {
  id: string;
  titulo: string;
  status: string;
  createdAt: string;
  projeto: { id: string; numero: number; nome: string; status: string };
  fase: { id: string; nome: string } | null;
}

export interface TimerChamado {
  id: string;
  horaInicio: string;
  chamadoId: string;
}

export interface TimerAtividade {
  id: string;
  horaInicio: string;
  atividadeId: string;
  atividade: { projetoId: string };
}

export interface MonitorData {
  chamados: MonitorChamado[];
  atividades: MonitorAtividade[];
  timers: {
    chamados: TimerChamado[];
    atividades: TimerAtividade[];
  };
}

export const monitorService = {
  async getMeusItens(): Promise<MonitorData> {
    const { data } = await gestaoApi.get('/monitor/meus-itens');
    return data;
  },

  async iniciarTimerChamado(chamadoId: string): Promise<void> {
    await gestaoApi.post(`/monitor/iniciar-chamado/${chamadoId}`);
  },

  async iniciarTimerAtividade(atividadeId: string): Promise<void> {
    await gestaoApi.post(`/monitor/iniciar-atividade/${atividadeId}`);
  },

  async encerrarTodos(): Promise<void> {
    await gestaoApi.post('/monitor/encerrar-todos');
  },
};
