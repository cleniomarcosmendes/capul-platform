import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Transport SMTP compartilhado por todos os serviços que enviam e-mail.
 *
 * Inicializado em onModuleInit a partir do env SMTP_*. Verifica a conexão
 * em modo `verify()` — se falhar, apenas avisa no log (não aborta o boot)
 * para permitir desenvolvimento local sem SMTP real. Em produção, o admin
 * deve monitorar os logs para pegar falha de SMTP precocemente.
 */
@Injectable()
export class MailTransportService implements OnModuleInit {
  private readonly logger = new Logger(MailTransportService.name);
  private transporter!: Transporter;
  private fromAddress!: string;
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT') ?? '587');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASSWORD');
    const from = this.config.get<string>('SMTP_FROM');

    if (!host) {
      this.logger.warn('SMTP_HOST ausente — e-mails não serão enviados (modo dev).');
      return;
    }

    this.fromAddress = from ?? `fiscal@${host}`;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });

    try {
      await this.transporter.verify();
      this.enabled = true;
      this.logger.log(`SMTP conectado: ${user ?? '(sem auth)'}@${host}:${port}`);
    } catch (err) {
      this.logger.warn(
        `SMTP verify falhou: ${(err as Error).message} — e-mails podem não ser enviados.`,
      );
      // mantém transporter, mas deixa `enabled=false` pra não travar o motor de cruzamento
    }
  }

  /**
   * Envia um e-mail. Retorna null se SMTP não está habilitado (dev).
   * Nunca lança — falhas são logadas e retornadas como `error` para o caller
   * persistir em `fiscal.alerta_enviado`.
   */
  async send(options: {
    to: string[];
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ sent: boolean; messageId?: string; response?: string; error?: string }> {
    if (!this.transporter) {
      return { sent: false, error: 'SMTP não configurado' };
    }
    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      return {
        sent: true,
        messageId: info.messageId,
        response: info.response,
      };
    } catch (err) {
      this.logger.error(`Falha ao enviar e-mail: ${(err as Error).message}`);
      return { sent: false, error: (err as Error).message };
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
