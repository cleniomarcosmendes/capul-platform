import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { rolesDoModulo, temPapel, type UsuarioDoToken as Usuario } from '../lib/roles';
import { authApi } from '../services/api';

interface Contexto {
  usuario: Usuario | null;
  carregando: boolean;
  roles: string[];
  tem: (...alvos: string[]) => boolean;
  /** Sai da plataforma inteira — o token é compartilhado com o Hub. */
  logout: () => void;
}

const AuthContext = createContext<Contexto>({
  usuario: null,
  carregando: true,
  roles: [],
  tem: () => false,
  logout: () => {},
});

/** Lê o payload do JWT que o Hub guardou. Sem validar: quem valida é o backend. */
function lerToken(): Usuario | null {
  const token = localStorage.getItem('accessToken');
  if (!token) return null;
  try {
    const [, payload] = token.split('.');
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const u = lerToken();
    if (!u) {
      window.location.href = '/';
      return;
    }
    setUsuario(u);
    setCarregando(false);
  }, []);

  const valor = useMemo<Contexto>(() => {
    const roles = rolesDoModulo(usuario);
    return {
      usuario,
      carregando,
      roles,
      // ⚠️ A regra mora em `lib/roles.ts`, com spec. Aqui dentro do `useMemo`
      // ela era pura, decisiva e inalcançável por teste — e é ela que decide
      // se um item de menu existe.
      tem: (...alvos) => temPapel(roles, ...alvos),
      /**
       * ⚠️ SAIR AQUI É SAIR DE TUDO. Todos os módulos são servidos da mesma
       * origem (`https://<host>/...`), então dividem o mesmo `localStorage`:
       * limpar o token derruba Hub, Workspace, Inventário, Fiscal e Logística
       * junto. É o comportamento de todos eles, não uma particularidade daqui.
       *
       * ⚠️ E limpar o navegador NÃO BASTA: sem `POST /auth/logout` o refresh
       * token continua VÁLIDO no servidor (o auth-gateway só o revoga nessa
       * rota) e o logout não entra na auditoria. Workspace, Inventário e Fiscal
       * chamam; a Logística não — e é defeito dela, registrado no backlog.
       *
       * A chamada é best-effort de propósito: se ela falhar, sair localmente
       * ainda é o que a pessoa pediu, e travar a saída num erro de rede seria
       * prendê-la numa sessão que ela quer encerrar.
       */
      logout: () => {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) authApi.post('/logout', { refreshToken }).catch(() => {});
        localStorage.clear();
        window.location.href = '/';
      },
    };
  }, [usuario, carregando]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
