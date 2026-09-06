/**
 * Data em pt-BR SEM passar por `Date`.
 *
 * O backend manda AAAA-MM-DD (ou ISO com hora) em UTC. `new Date('2026-09-05')`
 * seguido de `toLocaleDateString` volta 04/09 em qualquer fuso a oeste de
 * Greenwich — e a data-base do ciclo é o campo que ancora todo cálculo temporal
 * do módulo. Recortar a string não erra.
 */
export function data(valor: string | null | undefined): string {
  if (!valor) return '—';
  const [ano, mes, dia] = valor.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Nota com duas casas e vírgula, como o resto da plataforma mostra. */
export function nota(valor: number): string {
  return valor.toFixed(2).replace('.', ',');
}
