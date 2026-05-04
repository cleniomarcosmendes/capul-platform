import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from './Sidebar';

// Mock the auth context
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../contexts/AuthContext';

function renderSidebar(role: string) {
  vi.mocked(useAuth).mockReturnValue({
    usuario: {
      nome: 'Test User',
      filialAtual: { codigo: '01', nome: 'Filial 01' },
      modulos: [{ codigo: 'INVENTARIO', role }],
    } as ReturnType<typeof useAuth>['usuario'],
    loading: false,
    inventarioRole: role,
    refreshUser: vi.fn(),
    logout: vi.fn(),
  });

  return render(
    <MemoryRouter>
      <Sidebar open={true} onClose={vi.fn()} />
    </MemoryRouter>,
  );
}

describe('Sidebar', () => {
  it('renders common menu items for all roles', () => {
    renderSidebar('OPERATOR');
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Inventarios')).toBeInTheDocument();
    expect(screen.getByText('Contagem')).toBeInTheDocument();
    expect(screen.getByText('Produtos')).toBeInTheDocument();
  });

  it('renders staff-only items for ADMIN', () => {
    renderSidebar('ADMIN');
    expect(screen.getByText('Integracoes')).toBeInTheDocument();
    expect(screen.getByText('Monitoramento')).toBeInTheDocument();
    expect(screen.getByText('Análise')).toBeInTheDocument();
    expect(screen.getByText('Armazens')).toBeInTheDocument();
  });

  it('hides staff items from OPERATOR', () => {
    renderSidebar('OPERATOR');
    expect(screen.queryByText('Integracoes')).not.toBeInTheDocument();
    expect(screen.queryByText('Monitoramento')).not.toBeInTheDocument();
    expect(screen.queryByText('Análise')).not.toBeInTheDocument();
  });

  it('displays user info and branch', () => {
    renderSidebar('ADMIN');
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText(/01 - Filial 01/)).toBeInTheDocument();
  });
});
