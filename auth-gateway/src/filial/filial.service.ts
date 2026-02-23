import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFilialDto, UpdateFilialDto } from './dto/create-filial.dto';

@Injectable()
export class FilialService {
  constructor(private prisma: PrismaService) {}

  async findAll(empresaId?: string) {
    return this.prisma.filial.findMany({
      where: empresaId ? { empresaId } : undefined,
      include: { empresa: { select: { id: true, nomeFantasia: true } } },
      orderBy: { codigo: 'asc' },
    });
  }

  async findOne(id: string) {
    const filial = await this.prisma.filial.findUnique({
      where: { id },
      include: {
        empresa: true,
        departamentos: { where: { status: 'ATIVO' } },
        centrosCusto: { where: { status: 'ATIVO' } },
      },
    });
    if (!filial) throw new NotFoundException('Filial nao encontrada');
    return filial;
  }

  async create(dto: CreateFilialDto) {
    return this.prisma.filial.create({
      data: dto,
      include: { empresa: { select: { id: true, nomeFantasia: true } } },
    });
  }

  async update(id: string, dto: UpdateFilialDto) {
    await this.findOne(id);
    return this.prisma.filial.update({
      where: { id },
      data: dto,
      include: { empresa: { select: { id: true, nomeFantasia: true } } },
    });
  }
}
