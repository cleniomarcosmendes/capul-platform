import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateCotacaoDto } from '../dto/create-cotacao.dto.js';
import { CreateCustoDto } from '../dto/create-custo.dto.js';
import { ProjetoHelpersService } from './projeto-helpers.service.js';

@Injectable()
export class ProjetoFinanceiroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly helpers: ProjetoHelpersService,
  ) {}

  // --- Cotacoes ---

  async listCotacoes(projetoId: string) {
    await this.helpers.ensureProjetoExists(projetoId);
    return this.prisma.cotacaoProjeto.findMany({
      where: { projetoId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addCotacao(projetoId: string, dto: CreateCotacaoDto) {
    await this.helpers.ensureProjetoExists(projetoId);
    return this.prisma.cotacaoProjeto.create({
      data: {
        fornecedor: dto.fornecedor,
        descricao: dto.descricao,
        valor: dto.valor,
        moeda: dto.moeda || 'BRL',
        dataRecebimento: dto.dataRecebimento ? new Date(dto.dataRecebimento) : undefined,
        validade: dto.validade ? new Date(dto.validade) : undefined,
        status: dto.status || 'RASCUNHO',
        observacoes: dto.observacoes,
        projetoId,
      },
    });
  }

  async updateCotacao(projetoId: string, cotacaoId: string, dto: CreateCotacaoDto) {
    const cotacao = await this.prisma.cotacaoProjeto.findFirst({
      where: { id: cotacaoId, projetoId },
    });
    if (!cotacao) throw new NotFoundException('Cotacao nao encontrada neste projeto');

    const data: Record<string, unknown> = {};
    if (dto.fornecedor !== undefined) data.fornecedor = dto.fornecedor;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.valor !== undefined) data.valor = dto.valor;
    if (dto.moeda !== undefined) data.moeda = dto.moeda;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.dataRecebimento !== undefined) data.dataRecebimento = new Date(dto.dataRecebimento);
    if (dto.validade !== undefined) data.validade = new Date(dto.validade);
    if (dto.observacoes !== undefined) data.observacoes = dto.observacoes;

    return this.prisma.cotacaoProjeto.update({ where: { id: cotacaoId }, data });
  }

  async removeCotacao(projetoId: string, cotacaoId: string) {
    const cotacao = await this.prisma.cotacaoProjeto.findFirst({
      where: { id: cotacaoId, projetoId },
    });
    if (!cotacao) throw new NotFoundException('Cotacao nao encontrada neste projeto');
    await this.prisma.cotacaoProjeto.delete({ where: { id: cotacaoId } });
    return { deleted: true };
  }

  // --- Custos Detalhados ---

  async listCustosDetalhados(projetoId: string) {
    await this.helpers.ensureProjetoExists(projetoId);
    return this.prisma.custoProjeto.findMany({
      where: { projetoId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addCusto(projetoId: string, dto: CreateCustoDto) {
    await this.helpers.ensureProjetoExists(projetoId);
    return this.prisma.custoProjeto.create({
      data: {
        descricao: dto.descricao,
        categoria: dto.categoria,
        valorPrevisto: dto.valorPrevisto,
        valorRealizado: dto.valorRealizado,
        data: dto.data ? new Date(dto.data) : undefined,
        observacoes: dto.observacoes,
        projetoId,
      },
    });
  }

  async updateCusto(projetoId: string, custoId: string, dto: CreateCustoDto) {
    const custo = await this.prisma.custoProjeto.findFirst({
      where: { id: custoId, projetoId },
    });
    if (!custo) throw new NotFoundException('Custo nao encontrado neste projeto');

    const data: Record<string, unknown> = {};
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.categoria !== undefined) data.categoria = dto.categoria;
    if (dto.valorPrevisto !== undefined) data.valorPrevisto = dto.valorPrevisto;
    if (dto.valorRealizado !== undefined) data.valorRealizado = dto.valorRealizado;
    if (dto.data !== undefined) data.data = new Date(dto.data);
    if (dto.observacoes !== undefined) data.observacoes = dto.observacoes;

    return this.prisma.custoProjeto.update({ where: { id: custoId }, data });
  }

  async removeCusto(projetoId: string, custoId: string) {
    const custo = await this.prisma.custoProjeto.findFirst({
      where: { id: custoId, projetoId },
    });
    if (!custo) throw new NotFoundException('Custo nao encontrado neste projeto');
    await this.prisma.custoProjeto.delete({ where: { id: custoId } });
    return { deleted: true };
  }

  // --- Custos Consolidados ---

  async getCustosConsolidados(id: string) {
    const projeto = await this.prisma.projeto.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        nivel: true,
        custoPrevisto: true,
        custoRealizado: true,
      },
    });
    if (!projeto) throw new NotFoundException('Projeto nao encontrado');

    const [custosDetalhados, totalHoras, subProjetos, nfAggregate, parcelaRateioAggregate] = await Promise.all([
      this.prisma.custoProjeto.aggregate({
        where: { projetoId: id },
        _sum: { valorPrevisto: true, valorRealizado: true },
        _count: true,
      }),
      this.prisma.apontamentoHoras.aggregate({
        where: { projetoId: id },
        _sum: { horas: true },
        _count: true,
      }),
      this.helpers.getSubProjetosRecursivo(id),
      // Soma dos itens de NF vinculados a este projeto
      this.prisma.notaFiscalItem.aggregate({
        where: {
          projetoId: id,
          notaFiscal: { status: { not: 'CANCELADA' } },
        },
        _sum: { valorTotal: true },
        _count: true,
      }),
      // Soma dos rateios de parcela vinculados a este projeto (apenas parcelas pagas)
      this.prisma.parcelaRateioProjeto.aggregate({
        where: {
          projetoId: id,
          parcela: { status: 'PAGA' },
        },
        _sum: { valorCalculado: true },
        _count: true,
      }),
    ]);

    let custoPrevistoFilhos = 0;
    let custoRealizadoFilhos = 0;
    for (const sub of subProjetos) {
      custoPrevistoFilhos += Number(sub.custoPrevisto || 0);
      custoRealizadoFilhos += Number(sub.custoRealizado || 0);
    }

    const subIds = subProjetos.map((s) => s.id);
    if (subIds.length > 0) {
      const aggrFilhos = await this.prisma.custoProjeto.aggregate({
        where: { projetoId: { in: subIds } },
        _sum: { valorPrevisto: true, valorRealizado: true },
      });
      custoPrevistoFilhos += Number(aggrFilhos._sum.valorPrevisto || 0);
      custoRealizadoFilhos += Number(aggrFilhos._sum.valorRealizado || 0);
    }

    const valorNFs = Number(nfAggregate._sum.valorTotal || 0);
    const valorParcelas = Number(parcelaRateioAggregate._sum.valorCalculado || 0);

    const custoPrevistoProprio =
      Number(projeto.custoPrevisto || 0) + Number(custosDetalhados._sum.valorPrevisto || 0);
    const custoRealizadoProprio =
      Number(projeto.custoRealizado || 0) + Number(custosDetalhados._sum.valorRealizado || 0) + valorNFs + valorParcelas;

    return {
      projeto: { id: projeto.id, nome: projeto.nome, nivel: projeto.nivel },
      custoPrevistoProprio,
      custoRealizadoProprio,
      custoPrevistoFilhos,
      custoRealizadoFilhos,
      custoPrevistoTotal: custoPrevistoProprio + custoPrevistoFilhos,
      custoRealizadoTotal: custoRealizadoProprio + custoRealizadoFilhos,
      totalSubProjetos: subProjetos.length,
      custosDetalhados: custosDetalhados._count,
      totalHoras: Number(totalHoras._sum.horas || 0),
      totalApontamentos: totalHoras._count,
      // New financial data
      valorNotasFiscais: valorNFs,
      qtdNotasFiscais: nfAggregate._count,
      valorParcelasContrato: valorParcelas,
      qtdParcelasContrato: parcelaRateioAggregate._count,
    };
  }

  async listarNFsProjeto(projetoId: string) {
    await this.helpers.ensureProjetoExists(projetoId);
    return this.prisma.notaFiscalItem.findMany({
      where: {
        projetoId,
        notaFiscal: { status: { not: 'CANCELADA' } },
      },
      include: {
        notaFiscal: {
          include: { fornecedor: true },
        },
        produto: { include: { tipoProduto: true } },
        departamento: true,
      },
      orderBy: { notaFiscal: { dataLancamento: 'desc' } },
    });
  }

  async listarParcelasRateioProjeto(projetoId: string) {
    await this.helpers.ensureProjetoExists(projetoId);
    return this.prisma.parcelaRateioProjeto.findMany({
      where: { projetoId },
      include: {
        parcela: {
          include: {
            contrato: {
              select: { id: true, numero: true, titulo: true, fornecedor: true, fornecedorId: true },
            },
          },
        },
      },
      orderBy: { parcela: { dataVencimento: 'desc' } },
    });
  }
}
