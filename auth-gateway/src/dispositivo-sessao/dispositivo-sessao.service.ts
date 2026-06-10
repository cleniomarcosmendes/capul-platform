import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Sessões de dispositivo (login mobile / app entregador — Fase 1b).
 * Self-service: o usuário lista e revoga os próprios dispositivos. Revogação em
 * 3 níveis (sessão / dispositivo / todas) sempre invalida os refresh tokens
 * ligados — efeito no app em ≤ TTL do access mobile (Opção B, 15m).
 */
@Injectable()
export class DispositivoSessaoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Sessões ATIVAS (não revogadas, não expiradas) do usuário. */
  listarMeus(usuarioId: string) {
    return this.prisma.dispositivoSessao.findMany({
      where: { usuarioId, revogadoEm: null, expiraEm: { gt: new Date() } },
      orderBy: { ultimoUso: 'desc' },
      select: { id: true, deviceId: true, deviceInfo: true, plataforma: true, criadoEm: true, ultimoUso: true, expiraEm: true },
    });
  }

  /** Revoga UMA sessão — precisa ser do próprio usuário. */
  async revogarSessao(id: string, usuarioId: string, revogadoPorId: string) {
    const s = await this.prisma.dispositivoSessao.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Sessão não encontrada.');
    if (s.usuarioId !== usuarioId) throw new ForbiddenException('Sessão de outro usuário.');
    return this.revogarPorIds([id], revogadoPorId);
  }

  /** Revoga todas as sessões de um dispositivo (deviceId) do usuário. */
  async revogarDispositivo(deviceId: string, usuarioId: string, revogadoPorId: string) {
    const sessoes = await this.prisma.dispositivoSessao.findMany({
      where: { deviceId, usuarioId, revogadoEm: null },
      select: { id: true },
    });
    return this.revogarPorIds(sessoes.map((s) => s.id), revogadoPorId);
  }

  /** Revoga TODAS as sessões ativas do usuário (ex.: "sair de todos os aparelhos"). */
  async revogarTodasDoUsuario(usuarioId: string, revogadoPorId: string) {
    const sessoes = await this.prisma.dispositivoSessao.findMany({
      where: { usuarioId, revogadoEm: null },
      select: { id: true },
    });
    return this.revogarPorIds(sessoes.map((s) => s.id), revogadoPorId);
  }

  /** Núcleo: marca sessões como revogadas + invalida os refresh tokens delas. */
  private async revogarPorIds(ids: string[], revogadoPorId: string) {
    if (ids.length === 0) return { revogadas: 0 };
    const agora = new Date();
    await this.prisma.$transaction([
      this.prisma.dispositivoSessao.updateMany({
        where: { id: { in: ids }, revogadoEm: null },
        data: { revogadoEm: agora, revogadoPorId },
      }),
      this.prisma.refreshToken.updateMany({
        where: { dispositivoSessaoId: { in: ids }, revoked: false },
        data: { revoked: true },
      }),
    ]);
    return { revogadas: ids.length };
  }

  // ---- Helpers do login/refresh mobile (consumidos na sub-fase C) ----

  /** Cria a sessão de dispositivo (login mobile). */
  criar(params: { usuarioId: string; deviceId: string; deviceInfo?: string; plataforma?: string; expiraEm: Date }) {
    return this.prisma.dispositivoSessao.create({
      data: {
        usuarioId: params.usuarioId,
        deviceId: params.deviceId,
        deviceInfo: params.deviceInfo ?? null,
        plataforma: params.plataforma ?? null,
        expiraEm: params.expiraEm,
      },
    });
  }

  /** Valida que a sessão está ativa (não revogada/expirada). Usado no refresh. */
  async assertAtiva(id: string) {
    const s = await this.prisma.dispositivoSessao.findUnique({ where: { id } });
    if (!s || s.revogadoEm || s.expiraEm < new Date()) {
      throw new UnauthorizedException('Sessão de dispositivo revogada ou expirada.');
    }
    return s;
  }

  /** Atualiza o último uso (no refresh). Best-effort. */
  async tocar(id: string) {
    await this.prisma.dispositivoSessao.update({ where: { id }, data: { ultimoUso: new Date() } }).catch(() => undefined);
  }

  /**
   * Renova a janela da sessão (sliding) + marca último uso — chamado no refresh.
   * Cada refresh empurra o `expiraEm` pra frente, então o entregador ATIVO nunca
   * precisa relogar; a sessão só expira após a janela inteira SEM uso. Best-effort.
   */
  async renovar(id: string, expiraEm: Date) {
    await this.prisma.dispositivoSessao
      .update({ where: { id }, data: { ultimoUso: new Date(), expiraEm } })
      .catch(() => undefined);
  }
}
