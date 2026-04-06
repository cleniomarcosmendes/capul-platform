import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateNotaFiscalDto, UpdateNotaFiscalDto } from '../dto/create-nota-fiscal.dto.js';

const NF_INCLUDE = {
  fornecedor: true,
  filial: true,
  criadoPor: { select: { id: true, nome: true, username: true } },
  equipe: { select: { id: true, nome: true, sigla: true, cor: true } },
  itens: {
    include: {
      produto: { include: { tipoProduto: true } },
      centroCusto: true,
      projeto: { select: { id: true, numero: true, nome: true } },
    },
    orderBy: { produto: { descricao: 'asc' as const } },
  },
};

@Injectable()
export class CompraNotaFiscalService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifica se o usuario tem permissao para gerenciar compras/NFs de uma equipe.
   * ADMIN e GESTOR_TI sempre tem acesso. Outros precisam ser membro da equipe com podeGerirCompras.
   */
  async ensureNFPermission(equipeId: string | null | undefined, usuarioId: string, role: string) {
    if (role === 'ADMIN' || role === 'GESTOR_TI') return;
    if (!equipeId) {
      throw new ForbiddenException('NF sem equipe associada. Associe uma equipe ou solicite a um ADMIN/GESTOR_TI.');
    }
    const membro = await this.prisma.membroEquipe.findUnique({
      where: { usuarioId_equipeId: { usuarioId, equipeId } },
    });
    if (!membro || membro.status !== 'ATIVO' || !membro.podeGerirCompras) {
      throw new ForbiddenException('Voce nao tem permissao para gerenciar compras desta equipe.');
    }
  }

  /**
   * Retorna equipes onde o usuario pode gerenciar compras.
   */
  async findEquipesParaCompras(usuarioId: string, role: string) {
    if (role === 'ADMIN' || role === 'GESTOR_TI') {
      return this.prisma.equipeTI.findMany({
        where: { status: 'ATIVO' },
        select: { id: true, nome: true, sigla: true, cor: true },
        orderBy: { nome: 'asc' },
      });
    }
    const membros = await this.prisma.membroEquipe.findMany({
      where: { usuarioId, status: 'ATIVO', podeGerirCompras: true },
      include: { equipe: { select: { id: true, nome: true, sigla: true, cor: true, status: true } } },
    });
    return membros
      .filter(m => m.equipe.status === 'ATIVO')
      .map(m => ({ id: m.equipe.id, nome: m.equipe.nome, sigla: m.equipe.sigla, cor: m.equipe.cor }));
  }

  async findAll(filters: {
    fornecedorId?: string;
    status?: string;
    centroCustoId?: string;
    projetoId?: string;
    dataInicio?: string;
    dataFim?: string;
    equipeId?: string;
  }, filialId?: string, usuarioId?: string, role?: string) {
    const where: Record<string, unknown> = {};
    if (filialId) where.filialId = filialId;
    if (filters.fornecedorId) where.fornecedorId = filters.fornecedorId;
    if (filters.status) where.status = filters.status;
    if (filters.equipeId) where.equipeId = filters.equipeId;
    if (filters.dataInicio || filters.dataFim) {
      const dataLancamento: Record<string, unknown> = {};
      if (filters.dataInicio) dataLancamento.gte = new Date(filters.dataInicio);
      if (filters.dataFim) dataLancamento.lte = new Date(filters.dataFim);
      where.dataLancamento = dataLancamento;
    }
    if (filters.centroCustoId) {
      where.itens = { some: { centroCustoId: filters.centroCustoId } };
    }
    if (filters.projetoId) {
      where.itens = { ...((where.itens as Record<string, unknown>) || {}), some: { ...((where.itens as { some?: Record<string, unknown> })?.some || {}), projetoId: filters.projetoId } };
    }

    // Filtro por equipe para nao-admin
    if (usuarioId && role && role !== 'ADMIN' && role !== 'GESTOR_TI') {
      const membrosComPermissao = await this.prisma.membroEquipe.findMany({
        where: { usuarioId, status: 'ATIVO', podeGerirCompras: true },
        select: { equipeId: true },
      });
      const equipeIds = membrosComPermissao.map(m => m.equipeId);
      if (equipeIds.length === 0) {
        return [];
      }
      where.equipeId = { in: equipeIds };
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
        centroCusto: true,
      },
      orderBy: { notaFiscal: { dataLancamento: 'desc' } },
    });
  }

  async create(dto: CreateNotaFiscalDto, userId: string, filialId: string, role: string = 'ADMIN') {
    if (!dto.itens || dto.itens.length === 0) {
      throw new BadRequestException('A nota fiscal deve ter pelo menos um item');
    }

    // Verificar permissao na equipe
    await this.ensureNFPermission(dto.equipeId, userId, role);

    const itensData = dto.itens.map((item) => {
      const valorTotal = Number((item.quantidade * item.valorUnitario).toFixed(2));
      return {
        produtoId: item.produtoId,
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario,
        valorTotal,
        centroCustoId: item.centroCustoId,
        projetoId: item.projetoId || null,
        observacao: item.observacao || null,
      };
    });

    const valorTotalNF = itensData.reduce((sum, i) => sum + i.valorTotal, 0);

    return this.prisma.notaFiscal.create({
      data: {
        numero: dto.numero,
        dataLancamento: new Date(dto.dataLancamento),
        dataVencimento: dto.dataVencimento ? new Date(dto.dataVencimento) : null,
        fornecedorId: dto.fornecedorId,
        filialId,
        criadoPorId: userId,
        equipeId: dto.equipeId || null,
        observacao: dto.observacao || null,
        valorTotal: valorTotalNF,
        itens: {
          create: itensData,
        },
      },
      include: NF_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateNotaFiscalDto, usuarioId: string = '', role: string = 'ADMIN') {
    const existing = await this.prisma.notaFiscal.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Nota fiscal nao encontrada');
    if (existing.status === 'CANCELADA') {
      throw new BadRequestException('Nota fiscal cancelada nao pode ser editada');
    }

    // Verificar permissao na equipe da NF existente
    await this.ensureNFPermission(existing.equipeId, usuarioId, role);

    const data: Record<string, unknown> = {};
    if (dto.numero !== undefined) data.numero = dto.numero;
    if (dto.dataLancamento !== undefined) data.dataLancamento = new Date(dto.dataLancamento);
    if (dto.dataVencimento !== undefined) data.dataVencimento = dto.dataVencimento ? new Date(dto.dataVencimento) : null;
    if (dto.fornecedorId !== undefined) data.fornecedorId = dto.fornecedorId;
    if (dto.observacao !== undefined) data.observacao = dto.observacao;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.equipeId !== undefined) data.equipeId = dto.equipeId || null;

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
          centroCustoId: item.centroCustoId,
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

  async remove(id: string, usuarioId: string = '', role: string = 'ADMIN') {
    const existing = await this.prisma.notaFiscal.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Nota fiscal nao encontrada');
    await this.ensureNFPermission(existing.equipeId, usuarioId, role);
    await this.prisma.notaFiscal.delete({ where: { id } });
    return { success: true };
  }

  async duplicar(id: string, userId: string, filialId: string, role: string = 'ADMIN') {
    const original = await this.prisma.notaFiscal.findUnique({
      where: { id },
      include: { itens: true },
    });
    if (!original) throw new NotFoundException('Nota fiscal nao encontrada');
    await this.ensureNFPermission(original.equipeId, userId, role);

    const itensData = original.itens.map((item) => ({
      produtoId: item.produtoId,
      quantidade: item.quantidade,
      valorUnitario: Number(item.valorUnitario),
      valorTotal: Number(item.valorTotal),
      centroCustoId: item.centroCustoId,
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
        equipeId: original.equipeId,
        observacao: original.observacao,
        valorTotal: Number(original.valorTotal),
        itens: { create: itensData },
      },
      include: NF_INCLUDE,
    });
  }
}
