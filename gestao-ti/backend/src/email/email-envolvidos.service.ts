import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const AUTH_GATEWAY_URL = process.env.AUTH_GATEWAY_URL || 'http://auth-gateway:3000';

export type CanalEmail = 'chamados' | 'pendencias' | 'atividades';

export interface EnviarEmailEnvolvidosOpts {
  /** Canal de preferência do destinatário (default opt-in). */
  canal: CanalEmail;
  /** IDs dos usuários envolvidos. O emissor é removido automaticamente se incluído. */
  destinatarioIds: string[];
  /** ID do emissor — nunca recebe e-mail da própria ação. */
  emissorId: string;
  /** Assunto do e-mail. */
  subject: string;
  /** Corpo HTML. text é derivado automaticamente. */
  html: string;
  /**
   * Se `true`, NÃO envia (caller decidiu suprimir — comentário interno,
   * chamado-privado-pra-não-TI, etc). Mantém call-site idempotente.
   */
  suprimir?: boolean;
}

export interface EnviarEmailEnvolvidosResult {
  sent: number;
  skipped: number;
  reason?: string;
}

@Injectable()
export class EmailEnvolvidosService {
  private readonly logger = new Logger(EmailEnvolvidosService.name);

  constructor(private readonly prisma: PrismaService) {}

  async enviar(opts: EnviarEmailEnvolvidosOpts): Promise<EnviarEmailEnvolvidosResult> {
    if (opts.suprimir) {
      return { sent: 0, skipped: opts.destinatarioIds.length, reason: 'suprimido pelo caller' };
    }

    // Remove emissor e duplicatas.
    const ids = Array.from(new Set(opts.destinatarioIds.filter((id) => id && id !== opts.emissorId)));
    if (ids.length === 0) {
      return { sent: 0, skipped: 0, reason: 'lista vazia' };
    }

    // Busca e-mail + preferências dos envolvidos.
    const usuarios = await this.prisma.usuario.findMany({
      where: { id: { in: ids } },
      select: { id: true, email: true, preferencias: true },
    });

    const destinos: string[] = [];
    let skipped = 0;
    for (const u of usuarios) {
      if (!u.email) {
        skipped += 1;
        continue;
      }
      const prefs = (u.preferencias as Record<string, any> | null) ?? {};
      const emailPref = (prefs.email as Record<string, unknown> | undefined) ?? {};
      // Default opt-in: chave ausente = true.
      const habilitado = emailPref[opts.canal] !== false;
      if (!habilitado) {
        skipped += 1;
        continue;
      }
      destinos.push(u.email);
    }

    if (destinos.length === 0) {
      return { sent: 0, skipped, reason: 'todos sem e-mail ou opt-out' };
    }

    try {
      const res = await fetch(`${AUTH_GATEWAY_URL}/api/v1/internal/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: destinos,
          subject: opts.subject,
          html: opts.html,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(`Auth Gateway recusou e-mail (HTTP ${res.status}): ${body.slice(0, 200)}`);
        return { sent: 0, skipped: skipped + destinos.length, reason: `gateway ${res.status}` };
      }
      const payload = (await res.json().catch(() => null)) as { sent?: boolean; accepted?: number } | null;
      const accepted = payload?.accepted ?? destinos.length;
      return { sent: accepted, skipped };
    } catch (err) {
      this.logger.error(`Falha ao chamar Auth Gateway: ${(err as Error).message}`);
      return { sent: 0, skipped: skipped + destinos.length, reason: (err as Error).message };
    }
  }
}
