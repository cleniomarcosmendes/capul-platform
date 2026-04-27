import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  CreateUsuarioDto,
  UpdateUsuarioDto,
  AtribuirPermissaoDto,
} from './dto/create-usuario.dto';

// Roles do módulo Fiscal cujos titulares recebem alertas por e-mail
// (DestinatariosResolver). Sem e-mail cadastrado o usuário é silenciosamente
// pulado e perde alertas críticos — daí a obrigatoriedade contextual.
const MODULO_FISCAL_CODIGO = 'FISCAL';
const ROLES_FISCAIS_COM_EMAIL = ['GESTOR_FISCAL', 'ADMIN_TI'];

@Injectable()
export class UsuarioService {
  constructor(private prisma: PrismaService, private auditLog: AuditLogService) {}

  private async assertEmailParaPermissaoFiscal(
    email: string | null | undefined,
    moduloId: string,
    roleModuloId: string,
  ): Promise<void> {
    if (email && email.trim() !== '') return;
    const [modulo, role] = await Promise.all([
      this.prisma.moduloSistema.findUnique({ where: { id: moduloId }, select: { codigo: true } }),
      this.prisma.roleModulo.findUnique({ where: { id: roleModuloId }, select: { codigo: true, nome: true } }),
    ]);
    if (
      modulo?.codigo === MODULO_FISCAL_CODIGO &&
      role &&
      ROLES_FISCAIS_COM_EMAIL.includes(role.codigo)
    ) {
      throw new BadRequestException(
        `E-mail é obrigatório para a role "${role.nome}" no módulo Fiscal — usado para alertas críticos (limite SEFAZ, circuit breaker, digest de cruzamento).`,
      );
    }
  }

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
        tipo: true,
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

    if (dto.permissoes?.length) {
      for (const p of dto.permissoes) {
        await this.assertEmailParaPermissaoFiscal(dto.email, p.moduloId, p.roleModuloId);
      }
    }

    const senhaHash = await bcrypt.hash(dto.senha, 10);

    const novoUsuario = await this.prisma.usuario.create({
      data: {
        username: dto.username,
        email: dto.email,
        nome: dto.nome,
        senha: senhaHash,
        telefone: dto.telefone,
        cargo: dto.cargo,
        tipo: (dto.tipo as never) || 'INDIVIDUAL',
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
    this.auditLog.log({ action: 'USER_CREATE', metadata: { targetUserId: novoUsuario.id, username: dto.username } });
    return novoUsuario;
  }

  async update(id: string, dto: UpdateUsuarioDto) {
    const usuarioAtual = await this.findOne(id);

    // Se o e-mail está sendo limpado/omitido, garantir que o usuário não tem
    // permissão fiscal ativa que dependa de e-mail (caso contrário ele
    // silenciosamente perde alertas críticos).
    const novoEmail = dto.email !== undefined ? dto.email : usuarioAtual.email;
    if (!novoEmail || novoEmail.trim() === '') {
      const permsFiscais = usuarioAtual.permissoes.filter(
        (p) =>
          p.status === 'ATIVO' &&
          p.modulo.codigo === MODULO_FISCAL_CODIGO &&
          ROLES_FISCAIS_COM_EMAIL.includes(p.roleModulo.codigo),
      );
      if (permsFiscais.length > 0) {
        throw new BadRequestException(
          `Não é possível remover o e-mail enquanto o usuário tiver a role "${permsFiscais[0].roleModulo.nome}" no módulo Fiscal — essa role recebe alertas por e-mail. Revogue a permissão ou cadastre um e-mail.`,
        );
      }
    }

    const { filialIds, ...userData } = dto;

    // Atualizar filiais vinculadas (delete + recreate)
    if (filialIds !== undefined) {
      await this.prisma.usuarioFilial.deleteMany({ where: { usuarioId: id } });
      if (filialIds.length > 0) {
        await this.prisma.usuarioFilial.createMany({
          data: filialIds.map((filialId, i) => ({
            usuarioId: id,
            filialId,
            isDefault: i === 0,
          })),
        });
      }
    }

    return this.prisma.usuario.update({
      where: { id },
      data: userData,
      include: {
        filialPrincipal: true,
        departamento: true,
        filiais: { include: { filial: true } },
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

  async resetSenha(id: string, novaSenha: string) {
    await this.findOne(id);
    const senhaHash = await bcrypt.hash(novaSenha, 10);
    await this.prisma.usuario.update({
      where: { id },
      data: { senha: senhaHash, primeiroAcesso: true },
    });
    // Revogar todos refresh tokens do usuario
    await this.prisma.refreshToken.updateMany({
      where: { usuarioId: id, revoked: false },
      data: { revoked: true },
    });
    this.auditLog.log({ action: 'PASSWORD_RESET', metadata: { targetUserId: id } });
    return { success: true, message: 'Senha redefinida com sucesso. O usuario devera trocar a senha no proximo login.' };
  }

  async atribuirPermissao(usuarioId: string, dto: AtribuirPermissaoDto) {
    const usuario = await this.findOne(usuarioId);

    await this.assertEmailParaPermissaoFiscal(usuario.email, dto.moduloId, dto.roleModuloId);

    const result = await this.prisma.permissaoModulo.upsert({
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
    this.auditLog.log({ action: 'PERMISSION_GRANT', metadata: { targetUserId: usuarioId, modulo: result.modulo.codigo, role: result.roleModulo.codigo } });
    return result;
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

    const result = await this.prisma.permissaoModulo.update({
      where: { id: permissao.id },
      data: { status: 'INATIVO' },
    });
    this.auditLog.log({ action: 'PERMISSION_REVOKE', metadata: { targetUserId: usuarioId, moduloId } });
    return result;
  }
}
