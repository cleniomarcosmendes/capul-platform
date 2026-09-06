/**
 * ⭐⭐ SEPARAÇÃO DE FUNÇÕES — ninguém mexe na avaliação em que é o AVALIADO.
 *
 * Vem de dois fatos sobre o RH da Capul: a gestora **monta e apura** o ciclo, e
 * a gestora **também é avaliada** pelo superior dela. Sem esta regra, quem
 * apura tem acesso de escrita ao próprio resultado — num sistema cuja nota tem
 * consequência de mérito.
 *
 * ⚠️ **A verificação é por REGISTRO, não por papel:**
 * `colaboradorIdDoUsuario !== avaliacao.avaliadoId`. Não existe papel que
 * dispense — nem `RH_ADMIN`, nem o `ADMIN` da plataforma, que tem bypass no
 * RolesGuard e **não pode ter aqui**. Escrever isso como "todo mundo menos
 * ADMIN" seria justamente devolver o furo, porque a T.I. costuma ser o segundo
 * RH_ADMIN.
 *
 * ⭐ Decorre daí que precisa haver **pelo menos dois RH_ADMIN**: com um só,
 * ninguém consegue corrigir um problema na avaliação da própria gestora. Está
 * anotado em `common/roles-rh.ts`, onde os papéis são definidos.
 *
 * ── TRÊS COMPORTAMENTOS DIFERENTES. Não são o mesmo, não misture ────────────
 *
 * 1. **Registro individual da própria avaliação → 403 SEMPRE.** Abrir, editar,
 *    reabrir e recalcular, qualquer papel.
 *
 * 2. **Lista de designação → aparece normalmente.** A gestora PRECISA estar
 *    designada, senão o superior dela não recebe a tarefa. O que não se abre é
 *    o conteúdo.
 *
 * 3. **Relatório consolidado → a linha aparece.** Ela é quem gera o relatório e
 *    o total tem de fechar.
 *
 * ── E a regra de ouro dos dois últimos: NÃO FILTRE EM SILÊNCIO ──────────────
 * A linha vem MARCADA (`restrita: true` + motivo), a tela mostra o rótulo e o
 * clique devolve 403 com registro em `rh.auditoria`. Sumir com a linha faria o
 * total não bater, e ninguém teria como descobrir por quê — o relatório passaria
 * a mentir de um jeito que só quem conhece a regra saberia interpretar.
 */
import { ForbiddenException } from '@nestjs/common';

/** Texto único, para tela e auditoria dizerem a mesma coisa. */
export const MOTIVO_ACESSO_RESTRITO = 'Sua própria avaliação — acesso restrito';

/** Ações sobre o registro individual que a regra bloqueia. */
export type AcaoAvaliacao = 'abrir' | 'editar' | 'reabrir' | 'recalcular' | 'responder';

export function ehProprioAvaliado(
  colaboradorIdDoUsuario: string | null | undefined,
  avaliadoId: string | null | undefined,
): boolean {
  // Sem id resolvido não se afirma que NÃO é o próprio — mas quem barra isso é
  // o IdentidadeGuard, antes de chegar aqui (falha fechada no acesso ao módulo).
  if (!colaboradorIdDoUsuario || !avaliadoId) return false;
  return colaboradorIdDoUsuario === avaliadoId;
}

/**
 * Guarda do comportamento 1. Lança 403 quando o usuário é o avaliado.
 * A mensagem diz o que houve e o que fazer — quem lê é o RH.
 */
export function assertNaoEhProprioAvaliado(
  colaboradorIdDoUsuario: string | null | undefined,
  avaliadoId: string | null | undefined,
  acao: AcaoAvaliacao = 'abrir',
): void {
  if (!ehProprioAvaliado(colaboradorIdDoUsuario, avaliadoId)) return;
  throw new ForbiddenException(
    `Não é possível ${acao} a sua própria avaliação. Quem responde por ela é o seu ` +
      'superior; para qualquer correção, procure o outro administrador de RH.',
  );
}

