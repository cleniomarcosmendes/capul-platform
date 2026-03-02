/**
 * Regra de quantidade final por maioria (3 ciclos de contagem).
 *
 * Regra 1: C2 == sistema → usa C2
 * Regra 2: Somente C1 → usa C1
 * Regra 3: C1 == C2 → usa qualquer
 * Regra 4: Desempate com C3:
 *   - C1 == C3 → usa C1
 *   - C2 == C3 → usa C2
 *   - Todos diferentes → usa C3
 */
export function calcularQuantidadeFinal(
  count1: number | null,
  count2: number | null,
  count3: number | null,
  systemQty: number,
): number {
  if (count2 !== null && Math.abs(count2 - systemQty) < 0.01) return count2;
  if (count1 !== null && count2 === null && count3 === null) return count1;
  if (count1 !== null && count2 !== null && Math.abs(count1 - count2) < 0.01) return count1;

  if (count3 !== null) {
    if (count1 !== null && Math.abs(count1 - count3) < 0.01) return count1;
    if (count2 !== null && Math.abs(count2 - count3) < 0.01) return count2;
    return count3;
  }

  return count3 ?? count2 ?? count1 ?? 0;
}

/**
 * Quantidade esperada incluindo entregas posteriores.
 * Formula: system_qty (b2_qatu) + b2_xentpos (entregas posteriores)
 */
export function getExpectedQty(systemQty: number, b2Xentpos: number | undefined | null): number {
  return systemQty + (b2Xentpos || 0);
}

/**
 * Verifica se algum produto tem entregas posteriores (b2_xentpos > 0).
 */
export function hasAnyEntregasPosterior(products: { b2_xentpos?: number }[]): boolean {
  return products.some((p) => (p.b2_xentpos || 0) > 0.001);
}

/**
 * Cor do badge de ciclo.
 */
export function cycleBadgeColor(cycle: number): string {
  switch (cycle) {
    case 1: return 'bg-green-100 text-green-700';
    case 2: return 'bg-amber-100 text-amber-700';
    case 3: return 'bg-red-100 text-red-700';
    default: return 'bg-slate-100 text-slate-700';
  }
}

/**
 * Label de ciclo.
 */
export function cycleLabel(cycle: number): string {
  return `${cycle}o Ciclo`;
}
