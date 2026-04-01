import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateLicencaDto } from './dto/create-licenca.dto.js';
import { UpdateLicencaDto } from './dto/update-licenca.dto.js';
import { CreateCategoriaLicencaDto, UpdateCategoriaLicencaDto } from './dto/create-categoria-licenca.dto.js';
import { StatusLicenca, ModeloLicenca } from '@prisma/client';
import { isGestor } from '../common/constants/roles.constant.js';

const MODELOS_POR_USUARIO: ModeloLicenca[] = ['POR_USUARIO', 'SUBSCRICAO', 'SAAS'];

const licencaInclude = {
  software: { select: { id: true, nome: true, fabricante: true, tipo: true } },
  contrato: { select: { id: true, titulo: true, numero: true } },
  categoria: { select: { id: true, codigo: true, nome: true } },
};

const licencaIncludeComUsuarios = {
  ...licencaInclude,
  usuarios: {
    include: {
      usuario: { select: { id: true, username: true, nome: true, email: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  _count: { select: { usuarios: true } },
};

@Injectable()
export class LicencaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: {
    softwareId?: string;
    status?: StatusLicenca;
    vencendoEm?: number; // dias
    categoriaId?: string;
    avulsas?: boolean;
  }, role: string) {
    const where: Record<string, unknown> = {};

    if (filters.softwareId) where.softwareId = filters.softwareId;
    if (filters.status) where.status = filters.status;
    if (filters.categoriaId) where.categoriaId = filters.categoriaId;
    if (filters.avulsas) where.softwareId = null;

    if (filters.vencendoEm) {
      const limite = new Date();
      limite.setDate(limite.getDate() + filters.vencendoEm);
      where.dataVencimento = { lte: limite, gte: new Date() };
      where.status = 'ATIVA';
    }

    const licencas = await this.prisma.softwareLicenca.findMany({
      where,
      include: {
        ...licencaInclude,
        _count: { select: { usuarios: true } },
      },
      orderBy: { dataVencimento: 'asc' },
    });

    return this.filterSensitiveFields(licencas, role);
  }

  async findOne(id: string, role: string) {
    const licenca = await this.prisma.softwareLicenca.findUnique({
      where: { id },
      include: licencaIncludeComUsuarios,
    });
    if (!licenca) throw new NotFoundException('Licenca nao encontrada');

    return this.filterSensitiveField(licenca, role);
  }

  async create(dto: CreateLicencaDto) {
    // Validar: deve ter softwareId OU (nome + categoria) para licenca avulsa
    if (!dto.softwareId && !dto.nome) {
      throw new BadRequestException('Informe o software ou o nome da licenca avulsa');
    }

    if (dto.softwareId) {
      const software = await this.prisma.software.findUnique({ where: { id: dto.softwareId } });
      if (!software) throw new BadRequestException('Software nao encontrado');
    }

    return this.prisma.softwareLicenca.create({
      data: {
        softwareId: dto.softwareId || null,
        nome: dto.nome,
        categoriaId: dto.categoriaId || null,
        modeloLicenca: dto.modeloLicenca,
        quantidade: dto.quantidade,
        valorTotal: dto.valorTotal,
        valorUnitario: dto.valorUnitario,
        dataInicio: dto.dataInicio ? new Date(dto.dataInicio) : null,
        dataVencimento: dto.dataVencimento ? new Date(dto.dataVencimento) : null,
        chaveSerial: dto.chaveSerial,
        fornecedor: dto.fornecedor,
        observacoes: dto.observacoes,
      },
      include: licencaInclude,
    });
  }

  async update(id: string, dto: UpdateLicencaDto) {
    await this.getLicencaOrFail(id);
    return this.prisma.softwareLicenca.update({
      where: { id },
      data: {
        ...dto,
        dataInicio: dto.dataInicio ? new Date(dto.dataInicio) : undefined,
        dataVencimento: dto.dataVencimento ? new Date(dto.dataVencimento) : undefined,
      },
      include: licencaInclude,
    });
  }

  async renovar(id: string) {
    const anterior = await this.getLicencaOrFail(id);

    // Inativar a licenca anterior
    await this.prisma.softwareLicenca.update({
      where: { id },
      data: { status: 'INATIVA' },
    });

    // Criar nova licenca copiando dados da anterior (RN-LIC-08)
    const nova = await this.prisma.softwareLicenca.create({
      data: {
        softwareId: anterior.softwareId,
        nome: anterior.nome,
        categoriaId: anterior.categoriaId,
        modeloLicenca: anterior.modeloLicenca,
        quantidade: anterior.quantidade,
        valorTotal: anterior.valorTotal,
        valorUnitario: anterior.valorUnitario,
        fornecedor: anterior.fornecedor,
        chaveSerial: anterior.chaveSerial,
        observacoes: `Renovacao da licenca anterior (${anterior.id})`,
      },
      include: licencaInclude,
    });

    return nova;
  }

  async inativar(id: string) {
    await this.getLicencaOrFail(id);
    return this.prisma.softwareLicenca.update({
      where: { id },
      data: { status: 'INATIVA' },
      include: licencaInclude,
    });
  }

  // ─── Usuarios da Licenca ────────────────────────────────────

  async listarUsuariosLicenca(licencaId: string) {
    await this.getLicencaOrFail(licencaId);
    return this.prisma.licencaUsuario.findMany({
      where: { licencaId },
      include: {
        usuario: { select: { id: true, username: true, nome: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async atribuirUsuario(licencaId: string, usuarioId: string) {
    const licenca = await this.getLicencaOrFail(licencaId);

    if (licenca.status !== 'ATIVA') {
      throw new BadRequestException('Nao e possivel atribuir usuarios a uma licenca inativa ou vencida');
    }

    if (licenca.modeloLicenca && !MODELOS_POR_USUARIO.includes(licenca.modeloLicenca)) {
      throw new BadRequestException('Modelo de licenca nao permite atribuicao por usuario');
    }

    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) throw new BadRequestException('Usuario nao encontrado');

    const existente = await this.prisma.licencaUsuario.findUnique({
      where: { licencaId_usuarioId: { licencaId, usuarioId } },
    });
    if (existente) throw new BadRequestException('Usuario ja atribuido a esta licenca');

    if (licenca.quantidade) {
      const count = await this.prisma.licencaUsuario.count({ where: { licencaId } });
      if (count >= licenca.quantidade) {
        throw new BadRequestException(`Limite de usuarios da licenca atingido (${count}/${licenca.quantidade})`);
      }
    }

    await this.prisma.licencaUsuario.create({
      data: { licencaId, usuarioId },
    });

    return this.findOne(licencaId, 'ADMIN');
  }

  async desatribuirUsuario(licencaId: string, usuarioId: string) {
    await this.getLicencaOrFail(licencaId);

    const vinculo = await this.prisma.licencaUsuario.findUnique({
      where: { licencaId_usuarioId: { licencaId, usuarioId } },
    });
    if (!vinculo) throw new NotFoundException('Vinculo nao encontrado');

    await this.prisma.licencaUsuario.delete({ where: { id: vinculo.id } });

    return this.findOne(licencaId, 'ADMIN');
  }

  // ─── Categorias de Licenca ───────────────────────────────

  async findAllCategorias(status?: string) {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    return this.prisma.categoriaLicenca.findMany({
      where,
      orderBy: { nome: 'asc' },
    });
  }

  async createCategoria(dto: CreateCategoriaLicencaDto) {
    return this.prisma.categoriaLicenca.create({
      data: {
        codigo: dto.codigo,
        nome: dto.nome,
        descricao: dto.descricao,
      },
    });
  }

  async updateCategoria(id: string, dto: UpdateCategoriaLicencaDto) {
    const existing = await this.prisma.categoriaLicenca.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Categoria de licenca nao encontrada');

    const data: Record<string, unknown> = {};
    if (dto.codigo !== undefined) data.codigo = dto.codigo;
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.categoriaLicenca.update({
      where: { id },
      data,
    });
  }

  async removeCategoria(id: string) {
    const existing = await this.prisma.categoriaLicenca.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Categoria de licenca nao encontrada');
    const vinculos = await this.prisma.softwareLicenca.count({ where: { categoriaId: id } });
    if (vinculos > 0) throw new BadRequestException(`Categoria possui ${vinculos} licenca(s) vinculada(s). Inative-a em vez de excluir.`);
    await this.prisma.categoriaLicenca.delete({ where: { id } });
    return { success: true };
  }

  // ─── Helpers ──────────────────────────────────────────────

  private async getLicencaOrFail(id: string) {
    const licenca = await this.prisma.softwareLicenca.findUnique({ where: { id } });
    if (!licenca) throw new NotFoundException('Licenca nao encontrada');
    return licenca;
  }

  private filterSensitiveFields(licencas: unknown[], role: string) {
    if (isGestor(role)) return licencas;
    return licencas.map((l) => this.filterSensitiveField(l, role));
  }

  private filterSensitiveField(licenca: unknown, role: string) {
    if (isGestor(role)) return licenca;
    const obj = { ...(licenca as Record<string, unknown>) };
    obj.chaveSerial = null;
    return obj;
  }
}
