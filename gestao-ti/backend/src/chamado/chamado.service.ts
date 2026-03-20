import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateChamadoDto } from './dto/create-chamado.dto.js';
import { TransferirEquipeDto, TransferirTecnicoDto } from './dto/transferir-chamado.dto.js';
import { ComentarioChamadoDto } from './dto/comentario-chamado.dto.js';
import { ResolverChamadoDto, ReabrirChamadoDto, CsatDto } from './dto/resolver-chamado.dto.js';
import { UpdateRegistroTempoChamadoDto } from './dto/update-registro-tempo-chamado.dto.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { NotificacaoService } from '../notificacao/notificacao.service.js';
import { StatusChamado, Visibilidade } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

const chamadoInclude = {
  solicitante: { select: { id: true, nome: true, username: true, email: true } },
  tecnico: { select: { id: true, nome: true, username: true, email: true } },
  equipeAtual: { select: { id: true, nome: true, sigla: true, cor: true } },
  filial: { select: { id: true, codigo: true, nomeFantasia: true } },
  departamento: { select: { id: true, nome: true } },
  catalogoServico: { select: { id: true, nome: true } },
  slaDefinicao: true,
  software: { select: { id: true, nome: true, tipo: true } },
  softwareModulo: { select: { id: true, nome: true } },
  projeto: { select: { id: true, numero: true, nome: true } },
  ativo: { select: { id: true, tag: true, nome: true, tipo: true } },
  anexos: {
    select: { id: true, nomeOriginal: true, mimeType: true, tamanho: true, descricao: true, createdAt: true, usuarioId: true, usuario: { select: { id: true, nome: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
};

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'chamados');

const ROLES_GESTORES = ['ADMIN', 'GESTOR_TI'];

@Injectable()
export class ChamadoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacaoService: NotificacaoService,
  ) {}

  // ─── Validacao: usuario e tecnico atribuido ou colaborador ───
  private async assertTecnicoOuColaborador(
    chamadoId: string,
    userId: string,
    role: string,
    { permitirSolicitante = false }: { permitirSolicitante?: boolean } = {},
  ) {
    if (ROLES_GESTORES.includes(role)) return;

    const chamado = await this.prisma.chamado.findUnique({
      where: { id: chamadoId },
      select: {
        tecnicoId: true,
        solicitanteId: true,
        colaboradores: { select: { usuarioId: true } },
      },
    });
    if (!chamado) throw new NotFoundException('Chamado nao encontrado');

    if (chamado.tecnicoId === userId) return;
    if (chamado.colaboradores.some((c) => c.usuarioId === userId)) return;
    if (permitirSolicitante && chamado.solicitanteId === userId) return;

    throw new ForbiddenException('Apenas o tecnico atribuido ou colaboradores podem realizar esta acao');
  }

  async findAll(user: JwtPayload, role: string, filters: {
    status?: StatusChamado;
    equipeId?: string;
    visibilidade?: Visibilidade;
    meusChamados?: boolean;
    projetoId?: string;
    filialId?: string;
    departamentoId?: string;
    pendentesAvaliacao?: boolean;
    search?: string;
  }) {
    const where: Record<string, unknown> = {};

    if (filters.pendentesAvaliacao) {
      where.solicitanteId = user.sub;
      where.status = { in: ['RESOLVIDO', 'FECHADO'] };
      where.notaSatisfacao = null;
    } else {
      if (filters.status) where.status = filters.status;
      if (filters.equipeId) where.equipeAtualId = filters.equipeId;
      if (filters.visibilidade) where.visibilidade = filters.visibilidade;
      if (filters.projetoId) where.projetoId = filters.projetoId;
      if (filters.filialId) where.filialId = filters.filialId;
      if (filters.departamentoId) where.departamentoId = filters.departamentoId;

      // Para roles nao-staff, restringir as filiais vinculadas ao usuario
      const isStaff = ['ADMIN', 'GESTOR_TI'].includes(role);
      if (!isStaff && !filters.filialId) {
        const userFiliais = await this.prisma.$queryRawUnsafe<{ filial_id: string }[]>(
          `SELECT filial_id FROM core.usuario_filiais WHERE usuario_id = $1`,
          user.sub,
        );
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
    const autoAssumir = role !== 'USUARIO_FINAL';

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

  async assumir(id: string, user: JwtPayload) {
    const chamado = await this.getChamadoOrFail(id);

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
    await this.encerrarTimersAbertos(user.sub);
    await this.prisma.registroTempoChamado.create({
      data: { horaInicio: new Date(), chamadoId: id, usuarioId: user.sub },
    });

    // Notificar solicitante
    this.notificacaoService.criarParaUsuario(
      chamado.solicitanteId, 'CHAMADO_ATUALIZADO',
      `Chamado #${chamado.numero} assumido`,
      `Seu chamado "${chamado.titulo}" foi assumido por um tecnico.`,
      { chamadoId: id },
    ).catch(() => {});

    return updated;
  }

  async transferirEquipe(id: string, dto: TransferirEquipeDto, user: JwtPayload, role: string) {
    await this.assertTecnicoOuColaborador(id, user.sub, role);

    const chamado = await this.getChamadoOrFail(id);

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
      const ids = lideres.map((l) => l.usuarioId);
      if (ids.length > 0) {
        this.notificacaoService.criarParaUsuarios(
          ids, 'CHAMADO_ATRIBUIDO',
          `Chamado #${chamado.numero} transferido`,
          `Chamado "${chamado.titulo}" foi transferido para sua equipe.`,
          { chamadoId: id },
        ).catch(() => {});
      }
    }).catch(() => {});

    return updated;
  }

  async transferirTecnico(id: string, dto: TransferirTecnicoDto, user: JwtPayload, role: string) {
    await this.assertTecnicoOuColaborador(id, user.sub, role);

    const chamado = await this.getChamadoOrFail(id);

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
    ).catch(() => {});

    return updated;
  }

  async comentar(id: string, dto: ComentarioChamadoDto, user: JwtPayload, role: string) {
    // Solicitante tambem pode comentar
    await this.assertTecnicoOuColaborador(id, user.sub, role, { permitirSolicitante: true });

    const chamado = await this.getChamadoOrFail(id);

    if (['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status)) {
      throw new BadRequestException('Nao e possivel comentar em chamado finalizado. Reabra o chamado para adicionar comentarios.');
    }

    // Se chamado nao tem tecnico atribuido, apenas solicitante pode comentar
    if (!chamado.tecnicoId && chamado.solicitanteId !== user.sub && !ROLES_GESTORES.includes(role)) {
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

    // Notificar a outra parte (solicitante ou tecnico)
    const destinatarioId = user.sub === chamado.solicitanteId
      ? chamado.tecnicoId
      : chamado.solicitanteId;
    if (destinatarioId) {
      this.notificacaoService.criarParaUsuario(
        destinatarioId, 'CHAMADO_ATUALIZADO',
        `Novo comentario no chamado #${chamado.numero}`,
        `Novo comentario no chamado "${chamado.titulo}".`,
        { chamadoId: id },
      ).catch(() => {});
    }

    return historico;
  }

  async resolver(id: string, dto: ResolverChamadoDto, user: JwtPayload, role: string) {
    await this.assertTecnicoOuColaborador(id, user.sub, role);

    const chamado = await this.getChamadoOrFail(id);

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

    // Notificar solicitante
    this.notificacaoService.criarParaUsuario(
      chamado.solicitanteId, 'CHAMADO_ATUALIZADO',
      `Chamado #${chamado.numero} finalizado`,
      `Seu chamado "${chamado.titulo}" foi finalizado.`,
      { chamadoId: id },
    ).catch(() => {});

    return updated;
  }

  async fechar(id: string, user: JwtPayload, role: string) {
    await this.assertTecnicoOuColaborador(id, user.sub, role);

    const chamado = await this.getChamadoOrFail(id);

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

    // Notificar solicitante
    this.notificacaoService.criarParaUsuario(
      chamado.solicitanteId, 'CHAMADO_ATUALIZADO',
      `Chamado #${chamado.numero} fechado`,
      `Seu chamado "${chamado.titulo}" foi fechado.`,
      { chamadoId: id },
    ).catch(() => {});

    return updated;
  }

  async reabrir(id: string, dto: ReabrirChamadoDto, user: JwtPayload, role: string) {
    // Solicitante tambem pode reabrir
    await this.assertTecnicoOuColaborador(id, user.sub, role, { permitirSolicitante: true });

    const chamado = await this.getChamadoOrFail(id);

    if (chamado.status === 'CANCELADO') {
      throw new BadRequestException('Chamado cancelado nao pode ser reaberto');
    }
    if (chamado.status !== 'RESOLVIDO' && chamado.status !== 'FECHADO') {
      throw new BadRequestException('Apenas chamados resolvidos ou fechados podem ser reabertos');
    }

    // Se quem reabre e um tecnico de TI (nao USUARIO_FINAL), ele automaticamente assume o chamado
    const isTecnicoTI = role !== 'USUARIO_FINAL';
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
      await this.encerrarTimersAbertos(user.sub);
      await this.prisma.registroTempoChamado.create({
        data: { horaInicio: new Date(), chamadoId: id, usuarioId: user.sub },
      });
    }

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
    await this.assertTecnicoOuColaborador(id, user.sub, role);

    const chamado = await this.getChamadoOrFail(id);

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

    return updated;
  }

  async avaliar(id: string, dto: CsatDto, user: JwtPayload) {
    const chamado = await this.getChamadoOrFail(id);

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

    // Notificar tecnico (fire-and-forget)
    if (chamado.tecnicoId) {
      this.notificacaoService.criarParaUsuario(
        chamado.tecnicoId,
        'CHAMADO_ATUALIZADO',
        `Chamado #${chamado.numero} avaliado`,
        `O chamado "${chamado.titulo}" recebeu avaliacao ${dto.nota}/5.`,
        { chamadoId: id },
      ).catch(() => {});
    }

    return updated;
  }

  // === Anexos ===

  async listAnexos(chamadoId: string) {
    await this.getChamadoOrFail(chamadoId);
    return this.prisma.anexoChamado.findMany({
      where: { chamadoId },
      include: { usuario: { select: { id: true, nome: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addAnexo(chamadoId: string, file: Express.Multer.File, userId: string, descricao?: string) {
    const chamado = await this.getChamadoOrFail(chamadoId);
    if (['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status)) {
      throw new BadRequestException('Nao e possivel anexar arquivos em chamado finalizado');
    }
    return this.prisma.anexoChamado.create({
      data: {
        nomeOriginal: file.originalname,
        nomeArquivo: file.filename,
        mimeType: file.mimetype,
        tamanho: file.size,
        descricao,
        chamadoId,
        usuarioId: userId,
      },
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  async getAnexoFile(chamadoId: string, anexoId: string) {
    const anexo = await this.prisma.anexoChamado.findFirst({
      where: { id: anexoId, chamadoId },
    });
    if (!anexo) throw new NotFoundException('Anexo nao encontrado neste chamado');

    const filePath = path.join(UPLOADS_DIR, anexo.nomeArquivo);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Arquivo nao encontrado no disco');
    }
    return { filePath, anexo };
  }

  async removeAnexo(chamadoId: string, anexoId: string) {
    const chamado = await this.getChamadoOrFail(chamadoId);
    if (['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status)) {
      throw new BadRequestException('Nao e possivel remover anexo de chamado finalizado');
    }

    const anexo = await this.prisma.anexoChamado.findFirst({
      where: { id: anexoId, chamadoId },
    });
    if (!anexo) throw new NotFoundException('Anexo nao encontrado neste chamado');

    // Remove do disco
    const filePath = path.join(UPLOADS_DIR, anexo.nomeArquivo);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await this.prisma.anexoChamado.delete({ where: { id: anexoId } });
    return { deleted: true };
  }

  private async getChamadoOrFail(id: string) {
    const chamado = await this.prisma.chamado.findUnique({ where: { id } });
    if (!chamado) throw new NotFoundException('Chamado nao encontrado');
    return chamado;
  }

  // --- Colaboradores ---

  async listarColaboradores(chamadoId: string) {
    return this.prisma.chamadoColaborador.findMany({
      where: { chamadoId },
      include: { usuario: { select: { id: true, nome: true, username: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async adicionarColaborador(chamadoId: string, usuarioId: string, user: JwtPayload, role: string) {
    await this.assertTecnicoOuColaborador(chamadoId, user.sub, role);

    const chamado = await this.getChamadoOrFail(chamadoId);
    if (!chamado.tecnicoId) {
      throw new BadRequestException('E necessario que um tecnico assuma o chamado antes de adicionar colaboradores');
    }
    if (chamado.tecnicoId === usuarioId) {
      throw new BadRequestException('O tecnico responsavel pelo chamado nao pode ser adicionado como colaborador');
    }
    if (chamado.solicitanteId === usuarioId) {
      throw new BadRequestException('O solicitante do chamado nao pode ser adicionado como colaborador');
    }
    const jaExiste = await this.prisma.chamadoColaborador.findFirst({
      where: { chamadoId, usuarioId },
    });
    if (jaExiste) {
      throw new BadRequestException('Usuario ja e colaborador deste chamado');
    }
    return this.prisma.chamadoColaborador.create({
      data: { chamadoId, usuarioId },
      include: { usuario: { select: { id: true, nome: true, username: true } } },
    });
  }

  async removerColaborador(chamadoId: string, colaboradorId: string, user: JwtPayload, role: string) {
    await this.assertTecnicoOuColaborador(chamadoId, user.sub, role);

    const chamado = await this.getChamadoOrFail(chamadoId);
    if (['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status)) {
      throw new BadRequestException('Nao e possivel remover colaborador de chamado finalizado');
    }

    const reg = await this.prisma.chamadoColaborador.findFirst({
      where: { id: colaboradorId, chamadoId },
    });
    if (!reg) throw new NotFoundException('Colaborador nao encontrado neste chamado');
    const temRegistros = await this.prisma.registroTempoChamado.count({
      where: { chamadoId, usuarioId: reg.usuarioId },
    });
    if (temRegistros > 0) {
      throw new BadRequestException('Colaborador possui registros de tempo neste chamado e nao pode ser removido');
    }
    return this.prisma.chamadoColaborador.delete({ where: { id: colaboradorId } });
  }

  // --- Registro de Tempo (Chamado) ---

  async listarRegistrosTempo(chamadoId: string) {
    return this.prisma.registroTempoChamado.findMany({
      where: { chamadoId },
      include: { usuario: { select: { id: true, nome: true } } },
      orderBy: { horaInicio: 'desc' },
    });
  }

  /** Encerra todos os timers abertos do usuario (chamados + projetos) */
  private async encerrarTimersAbertos(userId: string) {
    const now = new Date();

    // Encerra timers abertos em chamados
    const abertosChamado = await this.prisma.registroTempoChamado.findMany({
      where: { usuarioId: userId, horaFim: null },
    });
    for (const reg of abertosChamado) {
      const duracao = Math.round((now.getTime() - new Date(reg.horaInicio).getTime()) / 60000);
      await this.prisma.registroTempoChamado.update({
        where: { id: reg.id },
        data: { horaFim: now, duracaoMinutos: duracao },
      });
    }

    // Encerra timers abertos em atividades de projeto (cross-module)
    const abertosProjeto = await this.prisma.registroTempo.findMany({
      where: { usuarioId: userId, horaFim: null },
    });
    for (const reg of abertosProjeto) {
      const duracao = Math.round((now.getTime() - new Date(reg.horaInicio).getTime()) / 60000);
      await this.prisma.registroTempo.update({
        where: { id: reg.id },
        data: { horaFim: now, duracaoMinutos: duracao },
      });
    }
  }

  async iniciarTempoChamado(chamadoId: string, userId: string, role: string) {
    await this.assertTecnicoOuColaborador(chamadoId, userId, role);

    const chamado = await this.getChamadoOrFail(chamadoId);

    if (['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status)) {
      throw new BadRequestException('Nao e possivel registrar tempo em chamado finalizado');
    }

    await this.encerrarTimersAbertos(userId);

    return this.prisma.registroTempoChamado.create({
      data: { horaInicio: new Date(), chamadoId, usuarioId: userId },
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  async encerrarTempoChamado(chamadoId: string, userId: string) {
    const registro = await this.prisma.registroTempoChamado.findFirst({
      where: { chamadoId, usuarioId: userId, horaFim: null },
    });
    if (!registro) throw new NotFoundException('Nenhum registro ativo para este chamado');

    const duracao = Math.round((Date.now() - new Date(registro.horaInicio).getTime()) / 60000);
    return this.prisma.registroTempoChamado.update({
      where: { id: registro.id },
      data: { horaFim: new Date(), duracaoMinutos: duracao },
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  private validarEdicaoRegistroChamado(registro: { horaFim: Date | null; horaInicio: Date; usuarioId: string }, userId: string, role: string) {
    const ROLES_GESTORES = ['ADMIN', 'GESTOR_TI'];

    // Regra 1: nao editar registro com timer ativo
    if (!registro.horaFim) {
      throw new BadRequestException('Nao e possivel editar um registro com cronometro ativo. Encerre o cronometro primeiro.');
    }

    // Regra 2: apenas o dono ou gestores
    if (registro.usuarioId !== userId && !ROLES_GESTORES.includes(role)) {
      throw new ForbiddenException('Voce so pode editar seus proprios registros de tempo.');
    }

    // Regra 3: limite D-2
    const limite = new Date();
    limite.setDate(limite.getDate() - 2);
    limite.setHours(0, 0, 0, 0);
    if (new Date(registro.horaInicio) < limite && !ROLES_GESTORES.includes(role)) {
      throw new BadRequestException('Nao e possivel editar registros com mais de 2 dias. Solicite ao gestor.');
    }
  }

  async ajustarRegistroTempoChamado(chamadoId: string, registroId: string, dto: UpdateRegistroTempoChamadoDto, userId?: string, role?: string) {
    const chamado = await this.getChamadoOrFail(chamadoId);
    if (!['RESOLVIDO', 'FECHADO'].includes(chamado.status)) {
      throw new BadRequestException('O registro de tempo so pode ser editado apos a finalizacao do chamado');
    }

    const registro = await this.prisma.registroTempoChamado.findFirst({
      where: { id: registroId, chamadoId },
    });
    if (!registro) throw new NotFoundException('Registro de tempo nao encontrado');

    if (userId && role) {
      this.validarEdicaoRegistroChamado(registro, userId, role);
      if (registro.usuarioId !== userId) {
        this.prisma.$queryRawUnsafe(
          `INSERT INTO core.system_logs (id, level, message, module, action, usuario_id, metadata, created_at) VALUES (gen_random_uuid()::text, 'AUDIT', 'REGISTRO_TEMPO_CHAMADO_EDITADO_POR_GESTOR', 'CHAMADO', 'REGISTRO_TEMPO_CHAMADO_EDITADO_POR_GESTOR', $1, $2, NOW())`,
          userId, JSON.stringify({ registroId, donoId: registro.usuarioId, chamadoId }),
        ).catch(() => {});
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.horaInicio) data.horaInicio = new Date(dto.horaInicio);
    if (dto.horaFim) data.horaFim = new Date(dto.horaFim);
    if (dto.observacoes !== undefined) data.observacoes = dto.observacoes;

    const inicio = dto.horaInicio ? new Date(dto.horaInicio) : new Date(registro.horaInicio);
    const fim = dto.horaFim ? new Date(dto.horaFim) : registro.horaFim ? new Date(registro.horaFim) : null;
    if (fim) {
      data.duracaoMinutos = Math.round((fim.getTime() - inicio.getTime()) / 60000);
    }

    return this.prisma.registroTempoChamado.update({
      where: { id: registroId },
      data,
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  async removerRegistroTempoChamado(chamadoId: string, registroId: string, userId?: string, role?: string) {
    const chamado = await this.getChamadoOrFail(chamadoId);
    if (!['RESOLVIDO', 'FECHADO'].includes(chamado.status)) {
      throw new BadRequestException('O registro de tempo so pode ser removido apos a finalizacao do chamado');
    }

    const registro = await this.prisma.registroTempoChamado.findFirst({
      where: { id: registroId, chamadoId },
    });
    if (!registro) throw new NotFoundException('Registro de tempo nao encontrado');
    if (userId && role) {
      this.validarEdicaoRegistroChamado(registro, userId, role);
      if (registro.usuarioId !== userId) {
        this.prisma.$queryRawUnsafe(
          `INSERT INTO core.system_logs (id, level, message, module, action, usuario_id, metadata, created_at) VALUES (gen_random_uuid()::text, 'AUDIT', 'REGISTRO_TEMPO_CHAMADO_REMOVIDO_POR_GESTOR', 'CHAMADO', 'REGISTRO_TEMPO_CHAMADO_REMOVIDO_POR_GESTOR', $1, $2, NOW())`,
          userId, JSON.stringify({ registroId, donoId: registro.usuarioId, chamadoId }),
        ).catch(() => {});
      }
    }
    return this.prisma.registroTempoChamado.delete({ where: { id: registroId } });
  }
}
