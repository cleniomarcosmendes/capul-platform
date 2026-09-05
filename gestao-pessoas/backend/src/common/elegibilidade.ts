/**
 * ⭐ DEFINIÇÃO ÚNICA DE "COLABORADOR ATIVO". Não escreva outra em lugar nenhum.
 *
 * Três lugares precisam concordar sobre quem está ativo — o **sync** (que filtra
 * no Protheus), a **busca** (telas do RH) e a **resolução usuário → colaborador**
 * (a regra de separação de funções). Critérios divergentes espalhados pelo código
 * foi exatamente como o select antigo começou a errar, e a divergência não dá
 * erro: só entrega listas diferentes para a mesma pergunta.
 *
 * Por isso o critério mora aqui, uma vez, nas duas formas em que é usado — o
 * `WHERE` do Protheus e o predicado sobre o nosso enum — com teste provando que
 * as duas concordam para todas as combinações.
 *
 * ⚠️ **Ativo NÃO é `situacao = ATIVO`.** Férias e afastamento são transitórios e
 * a pessoa continua no quadro. Medido no Protheus em 05/09/2026, dos 1.036
 * elegíveis: 889 em situação normal, **98 em férias, 47 afastados**. Filtrar por
 * `situacao: 'ATIVO'` derrubaria 145 pessoas de todas as listas do módulo, sem
 * mensagem nenhuma.
 *
 * (Se um dia o RH decidir que afastado não é avaliado, isso é regra de
 * DESIGNAÇÃO — quem entra no ciclo — e não de elegibilidade cadastral. São
 * perguntas diferentes e não devem cair no mesmo filtro.)
 *
 * ⚠️ Se um dia passarem a usar `RA_SITUACA` no lugar de `RA_SITFOLH`, muda-se
 * AQUI e os três pontos acompanham. Alinhar tudo de uma vez é o ponto deste
 * arquivo existir.
 */

/** Espelha `rh.SituacaoColaborador` sem depender do client gerado do Prisma. */
export const SITUACOES = ['ATIVO', 'AFASTADO', 'FERIAS', 'DEMITIDO'] as const;
export type Situacao = (typeof SITUACOES)[number];

/**
 * Quem o módulo enxerga. Tudo que não é demissão.
 * Espelha o filtro do Protheus abaixo — o teste garante.
 */
export const SITUACOES_ELEGIVEIS: readonly Situacao[] = ['ATIVO', 'AFASTADO', 'FERIAS'];

/**
 * O filtro do lado do Protheus (SRA010), usado pelo sync.
 * `D_E_L_E_T_` = registro não excluído; `RA_DEMISSA` em branco = sem demissão;
 * `RA_SITFOLH <> 'D'` = situação de folha diferente de demitido.
 */
export const FILTRO_SRA010_ELEGIVEL =
  "D_E_L_E_T_ = ' ' AND RA_DEMISSA = ' ' AND RA_SITFOLH <> 'D'";

/** Filtro Prisma para as consultas do módulo. Use este, não escreva o `in` à mão. */
export const WHERE_ELEGIVEL = { situacao: { in: [...SITUACOES_ELEGIVEIS] } } as const;

export function elegivel(situacao: Situacao | string | null | undefined): boolean {
  return SITUACOES_ELEGIVEIS.includes(situacao as Situacao);
}

/**
 * Tradução do Protheus para o nosso enum — o **único** ponto que sabe o que
 * `RA_SITFOLH` significa. Usado pelo sync ao gravar `colaborador.situacao`.
 *
 * `RA_SITFOLH`: ' ' normal · 'F' férias · 'A' afastado · 'D' demitido.
 * Demissão preenchida vence a situação de folha: a pessoa saiu.
 */
export function situacaoDoProtheus(
  raDemissa: string | null | undefined,
  raSitfolh: string | null | undefined,
): Situacao {
  if ((raDemissa ?? '').trim()) return 'DEMITIDO';
  switch ((raSitfolh ?? '').trim().toUpperCase()) {
    case 'D':
      return 'DEMITIDO';
    case 'F':
      return 'FERIAS';
    case 'A':
      return 'AFASTADO';
    default:
      return 'ATIVO';
  }
}

/**
 * O mesmo filtro do Protheus, em TypeScript — existe para o teste poder provar
 * que `situacaoDoProtheus` + `elegivel` dão a MESMA resposta que
 * `FILTRO_SRA010_ELEGIVEL` daria, sem precisar de banco Oracle no CI.
 */
export function elegivelNoProtheus(linha: {
  D_E_L_E_T_?: string | null;
  RA_DEMISSA?: string | null;
  RA_SITFOLH?: string | null;
}): boolean {
  const deletado = (linha.D_E_L_E_T_ ?? ' ') !== ' ';
  const demitido = !!(linha.RA_DEMISSA ?? '').trim();
  const situacaoD = (linha.RA_SITFOLH ?? '').trim().toUpperCase() === 'D';
  return !deletado && !demitido && !situacaoD;
}
