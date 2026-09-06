/**
 * QUEM ENTRA NO CICLO — a régua que monta a lista INICIAL da designação.
 *
 * Decisões do RH (05/09/2026):
 *
 *   1. **Presidente e Vice não são avaliados.** Regra FIXA, não configurável —
 *      quem avaliaria o presidente? Excluídos sempre, com motivo registrado.
 *   2. **Afastados**: opção do ciclo, resolvida pela situação na **data-base**,
 *      não na data em que a lista é montada. Padrão: não incluir.
 *   3. **Aprendizes entram normalmente.** Não há régua binária para eles — a
 *      gestora de RH monta uma **aplicação própria**, com questionário próprio e
 *      sem critérios cadastrais. Ver docs/OBSERVACAO_RH_APRENDIZES.md.
 *
 * ⚠️ Esta régua monta a lista inicial e **nada mais**. A designação permite
 * ajuste manual, e quem sair fica registrado com o motivo. Ninguém some da lista
 * sem rastro — é a mesma regra que vale para o relatório e para a fila de
 * designação: marcar, nunca filtrar em silêncio.
 */
import type { Situacao } from '../common/elegibilidade.js';

export type MotivoExclusao =
  /** Cargo que a empresa decidiu não avaliar (Presidente, Vice). Regra fixa. */
  | 'CARGO_INELEGIVEL'
  /** Política do ciclo — hoje, só "não incluir afastados". */
  | 'REGRA_CICLO'
  /** O RH tirou da lista na designação. Exige justificativa de quem tirou. */
  | 'MANUAL_RH';

/**
 * `RA_CATFUNC` que a empresa não avalia. Fixo de propósito: virar parâmetro
 * abriria a porta para alguém "configurar" a própria saída do ciclo.
 * `P` = diretoria estatutária (Presidente e Vice — 2 pessoas em 05/09/2026).
 */
export const CATEGORIAS_INELEGIVEIS: readonly string[] = ['P'];

export interface CandidatoDesignacao {
  colaboradorId: string;
  matricula: string;
  nome: string;
  /** `RA_CATFUNC`. */
  categoriaFuncional?: string | null;
  /**
   * ⚠️ Situação **na data-base do ciclo**, não a de hoje. Quem resolve isso é o
   * chamador; a régua só decide com o que recebe. Ver a nota no fim do arquivo.
   */
  situacaoNaDataBase: Situacao;
}

export interface PoliticaCiclo {
  /** Padrão do RH: não incluir. */
  incluirAfastados: boolean;
}

export const POLITICA_PADRAO: PoliticaCiclo = { incluirAfastados: false };

export interface ResultadoElegibilidade {
  elegivel: boolean;
  motivo: MotivoExclusao | null;
  /** Frase para a tela e para o registro. Sempre preenchida quando exclui. */
  justificativa: string | null;
}

const ELEGIVEL: ResultadoElegibilidade = { elegivel: true, motivo: null, justificativa: null };

export function avaliarElegibilidade(
  candidato: CandidatoDesignacao,
  politica: PoliticaCiclo = POLITICA_PADRAO,
): ResultadoElegibilidade {
  const categoria = (candidato.categoriaFuncional ?? '').trim().toUpperCase();

  if (CATEGORIAS_INELEGIVEIS.includes(categoria)) {
    return {
      elegivel: false,
      motivo: 'CARGO_INELEGIVEL',
      justificativa:
        'Cargo de diretoria estatutária (Presidente/Vice), que a empresa não avalia neste processo.',
    };
  }

  if (candidato.situacaoNaDataBase === 'DEMITIDO') {
    return {
      elegivel: false,
      motivo: 'REGRA_CICLO',
      justificativa: 'Não estava na empresa na data-base do ciclo.',
    };
  }

  if (candidato.situacaoNaDataBase === 'AFASTADO' && !politica.incluirAfastados) {
    return {
      elegivel: false,
      motivo: 'REGRA_CICLO',
      justificativa:
        'Afastado na data-base do ciclo, e este ciclo está configurado para não incluir afastados.',
    };
  }

  // Férias entra: é transitório, a pessoa está no quadro e foi avaliável no
  // período. Aprendiz entra: não há régua binária para eles — o recorte certo é
  // uma aplicação própria, sem critérios cadastrais.
  return ELEGIVEL;
}

export interface ListaInicial {
  incluidos: CandidatoDesignacao[];
  excluidos: (CandidatoDesignacao & { motivo: MotivoExclusao; justificativa: string })[];
}

/**
 * Monta a lista inicial. Devolve os DOIS lados — os excluídos não são
 * descartados, são devolvidos com o motivo, para a tela mostrar e o registro
 * guardar.
 */
export function montarListaInicial(
  candidatos: readonly CandidatoDesignacao[],
  politica: PoliticaCiclo = POLITICA_PADRAO,
): ListaInicial {
  const incluidos: CandidatoDesignacao[] = [];
  const excluidos: ListaInicial['excluidos'] = [];

  for (const candidato of candidatos) {
    const r = avaliarElegibilidade(candidato, politica);
    if (r.elegivel) incluidos.push(candidato);
    else excluidos.push({ ...candidato, motivo: r.motivo!, justificativa: r.justificativa! });
  }

  return { incluidos, excluidos };
}

/*
 * ── NOTA SOBRE "SITUAÇÃO NA DATA-BASE" ──────────────────────────────────────
 * Hoje `rh.colaborador.situacao` guarda a situação CORRENTE, não a histórica.
 * Para o ciclo em andamento (o piloto) as duas coincidem. Para reabrir ou
 * reapurar um ciclo antigo, não coincidem — é o mesmo problema que o histórico
 * funcional resolveu para a função (`rh.colaborador_funcao_historico`).
 *
 * Esta régua já recebe a situação como parâmetro justamente para que resolver a
 * origem dela seja uma decisão separada, e não uma reescrita da regra. Se um dia
 * for preciso, o caminho é o mesmo: persistir o histórico de situação no sync.
 */
