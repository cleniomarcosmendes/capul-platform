/**
 * Rótulo do modo de visibilidade da lista em contagem.
 *
 * Desde a migration 022 (04/09/2026) são DUAS decisões independentes, tomadas
 * pelo supervisor ao liberar a lista — logo, quatro combinações:
 *
 *   saldo  histórico   rótulo
 *   ----- ----------   ------------------
 *    não     não       Cego
 *    não     sim       Histórico visível     ← comum no 3º ciclo
 *    sim     não       Saldo visível
 *    sim     sim       Saldo e histórico
 *
 * Antes existia só "Modo aberto" x "Modo cego", e "aberto" mentia: dizia ao
 * supervisor que ele havia escancarado a contagem quando o saldo continuava
 * oculto — a flag só liberava o histórico.
 */
export function rotuloVisibilidade(veSaldo: boolean, veHistorico: boolean): string {
  if (veSaldo && veHistorico) return '· saldo e historico';
  if (veSaldo) return '· saldo visivel';
  if (veHistorico) return '· com historico';
  return '· cego';
}

/** Versão longa, para tooltip e legenda. */
export function descricaoVisibilidade(veSaldo: boolean, veHistorico: boolean): string {
  if (veSaldo && veHistorico) {
    return 'O contador ve o saldo do sistema e as contagens dos ciclos anteriores.';
  }
  if (veSaldo) {
    return 'O contador ve o saldo do sistema. As contagens anteriores seguem ocultas.';
  }
  if (veHistorico) {
    return 'O contador ve as contagens dos ciclos anteriores. O saldo do sistema segue oculto.';
  }
  return 'Contagem cega: o contador nao ve saldo do sistema nem contagens anteriores.';
}
