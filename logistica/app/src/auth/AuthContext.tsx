import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { doRefresh, loginRequest, setAccessToken, setOnAuthFailure } from '../api/client';
import { getDeviceId } from './deviceId';
import { clearTokens, getRefresh, saveTokens } from './storage';
import { papelLogistica, papelInventario, tipoUsuario, departamentoUsuario, filialUsuario, usuarioIdDoToken, nomeUsuario } from '../lib/jwt';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: Status;
  // Papel na Logística (do JWT) — decide a tela inicial: ENTREGADOR vê entregas;
  // os demais (operador/gestor/frota PADRÃO) veem a Frota.
  // Mantém o nome `role` (sem módulo) porque é o que a app inteira já usa; o
  // papel de OUTRO módulo vem em campo próprio.
  role: string | null;
  /** Papel no Inventário (ADMIN | SUPERVISOR | OPERATOR). null = sem acesso ao
   *  módulo — e aí a Contagem nem aparece na Home. */
  roleInventario: string | null;
  /** id do usuário logado — quem lança a despesa não aprova o próprio lançamento. */
  usuarioId: string | null;
  /** Nome de exibição — quem está contando aparece no cabeçalho da contagem. */
  nome: string | null;
  // Tipo do usuário: 'INDIVIDUAL' (pessoa) | 'PADRAO' (login genérico). Decide se
  // a saída de frota pede matrícula+senha (PADRAO) ou usa o próprio login (INDIVIDUAL).
  tipo: string | null;
  // Departamento (lotação) e filial do login — usados como filtro PADRÃO da
  // saída de frota (nasce no setor do usuário; ele pode escolher outro).
  departamentoId: string | null;
  filialId: string | null;
  login: (login: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [role, setRole] = useState<string | null>(null);
  const [roleInventario, setRoleInventario] = useState<string | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [nome, setNome] = useState<string | null>(null);
  const [tipo, setTipo] = useState<string | null>(null);
  const [departamentoId, setDepartamentoId] = useState<string | null>(null);
  const [filialId, setFilialId] = useState<string | null>(null);

  // Deriva role/tipo/departamento/filial de um access token (ou limpa, se null).
  const aplicarToken = useCallback((access: string | null) => {
    setRole(papelLogistica(access));
    setRoleInventario(papelInventario(access));
    setUsuarioId(usuarioIdDoToken(access));
    setNome(nomeUsuario(access));
    setTipo(tipoUsuario(access));
    setDepartamentoId(departamentoUsuario(access));
    setFilialId(filialUsuario(access));
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
    <AuthContext.Provider value={{ status, role, roleInventario, usuarioId, nome, tipo, departamentoId, filialId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
