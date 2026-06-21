import { gestaoApi } from './api';

export interface SacIndicadores {
  periodo: { mes: number; ano: number };
  volume: { abertosNoMes: number; resolvidosNoMes: number; backlogAtual: number };
  tempoResolucaoMedioHoras: number | null;
  sla: {
    backlog: { vencidos: number; emRisco: number; noPrazo: number; semSla: number };
    mes: { cumpridos: number; estourados: number; semSla: number; percentualCumprimento: number | null };
  };
  porCanal: { canal: string; total: number }[];
  porEquipe: { equipeId: string; nome: string; total: number }[];
  porStatus: { status: string; total: number }[];
  email: { ingeridosNoMes: number; casados: number; triagem: number; ignorados: number; duplicados: number; triagemPendente: number };
}

export const sacIndicadoresService = {
  async buscar(mes: number, ano: number): Promise<SacIndicadores> {
    const { data } = await gestaoApi.get('/sac-indicadores', { params: { mes, ano } });
    return data;
  },
};
