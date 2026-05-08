import { useEffect, useRef, useState, type ReactNode } from 'react';
import { authApi } from '../services/api';

interface AvisoAtivo {
  mensagem: string;
  criadoEm: string;
  ate: string;
}

interface HeartbeatResponse {
  aviso: AvisoAtivo | null;
}

const HEARTBEAT_INTERVAL_MS = 60_000;

/**
 * Hook de presenca — chama POST /auth/heartbeat a cada 60s enquanto a aba
 * estiver visivel (`document.visibilityState === 'visible'`). Aba em
 * background nao envia heartbeat → usuario some da lista de "online" em
 * ~2min sem precisar de logout explicito.
 *
 * Retorna o aviso ativo da plataforma (se houver) — frontend usa pra
 * exibir banner global.
 *
 * Pre-requisito: usuario autenticado (interceptor do authApi anexa Bearer).
 * Se chamada falhar (rede, 401, etc), degrada silenciosamente — heartbeat
 * nao deve quebrar a UI.
 */
export function usePresencaHeartbeat(autenticado: boolean): {
  aviso: AvisoAtivo | null;
} {
  const [aviso, setAviso] = useState<AvisoAtivo | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!autenticado) {
      setAviso(null);
      return;
    }

    async function tick() {
      // Pula heartbeat se aba estiver em background — economiza chamada
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      try {
        const { data } = await authApi.post<HeartbeatResponse>('/heartbeat');
        setAviso(data.aviso ?? null);
      } catch {
        // Silenciar — heartbeat nao deve poluir UI com erros
      }
    }

    // Primeira chamada imediata, depois a cada 60s
    tick();
    intervalRef.current = setInterval(tick, HEARTBEAT_INTERVAL_MS);

    // Quando aba volta a ficar visivel, dispara heartbeat fora do ciclo
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        tick();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [autenticado]);

  return { aviso };
}

/**
 * Banner de aviso da plataforma — fixo no topo, dispensavel pelo usuario
 * (volta na proxima atualizacao do heartbeat se ainda estiver ativo).
 */
export function AvisoPlataformaBanner({ aviso }: { aviso: AvisoAtivo | null }): ReactNode {
  const [dispensado, setDispensado] = useState<string | null>(null);

  if (!aviso) return null;
  // Identifica aviso por `criadoEm` — se um novo aviso vier, banner volta
  if (dispensado === aviso.criadoEm) return null;

  const ate = new Date(aviso.ate);
  const agora = new Date();
  const minRestantes = Math.max(0, Math.round((ate.getTime() - agora.getTime()) / 60000));

  return (
    <div className="bg-amber-500 text-white shadow-md">
      <div className="px-6 py-4 flex items-start gap-4">
        <svg
          className="w-6 h-6 mt-0.5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-50">Aviso da plataforma</p>
          <p className="mt-1 text-lg font-semibold leading-snug whitespace-pre-wrap">{aviso.mensagem}</p>
          <p className="mt-2 text-sm text-amber-50/90">
            Visível por mais ~{minRestantes} min · enviado em{' '}
            {new Date(aviso.criadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDispensado(aviso.criadoEm)}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-amber-600/40 hover:bg-amber-600/70 transition-colors"
          title="Dispensar este aviso"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Dispensar
        </button>
      </div>
    </div>
  );
}
