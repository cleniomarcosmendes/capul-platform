import { coreApi } from './api';

export interface BackupExecucao {
  id: string;
  tipo: string;
  status: 'SUCESSO' | 'FALHA' | 'EM_ANDAMENTO';
  iniciadoEm: string;
  finalizadoEm: string | null;
  duracaoMs: number | null;
  tamanhoBytes: string | null;
  hostname: string | null;
  destino: string | null;
  cifrado: boolean;
  mensagem: string | null;
  metadata: Record<string, unknown> | null;
}

export interface BackupStatus {
  ultimoSucesso: BackupExecucao | null;
  ultimaFalha: BackupExecucao | null;
  contagem7d: Record<string, number>;
}

export interface DrConfig {
  rtoHoras: number | null;
  rpoHoras: number | null;
  aprovadoPor: string | null;
  aprovadoEm: string | null;
  retencaoDiarios: number | null;
  retencaoSemanas: number | null;
  retencaoMeses: number | null;
  destinoOffsite: string | null;
  emailAlerta: string | null;
  webhookAlerta: string | null;
  agendamentoCron: string | null;
  proximaRevisao: string | null;
}

export const backupService = {
  async listar(limit = 50): Promise<BackupExecucao[]> {
    const { data } = await coreApi.get('/backup/execucoes', { params: { limit } });
    return data;
  },

  async status(): Promise<BackupStatus> {
    const { data } = await coreApi.get('/backup/execucoes/status');
    return data;
  },

  async detalhe(id: string): Promise<BackupExecucao> {
    const { data } = await coreApi.get(`/backup/execucoes/${id}`);
    return data;
  },

  async getConfig(): Promise<DrConfig> {
    const { data } = await coreApi.get('/backup/execucoes/config');
    return data;
  },

  async updateConfig(patch: Partial<DrConfig>): Promise<DrConfig> {
    const { data } = await coreApi.patch('/backup/execucoes/config', patch);
    return data;
  },

  async testWebhook(): Promise<TestResult> {
    const { data } = await coreApi.post('/backup/execucoes/test/webhook');
    return data;
  },

  async testEmail(): Promise<TestResult> {
    const { data } = await coreApi.post('/backup/execucoes/test/email');
    return data;
  },

  async testS3(): Promise<TestResult> {
    const { data } = await coreApi.post('/backup/execucoes/test/s3');
    return data;
  },

  async comandoExecutarBackup(): Promise<TestResult> {
    const { data } = await coreApi.get('/backup/execucoes/comando/executar-backup');
    return data;
  },

  async comandoDrTest(): Promise<TestResult> {
    const { data } = await coreApi.get('/backup/execucoes/comando/dr-test');
    return data;
  },
};

export interface TestResult {
  ok: boolean;
  message: string;
  detail?: string;
}
