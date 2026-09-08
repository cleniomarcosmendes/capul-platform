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
 * ⚠️ **Não checa a matrícula do colaborador contra a régua de elegibilidade.**
 * Um avaliador afastado tem conta e permissão e continua sem conseguir entrar
 * (o `IdentidadeGuard` exige colaborador elegível) — mas isso é estado do RH,
 * muda sozinho, e misturá-lo aqui faria o aviso piscar por motivo errado.
 */

export type AcessoDoAvaliador = 'OK' | 'SEM_CONTA' | 'CONTA_INATIVA' | 'SEM_PERMISSAO';

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
export function classificarAcesso(conta: ContaEncontrada | null): AcessoDoAvaliador {
  if (!conta) return 'SEM_CONTA';
  if (conta.statusConta !== 'ATIVO') return 'CONTA_INATIVA';
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
    case 'OK':
      return null;
  }
}
