import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { S3Client, ListObjectsV2Command, HeadBucketCommand } from '@aws-sdk/client-s3';
import { DrConfigService } from './dr-config.service';

export interface TestResult {
  ok: boolean;
  message: string;
  detail?: string;
}

/**
 * Executa testes das integrações DR (webhook, email, S3, backup execução).
 * Webhook/email/S3 rodam dentro do container; operações que dependem do HOST
 * (executar backup.sh, dr-test.sh) retornam comando exato pra copiar.
 *
 * Auditoria 26/04/2026 Sprint 4 — visibilidade no Configurador.
 */
@Injectable()
export class DrTestService {
  private readonly logger = new Logger(DrTestService.name);

  constructor(private readonly config: DrConfigService) {}

  async testWebhook(): Promise<TestResult> {
    const cfg = await this.config.get();
    if (!cfg.webhookAlerta) {
      throw new BadRequestException('Webhook não configurado');
    }
    try {
      const res = await fetch(cfg.webhookAlerta, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🧪 Teste de webhook — Capul Platform Backup/DR (disparado em ${new Date().toISOString()} via Configurador)`,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        return {
          ok: false,
          message: `Webhook respondeu HTTP ${res.status}`,
          detail: await res.text().catch(() => ''),
        };
      }
      return {
        ok: true,
        message: `Webhook OK (HTTP ${res.status})`,
      };
    } catch (err) {
      return {
        ok: false,
        message: 'Falha ao chamar webhook',
        detail: (err as Error).message,
      };
    }
  }

  async testEmail(): Promise<TestResult> {
    const cfg = await this.config.get();
    if (!cfg.emailAlerta) {
      throw new BadRequestException('E-mail destinatário não configurado no Configurador');
    }

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    const from = process.env.SMTP_FROM || user;

    if (!host) {
      return {
        ok: false,
        message: 'SMTP não configurado no .env do servidor',
        detail:
          'Defina no .env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM. Veja docs/DEPLOY_BACKUP_DR_DOUGLAS.md §2.',
      };
    }

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: user && pass ? { user, pass } : undefined,
        connectionTimeout: 10_000,
      });

      await transporter.verify();

      const info = await transporter.sendMail({
        from: from || 'capul-backup@capul.com.br',
        to: cfg.emailAlerta,
        subject: '🧪 Teste de alerta — Capul Backup/DR',
        text:
          `Teste disparado em ${new Date().toLocaleString('pt-BR')} via Configurador.\n\n` +
          `Se você está lendo isto, o canal de alerta de backup está funcionando.\n\n` +
          `— Capul Platform`,
      });

      return {
        ok: true,
        message: `E-mail enviado com sucesso pra ${cfg.emailAlerta}`,
        detail: `messageId: ${info.messageId}`,
      };
    } catch (err) {
      this.logger.error(`Falha ao testar e-mail: ${(err as Error).message}`);
      return {
        ok: false,
        message: 'Falha ao enviar e-mail de teste',
        detail: (err as Error).message,
      };
    }
  }

  async testS3(): Promise<TestResult> {
    const cfg = await this.config.get();
    if (!cfg.destinoOffsite) {
      throw new BadRequestException('Destino off-site não configurado');
    }

    // destinoOffsite pode vir como "s3://bucket-name" ou "bucket-name"
    const bucket = cfg.destinoOffsite.replace(/^s3:\/\//i, '').split('/')[0];
    if (!bucket) {
      return {
        ok: false,
        message: 'destinoOffsite inválido — formato esperado: s3://bucket-name',
      };
    }

    const region = process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      return {
        ok: false,
        message: 'Credenciais AWS não configuradas no .env do servidor',
        detail:
          'Defina no .env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION. Veja docs/DEPLOY_BACKUP_DR_DOUGLAS.md §4.',
      };
    }

    try {
      const s3 = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
        endpoint: process.env.AWS_S3_ENDPOINT, // opcional pra Backblaze/MinIO
      });

      // 1) HeadBucket — confirma acesso
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));

      // 2) ListObjectsV2 — lista até 5 objetos pra mostrar conteúdo
      const list = await s3.send(
        new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 5 }),
      );

      const total = list.KeyCount ?? 0;
      const sample = (list.Contents || [])
        .map((o) => `  ${o.Key}  (${o.Size ?? 0} bytes)`)
        .join('\n');

      return {
        ok: true,
        message: `Bucket "${bucket}" acessível — ${total} objeto(s) encontrado(s)`,
        detail: total > 0 ? `Amostra (até 5):\n${sample}` : 'Bucket vazio (esperado se ainda não rodou backup)',
      };
    } catch (err) {
      this.logger.error(`Falha ao testar S3: ${(err as Error).message}`);
      return {
        ok: false,
        message: 'Falha ao acessar bucket S3',
        detail: (err as Error).message,
      };
    }
  }

  /**
   * Operações que precisam rodar no HOST (não no container).
   * Retorna o comando exato pra ADMIN copiar/colar via SSH.
   */
  comandoExecutarBackup(): TestResult {
    return {
      ok: true,
      message: 'Operação requer SSH no servidor — copie e execute como root:',
      detail: 'sudo /opt/capul-platform/scripts/backup.sh full',
    };
  }

  comandoDrTest(): TestResult {
    return {
      ok: true,
      message: 'Operação requer SSH no servidor — copie e execute como root:',
      detail: 'sudo /opt/capul-platform/scripts/dr-test.sh',
    };
  }
}
