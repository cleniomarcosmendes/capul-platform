/**
 * ⭐⭐ O TAMANHO MÍNIMO DE UM MOTIVO — e por que ele não é o mesmo para tudo.
 *
 * Todo ato irreversível deste módulo exige motivo escrito. O mínimo era **3**
 * em todos, e 3 é decorativo: `"xpt"` passa. A regra existia para o formulário
 * poder travar, não para a frase servir a alguém.
 *
 * ⚠️ O motivo não é burocracia — ele é **a resposta a uma pergunta futura**:
 * *"por que estas 37 pessoas ficaram sem nota?"*, meses depois, para alguém que
 * não estava na sala. `"xpt"` não responde nada, e quem lê fica com a mesma
 * dúvida e mais a impressão de que ninguém levou a sério.
 *
 * ⭐ **O mínimo acompanha o alcance do ato**, e é por isso que são dois números:
 *
 *   - `MOTIVO_MINIMO` (3) — atos de UMA linha: excluir uma pessoa, reabrir uma
 *     avaliação. Quem lê tem o contexto ao redor (o nome, o status, a data), e
 *     a frase completa o que a tela já mostra.
 *   - `MOTIVO_MINIMO_EM_MASSA` (15) — atos que atingem N registros de uma vez:
 *     **encerrar o ciclo com pendência** e **reabrir o ciclo**. Aqui a frase é a
 *     **única** explicação que vai sobrar para dezenas de pessoas, e 15
 *     caracteres forçam uma oração em vez de um token. *"Pessoa desligada"*
 *     tem 16.
 *
 * ⚠️ **O erro é escolher o MENOR, e ele tem uma forma reconhecível: a analogia
 * com o ato de mesmo NOME.** `reabrir` o ciclo nasceu com 3 "como no reabrir
 * avaliação" — mesma palavra, alcance oposto: um devolve UMA linha, o outro
 * devolve designação, público e apuração do ciclo inteiro. Ao escolher o
 * mínimo, perguntar **quantos registros o ato atinge**, nunca como ele se chama.
 *
 * ⚠️ **E use a CONSTANTE, não o literal.** Até 09/09 os quatro DTOs escreviam
 * `@MinLength(3)` na mão e `MOTIVO_MINIMO` não era importado em lugar nenhum —
 * extraíram a regra e deixaram as chamadas para trás. Com o literal, o ato novo
 * copia o vizinho e herda o número errado sem ninguém notar.
 *
 * ⚠️ **A tela tem de usar o MESMO número**, senão ela trava onde a API aceita
 * (ou pior, deixa clicar onde a API recusa). Onde a tela não pode importar
 * daqui, o número vai com um comentário apontando para cá.
 */

/** Atos de uma linha. */
export const MOTIVO_MINIMO = 3;

/** Atos em massa e irreversíveis. */
export const MOTIVO_MINIMO_EM_MASSA = 15;

/** A frase que a API devolve — a mesma que a tela mostra antes de travar. */
export function faltamCaracteres(motivo: string, minimo: number): string {
  return `Escreva pelo menos ${minimo} caracteres — faltam ${minimo - motivo.trim().length}.`;
}
