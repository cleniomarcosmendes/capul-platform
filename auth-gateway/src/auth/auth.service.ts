import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
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
        departamento: true,
      },
    });

    if (!usuario) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

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

    const refreshToken = await this.createRefreshToken(usuario.id);

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoLogin: new Date() },
    });

    return {
      accessToken,
      refreshToken: refreshToken.token,
      usuario: {
        id: usuario.id,
        username: usuario.username,
        nome: usuario.nome,
        email: usuario.email,
        primeiroAcesso: usuario.primeiroAcesso,
        departamento: {
          id: usuario.departamento.id,
          nome: usuario.departamento.nome,
        },
        filialAtual: filialAtiva
          ? {
              id: filialAtiva.filialId,
              codigo: filialAtiva.filial.codigo,
              nome: filialAtiva.filial.nomeFantasia,
            }
          : null,
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

    return { message: 'Senha alterada com sucesso' };
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

    return {
      id: usuario.id,
      username: usuario.username,
      nome: usuario.nome,
      email: usuario.email,
      telefone: usuario.telefone,
      cargo: usuario.cargo,
      avatarUrl: usuario.avatarUrl,
      primeiroAcesso: usuario.primeiroAcesso,
      departamento: {
        id: usuario.departamento.id,
        nome: usuario.departamento.nome,
      },
      filialAtual: filialAtiva
        ? {
            id: filialAtiva.filialId,
            codigo: filialAtiva.filial.codigo,
            nome: filialAtiva.filial.nomeFantasia,
          }
        : null,
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