/**
 * ⭐⭐ DESIGNAÇÃO — quem ESCREVE na avaliação é o avaliador designado, e mais ninguém.
 *
 * Regra escrita em `common/roles-rh.ts` desde o primeiro dia ("AVALIADOR responde
 * as avaliações que lhe foram designadas, **e só essas**") e cumprida por um
 * caminho só: a FILA filtra por `avaliadorId`. O registro individual não
 * verificava nada — bastava ter o id para abrir, responder e ENVIAR a avaliação
 * de outro avaliador, com a nota congelada em nome dele. Achado em 06/09/2026
 * com conta real; nada disso chegou a acontecer no banco.
 *
 * ⚠️ **Não confunda com a separação de funções.** Aquela pergunta "esta
 * avaliação é SOBRE MIM?"; esta pergunta "esta avaliação é MINHA PARA FAZER?".
 * São perguntas diferentes sobre a mesma linha, e é por isso que estão em
 * funções diferentes: trocar uma pela outra é o erro que se repete.
 *
 * ── Por que LER é diferente de ESCREVER ─────────────────────────────────────
 * Ler de terceiro é decisão de produto, e está na spec §8, que exige registro em
 * `rh.auditoria` para "acesso a resultado individual por quem não é o avaliador
 * designado" — a frase só faz sentido se esse acesso for permitido. Escrever de
 * terceiro não está decidido em lugar nenhum: é ausência de regra, não permissão.
 * Então a leitura de terceiro segue passando e deixando rastro; a escrita recusa.
 *
 * `reabrir` e `recalcular` são atos DO RH sobre avaliação alheia — é para isso
 * que existem. Não exigem designação (o papel já é exigido no controller), e
 * continuam barrados na própria avaliação pela separação de funções.
 */
type ExigenciaDeDesignacao = 'DESIGNADO' | 'DESIGNADO_OU_LEITOR_RH' | 'ATO_DO_RH';

/**
 * ⚠️ `Record` de propósito, e não uma lista: ação nova na união `AcaoAvaliacao`
 * **não compila** enquanto ninguém disser o que ela exige. Uma lista aceitaria a
 * omissão em silêncio — que é exatamente como `responder` e `editar` passaram a
 * existir sem verificação nenhuma.
 */
export const EXIGENCIA_POR_ACAO: Record<AcaoAvaliacao, ExigenciaDeDesignacao> = {
  abrir: 'DESIGNADO_OU_LEITOR_RH',
  responder: 'DESIGNADO',
  editar: 'DESIGNADO',
  reabrir: 'ATO_DO_RH',
  recalcular: 'ATO_DO_RH',
};

export function ehAvaliadorDesignado(
  colaboradorIdDoUsuario: string | null | undefined,
  avaliadorId: string | null | undefined,
): boolean {
  if (!colaboradorIdDoUsuario || !avaliadorId) return false;
  return colaboradorIdDoUsuario === avaliadorId;
}

/**
 * Decide o que fazer quando quem age NÃO é o avaliador designado.
 *
 * Devolve `null` quando pode seguir (e aí o chamador grava `ACESSO_TERCEIRO`),
 * ou o motivo da recusa — mesmo texto para a tela e para a auditoria, como no
 * `MOTIVO_ACESSO_RESTRITO`.
 */
export function motivoParaRecusarDeTerceiro(
  acao: AcaoAvaliacao,
  podeLerDeTerceiro: boolean,
): string | null {
  const exigencia = EXIGENCIA_POR_ACAO[acao];
  if (exigencia === 'ATO_DO_RH') return null;
  if (exigencia === 'DESIGNADO_OU_LEITOR_RH' && podeLerDeTerceiro) return null;
  if (exigencia === 'DESIGNADO_OU_LEITOR_RH') {
    return (
      'Esta avaliação foi designada a outra pessoa. Se a designação está errada, ' +
      'quem corrige é o RH, na tela de Designação.'
    );
  }
  return (
    'Só o avaliador designado responde e envia esta avaliação — nem o RH responde ' +
    'no lugar dele. Se a designação está errada, o RH a corrige na tela de Designação.'
  );
}

