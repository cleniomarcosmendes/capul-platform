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
import { paginate } from '../common/prisma/paginate.helper.js';
import { resolveDepartamento } from '../common/helpers/resolve-departamento.helper.js';
import { resolveDepartamentoLancamento } from '../common/helpers/resolve-departamento-lancamento.helper.js';
import { applyDepartamentoFilterCadastroOp, assertDepartamentoDoUser } from '../common/helpers/departamento-filter.helper.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';

const MODELOS_POR_USUARIO: ModeloLicenca[] = ['POR_USUARIO', 'SUBSCRICAO', 'SAAS'];

const licencaInclude = {
  software: { select: { id: true, nome: true, fabricante: true, tipo: true } },
  contrato: { select: { id: true, titulo: true, numero: true } },
  categoria: { select: { id: true, codigo: true, nome: true } },
  // S11 (25/05) — expor depto de alocação na listagem (gap visível) +
  // fornecedor cadastrado (FornecedorConfig).
  departamento: { select: { id: true, nome: true } },
  fornecedorRef: { select: { id: true, codigo: true, loja: true, nome: true } },
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
    departamentoId?: string;
    page?: number;
    pageSize?: number;
  }, role: string, user?: JwtPayload) {
    const where: Record<string, unknown> = {};

    if (filters.softwareId) where.softwareId = filters.softwareId;
    if (filters.status) where.status = filters.status;
    if (filters.categoriaId) where.categoriaId = filters.categoriaId;
    if (filters.avulsas) where.softwareId = null;
    // S11 — filtro explícito por depto (útil p/ OVERSIGHT;
    // applyDepartamentoFilter abaixo já restringe non-OVERSIGHT).
    if (filters.departamentoId) where.departamentoId = filters.departamentoId;

    if (filters.vencendoEm) {
      const limite = new Date();
      limite.setDate(limite.getDate() + filters.vencendoEm);
      where.dataVencimento = { lte: limite, gte: new Date() };
      where.status = 'ATIVA';
    }

    // Workspace Onda 2 C2.4 — filtro departamental. ADMIN escapa (D36).
    const whereFiltrado = applyDepartamentoFilterCadastroOp(where, user ?? null, role);

    const resultado = await paginate(this.prisma, this.prisma.softwareLicenca, {
      where: whereFiltrado,
      include: {
        ...licencaInclude,
        _count: { select: { usuarios: true } },
      },
      orderBy: { dataVencimento: 'asc' },
      page: filters.page,
      pageSize: filters.pageSize,
    });

    // Mantém shape paginado; filtra campos sensíveis dentro de `items`.
    return {
      ...resultado,
      items: this.filterSensitiveFields(resultado.items as never[], role),
    };
  }

  async findOne(id: string, role: string) {
    const licenca = await this.prisma.softwareLicenca.findUnique({
      where: { id },
      include: licencaIncludeComUsuarios,
    });
    if (!licenca) throw new NotFoundException('Licenca nao encontrada');

    return this.filterSensitiveField(licenca, role);
  }

  async create(dto: CreateLicencaDto, user?: JwtPayload) {
    // Validar: deve ter softwareId OU (nome + categoria) para licenca avulsa
    if (!dto.softwareId && !dto.nome) {
      throw new BadRequestException('Informe o software ou o nome da licenca avulsa');
    }

    if (dto.softwareId) {
      const software = await this.prisma.software.findUnique({ where: { id: dto.softwareId } });
      if (!software) throw new BadRequestException('Software nao encontrado');
    }

    // Onda 1 Sub-fase 1.6.1 — resolveDepartamento em cascata.
    const departamentoId = await resolveDepartamento(
      this.prisma,
      user ?? null,
      'WORKSPACE',
      dto.departamentoId,
    );

    // Onda 3 S10 — gate de escrita (OVERSIGHT bypass).
    if (user) assertDepartamentoDoUser(user, null, departamentoId);

    const departamentoLancamentoId = resolveDepartamentoLancamento(user, departamentoId);

    // S11 — se veio fornecedorId, valida existência (FK ON DELETE SET NULL,
    // mas pegamos um BadRequest amigável aqui).
    if (dto.fornecedorId) {
      const f = await this.prisma.fornecedorConfig.findUnique({ where: { id: dto.fornecedorId } });
      if (!f) throw new BadRequestException('Fornecedor nao encontrado');
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
        fornecedorId: dto.fornecedorId || null,
        observacoes: dto.observacoes,
        departamentoId,
        departamentoLancamentoId,
      },
      include: licencaInclude,
    });
  }

  async update(id: string, dto: UpdateLicencaDto, user?: JwtPayload) {
    const existing = await this.getLicencaOrFail(id);
    // Onda 3 S10 — gate de escrita (OVERSIGHT bypass).
    if (user) {
      assertDepartamentoDoUser(user, null, existing.departamentoId);
      if (dto.departamentoId && dto.departamentoId !== existing.departamentoId) {
        assertDepartamentoDoUser(user, null, dto.departamentoId);
      }
    }
    // S11 — validar FK fornecedor se vier no payload (BadRequest amigável).
    // String vazia = "limpar vínculo" → vira null. UUID → valida existência.
    let fornecedorIdNorm: string | null | undefined = undefined;
    if (dto.fornecedorId !== undefined) {
      if (dto.fornecedorId === '') {
        fornecedorIdNorm = null;
      } else {
        const f = await this.prisma.fornecedorConfig.findUnique({ where: { id: dto.fornecedorId } });
        if (!f) throw new BadRequestException('Fornecedor nao encontrado');
        fornecedorIdNorm = dto.fornecedorId;
      }
    }
    return this.prisma.softwareLicenca.update({
      where: { id },
      data: {
        ...dto,
        fornecedorId: fornecedorIdNorm,
        dataInicio: dto.dataInicio ? new Date(dto.dataInicio) : undefined,
        dataVencimento: dto.dataVencimento ? new Date(dto.dataVencimento) : undefined,
      },
      include: licencaInclude,
    });
  }

  async renovar(id: string, user?: JwtPayload) {
    const anterior = await this.getLicencaOrFail(id);
    if (user) assertDepartamentoDoUser(user, null, anterior.departamentoId);

    // Inativar a licenca anterior
    await this.prisma.softwareLicenca.update({
      where: { id },
      data: { status: 'INATIVA' },
    });

    // Renovação herda departamentoId da licença anterior (NOT NULL desde 1.1).
    const departamentoId = anterior.departamentoId;

    // Criar nova licenca copiando dados da anterior (RN-LIC-08).
    // Lançamento herda do registro original (renovação preserva auditoria).
    const nova = await this.prisma.softwareLicenca.create({
      data: {
        softwareId: anterior.softwareId,
        nome: anterior.nome,
        categoriaId: anterior.categoriaId,
        modeloLicenca: anterior.modeloLicenca,
        quantidade: anterior.quantidade,
        valorTotal: anterior.valorTotal,
        valorUnitario: anterior.valorUnitario,
        departamentoId,
        departamentoLancamentoId: anterior.departamentoLancamentoId,
        fornecedor: anterior.fornecedor,
        fornecedorId: anterior.fornecedorId,
        chaveSerial: anterior.chaveSerial,
        observacoes: `Renovacao da licenca anterior (${anterior.id})`,
      },
      include: licencaInclude,
    });

    return nova;
  }

  async inativar(id: string, user?: JwtPayload) {
    const licenca = await this.getLicencaOrFail(id);
    if (user) assertDepartamentoDoUser(user, null, licenca.departamentoId);
    return this.prisma.softwareLicenca.update({
      where: { id },
      data: { status: 'INATIVA' },
      include: licencaInclude,
    });
  }

  async remove(id: string, user?: JwtPayload) {
    const licenca = await this.getLicencaOrFail(id);
    if (user) assertDepartamentoDoUser(user, null, licenca.departamentoId);
    const usuarios = await this.prisma.licencaUsuario.count({ where: { licencaId: id } });
    if (usuarios > 0) {
      throw new BadRequestException(`Licenca possui ${usuarios} usuario(s) vinculado(s). Remova os usuarios antes de excluir.`);
    }
    if (licenca.contratoId) {
      throw new BadRequestException('Licenca esta vinculada a um contrato. Desvincule antes de excluir.');
    }
    await this.prisma.softwareLicenca.delete({ where: { id } });
    return { success: true };
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
