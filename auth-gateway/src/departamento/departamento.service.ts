import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartamentoDto, UpdateDepartamentoDto } from './dto/create-departamento.dto';

const tipoDepartamentoSelect = { id: true, nome: true, descricao: true, ordem: true };

@Injectable()
export class DepartamentoService {
  constructor(private prisma: PrismaService) {}

  async findAll(filialId?: string) {
    return this.prisma.departamento.findMany({
      where: filialId ? { filialId } : {},
      include: {
        filial: { select: { id: true, codigo: true, nomeFantasia: true } },
        tipoDepartamento: { select: tipoDepartamentoSelect },
      },
      orderBy: [{ tipoDepartamento: { ordem: 'asc' } }, { nome: 'asc' }],
    });
  }

  async create(dto: CreateDepartamentoDto) {
    return this.prisma.departamento.create({
      data: {
        codigo: dto.codigo,
        nome: dto.nome,
        descricao: dto.descricao,
        filialId: dto.filialId,
        tipoDepartamentoId: dto.tipoDepartamentoId,
      },
      include: {
        filial: { select: { id: true, codigo: true, nomeFantasia: true } },
        tipoDepartamento: { select: tipoDepartamentoSelect },
      },
    });
  }

  async update(id: string, dto: UpdateDepartamentoDto) {
    const depto = await this.prisma.departamento.findUnique({ where: { id } });
    if (!depto) throw new NotFoundException('Departamento nao encontrado');
    return this.prisma.departamento.update({
      where: { id },
      data: {
        ...(dto.codigo !== undefined && { codigo: dto.codigo }),
        ...(dto.nome !== undefined && { nome: dto.nome }),
        ...(dto.descricao !== undefined && { descricao: dto.descricao }),
        ...(dto.tipoDepartamentoId !== undefined && { tipoDepartamentoId: dto.tipoDepartamentoId }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: {
        tipoDepartamento: { select: tipoDepartamentoSelect },
      },
    });
  }
}
