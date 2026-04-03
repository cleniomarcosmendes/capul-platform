import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateNotaFiscalDto, UpdateNotaFiscalDto } from '../dto/create-nota-fiscal.dto.js';

const NF_INCLUDE = {
  fornecedor: true,
  filial: true,
  criadoPor: { select: { id: true, nome: true, username: true } },
  itens: {
    include: {
      produto: { include: { tipoProduto: true } },
      departamento: true,
      projeto: { select: { id: true, numero: true, nome: true } },
    },
    orderBy: { produto: { descricao: 'asc' as const } },
  },
};

@Injectable()
export class CompraNotaFiscalService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: {
    fornecedorId?: string;
    status?: string;
    departamentoId?: string;
    projetoId?: string;
    dataInicio?: string;
    dataFim?: string;
  }, filialId?: string) {
    const where: Record<string, unknown> = {};
    if (filialId) where.filialId = filialId;
    if (filters.fornecedorId) where.fornecedorId = filters.fornecedorId;
    if (filters.status) where.status = filters.status;
    if (filters.dataInicio || filters.dataFim) {
      const dataLancamento: Record<string, unknown> = {};
      if (filters.dataInicio) dataLancamento.gte = new Date(filters.dataInicio);
      if (filters.dataFim) dataLancamento.lte = new Date(filters.dataFim);
      where.dataLancamento = dataLancamento;
    }
    if (filters.departamentoId) {
      where.itens = { some: { departamentoId: filters.departamentoId } };
    }
    if (filters.projetoId) {
      where.itens = { ...((where.itens as Record<string, unknown>) || {}), some: { ...((where.itens as { some?: Record<string, unknown> })?.some || {}), projetoId: filters.projetoId } };
    }

    return this.prisma.notaFiscal.findMany({
      where,
      include: NF_INCLUDE,
      orderBy: { dataLancamento: 'desc' },
    });
  }

  async findOne(id: string) {
    const nf = await this.prisma.notaFiscal.findUnique({
      where: { id },
      include: NF_INCLUDE,
    });
    if (!nf) throw new NotFoundException('Nota fiscal nao encontrada');
    return nf;
  }

  async findByProjeto(projetoId: string) {
    return this.prisma.notaFiscalItem.findMany({
      where: { projetoId },
      include: {
        notaFiscal: {
          include: {
            fornecedor: true,
          },
        },
        produto: { include: { tipoProduto: true } },
        departamento: true,
      },
      orderBy: { notaFiscal: { dataLancamento: 'desc' } },
    });
  }

  async create(dto: CreateNotaFiscalDto, userId: string, filialId: string) {
    if (!dto.itens || dto.itens.length === 0) {
      throw new BadRequestException('A nota fiscal deve ter pelo menos um item');
    }

    const itensData = dto.itens.map((item) => {
      const valorTotal = Number((item.quantidade * item.valorUnitario).toFixed(2));
      return {
        produtoId: item.produtoId,
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario,
        valorTotal,
        departamentoId: item.departamentoId,
        projetoId: item.projetoId || null,
        observacao: item.observacao || null,
      };
    });

    const valorTotalNF = itensData.reduce((sum, i) => sum + i.valorTotal, 0);

    return this.prisma.notaFiscal.create({
      data: {
        numero: dto.numero,
        dataLancamento: new Date(dto.dataLancamento),
        fornecedorId: dto.fornecedorId,
        filialId,
        criadoPorId: userId,
        observacao: dto.observacao || null,
        valorTotal: valorTotalNF,
        itens: {
          create: itensData,
        },
      },
      include: NF_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateNotaFiscalDto) {
    const existing = await this.prisma.notaFiscal.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Nota fiscal nao encontrada');
    if (existing.status === 'CANCELADA') {
      throw new BadRequestException('Nota fiscal cancelada nao pode ser editada');
    }

    const data: Record<string, unknown> = {};
    if (dto.numero !== undefined) data.numero = dto.numero;
    if (dto.dataLancamento !== undefined) data.dataLancamento = new Date(dto.dataLancamento);
    if (dto.fornecedorId !== undefined) data.fornecedorId = dto.fornecedorId;
    if (dto.observacao !== undefined) data.observacao = dto.observacao;
    if (dto.status !== undefined) data.status = dto.status;

    if (dto.itens !== undefined) {
      if (dto.itens.length === 0) {
        throw new BadRequestException('A nota fiscal deve ter pelo menos um item');
      }

      const itensData = dto.itens.map((item) => {
        const valorTotal = Number((item.quantidade * item.valorUnitario).toFixed(2));
        return {
          notaFiscalId: id,
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          valorUnitario: item.valorUnitario,
          valorTotal,
          departamentoId: item.departamentoId,
          projetoId: item.projetoId || null,
          observacao: item.observacao || null,
        };
      });

      data.valorTotal = itensData.reduce((sum, i) => sum + i.valorTotal, 0);

      // Atomico: delete itens + recria + atualiza NF
      return this.prisma.$transaction(async (tx) => {
        await tx.notaFiscalItem.deleteMany({ where: { notaFiscalId: id } });
        await tx.notaFiscalItem.createMany({ data: itensData });
        return tx.notaFiscal.update({
          where: { id },
          data,
          include: NF_INCLUDE,
        });
      });
    }

    return this.prisma.notaFiscal.update({
      where: { id },
      data,
      include: NF_INCLUDE,
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.notaFiscal.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Nota fiscal nao encontrada');
    await this.prisma.notaFiscal.delete({ where: { id } });
    return { success: true };
  }

  async duplicar(id: string, userId: string, filialId: string) {
    const original = await this.prisma.notaFiscal.findUnique({
      where: { id },
      include: { itens: true },
    });
    if (!original) throw new NotFoundException('Nota fiscal nao encontrada');

    const itensData = original.itens.map((item) => ({
      produtoId: item.produtoId,
      quantidade: item.quantidade,
      valorUnitario: Number(item.valorUnitario),
      valorTotal: Number(item.valorTotal),
      departamentoId: item.departamentoId,
      projetoId: item.projetoId,
      observacao: item.observacao,
    }));

    return this.prisma.notaFiscal.create({
      data: {
        numero: `${original.numero}-COPIA`,
        dataLancamento: new Date(),
        fornecedorId: original.fornecedorId,
        filialId,
        criadoPorId: userId,
        observacao: original.observacao,
        valorTotal: Number(original.valorTotal),
        itens: { create: itensData },
      },
      include: NF_INCLUDE,
    });
  }
}
