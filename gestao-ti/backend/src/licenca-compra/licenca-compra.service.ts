import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateLicencaCompraDto } from './dto/create-licenca-compra.dto.js';
import { UpdateLicencaCompraDto } from './dto/update-licenca-compra.dto.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { paginate } from '../common/prisma/paginate.helper.js';
import { resolveDepartamento } from '../common/helpers/resolve-departamento.helper.js';
import { resolveDepartamentoLancamento } from '../common/helpers/resolve-departamento-lancamento.helper.js';
import { assertDepartamentoDoUser } from '../common/helpers/departamento-filter.helper.js';

const itemInclude = {
  software: { select: { id: true, nome: true, fabricante: true, tipo: true } },
  categoria: { select: { id: true, codigo: true, nome: true } },
  departamento: { select: { id: true, nome: true } },
  funcionarios: { orderBy: { createdAt: 'asc' as const } },
};

const notaInclude = {
  fornecedor: { select: { id: true, codigo: true, loja: true, nome: true } },
  criadoPor: { select: { id: true, nome: true, username: true } },
  itens: { include: itemInclude, orderBy: { createdAt: 'asc' as const } },
  _count: { select: { itens: true } },
};

@Injectable()
export class LicencaCompraService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: {
    busca?: string;
    fornecedorId?: string;
    semNota?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.fornecedorId) where.fornecedorId = filters.fornecedorId;
    if (typeof filters.semNota === 'boolean') where.semNota = filters.semNota;
    if (filters.busca?.trim()) {
      const termo = filters.busca.trim();
      where.OR = [
        { numero: { contains: termo, mode: 'insensitive' } },
        { chaveNfe: { contains: termo } },
        { fornecedor: { nome: { contains: termo, mode: 'insensitive' } } },
      ];
    }

    return paginate(this.prisma, this.prisma.licencaCompra, {
      where,
      include: {
        fornecedor: { select: { id: true, codigo: true, loja: true, nome: true } },
        // Itens (leve) p/ o grid mostrar QUAIS licenças/softwares e onde alocadas.
        itens: {
          select: {
            id: true, nome: true, modeloLicenca: true, status: true,
            software: { select: { nome: true } },
            departamento: { select: { nome: true } },
          },
        },
        _count: { select: { itens: true } },
      },
      orderBy: { dataLancamento: 'desc' as const },
      page: filters.page,
      pageSize: filters.pageSize,
    });
  }

  async findOne(id: string) {
    const nota = await this.prisma.licencaCompra.findUnique({ where: { id }, include: notaInclude });
    if (!nota) throw new NotFoundException('Nota de licença não encontrada');
    return nota;
  }

  async create(dto: CreateLicencaCompraDto, user: JwtPayload) {
    const semNota = !!dto.semNota;
    const numero = semNota ? 'S/N' : (dto.numero || '').trim();
    if (!semNota && !numero) {
      throw new BadRequestException('Informe o número da NF ou marque "Sem nota fiscal"');
    }
    if (!dto.itens || dto.itens.length === 0) {
      throw new BadRequestException('Adicione ao menos uma licença');
    }
    const chaveNfe = semNota ? null : (dto.chaveNfe || null);

    // Workspace de lançamento (oculto). Gate de escrita nele (OVERSIGHT bypassa).
    const baseDepto = await resolveDepartamento(this.prisma, user, 'WORKSPACE', undefined);
    const departamentoLancamentoId = resolveDepartamentoLancamento(user, baseDepto);
    assertDepartamentoDoUser(user, null, departamentoLancamentoId);

    // Monta os itens (cada licença com sua ALOCAÇÃO própria, livre).
    const itensData = await Promise.all(
      dto.itens.map(async (it) => {
        if (!it.softwareId && !(it.nome || '').trim()) {
          throw new BadRequestException('Cada licença precisa de um software ou de um nome (avulsa)');
        }
        const alocacao = await resolveDepartamento(this.prisma, user, 'WORKSPACE', it.departamentoId);
        const valorTotal =
          it.quantidade != null && it.valorUnitario != null
            ? Number((it.quantidade * it.valorUnitario).toFixed(2))
            : (it.valorUnitario ?? null);
        return {
          softwareId: it.softwareId || null,
          nome: it.softwareId ? null : (it.nome?.trim() || null),
          categoriaId: it.softwareId ? null : (it.categoriaId || null),
          modeloLicenca: it.modeloLicenca || null,
          quantidade: it.quantidade ?? null,
          valorUnitario: it.valorUnitario ?? null,
          valorTotal,
          chaveSerial: it.chaveSerial || null,
          // denormalizados do cabeçalho (mantém leitura legado: grid/indicadores)
          chaveNfe,
          fornecedorId: dto.fornecedorId || null,
          fornecedor: dto.fornecedor || null,
          observacoes: it.observacoes || null,
          departamentoId: alocacao,
          departamentoLancamentoId,
        };
      }),
    );
    const valorTotalNota = itensData.reduce((s, i) => s + Number(i.valorTotal || 0), 0);

    const nota = await this.prisma.licencaCompra.create({
      data: {
        numero,
        semNota,
        dataLancamento: new Date(dto.dataLancamento),
        dataVencimento: dto.dataVencimento ? new Date(dto.dataVencimento) : null,
        chaveNfe,
        valorTotal: valorTotalNota,
        observacao: dto.observacao || null,
        fornecedorId: dto.fornecedorId || null,
        criadoPorId: user.sub,
        departamentoLancamentoId,
        itens: { create: itensData },
      },
      include: notaInclude,
    });
    return nota;
  }

  async update(id: string, dto: UpdateLicencaCompraDto, user: JwtPayload) {
    const nota = await this.prisma.licencaCompra.findUnique({ where: { id } });
    if (!nota) throw new NotFoundException('Nota de licença não encontrada');
    assertDepartamentoDoUser(user, null, nota.departamentoLancamentoId);

    const semNota = dto.semNota ?? nota.semNota;
    const numero = semNota ? 'S/N' : (dto.numero ?? nota.numero);
    const chaveNfe = semNota ? null : (dto.chaveNfe !== undefined ? dto.chaveNfe : nota.chaveNfe);

    const atualizada = await this.prisma.licencaCompra.update({
      where: { id },
      data: {
        numero,
        semNota,
        chaveNfe,
        dataLancamento: dto.dataLancamento ? new Date(dto.dataLancamento) : undefined,
        dataVencimento: dto.dataVencimento ? new Date(dto.dataVencimento) : undefined,
        fornecedorId: dto.fornecedorId !== undefined ? (dto.fornecedorId || null) : undefined,
        observacao: dto.observacao !== undefined ? (dto.observacao || null) : undefined,
      },
      include: notaInclude,
    });

    // Propaga os campos denormalizados para as licenças desta nota (mantém o
    // grid/indicadores legados consistentes). `fornecedor` (texto livre) só é
    // sobrescrito se veio no payload.
    const propagacao: { chaveNfe: string | null; fornecedorId: string | null; fornecedor?: string | null } = {
      chaveNfe,
      fornecedorId: atualizada.fornecedorId,
    };
    if (dto.fornecedor !== undefined) propagacao.fornecedor = dto.fornecedor || null;
    await this.prisma.softwareLicenca.updateMany({ where: { notaId: id }, data: propagacao });

    return this.findOne(id);
  }

  async remove(id: string, user: JwtPayload) {
    const nota = await this.prisma.licencaCompra.findUnique({ where: { id } });
    if (!nota) throw new NotFoundException('Nota de licença não encontrada');
    assertDepartamentoDoUser(user, null, nota.departamentoLancamentoId);

    // Apaga a nota e suas licenças (funcionários vinculados caem por cascade).
    await this.prisma.$transaction([
      this.prisma.softwareLicenca.deleteMany({ where: { notaId: id } }),
      this.prisma.licencaCompra.delete({ where: { id } }),
    ]);
    return { success: true };
  }
}
