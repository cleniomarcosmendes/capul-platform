import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateNaturezaDto, UpdateNaturezaDto } from '../dto/create-natureza.dto.js';
import { CreateTipoContratoDto, UpdateTipoContratoDto } from '../dto/create-tipo-contrato.dto.js';
import { CreateFornecedorDto, UpdateFornecedorDto } from '../dto/create-fornecedor.dto.js';
import { CreateProdutoDto, UpdateProdutoDto } from '../dto/create-produto.dto.js';

@Injectable()
export class ContratoConfigService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Naturezas ---

  async findAllNaturezas(status?: string) {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    return this.prisma.naturezaContrato.findMany({
      where,
      orderBy: { nome: 'asc' },
    });
  }

  async createNatureza(dto: CreateNaturezaDto) {
    return this.prisma.naturezaContrato.create({
      data: {
        codigo: dto.codigo,
        nome: dto.nome,
      },
    });
  }

  async updateNatureza(id: string, dto: UpdateNaturezaDto) {
    const existing = await this.prisma.naturezaContrato.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Natureza nao encontrada');

    const data: Record<string, unknown> = {};
    if (dto.codigo !== undefined) data.codigo = dto.codigo;
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.naturezaContrato.update({
      where: { id },
      data,
    });
  }

  async removeNatureza(id: string) {
    const existing = await this.prisma.naturezaContrato.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Natureza nao encontrada');
    const vinculos = await this.prisma.rateioTemplateItem.count({ where: { naturezaId: id } });
    const vinculosParcela = await this.prisma.parcelaRateioItem.count({ where: { naturezaId: id } });
    const total = vinculos + vinculosParcela;
    if (total > 0) throw new BadRequestException(`Natureza possui ${total} vinculo(s) em rateios. Inative-a em vez de excluir.`);
    await this.prisma.naturezaContrato.delete({ where: { id } });
    return { success: true };
  }

  // --- Tipos de Contrato ---

  async findAllTiposContrato(status?: string) {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    return this.prisma.tipoContratoConfig.findMany({
      where,
      orderBy: { nome: 'asc' },
    });
  }

  async createTipoContrato(dto: CreateTipoContratoDto) {
    return this.prisma.tipoContratoConfig.create({
      data: {
        codigo: dto.codigo,
        nome: dto.nome,
      },
    });
  }

  async updateTipoContrato(id: string, dto: UpdateTipoContratoDto) {
    const existing = await this.prisma.tipoContratoConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Tipo de contrato nao encontrado');

    const data: Record<string, unknown> = {};
    if (dto.codigo !== undefined) data.codigo = dto.codigo;
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.tipoContratoConfig.update({
      where: { id },
      data,
    });
  }

  async removeTipoContrato(id: string) {
    const existing = await this.prisma.tipoContratoConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Tipo de contrato nao encontrado');
    const vinculos = await this.prisma.contrato.count({ where: { tipoContratoId: id } });
    if (vinculos > 0) throw new BadRequestException(`Tipo possui ${vinculos} contrato(s) vinculado(s). Inative-o em vez de excluir.`);
    await this.prisma.tipoContratoConfig.delete({ where: { id } });
    return { success: true };
  }

  // --- Fornecedores ---

  async findAllFornecedores(status?: string) {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    return this.prisma.fornecedorConfig.findMany({
      where,
      orderBy: { nome: 'asc' },
    });
  }

  async createFornecedor(dto: CreateFornecedorDto) {
    const existing = await this.prisma.fornecedorConfig.findUnique({
      where: { codigo_loja: { codigo: dto.codigo, loja: dto.loja || '' } },
    });
    if (existing) {
      throw new ConflictException(`Fornecedor ${dto.codigo} loja ${dto.loja || ''} ja cadastrado`);
    }
    return this.prisma.fornecedorConfig.create({
      data: {
        codigo: dto.codigo,
        loja: dto.loja,
        nome: dto.nome,
      },
    });
  }

  async updateFornecedor(id: string, dto: UpdateFornecedorDto) {
    const existing = await this.prisma.fornecedorConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Fornecedor nao encontrado');

    const data: Record<string, unknown> = {};
    if (dto.codigo !== undefined) data.codigo = dto.codigo;
    if (dto.loja !== undefined) data.loja = dto.loja;
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.fornecedorConfig.update({
      where: { id },
      data,
    });
  }

  async removeFornecedor(id: string) {
    const existing = await this.prisma.fornecedorConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Fornecedor nao encontrado');
    const vinculos = await this.prisma.contrato.count({ where: { fornecedorId: id } });
    const vinculosNF = await this.prisma.notaFiscal.count({ where: { fornecedorId: id } });
    const total = vinculos + vinculosNF;
    if (total > 0) throw new BadRequestException(`Fornecedor possui ${total} vinculo(s). Inative-o em vez de excluir.`);
    await this.prisma.fornecedorConfig.delete({ where: { id } });
    return { success: true };
  }

  // --- Produtos ---

  async findAllProdutos(status?: string) {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    return this.prisma.produtoConfig.findMany({
      where,
      include: { tipoProduto: true },
      orderBy: { descricao: 'asc' },
    });
  }

  async createProduto(dto: CreateProdutoDto) {
    return this.prisma.produtoConfig.create({
      data: {
        codigo: dto.codigo,
        descricao: dto.descricao,
        tipoProdutoId: dto.tipoProdutoId || null,
      },
      include: { tipoProduto: true },
    });
  }

  async updateProduto(id: string, dto: UpdateProdutoDto) {
    const existing = await this.prisma.produtoConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Produto nao encontrado');

    const data: Record<string, unknown> = {};
    if (dto.codigo !== undefined) data.codigo = dto.codigo;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.tipoProdutoId !== undefined) data.tipoProdutoId = dto.tipoProdutoId || null;
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.produtoConfig.update({
      where: { id },
      data,
      include: { tipoProduto: true },
    });
  }

  async removeProduto(id: string) {
    const existing = await this.prisma.produtoConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Produto nao encontrado');
    const vinculos = await this.prisma.contrato.count({ where: { produtoId: id } });
    const vinculosNF = await this.prisma.notaFiscalItem.count({ where: { produtoId: id } });
    const total = vinculos + vinculosNF;
    if (total > 0) throw new BadRequestException(`Produto possui ${total} vinculo(s). Inative-o em vez de excluir.`);
    await this.prisma.produtoConfig.delete({ where: { id } });
    return { success: true };
  }
}
