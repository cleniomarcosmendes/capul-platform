import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Capability } from './dto/conceder-capability.dto';

/**
 * Capabilities explícitas por usuário (LGPD) — desacopladas do papel.
 * Concessão/revogação só por ADMIN (guard no controller). A linha é
 * preservada na revogação (ativo=false + revogado_*) para auditoria de
 * concessão. O Módulo Fiscal lê esta tabela read-only/cacheado (D3) e
 * faz o enforcement nos endpoints sensíveis (F3). Plano:
 * docs/PLANO_FISCAL_CONSULTA_SOCIOS_LGPD_v1.md
 */
@Injectable()
export class CapabilityService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertUsuario(usuarioId: string) {
    const u = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true },
    });
    if (!u) throw new NotFoundException('Usuario nao encontrado');
  }

  /** Todas as capabilities do usuário (ativas e revogadas) — gestão/auditoria. */
  async listar(usuarioId: string) {
    await this.assertUsuario(usuarioId);
    return this.prisma.usuarioCapability.findMany({
      where: { usuarioId },
      orderBy: { concedidoEm: 'desc' },
    });
  }

  /**
   * Concede (ou reativa) uma capability. Idempotente: se já existe,
   * reativa e atualiza motivo/concedidoPor/Em e limpa revogado_*.
   */
  async conceder(
    usuarioId: string,
    capability: Capability,
    motivo: string,
    adminId: string,
  ) {
    await this.assertUsuario(usuarioId);
    return this.prisma.usuarioCapability.upsert({
      where: { usuarioId_capability: { usuarioId, capability } },
      create: { usuarioId, capability, motivo, concedidoPor: adminId },
      update: {
        ativo: true,
        motivo,
        concedidoPor: adminId,
        concedidoEm: new Date(),
        revogadoPor: null,
        revogadoEm: null,
      },
    });
  }

  /** Revoga (mantém a linha p/ auditoria: ativo=false + revogado_*). */
  async revogar(usuarioId: string, capability: Capability, adminId: string) {
    await this.assertUsuario(usuarioId);
    const atual = await this.prisma.usuarioCapability.findUnique({
      where: { usuarioId_capability: { usuarioId, capability } },
    });
    if (!atual || !atual.ativo) {
      // Idempotente — nada a revogar.
      return atual ?? { usuarioId, capability, ativo: false };
    }
    return this.prisma.usuarioCapability.update({
      where: { usuarioId_capability: { usuarioId, capability } },
      data: { ativo: false, revogadoPor: adminId, revogadoEm: new Date() },
    });
  }
}
