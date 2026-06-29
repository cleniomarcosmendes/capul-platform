import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import { authApi, coreApi, fiscalApi } from '../services/api';
import type { UsuarioLogado, RoleFiscal } from '../types';

// Default 60min se o usuário não tiver preferência configurada (Configurador →
// Usuário → Sessão & Segurança). `null` = "manter sempre conectado".
const DEFAULT_INACTIVITY_MS = 60 * 60 * 1000;

interface AuthContextType {
  usuario: UsuarioLogado | null;
  loading: boolean;
  fiscalRole: RoleFiscal | null;
  /** Capability LGPD p/ ver sócio (F3). null = ainda resolvendo. */
  socioPermitido: boolean | null;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [loading, setLoading] = useState(true);
  // ms até deslogar por inatividade. null = nunca (preferência "sempre conectado").
  const [inactivityMs, setInactivityMs] = useState<number | null>(DEFAULT_INACTIVITY_MS);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fiscalRole =
    (usuario?.modulos.find((m) => m.codigo === 'FISCAL')?.role as RoleFiscal | undefined) ?? null;

  // Capability de sócio (LGPD) — não vem no JWT (D3); resolve via backend
  // (lê core cacheado). null enquanto resolve.
  // Refetch (29/05): a capability é gerenciada externamente (Configurador → Operação)
  // — se o admin concede DURANTE a sessão de outro user, ele não sabia até relogar.
  // Re-buscar quando a aba volta a ficar visível (visibilitychange) cobre o caso
  // sem custo significativo (1 request curto por foco). Não escolhemos refetch
  // periódico pra não criar tráfego ocioso.
  const [socioPermitido, setSocioPermitido] = useState<boolean | null>(null);
  useEffect(() => {
    const temFiscal = !!usuario?.modulos.some((m) => m.codigo === 'FISCAL');
    if (!temFiscal) { setSocioPermitido(null); return; }
    let cancel = false;
    const fetchCap = () => {
      fiscalApi
        .get<{ permitido: boolean }>('/rfb/socios/capability')
        .then((r) => { if (!cancel) setSocioPermitido(!!r.data?.permitido); })
        .catch(() => { if (!cancel) setSocioPermitido(false); });
    };
    fetchCap();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchCap();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancel = true;
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [usuario]);

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

  const resetInactivityTimer = useCallback(() => {
    clearTimeout(inactivityTimer.current);
    if (inactivityMs === null) return; // "sempre conectado" — não arma timer
    if (localStorage.getItem('accessToken')) {
      inactivityTimer.current = setTimeout(() => {
        localStorage.clear();
        setUsuario(null);
        window.location.href = '/login';
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
    <AuthContext.Provider value={{ usuario, loading, fiscalRole, socioPermitido, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook/helper colocado ao provider/componente; disable do Fast Refresh.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa de AuthProvider');
  return ctx;
}

// Hook/helper colocado ao provider/componente; disable do Fast Refresh.
// eslint-disable-next-line react-refresh/only-export-components
export function hasMinRole(userRole: RoleFiscal | null, min: RoleFiscal): boolean {
  if (!userRole) return false;
  const hierarchy: Record<RoleFiscal, number> = {
    OPERADOR_ENTRADA: 1,
    ANALISTA_CADASTRO: 2,
    GESTOR_FISCAL: 3,
    ADMIN_TI: 4,
  };
  return hierarchy[userRole] >= hierarchy[min];
}
