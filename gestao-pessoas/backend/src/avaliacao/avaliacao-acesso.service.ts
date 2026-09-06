/**
 * Porta de entrada de TODO acesso a avaliação individual.
 *
 * Existe para que a separação de funções seja verificada num lugar só. Ela já
 * mora numa função pura (`separacao-funcoes.ts`), mas função pura só protege
 * quem lembra de chamá-la — e a regra vale para abrir, editar, reabrir,
 * recalcular e responder, que são caminhos diferentes escritos em momentos
 * diferentes. Por isso todos passam por aqui, e há um teste de invariante que
 * varre o fonte cobrando isso (`separacao-funcoes.invariante.spec.ts`).
 */
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  MOTIVO_ACESSO_RESTRITO,
  type AcaoAvaliacao,
  assertNaoEhProprioAvaliado,
  ehAvaliadorDesignado,
  ehProprioAvaliado,
  marcarRestricoes,
  motivoParaRecusarDeTerceiro,
} from './separacao-funcoes.js';

export interface ContextoAcesso {
  usuarioId: string;
  colaboradorId: string;
  ip?: string;
  /**
   * Quem pode LER a avaliação de terceiro — RH_ADMIN e o ADMIN da plataforma
   * (`podeVerResultados`, em `common/roles-rh.ts`). É a única coisa aqui que
   * depende de PAPEL, e só governa leitura: escrever de terceiro não é
   * permitido a papel nenhum.
   *
   * Ausente = false. Falhar fechado é a escolha certa: contexto montado sem o
   * campo é contexto que não sabe se pode, e não saber não é poder.
   */
  podeLerDeTerceiro?: boolean;
}

@Injectable()
export class AvaliacaoAcessoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Comportamento 1: registro individual. Duas perguntas, nesta ordem:
   *
   *   1. **é SOBRE MIM?** → 403 sempre, qualquer papel (separação de funções);
   *   2. **é MINHA PARA FAZER?** → quem não é o avaliador designado LÊ (se for
   *      do RH, com rastro) e **não ESCREVE** — ver `separacao-funcoes.ts`.
   *
   * A negativa vai para `rh.auditoria` ANTES de lançar: tentativa de acesso ao
   * próprio resultado é exatamente o que a trilha existe para mostrar, e ela
   * some se só registrarmos o que deu certo.
   */
  async carregarParaAcao(
    contexto: ContextoAcesso,
    avaliacaoId: string,
    acao: AcaoAvaliacao,
  ): Promise<{ id: string; avaliadoId: string; avaliadorId: string; cicloId: string }> {
    const avaliacao = await this.prisma.avaliacao.findUnique({
      where: { id: avaliacaoId },
      select: { id: true, avaliadoId: true, avaliadorId: true, cicloId: true },
    });
    if (!avaliacao) throw new NotFoundException('Avaliação não encontrada.');

    if (ehProprioAvaliado(contexto.colaboradorId, avaliacao.avaliadoId)) {
      await this.auditoria.registrar({
        entidade: 'Avaliacao',
        entidadeId: avaliacao.id,
        acao: `ACESSO_NEGADO_PROPRIO_AVALIADO:${acao}`,
        usuarioId: contexto.usuarioId,
        justificativa: MOTIVO_ACESSO_RESTRITO,
        ip: contexto.ip,
      });
    }
    assertNaoEhProprioAvaliado(contexto.colaboradorId, avaliacao.avaliadoId, acao);

    // Acesso de terceiro (nem avaliado, nem o avaliador designado). LER é
    // legítimo para o RH — §8 manda deixar rastro de quem leu resultado de quem
    // — mas ESCREVER não é de ninguém: quem responde e envia é o designado.
    if (!ehAvaliadorDesignado(contexto.colaboradorId, avaliacao.avaliadorId)) {
      const motivo = motivoParaRecusarDeTerceiro(acao, contexto.podeLerDeTerceiro === true);

      if (motivo) {
        // Registra ANTES de recusar, como na separação de funções: tentativa de
        // escrever na avaliação de outro avaliador é exatamente o que a trilha
        // existe para mostrar, e ela some se só registrarmos o que deu certo.
        await this.auditoria.registrar({
          entidade: 'Avaliacao',
          entidadeId: avaliacao.id,
          acao: `ACESSO_NEGADO_NAO_DESIGNADO:${acao}`,
          usuarioId: contexto.usuarioId,
          justificativa: motivo,
          ip: contexto.ip,
        });
        throw new ForbiddenException(motivo);
      }

      await this.auditoria.registrar({
        entidade: 'Avaliacao',
        entidadeId: avaliacao.id,
        acao: `ACESSO_TERCEIRO:${acao}`,
        usuarioId: contexto.usuarioId,
        ip: contexto.ip,
      });
    }

    return avaliacao;
  }

  /**
   * Comportamentos 2 e 3: lista de designação e relatório consolidado.
   *
   * ⚠️ **Não filtra.** A linha do próprio usuário aparece marcada com
   * `restrita: true` e o motivo — a gestora precisa estar designada para o
   * superior dela receber a tarefa, e no relatório o total tem de fechar.
   * Sumir com a linha faria a conta não bater sem ninguém entender por quê.
   */
  marcarProprias<T extends { avaliadoId: string }>(
    contexto: ContextoAcesso,
    linhas: readonly T[],
  ) {
    return marcarRestricoes(linhas, contexto.colaboradorId);
  }
}
