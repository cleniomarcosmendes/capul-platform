import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ROLES, rolesDoModulo, type UsuarioDoToken as Usuario } from '../lib/roles';

interface Contexto {
  usuario: Usuario | null;
  carregando: boolean;
  roles: string[];
  tem: (...alvos: string[]) => boolean;
}

const AuthContext = createContext<Contexto>({
  usuario: null,
  carregando: true,
  roles: [],
  tem: () => false,
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
      // ADMIN é bypass de plataforma, como no RolesGuard do backend.
      tem: (...alvos) => roles.includes(ROLES.ADMIN) || alvos.some((a) => roles.includes(a)),
    };
  }, [usuario, carregando]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
