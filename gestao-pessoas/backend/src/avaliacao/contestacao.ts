/**
 * ⭐⭐ "NÃO É MINHA EQUIPE" — o único instrumento do sinal que só o piloto dá.
 *
 * O piloto de 15/09 existe para provar sete coisas, e a de maior valor é se a
 * **designação do cadastro corresponde à chefia real**: o cadastro diz quem
 * avalia quem, e só o avaliador de carne e osso sabe dizer *"essa pessoa não é
 * minha"* ou *"falta o fulano"*. A gestora não tem como validar isso sozinha —
 * são 1.036 pessoas e 1.384 linhas de cadastro.
 *
 * ⚠️ **Dado que não é coletado não se recupera.** Sem um caminho na tela, a
 * reclamação vira conversa de WhatsApp e morre com o piloto.
 *
 * ── DUAS CAUSAS, e as duas provam a mesma coisa ─────────────────────────────
 *   1. `NAO_E_MINHA_EQUIPE` — sobra alguém na fila. Tem linha para clicar.
 *   2. `FALTA_GENTE`        — falta alguém na fila. **Não tem linha**, e por
 *      isso quase ficou de fora: metade do sinal seria perdida por uma razão de
 *      implementação, não de domínio. Vive no ciclo, não na avaliação.
 *
 * ── O QUE ISTO NÃO FAZ, e é de propósito ────────────────────────────────────
 * **Não altera a designação.** Marcar, nunca filtrar — a mesma regra da lista
 * do RH. A avaliação continua na fila do avaliador, continua para responder, e
 * quem decide é o RH, depois, com a lista na mão. Trocar o avaliador por
 * reclamação de uma pessoa seria dar a ela um ato que não é dela, e no meio do
 * ciclo.
 *
 * ⚠️ Por isso a frase de confirmação é metade do recurso: sem ela o avaliador
 * clica, entende que resolveu, **não responde**, e o ciclo perde a avaliação
 * sem ninguém saber. É o mesmo defeito da "capacidade que a tela promete e o
 * ato nega", ao contrário — a tela que deixa entender que fez o que não fez.
 */

export const TIPOS_DE_CONTESTACAO = ['NAO_E_MINHA_EQUIPE', 'FALTA_GENTE'] as const;
export type TipoDeContestacao = (typeof TIPOS_DE_CONTESTACAO)[number];

/** Ações da auditoria — o RH lê a lista por elas. */
export const ACAO_NAO_E_MINHA_EQUIPE = 'CONTESTAR_DESIGNACAO';
export const ACAO_FALTA_GENTE = 'RELATAR_FALTA_DE_GENTE';

/**
 * A frase que o avaliador lê depois de clicar. Mora aqui, e não na tela, pela
 * regra do módulo: a frase que o usuário lê e a que a API devolve têm de ser a
 * MESMA — se a tela montar a sua, as duas envelhecem separadas.
 *
 * ⚠️ Ela diz as TRÊS coisas, nesta ordem: o que ficou registrado, que quem
 * decide é o RH, e — a que não pode faltar — que **a avaliação continua com
 * ele**. Confirmação que só diz "registrado" é confirmação que mente por
 * omissão.
 */
export function fraseDeConfirmacao(tipo: TipoDeContestacao, nomeDoAvaliado?: string | null): string {
  if (tipo === 'FALTA_GENTE') {
    return (
      'Registrado. O RH vai revisar o cadastro de avaliadores. Enquanto isso, ' +
      'responda as avaliações que já estão na sua fila — quem faltar entra depois, ' +
      'se o RH confirmar, e não atrasa o que você já tem.'
    );
  }
  const quem = nomeDoAvaliado?.trim() || 'esta pessoa';
  return (
    `Registrado. O RH vai revisar quem avalia ${quem}. ⚠️ Enquanto isso a avaliação ` +
    'CONTINUA COM VOCÊ e deve ser respondida no prazo do ciclo — a designação só muda ' +
    'se o RH mudar. Se ela mudar, o que você já respondeu não se perde.'
  );
}
