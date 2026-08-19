import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { sincronizarTudo } from './sincronizar';

/**
 * Tenta esvaziar as filas toda vez que o app volta ao primeiro plano.
 *
 * É o gesto de quem trabalha dias fora: tira o aparelho do bolso ao chegar num
 * ponto com sinal. Antes, a sincronização só acontecia ao FOCAR uma tela — quem
 * ficava na mesma tela a manhã inteira atravessava a área com cobertura sem
 * subir nada, e voltava a ficar sem sinal com a fila intacta.
 *
 * Sem `NetInfo` de propósito: é módulo NATIVO e exigiria APK novo (esta onda
 * inteira vai por OTA). Voltar ao primeiro plano cobre o caso real; e uma
 * tentativa sem sinal custa uma falha rápida, não trava nada — a sincronização
 * é single-flight dentro de cada fila.
 */
export function useSincronizacaoAoVoltar(ativo: boolean): void {
  useEffect(() => {
    if (!ativo) return;
    const sub = AppState.addEventListener('change', (estado: AppStateStatus) => {
      if (estado === 'active') void sincronizarTudo();
    });
    return () => sub.remove();
  }, [ativo]);
}
