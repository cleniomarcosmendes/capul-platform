import { useCallback, useEffect, useState } from 'react';
import { fiscalApi } from '../services/api';
import type { SefazCaStatus } from '../types';

/**
 * Hook que consulta o status da cadeia TLS SEFAZ e expõe:
 *  - `status` — último snapshot (ou null enquanto carrega)
 *  - `loading` — true durante fetch inicial
 *  - `error` — mensagem amigável se falhar
 *  - `reload()` — força nova busca
 *
 * Usa polling leve de 5 minutos. Compartilhado entre Header, Dashboard
 * e AdminPage — o polling NÃO é deduplicado (cada uso tem seu próprio
 * timer); como o endpoint é rápido e o número de instâncias é pequeno
 * (no máximo 2 em tela), é aceitável.
 */
export function useSefazCaStatus(pollMs = 5 * 60 * 1000) {
  const [status, setStatus] = useState<SefazCaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const { data } = await fiscalApi.get<SefazCaStatus>('/sefaz/ca/status');
      setStatus(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    const interval = setInterval(reload, pollMs);
    return () => clearInterval(interval);
  }, [reload, pollMs]);

  return { status, loading, error, reload };
}
