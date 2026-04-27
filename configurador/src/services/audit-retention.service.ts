import { coreApi } from './api';

export interface RetentionStatus {
  retentionDias: number;
  totalLinhas: number;
  maisAntigo: string | null;
  maisRecente: string | null;
}

export const auditRetentionService = {
  async getStatus(): Promise<RetentionStatus> {
    const { data } = await coreApi.get('/audit-log-retention/status');
    return data;
  },

  async update(retentionDias: number): Promise<RetentionStatus> {
    const { data } = await coreApi.patch('/audit-log-retention/config', { retentionDias });
    return data;
  },

  async runNow(): Promise<{ ok: boolean; message: string }> {
    const { data } = await coreApi.post('/audit-log-retention/run-now', {});
    return data;
  },
};
