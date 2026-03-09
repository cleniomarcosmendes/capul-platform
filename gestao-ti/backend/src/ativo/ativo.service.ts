import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAtivoDto } from './dto/create-ativo.dto.js';
import { UpdateAtivoDto } from './dto/update-ativo.dto.js';
import { AddAtivoSoftwareDto } from './dto/add-ativo-software.dto.js';
import { StatusAtivo } from '@prisma/client';

const ativoListInclude = {
  filial: { select: { id: true, codigo: true, nomeFantasia: true } },
  responsavel: { select: { id: true, nome: true, username: true } },
  departamento: { select: { id: true, nome: true } },
  ativoPai: { select: { id: true, tag: true, nome: true, tipo: true } },
  _count: { select: { softwares: true, componentes: true, chamados: true } },
};

const ativoDetailInclude = {
  ...ativoListInclude,
  softwares: {
    include: {
      software: { select: { id: true, nome: true, tipo: true, versaoAtual: true } },
    },
    orderBy: { createdAt: 'desc' as const },
  },
  componentes: {
    select: {
      id: true, tag: true, nome: true, tipo: true, status: true,
      fabricante: true, modelo: true, ip: true, hostname: true,
    },
    orderBy: { tag: 'asc' as const },
  },
};

@Injectable()
export class AtivoService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: {
    tipo?: string;
    status?: string;
    filialId?: string;
    search?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.tipo) where.tipo = filters.tipo;
    if (filters.status) where.status = filters.status;
    if (filters.filialId) where.filialId = filters.filialId;
    if (filters.search) {
      where.OR = [
        { tag: { contains: filters.search, mode: 'insensitive' } },
        { nome: { contains: filters.search, mode: 'insensitive' } },
        { hostname: { contains: filters.search, mode: 'insensitive' } },
        { ip: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.ativo.findMany({
      where,
      include: ativoListInclude,
      orderBy: { tag: 'asc' },
    });
  }

  async findOne(id: string) {
    const ativo = await this.prisma.ativo.findUnique({
      where: { id },
      include: ativoDetailInclude,
    });
    if (!ativo) throw new NotFoundException('Ativo nao encontrado');
    return ativo;
  }

  async create(dto: CreateAtivoDto) {
    const exists = await this.prisma.ativo.findUnique({ where: { tag: dto.tag } });
    if (exists) throw new BadRequestException('Tag ja existe');

    return this.prisma.ativo.create({
      data: {
        tag: dto.tag,
        nome: dto.nome,
        descricao: dto.descricao,
        tipo: dto.tipo,
        fabricante: dto.fabricante,
        modelo: dto.modelo,
        numeroSerie: dto.numeroSerie,
        filialId: dto.filialId,
        responsavelId: dto.responsavelId,
        departamentoId: dto.departamentoId,
        dataAquisicao: dto.dataAquisicao ? new Date(dto.dataAquisicao) : undefined,
        dataGarantia: dto.dataGarantia ? new Date(dto.dataGarantia) : undefined,
        processador: dto.processador,
        memoriaGB: dto.memoriaGB,
        discoGB: dto.discoGB,
        sistemaOperacional: dto.sistemaOperacional,
        ip: dto.ip,
        hostname: dto.hostname,
        observacoes: dto.observacoes,
        glpiId: dto.glpiId,
        ativoPaiId: dto.ativoPaiId,
      },
      include: ativoListInclude,
    });
  }

  async update(id: string, dto: UpdateAtivoDto) {
    await this.getOrFail(id);

    if (dto.tag) {
      const exists = await this.prisma.ativo.findFirst({
        where: { tag: dto.tag, id: { not: id } },
      });
      if (exists) throw new BadRequestException('Tag ja existe');
    }

    const data: Record<string, unknown> = { ...dto };
    if (dto.dataAquisicao) data.dataAquisicao = new Date(dto.dataAquisicao);
    if (dto.dataGarantia) data.dataGarantia = new Date(dto.dataGarantia);

    return this.prisma.ativo.update({
      where: { id },
      data,
      include: ativoListInclude,
    });
  }

  async updateStatus(id: string, status: StatusAtivo) {
    await this.getOrFail(id);
    return this.prisma.ativo.update({
      where: { id },
      data: { status },
      include: ativoListInclude,
    });
  }

  async delete(id: string) {
    await this.getOrFail(id);
    await this.prisma.ativo.delete({ where: { id } });
  }

  // --- Softwares instalados ---

  async listSoftwares(ativoId: string) {
    await this.getOrFail(ativoId);
    return this.prisma.ativoSoftware.findMany({
      where: { ativoId },
      include: {
        software: { select: { id: true, nome: true, tipo: true, versaoAtual: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addSoftware(ativoId: string, dto: AddAtivoSoftwareDto) {
    await this.getOrFail(ativoId);

    const sw = await this.prisma.software.findUnique({ where: { id: dto.softwareId } });
    if (!sw) throw new BadRequestException('Software nao encontrado');

    try {
      return await this.prisma.ativoSoftware.create({
        data: {
          ativoId,
          softwareId: dto.softwareId,
          versaoInstalada: dto.versaoInstalada,
          dataInstalacao: dto.dataInstalacao ? new Date(dto.dataInstalacao) : undefined,
          observacoes: dto.observacoes,
        },
        include: {
          software: { select: { id: true, nome: true, tipo: true, versaoAtual: true } },
        },
      });
    } catch {
      throw new BadRequestException('Software ja vinculado a este ativo');
    }
  }

  async removeSoftware(ativoId: string, softwareId: string) {
    const item = await this.prisma.ativoSoftware.findUnique({
      where: { ativoId_softwareId: { ativoId, softwareId } },
    });
    if (!item) throw new NotFoundException('Vinculo nao encontrado');
    await this.prisma.ativoSoftware.delete({
      where: { ativoId_softwareId: { ativoId, softwareId } },
    });
  }

  private async getOrFail(id: string) {
    const ativo = await this.prisma.ativo.findUnique({ where: { id } });
    if (!ativo) throw new NotFoundException('Ativo nao encontrado');
    return ativo;
  }
}
