/**
 * ⭐⭐ O QUE MUDA (E O QUE NÃO MUDA) NO CICLO ABERTO quando se define um vínculo
 * no cadastro.
 *
 * O cadastro de "quem avalia quem" é PERMANENTE e o ciclo é uma CÓPIA dele,
 * feita quando alguém roda "Designar pelo cadastro". Definir o vínculo, portanto,
 * **não cria avaliação em ciclo já aberto** — e esse é o tipo de coisa que a tela
 * precisa dizer na hora, porque o custo do silêncio é a pessoa sair convencida de
 * que resolveu e a avaliação não existir.
 *
 * ⚠️ **Um aviso genérico não serve**, e o motivo é o estado `JA_RESPONDIDA`: o
 * lote RECUSA trocar o avaliador de uma avaliação que já tem resposta
 * (`copiarDoCadastro`, motivo `JA_RESPONDIDA`), com a frase *"trocar o avaliador
 * agora atribuiria o julgamento de uma pessoa a outra"*. Com o aviso genérico, a
 * pessoa vincularia, rodaria o lote e não veria nada — o motivo ficaria enterrado
 * no relatório do lote.
 *
 * ⚠️ **A ORDEM das checagens importa.** `JA_REFLETE` vem antes de tudo: se a
 * avaliação do ciclo já é com o avaliador que se acabou de vincular, "já
 * respondida" é boa notícia, não aviso — e dizer *"já tem avaliação com Fulano"*
 * logo depois de vincular o Fulano é absurdo.
 *
 * Esta função é PURA de propósito: as consultas ficam no serviço, e as regras
 * — que são o que se erra — podem ser testadas sem banco.
 */

export type SituacaoNoCiclo =
  /** A avaliação do ciclo já é com este avaliador. Nada a fazer. */
  | 'JA_REFLETE'
  /** Está no público e elegível, sem avaliação: falta rodar "Designar pelo cadastro". */
  | 'SEM_AVALIACAO'
  /** Não está no público de nenhuma aplicação — o lote nem a alcança. */
  | 'FORA_DO_PUBLICO'
  /** No público, mas a RÉGUA do ciclo exclui (demitido/afastado na data-base). */
  | 'FORA_PELA_REGUA'
  /** No público, mas o RH tirou do ciclo — decisão com autor e justificativa. */
  | 'FORA_POR_DECISAO_RH'
  /** Avaliação pendente com OUTRO avaliador: o lote atualiza. */
  | 'OUTRO_AVALIADOR'
  /** Idem, mas designada à mão DENTRO do ciclo: o lote só substitui se mandarem. */
  | 'OUTRO_AVALIADOR_MANUAL'
  /** Avaliação com resposta ou enviada: o lote RECUSA a troca. */
  | 'JA_RESPONDIDA';

export interface EntradaDaSituacao {
  /** Quem passou a ser o avaliador no cadastro, agora. */
  avaliadorVinculadoId: string;
  /** A avaliação que existe neste ciclo, se existir. */
  avaliacao: {
    avaliadorId: string;
    status: string;
    respostas: number;
    /** `MANUAL` = alguém designou à mão dentro do ciclo. */
    origemDesignacao: string;
  } | null;
  /** Está no público de alguma aplicação deste ciclo? */
  noPublico: boolean;
  /** Decisão do RH registrada para este ciclo, se houver. */
  decisaoDoRh: { decisao: 'INCLUIR' | 'EXCLUIR'; justificativa: string | null } | null;
  /** Resultado da régua do ciclo (`elegibilidade-ciclo.ts`). */
  regua: { elegivel: boolean; justificativa: string | null };
}

/** Situações em que alguém precisa FAZER alguma coisa para o ciclo refletir o vínculo. */
const PEDEM_ACAO: ReadonlySet<SituacaoNoCiclo> = new Set<SituacaoNoCiclo>([
  'SEM_AVALIACAO',
  'FORA_DO_PUBLICO',
  'FORA_PELA_REGUA',
  'FORA_POR_DECISAO_RH',
  'OUTRO_AVALIADOR',
  'OUTRO_AVALIADOR_MANUAL',
]);

export function pedeAcao(situacao: SituacaoNoCiclo): boolean {
  return PEDEM_ACAO.has(situacao);
}

export function decidirSituacao(e: EntradaDaSituacao): SituacaoNoCiclo {
  // 1º de tudo: o ciclo já reflete? Então status nenhum importa — nem
  // "respondida", que aqui é o processo andando, não um problema.
  if (e.avaliacao && e.avaliacao.avaliadorId === e.avaliadorVinculadoId) return 'JA_REFLETE';

  if (e.avaliacao) {
    // Respondida ANTES de manual: o lote recusa a troca nos dois casos, mas a
    // razão que a pessoa precisa ler é a do julgamento já feito.
    if (e.avaliacao.status === 'ENVIADA' || e.avaliacao.respostas > 0) return 'JA_RESPONDIDA';
    if (e.avaliacao.origemDesignacao === 'MANUAL') return 'OUTRO_AVALIADOR_MANUAL';
    return 'OUTRO_AVALIADOR';
  }

  // Sem avaliação: por que ela não vai nascer?
  // A decisão do RH vem antes da régua — ela SOBREPÕE a régua nos dois sentidos,
  // e é a única com autor e motivo registrados para mostrar a quem lê.
  if (e.decisaoDoRh?.decisao === 'EXCLUIR') return 'FORA_POR_DECISAO_RH';
  if (!e.noPublico) return 'FORA_DO_PUBLICO';
  if (e.decisaoDoRh?.decisao !== 'INCLUIR' && !e.regua.elegivel) return 'FORA_PELA_REGUA';
  return 'SEM_AVALIACAO';
}

/** Uma linha do aviso da tela: o que este vínculo muda (ou não) num ciclo aberto. */
export interface SituacaoDoVinculoNoCiclo {
  cicloId: string;
  cicloNome: string;
  situacao: SituacaoNoCiclo;
  /**
   * ⚠️ Vem do BACKEND, não é re-derivado na tela: a tela ordena por ele (o que
   * pede ação primeiro) e uma segunda cópia da regra envelheceria diferente.
   */
  pedeAcao: boolean;
  /** Quem avalia hoje no ciclo — só quando a frase precisa dizer. */
  avaliadorAtual: string | null;
  /** Justificativa da decisão do RH, ou a da régua. Nunca as duas. */
  justificativa: string | null;
  respostas: number;
  statusAvaliacao: string | null;
}
