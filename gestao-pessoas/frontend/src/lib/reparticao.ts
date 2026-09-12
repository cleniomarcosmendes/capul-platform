/**
 * ⭐⭐ REPARTIÇÃO QUE FECHA — o gêmeo de `backend/src/common/percentual.ts`.
 *
 * ⚠️ **É uma CÓPIA, e cópia de regra envelhece errada.** Ela existe porque a
 * composição da nota (`BarraDeComposicao`) é recalculada **enquanto a pessoa
 * digita os pesos** no modal da Aplicação — pedir ao servidor a cada tecla é o
 * desenho errado, e foi por isso que a estimativa de "o backend devolve a
 * composição pronta" não se sustentou.
 *
 * ⚠️ O que a mantém honesta é o SPEC ao lado (`reparticao.spec.ts`), com os
 * mesmos casos do gêmeo — inclusive o que reprovou a primeira versão do
 * backend. Se as duas divergirem, um dos dois specs cai.
 *
 * ── A REGRA ─────────────────────────────────────────────────────────────────
 * `(parte / total) × 100` arredondado por item **não soma 100**: 16/10/34 sobre
 * 60 dá 26,67 + 16,67 + 56,67 = 100,01. E a distribuição do resto se faz em
 * **INTEIROS, nunca em float**: as três frações de 16/10/34 são a mesma
 * (0,666…) e o float as devolve diferentes na 13ª casa — a soma sai certa e o
 * centésimo vai para o dono errado.
 */
export function repartirExato(
  partes: readonly number[],
  total: number,
  casas = 2,
): number[] {
  const escala = 10 ** casas;
  const alvo = Math.round(total * escala);
  const emCentesimos = partes.map((v) => Math.round(v * 10_000));
  const soma = emCentesimos.reduce((s, v) => s + v, 0);
  if (soma <= 0 || alvo <= 0) return partes.map(() => 0);

  const piso: number[] = [];
  const resto: number[] = [];
  for (const v of emCentesimos) {
    const numerador = v * alvo;
    piso.push(Math.floor(numerador / soma));
    resto.push(numerador % soma);
  }

  let sobra = alvo - piso.reduce((s, p) => s + p, 0);
  const ordem = resto.map((r, i) => ({ i, r })).sort((a, b) => b.r - a.r || a.i - b.i);
  const saida = [...piso];
  for (const { i } of ordem) {
    if (sobra <= 0) break;
    saida[i] += 1;
    sobra -= 1;
  }
  return saida.map((c) => c / escala);
}

/** Percentuais que somam exatamente 100. */
export const percentuaisQueFecham = (valores: readonly number[]) =>
  repartirExato(valores, 100, 2);

/**
 * ⭐⭐ REPARTIR EM PARTES IGUAIS — o gêmeo de `backend/modelo/distribuirPeso`.
 *
 * `10 ÷ 3` → `3,34 · 3,33 · 3,33`. O resto vai para as PRIMEIRAS, por ordem, e
 * a soma fecha exata.
 *
 * ⚠️ Existe para a tela de montar o arranjo poder mostrar **o peso que
 * resultaria** enquanto a pessoa digita. Antes ela escrevia "peso ao salvar" e
 * **apagava o número de todas as questões** — inclusive as que a mudança não
 * tocou — exatamente no momento de decidir se a alteração está certa.
 *
 * ⚠️ É a MESMA regra do backend, e por isso a mesma tabela de casos no spec. O
 * que a tela mostra é previsão; quem grava é o servidor, e o número volta dele
 * ao salvar. Divergir seria pior que não prever — por isso o spec.
 */
export function distribuirIgual(total: number, quantidade: number): number[] {
  if (quantidade <= 0) return [];
  if (!(total > 0)) return Array.from({ length: quantidade }, () => 0);
  return repartirExato(Array.from({ length: quantidade }, () => 1), total, 2);
}
