import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/** Capability sensível (LGPD) — acesso a PII de sócios. */
export const CAP_SOCIO = 'FISCAL_CONSULTA_SOCIOS';

/**
 * Enforcement da capability de sócio + auditoria de acesso (F3).
 *
 * - Lê core.usuario_capability READ-ONLY (owned pelo auth-gateway, F1)
 *   via mirror `usuarioCapabilityCore`. Cache por usuário, TTL 5min —
 *   mesmo padrão de alertas/destinatarios.resolver. Trade-off conhecido
 *   (plano §6): revogação pode levar até 5min p/ valer.
 * - Grava fiscal.socio_acesso_log a cada acesso (D4 — LGPD).
 *
 * Plano: docs/PLANO_FISCAL_CONSULTA_SOCIOS_LGPD_v1.md
 */
@Injectable()
export class SocioCapabilityService {
  private readonly logger = new Logger(SocioCapabilityService.name);
  private readonly TTL_MS = 5 * 60 * 1000;
  private readonly cache = new Map<string, { at: number; val: boolean }>();

  constructor(private readonly prisma: PrismaService) {}

  /** true se o usuário tem a capability de sócio ATIVA (cacheado). */
  async temCapacidade(usuarioId: string): Promise<boolean> {
    if (!usuarioId) return false;
    const hit = this.cache.get(usuarioId);
    if (hit && hit.at + this.TTL_MS > Date.now()) return hit.val;
    const row = await this.prisma.client.usuarioCapabilityCore.findFirst({
      where: { usuarioId, capability: CAP_SOCIO, ativo: true },
      select: { id: true },
    });
    const val = !!row;
    this.cache.set(usuarioId, { at: Date.now(), val });
    return val;
  }

  /** Lança 403 se não tiver a capability (uso em Busca por Sócio). */
  async assertCapacidade(usuarioId: string): Promise<void> {
    if (!(await this.temCapacidade(usuarioId))) {
      throw new ForbiddenException(
        'Acesso a dados de sócio requer autorização específica (LGPD). ' +
          'Solicite a um ADMIN a liberação no Configurador.',
      );
    }
  }

  /** Auditoria de acesso (best-effort — não derruba a consulta se falhar). */
  async registrarAcesso(
    usuarioId: string,
    usuarioEmail: string | null | undefined,
    escopo: 'BUSCA_SOCIO' | 'QSA',
    termo: string | null | undefined,
    resultadoQtd: number,
  ): Promise<void> {
    try {
      await this.prisma.client.socioAcessoLog.create({
        data: {
          usuarioId,
          usuarioEmail: usuarioEmail ?? null,
          escopo,
          termo: termo ? termo.slice(0, 200) : null,
          resultadoQtd,
        },
      });
    } catch (e) {
      this.logger.error(
        `Falha ao gravar socio_acesso_log (${escopo}, user=${usuarioId}): ${(e as Error)?.message}`,
      );
    }
  }
}
