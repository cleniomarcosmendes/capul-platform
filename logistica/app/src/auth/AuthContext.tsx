import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { doRefresh, loginRequest, setAccessToken, setOnAuthFailure } from '../api/client';
import { getDeviceId } from './deviceId';
import { clearTokens, getRefresh, saveTokens } from './storage';
import { papelLogistica, tipoUsuario, departamentoUsuario } from '../lib/jwt';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: Status;
  // Papel na Logística (do JWT) — decide a tela inicial: ENTREGADOR vê entregas;
  // os demais (operador/gestor/frota PADRÃO) veem a Frota.
  role: string | null;
  // Tipo do usuário: 'INDIVIDUAL' (pessoa) | 'PADRAO' (login genérico). Decide se
  // a saída de frota pede matrícula+senha (PADRAO) ou usa o próprio login (INDIVIDUAL).
  tipo: string | null;
  // Departamento (lotação) — filtra os veículos na saída de frota.
  departamentoId: string | null;
  login: (login: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [role, setRole] = useState<string | null>(null);
  const [tipo, setTipo] = useState<string | null>(null);
  const [departamentoId, setDepartamentoId] = useState<string | null>(null);

  // Deriva role/tipo/departamento de um access token (ou limpa, se null).
  const aplicarToken = useCallback((access: string | null) => {
    setRole(papelLogistica(access));
    setTipo(tipoUsuario(access));
    setDepartamentoId(departamentoUsuario(access));
  }, []);

  const logout = useCallback(async () => {
    // Vira o estado PRIMEIRO — "Sair" não pode ficar mudo, nem mesmo se o
    // SecureStore travar/demorar (deleteItemAsync já travou no Expo Go Android).
    // A limpeza do keystore vai em segundo plano (fire-and-forget).
    setAccessToken(null);
    aplicarToken(null);
    setStatus('unauthenticated');
    void clearTokens().catch(() => {
      /* keystore some no próximo login de qualquer forma */
    });
  }, [aplicarToken]);

  // Boot: a sessão é válida se houver REFRESH (30d deslizante). NÃO confiamos só
  // no access salvo (pode estar ausente/vencido) — renovamos no boot para ter
  // access E role frescos já na 1ª tela (senão a role vinha null → lançador
  // marcava tudo "sem permissão"). Sem rede, cai no access salvo; refresh morto
  // → logout.
  useEffect(() => {
    setOnAuthFailure(() => {
      void logout();
    });
    (async () => {
      const refresh = await getRefresh();
      if (!refresh) {
        setAccessToken(null);
        setStatus('unauthenticated');
        return;
      }
      // Renova SEMPRE no boot — o access salvo pode ser de uma sessão antiga sem
      // `modulos` (role viria null). Se o refresh falhar (sessão velha/inválida),
      // NÃO caímos num access-lixo: limpamos e mostramos o login.
      const access = await doRefresh().catch(() => null);
      if (!access) {
        await clearTokens().catch(() => {});
        setAccessToken(null);
        aplicarToken(null);
        setStatus('unauthenticated');
        return;
      }
      setAccessToken(access);
      aplicarToken(access);
      setStatus('authenticated');
    })();
    return () => setOnAuthFailure(null);
  }, [logout, aplicarToken]);

  const login = useCallback(async (loginValue: string, senha: string) => {
    const deviceId = await getDeviceId();
    const tokens = await loginRequest(loginValue.trim(), senha, deviceId);
    await saveTokens(tokens.accessToken, tokens.refreshToken);
    setAccessToken(tokens.accessToken);
    aplicarToken(tokens.accessToken);
    setStatus('authenticated');
  }, [aplicarToken]);

  return (
    <AuthContext.Provider value={{ status, role, tipo, departamentoId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
