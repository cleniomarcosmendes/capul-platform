import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateUsuarioDto,
  UpdateUsuarioDto,
  AtribuirPermissaoDto,
} from './dto/create-usuario.dto';

@Injectable()
export class UsuarioService {
  constructor(private prisma: PrismaService) {}

  async findAll(filialId?: string) {
    const where: any = {};
    if (filialId) {
      where.filiais = { some: { filialId } };
    }

    return this.prisma.usuario.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        nome: true,
        telefone: true,
        cargo: true,
        status: true,
        primeiroAcesso: true,
        ultimoLogin: true,
        createdAt: true,
        filialPrincipal: { select: { id: true, codigo: true, nomeFantasia: true } },
        departamento: { select: { id: true, nome: true } },
        permissoes: {
          where: { status: 'ATIVO' },
          select: {
            modulo: { select: { codigo: true, nome: true } },
            roleModulo: { select: { codigo: true, nome: true } },
          },
        },
      },
      orderBy: { nome: 'asc' },
    });
  }

  async findOne(id: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      include: {
        filialPrincipal: true,
        departamento: true,
        filiais: { include: { filial: true } },
        permissoes: {
          include: { modulo: true, roleModulo: true },
        },
      },
    });
    if (!usuario) throw new NotFoundException('Usuario nao encontrado');
    return usuario;
  }

  async create(dto: CreateUsuarioDto) {
    const existing = await this.prisma.usuario.findFirst({
      where: {
        OR: [
          { username: dto.username },
          ...(dto.email ? [{ email: dto.email }] : []),
        ],
      },
    });
    if (existing) {
      throw new ConflictException('Username ou email ja existe');
    }

    const senhaHash = await bcrypt.hash(dto.senha, 10);

    return this.prisma.usuario.create({
      data: {
        username: dto.username,
        email: dto.email,
        nome: dto.nome,
        senha: senhaHash,
        telefone: dto.telefone,
        cargo: dto.cargo,
        filialPrincipalId: dto.filialPrincipalId,
        departamentoId: dto.departamentoId,
        filiais: dto.filialIds
          ? {
              create: dto.filialIds.map((filialId, i) => ({
                filialId,
                isDefault: i === 0,
              })),
            }
          : undefined,
        permissoes: dto.permissoes
          ? {
              create: dto.permissoes.map((p) => ({
                moduloId: p.moduloId,
                roleModuloId: p.roleModuloId,
              })),
            }
          : undefined,
      },
      include: {
        filiais: { include: { filial: true } },
        permissoes: { include: { modulo: true, roleModulo: true } },
      },
    });
  }

  async update(id: string, dto: UpdateUsuarioDto) {
    await this.findOne(id);
    return this.prisma.usuario.update({
      where: { id },
      data: dto,
      include: {
        filialPrincipal: true,
        departamento: true,
        permissoes: { include: { modulo: true, roleModulo: true } },
      },
    });
  }

  async updateStatus(id: string, status: 'ATIVO' | 'INATIVO') {
    await this.findOne(id);
    return this.prisma.usuario.update({
      where: { id },
      data: { status },
    });
  }

  async atribuirPermissao(usuarioId: string, dto: AtribuirPermissaoDto) {
    await this.findOne(usuarioId);

    return this.prisma.permissaoModulo.upsert({
      where: {
        usuarioId_moduloId: {
          usuarioId,
          moduloId: dto.moduloId,
        },
      },
      create: {
        usuarioId,
        moduloId: dto.moduloId,
        roleModuloId: dto.roleModuloId,
      },
      update: {
        roleModuloId: dto.roleModuloId,
        status: 'ATIVO',
      },
      include: { modulo: true, roleModulo: true },
    });
  }

  async revogarPermissao(usuarioId: string, moduloId: string) {
    const permissao = await this.prisma.permissaoModulo.findUnique({
      where: {
        usuarioId_moduloId: { usuarioId, moduloId },
      },
    });
    if (!permissao) {
      throw new NotFoundException('Permissao nao encontrada');
    }

    return this.prisma.permissaoModulo.update({
      where: { id: permissao.id },
      data: { status: 'INATIVO' },
    });
  }
}
