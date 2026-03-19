import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { authenticator } = require('otplib');
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private auditLog: AuditLogService,
  ) {}

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const { login, senha } = dto;

    const isEmail = login.includes('@');

    const usuario = await this.prisma.usuario.findFirst({
      where: isEmail
        ? { email: login, status: 'ATIVO' }
        : { username: login, status: 'ATIVO' },
      include: {
        permissoes: {
          where: { status: 'ATIVO' },
          include: {
            modulo: true,
            roleModulo: true,
          },
        },
        filiais: {
          include: { filial: true },
        },
        filialPrincipal: true,
        departamento: true,
      },
    });

    if (!usuario) {
      this.auditLog.log({ action: 'LOGIN_FAILURE', ipAddress: ip, userAgent, metadata: { login } });
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      this.auditLog.log({ action: 'LOGIN_FAILURE', usuarioId: usuario.id, ipAddress: ip, userAgent, metadata: { login } });
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const filialAtiva =
      usuario.filiais.find((f) => f.isDefault) || usuario.filiais[0];

    // Fallback para filialPrincipal se nao tem filiais vinculadas
    const filialFallback = filialAtiva
      ? { id: filialAtiva.filialId, codigo: filialAtiva.filial.codigo, nome: filialAtiva.filial.nomeFantasia }
      : usuario.filialPrincipal
        ? { id: usuario.filialPrincipal.id, codigo: usuario.filialPrincipal.codigo, nome: usuario.filialPrincipal.nomeFantasia }
        : null;

    const payload: JwtPayload = {
      sub: usuario.id,
      username: usuario.username,
      email: usuario.email,
      filialId: filialFallback?.id || null,
      filialCodigo: filialFallback?.codigo || null,
      departamentoId: usuario.departamentoId,
      departamentoNome: usuario.departamento.nome,
      modulos: usuario.permissoes.map((p) => ({
        codigo: p.modulo.codigo,
        role: p.roleModulo.codigo,
      })),
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRATION', '15m'),
    });

    const refreshToken = await this.createRefreshToken(usuario.id);

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoLogin: new Date() },
    });

    // Se MFA habilitado, retornar token parcial para segunda etapa
    if (usuario.mfaEnabled) {
      const mfaToken = this.jwtService.sign(
        { sub: usuario.id, purpose: 'mfa' },
        { secret: this.config.get('JWT_SECRET'), expiresIn: '5m' },
      );
      this.auditLog.log({ action: 'LOGIN_MFA_REQUIRED', usuarioId: usuario.id, ipAddress: ip, userAgent });
      return { mfaRequired: true, mfaToken };
    }

    this.auditLog.log({ action: 'LOGIN_SUCCESS', usuarioId: usuario.id, ipAddress: ip, userAgent });

    return {
      accessToken,
      refreshToken: refreshToken.token,
      usuario: {
        id: usuario.id,
        username: usuario.username,
        nome: usuario.nome,
        email: usuario.email,
        primeiroAcesso: usuario.primeiroAcesso,
        mfaEnabled: usuario.mfaEnabled,
        departamento: {
          id: usuario.departamento.id,
          nome: usuario.departamento.nome,
        },
        filialAtual: filialFallback,
        modulos: usuario.permissoes.map((p) => ({
          codigo: p.modulo.codigo,
          nome: p.modulo.nome,
          icone: p.modulo.icone,
          cor: p.modulo.cor,
          url: p.modulo.urlFrontend,
          role: p.roleModulo.codigo,
          roleNome: p.roleModulo.nome,
        })),
      },
    };
  }

  async refresh(refreshTokenValue: string) {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshTokenValue },
      include: {
        usuario: {
          include: {
            permissoes: {
              where: { status: 'ATIVO' },
              include: { modulo: true, roleModulo: true },
            },
            filiais: {
              include: { filial: true },
            },
            departamento: true,
          },
        },
      },
    });

    if (
      !storedToken ||
      storedToken.revoked ||
      storedToken.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Refresh token invalido ou expirado');
    }

    // Revogar o token usado (rotacao)
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });

    const usuario = storedToken.usuario;
    const filialAtiva =
      usuario.filiais.find((f) => f.isDefault) || usuario.filiais[0];

    const payload: JwtPayload = {
      sub: usuario.id,
      username: usuario.username,
      email: usuario.email,
      filialId: filialAtiva?.filialId || null,
      filialCodigo: filialAtiva?.filial?.codigo || null,
      departamentoId: usuario.departamentoId,
      departamentoNome: usuario.departamento.nome,
      modulos: usuario.permissoes.map((p) => ({
        codigo: p.modulo.codigo,
        role: p.roleModulo.codigo,
      })),
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRATION', '15m'),
    });

    const newRefreshToken = await this.createRefreshToken(usuario.id);

    return {
      accessToken,
      refreshToken: newRefreshToken.token,
    };
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { usuarioId: userId, revoked: false },
      data: { revoked: true },
    });
    this.auditLog.log({ action: 'LOGOUT', usuarioId: userId });
    return { message: 'Logout realizado com sucesso' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuario nao encontrado');
    }

    const senhaValida = await bcrypt.compare(dto.senhaAtual, usuario.senha);
    if (!senhaValida) {
      throw new BadRequestException('Senha atual incorreta');
    }

    const novaSenhaHash = await bcrypt.hash(dto.novaSenha, 10);

    await this.prisma.usuario.update({
      where: { id: userId },
      data: {
        senha: novaSenhaHash,
        primeiroAcesso: false,
      },
    });

    // Revogar todos os refresh tokens
    await this.prisma.refreshToken.updateMany({
      where: { usuarioId: userId, revoked: false },
      data: { revoked: true },
    });

    this.auditLog.log({ action: 'PASSWORD_CHANGE', usuarioId: userId });
    return { message: 'Senha alterada com sucesso' };
  }

  // ========== MFA/TOTP ==========

  async mfaSetup(userId: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: userId } });
    if (!usuario) throw new UnauthorizedException('Usuario nao encontrado');
    if (usuario.mfaEnabled) throw new BadRequestException('MFA ja esta ativado');

    const secret = authenticator.generateSecret();
    await this.prisma.usuario.update({ where: { id: userId }, data: { mfaSecret: secret } });

    const otpauthUrl = authenticator.keyuri(usuario.username, 'Capul Platform', secret);
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    return { qrCodeUrl, secret, otpauthUrl };
  }

  async mfaVerify(userId: string, code: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: userId } });
    if (!usuario?.mfaSecret) throw new BadRequestException('Execute o setup do MFA primeiro');

    const isValid = authenticator.verify({ token: code, secret: usuario.mfaSecret });
    if (!isValid) throw new BadRequestException('Codigo invalido');

    await this.prisma.usuario.update({ where: { id: userId }, data: { mfaEnabled: true } });
    this.auditLog.log({ action: 'MFA_ENABLED', usuarioId: userId });
    return { success: true, message: 'MFA ativado com sucesso' };
  }

  async mfaDisable(userId: string, code: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: userId } });
    if (!usuario?.mfaEnabled) throw new BadRequestException('MFA nao esta ativado');

    const isValid = authenticator.verify({ token: code, secret: usuario.mfaSecret! });
    if (!isValid) throw new BadRequestException('Codigo invalido');

    await this.prisma.usuario.update({ where: { id: userId }, data: { mfaEnabled: false, mfaSecret: null } });
    this.auditLog.log({ action: 'MFA_DISABLED', usuarioId: userId });
    return { success: true, message: 'MFA desativado' };
  }

  async mfaLogin(mfaToken: string, code: string, ip?: string, userAgent?: string) {
    let payload: { sub: string; purpose: string };
    try {
      payload = this.jwtService.verify(mfaToken, { secret: this.config.get('JWT_SECRET') });
    } catch {
      throw new UnauthorizedException('Token MFA invalido ou expirado');
    }
    if (payload.purpose !== 'mfa') throw new UnauthorizedException('Token invalido');

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      include: {
        permissoes: { where: { status: 'ATIVO' }, include: { modulo: true, roleModulo: true } },
        filiais: { include: { filial: true } },
        filialPrincipal: true,
        departamento: true,
      },
    });
    if (!usuario) throw new UnauthorizedException('Usuario nao encontrado');

    const isValid = authenticator.verify({ token: code, secret: usuario.mfaSecret! });
    if (!isValid) {
      this.auditLog.log({ action: 'MFA_LOGIN_FAILURE', usuarioId: usuario.id, ipAddress: ip, userAgent });
      throw new UnauthorizedException('Codigo MFA invalido');
    }

    // Gerar tokens completos (mesmo fluxo do login normal)
    const filialAtiva = usuario.filiais.find((f) => f.isDefault) || usuario.filiais[0];
    const filialFallback = filialAtiva
      ? { id: filialAtiva.filialId, codigo: filialAtiva.filial.codigo, nome: filialAtiva.filial.nomeFantasia }
      : usuario.filialPrincipal
        ? { id: usuario.filialPrincipal.id, codigo: usuario.filialPrincipal.codigo, nome: usuario.filialPrincipal.nomeFantasia }
        : null;

    const jwtPayload = {
      sub: usuario.id,
      username: usuario.username,
      email: usuario.email,
      filialId: filialFallback?.id,
      filialCodigo: filialFallback?.codigo,
      departamentoId: usuario.departamento?.id,
      departamentoNome: usuario.departamento?.nome,
      modulos: usuario.permissoes.map((p) => ({ codigo: p.modulo.codigo, role: p.roleModulo.codigo })),
    };

    const accessToken = this.jwtService.sign(jwtPayload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRATION', '15m'),
    });
    const refreshToken = await this.createRefreshToken(usuario.id);

    await this.prisma.usuario.update({ where: { id: usuario.id }, data: { ultimoLogin: new Date() } });
    this.auditLog.log({ action: 'LOGIN_SUCCESS', usuarioId: usuario.id, ipAddress: ip, userAgent, metadata: { mfa: true } });

    return {
      accessToken,
      refreshToken: refreshToken.token,
      usuario: {
        id: usuario.id,
        username: usuario.username,
        nome: usuario.nome,
        email: usuario.email,
        primeiroAcesso: usuario.primeiroAcesso,
        mfaEnabled: usuario.mfaEnabled,
        departamento: { id: usuario.departamento?.id, nome: usuario.departamento?.nome },
        filialAtual: filialFallback,
        modulos: usuario.permissoes.map((p) => ({
          codigo: p.modulo.codigo, nome: p.modulo.nome, icone: p.modulo.icone,
          cor: p.modulo.cor, url: p.modulo.urlFrontend, role: p.roleModulo.codigo, roleNome: p.roleModulo.nome,
        })),
      },
    };
  }

  async me(userId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      include: {
        permissoes: {
          where: { status: 'ATIVO' },
          include: { modulo: true, roleModulo: true },
        },
        filiais: {
          include: { filial: true },
        },
        filialPrincipal: true,
        departamento: true,
      },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuario nao encontrado');
    }

    const filialAtiva =
      usuario.filiais.find((f) => f.isDefault) || usuario.filiais[0];

    // Fallback: se usuario nao tem filiais vinculadas, usa filialPrincipal
    const filialAtualObj = filialAtiva
      ? {
          id: filialAtiva.filialId,
          codigo: filialAtiva.filial.codigo,
          nome: filialAtiva.filial.nomeFantasia,
        }
      : usuario.filialPrincipal
        ? {
            id: usuario.filialPrincipal.id,
            codigo: usuario.filialPrincipal.codigo,
            nome: usuario.filialPrincipal.nomeFantasia,
          }
        : null;

    return {
      id: usuario.id,
      username: usuario.username,
      nome: usuario.nome,
      email: usuario.email,
      telefone: usuario.telefone,
      cargo: usuario.cargo,
      avatarUrl: usuario.avatarUrl,
      primeiroAcesso: usuario.primeiroAcesso,
        mfaEnabled: usuario.mfaEnabled,
      departamento: {
        id: usuario.departamento.id,
        nome: usuario.departamento.nome,
      },
      filialAtual: filialAtualObj,
      filiais: usuario.filiais.map((uf) => ({
        id: uf.filialId,
        codigo: uf.filial.codigo,
        nome: uf.filial.nomeFantasia,
        isDefault: uf.isDefault,
      })),
      modulos: usuario.permissoes.map((p) => ({
        codigo: p.modulo.codigo,
        nome: p.modulo.nome,
        icone: p.modulo.icone,
        cor: p.modulo.cor,
        url: p.modulo.urlFrontend,
        role: p.roleModulo.codigo,
        roleNome: p.roleModulo.nome,
      })),
    };
  }

  async getModulos(userId: string) {
    const permissoes = await this.prisma.permissaoModulo.findMany({
      where: { usuarioId: userId, status: 'ATIVO' },
      include: { modulo: true, roleModulo: true },
    });

    return permissoes.map((p) => ({
      codigo: p.modulo.codigo,
      nome: p.modulo.nome,
      icone: p.modulo.icone,
      cor: p.modulo.cor,
      url: p.modulo.urlFrontend,
      role: p.roleModulo.codigo,
      roleNome: p.roleModulo.nome,
    }));
  }

  async switchFilial(userId: string, filialId: string) {
    // Verificar se usuario tem acesso a esta filial
    const usuarioFilial = await this.prisma.usuarioFilial.findUnique({
      where: {
        usuarioId_filialId: { usuarioId: userId, filialId },
      },
      include: { filial: true },
    });

    if (!usuarioFilial) {
      throw new BadRequestException('Voce nao tem acesso a esta filial');
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      include: {
        permissoes: {
          where: { status: 'ATIVO' },
          include: { modulo: true, roleModulo: true },
        },
        departamento: true,
      },
    });

    if (!usuario) {
      throw new BadRequestException('Usuario nao encontrado');
    }

    const payload: JwtPayload = {
      sub: usuario.id,
      username: usuario.username,
      email: usuario.email,
      filialId: usuarioFilial.filialId,
      filialCodigo: usuarioFilial.filial.codigo,
      departamentoId: usuario.departamentoId,
      departamentoNome: usuario.departamento.nome,
      modulos: usuario.permissoes.map((p) => ({
        codigo: p.modulo.codigo,
        role: p.roleModulo.codigo,
      })),
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRATION', '15m'),
    });

    const refreshToken = await this.createRefreshToken(userId);

    return {
      accessToken,
      refreshToken: refreshToken.token,
      filialAtual: {
        id: usuarioFilial.filialId,
        codigo: usuarioFilial.filial.codigo,
        nome: usuarioFilial.filial.nomeFantasia,
      },
    };
  }

  private async createRefreshToken(usuarioId: string) {
    const token = randomUUID();
    const expiresIn = this.config.get('JWT_REFRESH_EXPIRATION', '7d');
    const days = parseInt(expiresIn) || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    return this.prisma.refreshToken.create({
      data: {
        token,
        expiresAt,
        usuarioId,
      },
    });
  }
}
