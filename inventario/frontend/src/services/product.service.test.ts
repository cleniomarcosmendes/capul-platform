import { describe, it, expect, vi, beforeEach } from 'vitest';
import { productService } from './product.service';

// Mock the api module
vi.mock('./api', () => ({
  inventarioApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { inventarioApi } from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('productService', () => {
  it('listar returns array from paginated response', async () => {
    vi.mocked(inventarioApi.get).mockResolvedValue({
      data: {
        products: [
          { id: '1', code: 'P001', description: 'Produto 1' },
          { id: '2', code: 'P002', description: 'Produto 2' },
        ],
        total: 2,
        page: 1,
        pages: 1,
      },
    });

    const result = await productService.listar();
    expect(result).toHaveLength(2);
    expect(result[0].code).toBe('P001');
    expect(inventarioApi.get).toHaveBeenCalledWith('/products', { params: undefined });
  });

  it('listar handles raw array response', async () => {
    vi.mocked(inventarioApi.get).mockResolvedValue({
      data: [
        { id: '1', code: 'P001', description: 'Produto 1' },
      ],
    });

    const result = await productService.listar();
    expect(result).toHaveLength(1);
  });

  it('buscarPorId returns single product', async () => {
    vi.mocked(inventarioApi.get).mockResolvedValue({
      data: { id: '42', code: 'P042', description: 'Produto 42' },
    });

    const result = await productService.buscarPorId('42');
    expect(result.code).toBe('P042');
    expect(inventarioApi.get).toHaveBeenCalledWith('/products/42');
  });
});
