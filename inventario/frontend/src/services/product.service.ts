import { inventarioApi } from './api';
import type { Product, ProtheusProductResponse, ProductFilterOptions, FilteredProductResponse } from '../types';

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

  async obterOpcoesFiltro(filial?: string): Promise<ProductFilterOptions> {
    const params: Record<string, string> = {};
    if (filial) params.filial = filial;
    const { data } = await inventarioApi.get('/products/filters', { params });
    return data;
  },

  async filtrarPorFaixa(params: Record<string, string>): Promise<FilteredProductResponse> {
    const { data } = await inventarioApi.get('/products/filter', { params });
    return data;
  },
};
