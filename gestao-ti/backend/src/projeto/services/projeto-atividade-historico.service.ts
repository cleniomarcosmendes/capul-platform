import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ProjetoHelpersService } from './projeto-helpers.service.js';

export type TipoEventoAtividade =
  | 'CRIADA'
  | 'STATUS_ALTERADO'
  | 'TITULO_ALTERADO'
  | 'RESPONSAVEL_ALTERADO'
  | 'FASE_ALTERADA'
  | 'TEMPO_INICIADO'
  | 'TEMPO_ENCERRADO'
  | 'COMENTARIO_ADICIONADO';

/**
 * Timeline imutável da tarefa (aba "Histórico" do drawer).
 * Mesmo padrão de ParadaHistorico — append-only.
 */
@Injectable()
export class ProjetoAtividadeHistoricoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly helpers: ProjetoHelpersService,
  ) {}

  /**
   * Registra um evento. Fire-and-forget: nunca lança — histórico é
   * observabilidade e não pode quebrar/atrasar o fluxo principal
   * (mesma postura das notificações neste módulo).
   */
  registrar(
    atividadeId: string,
    tipo: TipoEventoAtividade,
    opts: {
      descricao?: string;
      usuarioId?: string | null;
      metadata?: Record<string, unknown>;
    } = {},
  ): void {
    this.prisma.atividadeHistorico
      .create({
        data: {
          atividadeId,
          tipo,
          descricao: opts.descricao,
          usuarioId: opts.usuarioId ?? undefined,
          metadata: (opts.metadata ?? undefined) as never,
        },
      })
      .catch((err: unknown) =>
        console.error(
          'atividade_historico error:',
          err instanceof Error ? err.message : err,
        ),
      );
  }

  async listar(projetoId: string, atividadeId: string) {
    await this.helpers.ensureProjetoExists(projetoId);
    const atividade = await this.prisma.atividadeProjeto.findFirst({
      where: { id: atividadeId, projetoId },
      select: { id: true },
    });
    if (!atividade)
      throw new NotFoundException('Tarefa nao encontrada neste projeto');

    return this.prisma.atividadeHistorico.findMany({
      where: { atividadeId },
      include: { usuario: { select: { id: true, nome: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
