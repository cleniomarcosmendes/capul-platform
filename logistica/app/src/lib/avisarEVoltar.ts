import { Alert, InteractionManager } from 'react-native';

/**
 * Avisa e volta — nesta ordem, e é a ordem que importa.
 *
 * ⭐ NUNCA chame `navigation.goBack()` de dentro do `onPress` de um `Alert`.
 *
 * Por quê (apurado em 14/08/2026, com o Clenio testando no aparelho): o
 * `Alert.alert(..., [{ text: 'OK', onPress: () => navigation.goBack() }])`
 * dispara a saída da tela DE DENTRO do callback do diálogo nativo do Android —
 * ou seja, com a janela do diálogo ainda se desfazendo e ainda com o foco. A
 * transição do `native-stack` começa nesse meio, e a tela de baixo volta
 * **renderizando normalmente mas sem receber toque nenhum**.
 *
 * O sintoma é cruel de diagnosticar, porque parece travamento e não é: medido na
 * tela, o contador de 500ms continuava andando (thread de JS viva, React
 * re-renderizando) e NENHUM botão respondia — e o servidor tinha respondido a
 * baixa em 550ms, muito antes. A única saída era sair da rota e entrar de novo,
 * que é o que força o `react-native-screens` a recalcular a interatividade da
 * tela. Nas requisições, isso aparecia como 37 segundos de silêncio absoluto
 * entre a baixa e a volta.
 *
 * Voltando ANTES, a navegação acontece fora do callback do diálogo e o aviso
 * fica por cima da tela de destino — sem tirar a confirmação de quem entregou,
 * que é o ponto de tocar em "Confirmar" e ver que deu certo.
 */
export function avisarEVoltar(voltar: () => void, titulo: string, mensagem?: string): void {
  voltar();
  // ⚠️ E ainda ESPERA a transição terminar. Voltar antes resolveu a tela surda,
  // mas o diálogo aberto em cima da transição criou o sintoma seguinte: os
  // toques chegavam (medido: `toques=488`) e a navegação seguinte não
  // acontecia — era preciso insistir muitas vezes até a próxima tela abrir.
  // Quem volta para uma tela que sabe mostrar faixa deve preferir
  // `publicarAviso` (`lib/avisoTela.ts`) e não abrir diálogo nenhum.
  InteractionManager.runAfterInteractions(() => {
    setTimeout(() => Alert.alert(titulo, mensagem), 300);
  });
}
