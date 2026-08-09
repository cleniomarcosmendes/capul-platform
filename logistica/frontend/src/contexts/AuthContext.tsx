import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi } from '../services/api';

export interface ModuloDepartamentoUsuario {
  id: string;
  nome: string;
  role: string;
}
export interface ModuloUsuario {
  codigo: string;
  /**
   * ⚠️ DENORMALIZADA: role do PRIMEIRO item de `departamentos[]`, mantida pelo Auth
   * Gateway só por retrocompatibilidade. A permissão real é (usuário × módulo ×
   * DEPARTAMENTO × role), então a mesma pessoa pode ter papéis diferentes em
   * departamentos diferentes. Use `logisticaRoles` do contexto, não este campo.
   */
  role: string;
  /** Ausente em respostas antigas → o contexto cai em `role`. */
  departamentos?: ModuloDepartamentoUsuario[];
}
export interface FilialResumo {
  id: string;
  codigo?: string;
  nome?: string;
}
export interface UsuarioLogado {
  id: string;
  nome: string;
  email?: string;
  modulos: ModuloUsuario[];
  filialAtual?: FilialResumo | null;
  filiais?: FilialResumo[];
  // Tipo do login (do JWT): 'INDIVIDUAL' (pessoa) | 'PADRAO' (login genérico/caixa).
  tipo?: string | null;
  // Departamento do usuário (do JWT) — default do "departamento solicitante".
  departamentoId?: string | null;
  departamentoNome?: string | null;
}

interface AuthContextType {
  usuario: UsuarioLogado | null;
  loading: boolean;
  /**
   * TODOS os papéis do usuário no módulo LOGISTICA (vazio = sem acesso).
   * São vários porque a permissão é por DEPARTAMENTO: a mesma pessoa pode ser
   * SUPERVISOR_FROTA no departamento dela e GESTOR_ENTREGA em outro.
   */
  logisticaRoles: string[];
  /** Tem QUALQUER um destes papéis? É o substituto de `logisticaRole === 'X'`. */
  temRole: (...alvos: string[]) => boolean;
  logout: () => void;
}

/** Lê o `tipo` (INDIVIDUAL/PADRAO) direto do access token (JWT). */
/** Campos que só existem no JWT (o /me não os devolve): tipo do login e o
 *  departamento do usuário — este último pré-seleciona o "departamento
 *  solicitante" da saída de veículo, que vinha em branco em 87% das viagens. */
function dadosDoToken(token: string | null): { tipo: string | null; departamentoId: string | null; departamentoNome: string | null } {
  const vazio = { tipo: null, departamentoId: null, departamentoNome: null };
  if (!token) return vazio;
  try {
    const p = token.split('.')[1];
    if (!p) return vazio;
    const c = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
    return {
      tipo: c.tipo ?? null,
      departamentoId: c.departamentoId ?? null,
      departamentoNome: c.departamentoNome ?? null,
    };
  } catch {
    return vazio;
  }
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      window.location.href = '/';
      return;
    }
    authApi
      .get<UsuarioLogado>('/me')
      .then((r) => setUsuario({ ...r.data, ...dadosDoToken(token) }))
      .catch(() => {
        localStorage.removeItem('accessToken');
        window.location.href = '/';
      })
      .finally(() => setLoading(false));
  }, []);

  // Multi-role: junta os papéis de TODOS os departamentos onde a pessoa tem
  // permissão na Logística. Resposta antiga (sem `departamentos[]`) → cai no campo
  // denormalizado, que é o que existia antes. Espelha `rolesLogistica()` do backend.
  const mod = usuario?.modulos.find((m) => m.codigo === 'LOGISTICA');
  const deDeptos = (mod?.departamentos ?? []).map((d) => d.role).filter(Boolean);
  const logisticaRoles = mod ? [...new Set(deDeptos.length ? deDeptos : (mod.role ? [mod.role] : []))] : [];
  const temRole = (...alvos: string[]) => alvos.some((a) => logisticaRoles.includes(a));

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ usuario, loading, logisticaRoles, temRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
