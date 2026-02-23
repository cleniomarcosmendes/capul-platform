import {
  Injectable, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateArtigoDto } from './dto/create-artigo.dto.js';
import { UpdateArtigoDto } from './dto/update-artigo.dto.js';
import { StatusArtigo } from '@prisma/client';

const artigoListInclude = {
  autor: { select: { id: true, nome: true, username: true } },
  software: { select: { id: true, nome: true } },
  equipeTi: { select: { id: true, nome: true, sigla: true } },
};

@Injectable()
export class ConhecimentoService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: {
    categoria?: string;
    status?: string;
    softwareId?: string;
    equipeTiId?: string;
    search?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.categoria) where.categoria = filters.categoria;
    if (filters.status) where.status = filters.status;
    if (filters.softwareId) where.softwareId = filters.softwareId;
    if (filters.equipeTiId) where.equipeTiId = filters.equipeTiId;
    if (filters.search) {
      where.OR = [
        { titulo: { contains: filters.search, mode: 'insensitive' } },
        { conteudo: { contains: filters.search, mode: 'insensitive' } },
        { tags: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.artigoConhecimento.findMany({
      where,
      include: artigoListInclude,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const artigo = await this.prisma.artigoConhecimento.findUnique({
      where: { id },
      include: artigoListInclude,
    });
    if (!artigo) throw new NotFoundException('Artigo nao encontrado');
    return artigo;
  }

  async create(dto: CreateArtigoDto, autorId: string) {
    return this.prisma.artigoConhecimento.create({
      data: {
        titulo: dto.titulo,
        conteudo: dto.conteudo,
        resumo: dto.resumo,
        categoria: dto.categoria,
        tags: dto.tags,
        softwareId: dto.softwareId,
        equipeTiId: dto.equipeTiId,
        autorId,
      },
      include: artigoListInclude,
    });
  }

  async update(id: string, dto: UpdateArtigoDto) {
    await this.getOrFail(id);
    return this.prisma.artigoConhecimento.update({
      where: { id },
      data: { ...dto },
      include: artigoListInclude,
    });
  }

  async updateStatus(id: string, status: StatusArtigo) {
    const artigo = await this.getOrFail(id);

    const data: Record<string, unknown> = { status };
    if (status === 'PUBLICADO' && !artigo.publicadoEm) {
      data.publicadoEm = new Date();
    }

    return this.prisma.artigoConhecimento.update({
      where: { id },
      data,
      include: artigoListInclude,
    });
  }

  async delete(id: string) {
    await this.getOrFail(id);
    await this.prisma.artigoConhecimento.delete({ where: { id } });
  }

  private async getOrFail(id: string) {
    const artigo = await this.prisma.artigoConhecimento.findUnique({ where: { id } });
    if (!artigo) throw new NotFoundException('Artigo nao encontrado');
    return artigo;
  }
}
