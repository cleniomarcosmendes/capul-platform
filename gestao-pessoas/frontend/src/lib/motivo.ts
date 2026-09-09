/**
 * ⭐⭐ ESPELHO de `backend/src/common/motivo.ts` — os mesmos dois números, com
 * os MESMOS NOMES.
 *
 * Por que existe este arquivo: até 09/09 cada página escrevia o número na mão
 * (`length < 3`) e a `CiclosPage` ainda chamava de `MOTIVO_MINIMO` o valor 15 —
 * o mesmo nome que no backend vale 3. Nome igual com valor diferente é pior que
 * número solto: quem confere um lado contra o outro lê "iguais" e segue.
 *
 * ⭐ O mínimo acompanha o ALCANCE do ato, nunca o nome dele. `reabrir` o ciclo
 * se chama como `reabrir` uma avaliação e atinge o ciclo inteiro — foi assim
 * que ele nasceu com o mínimo errado.
 *
 * ⚠️ A tela tem de usar o MESMO número da API: mais frouxa deixa clicar onde a
 * API recusa; mais dura trava onde a API aceitaria.
 */

/** Atos de UMA linha: excluir/incluir uma pessoa, reabrir uma avaliação. */
export const MOTIVO_MINIMO = 3;

/** Atos EM MASSA: encerrar o ciclo com pendência, reabrir o ciclo. */
export const MOTIVO_MINIMO_EM_MASSA = 15;

/** A mesma frase do `faltamCaracteres` da API. */
export function faltamCaracteres(motivo: string, minimo: number): string {
  return `Escreva pelo menos ${minimo} caracteres — faltam ${minimo - motivo.trim().length}.`;
}
