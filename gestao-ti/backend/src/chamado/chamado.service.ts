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
  anexos: {
    select: { id: true, nomeOriginal: true, mimeType: true, tamanho: true, descricao: true, createdAt: true, usuarioId: true, usuario: { select: { id: true, nome: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
};

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'chamados');

@Injectable()
export class ChamadoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacaoService: NotificacaoService,
  ) {}

  async findAll(user: JwtPayload, role: string, filters: {
    status?: StatusChamado;
    equipeId?: string;
    visibilidade?: Visibilidade;
    meusChamados?: boolean;
    projetoId?: string;
    filialId?: string;
    departamentoId?: string;
    pendentesAvaliacao?: boolean;
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

      if (role === 'USUARIO_FINAL') {
        where.solicitanteId = user.sub;
        where.visibilidade = 'PUBLICO';
      } else if (filters.meusChamados) {
        where.tecnicoId = user.sub;
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

    const chamado = await this.prisma.chamado.create({
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        visibilidade,
        prioridade: dto.prioridade ?? 'MEDIA',
        solicitanteId: user.sub,
        equipeAtualId: dto.equipeAtualId,
        filialId,
        departamentoId,
        softwareNome,
        moduloNome,
        softwareId: dto.softwareId,
        softwareModuloId: dto.softwareModuloId,
        catalogoServicoId: dto.catalogoServicoId,
        projetoId: dto.projetoId,
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

    if (chamado.status !== 'ABERTO' && chamado.status !== 'PENDENTE') {
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

    // Notificar solicitante
    this.notificacaoService.criarParaUsuario(
      chamado.solicitanteId, 'CHAMADO_ATUALIZADO',
      `Chamado #${chamado.numero} assumido`,
      `Seu chamado "${chamado.titulo}" foi assumido por um tecnico.`,
      { chamadoId: id },
    ).catch(() => {});

    return updated;
  }

  async transferirEquipe(id: string, dto: TransferirEquipeDto, user: JwtPayload) {
    const chamado = await this.getChamadoOrFail(id);

    if (chamado.status === 'FECHADO' || chamado.status === 'CANCELADO') {
      throw new BadRequestException('Chamado encerrado nao pode ser transferido');
    }

    const equipeDestino = await this.prisma.equipeTI.findUnique({
      where: { id: dto.equipeDestinoId },
    });
    if (!equipeDestino) throw new BadRequestException('Equipe destino nao encontrada');

    const updated = await this.prisma.chamado.update({
      where: { id },
      data: {
        equipeAtualId: dto.equipeDestinoId,
        tecnicoId: null,
        status: 'ABERTO',
      },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'TRANSFERENCIA_EQUIPE',
        descricao: dto.motivo || 'Chamado transferido para outra equipe',
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

  async transferirTecnico(id: string, dto: TransferirTecnicoDto, user: JwtPayload) {
    const chamado = await this.getChamadoOrFail(id);

    if (chamado.status === 'FECHADO' || chamado.status === 'CANCELADO') {
      throw new BadRequestException('Chamado encerrado nao pode ser transferido');
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

  async comentar(id: string, dto: ComentarioChamadoDto, user: JwtPayload) {
    const chamado = await this.getChamadoOrFail(id);

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

  async resolver(id: string, dto: ResolverChamadoDto, user: JwtPayload) {
    const chamado = await this.getChamadoOrFail(id);

    if (chamado.status === 'FECHADO' || chamado.status === 'CANCELADO') {
      throw new BadRequestException('Chamado ja encerrado');
    }

    const updated = await this.prisma.chamado.update({
      where: { id },
      data: { status: 'RESOLVIDO', dataResolucao: new Date() },
      include: chamadoInclude,
    });

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'RESOLVIDO',
        descricao: dto.descricao || 'Chamado resolvido',
        publico: true,
        chamadoId: id,
        usuarioId: user.sub,
      },
    });

    // Notificar solicitante
    this.notificacaoService.criarParaUsuario(
      chamado.solicitanteId, 'CHAMADO_ATUALIZADO',
      `Chamado #${chamado.numero} resolvido`,
      `Seu chamado "${chamado.titulo}" foi resolvido.`,
      { chamadoId: id },
    ).catch(() => {});

    return updated;
  }

  async fechar(id: string, user: JwtPayload) {
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

  async reabrir(id: string, dto: ReabrirChamadoDto, user: JwtPayload) {
    const chamado = await this.getChamadoOrFail(id);

    if (chamado.status !== 'RESOLVIDO' && chamado.status !== 'FECHADO') {
      throw new BadRequestException('Apenas chamados resolvidos ou fechados podem ser reabertos');
    }

    const updated = await this.prisma.chamado.update({
      where: { id },
      data: { status: 'ABERTO', dataResolucao: null, dataFechamento: null },
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

    return updated;
  }

  async cancelar(id: string, user: JwtPayload) {
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
    await this.getChamadoOrFail(chamadoId);
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
}
