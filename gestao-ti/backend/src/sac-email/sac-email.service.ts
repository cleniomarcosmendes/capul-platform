import { Injectable, Logger } from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import { simpleParser, type ParsedMail } from 'mailparser';
import { createHash, randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificacaoService } from '../notificacao/notificacao.service.js';
import { UpdateSacEmailConfigDto } from './dto.js';
import { UPLOADS_DIR } from '../chamado/services/chamado.constants.js';
import { isAnexoPermitido } from '../common/constants/anexo-mime.constant.js';

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
  private sistemaSacUserId: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacao: NotificacaoService,
  ) {}

  /** ID do usuário de sistema do SAC (autor dos comentários de entrada). Cacheado. */
  private async getSistemaSacUserId(): Promise<string | null> {
    if (this.sistemaSacUserId) return this.sistemaSacUserId;
    const u = await this.prisma.usuario.findFirst({ where: { username: 'sistema_sac' }, select: { id: true } });
    this.sistemaSacUserId = u?.id ?? null;
    return this.sistemaSacUserId;
  }

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

  /** Monta o cliente IMAP a partir das envs. Use só quando `configurada`. */
  private buildClient(): ImapFlow {
    const info = this.conexaoInfo();
    return new ImapFlow({
      host: info.host as string,
      port: info.port,
      secure: info.secure,
      auth: { user: info.user as string, pass: (process.env.SAC_IMAP_PASSWORD ?? '').trim() },
      logger: false,
      socketTimeout: 20_000,
    });
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
    const client = this.buildClient();
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

  // ===== SAC Fase 3b — buscar e CLASSIFICAR (sem criar histórico ainda) =====

  /** Endereço do nosso próprio remetente (p/ não reingerir nossas saídas). */
  private ownFrom(): string {
    return (process.env.SMTP_FROM || process.env.SMTP_USER || '').toLowerCase().trim();
  }

  /** Extrai o número do protocolo `[SAC-123]` do assunto, se houver. */
  private parseSacNumero(subject: string | undefined): number | null {
    const m = /\[SAC-(\d+)\]/i.exec(subject ?? '');
    return m ? Number(m[1]) : null;
  }

  /** Dedupe-key estável: Message-ID; se ausente, hash de from+subject+date. */
  private messageKey(parsed: ParsedMail): string {
    const mid = (parsed.messageId ?? '').trim();
    if (mid) return mid.slice(0, 255);
    const base = `${parsed.from?.value?.[0]?.address ?? ''}|${parsed.subject ?? ''}|${parsed.date?.toISOString() ?? ''}`;
    return 'no-msgid:' + createHash('sha1').update(base).digest('hex');
  }

  /** Detecta auto-resposta / bounce (anti-loop) pelos cabeçalhos. */
  private isAutoSubmitted(parsed: ParsedMail, fromAddr: string): { auto: boolean; motivo?: string } {
    const h = parsed.headers;
    const autoSub = String(h.get('auto-submitted') ?? '').toLowerCase();
    if (autoSub && autoSub !== 'no') return { auto: true, motivo: `Auto-Submitted: ${autoSub}` };
    if (h.has('x-auto-response-suppress')) return { auto: true, motivo: 'X-Auto-Response-Suppress' };
    const prec = String(h.get('precedence') ?? '').toLowerCase();
    if (['bulk', 'auto_reply', 'junk'].includes(prec)) return { auto: true, motivo: `Precedence: ${prec}` };
    if (!fromAddr || /(mailer-daemon|postmaster|no-?reply)@/i.test(fromAddr)) {
      return { auto: true, motivo: 'remetente automático/bounce' };
    }
    return { auto: false };
  }

  /**
   * Busca as mensagens NÃO-LIDAS, classifica cada uma (dedupe + anti-loop +
   * matching por [SAC-n]) e LOGA o resultado. NÃO cria histórico no chamado —
   * isso é a 3c. Marca as processadas como lidas. Nunca lança.
   */
  async buscarAgora(): Promise<{
    ok: boolean;
    error?: string;
    resumo?: { buscados: number; matched: number; unmatched: number; skippedAuto: number; skippedOwn: number; duplicate: number; erro: number; capped: boolean };
  }> {
    const info = this.conexaoInfo();
    if (!info.configurada) {
      return { ok: false, error: 'Conexão IMAP não configurada no ambiente (SAC_IMAP_HOST/USER/PASSWORD).' };
    }
    // Obs.: o "Buscar agora" é uma ação MANUAL do admin — NÃO respeita o
    // pauseSync (freio de mão), que governa só o poller automático (3d). Quem
    // clica quer buscar agora, mesmo com o automático pausado.
    const row = await this.getConfigRow();

    // 3c — autor dos comentários de entrada. Sem ele não dá pra ingerir os
    // MATCHED (FK NOT NULL). Falha o ciclo com mensagem clara (nada é tocado).
    const sistemaId = await this.getSistemaSacUserId();
    if (!sistemaId) {
      return { ok: false, error: 'Usuário de sistema do SAC ausente — rode o seed do auth-gateway (cria "sistema_sac").' };
    }

    const folder = row.mailboxFolder || 'INBOX';
    const MAX = 50; // teto por ciclo — o excedente fica pro próximo (logado).
    const resumo = { buscados: 0, matched: 0, unmatched: 0, skippedAuto: 0, skippedOwn: 0, duplicate: 0, erro: 0, capped: false };
    const client = this.buildClient();
    try {
      await client.connect();
      const lock = await client.getMailboxLock(folder);
      try {
        const uids = (await client.search({ seen: false }, { uid: true })) || [];
        const slice = uids.slice(0, MAX);
        resumo.capped = uids.length > MAX;
        for (const uid of slice) {
          resumo.buscados++;
          try {
            const msg = await client.fetchOne(uid, { source: true }, { uid: true });
            const parsed = await simpleParser((msg as { source: Buffer }).source);
            const key = this.messageKey(parsed);

            // Dedupe: já processado → conta e segue (sem nova linha).
            const ja = await this.prisma.sacEmailIngestao.findUnique({ where: { messageId: key }, select: { id: true } });
            if (ja) {
              resumo.duplicate++;
            } else {
              const r = await this.classificar(parsed);
              let resultado = r.resultado as 'MATCHED' | 'UNMATCHED' | 'SKIPPED_AUTO' | 'SKIPPED_OWN' | 'ERROR';
              let motivo = r.motivo;

              // 3c — MATCHED entra no chamado (comentário público + anexos +
              // notifica). Falha na ingestão vira ERROR (visível no log).
              if (r.resultado === 'MATCHED' && r.chamadoId) {
                try {
                  const ing = await this.ingerirNoChamado(r.chamadoId, parsed, sistemaId);
                  motivo = `comentário criado${ing.anexos ? ` (+${ing.anexos} anexo[s])` : ''}`;
                } catch (err) {
                  resultado = 'ERROR';
                  motivo = `falha ao ingerir no chamado: ${(err as Error).message}`;
                }
              }

              await this.prisma.sacEmailIngestao.create({
                data: {
                  messageId: key,
                  fromAddr: parsed.from?.value?.[0]?.address ?? null,
                  subject: (parsed.subject ?? '').slice(0, 500) || null,
                  sacNumero: r.sacNumero,
                  chamadoId: r.chamadoId,
                  resultado,
                  motivo,
                  recebidoEm: parsed.date ?? null,
                },
              });
              if (resultado === 'MATCHED') resumo.matched++;
              else if (resultado === 'UNMATCHED') resumo.unmatched++;
              else if (resultado === 'SKIPPED_AUTO') resumo.skippedAuto++;
              else if (resultado === 'SKIPPED_OWN') resumo.skippedOwn++;
              else if (resultado === 'ERROR') resumo.erro++;
            }
          } catch (err) {
            resumo.erro++;
            this.logger.warn(`SAC ingestão: falha no uid ${uid}: ${(err as Error).message}`);
          } finally {
            // Marca como lida pra não reaparecer (o dedupe é a garantia real).
            try {
              await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
            } catch {
              /* ignora */
            }
          }
        }
      } finally {
        lock.release();
      }

      const novos = resumo.matched + resumo.unmatched + resumo.skippedAuto + resumo.skippedOwn + resumo.erro;
      await this.prisma.sacEmailConfig.update({
        where: { id: 1 },
        data: {
          lastPollAt: new Date(),
          lastStatus: `${resumo.buscados} buscado(s): ${resumo.matched} casado(s), ${resumo.unmatched} triagem, ${resumo.skippedAuto + resumo.skippedOwn} ignorado(s), ${resumo.duplicate} dup` + (resumo.capped ? ` (teto ${MAX})` : ''),
          lastError: null,
          processadosTotal: { increment: novos },
        },
      });
      return { ok: true, resumo };
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.warn(`SAC buscarAgora falhou (${folder}): ${msg}`);
      await this.prisma.sacEmailConfig.update({ where: { id: 1 }, data: { lastPollAt: new Date(), lastError: msg } }).catch(() => undefined);
      return { ok: false, error: msg };
    } finally {
      try {
        await client.logout();
      } catch {
        /* ignora */
      }
    }
  }

  /** Classifica uma mensagem (sem efeitos colaterais no chamado). */
  private async classificar(parsed: ParsedMail): Promise<{
    resultado: 'MATCHED' | 'UNMATCHED' | 'SKIPPED_AUTO' | 'SKIPPED_OWN';
    motivo?: string;
    sacNumero: number | null;
    chamadoId: string | null;
  }> {
    const fromAddr = (parsed.from?.value?.[0]?.address ?? '').toLowerCase().trim();

    if (fromAddr && fromAddr === this.ownFrom()) {
      return { resultado: 'SKIPPED_OWN', motivo: 'veio do próprio remetente do SAC', sacNumero: null, chamadoId: null };
    }
    const auto = this.isAutoSubmitted(parsed, fromAddr);
    if (auto.auto) return { resultado: 'SKIPPED_AUTO', motivo: auto.motivo, sacNumero: null, chamadoId: null };

    const numero = this.parseSacNumero(parsed.subject);
    if (numero == null) {
      return { resultado: 'UNMATCHED', motivo: 'sem protocolo [SAC-n] no assunto', sacNumero: null, chamadoId: null };
    }
    const chamado = await this.prisma.chamado.findUnique({ where: { numero }, select: { id: true, equipeAtualId: true } });
    if (!chamado) {
      return { resultado: 'UNMATCHED', motivo: `chamado nº ${numero} inexistente`, sacNumero: numero, chamadoId: null };
    }
    // Só threada em chamados que SÃO de SAC (equipe atendeSac) — evita injetar
    // comentário num chamado normal via [SAC-n] forjado/equivocado.
    const equipe = chamado.equipeAtualId
      ? await this.prisma.equipe.findUnique({ where: { id: chamado.equipeAtualId }, select: { atendeSac: true } })
      : null;
    if (!equipe?.atendeSac) {
      return { resultado: 'UNMATCHED', motivo: `nº ${numero} não é um chamado de SAC`, sacNumero: numero, chamadoId: null };
    }
    return { resultado: 'MATCHED', motivo: undefined, sacNumero: numero, chamadoId: chamado.id };
  }

  /** Texto do corpo do e-mail (prefere text/plain; senão tira tags do HTML). */
  private corpoDoEmail(parsed: ParsedMail): string {
    const txt = (parsed.text ?? '').trim();
    if (txt) return txt.slice(0, 5000);
    const html = parsed.html || '';
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>(?=)/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim()
      .slice(0, 5000);
  }

  /**
   * 3c — registra o e-mail do cliente NO chamado: comentário público (autoria
   * do usuário de sistema), anexos (whitelist + 10MB) e notifica o técnico.
   * NÃO altera o status (sem reabrir automático — decisão de 3d/Fase 4).
   */
  private async ingerirNoChamado(
    chamadoId: string,
    parsed: ParsedMail,
    sistemaId: string,
  ): Promise<{ anexos: number }> {
    const chamado = await this.prisma.chamado.findUnique({
      where: { id: chamadoId },
      select: { id: true, numero: true, tecnicoId: true },
    });
    if (!chamado) throw new Error('chamado sumiu durante a ingestão');

    const fromAddr = parsed.from?.value?.[0]?.address ?? 'desconhecido';
    const corpo = this.corpoDoEmail(parsed) || '(sem corpo)';

    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'COMENTARIO',
        descricao: `📨 Cliente (${fromAddr}) respondeu por e-mail:\n${corpo}`,
        publico: true,
        chamadoId,
        usuarioId: sistemaId,
      },
    });

    // Anexos do e-mail → AnexoChamado (mesma whitelist/teto do chamado).
    let anexos = 0;
    const MAX_BYTES = 10 * 1024 * 1024;
    for (const att of parsed.attachments ?? []) {
      const originalname = att.filename || 'anexo';
      const mimetype = att.contentType || 'application/octet-stream';
      const buf = att.content;
      if (!buf || buf.length === 0 || buf.length > MAX_BYTES) continue;
      if (!isAnexoPermitido({ mimetype, originalname })) continue;
      try {
        if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        const nomeArquivo = `${randomUUID()}${path.extname(originalname)}`;
        fs.writeFileSync(path.join(UPLOADS_DIR, nomeArquivo), buf);
        await this.prisma.anexoChamado.create({
          data: {
            nomeOriginal: originalname,
            nomeArquivo,
            mimeType: mimetype,
            tamanho: buf.length,
            descricao: 'Anexo recebido do cliente (SAC e-mail)',
            chamadoId,
            usuarioId: sistemaId,
          },
        });
        anexos++;
      } catch (err) {
        this.logger.warn(`SAC: anexo "${originalname}" não pôde ser salvo: ${(err as Error).message}`);
      }
    }

    // Notifica o técnico responsável (se houver) — não é o usuário de sistema.
    if (chamado.tecnicoId && chamado.tecnicoId !== sistemaId) {
      await this.notificacao
        .criarParaUsuario(
          chamado.tecnicoId,
          'CHAMADO_ATUALIZADO',
          `SAC #${chamado.numero}: cliente respondeu por e-mail`,
          corpo.slice(0, 200),
          { chamadoId },
        )
        .catch(() => undefined);
    }

    return { anexos };
  }

  /** Últimas ingestões (log da tela). */
  async listarIngestoes(limit = 50) {
    return this.prisma.sacEmailIngestao.findMany({
      orderBy: { processadoEm: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }
}
