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
export function distribuirPeso(total: number, quantidade: number): number[] {
  if (quantidade <= 0) throw new Error('distribuirPeso: quantidade precisa ser maior que zero.');
  if (!(total > 0)) throw new Error(`distribuirPeso: total precisa ser maior que zero (recebi ${total}).`);

  const centavos = Math.round(total * 100);
  const base = Math.floor(centavos / quantidade);
  const resto = centavos - base * quantidade;

  return Array.from({ length: quantidade }, (_, i) => (i < resto ? base + 1 : base) / 100);
}
