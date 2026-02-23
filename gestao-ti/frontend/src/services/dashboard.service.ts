import { gestaoApi } from './api';
import type { DashboardResumo, DashboardFinanceiro, DashboardDisponibilidade, DashboardExecutivo } from '../types';

export const dashboardService = {
  async getResumo(): Promise<DashboardResumo> {
    const { data } = await gestaoApi.get('/dashboard');
    return data;
  },

  async getDisponibilidade(params?: {
    dataInicio?: string;
    dataFim?: string;
    softwareId?: string;
    filialId?: string;
  }): Promise<DashboardDisponibilidade> {
    const { data } = await gestaoApi.get('/dashboard/disponibilidade', { params });
    return data;
  },

  async getFinanceiro(): Promise<DashboardFinanceiro> {
    const { data } = await gestaoApi.get('/dashboard/financeiro');
    return data;
  },

  async getExecutivo(): Promise<DashboardExecutivo> {
    const { data } = await gestaoApi.get('/dashboard/executivo');
    return data;
  },
};
