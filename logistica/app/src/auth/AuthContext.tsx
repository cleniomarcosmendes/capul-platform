import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { loginRequest, setAccessToken, setOnAuthFailure } from '../api/client';
import { getDeviceId } from './deviceId';
import { clearTokens, getAccess, getRefresh, saveTokens } from './storage';
import { papelLogistica } from '../lib/jwt';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: Status;
  // Papel na Logística (do JWT) — decide a tela inicial: ENTREGADOR vê entregas;
  // os demais (operador/gestor/frota PADRÃO) veem a Frota.
  role: string | null;
  login: (login: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [role, setRole] = useState<string | null>(null);

  const logout = useCallback(async () => {
    // Vira o estado PRIMEIRO — "Sair" não pode ficar mudo, nem mesmo se o
    // SecureStore travar/demorar (deleteItemAsync já travou no Expo Go Android).
    // A limpeza do keystore vai em segundo plano (fire-and-forget).
    setAccessToken(null);
    setRole(null);
    setStatus('unauthenticated');
    void clearTokens().catch(() => {
      /* keystore some no próximo login de qualquer forma */
    });
  }, []);

  // Boot: carrega tokens do keystore. Sessão é válida se houver REFRESH (30d
  // deslizante) — o access pode estar vencido (15m) que o client renova no
  // 1º request. Refresh morto → o client chama onAuthFailure → logout.
  useEffect(() => {
    setOnAuthFailure(() => {
      void logout();
    });
    (async () => {
      const [access, refresh] = await Promise.all([getAccess(), getRefresh()]);
      setAccessToken(access);
      setRole(papelLogistica(access));
      setStatus(refresh ? 'authenticated' : 'unauthenticated');
    })();
    return () => setOnAuthFailure(null);
  }, [logout]);

  const login = useCallback(async (loginValue: string, senha: string) => {
    const deviceId = await getDeviceId();
    const tokens = await loginRequest(loginValue.trim(), senha, deviceId);
    await saveTokens(tokens.accessToken, tokens.refreshToken);
    setAccessToken(tokens.accessToken);
    setRole(papelLogistica(tokens.accessToken));
    setStatus('authenticated');
  }, []);

  return (
    <AuthContext.Provider value={{ status, role, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
