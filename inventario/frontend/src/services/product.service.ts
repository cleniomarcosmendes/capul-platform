import { inventarioApi } from './api';
import type { Product, ProtheusProductResponse } from '../types';

export const productService = {
  async listar(params?: Record<string, string>): Promise<Product[]> {
    const { data } = await inventarioApi.get('/products', { params });
    // Backend returns { products: [...], total, page, pages, limit }
    return Array.isArray(data) ? data : data.products ?? [];
  },

  async listarProtheus(params?: Record<string, string>): Promise<ProtheusProductResponse> {
    const { data } = await inventarioApi.get('/products', { params });
    return data;
  },

  async buscarPorId(id: string): Promise<Product> {
    const { data } = await inventarioApi.get(`/products/${id}`);
    return data;
  },

  async importar(payload: FormData): Promise<{ imported: number; errors: number }> {
    const { data } = await inventarioApi.post('/import/products', payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
};
