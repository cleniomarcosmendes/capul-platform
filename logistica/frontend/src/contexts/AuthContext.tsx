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
}

interface AuthContextType {
  usuario: UsuarioLogado | null;
  loading: boolean;
  /** Role do usuário no módulo LOGISTICA (ou null se não tem acesso). */
  logisticaRole: string | null;
  logout: () => void;
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
      .then((r) => setUsuario(r.data))
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
