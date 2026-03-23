import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { authApi } from '../services/api';
import type { UsuarioLogado } from '../types';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos

interface AuthContextType {
  usuario: UsuarioLogado | null;
  loading: boolean;
  configuradorRole: string | null;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const configuradorRole = usuario?.modulos.find((m) => m.codigo === 'CONFIGURADOR')?.role ?? null;

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
        localStorage.clear();
        setUsuario(null);
        setSessionExpired(true);
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
    <AuthContext.Provider value={{ usuario, loading, configuradorRole, refreshUser, logout }}>
      {children}
      {sessionExpired && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">Sessao Expirada</h2>
            <p className="text-sm text-slate-500 mb-6">Sua sessao expirou por inatividade. Faca login novamente para continuar.</p>
            <button
              onClick={() => { window.location.href = '/login'; }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
            >
              Fazer Login
            </button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
