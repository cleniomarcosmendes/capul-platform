/**
 * ⭐⭐ DESIGNAR NÃO DÁ ACESSO — e a tela não dizia isso.
 *
 * Achado do ciclo de simulação (09/09): **24 das 50 designações — 48% — estavam
 * em avaliadores SEM CONTA na plataforma**, e a "Fila por avaliador" os mostrava
 * exatamente como os demais. O ciclo abriria, o RH veria filas cheias, e metade
 * das avaliações nunca seria respondida — sem erro, sem aviso, sem nada que
 * denunciasse. O defeito só apareceria quando alguém fosse cobrar o atraso.
 *
 * ⚠️ É a família do modelo de DEMONSTRAÇÃO, **sem a guarda**: lá existe recusa
 * (e ela chega tarde, só na abertura); aqui não existia recusa nenhuma.
 *
 * ── Por que é AVISO e não bloqueio ──────────────────────────────────────────
 * A designação é legítima: quem avalia quem é decisão do RH, e a pessoa existe
 * como colaborador. O que falta é **conta**, que é ato do Configurador e de
 * outra pessoa. Bloquear a designação puniria o RH por uma pendência que não é
 * dele e que pode ser resolvida depois — inclusive com o ciclo já aberto.
 * Então: aparece na fila, aparece na prévia da abertura, e não impede nada.
 *
 * ── As TRÊS maneiras de não conseguir responder ─────────────────────────────
 * São exatamente os três degraus que o `IdentidadeGuard` + o `RolesGuard` já
 * cobram de quem tenta entrar — aqui eles são consultados ANTES, sobre outra
 * pessoa:
 *
 *   SEM_CONTA      não há `core.usuarios` com esta chapa;
 *   CONTA_INATIVA  há conta, mas desativada;
 *   SEM_PERMISSAO  há conta ativa, mas nenhuma permissão no GESTAO_PESSOAS.
 *
 * ⚠️ Hoje (09/09) os 24 são todos `SEM_CONTA`. Os outros dois estados entram
 * porque são **igualmente invisíveis** e igualmente fatais — e porque descobrir
 * que faltavam depois custaria a mesma investigação de novo.
 *
 * ⚠️⚠️ **CORREÇÃO DE UM FATO ERRADO ESCRITO AQUI (12/09).** Este comentário
 * dizia: *"um avaliador afastado tem conta e permissão e continua sem conseguir
 * entrar (o `IdentidadeGuard` exige colaborador elegível)"*. **É falso.**
 *
 * `SITUACOES_ELEGIVEIS` é `['ATIVO', 'AFASTADO', 'FERIAS']` — o afastado e quem
 * está de férias **entram normalmente**. O que o guard exige é estar entre os
 * elegíveis, e eles estão.
 *
 * A confusão era entre DUAS coisas com o mesmo nome:
 *   • `SITUACOES_ELEGIVEIS` — a definição de "ativo" para ACESSO ao módulo;
 *   • `avaliarElegibilidade(…, incluirAfastados)` — a régua DE UM CICLO, que
 *     pode excluir o afastado de ser AVALIADO.
 * A segunda não fecha porta nenhuma para o avaliador.
 *
 * ⭐ Daí sai o QUARTO degrau, que faltava e é o fatal:
 *
 *   SEM_VINCULO   a matrícula não corresponde a nenhum colaborador entre os
 *                 elegíveis — DEMITIDO é o caso. Tem conta, tem permissão, e
 *                 leva **403 no `IdentidadeGuard`**. A prévia dizia "OK".
 *
 * ⚠️ E férias/afastamento seguem **fora desta classificação**, de propósito —
 * mas por outro motivo, e o motivo mudou: não é que não consigam entrar (eles
 * conseguem), é que **estar de licença não é problema de ACESSO**. Vai como
 * aviso de DISPONIBILIDADE, em campo separado, para não misturar "não pode
 * entrar" com "não está trabalhando" — que pedem providências diferentes.
 * Medido em 12/09: no Piloto são **10 avaliadores em férias/afastado com 264
 * das 894 avaliações**.
 */

export type AcessoDoAvaliador = 'OK' | 'SEM_CONTA' | 'CONTA_INATIVA' | 'SEM_PERMISSAO' | 'SEM_VINCULO';

export interface ContaEncontrada {
  usuarioId: string;
  username: string;
  /** `status` de `core.usuarios`. */
  statusConta: string;
  /** Quantas permissões ATIVAS a conta tem no módulo GESTAO_PESSOAS. */
  permissoesNoModulo: number;
}

/**
 * Classifica UMA pessoa. Pura: quem busca é o serviço, para isto poder ser
 * testado sem banco e para a ordem dos degraus ficar escrita num lugar só.
 *
 * ⚠️ A ordem importa e é a mesma do login: sem conta → conta inativa → sem
 * permissão. Reportar "sem permissão" para quem não tem conta mandaria alguém
 * ao Configurador procurar uma tela de permissões de um usuário que não existe.
 */
export function classificarAcesso(
  conta: ContaEncontrada | null,
  /**
   * ⭐ `false` quando a matrícula não corresponde a nenhum colaborador entre os
   * elegíveis (DEMITIDO, ou matrícula que sumiu do cadastro). É o degrau que
   * faltava, e é o mais fatal: tem conta, tem permissão, e leva 403.
   * `undefined` = quem chamou não conferiu — a classificação não opina.
   */
  temVinculo?: boolean,
): AcessoDoAvaliador {
  if (!conta) return 'SEM_CONTA';
  if (conta.statusConta !== 'ATIVO') return 'CONTA_INATIVA';
  // ⚠️ DEPOIS de conta e status, ANTES de permissão: mandar alguém ao
  // Configurador dar permissão a quem foi desligado é o pior conselho dos três.
  if (temVinculo === false) return 'SEM_VINCULO';
  if (conta.permissoesNoModulo === 0) return 'SEM_PERMISSAO';
  return 'OK';
}

/** A frase que a tela mostra — no backend, como todas as outras deste módulo. */
export function motivoDoAcesso(acesso: AcessoDoAvaliador): string | null {
  switch (acesso) {
    case 'SEM_CONTA':
      return 'não tem conta na plataforma — não consegue entrar para responder';
    case 'CONTA_INATIVA':
      return 'tem conta, mas ela está desativada';
    case 'SEM_PERMISSAO':
      return 'tem conta ativa, mas nenhuma permissão no módulo Gestão de Pessoas';
    case 'SEM_VINCULO':
      return (
        'tem conta e permissão, mas não está entre os colaboradores ativos do cadastro ' +
        '(desligado, ou matrícula que saiu do Protheus) — o acesso ao módulo é negado na entrada'
      );
    case 'OK':
      return null;
  }
}
