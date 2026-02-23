import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOsDto } from './dto/create-os.dto.js';
import { UpdateOsDto } from './dto/update-os.dto.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { StatusOS } from '@prisma/client';

const osInclude = {
  filial: { select: { id: true, codigo: true, nomeFantasia: true } },
  tecnico: { select: { id: true, nome: true, username: true } },
  solicitante: { select: { id: true, nome: true, username: true } },
  chamado: { select: { id: true, numero: true, titulo: true } },
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
      include: osInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const os = await this.prisma.ordemServico.findUnique({
      where: { id },
      include: osInclude,
    });
    if (!os) throw new NotFoundException('Ordem de servico nao encontrada');
    return os;
  }

  async create(dto: CreateOsDto, user: JwtPayload) {
    return this.prisma.ordemServico.create({
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        filialId: dto.filialId,
        tecnicoId: dto.tecnicoId,
        solicitanteId: user.sub,
        dataAgendamento: dto.dataAgendamento ? new Date(dto.dataAgendamento) : null,
        chamadoId: dto.chamadoId,
        observacoes: dto.observacoes,
      },
      include: osInclude,
    });
  }

  async update(id: string, dto: UpdateOsDto) {
    await this.findOne(id);
    return this.prisma.ordemServico.update({
      where: { id },
      data: {
        ...dto,
        dataAgendamento: dto.dataAgendamento ? new Date(dto.dataAgendamento) : undefined,
        dataExecucao: dto.dataExecucao ? new Date(dto.dataExecucao) : undefined,
      },
      include: osInclude,
    });
  }
}
