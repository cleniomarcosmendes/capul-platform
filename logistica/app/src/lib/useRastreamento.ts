import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { enviarPosicao } from '../api/rastreamento';
import { iniciarBackground, pararBackground } from '../tracking/backgroundLocation';
import { garantirPermissaoLocalizacao } from './permissaoLocalizacao';

/**
 * Rastreamento em tempo real (Fase A — FOREGROUND).
 *
 * Enquanto a viagem está em curso E a tela está montada, observa o GPS e envia
 * pings ao backend (~a cada 25s ou 150m). Para automaticamente ao desmontar a
 * tela / fechar a viagem (cleanup do efeito). É foreground: se o entregador
 * fechar o app, os pings param até reabrir — limite conhecido da Fase A.
 *
 * LGPD: pede permissão de localização (consentimento via diálogo do SO); o
 * backend só grava com a viagem EM_CURSO. A tela mostra um aviso visível
 * ("localização ativa") enquanto rastreia.
 */
export function useRastreamento(viagemId: string, ativo: boolean): { rastreando: boolean } {
  const [rastreando, setRastreando] = useState(false);
  const subRef = useRef<Location.LocationSubscription | null>(null);
  const bgRef = useRef(false);

  useEffect(() => {
    let cancelado = false;

    async function iniciar() {
      if (!ativo || !viagemId) return;
      // Fase B: tenta o background (app fechado) — só funciona em build
      // standalone. Em Expo Go retorna false e caímos no foreground (Fase A).
      try {
        const ok = await iniciarBackground(viagemId);
        if (ok) {
          if (cancelado) {
            void pararBackground();
            return;
          }
          bgRef.current = true;
          setRastreando(true);
          return;
        }
      } catch {
        /* sem suporte a background: segue pro foreground */
      }
      try {
        // Fonte única da permissão. O pedido normal acontece no KM de saída; se
        // por algum caminho ainda não tiver sido decidido, aqui pergunta uma vez.
        if (!(await garantirPermissaoLocalizacao()) || cancelado) return;
        subRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 25_000, distanceInterval: 150 },
          (pos) => {
            if (cancelado) return;
            setRastreando(true);
            const c = pos.coords;
            void enviarPosicao(viagemId, {
              latitude: c.latitude,
              longitude: c.longitude,
              precisao: c.accuracy ?? undefined,
              velocidade: c.speed != null && c.speed >= 0 ? c.speed : undefined,
              capturadoEm: new Date(pos.timestamp).toISOString(),
            }).catch(() => {
              /* best-effort: ping perdido (sem sinal) não trava a operação */
            });
          },
        );
      } catch {
        /* sem permissão/sem GPS: segue sem rastrear, não atrapalha a entrega */
      }
    }

    void iniciar();
    return () => {
      cancelado = true;
      subRef.current?.remove();
      subRef.current = null;
      if (bgRef.current) {
        bgRef.current = false;
        void pararBackground();
      }
      setRastreando(false);
    };
  }, [viagemId, ativo]);

  return { rastreando };
}
