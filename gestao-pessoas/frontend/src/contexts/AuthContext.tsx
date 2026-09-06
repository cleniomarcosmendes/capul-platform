import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

interface Usuario {
  sub: string;
  nome?: string;
  email?: string;
}

const AuthContext = createContext<{ usuario: Usuario | null; carregando: boolean }>({
  usuario: null,
  carregando: true,
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

  const valor = useMemo(() => ({ usuario, carregando }), [usuario, carregando]);
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
