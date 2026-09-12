/**
 * ⭐⭐ PERCENTUAIS QUE FECHAM EM 100 — método do maior resto.
 *
 * `(parte / total) × 100` arredondado por item **não soma 100**. Com pesos
 * 16/10/34 sobre 60 a coluna sai 26,67 + 16,67 + 56,67 = **100,01**, e o RH lê
 * uma tabela de percentuais que não fecha. Foi assim que este arquivo nasceu:
 * o spec do validador de publicação reprovou por 0,01 (12/09).
 *
 * ⚠️ É a mesma família do `distribuirPeso` — e é de propósito que sejam duas
 * funções. Lá o total é repartido em partes IGUAIS (o peso do grupo entre as
 * questões dele); aqui as partes já existem e são DESIGUAIS, e o que se
 * distribui é só o centésimo do arredondamento. Uma não faz o trabalho da
 * outra, mas as duas seguem a mesma regra: **arredondar para baixo e dar o
 * resto às maiores frações, para o total fechar exato**.
 *
 * Não é preciosismo de exibição. É a regra 15 do projeto: dois números
 * verdadeiros na mesma tela precisam do termo que os concilia — e "100,01%" não
 * tem termo que o concilie com "100%".
 */

/**
 * @param valores as partes, na ordem em que serão exibidas.
 * @returns o percentual de cada uma, com 2 casas, somando **exatamente 100**
 *          (ou tudo zero, quando o total é zero).
 */
export function percentuaisQueFecham(valores: readonly number[]): number[] {
  /**
   * ⚠️ TUDO EM INTEIROS, e não é preciosismo — foi um teste vermelho.
   *
   * A primeira versão ordenava o resto por `e - Math.floor(e)` em ponto
   * flutuante. Com 16/10/34 sobre 60 as três frações são a MESMA (0,666…), mas
   * o float as devolve diferentes na 13ª casa — e o centésimo foi para a
   * terceira parte em vez da primeira. O resultado ainda somava 100; o que
   * mudava era **quem** recebia, por ruído de representação, e isso é o tipo de
   * coisa que aparece como "o número mudou sozinho" meses depois.
   *
   * Em centésimos inteiros o empate é EMPATE, e o desempate é a ordem.
   */
  const emCentesimos = valores.map((v) => Math.round(v * 100));
  const total = emCentesimos.reduce((s, v) => s + v, 0);
  if (total <= 0) return valores.map(() => 0);

  const piso: number[] = [];
  const resto: number[] = [];
  for (const v of emCentesimos) {
    const numerador = v * 10_000;
    piso.push(Math.floor(numerador / total));
    resto.push(numerador % total);
  }

  let sobra = 10_000 - piso.reduce((s, p) => s + p, 0);

  /**
   * O centésimo sobrando vai para quem tem o MAIOR resto — e o empate se
   * resolve pela ordem: duas leituras do mesmo arranjo têm de dar a mesma
   * tabela, senão o número muda entre dois F5.
   */
  const ordem = resto.map((r, i) => ({ i, r })).sort((a, b) => b.r - a.r || a.i - b.i);

  const saida = [...piso];
  for (const { i } of ordem) {
    if (sobra <= 0) break;
    saida[i] += 1;
    sobra -= 1;
  }
  return saida.map((c) => c / 100);
}
