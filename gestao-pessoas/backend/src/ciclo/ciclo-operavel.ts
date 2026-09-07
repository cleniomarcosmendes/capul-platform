import { BadRequestException } from '@nestjs/common';

/**
 * ⭐⭐ CICLO ENCERRADO NÃO MUDA — e agora isso é verdade.
 *
 * O módulo escrevia essa frase (no ajuste de período) e o código não a cumpria:
 * `encerrar` recusava só o período. **Designar, mexer no público e apurar
 * continuavam funcionando em ciclo encerrado**, porque nenhum desses serviços
 * olhava o status. O pior dos três é o apurar: ele muda a NOTA de gente cujo
 * resultado já foi comunicado.
 *
 * ⚠️ Não é trava sem saída: existe `POST /ciclos/:id/reabrir` (RH_ADMIN, com
 * motivo, auditado). Sem essa porta, "encerrei sem querer" viraria criar outro
 * ciclo — e ciclo duplicado é pior que ciclo reaberto, porque duplica resultado
 * sem ninguém decidir.
 *
 * ⭐ **A recusa ensina o que fazer.** "Este ciclo está encerrado" sem
 * alternativa é da mesma família do "Excluir" ser o único botão da linha: o
 * sistema diz não e deixa a pessoa procurar sozinha o caminho — e o caminho que
 * ela acha é o errado.
 */

/** O que continua valendo com o ciclo encerrado — a recusa diz isto em voz alta. */
const O_QUE_AINDA_ABRE =
  'Encerrado, ele continua servindo para LER: resultados, memória de cálculo, ' +
  'painel e designação seguem abrindo.';

function encerradoEmTexto(encerradoEm: Date | null | undefined): string {
  if (!encerradoEm) return '';
  const d = new Date(encerradoEm);
  if (Number.isNaN(d.getTime())) return '';
  return ` em ${d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
}

export interface CicloParaOperar {
  status: string;
  encerradoEm?: Date | null;
}

/**
 * Guarda de TODA escrita que muda o conteúdo de um ciclo: designação (à mão e em
 * lote), decisão de elegibilidade, público das aplicações e apuração.
 *
 * ⚠️ NÃO se aplica a leitura, nem à prévia (que não grava), nem ao cadastro de
 * "quem avalia quem" — o cadastro é da plataforma e serve aos PRÓXIMOS ciclos;
 * congelá-lo porque um ciclo acabou seria efeito colateral, não regra.
 */
export function assertCicloOperavel(ciclo: CicloParaOperar, acao: string): void {
  if (ciclo.status !== 'ENCERRADO') return;
  throw new BadRequestException(
    `Este ciclo foi encerrado${encerradoEmTexto(ciclo.encerradoEm)} e não aceita ${acao}. ` +
      'Para mexer nele, reabra o ciclo — é ato do RH_ADMIN, exige motivo e fica registrado. ' +
      O_QUE_AINDA_ABRE,
  );
}

/**
 * ⭐ A ORDEM importa, e a recusa a ensina.
 *
 * Reabrir uma avaliação num ciclo encerrado deixava a avaliação `EM_ANDAMENTO`
 * **sem que ninguém pudesse respondê-la** — responder exige ciclo ABERTO. Era um
 * beco: o ato dava certo e não servia para nada. Agora a recusa diz a sequência
 * em vez de só dizer não.
 */
export function assertCicloAceitaReaberturaDeAvaliacao(ciclo: CicloParaOperar): void {
  if (ciclo.status !== 'ENCERRADO') return;
  throw new BadRequestException(
    `Este ciclo foi encerrado${encerradoEmTexto(ciclo.encerradoEm)}. ` +
      'Reabra o CICLO primeiro e só depois a avaliação: com o ciclo encerrado, ' +
      'ela ficaria em andamento sem que ninguém pudesse responder — responder exige ciclo aberto.',
  );
}
