import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificacaoService } from '../../notificacao/notificacao.service.js';
import { EmailEnvolvidosService } from '../../email/email-envolvidos.service.js';
import * as emailTpl from '../../email/email-templates.js';
import { ProjetoHelpersService } from './projeto-helpers.service.js';
import { ProjetoAtividadeHistoricoService } from './projeto-atividade-historico.service.js';
import { isGestor, isTI, hasStaffPerfilEmTI } from '../../common/constants/roles.constant.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';

@Injectable()
export class ProjetoAtividadeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacaoService: NotificacaoService,
    private readonly emailEnvolvidos: EmailEnvolvidosService,
    private readonly helpers: ProjetoHelpersService,
    private readonly historico: ProjetoAtividadeHistoricoService,
  ) {}

  async listAtividades(projetoId: string, user?: JwtPayload, role?: string) {
    await this.helpers.ensureProjetoExists(projetoId);
    // S13a (25/05) — `hasStaffPerfilEmTI(user)` substitui `isTI(role)`.
    // Badge de notas na linha não conta internas p/ non-staff (senão vaza a
    // quantidade de notas internas). Espelha o filtro de listComentarios.
    const comentariosCount = hasStaffPerfilEmTI(user) ? true : { where: { publica: true } };
    return this.prisma.atividadeProjeto.findMany({
      where: { projetoId },
      include: {
        usuario: { select: { id: true, nome: true } },
        fase: { select: { id: true, nome: true } },
        pendencia: { select: { id: true, numero: true, titulo: true, status: true } },
        _count: { select: { registrosTempo: true, comentarios: comentariosCount } },
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
    dto: { titulo: string; descricao?: string; faseId?: string; pendenciaId?: string; dataInicio?: string; dataFimPrevista?: string; responsavelIds?: string[]; emailEnvolvidos?: boolean },
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

      if (dto.emailEnvolvidos === true) {
        const nomes = await this.prisma.usuario.findMany({
          where: { id: { in: responsavelIds } },
          select: { nome: true },
        });
        this.emailEnvolvidos.enviar({
          canal: 'atividades',
          emissorId: userId,
          destinatarioIds: notificarIds,
          subject: `[Atividade] ${atividade.titulo}`,
          html: emailTpl.atividadeCriada({
            titulo: atividade.titulo,
            projetoNome: atividade.projeto.nome,
            projetoId,
            atividadeId: atividade.id,
            criador: atividade.usuario?.nome ?? 'Sistema',
            responsaveis: nomes.map((n) => n.nome),
            descricao: atividade.descricao ?? undefined,
          }),
        }).catch((err) => console.error('Email envolvidos (atividade criada) error:', (err as Error).message));
      }
    }

    // Responsável do projeto: fica sabendo da nova atividade (exceto se foi ele).
    void this.helpers.notificarResponsavelProjeto({
      projetoId, autorId: userId, itemTipo: 'atividade',
      titulo: `Nova atividade: ${dto.titulo}`,
      mensagem: `Nova atividade "${dto.titulo}" criada no projeto "${atividade.projeto.nome}".`,
      dados: { atividadeId: atividade.id },
      jaNotificados: notificarIds,
      emailJaEnviado: dto.emailEnvolvidos === true,
    });

    this.historico.registrar(atividade.id, 'CRIADA', {
      descricao: 'Tarefa criada',
      usuarioId: userId,
    });

    return atividade;
  }

  async updateAtividade(
    projetoId: string,
    atividadeId: string,
    dto: { titulo?: string; descricao?: string; faseId?: string; status?: string; dataInicio?: string; dataFimPrevista?: string; responsavelIds?: string[]; emailEnvolvidos?: boolean },
    actorId?: string,
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

    // Historico: registra cada mudanca relevante (timeline do drawer)
    const statusLabelHist: Record<string, string> = {
      PENDENTE: 'Pendente', EM_ANDAMENTO: 'Em Andamento', CONCLUIDA: 'Concluida', CANCELADA: 'Cancelada',
    };
    if (dto.status && dto.status !== atividade.status) {
      this.historico.registrar(atividadeId, 'STATUS_ALTERADO', {
        descricao: `Status alterado para ${statusLabelHist[dto.status] || dto.status}`,
        usuarioId: actorId,
        metadata: { de: atividade.status, para: dto.status },
      });
    }
    if (dto.titulo && dto.titulo !== atividade.titulo) {
      this.historico.registrar(atividadeId, 'TITULO_ALTERADO', {
        descricao: `Titulo alterado para "${dto.titulo}"`,
        usuarioId: actorId,
      });
    }
    if (dto.faseId !== undefined && (dto.faseId || null) !== atividade.faseId) {
      this.historico.registrar(atividadeId, 'FASE_ALTERADA', {
        descricao: updated.fase ? `Movida para a fase "${updated.fase.nome}"` : 'Removida da fase',
        usuarioId: actorId,
      });
    }

    // Sync responsaveis se informados
    const responsaveisAntigos = await this.prisma.atividadeResponsavel.findMany({
      where: { atividadeId },
      select: { usuarioId: true },
    });
    const idsAntigos = responsaveisAntigos.map((r) => r.usuarioId);

    if (dto.responsavelIds !== undefined) {
      const mudouResponsaveis =
        dto.responsavelIds.length !== idsAntigos.length ||
        dto.responsavelIds.some((uid) => !idsAntigos.includes(uid));

      await this.prisma.atividadeResponsavel.deleteMany({ where: { atividadeId } });
      if (dto.responsavelIds.length > 0) {
        await this.prisma.atividadeResponsavel.createMany({
          data: dto.responsavelIds.map((uid) => ({ atividadeId, usuarioId: uid })),
          skipDuplicates: true,
        });
      }

      if (mudouResponsaveis) {
        this.historico.registrar(atividadeId, 'RESPONSAVEL_ALTERADO', {
          descricao: 'Responsaveis atualizados',
          usuarioId: actorId,
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

        if (dto.emailEnvolvidos === true) {
          const autor = actorId
            ? await this.prisma.usuario.findUnique({ where: { id: actorId }, select: { nome: true } })
            : null;
          this.emailEnvolvidos.enviar({
            canal: 'atividades',
            emissorId: actorId ?? atividade.usuarioId,
            destinatarioIds: idsResponsaveis,
            subject: `[Atividade] ${updated.titulo}`,
            html: emailTpl.atividadeStatus({
              titulo: updated.titulo,
              projetoNome: proj?.nome ?? '—',
              projetoId,
              atividadeId,
              autor: autor?.nome ?? 'Sistema',
              statusAnterior: statusLabelsNotif[atividade.status] || atividade.status,
              statusNovo: statusLabelsNotif[dto.status] || dto.status,
            }),
          }).catch((err) => console.error('Email envolvidos (atividade status) error:', (err as Error).message));
        }
      }

      // Responsável do projeto: fica sabendo da mudança de status (exceto se foi ele).
      const statusMov = statusLabelsNotif[dto.status] || dto.status;
      void this.helpers.notificarResponsavelProjeto({
        projetoId, autorId: actorId ?? atividade.usuarioId, itemTipo: 'atividade',
        titulo: `Atividade "${updated.titulo}" — ${statusMov}`,
        mensagem: `A atividade "${updated.titulo}" teve o status alterado para ${statusMov}.`,
        dados: { atividadeId },
        jaNotificados: (dto.responsavelIds ?? idsAntigos).filter((uid) => uid !== atividade.usuarioId),
        emailJaEnviado: dto.emailEnvolvidos === true,
      });
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

  async listComentarios(projetoId: string, atividadeId: string, user?: JwtPayload, role?: string) {
    await this.helpers.ensureProjetoExists(projetoId);
    const atividade = await this.prisma.atividadeProjeto.findFirst({
      where: { id: atividadeId, projetoId },
    });
    if (!atividade) throw new NotFoundException('Tarefa nao encontrada neste projeto');

    const comentarios = await this.prisma.comentarioTarefa.findMany({
      where: { atividadeId },
      include: { usuario: { select: { id: true, nome: true } } },
      orderBy: { createdAt: 'desc' },
    });
    // Regra única 14/05: nota interna (publica=false) só p/ staff TI (isTI:
    // ADMIN/GESTOR_TI/SUPORTE_TI). USUARIO_CHAVE/TERCEIRIZADO/non-staff só veem
    // públicas. Filtro no backend — frontend pode ser bypassado via API.
    // S13a — `hasStaffPerfilEmTI(user)` substitui `isTI(role)`.
    if (!hasStaffPerfilEmTI(user)) return comentarios.filter((c) => c.publica);
    return comentarios;
  }

  async addComentario(projetoId: string, atividadeId: string, texto: string, user: JwtPayload, visivelPendencia?: boolean, publica?: boolean, role?: string, emailEnvolvidos?: boolean) {
    const userId = user.sub;
    await this.helpers.ensureProjetoExists(projetoId);
    const atividade = await this.prisma.atividadeProjeto.findFirst({
      where: { id: atividadeId, projetoId },
    });
    if (!atividade) throw new NotFoundException('Tarefa nao encontrada neste projeto');

    // Defesa em profundidade: non-staff sempre grava publica=true (não pode
    // criar nota interna mesmo forjando o body). Só isTI decide.
    // S13a — `hasStaffPerfilEmTI(user)` substitui `isTI(role)`.
    const publicaEfetiva = !hasStaffPerfilEmTI(user) ? true : (publica ?? true);

    const comentario = await this.prisma.comentarioTarefa.create({
      data: {
        texto,
        atividadeId,
        usuarioId: userId,
        visivelPendencia: atividade.pendenciaId ? (visivelPendencia ?? false) : false,
        publica: publicaEfetiva,
      },
      include: { usuario: { select: { id: true, nome: true } } },
    });

    // Processar @mencoes
    const mencionadoIds = await this.helpers.processarMencoes(texto, projetoId, userId, `um comentario na tarefa "${atividade.titulo}"`, { atividadeId }, !publicaEfetiva);

    // Notificar responsaveis da atividade (exceto autor e ja mencionados)
    const responsaveis = await this.prisma.atividadeResponsavel.findMany({
      where: { atividadeId },
      select: { usuarioId: true },
    });
    let idsNotificar = responsaveis
      .map((r) => r.usuarioId)
      .filter((uid) => uid !== userId && !mencionadoIds.includes(uid));
    // Nota interna: não notificar USUARIO_CHAVE/TERCEIRIZADO do projeto — eles
    // não veem o conteúdo (Regra única 14/05). A role não vive neste DB
    // (vem do JWT); usamos o vínculo usuarios_chave_projeto, mesma fonte de
    // checkProjetoAccessChave (cobre USUARIO_CHAVE e TERCEIRIZADO).
    if (!publicaEfetiva && idsNotificar.length > 0) {
      const chave = await this.prisma.usuarioChaveProjeto.findMany({
        where: { projetoId, ativo: true, usuarioId: { in: idsNotificar } },
        select: { usuarioId: true },
      });
      const chaveIds = new Set(chave.map((c) => c.usuarioId));
      idsNotificar = idsNotificar.filter((uid) => !chaveIds.has(uid));
    }
    if (idsNotificar.length > 0) {
      const proj = await this.prisma.projeto.findUnique({ where: { id: projetoId }, select: { nome: true } });
      this.notificacaoService.criarParaUsuarios(
        idsNotificar, 'PROJETO_ATUALIZADO',
        `Nova nota na atividade "${atividade.titulo}"`,
        `Nova nota na atividade "${atividade.titulo}" do projeto "${proj?.nome}".`,
        { projetoId, atividadeId },
      ).catch((err) => console.error('Notificacao error:', err.message));

      // E-mail só se emissor pediu E a nota é pública. Interna nunca envia
      // (filtro já removeu UC/TERC acima — mas defesa em profundidade aqui).
      if (emailEnvolvidos === true && publicaEfetiva) {
        this.emailEnvolvidos.enviar({
          canal: 'atividades',
          emissorId: userId,
          destinatarioIds: idsNotificar,
          subject: `[Atividade] ${atividade.titulo}`,
          html: emailTpl.atividadeComentario({
            titulo: atividade.titulo,
            projetoNome: proj?.nome ?? '—',
            projetoId,
            atividadeId,
            autor: comentario.usuario?.nome ?? 'Sistema',
            comentario: texto,
          }),
        }).catch((err) => console.error('Email envolvidos (atividade comentario) error:', (err as Error).message));
      }
    }

    // Responsável do projeto: fica sabendo da nova nota (exceto se foi ele). Nota
    // interna não envia e-mail e pula responsável UC/TERC (não vê o conteúdo).
    void this.helpers.notificarResponsavelProjeto({
      projetoId, autorId: userId, itemTipo: 'atividade',
      titulo: `Nova nota na atividade "${atividade.titulo}"`,
      mensagem: `Nova nota na atividade "${atividade.titulo}".`,
      dados: { atividadeId },
      jaNotificados: [...idsNotificar, ...mencionadoIds],
      emailJaEnviado: emailEnvolvidos === true && publicaEfetiva,
      emailPermitido: publicaEfetiva,
      restringirNaoStaff: !publicaEfetiva,
    });

    this.historico.registrar(atividadeId, 'COMENTARIO_ADICIONADO', {
      descricao: 'Adicionou uma nota',
      usuarioId: userId,
    });

    return comentario;
  }

  async removeComentario(projetoId: string, comentarioId: string, userId: string, role?: string, user?: JwtPayload) {
    await this.helpers.ensureProjetoExists(projetoId);
    const comentario = await this.prisma.comentarioTarefa.findFirst({
      where: { id: comentarioId, atividade: { projetoId } },
    });
    if (!comentario) throw new NotFoundException('Comentario nao encontrado');
    // 29/05 — role NO DEPTO do projeto (não principal do JWT) em multi-perfil.
    const roleEfetiva = user
      ? await this.helpers.getRoleNoDeptoProjeto(projetoId, user, role || '')
      : role || '';
    const isAdmin = isGestor(roleEfetiva);
    if (comentario.usuarioId !== userId && !isAdmin) {
      throw new ForbiddenException('Somente o autor pode remover esta nota');
    }
    await this.prisma.comentarioTarefa.delete({ where: { id: comentarioId } });
    return { deleted: true };
  }

  async updateComentario(projetoId: string, comentarioId: string, texto: string, user: JwtPayload, role?: string, visivelPendencia?: boolean, publica?: boolean) {
    const userId = user.sub;
    await this.helpers.ensureProjetoExists(projetoId);
    const comentario = await this.prisma.comentarioTarefa.findFirst({
      where: { id: comentarioId, atividade: { projetoId } },
      include: { atividade: { select: { pendenciaId: true } } },
    });
    if (!comentario) throw new NotFoundException('Comentario nao encontrado');
    // 29/05 — role NO DEPTO do projeto (não principal do JWT) em multi-perfil.
    const roleEfetiva = await this.helpers.getRoleNoDeptoProjeto(projetoId, user, role || '');
    const isAdmin = isGestor(roleEfetiva);
    if (comentario.usuarioId !== userId && !isAdmin) {
      throw new ForbiddenException('Somente o autor pode editar esta nota');
    }
    const data: Record<string, unknown> = { texto };
    if (visivelPendencia !== undefined && comentario.atividade?.pendenciaId) {
      data.visivelPendencia = visivelPendencia;
    }
    // Só staff TI altera o flag interno (defesa em profundidade — non-staff
    // não muda publica nem editando a própria nota via API).
    // S13a — `hasStaffPerfilEmTI(user)` substitui `isTI(role)`.
    if (publica !== undefined && hasStaffPerfilEmTI(user)) {
      data.publica = publica;
    }
    return this.prisma.comentarioTarefa.update({
      where: { id: comentarioId },
      data,
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  async buscarComentarios(query: string, user?: JwtPayload, role?: string) {
    if (!query || query.trim().length < 2) return [];

    const termo = query.trim();
    const comentarios = await this.prisma.comentarioTarefa.findMany({
      where: {
        texto: { contains: termo, mode: 'insensitive' },
        // Busca global não vaza nota interna p/ non-staff (Regra única 14/05).
        // S13a — `hasStaffPerfilEmTI(user)` substitui `isTI(role)`.
        ...(hasStaffPerfilEmTI(user) ? {} : { publica: true }),
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
