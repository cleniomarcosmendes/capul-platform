import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { isWorkspaceModulo } from '../lib/workspace-modulo';

/**
 * S15.3 (25/05) — Workspace ATIVO da sessão.
 *
 * Pra users multi-perfil (Juliana = GESTOR/CTL + USUARIO_FINAL/T.I.), permite
 * trocar entre workspaces sem precisar relogar. O ID escolhido vai como header
 * `X-Workspace-Id` em todas as requests (via interceptor em api.ts).
 *
 * Backend (S15.1+S15.2): se header set → filtra só nesse depto; senão →
 * fallback comportamento atual (vê união de todos os perfis, S12/S13/S14).
 *
 * Persistência: localStorage chaveado por user.id (cada usuário tem sua
 * última escolha). Single-perfil: auto-set no único depto, sem UI.
 */

export interface WorkspaceOption {
  id: string;
  nome: string;
  role: string;
  isTI?: boolean;
}

interface WorkspaceContextType {
  workspaceAtivoId: string | null;
  workspaces: WorkspaceOption[];
  isMultiPerfil: boolean;
  setWorkspaceAtivo: (id: string | null) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

const LS_KEY = (userId: string) => `workspaceAtivoId:${userId}`;

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();

  // Lista de workspaces do user a partir do JWT modulos[WORKSPACE].departamentos[].
  const workspaces: WorkspaceOption[] = useMemo(() => {
    if (!usuario) return [];
    const mod = usuario.modulos.find((m) => isWorkspaceModulo(m.codigo));
    return (mod?.departamentos ?? []).map((d) => ({
      id: d.id,
      nome: d.nome,
      role: d.role,
      isTI: (d as { isTI?: boolean }).isTI,
    }));
  }, [usuario]);

  const isMultiPerfil = workspaces.length > 1;

  // State inicial: tenta localStorage; senão (single-perfil) auto-set; senão null.
  const [workspaceAtivoId, setWorkspaceAtivoIdState] = useState<string | null>(() => {
    if (!usuario) return null;
    const saved = localStorage.getItem(LS_KEY(usuario.id));
    if (saved && workspaces.some((w) => w.id === saved)) return saved;
    // Single-perfil: auto-set (não tem UI de troca, dá fallback explícito).
    if (workspaces.length === 1) return workspaces[0].id;
    // Multi-perfil sem escolha prévia: null → backend usa fallback S12/S13/S14
    // até o user escolher manualmente no WorkspaceSwitcher.
    return null;
  });

  // Re-sync quando usuário/workspaces mudam (ex: login/logout).
  useEffect(() => {
    if (!usuario) {
      setWorkspaceAtivoIdState(null);
      return;
    }
    const saved = localStorage.getItem(LS_KEY(usuario.id));
    if (saved && workspaces.some((w) => w.id === saved)) {
      setWorkspaceAtivoIdState(saved);
    } else if (workspaces.length === 1) {
      setWorkspaceAtivoIdState(workspaces[0].id);
    } else {
      setWorkspaceAtivoIdState(null);
    }
  }, [usuario, workspaces]);

  function setWorkspaceAtivo(id: string | null) {
    setWorkspaceAtivoIdState(id);
    if (!usuario) return;
    if (id === null) {
      localStorage.removeItem(LS_KEY(usuario.id));
    } else {
      localStorage.setItem(LS_KEY(usuario.id), id);
    }
  }

  return (
    <WorkspaceContext.Provider value={{ workspaceAtivoId, workspaces, isMultiPerfil, setWorkspaceAtivo }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextType {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace deve ser usado dentro de <WorkspaceProvider>');
  return ctx;
}

/**
 * Helper estático pro axios interceptor — lê o workspace ativo do localStorage
 * a partir do user atual (precisa do user.id que vem do JWT decodificado).
 * Retorna null se: sem token, sem user, sem ativo salvo.
 */
export function getWorkspaceAtivoFromStorage(): string | null {
  try {
    const tok = localStorage.getItem('accessToken');
    if (!tok) return null;
    const payload = JSON.parse(atob(tok.split('.')[1]));
    const userId = payload?.sub;
    if (!userId) return null;
    return localStorage.getItem(LS_KEY(userId));
  } catch {
    return null;
  }
}
