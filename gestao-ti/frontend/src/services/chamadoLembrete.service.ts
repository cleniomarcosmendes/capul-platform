import { gestaoApi } from './api';

export interface ChamadoLembreteConfig {
  id: number;
  enabled: boolean;
  diasInatividadeEquipe: number;
  diasInatividadeSolicitante: number;
  diasEscala: number;
  intervaloReenvioDias: number;
  maxLembretes: number;
  autoFechar: boolean;
  diasAutoFechamento: number;
  horaExecucao: number;
  lastRunAt: string | null;
  lastResumo: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

export interface UpdateChamadoLembreteConfigPayload {
  enabled?: boolean;
  diasInatividadeEquipe?: number;
  diasInatividadeSolicitante?: number;
  diasEscala?: number;
  intervaloReenvioDias?: number;
  maxLembretes?: number;
  autoFechar?: boolean;
  diasAutoFechamento?: number;
  horaExecucao?: number;
}

export interface VarreduraResumo {
  ok: boolean;
  dryRun: boolean;
  motivo?: string;
  lembrarTecnico: number[];
  lembrarSolicitante: number[];
  escalados: number[];
  fechados: number[];
  sacPulados: number;
  semDestino: number;
}

export const chamadoLembreteService = {
  async getConfig(): Promise<ChamadoLembreteConfig> {
    const { data } = await gestaoApi.get('/chamado-lembrete/config');
    return data;
  },
  async updateConfig(payload: UpdateChamadoLembreteConfigPayload): Promise<ChamadoLembreteConfig> {
    const { data } = await gestaoApi.put('/chamado-lembrete/config', payload);
    return data;
  },
  /** dryRun=true pré-visualiza quem SERIA notificado/fechado, sem enviar nada. */
  async executar(dryRun: boolean): Promise<VarreduraResumo> {
    const { data } = await gestaoApi.post(`/chamado-lembrete/executar-agora?dryRun=${dryRun}`);
    return data;
  },
};
