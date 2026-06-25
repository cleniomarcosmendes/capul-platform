import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
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
    // Validação do certificado TLS. Default true (seguro). Setar
    // SAC_IMAP_TLS_REJECT_UNAUTHORIZED=false quando o servidor IMAP apresenta
    // cert que não bate com o hostname (ex.: imap.capul.com.br servido com cert
    // *.vertip.net do provedor) — mesma lógica do SMTP_TLS_REJECT_UNAUTHORIZED do e-mail.
    const rejectUnauthorized = (process.env.SAC_IMAP_TLS_REJECT_UNAUTHORIZED ?? 'true') !== 'false';
    return {
      origem: 'ambiente' as const,
      host: host || null,
      port,
      user: user || null,
      secure,
      rejectUnauthorized,
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
      // tls.rejectUnauthorized=false permite cert que não bate com o hostname
      // (provedor serve *.vertip.net em imap.capul.com.br). Ver conexaoInfo().
      tls: { rejectUnauthorized: info.rejectUnauthorized },
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
    if (!m) return null;
    const n = Number(m[1]);
    // chamado.numero é Int4 — um número forjado/gigante faria o Prisma estourar
    // (e o e-mail seria perdido). Fora da faixa → trata como sem-match (triagem).
    if (!Number.isSafeInteger(n) || n < 1 || n > 2_147_483_647) return null;
    return n;
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
          // Só marca \Seen quando a mensagem foi REGISTRADA (linha de ingestão
          // criada) ou confirmada duplicada — nunca num erro transitório, senão
          // o e-mail do cliente sumiria (lido e sem registro → nunca reprocessa).
          let tratado = false;
          try {
            const msg = await client.fetchOne(uid, { source: true }, { uid: true });
            const source = msg && (msg as { source?: Buffer }).source;
            if (!source) {
              // Sumiu/movida entre o search e o fetch — re-tenta no próximo ciclo.
              this.logger.warn(`SAC ingestão: uid ${uid} sem conteúdo (movida/expurgada?) — re-tenta`);
            } else {
              const parsed = await simpleParser(source);
              const key = this.messageKey(parsed);

              const ja = await this.prisma.sacEmailIngestao.findUnique({ where: { messageId: key }, select: { id: true } });
              if (ja) {
                resumo.duplicate++;
                tratado = true;
              } else {
                const r = await this.classificar(parsed);
                // SEGURANÇA: e-mail do cliente COM anexo SEMPRE passa por triagem
                // (revisão do anexo antes de entrar), inclusive resposta a chamado
                // existente (MATCHED). Sem anexo, MATCHED entra direto no chamado.
                const temAnexo = (parsed.attachments ?? []).length > 0;
                const ehTriagem = r.resultado === 'UNMATCHED' || (r.resultado === 'MATCHED' && temAnexo);

                // Reivindica o messageId PRIMEIRO (constraint unique = dedupe
                // atômico) — antes dos efeitos colaterais, pra um "Buscar agora"
                // concorrente com o poller não duplicar comentário/anexos.
                let nova: { id: string } | null = null;
                try {
                  nova = await this.prisma.sacEmailIngestao.create({
                    data: {
                      messageId: key,
                      fromAddr: parsed.from?.value?.[0]?.address ?? null,
                      subject: (parsed.subject ?? '').slice(0, 500) || null,
                      // Mantém sacNumero/chamadoId mesmo na triagem (MATCHED+anexo)
                      // → a triagem já sugere o chamado-alvo no "Vincular".
                      sacNumero: r.sacNumero,
                      chamadoId: r.chamadoId,
                      // Em triagem o resultado fica UNMATCHED até o operador vincular
                      // (mesmo sabendo o nº) — semântica limpa p/ a fila de triagem.
                      resultado: ehTriagem ? 'UNMATCHED' : r.resultado,
                      motivo: r.motivo,
                      recebidoEm: parsed.date ?? null,
                      corpoTexto: ehTriagem ? this.corpoDoEmail(parsed) || null : null,
                      triagemStatus: ehTriagem ? 'PENDENTE' : null,
                    },
                    select: { id: true },
                  });
                } catch (err) {
                  // Corrida: outro ciclo já reivindicou o messageId (unique) → dup.
                  if ((err as { code?: string }).code === 'P2002') {
                    resumo.duplicate++;
                    tratado = true;
                  } else {
                    throw err;
                  }
                }

                if (nova) {
                  // Donos do messageId — efeitos colaterais agora são seguros.
                  // Na triagem (UNMATCHED ou MATCHED+anexo) o resultado fica UNMATCHED.
                  let resultado = (ehTriagem ? 'UNMATCHED' : r.resultado) as 'MATCHED' | 'UNMATCHED' | 'SKIPPED_AUTO' | 'SKIPPED_OWN' | 'ERROR';
                  let motivo = r.motivo;
                  if (ehTriagem) {
                    // Anexo do cliente fica em QUARENTENA p/ revisão na triagem.
                    await this.salvarAnexosTriagem(nova.id, parsed);
                    if (r.resultado === 'MATCHED') {
                      motivo = `resposta ao chamado #${r.sacNumero} com anexo → enviada à TRIAGEM (revisão de segurança)`;
                      await this.prisma.sacEmailIngestao.update({ where: { id: nova.id }, data: { motivo } });
                    }
                  } else if (r.resultado === 'MATCHED' && r.chamadoId) {
                    // Resposta SEM anexo → entra direto no chamado (baixo risco).
                    try {
                      await this.ingerirNoChamado(r.chamadoId, parsed, sistemaId);
                      motivo = 'comentário criado';
                    } catch (err) {
                      resultado = 'ERROR';
                      motivo = `falha ao ingerir no chamado: ${(err as Error).message}`;
                    }
                    await this.prisma.sacEmailIngestao.update({ where: { id: nova.id }, data: { resultado, motivo } });
                  }
                  if (resultado === 'MATCHED') resumo.matched++;
                  else if (resultado === 'UNMATCHED') resumo.unmatched++;
                  else if (resultado === 'SKIPPED_AUTO') resumo.skippedAuto++;
                  else if (resultado === 'SKIPPED_OWN') resumo.skippedOwn++;
                  else if (resultado === 'ERROR') resumo.erro++;
                  tratado = true;
                }
              }
            }
          } catch (err) {
            resumo.erro++;
            this.logger.warn(`SAC ingestão: falha no uid ${uid}: ${(err as Error).message}`);
            // tratado=false → NÃO marca lida → re-tenta no próximo ciclo.
          }
          if (tratado) {
            try {
              await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
            } catch {
              /* ignora — o dedupe garante que não reprocessa */
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
    const bruto = txt || (parsed.html || '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>(?=)/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
    return this.extrairRespostaNova(bruto).slice(0, 5000);
  }

  /**
   * Mantém só a RESPOSTA NOVA do cliente — corta o histórico citado (linhas `>`,
   * "Em <data> … escreveu:" / "On … wrote:", "Mensagem original", separador do
   * Outlook) e a assinatura (delimitador `-- `). Heurística: corta na 1ª marca
   * de citação encontrada. Salvaguarda: se sobrar vazio, devolve o texto bruto
   * (melhor texto a mais que perder a resposta).
   */
  private extrairRespostaNova(texto: string): string {
    if (!texto) return texto;
    const linhas = texto.replace(/\r\n/g, '\n').split('\n');
    const marcas = [
      /^\s*Em\s.+escreveu:\s*$/i,                              // PT-BR Gmail
      /^\s*On\s.+wrote:\s*$/i,                                 // EN Gmail
      /^\s*-{2,}\s*(Mensagem original|Original Message)\s*-{2,}/i,
      /^\s*_{10,}\s*$/,                                        // separador Outlook
      /^\s*>+/,                                                // linha citada
    ];
    let corte = linhas.length;
    for (let i = 0; i < linhas.length; i++) {
      if (marcas.some((re) => re.test(linhas[i]!))) { corte = i; break; }
    }
    let res = linhas.slice(0, corte);
    // Assinatura: tudo após a linha "-- " (delimitador RFC 3676).
    const sig = res.findIndex((l) => /^--\s*$/.test(l));
    if (sig >= 0) res = res.slice(0, sig);
    const limpo = res.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return limpo || texto.trim();
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

    // Só chega aqui resposta SEM anexo (com anexo vai pra triagem — segurança).
    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'COMENTARIO',
        descricao: `📨 Cliente (${fromAddr}) respondeu por e-mail:\n${corpo}`,
        publico: true,
        chamadoId,
        usuarioId: sistemaId,
      },
    });

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

    return { anexos: 0 };
  }

  /** Valida (whitelist + 10MB) e grava um buffer no UPLOADS_DIR. null se inválido. */
  private gravarAnexoBuffer(originalname: string, mimetype: string, buf: Buffer | undefined): { nomeArquivo: string } | null {
    const MAX_BYTES = 10 * 1024 * 1024;
    if (!buf || buf.length === 0 || buf.length > MAX_BYTES) return null;
    if (!isAnexoPermitido({ mimetype, originalname })) return null;
    try {
      if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      const nomeArquivo = `${randomUUID()}${path.extname(originalname)}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, nomeArquivo), buf);
      return { nomeArquivo };
    } catch (err) {
      this.logger.warn(`SAC: anexo "${originalname}" não pôde ser salvo: ${(err as Error).message}`);
      return null;
    }
  }

  /** Preserva os anexos de um e-mail UNMATCHED (pra carregar pro chamado na triagem). */
  private async salvarAnexosTriagem(ingestaoId: string, parsed: ParsedMail): Promise<void> {
    for (const att of parsed.attachments ?? []) {
      const originalname = att.filename || 'anexo';
      const mimetype = att.contentType || 'application/octet-stream';
      const g = this.gravarAnexoBuffer(originalname, mimetype, att.content);
      if (!g) continue;
      await this.prisma.sacEmailAnexo.create({
        data: { ingestaoId, nomeOriginal: originalname, nomeArquivo: g.nomeArquivo, mimeType: mimetype, tamanho: att.content.length },
      });
    }
  }

  // ===== SAC Fase 4a — Caixa de Triagem (UNMATCHED) =====

  /** Lista os e-mails pendentes de triagem (UNMATCHED ainda não tratados). */
  async listarTriagem() {
    return this.prisma.sacEmailIngestao.findMany({
      where: { triagemStatus: 'PENDENTE' },
      include: { anexos: { select: { id: true, nomeOriginal: true, mimeType: true, tamanho: true } } },
      orderBy: { processadoEm: 'desc' },
      take: 200,
    });
  }

  /**
   * Vincula um e-mail de triagem a um chamado de SAC existente: cria o comentário
   * (corpo preservado, autoria do usuário-sistema) + leva os anexos preservados
   * pro chamado e marca a triagem como RESOLVIDA.
   */
  async vincularTriagem(ingestaoId: string, numero: number, userId: string, incluirAnexos = false) {
    const ing = await this.prisma.sacEmailIngestao.findUnique({
      where: { id: ingestaoId },
      include: { anexos: true },
    });
    if (!ing) throw new NotFoundException('Item de triagem não encontrado.');
    if (ing.triagemStatus !== 'PENDENTE') throw new BadRequestException('Este item já foi tratado.');

    const chamado = await this.prisma.chamado.findUnique({ where: { numero }, select: { id: true, equipeAtualId: true } });
    if (!chamado) throw new BadRequestException(`Chamado nº ${numero} inexistente.`);
    const equipe = chamado.equipeAtualId
      ? await this.prisma.equipe.findUnique({ where: { id: chamado.equipeAtualId }, select: { atendeSac: true } })
      : null;
    if (!equipe?.atendeSac) throw new BadRequestException(`Chamado nº ${numero} não é de uma equipe de SAC.`);

    const sistemaId = await this.getSistemaSacUserId();
    if (!sistemaId) throw new BadRequestException('Usuário de sistema do SAC ausente — rode o seed.');

    // Anexos: SÓ entram no chamado se o operador marcar "incluir" (revisão de
    // segurança). Default = NÃO incluir (ficam na quarentena, ligados à ingestão).
    const nA = (ing.anexos ?? []).length;
    const notaAnexo = nA === 0 ? '' : incluirAnexos
      ? `\n📎 ${nA} anexo(s) do cliente INCLUÍDO(S) no chamado pelo atendente.`
      : `\n📎 ${nA} anexo(s) do cliente NÃO incluído(s) (mantidos em quarentena — externo, não verificado).`;

    const corpo = (ing.corpoTexto ?? '').trim() || '(sem corpo)';
    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'COMENTARIO',
        descricao: `📨 Cliente (${ing.fromAddr ?? 'desconhecido'}) respondeu por e-mail (via triagem):\n${corpo}${notaAnexo}`,
        publico: true,
        chamadoId: chamado.id,
        usuarioId: sistemaId,
      },
    });
    let anexosIncluidos = 0;
    if (incluirAnexos) {
      for (const a of ing.anexos ?? []) {
        await this.prisma.anexoChamado.create({
          data: {
            nomeOriginal: a.nomeOriginal,
            nomeArquivo: a.nomeArquivo,
            mimeType: a.mimeType,
            tamanho: a.tamanho,
            descricao: 'Anexo do cliente (SAC e-mail — incluído na triagem)',
            chamadoId: chamado.id,
            usuarioId: sistemaId,
          },
        });
        anexosIncluidos++;
      }
    }
    await this.prisma.sacEmailIngestao.update({
      where: { id: ingestaoId },
      data: { triagemStatus: 'RESOLVIDO', triadoEm: new Date(), triadoPor: userId, chamadoVinculadoId: chamado.id, resultado: 'MATCHED', chamadoId: chamado.id },
    });
    return { ok: true, chamadoId: chamado.id, anexos: anexosIncluidos, anexosQuarentena: incluirAnexos ? 0 : nA };
  }

  /** Equipes de ATENDIMENTO ao SAC (atendeSac) — opções do "abrir novo chamado". */
  async listarEquipesSac() {
    return this.prisma.equipe.findMany({
      where: { atendeSac: true, status: 'ATIVO' },
      select: { id: true, nome: true, sigla: true, departamentoId: true },
      orderBy: { nome: 'asc' },
    });
  }

  /**
   * Abre um NOVO chamado de SAC a partir de um e-mail de triagem (contato novo
   * sem chamado). Solicitante = usuário-sistema; corpo do e-mail vira a descrição;
   * anexos preservados entram no chamado. Marca a triagem como RESOLVIDA.
   */
  async abrirTriagem(ingestaoId: string, equipeId: string, userId: string, filialId: string, incluirAnexos = false) {
    const ing = await this.prisma.sacEmailIngestao.findUnique({ where: { id: ingestaoId }, include: { anexos: true } });
    if (!ing) throw new NotFoundException('Item de triagem não encontrado.');
    if (ing.triagemStatus !== 'PENDENTE') throw new BadRequestException('Este item já foi tratado.');
    if (!filialId) throw new BadRequestException('Operador sem filial — não dá para abrir o chamado.');

    const equipe = await this.prisma.equipe.findUnique({ where: { id: equipeId }, select: { id: true, departamentoId: true, atendeSac: true, status: true } });
    if (!equipe || equipe.status !== 'ATIVO') throw new BadRequestException('Equipe inválida.');
    if (!equipe.atendeSac) throw new BadRequestException('A equipe escolhida não é de atendimento ao SAC.');

    const sistemaId = await this.getSistemaSacUserId();
    if (!sistemaId) throw new BadRequestException('Usuário de sistema do SAC ausente — rode o seed.');

    // SLA (4d): mesmo lookup do create normal — por equipe + prioridade (MEDIA).
    // Sem SLA cadastrada pra equipe, fica sem prazo (igual chamado sem SLA).
    const sla = await this.prisma.slaDefinicao.findUnique({
      where: { equipeId_prioridade: { equipeId: equipe.id, prioridade: 'MEDIA' } },
      select: { id: true, horasResolucao: true },
    });
    const dataLimiteSla = sla ? new Date(Date.now() + sla.horasResolucao * 3_600_000) : null;

    const chamado = await this.prisma.chamado.create({
      data: {
        titulo: (ing.subject ?? '').slice(0, 200) || 'SAC por e-mail',
        descricao: (ing.corpoTexto ?? '').trim() || '(sem corpo)',
        prioridade: 'MEDIA',
        solicitanteId: sistemaId,
        equipeAtualId: equipe.id,
        departamentoId: equipe.departamentoId,
        filialId,
        clienteEmail: ing.fromAddr,
        canalOrigem: 'EMAIL',
        slaDefinicaoId: sla?.id ?? null,
        dataLimiteSla,
      },
      select: { id: true, numero: true },
    });

    const anexosIng = ing.anexos ?? [];
    const nA = anexosIng.length;
    const notaAnexo = nA === 0 ? '' : incluirAnexos
      ? ` ${nA} anexo(s) do cliente incluído(s).`
      : ` ${nA} anexo(s) do cliente em quarentena (não incluídos — externo, não verificado).`;
    await this.prisma.historicoChamado.create({
      data: {
        tipo: 'ABERTURA',
        descricao: `Chamado de SAC aberto a partir de e-mail de ${ing.fromAddr ?? 'desconhecido'} (triagem).${notaAnexo}`,
        publico: true,
        chamadoId: chamado.id,
        usuarioId: sistemaId,
      },
    });

    let anexosIncluidos = 0;
    if (incluirAnexos) {
      for (const a of ing.anexos ?? []) {
        await this.prisma.anexoChamado.create({
          data: {
            nomeOriginal: a.nomeOriginal,
            nomeArquivo: a.nomeArquivo,
            mimeType: a.mimeType,
            tamanho: a.tamanho,
            descricao: 'Anexo do cliente (SAC e-mail — incluído na triagem)',
            chamadoId: chamado.id,
            usuarioId: sistemaId,
          },
        });
        anexosIncluidos++;
      }
    }

    await this.prisma.sacEmailIngestao.update({
      where: { id: ingestaoId },
      data: { triagemStatus: 'RESOLVIDO', triadoEm: new Date(), triadoPor: userId, chamadoVinculadoId: chamado.id, resultado: 'MATCHED', chamadoId: chamado.id, sacNumero: chamado.numero },
    });
    return { ok: true, chamadoId: chamado.id, numero: chamado.numero, anexos: anexosIncluidos, anexosQuarentena: incluirAnexos ? 0 : nA };
  }

  /** Descarta um e-mail de triagem (spam/irrelevante). */
  async descartarTriagem(ingestaoId: string, userId: string) {
    const ing = await this.prisma.sacEmailIngestao.findUnique({ where: { id: ingestaoId }, select: { id: true, triagemStatus: true } });
    if (!ing) throw new NotFoundException('Item de triagem não encontrado.');
    if (ing.triagemStatus !== 'PENDENTE') throw new BadRequestException('Este item já foi tratado.');
    await this.prisma.sacEmailIngestao.update({
      where: { id: ingestaoId },
      data: { triagemStatus: 'DESCARTADO', triadoEm: new Date(), triadoPor: userId },
    });
    return { ok: true };
  }

  // ===== SAC Fase 3d — poller AUTOMÁTICO (supervisionado) =====

  private polling = false;

  /**
   * Decide se o ciclo automático deve rodar agora. Respeita enabled + pauseSync
   * + conexão configurada, e o intervalo desde o último poll. Puro/testável.
   */
  deveAgendar(
    row: { enabled: boolean; pauseSync: boolean; pollIntervalMinutes: number; lastPollAt: Date | null },
    configurada: boolean,
    agoraMs: number,
  ): boolean {
    if (!configurada || !row.enabled || row.pauseSync) return false;
    if (!row.lastPollAt) return true; // nunca rodou
    const intervaloMs = Math.max(1, row.pollIntervalMinutes) * 60_000;
    return agoraMs - new Date(row.lastPollAt).getTime() >= intervaloMs;
  }

  /**
   * Tick de 1 min: dispara o buscarAgora quando dá o intervalo configurado e o
   * automático está ligado e não pausado. Diferente do "Buscar agora" manual,
   * AQUI o freio de mão (pauseSync) e o enabled valem. Guarda contra sobreposição.
   */
  @Interval(60_000)
  async pollAgendado(): Promise<void> {
    if (this.polling) return;
    try {
      const row = await this.getConfigRow();
      const info = this.conexaoInfo();
      if (!this.deveAgendar(row, info.configurada, Date.now())) return;
      this.polling = true;
      this.logger.log(`SAC poll automático disparando (intervalo ${row.pollIntervalMinutes} min)`);
      const r = await this.buscarAgora();
      if (!r.ok) this.logger.warn(`SAC poll automático: ${r.error}`);
    } catch (err) {
      this.logger.warn(`SAC poll automático falhou: ${(err as Error).message}`);
    } finally {
      this.polling = false;
    }
  }

  /** Últimas ingestões (log da tela). */
  async listarIngestoes(limit = 50) {
    return this.prisma.sacEmailIngestao.findMany({
      orderBy: { processadoEm: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }
}
