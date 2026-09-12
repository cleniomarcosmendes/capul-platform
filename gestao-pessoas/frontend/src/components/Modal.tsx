/**
 * Diálogo do módulo. Nasceu dentro da tela de Designação e saiu de lá quando a
 * segunda tela precisou dele — duas cópias de uma caixa que prende o foco e
 * fecha no clique de fora envelhecem diferente, e a que envelhece pior é sempre
 * a do celular.
 *
 * ⚠️ Sobe pela BAIXO no celular (`items-end` + cantos arredondados só em cima) e
 * centraliza no desktop: o polegar alcança a borda inferior, não o meio da tela.
 */
export function Modal({
  titulo,
  aoFechar,
  children,
  largura = 'normal',
}: {
  titulo: string;
  aoFechar: () => void;
  children: React.ReactNode;
  /**
   * `ampla` para conteúdo em GRADE (a linha de faixa tem 6 campos). Em `normal`
   * a grade quebra numa coluna e cada faixa vira meia tela de rolagem — o que
   * inviabiliza justamente o que se está conferindo, que é o conjunto.
   * Não muda nada no celular: lá as duas ocupam a largura toda.
   */
  largura?: 'normal' | 'ampla';
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4"
      onClick={aoFechar}
    >
      <div
        role="dialog"
        aria-modal
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl ${
          largura === "ampla" ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        <h3 className="text-lg font-semibold text-slate-800">{titulo}</h3>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
