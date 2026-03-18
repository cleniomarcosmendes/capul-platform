import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCentroCustoDto, UpdateCentroCustoDto } from './dto/create-centro-custo.dto';

@Injectable()
export class CentroCustoService {
  constructor(private prisma: PrismaService) {}

  async findAll(filialId?: string) {
    return this.prisma.centroCusto.findMany({
      where: filialId ? { filialId } : {},
      include: { filial: { select: { id: true, codigo: true, nomeFantasia: true } } },
      orderBy: { codigo: 'asc' },
    });
  }

  async create(dto: CreateCentroCustoDto) {
    return this.prisma.centroCusto.create({
      data: dto,
      include: { filial: { select: { id: true, codigo: true, nomeFantasia: true } } },
    });
  }

  async update(id: string, dto: UpdateCentroCustoDto) {
    const cc = await this.prisma.centroCusto.findUnique({ where: { id } });
    if (!cc) throw new NotFoundException('Centro de custo nao encontrado');
    return this.prisma.centroCusto.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const cc = await this.prisma.centroCusto.findUnique({ where: { id } });
    if (!cc) throw new NotFoundException('Centro de custo nao encontrado');
    try {
      await this.prisma.centroCusto.delete({ where: { id } });
      return { success: true, message: 'Centro de custo excluido com sucesso' };
    } catch {
      throw new NotFoundException('Centro de custo possui vinculos. Inative-o em vez de excluir.');
    }
  }
}
