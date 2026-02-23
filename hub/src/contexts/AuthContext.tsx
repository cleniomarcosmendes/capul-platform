import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { authService } from '../services/auth.service';
import type { UsuarioLogado } from '../types';

interface AuthContextType {
  usuario: UsuarioLogado | null;
  loading: boolean;
  login: (login: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
  switchFilial: (filialId: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(
    authService.getUsuarioLocal,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authService.isAuthenticated() && !usuario) {
      authService
        .me()
        .then(setUsuario)
        .catch(() => {
          authService.logout();
          setUsuario(null);
        });
    }
  }, []);

  const login = useCallback(async (loginStr: string, senha: string) => {
    setLoading(true);
    try {
      const response = await authService.login(loginStr, senha);
      setUsuario(response.usuario);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUsuario(null);
  }, []);

  const switchFilial = useCallback(async (filialId: string) => {
    const response = await authService.switchFilial(filialId);
    setUsuario((prev) =>
      prev ? { ...prev, filialAtual: response.filialAtual } : null,
    );
  }, []);

  const refreshUser = useCallback(async () => {
    const data = await authService.me();
    setUsuario(data);
  }, []);

  return (
    <AuthContext.Provider
      value={{ usuario, loading, login, logout, switchFilial, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
