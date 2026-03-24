import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCatalogoDto } from './dto/create-catalogo.dto.js';
import { UpdateCatalogoDto } from './dto/update-catalogo.dto.js';
import { StatusGeral } from '@prisma/client';

@Injectable()
export class CatalogoServicoService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(equipeId?: string, status?: StatusGeral) {
    return this.prisma.catalogoServico.findMany({
      where: {
        ...(equipeId ? { equipeId } : {}),
        ...(status ? { status } : {}),
      },
      include: { equipe: { select: { id: true, nome: true, sigla: true, cor: true } } },
      orderBy: { ordem: 'asc' },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.catalogoServico.findUnique({
      where: { id },
      include: { equipe: { select: { id: true, nome: true, sigla: true, cor: true } } },
    });
    if (!item) throw new NotFoundException('Servico nao encontrado no catalogo');
    return item;
  }

  async create(dto: CreateCatalogoDto) {
    const existing = await this.prisma.catalogoServico.findUnique({
      where: { equipeId_nome: { equipeId: dto.equipeId, nome: dto.nome } },
    });
    if (existing) throw new ConflictException('Ja existe um servico com este nome nesta equipe');

    return this.prisma.catalogoServico.create({
      data: dto,
      include: { equipe: { select: { id: true, nome: true, sigla: true, cor: true } } },
    });
  }

  async update(id: string, dto: UpdateCatalogoDto) {
    await this.findOne(id);
    return this.prisma.catalogoServico.update({
      where: { id },
      data: dto,
      include: { equipe: { select: { id: true, nome: true, sigla: true, cor: true } } },
    });
  }

  async updateStatus(id: string, status: StatusGeral) {
    await this.findOne(id);
    return this.prisma.catalogoServico.update({ where: { id }, data: { status } });
  }

  async remove(id: string) {
    const existing = await this.prisma.catalogoServico.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Servico nao encontrado no catalogo');
    const vinculos = await this.prisma.chamado.count({ where: { catalogoServicoId: id } });
    if (vinculos > 0) throw new BadRequestException(`Servico possui ${vinculos} chamado(s) vinculado(s). Inative-o em vez de excluir.`);
    await this.prisma.catalogoServico.delete({ where: { id } });
    return { success: true };
  }
}
