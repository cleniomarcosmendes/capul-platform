/**
 * Aviso curto exibido PELA PRÓPRIA TELA de destino, sem diálogo nativo.
 *
 * ⭐ Por que não é `Alert` (apurado com o Clenio em 14/08/2026, viagens 35 e 36):
 * diálogo nativo do Android e transição do `native-stack` não podem se cruzar.
 *
 *  - `Alert` com `onPress: () => navigation.goBack()` sai da tela DE DENTRO do
 *    callback do diálogo: a tela de baixo voltava **viva mas surda** — o contador
 *    de diagnóstico andava e nenhum toque produzia efeito.
 *  - Voltar primeiro e mostrar o `Alert` logo em seguida corrigiu a surdez, mas o
 *    diálogo passou a cair em cima da transição: os toques chegavam (medido:
 *    `toques=488`), o handler rodava, e a navegação seguinte simplesmente não
 *    acontecia — era preciso tocar muitas vezes até a tela de baixa abrir.
 *
 * Sem diálogo, não há janela nativa disputando foco com a transição. E some de
 * quebra um toque em "OK" por entrega — o entregador faz uma atrás da outra.
 *
 * Mesmo formato de assinante já usado nas filas offline (`onFilaChange`).
 */
export type TipoAviso = 'ok' | 'atencao';
export interface Aviso {
  texto: string;
  tipo: TipoAviso;
  /** Muda a cada publicação: deixa a tela reexibir o MESMO texto duas vezes. */
  id: number;
}

type Assinante = (a: Aviso) => void;
const assinantes = new Set<Assinante>();
let sequencia = 0;

/** A tela de destino assina; devolve a função de cancelar. */
export function onAviso(a: Assinante): () => void {
  assinantes.add(a);
  return () => assinantes.delete(a);
}

/** Publica antes de voltar — quem estiver montado exibe. */
export function publicarAviso(texto: string, tipo: TipoAviso = 'ok'): void {
  sequencia += 1;
  const aviso: Aviso = { texto, tipo, id: sequencia };
  assinantes.forEach((a) => a(aviso));
}
