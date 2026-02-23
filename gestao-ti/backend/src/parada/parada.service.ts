import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateParadaDto } from './dto/create-parada.dto';
import { UpdateParadaDto } from './dto/update-parada.dto';
import { FinalizarParadaDto } from './dto/finalizar-parada.dto';

const paradaListInclude = {
  software: { select: { id: true, nome: true, tipo: true, criticidade: true } },
  softwareModulo: { select: { id: true, nome: true } },
  chamado: { select: { id: true, numero: true, titulo: true } },
  registradoPor: { select: { id: true, nome: true, username: true } },
  filiaisAfetadas: {
    include: { filial: { select: { id: true, codigo: true, nomeFantasia: true } } },
  },
  _count: { select: { filiaisAfetadas: true } },
};

const paradaDetailInclude = {
  ...paradaListInclude,
  finalizadoPor: { select: { id: true, nome: true, username: true } },
};

@Injectable()
export class ParadaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: {
    softwareId?: string;
    moduloId?: string;
    filialId?: string;
    tipo?: string;
    impacto?: string;
    status?: string;
    dataInicio?: string;
    dataFim?: string;
  }) {
    const where: Record<string, unknown> = {};

    if (filters.softwareId) where.softwareId = filters.softwareId;
    if (filters.moduloId) where.softwareModuloId = filters.moduloId;
    if (filters.tipo) where.tipo = filters.tipo;
    if (filters.impacto) where.impacto = filters.impacto;
    if (filters.status) where.status = filters.status;

    if (filters.filialId) {
      where.filiaisAfetadas = { some: { filialId: filters.filialId } };
    }

    if (filters.dataInicio || filters.dataFim) {
      const inicio: Record<string, Date> = {};
      if (filters.dataInicio) inicio.gte = new Date(filters.dataInicio);
      if (filters.dataFim) inicio.lte = new Date(filters.dataFim);
      where.inicio = inicio;
    }

    return this.prisma.registroParada.findMany({
      where,
      include: paradaListInclude,
      orderBy: { inicio: 'desc' },
    });
  }

  async findOne(id: string) {
    const parada = await this.prisma.registroParada.findUnique({
      where: { id },
      include: paradaDetailInclude,
    });
    if (!parada) throw new NotFoundException('Parada nao encontrada');
    return parada;
  }

  async create(dto: CreateParadaDto, userId: string) {
    const software = await this.prisma.software.findUnique({ where: { id: dto.softwareId } });
    if (!software) throw new NotFoundException('Software nao encontrado');

    if (dto.softwareModuloId) {
      const modulo = await this.prisma.softwareModulo.findFirst({
        where: { id: dto.softwareModuloId, softwareId: dto.softwareId },
      });
      if (!modulo) throw new BadRequestException('Modulo nao pertence ao software informado');
    }

    if (dto.chamadoId) {
      const chamado = await this.prisma.chamado.findUnique({ where: { id: dto.chamadoId } });
      if (!chamado) throw new NotFoundException('Chamado nao encontrado');
    }

    const inicio = new Date(dto.inicio);
    let status: 'EM_ANDAMENTO' | 'FINALIZADA' = 'EM_ANDAMENTO';
    let fim: Date | undefined;
    let duracaoMinutos: number | undefined;

    if (dto.fim) {
      fim = new Date(dto.fim);
      if (fim <= inicio) throw new BadRequestException('Data fim deve ser posterior ao inicio');
      duracaoMinutos = Math.round((fim.getTime() - inicio.getTime()) / 60000);
      status = 'FINALIZADA';
    }

    return this.prisma.registroParada.create({
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        tipo: dto.tipo,
        impacto: dto.impacto,
        status,
        inicio,
        fim,
        duracaoMinutos,
        observacoes: dto.observacoes,
        softwareId: dto.softwareId,
        softwareModuloId: dto.softwareModuloId,
        chamadoId: dto.chamadoId,
        registradoPorId: userId,
        finalizadoPorId: status === 'FINALIZADA' ? userId : undefined,
        filiaisAfetadas: {
          create: dto.filialIds.map((filialId) => ({ filialId })),
        },
      },
      include: paradaDetailInclude,
    });
  }

  async update(id: string, dto: UpdateParadaDto) {
    const parada = await this.prisma.registroParada.findUnique({ where: { id } });
    if (!parada) throw new NotFoundException('Parada nao encontrada');
    if (parada.status !== 'EM_ANDAMENTO') {
      throw new BadRequestException('So e possivel editar paradas em andamento');
    }

    if (dto.softwareId) {
      const software = await this.prisma.software.findUnique({ where: { id: dto.softwareId } });
      if (!software) throw new NotFoundException('Software nao encontrado');
    }

    if (dto.softwareModuloId) {
      const swId = dto.softwareId || parada.softwareId;
      const modulo = await this.prisma.softwareModulo.findFirst({
        where: { id: dto.softwareModuloId, softwareId: swId },
      });
      if (!modulo) throw new BadRequestException('Modulo nao pertence ao software informado');
    }

    const { filialIds, ...data } = dto;
    const updateData: Record<string, unknown> = { ...data };
    if (data.inicio) updateData.inicio = new Date(data.inicio);

    if (filialIds) {
      return this.prisma.$transaction(async (tx) => {
        await tx.paradaFilialAfetada.deleteMany({ where: { paradaId: id } });
        return tx.registroParada.update({
          where: { id },
          data: {
            ...updateData,
            filiaisAfetadas: {
              create: filialIds.map((filialId) => ({ filialId })),
            },
          },
          include: paradaDetailInclude,
        });
      });
    }

    return this.prisma.registroParada.update({
      where: { id },
      data: updateData,
      include: paradaDetailInclude,
    });
  }

  async finalizar(id: string, dto: FinalizarParadaDto, userId: string) {
    const parada = await this.prisma.registroParada.findUnique({ where: { id } });
    if (!parada) throw new NotFoundException('Parada nao encontrada');
    if (parada.status !== 'EM_ANDAMENTO') {
      throw new BadRequestException('So e possivel finalizar paradas em andamento');
    }

    const fim = dto.fim ? new Date(dto.fim) : new Date();
    if (fim <= parada.inicio) {
      throw new BadRequestException('Data fim deve ser posterior ao inicio');
    }

    const duracaoMinutos = Math.round((fim.getTime() - parada.inicio.getTime()) / 60000);

    return this.prisma.registroParada.update({
      where: { id },
      data: {
        status: 'FINALIZADA',
        fim,
        duracaoMinutos,
        finalizadoPorId: userId,
        observacoes: dto.observacoes ?? parada.observacoes,
      },
      include: paradaDetailInclude,
    });
  }

  async cancelar(id: string) {
    const parada = await this.prisma.registroParada.findUnique({ where: { id } });
    if (!parada) throw new NotFoundException('Parada nao encontrada');
    if (parada.status !== 'EM_ANDAMENTO') {
      throw new BadRequestException('So e possivel cancelar paradas em andamento');
    }

    return this.prisma.registroParada.update({
      where: { id },
      data: { status: 'CANCELADA' },
      include: paradaDetailInclude,
    });
  }
}
