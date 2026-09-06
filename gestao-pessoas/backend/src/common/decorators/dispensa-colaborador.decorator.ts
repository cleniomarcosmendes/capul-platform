import { SetMetadata } from '@nestjs/common';

export const DISPENSA_COLABORADOR_KEY = 'dispensaVinculoDeColaborador';

/**
 * Dispensa a rota de exigir que o usuário logado seja um COLABORADOR.
 *
 * O `IdentidadeGuard` resolve `req.colaborador` e nega o acesso a quem não tem
 * matrícula ou não bate com colaborador ativo — falha fechada, porque sem esse
 * id não há como aplicar a separação de funções ("ninguém mexe na própria
 * avaliação").
 *
 * ⚠️ Só que essa regra existe para proteger **registros de avaliação**. Há
 * operações de sistema que não tocam avaliação nenhuma e precisam rodar antes de
 * existir colaborador: a **primeira sincronização** é o caso exato — ela é quem
 * CRIA os colaboradores, e sem esta dispensa o módulo não teria como sair do
 * zero.
 *
 * O `motivo` é obrigatório e aparece no log: dispensa sem justificativa é como
 * a exceção vira regra. **Nunca use em rota que leia ou escreva `rh.avaliacao`**
 * — lá a identidade é o que sustenta a separação de funções.
 */
export const DispensaVinculoDeColaborador = (motivo: string) =>
  SetMetadata(DISPENSA_COLABORADOR_KEY, motivo);
