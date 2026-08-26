import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificacaoService } from '../../notificacao/notificacao.service.js';
import { EmailEnvolvidosService } from '../../email/email-envolvidos.service.js';
import * as emailTpl from '../../email/email-templates.js';
import { CreatePendenciaDto } from '../dto/create-pendencia.dto.js';
import { UpdatePendenciaDto } from '../dto/update-pendencia.dto.js';
import { CreateInteracaoPendenciaDto } from '../dto/create-interacao-pendencia.dto.js';
import { ProjetoHelpersService } from './projeto-helpers.service.js';
import { PENDENCIA_UPLOADS_DIR } from './projeto.constants.js';
import { isGestor, isTI } from '../../common/constants/roles.constant.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';

@Injectable()
export class ProjetoPendenciaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacaoService: NotificacaoService,
    private readonly emailEnvolvidos: EmailEnvolvidosService,
    private readonly helpers: ProjetoHelpersService,
  ) {}

  async listPendencias(projetoId: string, filters: {
    status?: string; prioridade?: string; responsavelId?: string; search?: string; incluirSubProjetos?: boolean;
  }, user: JwtPayload, role: string) {
    // S13a — `user` substitui `userId` p/ propagar hasStaffPerfilEmTI(user)
    // ao helper. Mantém alias `userId` p/ o body já existente.
    const userId = user.sub;
    await this.helpers.checkProjetoAccessChave(projetoId, user, role);

    // Se incluirSubProjetos, busca IDs do projeto e todos seus sub-projetos
    let projetoIds = [projetoId];
    if (filters.incluirSubProjetos) {
      const subProjetos = await this.prisma.projeto.findMany({
        where: { projetoPaiId: projetoId },
        select: { id: true },
      });
      projetoIds = [projetoId, ...subProjetos.map((s) => s.id)];
    }

    const where: Record<string, unknown> = { projetoId: { in: projetoIds } };
    if (filters.status) where.status = filters.status;
    if (filters.prioridade) where.prioridade = filters.prioridade;
    if (filters.responsavelId) where.responsavelId = filters.responsavelId;
    if (filters.search) {
      where.OR = [
        { titulo: { contains: filters.search, mode: 'insensitive' } },
        { descricao: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.pendenciaProjeto.findMany({
      where,
      include: {
        responsavel: { select: { id: true, nome: true, username: true } },
        criador: { select: { id: true, nome: true, username: true } },
        fase: { select: { id: true, nome: true } },
        projeto: { select: { id: true, numero: true, nome: true } },
        _count: { select: { interacoes: true, anexos: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendencia(projetoId: string, pendenciaId: string, user: JwtPayload, role: string) {
    const userId = user.sub;
    await this.helpers.checkProjetoAccessChave(projetoId, user, role);

    const pendencia = await this.prisma.pendenciaProjeto.findFirst({
      where: { id: pendenciaId, projetoId },
      include: {
        responsavel: { select: { id: true, nome: true, username: true } },
        criador: { select: { id: true, nome: true, username: true } },
        fase: { select: { id: true, nome: true } },
        interacoes: {
          include: {
            usuario: { select: { id: true, nome: true, username: true } },
            anexos: true,
          },
          // Mais recente em cima (chat-style TOTVS — decisao 13/05/2026).
          orderBy: { createdAt: 'desc' },
        },
        anexos: {
          include: { usuario: { select: { id: true, nome: true } } },
          orderBy: { createdAt: 'desc' },
        },
        atividades: {
          include: {
            usuario: { select: { id: true, nome: true } },
            comentarios: {
              where: { visivelPendencia: true },
              include: { usuario: { select: { id: true, nome: true } } },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!pendencia) throw new NotFoundException('Pendencia nao encontrada neste projeto');

    // Filtro de comentário interno (14/05/2026 — alinhamento com Chamado):
    // qualquer role NÃO-staff só vê interações públicas. Staff = ADMIN/
    // GESTOR_TI/SUPORTE_TI (isTI). Antes filtrava apenas USUARIO_CHAVE e
    // TERCEIRIZADO; USUARIO_FINAL hipotético (ou roles legadas como
    // DESENVOLVEDOR/MANUTENCAO/INFRAESTRUTURA) viam internos.
    // ⭐ 26/08 — quem lê a interação interna é quem atende o DEPARTAMENTO DO PROJETO.
    if (!(await this.helpers.ehStaffNoProjeto(projetoId, user, role))) {
      pendencia.interacoes = pendencia.interacoes.filter((i) => i.publica);
    }

    return pendencia;
  }

  async createPendencia(projetoId: string, dto: CreatePendenciaDto, user: JwtPayload, role: string) {
    const criadorId = user.sub;
    await this.helpers.checkProjetoAccessChave(projetoId, user, role);
    const projeto = await this.prisma.projeto.findUnique({
      where: { id: projetoId },
      select: { id: true, status: true, responsavelId: true, nome: true, numero: true },
    });
    if (!projeto) throw new NotFoundException('Projeto nao encontrado');

    if (['CONCLUIDO', 'CANCELADO'].includes(projeto.status)) {
      throw new BadRequestException('Nao e possivel criar pendencias em projeto finalizado');
    }

    if (dto.faseId) {
      const fase = await this.prisma.faseProjeto.findFirst({ where: { id: dto.faseId, projetoId } });
      if (!fase) throw new BadRequestException('Fase nao encontrada neste projeto');
    }

    // Validate responsavel is member or usuario-chave
    const isMembro = await this.prisma.membroProjeto.findUnique({
      where: { projetoId_usuarioId: { projetoId, usuarioId: dto.responsavelId } },
    });
    const isChave = await this.prisma.usuarioChaveProjeto.findUnique({
      where: { projetoId_usuarioId: { projetoId, usuarioId: dto.responsavelId } },
    });
    const isResponsavel = projeto.responsavelId === dto.responsavelId;
    if (!isMembro && !isChave && !isResponsavel) {
      throw new BadRequestException('Responsavel deve ser membro ou usuario-chave do projeto');
    }

    const pendencia = await this.prisma.pendenciaProjeto.create({
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        prioridade: dto.prioridade || 'MEDIA',
        projetoId,
        faseId: dto.faseId,
        responsavelId: dto.responsavelId,
        criadorId,
        dataLimite: dto.dataLimite ? new Date(dto.dataLimite) : undefined,
      },
      include: {
        responsavel: { select: { id: true, nome: true, username: true } },
        criador: { select: { id: true, nome: true, username: true } },
        fase: { select: { id: true, nome: true } },
      },
    });

    // Create opening interaction
    await this.prisma.interacaoPendencia.create({
      data: {
        tipo: 'STATUS_ALTERADO',
        descricao: 'Pendencia criada',
        pendenciaId: pendencia.id,
        usuarioId: criadorId,
      },
    });

    // Notificar responsavel (se diferente do criador)
    if (dto.responsavelId !== criadorId) {
      const proj = await this.prisma.projeto.findUnique({ where: { id: projetoId }, select: { nome: true } });
      this.notificacaoService.criarParaUsuario(
        dto.responsavelId,
        'PENDENCIA_ATRIBUIDA',
        `Nova pendencia: ${dto.titulo}`,
        `Voce foi atribuido como responsavel da pendencia "${dto.titulo}" no projeto "${proj?.nome}".`,
        { projetoId, pendenciaId: pendencia.id },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }

    // E-mail ao responsável SEMPRE que atribuído a outra pessoa (antes
    // dependia do checkbox dto.emailEnvolvidos — o responsável ficava sem
    // saber). O opt-out por canal ('pendencias') é respeitado no serviço.
    if (dto.responsavelId !== criadorId) {
      this.emailEnvolvidos.enviar({
        canal: 'pendencias',
        emissorId: criadorId,
        destinatarioIds: [dto.responsavelId],
        subject: `[Pendência #${pendencia.numero}] ${pendencia.titulo}`,
        html: emailTpl.pendenciaCriada({
          numero: pendencia.numero,
          titulo: pendencia.titulo,
          projetoNome: projeto.nome,
          projetoId,
          pendenciaId: pendencia.id,
          criador: pendencia.criador?.nome ?? 'Sistema',
          responsavel: pendencia.responsavel?.nome ?? '—',
          descricao: pendencia.descricao ?? undefined,
        }),
      }).catch((err) => console.error('Email envolvidos (pendencia criada) error:', (err as Error).message));
    }

    // Responsável do projeto: fica sabendo da nova pendência (exceto se foi ele).
    // Dedup: se o responsável da pendência já é o do projeto, ele já foi avisado acima.
    void this.helpers.notificarResponsavelProjeto({
      projetoId, autorId: criadorId, itemTipo: 'pendência',
      titulo: `Nova pendência #${pendencia.numero}: ${pendencia.titulo}`,
      mensagem: `Nova pendência "${pendencia.titulo}" criada no projeto "${projeto.nome}".`,
      dados: { pendenciaId: pendencia.id },
      jaNotificados: dto.responsavelId !== criadorId ? [dto.responsavelId] : [],
      emailJaEnviado: dto.responsavelId !== criadorId,
    });

    return pendencia;
  }

  async updatePendencia(projetoId: string, pendenciaId: string, dto: UpdatePendenciaDto, user: JwtPayload, role: string) {
    const userId = user.sub;
    await this.helpers.checkProjetoAccessChave(projetoId, user, role);

    const pendencia = await this.prisma.pendenciaProjeto.findFirst({
      where: { id: pendenciaId, projetoId },
    });
    if (!pendencia) throw new NotFoundException('Pendencia nao encontrada');

    // 29/05 — multi-perfil: usar role NO DEPTO DO PROJETO pra decidir restrições
    // de UC/TERC (não a role principal do JWT). Tatiane GESTOR/Fiscal + UC/T.I.
    // numa pendência T.I.: era GESTOR aqui, ganhando todas as transições.
    // Memory feedback_workspace_role_por_depto.
    const projeto = await this.prisma.projeto.findUnique({
      where: { id: projetoId },
      select: { departamentoId: true },
    });
    const roleNoDeptoProjeto = projeto
      ? user.modulos
          ?.find((m) => m.codigo === 'WORKSPACE')
          ?.departamentos?.find((d) => d.id === projeto.departamentoId)?.role
      : undefined;
    const roleEfetiva = roleNoDeptoProjeto ?? role;

    // Apenas responsavel ou gestor pode editar dados da pendencia
    const isResponsavel = pendencia.responsavelId === userId;
    const hasDadosAlterados = dto.titulo !== undefined || dto.descricao !== undefined || dto.prioridade !== undefined || dto.responsavelId !== undefined || dto.dataLimite !== undefined || dto.faseId !== undefined;
    if (hasDadosAlterados && !isGestor(roleEfetiva) && !isResponsavel) {
      throw new ForbiddenException('Apenas o responsavel pela pendencia ou gestores podem editar os dados');
    }

    if (['CONCLUIDA', 'CANCELADA'].includes(pendencia.status) && !dto.status) {
      throw new BadRequestException('Pendencia finalizada nao pode ser alterada');
    }

    // USUARIO_CHAVE e TERCEIRIZADO: restricted status transitions
    if ((roleEfetiva === 'USUARIO_CHAVE' || roleEfetiva === 'TERCEIRIZADO') && dto.status) {
      const permitidos = ['AGUARDANDO_VALIDACAO', 'CONCLUIDA', 'EM_ANDAMENTO'];
      if (!permitidos.includes(dto.status)) {
        throw new ForbiddenException('Usuario externo so pode alterar status para Em Andamento, Aguardando Validacao ou Concluida');
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.titulo !== undefined) data.titulo = dto.titulo;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.prioridade !== undefined) data.prioridade = dto.prioridade;
    if (dto.faseId !== undefined) data.faseId = dto.faseId || null;
    if (dto.dataLimite !== undefined) data.dataLimite = dto.dataLimite ? new Date(dto.dataLimite) : null;

    if (dto.responsavelId !== undefined && dto.responsavelId !== pendencia.responsavelId) {
      data.responsavelId = dto.responsavelId;
      await this.prisma.interacaoPendencia.create({
        data: {
          tipo: 'RESPONSAVEL_ALTERADO',
          descricao: `Responsavel alterado`,
          pendenciaId,
          usuarioId: userId,
        },
      });
      // Notificar novo responsavel
      const proj = await this.prisma.projeto.findUnique({ where: { id: projetoId }, select: { nome: true } });
      this.notificacaoService.criarParaUsuario(
        dto.responsavelId,
        'PENDENCIA_ATRIBUIDA',
        `Pendencia transferida: ${pendencia.titulo}`,
        `Voce foi atribuido como responsavel da pendencia "${pendencia.titulo}" no projeto "${proj?.nome}".`,
        { projetoId, pendenciaId },
      ).catch((err) => console.error('Notificacao error:', err.message));
      // E-mail ao novo responsável (sempre que muda; opt-out 'pendencias' respeitado).
      if (dto.responsavelId !== userId) {
        const autor = await this.prisma.usuario.findUnique({ where: { id: userId }, select: { nome: true } });
        this.emailEnvolvidos.enviar({
          canal: 'pendencias',
          emissorId: userId,
          destinatarioIds: [dto.responsavelId],
          subject: `[Pendência #${pendencia.numero}] ${pendencia.titulo}`,
          html: emailTpl.pendenciaCriada({
            numero: pendencia.numero,
            titulo: pendencia.titulo,
            projetoNome: proj?.nome ?? '—',
            projetoId,
            pendenciaId,
            criador: autor?.nome ?? 'Sistema',
            responsavel: '—',
            descricao: pendencia.descricao ?? undefined,
          }),
        }).catch((err) => console.error('Email envolvidos (pendencia transferida) error:', (err as Error).message));
      }

      // Responsável do projeto: fica sabendo da transferência (exceto se foi ele).
      void this.helpers.notificarResponsavelProjeto({
        projetoId, autorId: userId, itemTipo: 'pendência',
        titulo: `Pendência #${pendencia.numero} transferida`,
        mensagem: `A pendência "${pendencia.titulo}" teve o responsável alterado.`,
        dados: { pendenciaId },
        jaNotificados: [dto.responsavelId!],
        emailJaEnviado: dto.responsavelId !== userId,
      });
    }

    if (dto.status !== undefined && dto.status !== pendencia.status) {
      data.status = dto.status;
      await this.prisma.interacaoPendencia.create({
        data: {
          tipo: 'STATUS_ALTERADO',
          descricao: `Status alterado de ${pendencia.status} para ${dto.status}`,
          pendenciaId,
          usuarioId: userId,
        },
      });

      // Notificar envolvidos sobre mudanca de status
      const statusLabels: Record<string, string> = {
        ABERTA: 'Aberta', EM_ANDAMENTO: 'Em Andamento', AGUARDANDO_VALIDACAO: 'Aguardando Validacao',
        CONCLUIDA: 'Concluida', CANCELADA: 'Cancelada',
      };
      const idsNotificar = new Set<string>();
      if (pendencia.responsavelId && pendencia.responsavelId !== userId) idsNotificar.add(pendencia.responsavelId);
      if (pendencia.criadorId && pendencia.criadorId !== userId) idsNotificar.add(pendencia.criadorId);
      if (idsNotificar.size > 0) {
        const proj = await this.prisma.projeto.findUnique({ where: { id: projetoId }, select: { nome: true } });
        this.notificacaoService.criarParaUsuarios(
          Array.from(idsNotificar), 'PROJETO_ATUALIZADO',
          `Pendencia "${pendencia.titulo}" — ${statusLabels[dto.status] || dto.status}`,
          `A pendencia "${pendencia.titulo}" do projeto "${proj?.nome}" teve o status alterado para ${statusLabels[dto.status] || dto.status}.`,
          { projetoId, pendenciaId },
        ).catch((err) => console.error('Notificacao error:', err.message));

        if (dto.emailEnvolvidos === true) {
          const autor = await this.prisma.usuario.findUnique({ where: { id: userId }, select: { nome: true } });
          this.emailEnvolvidos.enviar({
            canal: 'pendencias',
            emissorId: userId,
            destinatarioIds: Array.from(idsNotificar),
            subject: `[Pendência #${pendencia.numero}] ${pendencia.titulo}`,
            html: emailTpl.pendenciaStatus({
              numero: pendencia.numero,
              titulo: pendencia.titulo,
              projetoNome: proj?.nome ?? '—',
              projetoId,
              pendenciaId,
              autor: autor?.nome ?? 'Sistema',
              statusAnterior: statusLabels[pendencia.status] || pendencia.status,
              statusNovo: statusLabels[dto.status] || dto.status,
            }),
          }).catch((err) => console.error('Email envolvidos (pendencia status) error:', (err as Error).message));
        }
      }

      // Responsável do projeto: fica sabendo da mudança de status (exceto se foi ele).
      const statusMov = statusLabels[dto.status] || dto.status;
      void this.helpers.notificarResponsavelProjeto({
        projetoId, autorId: userId, itemTipo: 'pendência',
        titulo: `Pendência #${pendencia.numero} — ${statusMov}`,
        mensagem: `A pendência "${pendencia.titulo}" teve o status alterado para ${statusMov}.`,
        dados: { pendenciaId },
        jaNotificados: Array.from(idsNotificar),
        emailJaEnviado: dto.emailEnvolvidos === true,
      });
    }

    return this.prisma.pendenciaProjeto.update({
      where: { id: pendenciaId },
      data,
      include: {
        responsavel: { select: { id: true, nome: true, username: true } },
        criador: { select: { id: true, nome: true, username: true } },
        fase: { select: { id: true, nome: true } },
      },
    });
  }

  async gerarAtividadeFromPendencia(
    projetoId: string,
    pendenciaId: string,
    dto: { titulo?: string; descricao?: string; dataFimPrevista?: string },
    userId: string,
  ) {
    await this.helpers.ensureProjetoExists(projetoId);

    const pendencia = await this.prisma.pendenciaProjeto.findFirst({
      where: { id: pendenciaId, projetoId },
    });
    if (!pendencia) throw new NotFoundException('Pendencia nao encontrada neste projeto');

    // Cria atividade com dados da pendencia (permite override)
    // Responsaveis: quem gerou + responsavel da pendencia (se diferente)
    const responsaveisIds = new Set([userId]);
    if (pendencia.responsavelId) responsaveisIds.add(pendencia.responsavelId);

    const atividade = await this.prisma.atividadeProjeto.create({
      data: {
        titulo: dto.titulo || `[P#${pendencia.numero}] ${pendencia.titulo}`,
        descricao: dto.descricao || pendencia.descricao,
        projetoId,
        usuarioId: userId,
        faseId: pendencia.faseId,
        pendenciaId: pendencia.id,
        dataInicio: new Date(),
        dataFimPrevista: dto.dataFimPrevista ? new Date(dto.dataFimPrevista) : pendencia.dataLimite,
        responsaveis: {
          createMany: {
            data: Array.from(responsaveisIds).map((uid) => ({ usuarioId: uid })),
          },
        },
      },
      include: {
        usuario: { select: { id: true, nome: true } },
        fase: { select: { id: true, nome: true } },
        pendencia: { select: { id: true, numero: true, titulo: true, status: true } },
        responsaveis: { include: { usuario: { select: { id: true, nome: true } } } },
      },
    });

    // Registra interacao na pendencia
    await this.prisma.interacaoPendencia.create({
      data: {
        pendenciaId: pendencia.id,
        usuarioId: userId,
        tipo: 'COMENTARIO',
        descricao: `Atividade gerada: ${atividade.titulo}`,
        publica: true,
      },
    });

    // Notificar responsaveis atribuidos (exceto o criador)
    const idsNotificar = Array.from(responsaveisIds).filter((uid) => uid !== userId);
    if (idsNotificar.length > 0) {
      const proj = await this.prisma.projeto.findUnique({ where: { id: projetoId }, select: { nome: true } });
      this.notificacaoService.criarParaUsuarios(
        idsNotificar, 'ATIVIDADE_ATRIBUIDA',
        `Nova atividade: ${atividade.titulo}`,
        `Voce foi atribuido a atividade "${atividade.titulo}" no projeto "${proj?.nome}".`,
        { projetoId, atividadeId: atividade.id },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }

    // Responsável do projeto: fica sabendo da atividade gerada (exceto se foi ele).
    void this.helpers.notificarResponsavelProjeto({
      projetoId, autorId: userId, itemTipo: 'atividade',
      titulo: `Nova atividade: ${atividade.titulo}`,
      mensagem: `Atividade "${atividade.titulo}" gerada da pendência #${pendencia.numero}.`,
      dados: { atividadeId: atividade.id },
      jaNotificados: idsNotificar,
      emailJaEnviado: false,
    });

    return atividade;
  }

  // --- Interacoes Pendencia ---

  async addInteracaoPendencia(projetoId: string, pendenciaId: string, dto: CreateInteracaoPendenciaDto, user: JwtPayload, role: string) {
    const userId = user.sub;
    await this.helpers.checkProjetoAccessChave(projetoId, user, role);

    const pendencia = await this.prisma.pendenciaProjeto.findFirst({
      where: { id: pendenciaId, projetoId },
    });
    if (!pendencia) throw new NotFoundException('Pendencia nao encontrada');
    if (['CONCLUIDA', 'CANCELADA'].includes(pendencia.status)) {
      throw new BadRequestException('Nao e possivel comentar em pendencia finalizada');
    }

    // Non-staff sempre grava publica=true (defesa em profundidade — frontend
    // não mostra o checkbox pra eles, mas evita bypass por API direto).
    // Staff = ADMIN/GESTOR_TI/SUPORTE_TI (isTI). 14/05/2026 — alinhamento com
    // Chamado e com a regra explicitada pelo Clenio (todo non-staff é restrito).
    // ⭐ 26/08 — idem para ESCREVER.
    const publica = !(await this.helpers.ehStaffNoProjeto(projetoId, user, role))
      ? true
      : (dto.publica ?? true);

    const interacao = await this.prisma.interacaoPendencia.create({
      data: {
        tipo: 'COMENTARIO',
        descricao: dto.descricao,
        publica,
        pendenciaId,
        usuarioId: userId,
      },
      include: {
        usuario: { select: { id: true, nome: true, username: true } },
      },
    });

    // Vincular anexos a esta interacao (FK interacao_id). Decisao 13/05/2026
    // — chat-style: anexos do comentario gravam interacao_id pra renderizar
    // chip dentro do bubble do comentario na UI.
    //
    // Cada upload de anexo cria automaticamente uma interacao tipo ANEXO
    // (legado). Quando o anexo eh "movido" para o comentario, removemos a
    // interacao ANEXO antiga (que ficaria pendurada sem conteudo).
    if (dto.anexosIds && dto.anexosIds.length > 0) {
      const anexosValidos = await this.prisma.anexoPendencia.findMany({
        where: { id: { in: dto.anexosIds }, pendenciaId },
        select: { id: true, interacaoId: true },
      });
      if (anexosValidos.length !== dto.anexosIds.length) {
        console.warn(`Pendencia ${pendenciaId}: ${dto.anexosIds.length - anexosValidos.length} anexo(s) nao puderam ser vinculados a interacao ${interacao.id}`);
      }
      const interacoesAntigas = anexosValidos
        .map((a) => a.interacaoId)
        .filter((id): id is string => !!id && id !== interacao.id);

      if (anexosValidos.length > 0) {
        await this.prisma.anexoPendencia.updateMany({
          where: { id: { in: anexosValidos.map((a) => a.id) } },
          data: { interacaoId: interacao.id },
        });
      }
      // Limpar interacoes ANEXO orfas (criadas automaticamente no upload)
      if (interacoesAntigas.length > 0) {
        await this.prisma.interacaoPendencia.deleteMany({
          where: { id: { in: interacoesAntigas }, tipo: 'ANEXO' },
        });
      }
    }

    // Processar @mencoes
    const mencionadoIds: string[] = [];
    if (dto.descricao) {
      const ids = await this.helpers.processarMencoes(dto.descricao, projetoId, userId, `um comentario na pendencia #${pendencia.numero}`, { pendenciaId }, !publica);
      mencionadoIds.push(...ids);
    }

    // Notificar responsavel e criador da pendencia (exceto autor e ja mencionados)
    const idsNotificar = new Set<string>();
    if (pendencia.responsavelId && pendencia.responsavelId !== userId && !mencionadoIds.includes(pendencia.responsavelId)) {
      idsNotificar.add(pendencia.responsavelId);
    }
    const pendenciaFull = await this.prisma.pendenciaProjeto.findUnique({
      where: { id: pendenciaId },
      select: { criadorId: true },
    });
    if (pendenciaFull?.criadorId && pendenciaFull.criadorId !== userId && !mencionadoIds.includes(pendenciaFull.criadorId)) {
      idsNotificar.add(pendenciaFull.criadorId);
    }
    // Interação INTERNA: não notificar responsável/criador que seja
    // USUARIO_CHAVE/TERCEIRIZADO vinculado (espelha o filtro de addComentario
    // de atividade — Regra única 14/05, simétrico UC/TERC).
    if (!publica && idsNotificar.size > 0) {
      const chave = await this.prisma.usuarioChaveProjeto.findMany({
        where: { projetoId, ativo: true, usuarioId: { in: Array.from(idsNotificar) } },
        select: { usuarioId: true },
      });
      chave.forEach((c) => idsNotificar.delete(c.usuarioId));
    }
    if (idsNotificar.size > 0) {
      const proj = await this.prisma.projeto.findUnique({ where: { id: projetoId }, select: { nome: true } });
      this.notificacaoService.criarParaUsuarios(
        Array.from(idsNotificar), 'PROJETO_ATUALIZADO',
        `Novo comentario na pendencia #${pendencia.numero}`,
        `Novo comentario na pendencia "${pendencia.titulo}" do projeto "${proj?.nome}".`,
        { projetoId, pendenciaId },
      ).catch((err) => console.error('Notificacao error:', err.message));

      // E-mail só se: emissor pediu, interação é pública (não-interna) e há
      // destinatários após o filtro UC/TERC em interno (já aplicado acima).
      if (dto.emailEnvolvidos === true && publica) {
        this.emailEnvolvidos.enviar({
          canal: 'pendencias',
          emissorId: userId,
          destinatarioIds: Array.from(idsNotificar),
          subject: `[Pendência #${pendencia.numero}] ${pendencia.titulo}`,
          html: emailTpl.pendenciaComentario({
            numero: pendencia.numero,
            titulo: pendencia.titulo,
            projetoNome: proj?.nome ?? '—',
            projetoId,
            pendenciaId,
            autor: interacao.usuario?.nome ?? 'Sistema',
            comentario: dto.descricao,
          }),
        }).catch((err) => console.error('Email envolvidos (pendencia comentario) error:', (err as Error).message));
      }
    }

    // Responsável do projeto: fica sabendo do novo comentário (exceto se foi ele).
    // Interna não envia e-mail e pula responsável UC/TERC (não vê o conteúdo).
    void this.helpers.notificarResponsavelProjeto({
      projetoId, autorId: userId, itemTipo: 'pendência',
      titulo: `Novo comentário na pendência #${pendencia.numero}`,
      mensagem: `Novo comentário na pendência "${pendencia.titulo}".`,
      dados: { pendenciaId },
      jaNotificados: [...Array.from(idsNotificar), ...mencionadoIds],
      emailJaEnviado: dto.emailEnvolvidos === true && publica,
      emailPermitido: publica,
      restringirNaoStaff: !publica,
    });

    return interacao;
  }

  async editarInteracaoPendencia(projetoId: string, pendenciaId: string, interacaoId: string, descricao: string, user: JwtPayload, role: string) {
    const userId = user.sub;
    await this.helpers.checkProjetoAccessChave(projetoId, user, role);

    const interacao = await this.prisma.interacaoPendencia.findFirst({
      where: { id: interacaoId, pendenciaId, tipo: 'COMENTARIO' },
    });
    if (!interacao) throw new NotFoundException('Comentario nao encontrado');

    // 29/05 — role NO DEPTO DO PROJETO (não principal do JWT) — multi-perfil.
    const projeto = await this.prisma.projeto.findUnique({
      where: { id: projetoId },
      select: { departamentoId: true },
    });
    const roleNoDeptoProjeto = projeto
      ? user.modulos
          ?.find((m) => m.codigo === 'WORKSPACE')
          ?.departamentos?.find((d) => d.id === projeto.departamentoId)?.role
      : undefined;
    const roleEfetiva = roleNoDeptoProjeto ?? role;

    if (interacao.usuarioId !== userId && !isGestor(roleEfetiva)) {
      throw new ForbiddenException('Voce so pode editar seus proprios comentarios');
    }

    return this.prisma.interacaoPendencia.update({
      where: { id: interacaoId },
      data: { descricao },
      include: { usuario: { select: { id: true, nome: true, username: true } } },
    });
  }

  // --- Anexos Pendencia ---

  async addAnexoPendencia(projetoId: string, pendenciaId: string, file: Express.Multer.File, user: JwtPayload, role: string) {
    const userId = user.sub;
    await this.helpers.checkProjetoAccessChave(projetoId, user, role);

    const pendencia = await this.prisma.pendenciaProjeto.findFirst({
      where: { id: pendenciaId, projetoId },
    });
    if (!pendencia) throw new NotFoundException('Pendencia nao encontrada');

    // Create interaction entry
    const interacao = await this.prisma.interacaoPendencia.create({
      data: {
        tipo: 'ANEXO',
        descricao: `Anexo adicionado: ${file.originalname}`,
        pendenciaId,
        usuarioId: userId,
      },
    });

    return this.prisma.anexoPendencia.create({
      data: {
        nomeOriginal: file.originalname,
        nomeArquivo: file.filename,
        mimeType: file.mimetype,
        tamanho: file.size,
        pendenciaId,
        interacaoId: interacao.id,
        usuarioId: userId,
      },
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  async downloadAnexoPendencia(projetoId: string, pendenciaId: string, anexoId: string, user: JwtPayload, role: string) {
    const userId = user.sub;
    await this.helpers.checkProjetoAccessChave(projetoId, user, role);

    const anexo = await this.prisma.anexoPendencia.findFirst({
      where: { id: anexoId, pendenciaId },
    });
    if (!anexo) throw new NotFoundException('Anexo nao encontrado');

    const filePath = path.join(PENDENCIA_UPLOADS_DIR, anexo.nomeArquivo);
    if (!fs.existsSync(filePath)) throw new NotFoundException('Arquivo nao encontrado no disco');

    return { anexo, filePath };
  }

  async removeAnexoPendencia(projetoId: string, pendenciaId: string, anexoId: string) {
    const anexo = await this.prisma.anexoPendencia.findFirst({
      where: { id: anexoId, pendenciaId, pendencia: { projetoId } },
    });
    if (!anexo) throw new NotFoundException('Anexo nao encontrado');

    const filePath = path.join(PENDENCIA_UPLOADS_DIR, anexo.nomeArquivo);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    // Se o anexo estava vinculado a uma interacao (comentario), marca a flag
    // pra UI conseguir mostrar chip "anexo removido" no lugar do chip do
    // arquivo — paridade com chamado (14/05/2026). Roda na mesma transacao
    // pra garantir consistencia entre o delete e o update.
    await this.prisma.$transaction(async (tx) => {
      if (anexo.interacaoId) {
        await tx.interacaoPendencia.update({
          where: { id: anexo.interacaoId },
          data: { anexoRemovido: true },
        });
      }
      await tx.anexoPendencia.delete({ where: { id: anexoId } });
    });
    return { deleted: true };
  }
}
