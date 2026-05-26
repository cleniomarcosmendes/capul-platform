import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * Serviço genérico de e-mail transacional reusável pelos demais backends da
 * plataforma (Gestão TI, Fiscal, etc). Centraliza credenciais SMTP num lugar só.
 *
 * Uso interno (outros backends):
 *   POST /api/v1/internal/email/send  { to, subject, html?, text?, replyTo? }
 *
 * Defesa em camadas:
 *  - Nginx bloqueia /api/v1/internal/* externamente (403)
 *  - Controller é @Public mas só acessível pela rede docker
 *  - Truncamos `to` a 50 endereços por chamada pra evitar abuso
 */
export interface SendEmailPayload {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  sent: boolean;
  accepted: number;
  rejected: number;
  details?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  async send(payload: SendEmailPayload): Promise<SendEmailResult> {
    const host = process.env.SMTP_HOST;
    if (!host) {
      this.logger.warn('SMTP_HOST ausente — e-mail não enviado');
      return { sent: false, accepted: 0, rejected: 0, details: 'SMTP_HOST ausente' };
    }

    const to = Array.isArray(payload.to) ? payload.to : [payload.to];
    const recipients = Array.from(new Set(to.filter((e) => /\S+@\S+\.\S+/.test(e)))).slice(0, 50);
    if (recipients.length === 0) {
      return { sent: false, accepted: 0, rejected: 0, details: 'nenhum destinatário válido' };
    }

    if (!payload.html && !payload.text) {
      return { sent: false, accepted: 0, rejected: 0, details: 'corpo vazio' };
    }

    try {
      const transporter = this.getTransporter();
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'plataforma@capul.com.br',
        to: recipients,
        subject: payload.subject,
        html: payload.html,
        text: payload.text ?? this.htmlToText(payload.html ?? ''),
        replyTo: payload.replyTo,
        // Força UTF-8 — sem isso quoted-printable corrompe glyphs Unicode
        // como → ↩ • no fallback text/plain (auditado via MailHog).
        encoding: 'base64',
      });
      this.logger.log(
        `E-mail enviado: "${payload.subject}" → ${recipients.length} destinatário(s) (accepted=${info.accepted?.length ?? 0})`,
      );
      return {
        sent: true,
        accepted: info.accepted?.length ?? 0,
        rejected: info.rejected?.length ?? 0,
      };
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`Falha ao enviar e-mail "${payload.subject}": ${msg}`);
      return { sent: false, accepted: 0, rejected: recipients.length, details: msg };
    }
  }

  private getTransporter(): nodemailer.Transporter {
    if (this.transporter) return this.transporter;
    const port = Number(process.env.SMTP_PORT || 587);
    // Opt-in: aceitar certificado TLS mesmo se o CN/SAN não bate com SMTP_HOST.
    // Necessário quando o domínio aponta pra um provedor de e-mail com cert
    // próprio (ex.: smtp.capul.com.br → inbox1.vertip.net). Default seguro: true.
    const rejectUnauthorized = process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false';
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASSWORD
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
      connectionTimeout: 10_000,
      tls: { rejectUnauthorized },
    });
    return this.transporter;
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
