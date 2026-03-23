import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { authService } from '../services/auth.service';
import type { UsuarioLogado } from '../types';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos

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
  const [sessionExpired, setSessionExpired] = useState(false);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

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
      if (response.mfaRequired) {
        // Lançar com mfaToken para o LoginPage tratar
        const err = new Error('MFA_REQUIRED');
        (err as any).mfaToken = response.mfaToken;
        throw err;
      }
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

  // Timeout de inatividade
  const resetInactivityTimer = useCallback(() => {
    clearTimeout(inactivityTimer.current);
    if (authService.isAuthenticated()) {
      inactivityTimer.current = setTimeout(() => {
        authService.logout();
        setUsuario(null);
        setSessionExpired(true);
      }, INACTIVITY_TIMEOUT);
    }
  }, []);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => document.addEventListener(e, resetInactivityTimer));
    resetInactivityTimer();
    return () => {
      events.forEach((e) => document.removeEventListener(e, resetInactivityTimer));
      clearTimeout(inactivityTimer.current);
    };
  }, [resetInactivityTimer]);

  return (
    <AuthContext.Provider
      value={{ usuario, loading, login, logout, switchFilial, refreshUser }}
    >
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
