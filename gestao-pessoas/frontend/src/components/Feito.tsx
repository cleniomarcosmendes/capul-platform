import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

/**
 * ⭐⭐ O AVISO DE QUE DEU CERTO — um padrão só, em todo o módulo.
 *
 * ── POR QUE ISTO EXISTE, e o custo que ele já teve ──────────────────────────
 *
 * Em 13/09/2026 o Clenio marcou o ENSAIO como recorte. O `PATCH` respondeu
 * **200**, o dado gravou, e **a tela não disse nada** — a única evidência foi um
 * bloco mudar de cor num canto. Ele concluiu que falhou, escreveu que não tinha
 * funcionado, e eu quase entreguei um retrato do "depois" que era o "antes".
 *
 * ⚠️ **O sistema não mentiu: ele não disse nada, e o silêncio foi lido como
 * falha.** É pior que erro — erro manda tentar de novo com informação; silêncio
 * manda tentar de novo às cegas.
 *
 * ⚠️ Estava na varredura de 10/09 como item 12 (*"nenhum aviso de sucesso
 * visível"*), classificado como **falta de explicação**. Quatro dias depois o
 * custo apareceu: **um ato aplicado que ninguém sabia ter acontecido.** Era
 * defeito.
 *
 * ── A REGRA ─────────────────────────────────────────────────────────────────
 *
 * ⭐ **Todo ato de escrita avisa** — inclusive (e principalmente) os que mudam a
 * tela de leve. O que muda muito se explica sozinho; o que muda pouco é
 * exatamente o que some.
 *
 * ⚠️ E o aviso diz **O QUE FOI FEITO**, não "ok": *"Ciclo aberto"* responde a
 * pergunta que a pessoa tem; *"Sucesso!"* não responde nenhuma.
 */
export function useFeito(segundos = 6) {
  const [feito, setFeito] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * ⚠️ Some sozinho depois de alguns segundos — aviso de sucesso que fica na
   * tela vira parte do cenário e deixa de ser lido, e pior: no ato seguinte
   * ninguém sabe se aquele texto é do clique novo ou do anterior.
   */
  const avisar = useCallback(
    (mensagem: string) => {
      setFeito(mensagem);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setFeito(null), segundos * 1000);
    },
    [segundos],
  );

  // ⚠️ Limpa ao desmontar: `setState` depois de a tela sair produz warning e,
  //    em tela que navega logo após o ato, é o caso comum.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { feito, avisar, limparFeito: () => setFeito(null) };
}

/**
 * O aviso em si. Renderize perto do topo da área que o ato mudou — não no rodapé
 * e não num canto: ele existe para ser visto por quem acabou de clicar.
 *
 * ⚠️ `role="status"` e `aria-live="polite"`: leitor de tela anuncia sem
 * interromper. Sem isso, quem não enxerga a tela não recebe aviso NENHUM — e a
 * ausência de feedback, para essa pessoa, é o estado permanente.
 */
export function Feito({ mensagem }: { mensagem: string | null }) {
  if (!mensagem) return null;
  return (
    <p
      role="status"
      aria-live="polite"
      className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
    >
      <CheckCircle2 size={16} className="shrink-0" aria-hidden />
      {mensagem}
    </p>
  );
}
