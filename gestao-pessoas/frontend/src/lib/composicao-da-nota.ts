/**
 * ⭐⭐ COMO OS PESOS VIRAM PERCENTUAL — uma normalização só, para as duas telas.
 *
 * O motor de apuração **normaliza**: `notaFinal = Σ(nota × peso) / Σ(peso)`. O
 * peso cadastrado é um número relativo, não uma porcentagem — 60 com nenhum
 * critério é 100% da nota, e 60 com um critério de 40 é 60%.
 *
 * ⚠️ As duas telas diziam isso de jeitos diferentes e pareciam discordar. A aba
 * Aplicações mostrava **"Questionário 100,0%"** (normalizado) e a memória de
 * cálculo mostrava **"Peso 60"** (bruto), lado a lado com *"CRITÉRIOS: Nenhum —
 * a nota é 100% do questionário"*. A nota final não sofria — componente único
 * normaliza para 1 de qualquer forma —, mas quem abrisse a memória para
 * conferir a conta procuraria **40 pontos de critérios que não existem**.
 *
 * É a mesma família do `52 × 50` (§3.1.38/§3.1.40): dois números verdadeiros, na
 * mesma tela, sem o termo que os concilia. E a saída é a mesma do cabeçalho do
 * ciclo — **não trocar o número, mostrar o termo que falta**. A memória segue
 * com o peso BRUTO, porque é o insumo da conta e é o que está cadastrado; ganha
 * ao lado a fração que ele representa.
 *
 * ⚠️ E a fração sai daqui nas duas telas. Uma segunda normalização divergiria no
 * primeiro caso de borda — que é exatamente como as duas passaram a discordar.
 */

export interface ItemComPeso {
  nome: string;
  peso: number;
}

export interface FatiaDaNota extends ItemComPeso {
  /** Quanto este item vale na nota final, em %. */
  pct: number;
}

/**
 * Reparte 100% entre os itens, proporcional ao peso.
 *
 * ⚠️ Recebe **só os itens que contam**. Critério sem dado é redistribuído pelo
 * motor (`houveRenormalizacao`), então quem chama o exclui antes — passar um
 * item que não entra na conta faria a fração mentir para todos os outros.
 *
 * Total zero devolve lista vazia: sem peso não há composição, e dividir por
 * zero produziria `NaN` na tela.
 */
export function repartirPesos(itens: readonly ItemComPeso[]): FatiaDaNota[] {
  const total = itens.reduce((s, i) => s + i.peso, 0);
  if (total <= 0) return [];
  return itens.map((i) => ({ ...i, pct: (i.peso / total) * 100 }));
}

/** `60` de um total de `60` → `"100,0%"`. Uma casa: a tela não é planilha. */
export function fracao(peso: number, total: number): string {
  if (total <= 0) return '—';
  return `${((peso / total) * 100).toFixed(1).replace('.', ',')}%`;
}
