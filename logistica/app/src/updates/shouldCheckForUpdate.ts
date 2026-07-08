/** Máx. 1 checagem de update a cada 30 min (poupa bateria/dados). */
export const THROTTLE_MS = 30 * 60 * 1000;

/**
 * Decide se pode checar update agora. Puro p/ ser testável — o hook injeta
 * `Date.now()` como `nowMs` e o timestamp persistido como `lastCheckMs`.
 */
export function shouldCheckForUpdate(
  lastCheckMs: number | null,
  nowMs: number,
  throttleMs: number = THROTTLE_MS,
): boolean {
  if (lastCheckMs === null) return true;
  return nowMs - lastCheckMs >= throttleMs;
}