/** Guarda da designação. Lança 403 com o motivo, ou passa. */
export function assertPodeAgirSobreAvaliacaoDeOutro(
  acao: AcaoAvaliacao,
  podeLerDeTerceiro: boolean,
): void {
  const motivo = motivoParaRecusarDeTerceiro(acao, podeLerDeTerceiro);
  if (motivo) throw new ForbiddenException(motivo);
}

export interface Restricao {
  /** true quando a linha é do próprio usuário. A tela mostra o rótulo e desabilita o clique. */
  restrita: boolean;
  /** Preenchido só quando `restrita`. Mesmo texto na tela e na auditoria. */
  motivoRestricao?: string;
}

/**
 * Comportamentos 2 e 3: MARCA as linhas do próprio usuário em vez de removê-las.
 * Preserva quantidade e totais — quem filtra aqui quebra o relatório de quem
 * está lendo.
 */
export function marcarRestricoes<T extends { avaliadoId: string }>(
  linhas: readonly T[],
  colaboradorIdDoUsuario: string | null | undefined,
): (T & Restricao)[] {
  return linhas.map((linha) =>
    ehProprioAvaliado(colaboradorIdDoUsuario, linha.avaliadoId)
      ? { ...linha, restrita: true, motivoRestricao: MOTIVO_ACESSO_RESTRITO }
      : { ...linha, restrita: false },
  );
}

/**
 * ⭐ ESCOPO DA REAPURAÇÃO EM MASSA.
 *
 * Com a separação entre avaliar e apurar, mudar um peso deixou de exigir
 * reabertura: reapura-se e pronto. Mas reapuração é ato de CICLO, rodado pelo
 * RH_ADMIN — que é a gestora, que está dentro do ciclo. Bloqueá-la pela regra do
 * §1 faria a linha dela ficar desatualizada e o total não fechar; então a
 * reapuração processa todo mundo, inclusive ela.
 *
 * ⚠️ O que fecha a porta dos fundos: **a reapuração não aceita filtro que a
 * reduza a uma pessoa.** Ou é o ciclo inteiro, ou é uma aplicação — nunca por
 * colaborador. Sem isto, bastaria escolher o filtro que isola a própria linha
 * para contornar a separação de funções por um caminho legítimo.
 *
 * "Recalcular ESTA avaliação", apontando para um registro, continua sendo ato
 * individual e passa por `assertNaoEhProprioAvaliado` — 403 no próprio.
 */
export type EscopoReapuracao =
  | { tipo: 'CICLO'; cicloId: string }
  | { tipo: 'APLICACAO'; aplicacaoId: string };

export function assertEscopoReapuracaoValido(escopo: EscopoReapuracao): void {
  if (escopo.tipo === 'CICLO' && escopo.cicloId) return;
  if (escopo.tipo === 'APLICACAO' && escopo.aplicacaoId) return;
  throw new ForbiddenException(
    'A reapuração só pode ser feita por ciclo inteiro ou por aplicação. ' +
      'Recortar por colaborador contornaria a separação de funções.',
  );
}

/**
 * Conflito mais fraco: o AVALIADO é uma das pessoas que montaram e ponderaram o
 * instrumento pelo qual está sendo avaliado.
 *
 * Note que isto é propriedade da AVALIAÇÃO, não de quem está olhando para ela —
 * vale igual para o próprio, para o avaliador e para o relatório. E não é o
 * mesmo caso de `ehProprioAvaliado`: aqui a pessoa não toca no próprio registro,
 * mas decidiu quanto vale cada critério que a mede.
 *
 * Não bloqueia, porque num RH pequeno pode ser inevitável. Fica **registrado em
 * auditoria e sinalizado na tela**, para quem lê o resultado saber.
 */
export function conflitoDeInstrumento(
  avaliadoId: string | null | undefined,
  autoresDoModelo: readonly string[],
): boolean {
  return !!avaliadoId && autoresDoModelo.includes(avaliadoId);
}
