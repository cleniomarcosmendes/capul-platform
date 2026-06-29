import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { authApi, coreApi } from '../services/api';
import { isWorkspaceModulo } from '../lib/workspace-modulo';
import type { UsuarioLogado } from '../types';

// Default 60min se o usuário não tiver preferência configurada (Configurador →
// Usuário → Sessão & Segurança). `null` = "manter sempre conectado".
const DEFAULT_INACTIVITY_MS = 60 * 60 * 1000;

interface AuthContextType {
  usuario: UsuarioLogado | null;
  loading: boolean;
  gestaoTiRole: string | null;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  // ms até deslogar por inatividade. null = nunca (preferência "sempre conectado").
  const [inactivityMs, setInactivityMs] = useState<number | null>(DEFAULT_INACTIVITY_MS);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const gestaoTiRole = usuario?.modulos.find((m) => isWorkspaceModulo(m.codigo))?.role ?? null;

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

      try {
        const { data: prefs } = await coreApi.get('/usuarios/me/preferencias');
        const raw = prefs?.inactivityTimeoutMin;
        if (raw === 'never') setInactivityMs(null);
        else if (typeof raw === 'number' && [30, 60, 120, 240].includes(raw))
          setInactivityMs(raw * 60 * 1000);
        else setInactivityMs(DEFAULT_INACTIVITY_MS);
      } catch {
        setInactivityMs(DEFAULT_INACTIVITY_MS);
      }
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

  // Timeout de inatividade — logout apos 30min sem interacao
  const resetInactivityTimer = useCallback(() => {
    clearTimeout(inactivityTimer.current);
    if (inactivityMs === null) return; // "sempre conectado" — não arma timer
    if (localStorage.getItem('accessToken')) {
      inactivityTimer.current = setTimeout(() => {
        localStorage.clear();
        setUsuario(null);
        setSessionExpired(true);
      }, inactivityMs);
    }
  }, [inactivityMs]);

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
    <AuthContext.Provider value={{ usuario, loading, gestaoTiRole, refreshUser, logout }}>
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
              className="w-full bg-capul-600 hover:bg-capul-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
            >
              Fazer Login
            </button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

// Hook/helper colocado ao provider/componente; disable do Fast Refresh.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
