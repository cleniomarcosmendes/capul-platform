import { useRef } from 'react';
import { ScrollView } from 'react-native';

/** Handler de onFocus de TextInput (recebe o evento de foco). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AoFocar = (e: any) => void;

/**
 * Mantém o campo focado ACIMA do teclado em telas de formulário (ScrollView +
 * vários TextInput) — resolve o teclado sobrepondo os campos de baixo.
 *
 * Uso:
 *   const { scrollRef, aoFocar } = useScrollToFocusedInput();
 *   <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled"
 *               contentContainerStyle={styles.conteudo}>
 *     <TextInput onFocus={aoFocar} ... />   // onFocus em CADA TextInput
 *   </ScrollView>
 *   // styles.conteudo precisa de paddingBottom (~40–48) p/ o último campo subir.
 *
 * `offset` = folga (px) entre o campo e o topo do teclado (default 110).
 * Fonte única do padrão — antes copiado em DespesaEntrega/SupervisorViagem/
 * ViagemFrota.
 */
export function useScrollToFocusedInput(offset = 110) {
  const scrollRef = useRef<ScrollView>(null);
  const aoFocar: AoFocar = (e) => {
    const resp = scrollRef.current?.getScrollResponder?.() as {
      scrollResponderScrollNativeHandleToKeyboard?: (n: number, off: number, prevent: boolean) => void;
    } | undefined;
    const node: number | undefined = e?.target;
    if (resp?.scrollResponderScrollNativeHandleToKeyboard && node != null) {
      resp.scrollResponderScrollNativeHandleToKeyboard(node, offset, true);
    }
  };
  return { scrollRef, aoFocar };
}
