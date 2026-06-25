import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { StatusChamado } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailEnvolvidosService } from '../email/email-envolvidos.service.js';

/** Status não-finalizados que entram na varredura (AGRUPADO fica fora — SLA pausado). */
const ATIVOS: StatusChamado[] = ['ABERTO', 'EM_ATENDIMENTO', 'PENDENTE', 'PENDENTE_USUARIO', 'REABERTO'];
const DIA_MS = 86_400_000;
// Emissor sentinela (não é usuário real) — o EmailEnvolvidos só o usa pra remover
// o emissor da lista de destinatários; aqui não há emissor humano.
const SISTEMA = '__sistema_lembrete__';

export interface ResumoVarredura {
  ok: boolean;
  dryRun: boolean;
  motivo?: string;
  lembrarTecnico: number[];
  lembrarSolicitante: number[];
  lembrarClienteSac: number[];
  escalados: number[];
  fechados: number[];
  semDestino: number;
}

@Injectable()
export class ChamadoLembreteService {
  private readonly logger = new Logger(ChamadoLembreteService.name);
  private rodando = false;
  private sistemaUserId: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailEnvolvidosService,
  ) {}

  async getConfigRow() {
    return this.prisma.chamadoLembreteConfig.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  }

  async atualizarConfig(
    dto: Partial<{
      enabled: boolean; diasInatividadeEquipe: number; diasInatividadeSolicitante: number;
      diasEscala: number; intervaloReenvioDias: number; maxLembretes: number;
      autoFechar: boolean; diasAutoFechamento: number; horaExecucao: number;
    }>,
    userId: string,
  ) {
    await this.getConfigRow();
    const data: Record<string, unknown> = { updatedBy: userId };
    for (const k of ['enabled', 'diasInatividadeEquipe', 'diasInatividadeSolicitante', 'diasEscala',
      'intervaloReenvioDias', 'maxLembretes', 'autoFechar', 'diasAutoFechamento', 'horaExecucao'] as const) {
      if (dto[k] !== undefined) data[k] = dto[k];
    }
    return this.prisma.chamadoLembreteConfig.update({ where: { id: 1 }, data });
  }

  /** Autor dos históricos automáticos (reusa o usuário de sistema do SAC). */
  private async getSistemaUserId(): Promise<string | null> {
    if (this.sistemaUserId) return this.sistemaUserId;
    const u = await this.prisma.usuario.findFirst({ where: { username: 'sistema_sac' }, select: { id: true } });
    this.sistemaUserId = u?.id ?? null;
    return this.sistemaUserId;
  }

  // ===== Agendador: 1 tick/hora; roda a varredura 1x/dia na hora configurada =====
  @Interval(3_600_000)
  async tickHorario(): Promise<void> {
    if (this.rodando) return;
    try {
      const cfg = await this.getConfigRow();
      if (!cfg.enabled) return;
      const agora = new Date();
      if (agora.getHours() !== cfg.horaExecucao) return;
      // Já rodou hoje? (compara a data do lastRunAt)
      if (cfg.lastRunAt && cfg.lastRunAt.toDateString() === agora.toDateString()) return;
      await this.executarVarredura({ dryRun: false });
    } catch (err) {
      this.logger.warn(`Varredura de lembretes falhou: ${(err as Error).message}`);
    }
  }

  /**
   * Varre os chamados não-finalizados e, conforme quem está segurando o chamado:
   *  - PENDENTE_USUARIO parado ≥ X dias → lembra o SOLICITANTE; após os lembretes
   *    sem resposta, FECHA por inatividade (se autoFechar).
   *  - demais ativos parados ≥ Y dias → lembra o TÉCNICO; ao passar do limiar de
   *    escala (ou SLA estourado), avisa também a EQUIPE.
   * `dryRun` calcula e retorna o resumo SEM enviar e-mail / fechar / gravar.
   */
  async executarVarredura(opts: { dryRun?: boolean } = {}): Promise<ResumoVarredura> {
    const dryRun = !!opts.dryRun;
    const cfg = await this.getConfigRow();
    const r: ResumoVarredura = {
      ok: true, dryRun, lembrarTecnico: [], lembrarSolicitante: [], lembrarClienteSac: [],
      escalados: [], fechados: [], semDestino: 0,
    };
    if (!cfg.enabled && !dryRun) return { ...r, ok: false, motivo: 'desabilitado' };

    if (this.rodando && !dryRun) return { ...r, ok: false, motivo: 'já em execução' };
    if (!dryRun) this.rodando = true;
    try {
      const agora = new Date();
      const chamados = await this.prisma.chamado.findMany({
        where: { status: { in: ATIVOS } },
        select: {
          id: true, numero: true, titulo: true, status: true, updatedAt: true,
          ultimoLembreteEm: true, lembretesEnviados: true, dataLimiteSla: true,
          tecnicoId: true, solicitanteId: true, clienteEmail: true,
          solicitante: { select: { id: true, email: true } },
          equipeAtual: { select: { atendeSac: true, membros: { select: { usuarioId: true } } } },
        },
      });
      if (chamados.length === 0) return await this.finalizar(r, cfg.id, dryRun);

      // Última interação = max(createdAt) dos históricos do chamado.
      const ids = chamados.map((c) => c.id);
      const ultimos = await this.prisma.historicoChamado.groupBy({
        by: ['chamadoId'], where: { chamadoId: { in: ids } }, _max: { createdAt: true },
      });
      const ultimaPorId = new Map(ultimos.map((u) => [u.chamadoId, u._max.createdAt]));

      const podeReenviar = (ultimo: Date | null) =>
        !ultimo || (agora.getTime() - ultimo.getTime()) / DIA_MS >= cfg.intervaloReenvioDias;

      for (const c of chamados) {
        const ultima = ultimaPorId.get(c.id) ?? c.updatedAt;
        const diasParado = (agora.getTime() - ultima.getTime()) / DIA_MS;

        // SAC = chamado de equipe atendeSac COM e-mail do cliente externo. Quando
        // aguarda o cliente (PENDENTE_USUARIO), o lembrete vai pro CLIENTE pela
        // saída própria do SAC; quando aguarda a equipe, segue o fluxo do técnico.
        const ehSac = c.equipeAtual.atendeSac && !!c.clienteEmail;

        if (c.status === 'PENDENTE_USUARIO') {
          if (diasParado < cfg.diasInatividadeSolicitante) continue;
          // Auto-fechamento: já esgotou os lembretes e passou o prazo sem resposta.
          const esgotou = c.lembretesEnviados >= cfg.maxLembretes;
          const venceuPosLembrete = c.ultimoLembreteEm
            && (agora.getTime() - c.ultimoLembreteEm.getTime()) / DIA_MS >= cfg.diasAutoFechamento;
          if (cfg.autoFechar && esgotou && venceuPosLembrete) {
            r.fechados.push(c.numero);
            if (!dryRun) await this.fecharPorInatividade(c.id, c.numero, ehSac ? c.clienteEmail : null);
            continue;
          }
          if (c.lembretesEnviados >= cfg.maxLembretes) continue;
          if (!podeReenviar(c.ultimoLembreteEm)) continue;
          if (ehSac) {
            r.lembrarClienteSac.push(c.numero);
            if (!dryRun) { await this.enviarLembreteClienteSac(c, c.clienteEmail!, Math.floor(diasParado)); await this.registrarLembrete(c.id); }
          } else {
            const destino = c.solicitante?.email ? [c.solicitanteId] : [];
            if (destino.length === 0) { r.semDestino++; continue; }
            r.lembrarSolicitante.push(c.numero);
            if (!dryRun) { await this.enviarLembrete(c, destino, 'SOLICITANTE', false, Math.floor(diasParado)); await this.registrarLembrete(c.id); }
          }
        } else {
          if (diasParado < cfg.diasInatividadeEquipe) continue;
          if (c.lembretesEnviados >= cfg.maxLembretes) continue;
          if (!podeReenviar(c.ultimoLembreteEm)) continue;
          const slaEstourado = !!c.dataLimiteSla && c.dataLimiteSla < agora;
          const escalar = diasParado >= cfg.diasEscala || slaEstourado;
          const alvo = new Set<string>();
          if (c.tecnicoId) alvo.add(c.tecnicoId);
          if (escalar) c.equipeAtual.membros.forEach((m) => alvo.add(m.usuarioId));
          if (alvo.size === 0) { r.semDestino++; continue; }
          (escalar ? r.escalados : r.lembrarTecnico).push(c.numero);
          if (!dryRun) { await this.enviarLembrete(c, [...alvo], 'EQUIPE', escalar, Math.floor(diasParado)); await this.registrarLembrete(c.id); }
        }
      }
      return await this.finalizar(r, cfg.id, dryRun);
    } finally {
      if (!dryRun) this.rodando = false;
    }
  }

  private async finalizar(r: ResumoVarredura, cfgId: number, dryRun: boolean): Promise<ResumoVarredura> {
    if (!dryRun) {
      const resumo = `lembretes técnico=${r.lembrarTecnico.length} solicitante=${r.lembrarSolicitante.length}`
        + ` clienteSac=${r.lembrarClienteSac.length} escalados=${r.escalados.length} fechados=${r.fechados.length}`;
      this.logger.log(`Varredura de lembretes: ${resumo}`);
      await this.prisma.chamadoLembreteConfig.update({
        where: { id: cfgId }, data: { lastRunAt: new Date(), lastResumo: resumo },
      });
    }
    return r;
  }

  private async enviarLembrete(
    c: { numero: number; titulo: string },
    destinatarioIds: string[],
    alvo: 'SOLICITANTE' | 'EQUIPE',
    escalado: boolean,
    diasParado: number,
  ): Promise<void> {
    const motivo = alvo === 'SOLICITANTE'
      ? `o chamado <strong>#${c.numero}</strong> aguarda a <strong>sua resposta</strong> há ${diasParado} dia(s).`
      : `o chamado <strong>#${c.numero}</strong> está parado há ${diasParado} dia(s) e aguarda atendimento${escalado ? ' (escalado à equipe — fora do prazo)' : ''}.`;
    const html = '<div style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a">'
      + `<p style="margin:0 0 12px">Lembrete: ${motivo}</p>`
      + `<p style="margin:0 0 12px"><strong>${this.esc(c.titulo)}</strong></p>`
      + '<p style="font-size:12px;color:#64748b;margin:0">Workspace — Gestão de chamados. Acesse para responder ou atualizar.</p>'
      + '</div>';
    await this.email.enviar({
      canal: 'chamados', emissorId: SISTEMA, destinatarioIds,
      subject: `[Chamado #${c.numero}] ${escalado ? 'ESCALADO — ' : ''}${alvo === 'SOLICITANTE' ? 'Aguardando sua resposta' : 'Chamado parado'}`,
      html,
    });
  }

  /**
   * Lembrete ao CLIENTE externo do SAC (PENDENTE_USUARIO). Sai pela caixa do SAC
   * (enviarExterno → sac:true) com `[SAC-n]` no assunto, então a resposta do
   * cliente volta pro poller e reativa o chamado.
   */
  private async enviarLembreteClienteSac(c: { numero: number; titulo: string }, clienteEmail: string, diasParado: number): Promise<void> {
    const html = '<div style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a">'
      + `<p style="margin:0 0 12px">Olá! O seu atendimento <strong>[SAC-${c.numero}]</strong> está aguardando a <strong>sua resposta</strong> há ${diasParado} dia(s).</p>`
      + `<p style="margin:0 0 12px"><strong>${this.esc(c.titulo)}</strong></p>`
      + '<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">'
      + `<p style="font-size:12px;color:#64748b;margin:0">CAPUL — Atendimento ao Cliente (SAC). Responda este e-mail para continuar. Sem retorno, o atendimento será encerrado por inatividade.</p>`
      + '</div>';
    await this.email.enviarExterno(clienteEmail, `[SAC-${c.numero}] ${c.titulo}`, html);
  }

  /** Marca o lembrete enviado (timestamp + contador) — anti-spam/teto. */
  private async registrarLembrete(chamadoId: string): Promise<void> {
    await this.prisma.chamado.update({
      where: { id: chamadoId },
      data: { ultimoLembreteEm: new Date(), lembretesEnviados: { increment: 1 } },
    });
  }

  private async fecharPorInatividade(chamadoId: string, numero: number, clienteEmailSac: string | null): Promise<void> {
    const sistemaId = await this.getSistemaUserId();
    if (!sistemaId) { this.logger.warn(`Auto-fechamento #${numero} pulado — usuário de sistema ausente`); return; }
    await this.prisma.$transaction([
      this.prisma.chamado.update({
        where: { id: chamadoId },
        data: { status: 'FECHADO', dataFechamento: new Date() },
      }),
      this.prisma.historicoChamado.create({
        data: {
          tipo: 'FECHADO', publico: true, chamadoId, usuarioId: sistemaId,
          descricao: '🔒 Chamado FECHADO automaticamente por inatividade (sem resposta após os lembretes).',
        },
      }),
    ]);
    // SAC: avisa o cliente do encerramento (pela caixa do SAC; pode reabrir respondendo).
    if (clienteEmailSac) {
      const html = '<div style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a">'
        + `<p style="margin:0 0 12px">O seu atendimento <strong>[SAC-${numero}]</strong> foi <strong>encerrado por inatividade</strong> (sem retorno após os lembretes).</p>`
        + `<p style="font-size:12px;color:#64748b;margin:0">CAPUL — Atendimento ao Cliente (SAC). Se ainda precisar, responda este e-mail que reabriremos o atendimento.</p></div>`;
      await this.email.enviarExterno(clienteEmailSac, `[SAC-${numero}] Atendimento encerrado por inatividade`, html);
    }
  }

  private esc(s: string): string {
    return s.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch] as string));
  }
}
