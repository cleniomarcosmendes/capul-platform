import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateChamadoDto } from '../dto/create-chamado.dto.js';
import { UpdateChamadoHeaderDto } from '../dto/update-chamado-header.dto.js';
import { TransferirEquipeDto, TransferirTecnicoDto } from '../dto/transferir-chamado.dto.js';
import { ComentarioChamadoDto } from '../dto/comentario-chamado.dto.js';
import { ResolverChamadoDto, ReabrirChamadoDto, CsatDto } from '../dto/resolver-chamado.dto.js';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import { NotificacaoService } from '../../notificacao/notificacao.service.js';
import { ChamadoHelpersService } from './chamado-helpers.service.js';
import { ChamadoTempoService } from './chamado-tempo.service.js';
import { chamadoInclude } from './chamado.constants.js';
import { isGestor, isTI } from '../../common/constants/roles.constant.js';
import { StatusChamado, Visibilidade } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class ChamadoCoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacaoService: NotificacaoService,
    private readonly helpers: ChamadoHelpersService,
    private readonly tempo: ChamadoTempoService,
  ) {}

  // ─── Coletar todos os envolvidos no chamado (para notificacoes) ───
  private async getDestinatariosChamado(
    chamadoId: string,
    excluirIds: string[],
  ): Promise<string[]> {
    const chamado = await this.prisma.chamado.findUnique({
      where: { id: chamadoId },
      select: {
        solicitanteId: true,
        tecnicoId: true,
        colaboradores: { select: { usuarioId: true } },
      },
    });
    if (!chamado) return [];

    const ids = new Set<string>();
    ids.add(chamado.solicitanteId);
    if (chamado.tecnicoId) ids.add(chamado.tecnicoId);
    for (const c of chamado.colaboradores) ids.add(c.usuarioId);

    for (const id of excluirIds) ids.delete(id);
    return Array.from(ids);
  }

  async findAll(user: JwtPayload, role: string, filters: {
    status?: StatusChamado | string;
    equipeId?: string;
    visibilidade?: Visibilidade;
    meusChamados?: boolean;
    projetoId?: string;
    filialId?: string;
    departamentoId?: string;
    pendentesAvaliacao?: boolean;
    search?: string;
    tecnicoId?: string;
    dataInicio?: string;
    dataFim?: string;
  }) {
    const where: Record<string, unknown> = {};

    if (filters.pendentesAvaliacao) {
      where.solicitanteId = user.sub;
      where.status = { in: ['RESOLVIDO', 'FECHADO'] };
      where.notaSatisfacao = null;
    } else {
      if (filters.status) {
        if ((filters.status as string) === 'ATIVOS') {
          where.status = { in: ['ABERTO', 'EM_ATENDIMENTO', 'PENDENTE', 'REABERTO'] };
        } else {
          where.status = filters.status;
        }
      }
      if (filters.equipeId) where.equipeAtualId = filters.equipeId;
      if (filters.visibilidade) where.visibilidade = filters.visibilidade;
      if (filters.projetoId) where.projetoId = filters.projetoId;
      if (filters.filialId) where.filialId = filters.filialId;
      if (filters.departamentoId) where.departamentoId = filters.departamentoId;
      if (filters.tecnicoId) where.tecnicoId = filters.tecnicoId;

      if (filters.dataInicio || filters.dataFim) {
        const createdAt: Record<string, Date> = {};
        if (filters.dataInicio) createdAt.gte = new Date(filters.dataInicio);
        if (filters.dataFim) {
          const fim = new Date(filters.dataFim);
          fim.setHours(23, 59, 59, 999);
          createdAt.lte = fim;
        }
        where.createdAt = createdAt;
      }

      // Para roles nao-staff, restringir as filiais vinculadas ao usuario
      const isStaff = isGestor(role) || isTI(role);
      if (!isStaff && !filters.filialId) {
        const userFiliais = await this.prisma.$queryRaw<{ filial_id: string }[]>`
          SELECT filial_id FROM core.usuario_filiais WHERE usuario_id = ${user.sub}
        `;
        const filialIds = userFiliais.map((f) => f.filial_id);
        if (filialIds.length > 0) {
          where.filialId = { in: filialIds };
        } else if (user.filialId) {
          // Fallback: filial do JWT
          where.filialId = user.filialId;
        }
      }

      if (role === 'USUARIO_FINAL') {
        where.solicitanteId = user.sub;
        where.visibilidade = 'PUBLICO';
      } else if (['USUARIO_CHAVE', 'TERCEIRIZADO'].includes(role)) {
        where.OR = [
          { solicitanteId: user.sub },
          { tecnicoId: user.sub },
          { colaboradores: { some: { usuarioId: user.sub } } },
        ];
      } else if (filters.meusChamados) {
        where.OR = [
          { solicitanteId: user.sub },
          { tecnicoId: user.sub },
          { colaboradores: { some: { usuarioId: user.sub } } },
        ];
      } else if (!filters.equipeId && !isTI(role)) {
        // Staff sem filtro "meus chamados" e sem equipe selecionada:
        // mostrar chamados das equipes que o tecnico faz parte + seus proprios
        const minhasEquipes = await this.prisma.membroEquipe.findMany({
          where: { usuarioId: user.sub, status: 'ATIVO' },
          select: { equipeId: true },
        });
        const equipeIds = minhasEquipes.map((e) => e.equipeId);
        if (equipeIds.length > 0) {
          where.OR = [
            { equipeAtualId: { in: equipeIds } },
            { tecnicoId: user.sub },
            { colaboradores: { some: { usuarioId: user.sub } } },
          ];
        }
      }
    }

    if (filters.search) {
      const term = filters.search.trim();
      const numero = parseInt(term, 10);
      const searchCondition = numero
        ? { OR: [{ numero }, { titulo: { contains: term, mode: 'insensitive' } }] }
        : { titulo: { contains: term, mode: 'insensitive' } };

      if (where.OR) {
        where.AND = [{ OR: where.OR }, searchCondition];
        delete where.OR;
      } else {
        Object.assign(where, searchCondition);
      }
    }

    return this.prisma.chamado.findMany({
      where,
      include: chamadoInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findOne(id: string, user: JwtPayload, role: string) {
    const chamado = await this.prisma.chamado.findUnique({
      where: { id },
      include: {
        ...chamadoInclude,
        historicos: {
          include: {
            usuario: { select: { id: true, nome: true, username: true } },
            equipeOrigem: { select: { id: true, nome: true, sigla: true } },
            equipeDestino: { select: { id: true, nome: true, sigla: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        colaboradores: {
          include: { usuario: { select: { id: true, nome: true, username: true } } },
        },
        registrosTempo: {
          where: { horaFim: null },
          select: { id: true, usuarioId: true, horaInicio: true },
        },
      },
    });

    if (!chamado) throw new NotFoundException('Chamado nao encontrado');

    if (role === 'USUARIO_FINAL') {
      if (chamado.solicitanteId !== user.sub) {
        throw new ForbiddenException('Sem acesso a este chamado');
      }
      chamado.historicos = chamado.historicos.filter((h) => h.publico);
    }

    return chamado;
  }

  async create(dto: CreateChamadoDto, user: JwtPayload, role: string) {
    const equipe = await this.prisma.equipeTI.findUnique({
      where: { id: dto.equipeAtualId },
    });
    if (!equipe) throw new BadRequestException('Equipe nao encontrada');

    if (role === 'USUARIO_FINAL' && !equipe.aceitaChamadoExterno) {
      throw new ForbiddenException('Esta equipe nao aceita chamados externos');
    }

    const visibilidade = dto.visibilidade ?? (role === 'USUARIO_FINAL' ? 'PUBLICO' : 'PUBLICO');

    if (role === 'USUARIO_FINAL' && visibilidade === 'PRIVADO') {
      throw new ForbiddenException('Usuario final nao pode criar chamados privados');
    }

    const sla = await this.prisma.slaDefinicao.findUnique({
      where: {
        equipeId_prioridade: {
          equipeId: dto.equipeAtualId,
          prioridade: dto.prioridade ?? 'MEDIA',
        },
      },
    });

    const dataLimiteSla = sla
      ? new Date(Date.now() + sla.horasResolucao * 60 * 60 * 1000)
      : null;

    // Auto-preencher nomes a partir do portfolio (integracao retroativa)
    let softwareNome = dto.softwareNome;
    let moduloNome = dto.moduloNome;

    if (dto.softwareId && !softwareNome) {
      const sw = await this.prisma.software.findUnique({ where: { id: dto.softwareId }, select: { nome: true } });
      if (sw) softwareNome = sw.nome;
    }
    if (dto.softwareModuloId && !moduloNome) {
      const mod = await this.prisma.softwareModulo.findUnique({ where: { id: dto.softwareModuloId }, select: { nome: true } });
      if (mod) moduloNome = mod.nome;
    }

    // Determinar filial, departamento e centro de custo:
    // Tecnicos podem informar valores diferentes (abertura em nome de outro setor)
    let filialId = user.filialId;
    let departamentoId: string | undefined = user.departamentoId;

    if (role !== 'USUARIO_FINAL') {
      if (dto.filialId) {
        const filial = await this.prisma.filial.findUnique({ where: { id: dto.filialId } });
        if (!filial) throw new BadRequestException('Filial nao encontrada');
        filialId = dto.filialId;
      }
      if (dto.departamentoId) {
        const depto = await this.prisma.departamento.findUnique({ where: { id: dto.departamentoId } });
        if (!depto) throw new BadRequestException('Departamento nao encontrado');
        departamentoId = dto.departamentoId;
      }
    }

    // Se tecnico/gestor/admin, auto-assumir o chamado
    // USUARIO_CHAVE e TERCEIRIZADO nao auto-assumem (mesmo perfil que usuario final)
    const rolesNaoAssumem = ['USUARIO_FINAL', 'USUARIO_CHAVE', 'TERCEIRIZADO'];
    const autoAssumir = !rolesNaoAssumem.includes(role);

    const chamado = await this.prisma.chamado.create({
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        visibilidade,
        prioridade: dto.prioridade ?? 'MEDIA',
        status: autoAssumir ? 'EM_ATENDIMENTO' : 'ABERTO',
        solicitanteId: user.sub,
        tecnicoId: autoAssumir ? user.sub : undefined,
        equipeAtualId: dto.equipeAtualId,
        filialId,
        departamentoId,
        softwareNome,
        moduloNome,
        softwareId: dto.softwareId,
        softwareModuloId: dto.softwareModuloId,
        catalogoServicoId: dto.catalogoServicoId,
        projetoId: dto.projetoId,
        ativoId: dto.ativoId,
        ipMaquina: dto.ipMaquina,
        matriculaColaborador: dto.matriculaColaborador,
        nomeColaborador: dto.nomeColaborador?.trim() || undefined,
        slaDefinicaoId: sla?.id,
        dataLimiteSla,
      },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'ABERTURA',
        descricao: 'Chamado aberto',
        publico: true,
        chamadoId: chamado.id,
        usuarioId: user.sub,
      },
    });

    return chamado;
  }

  async updateHeader(id: string, dto: UpdateChamadoHeaderDto, user: JwtPayload, role: string) {
    const chamado = await this.helpers.getChamadoOrFail(id);

    // Apenas o solicitante ou gestores podem editar o cabecalho
    const isCriador = chamado.solicitanteId === user.sub;
    if (!isCriador && !isGestor(role)) {
      throw new ForbiddenException('Apenas o solicitante ou gestores podem editar o cabecalho');
    }

    const data: Record<string, string> = {};
    if (dto.titulo !== undefined) data.titulo = dto.titulo;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Nenhum campo para atualizar');
    }

    return this.prisma.chamado.update({
      where: { id },
      data,
      include: chamadoInclude,
    });
  }

  async assumir(id: string, user: JwtPayload) {
    const chamado = await this.helpers.getChamadoOrFail(id);

    if (!['ABERTO', 'PENDENTE', 'REABERTO'].includes(chamado.status)) {
      throw new BadRequestException('Chamado nao pode ser assumido neste status');
    }

    const updated = await this.prisma.chamado.update({
      where: { id },
      data: { tecnicoId: user.sub, status: 'EM_ATENDIMENTO' },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'ASSUMIDO',
        descricao: 'Chamado assumido',
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
      },
    });

    // Auto-iniciar cronometro ao assumir (fecha timers anteriores)
    await this.tempo.encerrarTimersAbertos(user.sub);
    await this.prisma.registroTempoChamado.create({
      data: { horaInicio: new Date(), chamadoId: id, usuarioId: user.sub },
    });

    // Notificar envolvidos (solicitante + colaboradores)
    this.getDestinatariosChamado(id, [user.sub]).then((ids) => {
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATUALIZADO',
          `Chamado #${chamado.numero} assumido`,
          `O chamado "${chamado.titulo}" foi assumido por um tecnico.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    return updated;
  }

  async transferirEquipe(id: string, dto: TransferirEquipeDto, user: JwtPayload, role: string) {
    await this.helpers.assertTecnicoOuColaborador(id, user.sub, role);

    const chamado = await this.helpers.getChamadoOrFail(id);

    if (['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status)) {
      throw new BadRequestException('Chamado finalizado nao pode ser transferido. Reabra o chamado primeiro.');
    }

    const equipeDestino = await this.prisma.equipeTI.findUnique({
      where: { id: dto.equipeDestinoId },
    });
    if (!equipeDestino) throw new BadRequestException('Equipe destino nao encontrada');

    // Se indicou tecnico destino, validar que pertence a equipe destino
    if (dto.tecnicoDestinoId) {
      const membro = await this.prisma.membroEquipe.findUnique({
        where: { usuarioId_equipeId: { usuarioId: dto.tecnicoDestinoId, equipeId: dto.equipeDestinoId } },
      });
      if (!membro || membro.status !== 'ATIVO') {
        throw new BadRequestException('Tecnico informado nao pertence a equipe destino');
      }
    }

    const updated = await this.prisma.chamado.update({
      where: { id },
      data: {
        equipeAtualId: dto.equipeDestinoId,
        tecnicoId: dto.tecnicoDestinoId || null,
        status: dto.tecnicoDestinoId ? 'EM_ATENDIMENTO' : 'ABERTO',
      },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'TRANSFERENCIA_EQUIPE',
        descricao: dto.motivo || `Chamado transferido para outra equipe${dto.tecnicoDestinoId ? ' com tecnico indicado' : ''}`,
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
        equipeOrigemId: chamado.equipeAtualId,
        equipeDestinoId: dto.equipeDestinoId,
      },
    });

    // Notificar lideres da equipe destino
    this.prisma.membroEquipe.findMany({
      where: { equipeId: dto.equipeDestinoId, isLider: true, status: 'ATIVO' },
      select: { usuarioId: true },
    }).then((lideres) => {
      const ids = lideres.map((l) => l.usuarioId).filter((uid) => uid !== user.sub);
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATRIBUIDO',
          `Chamado #${chamado.numero} transferido`,
          `Chamado "${chamado.titulo}" foi transferido para sua equipe.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    // Notificar envolvidos (solicitante + tecnico anterior + colaboradores)
    this.getDestinatariosChamado(id, [user.sub]).then((ids) => {
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATUALIZADO',
          `Chamado #${chamado.numero} transferido de equipe`,
          `O chamado "${chamado.titulo}" foi transferido para a equipe ${equipeDestino.nome}.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    return updated;
  }

  async transferirTecnico(id: string, dto: TransferirTecnicoDto, user: JwtPayload, role: string) {
    await this.helpers.assertTecnicoOuColaborador(id, user.sub, role);

    const chamado = await this.helpers.getChamadoOrFail(id);

    if (['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status)) {
      throw new BadRequestException('Chamado finalizado nao pode ser transferido. Reabra o chamado primeiro.');
    }

    if (!chamado.tecnicoId) {
      throw new BadRequestException('E necessario assumir o chamado antes de transferir para outro tecnico');
    }

    const tecnico = await this.prisma.usuario.findUnique({ where: { id: dto.tecnicoId } });
    if (!tecnico) throw new BadRequestException('Tecnico nao encontrado');

    const updated = await this.prisma.chamado.update({
      where: { id },
      data: { tecnicoId: dto.tecnicoId, status: 'EM_ATENDIMENTO' },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'TRANSFERENCIA_TECNICO',
        descricao: dto.motivo || `Chamado transferido para ${tecnico.nome}`,
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
      },
    });

    // Notificar tecnico destino
    this.notificacaoService.criarParaUsuario(
      dto.tecnicoId, 'CHAMADO_ATRIBUIDO',
      `Chamado #${chamado.numero} atribuido a voce`,
      `O chamado "${chamado.titulo}" foi atribuido a voce.`,
      { chamadoId: id },
    ).catch((err) => console.error('Notificacao error:', err.message));

    // Notificar demais envolvidos (solicitante + colaboradores)
    this.getDestinatariosChamado(id, [user.sub, dto.tecnicoId]).then((ids) => {
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATUALIZADO',
          `Chamado #${chamado.numero} transferido`,
          `O chamado "${chamado.titulo}" foi transferido para ${tecnico.nome}.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    return updated;
  }

  async comentar(id: string, dto: ComentarioChamadoDto, user: JwtPayload, role: string) {
    // Solicitante tambem pode comentar
    await this.helpers.assertTecnicoOuColaborador(id, user.sub, role, { permitirSolicitante: true });

    const chamado = await this.helpers.getChamadoOrFail(id);

    if (['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status)) {
      throw new BadRequestException('Nao e possivel comentar em chamado finalizado. Reabra o chamado para adicionar comentarios.');
    }

    // Se chamado nao tem tecnico atribuido, apenas solicitante pode comentar
    if (!chamado.tecnicoId && chamado.solicitanteId !== user.sub && !isGestor(role)) {
      throw new BadRequestException('E necessario assumir o chamado antes de comentar');
    }

    const historico = await this.prisma.historicoChamado.create({
      data: {
        tipo: 'COMENTARIO',
        descricao: dto.descricao,
        publico: dto.publico ?? true,
        chamadoId: id,
        usuarioId: user.sub,
      },
      include: {
        usuario: { select: { id: true, nome: true, username: true } },
      },
    });

    // Notificar todos os envolvidos (solicitante + tecnico + colaboradores)
    const destinatarios = await this.getDestinatariosChamado(id, [user.sub]);

    // Processar @mencoes para notificacao diferenciada
    const mencionadoIds = new Set<string>();
    if (dto.descricao) {
      const regex = /@(\S+)/g;
      const usernames: string[] = [];
      let match;
      while ((match = regex.exec(dto.descricao)) !== null) {
        usernames.push(match[1].toLowerCase());
      }
      if (usernames.length > 0) {
        const mencionados = await this.prisma.usuario.findMany({
          where: { username: { in: usernames, mode: 'insensitive' } },
          select: { id: true },
        });
        for (const m of mencionados) {
          if (m.id !== user.sub) mencionadoIds.add(m.id);
        }
      }
    }

    // Mencionados recebem notificacao de mencao
    if (mencionadoIds.size > 0) {
      this.notificacaoService.criarParaUsuarios(
        Array.from(mencionadoIds), 'CHAMADO_ATUALIZADO',
        `Voce foi mencionado no chamado #${chamado.numero}`,
        `Voce foi mencionado em um comentario no chamado "${chamado.titulo}".`,
        { chamadoId: id },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }

    // Demais envolvidos (que nao foram mencionados) recebem notificacao de comentario
    const idsComentario = destinatarios.filter((uid) => !mencionadoIds.has(uid));
    if (idsComentario.length > 0) {
      this.notificacaoService.criarParaUsuarios(
        idsComentario, 'CHAMADO_ATUALIZADO',
        `Novo comentario no chamado #${chamado.numero}`,
        `Novo comentario no chamado "${chamado.titulo}".`,
        { chamadoId: id },
      ).catch((err) => console.error('Notificacao error:', err.message));
    }

    return historico;
  }

  async editarComentario(chamadoId: string, historicoId: string, descricao: string, user: JwtPayload, role: string) {
    const historico = await this.prisma.historicoChamado.findFirst({
      where: { id: historicoId, chamadoId, tipo: 'COMENTARIO' },
    });
    if (!historico) throw new NotFoundException('Comentario nao encontrado');

    // Somente o autor ou gestores pode editar
    if (historico.usuarioId !== user.sub && !isGestor(role)) {
      throw new ForbiddenException('Voce so pode editar seus proprios comentarios');
    }

    return this.prisma.historicoChamado.update({
      where: { id: historicoId },
      data: { descricao },
      include: {
        usuario: { select: { id: true, nome: true, username: true } },
      },
    });
  }

  async resolver(id: string, dto: ResolverChamadoDto, user: JwtPayload, role: string) {
    await this.helpers.assertTecnicoOuColaborador(id, user.sub, role);

    const chamado = await this.helpers.getChamadoOrFail(id);

    if (chamado.status === 'FECHADO' || chamado.status === 'CANCELADO') {
      throw new BadRequestException('Chamado ja encerrado');
    }

    if (!chamado.tecnicoId) {
      throw new BadRequestException('E necessario assumir o chamado antes de finaliza-lo');
    }

    // Verificar se ha registro de tempo
    const totalRegistros = await this.prisma.registroTempoChamado.count({
      where: { chamadoId: id },
    });
    if (totalRegistros === 0) {
      throw new BadRequestException('E necessario iniciar o tempo de atendimento antes de finalizar o chamado');
    }

    // Encerrar todos os cronometros ativos
    const timersAtivos = await this.prisma.registroTempoChamado.findMany({
      where: { chamadoId: id, horaFim: null },
    });
    const agora = new Date();
    for (const timer of timersAtivos) {
      const duracao = Math.round((agora.getTime() - new Date(timer.horaInicio).getTime()) / 60000);
      await this.prisma.registroTempoChamado.update({
        where: { id: timer.id },
        data: { horaFim: agora, duracaoMinutos: duracao },
      });
    }

    const updated = await this.prisma.chamado.update({
      where: { id },
      data: { status: 'RESOLVIDO', dataResolucao: new Date() },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'RESOLVIDO',
        descricao: dto.descricao || 'Chamado finalizado',
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
      },
    });

    // Notificar envolvidos (solicitante + tecnico + colaboradores)
    this.getDestinatariosChamado(id, [user.sub]).then((ids) => {
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATUALIZADO',
          `Chamado #${chamado.numero} finalizado`,
          `O chamado "${chamado.titulo}" foi finalizado.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    return updated;
  }

  async fechar(id: string, user: JwtPayload, role: string) {
    await this.helpers.assertTecnicoOuColaborador(id, user.sub, role);

    const chamado = await this.helpers.getChamadoOrFail(id);

    if (chamado.status !== 'RESOLVIDO') {
      throw new BadRequestException('Apenas chamados resolvidos podem ser fechados');
    }

    const updated = await this.prisma.chamado.update({
      where: { id },
      data: { status: 'FECHADO', dataFechamento: new Date() },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'FECHADO',
        descricao: 'Chamado fechado',
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
      },
    });

    // Notificar envolvidos (solicitante + tecnico + colaboradores)
    this.getDestinatariosChamado(id, [user.sub]).then((ids) => {
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATUALIZADO',
          `Chamado #${chamado.numero} fechado`,
          `O chamado "${chamado.titulo}" foi fechado.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    return updated;
  }

  async reabrir(id: string, dto: ReabrirChamadoDto, user: JwtPayload, role: string) {
    // Solicitante tambem pode reabrir
    await this.helpers.assertTecnicoOuColaborador(id, user.sub, role, { permitirSolicitante: true });

    const chamado = await this.helpers.getChamadoOrFail(id);

    if (chamado.status === 'CANCELADO') {
      throw new BadRequestException('Chamado cancelado nao pode ser reaberto');
    }
    if (chamado.status !== 'RESOLVIDO' && chamado.status !== 'FECHADO') {
      throw new BadRequestException('Apenas chamados resolvidos ou fechados podem ser reabertos');
    }

    // Se quem reabre e um tecnico de TI, ele automaticamente assume o chamado
    // USUARIO_CHAVE e TERCEIRIZADO nao auto-assumem
    const rolesNaoAssumem = ['USUARIO_FINAL', 'USUARIO_CHAVE', 'TERCEIRIZADO'];
    const isTecnicoTI = !rolesNaoAssumem.includes(role);
    const novoTecnicoId = isTecnicoTI ? user.sub : null;
    const novoStatus = isTecnicoTI ? 'EM_ATENDIMENTO' : 'REABERTO';

    const updated = await this.prisma.chamado.update({
      where: { id },
      data: {
        status: novoStatus,
        tecnicoId: novoTecnicoId,
        dataResolucao: null,
        dataFechamento: null,
      },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'REABERTO',
        descricao: dto.motivo || 'Chamado reaberto',
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
      },
    });

    // Se tecnico assumiu ao reabrir, criar historico de assumido tambem
    if (isTecnicoTI) {
      await this.prisma.historicoChamado.create({
        data: {
          tipo: 'ASSUMIDO',
          descricao: 'Chamado assumido ao reabrir',
          publico: true,
          chamadoId: id,
          usuarioId: user.sub,
        },
      });

      // Auto-iniciar cronometro ao assumir (fecha timers anteriores)
      await this.tempo.encerrarTimersAbertos(user.sub);
      await this.prisma.registroTempoChamado.create({
        data: { horaInicio: new Date(), chamadoId: id, usuarioId: user.sub },
      });
    }

    // Notificar envolvidos (solicitante + tecnico anterior + colaboradores)
    this.getDestinatariosChamado(id, [user.sub]).then((ids) => {
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATUALIZADO',
          `Chamado #${chamado.numero} reaberto`,
          `O chamado "${chamado.titulo}" foi reaberto.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    return updated;
  }

  async vincularProjeto(chamadoId: string, projetoId: string) {
    return this.prisma.chamado.update({
      where: { id: chamadoId },
      data: { projetoId },
      select: { id: true, projetoId: true },
    });
  }

  async cancelar(id: string, user: JwtPayload, role: string) {
    await this.helpers.assertTecnicoOuColaborador(id, user.sub, role);

    const chamado = await this.helpers.getChamadoOrFail(id);

    if (chamado.status === 'FECHADO' || chamado.status === 'CANCELADO') {
      throw new BadRequestException('Chamado ja encerrado');
    }

    const updated = await this.prisma.chamado.update({
      where: { id },
      data: { status: 'CANCELADO' },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'CANCELADO',
        descricao: 'Chamado cancelado',
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
      },
    });

    // Notificar envolvidos (solicitante + tecnico + colaboradores)
    this.getDestinatariosChamado(id, [user.sub]).then((ids) => {
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATUALIZADO',
          `Chamado #${chamado.numero} cancelado`,
          `O chamado "${chamado.titulo}" foi cancelado.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    return updated;
  }

  async avaliar(id: string, dto: CsatDto, user: JwtPayload) {
    const chamado = await this.helpers.getChamadoOrFail(id);

    if (chamado.solicitanteId !== user.sub) {
      throw new ForbiddenException('Apenas o solicitante pode avaliar');
    }

    if (chamado.status !== 'RESOLVIDO' && chamado.status !== 'FECHADO') {
      throw new BadRequestException('Chamado precisa estar resolvido ou fechado para avaliar');
    }

    const updated = await this.prisma.chamado.update({
      where: { id },
      data: {
        notaSatisfacao: dto.nota,
        comentarioSatisfacao: dto.comentario,
      },
      include: chamadoInclude,
    });

    // Historico de avaliacao
    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'AVALIADO',
        descricao: `Avaliacao: ${dto.nota}/5${dto.comentario ? ` - "${dto.comentario}"` : ''}`,
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
      },
    });

    // Notificar envolvidos (tecnico + colaboradores)
    this.getDestinatariosChamado(id, [user.sub]).then((ids) => {
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATUALIZADO',
          `Chamado #${chamado.numero} avaliado`,
          `O chamado "${chamado.titulo}" recebeu avaliacao ${dto.nota}/5.`,
          { chamadoId: id },
        ).catch((err) => console.error('Notificacao error:', err.message));
      }
    }).catch((err) => console.error('Notificacao error:', err.message));

    return updated;
  }

  async excluir(id: string, user: JwtPayload, role: string) {
    const rolesPermitidas = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'];
    if (!rolesPermitidas.includes(role)) {
      throw new ForbiddenException('Sem permissao para excluir chamados');
    }

    const chamado = await this.helpers.getChamadoOrFail(id);

    if (chamado.status !== 'ABERTO') {
      throw new BadRequestException('Somente chamados com status ABERTO podem ser excluidos');
    }

    // Remover anexos do disco
    const anexos = await this.prisma.anexoChamado.findMany({ where: { chamadoId: id } });
    const uploadsDir = path.join(process.cwd(), 'uploads', 'chamados');
    for (const anexo of anexos) {
      const filePath = path.join(uploadsDir, anexo.nomeArquivo);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Deletar registros dependentes e o chamado (cascade cuida de historicos, anexos, colaboradores, registros tempo)
    await this.prisma.chamado.delete({ where: { id } });

    return { deleted: true, numero: chamado.numero };
  }
}
