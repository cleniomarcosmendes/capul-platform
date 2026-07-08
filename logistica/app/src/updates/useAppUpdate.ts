import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';
import { shouldCheckForUpdate } from './shouldCheckForUpdate';

/**
 * Checa OTA no cold start e a cada foreground-resume (com throttle de 30min).
 * Só sinaliza `updateReady` quando o update foi BAIXADO e está pronto p/ aplicar.
 * Reload é sempre acionado pelo usuário (banner) — nunca automático no meio da entrega.
 */
export function useAppUpdate() {
  const [updateReady, setUpdateReady] = useState(false);
  const [dispensado, setDispensado] = useState(false);
  const lastCheck = useRef<number | null>(null);

  const checar = useCallback(async () => {
    if (!Updates.isEnabled) return; // dev/Expo Go: OTA desligado
    const agora = Date.now();
    if (!shouldCheckForUpdate(lastCheck.current, agora)) return;
    lastCheck.current = agora;
    try {
      const res = await Updates.checkForUpdateAsync();
      if (res.isAvailable) {
        await Updates.fetchUpdateAsync();
        setUpdateReady(true);
      }
    } catch {
      // rede/servidor indisponível: silencioso, tenta de novo no próximo ciclo
    }
  }, []);

  useEffect(() => {
    void checar(); // cold start
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void checar();
    });
    return () => sub.remove();
  }, [checar]);

  const aplicar = useCallback(() => {
    void Updates.reloadAsync();
  }, []);

  const adiar = useCallback(() => setDispensado(true), []);

  return { updateReady: updateReady && !dispensado, aplicar, adiar };
}
