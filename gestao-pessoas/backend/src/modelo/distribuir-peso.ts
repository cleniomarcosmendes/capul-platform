/**
 * Distribui o peso de um grupo entre as perguntas dele, **preservando o total**.
 *
 * Desde a reestruturação de 05/09/2026 o peso mora só na Pergunta; o grupo é
 * organização visual. Para trazer os pesos antigos (que eram por grupo) sem
 * mudar o balanço do instrumento, cada grupo reparte o seu peso entre as suas
 * perguntas.
 *
 * ⚠️ Não é divisão simples. 10 dividido por 3 daria 3,3333333… e a Arielly veria
 * dízima na primeira tela que abrir. Aqui a conta é feita em CENTÉSIMOS, com o
 * resto distribuído nas primeiras perguntas (método do maior resto): o resultado
 * tem duas casas e soma exatamente o total do grupo — 10 em 3 vira
 * 3,34 + 3,33 + 3,33.
 *
 * Somar exato importa mais do que parecer justo: se a soma escorregar, o balanço
 * entre grupos que o RH definiu deixa de valer, e ninguém percebe olhando.
 */
/**
 * ── ⚠️ QUANDO MEXER AQUI: RODE AS MUTAÇÕES ──────────────────────────────────
 *
 * Este arquivo decide NOTA. Os testes de cálculo do módulo pegam as reversões
 * conhecidas — **medido em 12/09**, não suposto —, mas isso só continua verdade
 * enquanto alguém confere.
 *
 * **~15 minutos, e é a aferição que substitui escrever a contraparte explícita
 * de cada teste** (§3.1.126). Rode ao mexer em qualquer cálculo:
 *
 *   1. `arredondar` com 1 casa em vez de 2        → esperado: ~8 testes caem
 *   2. fronteira inferior da faixa EXCLUSIVA      → esperado: ~1 teste cai
 *   3. critério sem dado ENTRANDO no denominador  → esperado: ~7 testes caem
 *   4. `pesoExato` trocado por `peso` no
 *      `itensRespondidos`                          → esperado: as permutações
 *                                                    de `ordem-nao-muda-a-nota`
 *                                                    passam a divergir
 *
 * ⚠️⚠️ **Toda mutação tem de PROVAR QUE ENTROU.** Na primeira medição, duas
 * delas não pegaram no fonte (o padrão não batia) e o resultado leu como *"o
 * teste não pega"* — falso verde um nível acima do canário. Use `assert` no
 * script de mutação, ou confira o diff antes de rodar.
 *
 * ⚠️ Verde sem mutação responde "nada mudou desde a última vez", não "está
 * certo" — é a mesma distinção da §3.1.127 sobre baseline.
 */
export function distribuirPeso(total: number, quantidade: number): number[] {
  if (quantidade <= 0) throw new Error('distribuirPeso: quantidade precisa ser maior que zero.');
  if (!(total > 0)) throw new Error(`distribuirPeso: total precisa ser maior que zero (recebi ${total}).`);

  const centavos = Math.round(total * 100);
  const base = Math.floor(centavos / quantidade);
  const resto = centavos - base * quantidade;

  return Array.from({ length: quantidade }, (_, i) => (i < resto ? base + 1 : base) / 100);
}
