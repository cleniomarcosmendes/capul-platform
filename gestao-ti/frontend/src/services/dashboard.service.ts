import { gestaoApi } from './api';
import type { DashboardResumo, DashboardFinanceiro, DashboardDisponibilidade, DashboardExecutivo } from '../types';

export const dashboardService = {
  async getResumo(params?: { dataInicio?: string; dataFim?: string }): Promise<DashboardResumo> {
    const { data } = await gestaoApi.get('/dashboard', { params });
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

  async getFinanceiro(params?: { dataInicio?: string; dataFim?: string }): Promise<DashboardFinanceiro> {
    const { data } = await gestaoApi.get('/dashboard/financeiro', { params });
    return data;
  },

  async getExecutivo(params?: { dataInicio?: string; dataFim?: string }): Promise<DashboardExecutivo> {
    const { data } = await gestaoApi.get('/dashboard/executivo', { params });
    return data;
  },
};
