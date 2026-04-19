import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { MODULO_FISCAL } from '../common/constants/modulo.constant.js';

interface Destinatario {
  email: string;
  nome: string;
}

interface ResolveResult {
  destinatarios: Destinatario[];
  fallback: boolean;
}

/**
 * Resolve os destinatários dos alertas consolidados DINAMICAMENTE a cada
 * envio, consultando quem possui a role GESTOR_FISCAL no momento.
 *
 * Fonte de verdade: `core.usuarios_modulos` join com `core.usuarios` —
 * o schema core é READ-ONLY para o Módulo Fiscal, mas read é liberado.
 *
 * Cache em memória de 5 minutos (item 8 do addendum v1.5) — consistente
 * com o padrão de lookup do gestao-ti.
 *
 * Fallback: se nenhum GESTOR_FISCAL estiver ativo no momento do envio,
 * usa o e-mail de `FISCAL_FALLBACK_EMAIL` — nunca enviar para vazio e
 * nunca silenciosamente descartar alertas.
 */
@Injectable()
export class DestinatariosResolver {
  private readonly logger = new Logger(DestinatariosResolver.name);
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;
  private cache: { resolvedAt: number; value: ResolveResult } | null = null;
  private readonly fallbackEmail: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.fallbackEmail = config.get<string>('FISCAL_FALLBACK_EMAIL') ?? 'ti@capul.com.br';
  }

  async resolve(): Promise<ResolveResult> {
    if (this.cache && this.cache.resolvedAt + this.CACHE_TTL_MS > Date.now()) {
      return this.cache.value;
    }
    const result = await this.resolveByRoles(['GESTOR_FISCAL']);
    this.cache = { resolvedAt: Date.now(), value: result };
    return result;
  }

  /**
   * Resolve destinatários por um conjunto arbitrário de roles fiscais.
   * Útil para alertas críticos que exigem role extra (ex: limite diário 90%
   * inclui ADMIN_TI além de GESTOR_FISCAL). Sem cache — chamado menos
   * frequentemente que o digest.
   */
  async resolveByRoles(roles: string[]): Promise<ResolveResult> {
    const rows = await this.prisma.client.usuarioModuloCore.findMany({
      where: {
        moduloCodigo: MODULO_FISCAL,
        role: { in: roles },
        ativo: true,
        usuario: { ativo: true },
      },
      include: { usuario: true },
    });

    // Dedup por email (um usuário pode ter múltiplas roles)
    const seen = new Set<string>();
    const destinatarios: Destinatario[] = [];
    for (const r of rows) {
      if (seen.has(r.usuario.email)) continue;
      seen.add(r.usuario.email);
      destinatarios.push({ email: r.usuario.email, nome: r.usuario.nome });
    }

    if (destinatarios.length === 0) {
      this.logger.warn(
        `Nenhum usuário com roles [${roles.join(', ')}] ativo — enviando para fallback ${this.fallbackEmail}`,
      );
      return {
        destinatarios: [{ email: this.fallbackEmail, nome: 'Fallback (sem destinatários)' }],
        fallback: true,
      };
    }
    return { destinatarios, fallback: false };
  }

  /**
   * Invalida o cache — chamar via endpoint `POST /alertas/refresh-destinatarios`
   * quando o Configurador atribuir/remover a role GESTOR_FISCAL.
   */
  invalidate(): void {
    this.cache = null;
  }
}
