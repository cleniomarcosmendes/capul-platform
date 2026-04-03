import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateTipoProdutoDto, UpdateTipoProdutoDto } from '../dto/create-tipo-produto.dto.js';
import { CreateTipoProjetoDto, UpdateTipoProjetoDto } from '../dto/create-tipo-projeto.dto.js';

@Injectable()
export class CompraConfigService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Tipos de Produto ---

  async findAllTiposProduto(status?: string) {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    return this.prisma.tipoProduto.findMany({
      where,
      orderBy: { descricao: 'asc' },
    });
  }

  async createTipoProduto(dto: CreateTipoProdutoDto) {
    const existing = await this.prisma.tipoProduto.findUnique({
      where: { codigo: dto.codigo },
    });
    if (existing) {
      throw new BadRequestException(`Tipo de produto com codigo "${dto.codigo}" ja existe`);
    }
    return this.prisma.tipoProduto.create({
      data: {
        codigo: dto.codigo,
        descricao: dto.descricao,
      },
    });
  }

  async updateTipoProduto(id: string, dto: UpdateTipoProdutoDto) {
    const existing = await this.prisma.tipoProduto.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Tipo de produto nao encontrado');

    const data: Record<string, unknown> = {};
    if (dto.codigo !== undefined) data.codigo = dto.codigo;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.tipoProduto.update({
      where: { id },
      data,
    });
  }

  async removeTipoProduto(id: string) {
    const existing = await this.prisma.tipoProduto.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Tipo de produto nao encontrado');
    const vinculos = await this.prisma.produtoConfig.count({ where: { tipoProdutoId: id } });
    if (vinculos > 0) throw new BadRequestException(`Tipo possui ${vinculos} produto(s) vinculado(s). Inative-o em vez de excluir.`);
    await this.prisma.tipoProduto.delete({ where: { id } });
    return { success: true };
  }

  // --- Tipos de Projeto ---

  async findAllTiposProjeto(status?: string) {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    return this.prisma.tipoProjetoConfig.findMany({
      where,
      orderBy: { descricao: 'asc' },
    });
  }

  async createTipoProjeto(dto: CreateTipoProjetoDto) {
    const existing = await this.prisma.tipoProjetoConfig.findUnique({
      where: { codigo: dto.codigo },
    });
    if (existing) {
      throw new BadRequestException(`Tipo de projeto com codigo "${dto.codigo}" ja existe`);
    }
    return this.prisma.tipoProjetoConfig.create({
      data: {
        codigo: dto.codigo,
        descricao: dto.descricao,
      },
    });
  }

  async updateTipoProjeto(id: string, dto: UpdateTipoProjetoDto) {
    const existing = await this.prisma.tipoProjetoConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Tipo de projeto nao encontrado');

    const data: Record<string, unknown> = {};
    if (dto.codigo !== undefined) data.codigo = dto.codigo;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.tipoProjetoConfig.update({
      where: { id },
      data,
    });
  }

  async removeTipoProjeto(id: string) {
    const existing = await this.prisma.tipoProjetoConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Tipo de projeto nao encontrado');
    const vinculos = await this.prisma.projeto.count({ where: { tipoProjetoId: id } });
    if (vinculos > 0) throw new BadRequestException(`Tipo possui ${vinculos} projeto(s) vinculado(s). Inative-o em vez de excluir.`);
    await this.prisma.tipoProjetoConfig.delete({ where: { id } });
    return { success: true };
  }
}
