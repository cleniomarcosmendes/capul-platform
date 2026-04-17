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

    const rows = await this.prisma.client.usuarioModuloCore.findMany({
      where: {
        moduloCodigo: MODULO_FISCAL,
        role: 'GESTOR_FISCAL',
        ativo: true,
        usuario: { ativo: true },
      },
      include: { usuario: true },
    });

    const destinatarios: Destinatario[] = rows.map((r) => ({
      email: r.usuario.email,
      nome: r.usuario.nome,
    }));

    let result: ResolveResult;
    if (destinatarios.length === 0) {
      this.logger.warn(
        `Nenhum GESTOR_FISCAL ativo — enviando para fallback ${this.fallbackEmail}`,
      );
      result = {
        destinatarios: [{ email: this.fallbackEmail, nome: 'Fallback (sem gestores)' }],
        fallback: true,
      };
    } else {
      result = { destinatarios, fallback: false };
    }

    this.cache = { resolvedAt: Date.now(), value: result };
    return result;
  }

  /**
   * Invalida o cache — chamar via endpoint `POST /alertas/refresh-destinatarios`
   * quando o Configurador atribuir/remover a role GESTOR_FISCAL.
   */
  invalidate(): void {
    this.cache = null;
  }
}
