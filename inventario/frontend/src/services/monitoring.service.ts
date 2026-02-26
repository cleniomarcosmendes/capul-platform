import { inventarioApi } from './api';
import type { MonitoringHealth, MonitoringAnomaliesResponse } from '../types';

export const monitoringService = {
  async getHealth(): Promise<MonitoringHealth> {
    const { data } = await inventarioApi.get('/monitoring/health');
    return data;
  },

  async getStatistics(): Promise<Record<string, unknown>> {
    const { data } = await inventarioApi.get('/monitoring/statistics');
    return data;
  },

  async getAnomalies(): Promise<MonitoringAnomaliesResponse> {
    const { data } = await inventarioApi.get('/monitoring/anomalies');
    return data;
  },
};
