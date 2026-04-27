import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { DrConfigService } from '../backup-execucao/dr-config.service';

/**
 * Service centralizado de alertas — webhook (Slack/Teams) + e-mail.
 * Reaproveita config existente de Backup/DR (`webhookAlerta`, `emailAlerta`)
 * em `core.system_config` pra evitar duplicar config no .env.
 *
 * Origem: auditoria observabilidade 26/04/2026 #10 — generaliza o que antes
 * só o backup usava.
 *
 * Uso interno (outros backends da plataforma):
 *   POST /api/v1/internal/alerts/notify { severity, title, message, source, context? }
 *
 * Uso direto (dentro do auth-gateway):
 *   alertNotifier.notify({ severity: 'error', title, message, source: 'auth' })
 */
export type AlertSeverity = 'info' | 'warn' | 'error' | 'critical';

export interface AlertPayload {
  severity: AlertSeverity;
  title: string;
  message: string;
  source: string; // ex: 'fiscal', 'gestao-ti', 'backup', 'auth'
  context?: Record<string, unknown>;
}

export interface AlertResult {
  webhookSent: boolean;
  emailSent: boolean;
  details: string;
}

@Injectable()
export class AlertNotifierService {
  private readonly logger = new Logger(AlertNotifierService.name);

  constructor(private readonly drConfig: DrConfigService) {}

  async notify(payload: AlertPayload): Promise<AlertResult> {
    const cfg = await this.drConfig.get();
    const result: AlertResult = { webhookSent: false, emailSent: false, details: '' };

    const emoji = this.emojiFor(payload.severity);
    const subject = `${emoji} [${payload.source}] ${payload.title}`;
    const body = this.buildBody(payload);

    // Webhook (Slack/Teams) — não bloqueia se falhar
    if (cfg.webhookAlerta) {
      try {
        const res = await fetch(cfg.webhookAlerta, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: subject + '\n\n' + body }),
          signal: AbortSignal.timeout(10_000),
        });
        result.webhookSent = res.ok;
        if (!res.ok) result.details += `webhook HTTP ${res.status}; `;
      } catch (err) {
        result.details += `webhook fail: ${(err as Error).message}; `;
      }
    }

    // E-mail — só pra severity >= error
    if (cfg.emailAlerta && (payload.severity === 'error' || payload.severity === 'critical')) {
      try {
        const host = process.env.SMTP_HOST;
        const port = Number(process.env.SMTP_PORT || 587);
        if (!host) {
          result.details += 'email skipped: SMTP_HOST ausente; ';
        } else {
          const transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth:
              process.env.SMTP_USER && process.env.SMTP_PASSWORD
                ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
                : undefined,
            connectionTimeout: 10_000,
          });
          await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER || 'alertas@capul.com.br',
            to: cfg.emailAlerta,
            subject,
            text: body,
          });
          result.emailSent = true;
        }
      } catch (err) {
        result.details += `email fail: ${(err as Error).message}; `;
      }
    }

    if (!result.webhookSent && !result.emailSent) {
      this.logger.warn(`Alerta nao entregue: ${subject} — ${result.details || 'sem destinos configurados'}`);
    } else {
      this.logger.log(`Alerta entregue: ${subject} (webhook=${result.webhookSent}, email=${result.emailSent})`);
    }

    return result;
  }

  private emojiFor(s: AlertSeverity): string {
    return { info: 'ℹ️', warn: '⚠️', error: '❌', critical: '🚨' }[s];
  }

  private buildBody(p: AlertPayload): string {
    const lines = [p.message];
    if (p.context && Object.keys(p.context).length) {
      lines.push('');
      lines.push('Contexto:');
      for (const [k, v] of Object.entries(p.context)) {
        lines.push(`  • ${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
      }
    }
    lines.push('');
    lines.push(`disparado em ${new Date().toISOString()} via Capul Platform`);
    return lines.join('\n');
  }
}
