import { gestaoApi } from './api';
import type { DashboardResumo, DashboardFinanceiro, DashboardDisponibilidade, DashboardExecutivo, DashboardCsat, AcompanhamentoData, TecnicoResumo } from '../types';

export const dashboardService = {
  async getResumo(params?: { dataInicio?: string; dataFim?: string; departamentoId?: string }): Promise<DashboardResumo> {
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

  async getCsat(params?: { dataInicio?: string; dataFim?: string; departamentoId?: string }): Promise<DashboardCsat> {
    const { data } = await gestaoApi.get('/dashboard/csat', { params });
    return data;
  },

  async getAcompanhamento(params?: { usuarioId?: string; dataInicio?: string; dataFim?: string }): Promise<AcompanhamentoData> {
    const tzOffset = new Date().getTimezoneOffset();
    const { data } = await gestaoApi.get('/dashboard/acompanhamento', {
      params: { ...params, tzOffset },
    });
    return data;
  },

  async getTecnicos(): Promise<TecnicoResumo[]> {
    const { data } = await gestaoApi.get('/dashboard/acompanhamento/tecnicos');
    return data;
  },
};
