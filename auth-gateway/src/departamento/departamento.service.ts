import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartamentoDto, UpdateDepartamentoDto } from './dto/create-departamento.dto';

const tipoDepartamentoSelect = { id: true, nome: true, descricao: true, ordem: true };

@Injectable()
export class DepartamentoService {
  constructor(private prisma: PrismaService) {}

  async findAll(opts?: {
    filialId?: string;
    workspaceOnly?: boolean;
    funcionalidade?: string;
  }) {
    const filialId = opts?.filialId;
    const workspaceOnly = opts?.workspaceOnly ?? false;
    const funcionalidade = opts?.funcionalidade;

    // Workspace Onda 2 C2.8 — escopo workspace é ortogonal ao filtro de
    // filial. Filtro por funcionalidade exige `workspaceOnly` implícito.
    const where: Record<string, unknown> = {};
    if (filialId) where.filialId = filialId;

    if (workspaceOnly || funcionalidade) {
      where.funcionalidades = {
        some: {
          ativo: true,
          ...(funcionalidade ? { funcionalidade: funcionalidade as never } : {}),
        },
      };
    }

    return this.prisma.departamento.findMany({
      where,
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

  async remove(id: string) {
    const depto = await this.prisma.departamento.findUnique({ where: { id } });
    if (!depto) throw new NotFoundException('Departamento nao encontrado');

    // Verificar se tem usuarios vinculados
    const usuarios = await this.prisma.usuario.count({ where: { departamentoId: id } });
    if (usuarios > 0) {
      throw new BadRequestException(`Departamento possui ${usuarios} usuario(s) vinculado(s). Remova os vinculos antes de excluir.`);
    }

    await this.prisma.departamento.delete({ where: { id } });
    return { success: true, message: 'Departamento excluido com sucesso' };
  }
}
