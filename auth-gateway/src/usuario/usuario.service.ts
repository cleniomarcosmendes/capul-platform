import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  CreateUsuarioDto,
  UpdateUsuarioDto,
  AtribuirPermissaoDto,
} from './dto/create-usuario.dto';
import { resolveDepartamento } from '../common/utils/resolve-departamento';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

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
        matricula: true,
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

  /** Remove campos sensíveis (senha/mfaSecret) antes de devolver via API. */
  private semSegredos<T extends object>(u: T): T {
    const clone = { ...u } as Record<string, unknown>;
    delete clone.senha;
    delete clone.mfaSecret;
    return clone as T;
  }

  async findOne(id: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      include: {
        filialPrincipal: true,
        departamento: true,
        filiais: { include: { filial: true } },
        permissoes: {
          // Workspace Onda 2 C2.2 (fix 24/05) — `departamento` faltava no
          // include, então o UsuarioFormPage filtrava todas as permissões
          // fora (filter exige p.departamentoId existir) e mostrava
          // "0 perfis" mesmo quando o DB tinha 2.
          include: { modulo: true, roleModulo: true, departamento: true },
        },
      },
    });
    if (!usuario) throw new NotFoundException('Usuario nao encontrado');
    return this.semSegredos(usuario);
  }

  async getPreferencias(id: string): Promise<Record<string, any>> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: { preferencias: true },
    });
    if (!usuario) throw new NotFoundException('Usuario nao encontrado');
    return (usuario.preferencias as Record<string, any>) ?? {};
  }

  async updatePreferencias(id: string, patch: Record<string, any>) {
    const atual = await this.getPreferencias(id);
    const merged = { ...atual, ...patch };

    if ('inactivityTimeoutMin' in merged) {
      const v = merged.inactivityTimeoutMin;
      const ok = v === 'never' || (typeof v === 'number' && [30, 60, 120, 240].includes(v));
      if (!ok) {
        throw new BadRequestException(
          'inactivityTimeoutMin deve ser 30, 60, 120, 240 ou "never"',
        );
      }
    }

    if ('email' in merged) {
      const email = merged.email;
      if (typeof email !== 'object' || email === null || Array.isArray(email)) {
        throw new BadRequestException('preferencias.email deve ser objeto');
      }
      const chaves = ['chamados', 'pendencias', 'atividades'] as const;
      for (const k of Object.keys(email)) {
        if (!chaves.includes(k as any)) {
          throw new BadRequestException(`preferencias.email.${k} não é uma chave conhecida`);
        }
        if (typeof email[k] !== 'boolean') {
          throw new BadRequestException(`preferencias.email.${k} deve ser boolean`);
        }
      }
    }

    await this.prisma.usuario.update({
      where: { id },
      data: { preferencias: merged },
    });
    return merged;
  }


  /** Chapa normalizada (E+5 dígitos) — MESMA regra da Logística. `E01047`, `001047` e
   *  `1047` são a mesma pessoa para o Protheus. */
  private static chapa(m?: string | null): string | null {
    const d = (m ?? '').replace(/\D/g, '');
    if (!d) return null;
    return 'E' + d.slice(-5).padStart(5, '0');
  }

  /**
   * Matrícula do usuário INDIVIDUAL: obrigatória e sem colisão de CHAPA.
   *
   * **Obrigatória** porque a matrícula é o que liga o login à pessoa no Protheus — é
   * dela que sai o departamento que responde pelas despesas (Logística), e sem ela o
   * sistema cai em heurísticas (o departamento do LOGIN, que é o do posto). Não vale
   * para PADRAO: aquele login é de um POSTO (caixa/portaria), não de alguém.
   *
   * **Sem colisão** porque a chapa normaliza pelos 5 ÚLTIMOS dígitos: `E01047` e
   * `001047` colidem. Em 09/08 isso fez o departamento aprovador de uma pessoa ser
   * lido da ficha de OUTRA. Barrar no cadastro é onde o problema tem conserto barato.
   */
  private async assertMatriculaDeIndividual(
    tipo: string | null | undefined,
    matricula: string | null | undefined,
    idAtual?: string,
  ) {
    if (tipo !== 'INDIVIDUAL') return;
    const valor = (matricula ?? '').trim();
    if (!valor) {
      throw new BadRequestException(
        'Usuário individual exige a matrícula do colaborador — é ela que liga o login à pessoa no Protheus. Use a busca por nome na aba Dados para preencher.',
      );
    }
    const chapa = UsuarioService.chapa(valor);
    if (!chapa) {
      throw new BadRequestException('Matrícula inválida: informe os dígitos da chapa do colaborador.');
    }
    const candidatos = await this.prisma.usuario.findMany({
      where: { status: 'ATIVO', matricula: { not: null }, ...(idAtual ? { id: { not: idAtual } } : {}) },
      select: { id: true, username: true, nome: true, matricula: true },
    });
    const colide = candidatos.find((u) => UsuarioService.chapa(u.matricula) === chapa);
    if (colide) {
      throw new BadRequestException(
        `A matrícula ${valor} resulta na mesma chapa (${chapa}) de ${colide.nome} (${colide.username}). ` +
          'A chapa usa os 5 últimos dígitos, então matrículas diferentes podem colidir — e a plataforma passaria a confundir as duas pessoas.',
      );
    }
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

    await this.assertMatriculaDeIndividual(dto.tipo, dto.matricula);

    if (dto.permissoes?.length) {
      for (const p of dto.permissoes) {
        await this.assertEmailParaPermissaoFiscal(dto.email, p.moduloId, p.roleModuloId);
      }
    }

    // Login pelo portal RH (entregador): sem senha local — gera um hash
    // inutilizável (a validação acontece no Protheus). Senão, exige a senha.
    if (!dto.autenticaPortal && !dto.senha) {
      throw new BadRequestException('Informe a senha (ou marque autenticação pelo portal).');
    }
    if (dto.autenticaPortal && !dto.matricula?.trim()) {
      throw new BadRequestException('Autenticação pelo portal exige a matrícula.');
    }
    // Cost 12 — auditoria 10/05/2026 #M2
    const senhaHash = await bcrypt.hash(
      dto.autenticaPortal ? `portal:${randomUUID()}` : (dto.senha as string),
      12,
    );

    const novoUsuario = await this.prisma.usuario.create({
      data: {
        username: dto.username,
        email: dto.email,
        nome: dto.nome,
        senha: senhaHash,
        matricula: dto.matricula?.trim() || null,
        autenticaPortal: dto.autenticaPortal ?? false,
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
              create: await Promise.all(
                dto.permissoes.map(async (p) => ({
                  moduloId: p.moduloId,
                  roleModuloId: p.roleModuloId,
                  // Onda 1 Sub-fase 1.6.1 + C2.7 refino — cascata:
                  // (1) p.departamentoId (UI multi-perfil envia explícito),
                  // (2) senão dto.departamentoId (depto organizacional),
                  // (3) senão fallback T.I.
                  departamentoId: await resolveDepartamento(
                    this.prisma,
                    null,
                    '',
                    p.departamentoId ?? dto.departamentoId,
                  ),
                })),
              ),
            }
          : undefined,
      },
      include: {
        filiais: { include: { filial: true } },
        permissoes: { include: { modulo: true, roleModulo: true, departamento: true } },
      },
    });
    this.auditLog.log({ action: 'USER_CREATE', metadata: { targetUserId: novoUsuario.id, username: dto.username } });
    return this.semSegredos(novoUsuario);
  }

  async update(id: string, dto: UpdateUsuarioDto) {
    const usuarioAtual = await this.findOne(id);

    // Vale o que ESTÁ sendo salvo: o tipo/matrícula do DTO quando vierem, senão o atual.
    await this.assertMatriculaDeIndividual(
      dto.tipo !== undefined ? dto.tipo : usuarioAtual.tipo,
      dto.matricula !== undefined ? dto.matricula : usuarioAtual.matricula,
      id,
    );

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

    const { filialIds, matricula, ...userData } = dto;
    // Matrícula vazia → null (evita colisão no índice único de string vazia).
    const matriculaData =
      matricula !== undefined ? { matricula: matricula.trim() || null } : {};

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

    return this.semSegredos(
      await this.prisma.usuario.update({
        where: { id },
        data: { ...userData, ...matriculaData },
        include: {
          filialPrincipal: true,
          departamento: true,
          filiais: { include: { filial: true } },
          permissoes: { include: { modulo: true, roleModulo: true, departamento: true } },
        },
      }),
    );
  }

  async updateStatus(id: string, status: 'ATIVO' | 'INATIVO') {
    await this.findOne(id);
    return this.semSegredos(
      await this.prisma.usuario.update({
        where: { id },
        data: { status },
      }),
    );
  }

  async resetSenha(id: string, novaSenha: string) {
    await this.findOne(id);
    // Cost 12 — auditoria 10/05/2026 #M2
    const senhaHash = await bcrypt.hash(novaSenha, 12);
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

  async atribuirPermissao(usuarioId: string, dto: AtribuirPermissaoDto, user?: JwtPayload) {
    const usuario = await this.findOne(usuarioId);

    await this.assertEmailParaPermissaoFiscal(usuario.email, dto.moduloId, dto.roleModuloId);

    // Onda 1 Sub-fase 1.6.1 — resolveDepartamento em cascata.
    // DTO opcional → contexto do user no módulo (do JWT) → fallback T.I.
    const moduloAlvo = await this.prisma.moduloSistema.findUniqueOrThrow({
      where: { id: dto.moduloId },
      select: { codigo: true },
    });
    const departamentoId = await resolveDepartamento(
      this.prisma,
      user ?? null,
      moduloAlvo.codigo,
      dto.departamentoId,
    );

    const result = await this.prisma.permissaoModulo.upsert({
      where: {
        usuarioId_moduloId_departamentoId: {
          usuarioId,
          moduloId: dto.moduloId,
          departamentoId,
        },
      },
      create: {
        usuarioId,
        moduloId: dto.moduloId,
        roleModuloId: dto.roleModuloId,
        departamentoId,
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

  async revogarPermissao(usuarioId: string, moduloId: string, departamentoId?: string) {
    // Onda 1 Sub-fase 1.6.2 — departamentoId opcional para multi-perfil real.
    // Sem departamentoId: revoga a permissão única do user no módulo
    // (comportamento legado — funciona em DEV onde todos só têm 1 perfil).
    // Com departamentoId: revoga somente o perfil específico (multi-perfil).
    const permissao = await this.prisma.permissaoModulo.findFirst({
      where: { usuarioId, moduloId, ...(departamentoId ? { departamentoId } : {}) },
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
