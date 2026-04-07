import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificacaoService } from '../../notificacao/notificacao.service.js';
import { ProjetoHelpersService } from './projeto-helpers.service.js';
import { isGestor } from '../../common/constants/roles.constant.js';

@Injectable()
export class ProjetoAtividadeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacaoService: NotificacaoService,
    private readonly helpers: ProjetoHelpersService,
  ) {}

  async listAtividades(projetoId: string) {
    await this.helpers.ensureProjetoExists(projetoId);
    return this.prisma.atividadeProjeto.findMany({
      where: { projetoId },
      include: {
        usuario: { select: { id: true, nome: true } },
        fase: { select: { id: true, nome: true } },
        pendencia: { select: { id: true, numero: true, titulo: true, status: true } },
        _count: { select: { registrosTempo: true, comentarios: true } },
        registrosTempo: {
          where: { horaFim: null },
          select: { id: true, usuarioId: true, horaInicio: true },
        },
        responsaveis: {
          include: { usuario: { select: { id: true, nome: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { dataAtividade: 'desc' },
    });
  }

  async addAtividade(
    projetoId: string,
    dto: { titulo: string; descricao?: string; faseId?: string; pendenciaId?: string; dataInicio?: string; dataFimPrevista?: string; responsavelIds?: string[] },
    userId: string,
  ) {
    await this.helpers.ensureProjetoExists(projetoId);

    if (dto.faseId) {
      const fase = await this.prisma.faseProjeto.findFirst({
        where: { id: dto.faseId, projetoId },
      });
      if (!fase) throw new NotFoundException('Fase nao encontrada neste projeto');
    }

    // Valida pendencia se informada
    if (dto.pendenciaId) {
      const pendencia = await this.prisma.pendenciaProjeto.findFirst({
        where: { id: dto.pendenciaId, projetoId },
      });
      if (!pendencia) throw new NotFoundException('Pendencia nao encontrada neste projeto');
    }

    const atividade = await this.prisma.atividadeProjeto.create({
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        projetoId,
        usuarioId: userId,
        faseId: dto.faseId,
        pendenciaId: dto.pendenciaId,
        dataInicio: dto.dataInicio ? new Date(dto.dataInicio) : undefined,
        dataFimPrevista: dto.dataFimPrevista ? new Date(dto.dataFimPrevista) : undefined,
      },
      include: {
        usuario: { select: { id: true, nome: true } },
        fase: { select: { id: true, nome: true } },
        pendencia: { select: { id: true, numero: true, titulo: true, status: true } },
        projeto: { select: { nome: true } },
      },
    });

    // Criar responsaveis (se informados, senao o criador e o unico responsavel)
    const responsavelIds = dto.responsavelIds && dto.responsavelIds.length > 0
      ? dto.responsavelIds
      : [userId];

    if (responsavelIds.length > 0) {
      await this.prisma.atividadeResponsavel.createMany({
        data: responsavelIds.map((uid) => ({ atividadeId: atividade.id, usuarioId: uid })),
        skipDuplicates: true,
      });
    }

    // Notificar todos os responsaveis (exceto quem criou)
    const notificarIds = responsavelIds.filter((uid) => uid !== userId);
    if (notificarIds.length > 0) {
      this.notificacaoService.criarParaUsuarios(
        notificarIds,
        'ATIVIDADE_ATRIBUIDA',
        `Nova atividade: ${dto.titulo}`,
        `Voce foi atribuido a atividade "${dto.titulo}" no projeto "${atividade.projeto.nome}".`,
        { projetoId, atividadeId: atividade.id },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }

    return atividade;
  }

  async updateAtividade(
    projetoId: string,
    atividadeId: string,
    dto: { titulo?: string; descricao?: string; faseId?: string; status?: string; dataInicio?: string; dataFimPrevista?: string; responsavelIds?: string[] },
  ) {
    const atividade = await this.prisma.atividadeProjeto.findFirst({
      where: { id: atividadeId, projetoId },
    });
    if (!atividade) throw new NotFoundException('Atividade nao encontrada neste projeto');

    if (dto.faseId) {
      const fase = await this.prisma.faseProjeto.findFirst({
        where: { id: dto.faseId, projetoId },
      });
      if (!fase) throw new NotFoundException('Fase nao encontrada neste projeto');
    }

    const data: Record<string, unknown> = {};
    if (dto.titulo !== undefined) data.titulo = dto.titulo;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.faseId !== undefined) data.faseId = dto.faseId || null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.dataInicio !== undefined) data.dataInicio = dto.dataInicio ? new Date(dto.dataInicio) : null;
    if (dto.dataFimPrevista !== undefined) data.dataFimPrevista = dto.dataFimPrevista ? new Date(dto.dataFimPrevista) : null;

    const updated = await this.prisma.atividadeProjeto.update({
      where: { id: atividadeId },
      data,
      include: {
        usuario: { select: { id: true, nome: true } },
        fase: { select: { id: true, nome: true } },
        pendencia: { select: { id: true, status: true } },
      },
    });

    // Sync responsaveis se informados
    const responsaveisAntigos = await this.prisma.atividadeResponsavel.findMany({
      where: { atividadeId },
      select: { usuarioId: true },
    });
    const idsAntigos = responsaveisAntigos.map((r) => r.usuarioId);

    if (dto.responsavelIds !== undefined) {
      await this.prisma.atividadeResponsavel.deleteMany({ where: { atividadeId } });
      if (dto.responsavelIds.length > 0) {
        await this.prisma.atividadeResponsavel.createMany({
          data: dto.responsavelIds.map((uid) => ({ atividadeId, usuarioId: uid })),
          skipDuplicates: true,
        });
      }

      // Notificar novos responsaveis atribuidos
      const novos = dto.responsavelIds.filter((uid) => !idsAntigos.includes(uid) && uid !== atividade.usuarioId);
      if (novos.length > 0) {
        const proj = await this.prisma.projeto.findUnique({ where: { id: projetoId }, select: { nome: true } });
        this.notificacaoService.criarParaUsuarios(
          novos, 'ATIVIDADE_ATRIBUIDA',
          `Voce foi atribuido a atividade "${updated.titulo}"`,
          `Voce foi atribuido a atividade "${updated.titulo}" no projeto "${proj?.nome}".`,
          { projetoId, atividadeId },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }

    // Notificar responsaveis sobre mudanca de status
    if (dto.status && dto.status !== atividade.status) {
      const statusLabelsNotif: Record<string, string> = {
        PENDENTE: 'Pendente', EM_ANDAMENTO: 'Em Andamento', CONCLUIDA: 'Concluida', CANCELADA: 'Cancelada',
      };
      const idsResponsaveis = (dto.responsavelIds ?? idsAntigos).filter((uid) => uid !== atividade.usuarioId);
      if (idsResponsaveis.length > 0) {
        const proj = await this.prisma.projeto.findUnique({ where: { id: projetoId }, select: { nome: true } });
        this.notificacaoService.criarParaUsuarios(
          idsResponsaveis, 'PROJETO_ATUALIZADO',
          `Atividade "${updated.titulo}" — ${statusLabelsNotif[dto.status] || dto.status}`,
          `A atividade "${updated.titulo}" do projeto "${proj?.nome}" teve o status alterado para ${statusLabelsNotif[dto.status] || dto.status}.`,
          { projetoId, atividadeId },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }

    // Registrar movimentacao na timeline da pendencia (se vinculada)
    if (atividade.pendenciaId) {
      const statusLabels: Record<string, string> = {
        PENDENTE: 'Pendente', EM_ANDAMENTO: 'Em Andamento', CONCLUIDA: 'Concluida', CANCELADA: 'Cancelada',
      };
      const mudancas: string[] = [];
      if (dto.status && dto.status !== atividade.status) {
        mudancas.push(`status alterado para ${statusLabels[dto.status] || dto.status}`);
      }
      if (dto.titulo && dto.titulo !== atividade.titulo) {
        mudancas.push(`titulo alterado para "${dto.titulo}"`);
      }
      if (dto.responsavelIds !== undefined) {
        mudancas.push('responsaveis atualizados');
      }
      if (mudancas.length > 0) {
        this.prisma.interacaoPendencia.create({
          data: {
            tipo: 'COMENTARIO',
            descricao: `Tarefa "${updated.titulo}": ${mudancas.join(', ')}`,
            pendenciaId: atividade.pendenciaId,
            usuarioId: atividade.usuarioId,
            publica: true,
          },
        }).catch((err) => console.error('Notificacao error:', err.message));
      }
    }

    // Sync: ao concluir atividade vinculada a pendencia, verificar se pode concluir a pendencia
    if (dto.status === 'CONCLUIDA' && updated.pendencia && updated.pendencia.status !== 'CONCLUIDA' && updated.pendencia.status !== 'CANCELADA') {
      const outrasAtividades = await this.prisma.atividadeProjeto.count({
        where: {
          pendenciaId: updated.pendencia.id,
          id: { not: atividadeId },
          status: { in: ['PENDENTE', 'EM_ANDAMENTO'] },
        },
      });
      if (outrasAtividades === 0) {
        await this.prisma.pendenciaProjeto.update({
          where: { id: updated.pendencia.id },
          data: { status: 'CONCLUIDA' },
        });
        await this.prisma.interacaoPendencia.create({
          data: {
            tipo: 'STATUS_ALTERADO',
            descricao: 'Pendencia concluida automaticamente — todas as atividades vinculadas foram concluidas',
            pendenciaId: updated.pendencia.id,
            usuarioId: atividade.usuarioId,
          },
        });
      }
    }

    // Resumo da fase: retornar sempre que houver mudanca de status em tarefa vinculada a fase
    let faseResumo: {
      faseId: string;
      faseNome: string;
      faseStatus: string;
      todasFinalizadas: boolean;
      tarefas: { titulo: string; status: string; dataFimPrevista: string | null; responsaveis: string[] }[];
    } | null = null;
    if (dto.status && dto.status !== atividade.status && atividade.faseId) {
      const fase = await this.prisma.faseProjeto.findUnique({ where: { id: atividade.faseId } });
      if (fase) {
        const todasTarefas = await this.prisma.atividadeProjeto.findMany({
          where: { faseId: atividade.faseId },
          select: {
            titulo: true,
            status: true,
            dataFimPrevista: true,
            responsaveis: { include: { usuario: { select: { nome: true } } } },
          },
          orderBy: { dataAtividade: 'asc' },
        });
        // Considerar a tarefa atual com o novo status (pois o update ja ocorreu)
        const pendentes = todasTarefas.filter((t) =>
          t.status === 'PENDENTE' || t.status === 'EM_ANDAMENTO',
        ).length;
        const todasFinalizadas = pendentes === 0 && fase.status !== 'APROVADA' && fase.status !== 'REJEITADA';
        faseResumo = {
          faseId: fase.id,
          faseNome: fase.nome,
          faseStatus: fase.status,
          todasFinalizadas,
          tarefas: todasTarefas.map((t) => ({
            titulo: t.titulo,
            status: t.status,
            dataFimPrevista: t.dataFimPrevista ? t.dataFimPrevista.toISOString() : null,
            responsaveis: t.responsaveis.map((r) => r.usuario.nome),
          })),
        };
      }
    }

    return { ...updated, faseResumo };
  }

  async removeAtividade(projetoId: string, atividadeId: string) {
    const atividade = await this.prisma.atividadeProjeto.findFirst({
      where: { id: atividadeId, projetoId },
      include: { _count: { select: { registrosTempo: true } } },
    });
    if (!atividade) throw new NotFoundException('Atividade nao encontrada neste projeto');

    if (atividade._count.registrosTempo > 0) {
      throw new BadRequestException(
        `Nao e possivel excluir atividade com ${atividade._count.registrosTempo} registro(s) de tempo. Remova os registros antes.`,
      );
    }

    // Registrar na timeline da pendencia antes de excluir
    if (atividade.pendenciaId) {
      this.prisma.interacaoPendencia.create({
        data: {
          tipo: 'COMENTARIO',
          descricao: `Tarefa "${atividade.titulo}" foi excluida`,
          pendenciaId: atividade.pendenciaId,
          usuarioId: atividade.usuarioId,
          publica: true,
        },
      }).catch((err) => console.error('Notificacao error:', err.message));
    }

    await this.prisma.atividadeProjeto.delete({ where: { id: atividadeId } });
    return { deleted: true };
  }

  // --- Comentarios de Tarefa ---

  async listComentarios(projetoId: string, atividadeId: string) {
    await this.helpers.ensureProjetoExists(projetoId);
    const atividade = await this.prisma.atividadeProjeto.findFirst({
      where: { id: atividadeId, projetoId },
    });
    if (!atividade) throw new NotFoundException('Tarefa nao encontrada neste projeto');

    return this.prisma.comentarioTarefa.findMany({
      where: { atividadeId },
      include: { usuario: { select: { id: true, nome: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addComentario(projetoId: string, atividadeId: string, texto: string, userId: string, visivelPendencia?: boolean) {
    await this.helpers.ensureProjetoExists(projetoId);
    const atividade = await this.prisma.atividadeProjeto.findFirst({
      where: { id: atividadeId, projetoId },
    });
    if (!atividade) throw new NotFoundException('Tarefa nao encontrada neste projeto');

    const comentario = await this.prisma.comentarioTarefa.create({
      data: {
        texto,
        atividadeId,
        usuarioId: userId,
        visivelPendencia: atividade.pendenciaId ? (visivelPendencia ?? false) : false,
      },
      include: { usuario: { select: { id: true, nome: true } } },
    });

    // Processar @mencoes
    const mencionadoIds = await this.helpers.processarMencoes(texto, projetoId, userId, `um comentario na tarefa "${atividade.titulo}"`, { atividadeId });

    // Notificar responsaveis da atividade (exceto autor e ja mencionados)
    const responsaveis = await this.prisma.atividadeResponsavel.findMany({
      where: { atividadeId },
      select: { usuarioId: true },
    });
    const idsNotificar = responsaveis
      .map((r) => r.usuarioId)
      .filter((uid) => uid !== userId && !mencionadoIds.includes(uid));
    if (idsNotificar.length > 0) {
      const proj = await this.prisma.projeto.findUnique({ where: { id: projetoId }, select: { nome: true } });
      this.notificacaoService.criarParaUsuarios(
        idsNotificar, 'PROJETO_ATUALIZADO',
        `Nova nota na atividade "${atividade.titulo}"`,
        `Nova nota na atividade "${atividade.titulo}" do projeto "${proj?.nome}".`,
        { projetoId, atividadeId },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }

    return comentario;
  }

  async removeComentario(projetoId: string, comentarioId: string, userId: string, role?: string) {
    await this.helpers.ensureProjetoExists(projetoId);
    const comentario = await this.prisma.comentarioTarefa.findFirst({
      where: { id: comentarioId, atividade: { projetoId } },
    });
    if (!comentario) throw new NotFoundException('Comentario nao encontrado');
    const isAdmin = isGestor(role || '');
    if (comentario.usuarioId !== userId && !isAdmin) {
      throw new ForbiddenException('Somente o autor pode remover esta nota');
    }
    await this.prisma.comentarioTarefa.delete({ where: { id: comentarioId } });
    return { deleted: true };
  }

  async updateComentario(projetoId: string, comentarioId: string, texto: string, userId: string, role?: string, visivelPendencia?: boolean) {
    await this.helpers.ensureProjetoExists(projetoId);
    const comentario = await this.prisma.comentarioTarefa.findFirst({
      where: { id: comentarioId, atividade: { projetoId } },
      include: { atividade: { select: { pendenciaId: true } } },
    });
    if (!comentario) throw new NotFoundException('Comentario nao encontrado');
    const isAdmin = isGestor(role || '');
    if (comentario.usuarioId !== userId && !isAdmin) {
      throw new ForbiddenException('Somente o autor pode editar esta nota');
    }
    const data: Record<string, unknown> = { texto };
    if (visivelPendencia !== undefined && comentario.atividade?.pendenciaId) {
      data.visivelPendencia = visivelPendencia;
    }
    return this.prisma.comentarioTarefa.update({
      where: { id: comentarioId },
      data,
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  async buscarComentarios(query: string) {
    if (!query || query.trim().length < 2) return [];

    const termo = query.trim();
    const comentarios = await this.prisma.comentarioTarefa.findMany({
      where: {
        texto: { contains: termo, mode: 'insensitive' },
      },
      include: {
        usuario: { select: { id: true, nome: true } },
        atividade: {
          select: {
            id: true,
            titulo: true,
            projetoId: true,
            projeto: { select: { id: true, numero: true, nome: true } },
            fase: { select: { id: true, nome: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return comentarios;
  }
}
