import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

// Mock the api module
vi.mock('../services/api', () => ({
  authApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { authApi } from '../services/api';

function TestConsumer() {
  const { usuario, loading, inventarioRole } = useAuth();
  if (loading) return <div>Carregando...</div>;
  return (
    <div>
      <span data-testid="user">{usuario?.nome ?? 'null'}</span>
      <span data-testid="role">{inventarioRole ?? 'null'}</span>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('AuthContext', () => {
  it('shows null user when no token exists', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('null');
    });
  });

  it('loads user data from /me when token exists', async () => {
    localStorage.setItem('accessToken', 'fake-token');
    vi.mocked(authApi.get).mockResolvedValue({
      data: {
        nome: 'Admin',
        modulos: [{ codigo: 'INVENTARIO', role: 'ADMIN' }],
        filialAtual: { codigo: '01', nome: 'Filial 01' },
      },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('Admin');
      expect(screen.getByTestId('role')).toHaveTextContent('ADMIN');
    });
  });

  it('extracts inventarioRole from modulos list', async () => {
    localStorage.setItem('accessToken', 'fake-token');
    vi.mocked(authApi.get).mockResolvedValue({
      data: {
        nome: 'Operador',
        modulos: [
          { codigo: 'GESTAO_TI', role: 'TECNICO' },
          { codigo: 'INVENTARIO', role: 'OPERATOR' },
        ],
        filialAtual: { codigo: '02', nome: 'Filial 02' },
      },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('role')).toHaveTextContent('OPERATOR');
    });
  });
});
