import { gestaoApi } from './api';
import type { HorarioTrabalho } from '../types';

export const horarioService = {
  async getDefault(): Promise<HorarioTrabalho> {
    const { data } = await gestaoApi.get('/horarios-trabalho/default');
    return data;
  },

  async updateDefault(dto: {
    horaInicioExpediente: string;
    horaFimExpediente: string;
    horaInicioAlmoco: string;
    horaFimAlmoco: string;
  }): Promise<HorarioTrabalho> {
    const { data } = await gestaoApi.post('/horarios-trabalho/default', dto);
    return data;
  },

  async findAll(): Promise<HorarioTrabalho[]> {
    const { data } = await gestaoApi.get('/horarios-trabalho');
    return data;
  },

  async upsert(dto: {
    usuarioId?: string;
    horaInicioExpediente: string;
    horaFimExpediente: string;
    horaInicioAlmoco: string;
    horaFimAlmoco: string;
  }): Promise<HorarioTrabalho> {
    const { data } = await gestaoApi.post('/horarios-trabalho', dto);
    return data;
  },

  async remove(usuarioId: string): Promise<void> {
    await gestaoApi.delete(`/horarios-trabalho/${usuarioId}`);
  },
};
