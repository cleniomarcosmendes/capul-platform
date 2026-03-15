import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTipoDepartamentoDto, UpdateTipoDepartamentoDto } from './dto/tipo-departamento.dto';

@Injectable()
export class TipoDepartamentoService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.tipoDepartamento.findMany({
      orderBy: { ordem: 'asc' },
      include: { _count: { select: { departamentos: true } } },
    });
  }

  async create(dto: CreateTipoDepartamentoDto) {
    return this.prisma.tipoDepartamento.create({ data: dto });
  }

  async update(id: string, dto: UpdateTipoDepartamentoDto) {
    const tipo = await this.prisma.tipoDepartamento.findUnique({ where: { id } });
    if (!tipo) throw new NotFoundException('Tipo de departamento nao encontrado');
    return this.prisma.tipoDepartamento.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const tipo = await this.prisma.tipoDepartamento.findUnique({
      where: { id },
      include: { _count: { select: { departamentos: true } } },
    });
    if (!tipo) throw new NotFoundException('Tipo de departamento nao encontrado');
    if (tipo._count.departamentos > 0) {
      throw new BadRequestException(
        `Nao e possivel excluir tipo com ${tipo._count.departamentos} departamento(s) vinculado(s)`,
      );
    }
    await this.prisma.tipoDepartamento.delete({ where: { id } });
    return { deleted: true };
  }
}
