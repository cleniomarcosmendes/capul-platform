import { inventarioApi } from './api';

export interface ImportResult {
  success_count: number;
  error_count: number;
  errors: Array<{ line_number: number; message: string }>;
  total_processed: number;
}

export interface ImportTable {
  name: string;
  label: string;
  description: string;
}

export const importService = {
  async listarTabelas(): Promise<ImportTable[]> {
    try {
      const { data } = await inventarioApi.get('/import/tables');
      return data;
    } catch {
      // Fallback if endpoint doesn't exist
      return [
        { name: 'SB1010', label: 'Produtos (SB1)', description: 'Cadastro de produtos' },
        { name: 'SB2010', label: 'Saldos (SB2)', description: 'Saldos de estoque' },
        { name: 'SB8010', label: 'Lotes (SB8)', description: 'Controle de lotes' },
      ];
    }
  },

  async importarBulk(tableName: string, records: unknown[], updateExisting = true): Promise<ImportResult> {
    const { data } = await inventarioApi.post('/import/bulk', {
      table_name: tableName,
      records,
      update_existing: updateExisting,
    });
    return data;
  },

  async importarArquivo(file: File, tableName: string): Promise<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('table_name', tableName);
    const { data } = await inventarioApi.post('/import-produtos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
};
