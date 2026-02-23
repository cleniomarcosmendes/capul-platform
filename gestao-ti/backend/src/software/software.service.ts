import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSoftwareDto } from './dto/create-software.dto.js';
import { UpdateSoftwareDto } from './dto/update-software.dto.js';
import { CreateModuloDto } from './dto/create-modulo.dto.js';
import { UpdateModuloDto } from './dto/update-modulo.dto.js';
import { TipoSoftware, Criticidade, StatusSoftware, StatusModulo } from '@prisma/client';

const softwareListInclude = {
  equipeResponsavel: { select: { id: true, nome: true, sigla: true, cor: true } },
  _count: { select: { modulos: true, licencas: true, chamados: true } },
};

const softwareDetailInclude = {
  equipeResponsavel: { select: { id: true, nome: true, sigla: true, cor: true } },
  modulos: {
    orderBy: { nome: 'asc' as const },
    include: {
      filiais: { include: { filial: { select: { id: true, codigo: true, nomeFantasia: true } } } },
    },
  },
  filiais: {
    include: { filial: { select: { id: true, codigo: true, nomeFantasia: true } } },
  },
  licencas: {
    where: { status: 'ATIVA' as const },
    orderBy: { dataVencimento: 'asc' as const },
  },
  _count: { select: { modulos: true, licencas: true, chamados: true } },
};

@Injectable()
export class SoftwareService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Software CRUD ────────────────────────────────────────

  async findAll(filters: {
    tipo?: TipoSoftware;
    criticidade?: Criticidade;
    status?: StatusSoftware;
    equipeId?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.tipo) where.tipo = filters.tipo;
    if (filters.criticidade) where.criticidade = filters.criticidade;
    if (filters.status) where.status = filters.status;
    if (filters.equipeId) where.equipeResponsavelId = filters.equipeId;

    return this.prisma.software.findMany({
      where,
      include: softwareListInclude,
      orderBy: { nome: 'asc' },
    });
  }

  async findOne(id: string) {
    const software = await this.prisma.software.findUnique({
      where: { id },
      include: softwareDetailInclude,
    });
    if (!software) throw new NotFoundException('Software nao encontrado');
    return software;
  }

  async create(dto: CreateSoftwareDto) {
    const existing = await this.prisma.software.findUnique({ where: { nome: dto.nome } });
    if (existing) throw new ConflictException('Ja existe um software com este nome');

    return this.prisma.software.create({
      data: dto,
      include: softwareListInclude,
    });
  }

  async update(id: string, dto: UpdateSoftwareDto) {
    await this.getSoftwareOrFail(id);
    if (dto.nome) {
      const existing = await this.prisma.software.findFirst({ where: { nome: dto.nome, NOT: { id } } });
      if (existing) throw new ConflictException('Ja existe um software com este nome');
    }
    return this.prisma.software.update({
      where: { id },
      data: dto,
      include: softwareListInclude,
    });
  }

  async updateStatus(id: string, status: StatusSoftware) {
    await this.getSoftwareOrFail(id);
    return this.prisma.software.update({ where: { id }, data: { status } });
  }

  // ─── Software ↔ Filial ────────────────────────────────────

  async addFilial(softwareId: string, filialId: string) {
    await this.getSoftwareOrFail(softwareId);
    const filial = await this.prisma.filial.findUnique({ where: { id: filialId } });
    if (!filial) throw new BadRequestException('Filial nao encontrada');

    try {
      return await this.prisma.softwareFilial.create({
        data: { softwareId, filialId },
        include: { filial: { select: { id: true, codigo: true, nomeFantasia: true } } },
      });
    } catch {
      throw new ConflictException('Filial ja vinculada a este software');
    }
  }

  async removeFilial(softwareId: string, filialId: string) {
    const link = await this.prisma.softwareFilial.findUnique({
      where: { softwareId_filialId: { softwareId, filialId } },
    });
    if (!link) throw new NotFoundException('Vinculo nao encontrado');
    return this.prisma.softwareFilial.delete({ where: { id: link.id } });
  }

  // ─── Módulos ──────────────────────────────────────────────

  async findModulos(softwareId: string) {
    await this.getSoftwareOrFail(softwareId);
    return this.prisma.softwareModulo.findMany({
      where: { softwareId },
      include: {
        filiais: { include: { filial: { select: { id: true, codigo: true, nomeFantasia: true } } } },
        _count: { select: { chamados: true } },
      },
      orderBy: { nome: 'asc' },
    });
  }

  async createModulo(softwareId: string, dto: CreateModuloDto) {
    await this.getSoftwareOrFail(softwareId);
    const existing = await this.prisma.softwareModulo.findUnique({
      where: { softwareId_nome: { softwareId, nome: dto.nome } },
    });
    if (existing) throw new ConflictException('Ja existe um modulo com este nome neste software');

    return this.prisma.softwareModulo.create({
      data: { ...dto, softwareId },
    });
  }

  async updateModulo(softwareId: string, moduloId: string, dto: UpdateModuloDto) {
    const modulo = await this.getModuloOrFail(softwareId, moduloId);
    if (dto.nome && dto.nome !== modulo.nome) {
      const existing = await this.prisma.softwareModulo.findUnique({
        where: { softwareId_nome: { softwareId, nome: dto.nome } },
      });
      if (existing) throw new ConflictException('Ja existe um modulo com este nome neste software');
    }
    return this.prisma.softwareModulo.update({ where: { id: moduloId }, data: dto });
  }

  async updateModuloStatus(softwareId: string, moduloId: string, status: StatusModulo) {
    await this.getModuloOrFail(softwareId, moduloId);
    return this.prisma.softwareModulo.update({ where: { id: moduloId }, data: { status } });
  }

  // ─── Módulo ↔ Filial ─────────────────────────────────────

  async addModuloFilial(softwareId: string, moduloId: string, filialId: string) {
    await this.getModuloOrFail(softwareId, moduloId);
    const filial = await this.prisma.filial.findUnique({ where: { id: filialId } });
    if (!filial) throw new BadRequestException('Filial nao encontrada');

    try {
      return await this.prisma.moduloFilial.create({
        data: { moduloId, filialId },
        include: { filial: { select: { id: true, codigo: true, nomeFantasia: true } } },
      });
    } catch {
      throw new ConflictException('Filial ja vinculada a este modulo');
    }
  }

  async removeModuloFilial(softwareId: string, moduloId: string, filialId: string) {
    await this.getModuloOrFail(softwareId, moduloId);
    const link = await this.prisma.moduloFilial.findUnique({
      where: { moduloId_filialId: { moduloId, filialId } },
    });
    if (!link) throw new NotFoundException('Vinculo nao encontrado');
    return this.prisma.moduloFilial.delete({ where: { id: link.id } });
  }

  // ─── Helpers ──────────────────────────────────────────────

  private async getSoftwareOrFail(id: string) {
    const software = await this.prisma.software.findUnique({ where: { id } });
    if (!software) throw new NotFoundException('Software nao encontrado');
    return software;
  }

  private async getModuloOrFail(softwareId: string, moduloId: string) {
    const modulo = await this.prisma.softwareModulo.findFirst({
      where: { id: moduloId, softwareId },
    });
    if (!modulo) throw new NotFoundException('Modulo nao encontrado');
    return modulo;
  }
}
