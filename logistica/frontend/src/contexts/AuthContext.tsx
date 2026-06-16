import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi } from '../services/api';

export interface ModuloUsuario {
  codigo: string;
  role: string;
}
export interface FilialResumo {
  id: string;
  codigo?: string;
  nome?: string;
}
export interface UsuarioLogado {
  id: string;
  nome: string;
  email?: string;
  modulos: ModuloUsuario[];
  filialAtual?: FilialResumo | null;
  filiais?: FilialResumo[];
  // Tipo do login (do JWT): 'INDIVIDUAL' (pessoa) | 'PADRAO' (login genérico/caixa).
  tipo?: string | null;
}

interface AuthContextType {
  usuario: UsuarioLogado | null;
  loading: boolean;
  /** Role do usuário no módulo LOGISTICA (ou null se não tem acesso). */
  logisticaRole: string | null;
  logout: () => void;
}

/** Lê o `tipo` (INDIVIDUAL/PADRAO) direto do access token (JWT). */
function tipoDoToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const p = token.split('.')[1];
    if (!p) return null;
    return JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/'))).tipo ?? null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      window.location.href = '/';
      return;
    }
    authApi
      .get<UsuarioLogado>('/me')
      .then((r) => setUsuario({ ...r.data, tipo: tipoDoToken(token) }))
      .catch(() => {
        localStorage.removeItem('accessToken');
        window.location.href = '/';
      })
      .finally(() => setLoading(false));
  }, []);

  const logisticaRole = usuario?.modulos.find((m) => m.codigo === 'LOGISTICA')?.role ?? null;

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ usuario, loading, logisticaRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
