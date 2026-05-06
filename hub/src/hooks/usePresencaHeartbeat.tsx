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
 * estiver visivel. Aba em background nao envia heartbeat → usuario some
 * da lista de "online" em ~2min sem precisar de logout explicito.
 *
 * Retorna o aviso ativo da plataforma (se houver).
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
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      try {
        const { data } = await authApi.post<HeartbeatResponse>('/heartbeat');
        setAviso(data.aviso ?? null);
      } catch {
        // silenciar
      }
    }

    tick();
    intervalRef.current = setInterval(tick, HEARTBEAT_INTERVAL_MS);

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') tick();
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
 * Banner de aviso da plataforma — fixo no topo, dispensavel pelo usuario.
 */
export function AvisoPlataformaBanner({ aviso }: { aviso: AvisoAtivo | null }): ReactNode {
  const [dispensado, setDispensado] = useState<string | null>(null);

  if (!aviso) return null;
  if (dispensado === aviso.criadoEm) return null;

  const ate = new Date(aviso.ate);
  const agora = new Date();
  const minRestantes = Math.max(0, Math.round((ate.getTime() - agora.getTime()) / 60000));

  return (
    <div className="bg-amber-500 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-start gap-3">
        <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="flex-1 text-sm">
          <p className="font-medium">Aviso da plataforma</p>
          <p className="mt-0.5 whitespace-pre-wrap">{aviso.mensagem}</p>
          <p className="mt-1 text-xs text-amber-100">
            Visível por mais ~{minRestantes} min · enviado{' '}
            {new Date(aviso.criadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDispensado(aviso.criadoEm)}
          className="text-amber-100 hover:text-white"
          title="Dispensar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
