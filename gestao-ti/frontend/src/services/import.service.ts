import { gestaoApi } from './api';

interface LinhaPreview {
  linha: number;
  dados: Record<string, unknown>;
  valida: boolean;
  erros: string[];
}

export interface PreviewResult {
  entidade: string;
  totalLinhas: number;
  validas: number;
  invalidas: number;
  linhas: LinhaPreview[];
}

export interface ExecutarResult {
  criados: number;
  erros: { linha: number; erro: string }[];
}

export const importService = {
  async preview(entidade: string, file: File): Promise<PreviewResult> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await gestaoApi.post(`/import/preview?entidade=${entidade}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async executar(entidade: string, dados: Record<string, unknown>[]): Promise<ExecutarResult> {
    const { data } = await gestaoApi.post('/import/executar', { entidade, dados });
    return data;
  },
};
