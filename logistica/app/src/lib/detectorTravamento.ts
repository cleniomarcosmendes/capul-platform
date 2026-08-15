import { useEffect } from 'react';

/**
 * 🔬 Detector de travamento da thread de JS — só em desenvolvimento.
 *
 * Por que existe: em 14/08 eu conclui "thread saudavel" porque um contador de
 * 500ms tinha chegado a 597. Isso nao prova nada — contei tiques sem saber
 * quanto tempo real havia passado. Se a thread trava, o tique simplesmente
 * ATRASA, e a contagem final continua parecendo razoavel.
 *
 * Aqui o que se mede e o ATRASO: quanto o tique demorou alem do previsto. Nao
 * renderiza nada (nenhum `setState`, nenhuma faixa na tela) — instrumento em
 * caminho de gesto ou de render altera o que deveria medir, erro que ja custou
 * uma rodada de teste.
 *
 * Leitura no terminal do Metro:
 *   sem linha nenhuma  → a thread de JS NAO trava; o problema e do lado nativo
 *                        (UI/render) ou do ambiente (Expo Go, economia de bateria)
 *   linhas de 1s, 3s…  → a thread trava mesmo, e o tamanho diz o quanto
 */
export function useDetectorDeTravamento(rotulo: string, limiteMs = 400): void {
  useEffect(() => {
    if (!__DEV__) return;
    const INTERVALO = 500;
    let anterior = Date.now();
    const id = setInterval(() => {
      const agora = Date.now();
      const atraso = agora - anterior - INTERVALO;
      anterior = agora;
      if (atraso > limiteMs) {
        // `log`, nunca `warn`: warn cai no LogBox, que simboliza a pilha
        // consultando o Metro — caro justamente quando algo ja esta lento.
        console.log(`[TRAVOU] ${rotulo}: a thread de JS ficou ${atraso}ms parada`);
      }
    }, INTERVALO);
    return () => clearInterval(id);
  }, [rotulo, limiteMs]);
}
