import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmpresaDto, UpdateEmpresaDto } from './dto/create-empresa.dto';

@Injectable()
export class EmpresaService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.empresa.findMany({
      include: { filiais: { select: { id: true, codigo: true, nomeFantasia: true, status: true } } },
      orderBy: { nomeFantasia: 'asc' },
    });
  }

  async findOne(id: string) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id },
      include: { filiais: true },
    });
    if (!empresa) throw new NotFoundException('Empresa nao encontrada');
    return empresa;
  }

  async create(dto: CreateEmpresaDto) {
    return this.prisma.empresa.create({ data: dto });
  }

  async update(id: string, dto: UpdateEmpresaDto) {
    await this.findOne(id);
    return this.prisma.empresa.update({ where: { id }, data: dto });
  }
}
