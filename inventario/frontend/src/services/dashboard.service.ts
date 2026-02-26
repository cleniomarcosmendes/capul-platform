import { inventarioApi } from './api';
import type { DashboardData } from '../types';

export const dashboardService = {
  async getResumo(): Promise<DashboardData> {
    const { data } = await inventarioApi.get('/dashboard/stats');
    return data;
  },
};
