import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOsDto } from './dto/create-os.dto.js';
import { UpdateOsDto } from './dto/update-os.dto.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { StatusOS } from '@prisma/client';

const osListInclude = {
  filial: { select: { id: true, codigo: true, nomeFantasia: true } },
  solicitante: { select: { id: true, nome: true, username: true } },
  tecnicos: {
    include: { tecnico: { select: { id: true, nome: true, username: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  chamados: {
    include: { chamado: { select: { id: true, numero: true, titulo: true, status: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  _count: { select: { chamados: true, tecnicos: true } },
};

@Injectable()
export class OrdemServicoService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: StatusOS, filialId?: string) {
    return this.prisma.ordemServico.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(filialId ? { filialId } : {}),
      },
      include: osListInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const os = await this.prisma.ordemServico.findUnique({
      where: { id },
      include: osListInclude,
    });
    if (!os) throw new NotFoundException('Ordem de servico nao encontrada');
    return os;
  }

  async create(dto: CreateOsDto, user: JwtPayload) {
    const os = await this.prisma.ordemServico.create({
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        filialId: dto.filialId,
        solicitanteId: user.sub,
        dataAgendamento: dto.dataAgendamento ? new Date(dto.dataAgendamento) : null,
        observacoes: dto.observacoes,
        tecnicos: dto.tecnicoId
          ? { create: { tecnicoId: dto.tecnicoId } }
          : undefined,
      },
      include: osListInclude,
    });
    return os;
  }

  async update(id: string, dto: UpdateOsDto) {
    await this.findOne(id);
    return this.prisma.ordemServico.update({
      where: { id },
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        dataAgendamento: dto.dataAgendamento ? new Date(dto.dataAgendamento) : undefined,
        observacoes: dto.observacoes,
      },
      include: osListInclude,
    });
  }

  // --- Workflow: Iniciar / Encerrar / Cancelar ---

  async iniciar(id: string) {
    const os = await this.findOne(id);
    if (os.status !== 'ABERTA') throw new BadRequestException('Somente OS com status ABERTA pode ser iniciada');
    if (os.tecnicos.length === 0) throw new BadRequestException('Adicione pelo menos um tecnico antes de iniciar');
    return this.prisma.ordemServico.update({
      where: { id },
      data: { status: 'EM_EXECUCAO', dataInicio: new Date() },
      include: osListInclude,
    });
  }

  async encerrar(id: string, observacoes?: string) {
    const os = await this.findOne(id);
    if (os.status !== 'EM_EXECUCAO') throw new BadRequestException('Somente OS em execucao pode ser encerrada');

    const statusFinalizados = ['RESOLVIDO', 'FECHADO', 'CANCELADO'];
    const chamadosAbertos = os.chamados.filter(
      (oc) => !statusFinalizados.includes(oc.chamado.status),
    );
    if (chamadosAbertos.length > 0) {
      const nums = chamadosAbertos.map((oc) => `#${oc.chamado.numero}`).join(', ');
      throw new BadRequestException(
        `Nao e possivel encerrar a OS. Os chamados ${nums} ainda estao em aberto. Desvincule ou finalize-os antes de encerrar.`,
      );
    }

    return this.prisma.ordemServico.update({
      where: { id },
      data: {
        status: 'CONCLUIDA',
        dataFim: new Date(),
        observacoes: observacoes || os.observacoes,
      },
      include: osListInclude,
    });
  }

  async cancelar(id: string) {
    const os = await this.findOne(id);
    if (['CONCLUIDA', 'CANCELADA'].includes(os.status)) throw new BadRequestException('OS ja encerrada');
    return this.prisma.ordemServico.update({
      where: { id },
      data: { status: 'CANCELADA', dataFim: os.status === 'EM_EXECUCAO' ? new Date() : undefined },
      include: osListInclude,
    });
  }

  // --- Chamados N:N ---

  async vincularChamado(osId: string, chamadoId: string) {
    await this.findOne(osId);
    const chamado = await this.prisma.chamado.findUnique({ where: { id: chamadoId } });
    if (!chamado) throw new BadRequestException('Chamado nao encontrado');
    try {
      await this.prisma.osChamado.create({ data: { osId, chamadoId } });
    } catch {
      throw new BadRequestException('Chamado ja vinculado a esta OS');
    }
    return this.findOne(osId);
  }

  async desvincularChamado(osId: string, chamadoId: string) {
    const item = await this.prisma.osChamado.findUnique({
      where: { osId_chamadoId: { osId, chamadoId } },
    });
    if (!item) throw new NotFoundException('Vinculo nao encontrado');
    await this.prisma.osChamado.delete({ where: { id: item.id } });
    return this.findOne(osId);
  }

  // --- Tecnicos N:N ---

  async adicionarTecnico(osId: string, tecnicoId: string) {
    await this.findOne(osId);
    const user = await this.prisma.usuario.findUnique({ where: { id: tecnicoId } });
    if (!user) throw new BadRequestException('Usuario nao encontrado');
    try {
      await this.prisma.osTecnico.create({ data: { osId, tecnicoId } });
    } catch {
      throw new BadRequestException('Tecnico ja vinculado a esta OS');
    }
    return this.findOne(osId);
  }

  async removerTecnico(osId: string, tecnicoId: string) {
    const item = await this.prisma.osTecnico.findUnique({
      where: { osId_tecnicoId: { osId, tecnicoId } },
    });
    if (!item) throw new NotFoundException('Vinculo nao encontrado');
    await this.prisma.osTecnico.delete({ where: { id: item.id } });
    return this.findOne(osId);
  }
}
