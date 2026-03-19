import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { authApi } from '../services/api';
import type { UsuarioLogado } from '../types';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos

interface AuthContextType {
  usuario: UsuarioLogado | null;
  loading: boolean;
  inventarioRole: string | null;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [loading, setLoading] = useState(true);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const inventarioRole = usuario?.modulos.find((m) => m.codigo === 'INVENTARIO')?.role ?? null;

  async function refreshUser() {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setUsuario(null);
        setLoading(false);
        return;
      }
      const { data } = await authApi.get('/me');
      setUsuario(data);
    } catch {
      setUsuario(null);
      localStorage.clear();
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      authApi.post('/logout', { refreshToken }).catch(() => {});
    }
    localStorage.clear();
    setUsuario(null);
    window.location.href = '/login';
  }

  // Timeout de inatividade
  const resetInactivityTimer = useCallback(() => {
    clearTimeout(inactivityTimer.current);
    if (localStorage.getItem('accessToken')) {
      inactivityTimer.current = setTimeout(() => {
        alert('Sessao expirada por inatividade. Faca login novamente.');
        logout();
      }, INACTIVITY_TIMEOUT);
    }
  }, []);

  useEffect(() => {
    refreshUser();
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => document.addEventListener(e, resetInactivityTimer));
    resetInactivityTimer();
    return () => {
      events.forEach((e) => document.removeEventListener(e, resetInactivityTimer));
      clearTimeout(inactivityTimer.current);
    };
  }, [resetInactivityTimer]);

  return (
    <AuthContext.Provider value={{ usuario, loading, inventarioRole, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
