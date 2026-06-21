import { Injectable, Logger } from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateSacEmailConfigDto } from './dto.js';

/**
 * SAC Fase 3 (e-mail de ENTRADA) — sub-fase 3a (fundações).
 *
 * Aqui só a CONFIG OPERACIONAL (singleton id=1) + "testar conexão" IMAP. NÃO há
 * ingestão ainda (vem na 3b). A CONEXÃO IMAP vem do AMBIENTE (SAC_IMAP_*),
 * espelhando o padrão do SMTP_* — segredo não fica no banco.
 */
@Injectable()
export class SacEmailService {
  private readonly logger = new Logger(SacEmailService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Garante e retorna a linha singleton (id=1). */
  private async getConfigRow() {
    return this.prisma.sacEmailConfig.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    });
  }

  /** Dados de conexão derivados do ambiente (senha nunca exposta). */
  private conexaoInfo() {
    const host = (process.env.SAC_IMAP_HOST ?? '').trim();
    const user = (process.env.SAC_IMAP_USER ?? '').trim();
    const senha = (process.env.SAC_IMAP_PASSWORD ?? '').trim();
    const port = Number(process.env.SAC_IMAP_PORT ?? 993);
    const secure = (process.env.SAC_IMAP_TLS ?? 'true') !== 'false';
    return {
      origem: 'ambiente' as const,
      host: host || null,
      port,
      user: user || null,
      secure,
      senhaConfigurada: !!senha,
      configurada: !!(host && user && senha),
    };
  }

  async getConfig() {
    const config = await this.getConfigRow();
    return { config, conexao: this.conexaoInfo() };
  }

  async updateConfig(dto: UpdateSacEmailConfigDto, userId: string) {
    await this.getConfigRow();
    const config = await this.prisma.sacEmailConfig.update({
      where: { id: 1 },
      data: {
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.pauseSync !== undefined ? { pauseSync: dto.pauseSync } : {}),
        ...(dto.mailboxFolder !== undefined ? { mailboxFolder: dto.mailboxFolder.trim() || 'INBOX' } : {}),
        ...(dto.pollIntervalMinutes !== undefined ? { pollIntervalMinutes: dto.pollIntervalMinutes } : {}),
        updatedBy: userId,
      },
    });
    return { config, conexao: this.conexaoInfo() };
  }

  /**
   * Testa a conexão IMAP e devolve a contagem da pasta — SEM ingerir nada.
   * Nunca lança: erro de conexão/credencial vira `{ ok:false, error }`.
   */
  async testConnection(): Promise<{ ok: boolean; mailbox?: string; total?: number; unseen?: number; error?: string }> {
    const info = this.conexaoInfo();
    if (!info.configurada) {
      return { ok: false, error: 'Conexão IMAP não configurada no ambiente (defina SAC_IMAP_HOST, SAC_IMAP_USER e SAC_IMAP_PASSWORD).' };
    }
    const row = await this.getConfigRow();
    const folder = row.mailboxFolder || 'INBOX';
    const client = new ImapFlow({
      host: info.host as string,
      port: info.port,
      secure: info.secure,
      auth: { user: info.user as string, pass: (process.env.SAC_IMAP_PASSWORD ?? '').trim() },
      logger: false,
      // Não trava o teste se o servidor demorar.
      socketTimeout: 15_000,
    });
    try {
      await client.connect();
      const status = await client.status(folder, { messages: true, unseen: true });
      return { ok: true, mailbox: folder, total: status.messages ?? 0, unseen: status.unseen ?? 0 };
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.warn(`SAC IMAP testConnection falhou (${folder}): ${msg}`);
      return { ok: false, mailbox: folder, error: msg };
    } finally {
      try {
        await client.logout();
      } catch {
        /* conexão já caída — ignora */
      }
    }
  }
}
