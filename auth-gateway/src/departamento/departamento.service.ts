import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartamentoDto, UpdateDepartamentoDto } from './dto/create-departamento.dto';

@Injectable()
export class DepartamentoService {
  constructor(private prisma: PrismaService) {}

  async findAll(filialId?: string) {
    return this.prisma.departamento.findMany({
      where: filialId ? { filialId } : {},
      include: { filial: { select: { id: true, codigo: true, nomeFantasia: true } } },
      orderBy: { nome: 'asc' },
    });
  }

  async create(dto: CreateDepartamentoDto) {
    return this.prisma.departamento.create({
      data: dto,
      include: { filial: { select: { id: true, codigo: true, nomeFantasia: true } } },
    });
  }

  async update(id: string, dto: UpdateDepartamentoDto) {
    const depto = await this.prisma.departamento.findUnique({ where: { id } });
    if (!depto) throw new NotFoundException('Departamento nao encontrado');
    return this.prisma.departamento.update({ where: { id }, data: dto });
  }
}
