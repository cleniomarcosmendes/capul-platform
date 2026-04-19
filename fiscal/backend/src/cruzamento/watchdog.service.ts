import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailTransportService } from '../alertas/mail-transport.service.js';
import { DestinatariosResolver } from '../alertas/destinatarios.resolver.js';
import type { TipoSincronizacao } from '@prisma/client';

/**
 * Watchdog das corridas automáticas do cruzamento (Plano v2.0 §2.1).
 *
 * Executa a cada 1 hora e verifica se a última execução de cada corrida
 * automática (MOVIMENTO_MEIO_DIA e MOVIMENTO_MANHA_SEGUINTE) está dentro
 * do intervalo esperado (18h = 12h entre corridas × 1.5 buffer).
 *
 * Se uma corrida estiver atrasada, envia alerta dedicado para GESTOR_FISCAL
 * + ADMIN_TI com subject `[FISCAL] Rotina agendada atrasada`.
 *
 * Cuidados:
 *   - No go-live e primeiras 18h o watchdog pode disparar falso positivo.
 *     Por isso: se não há NENHUMA execução do tipo, não alerta (estado
 *     inicial, não atraso real).
 *   - Não alerta múltiplas vezes para o mesmo atraso: janela de supressão
 *     de 6h via tabela fiscal.audit_log.
 */
@Injectable()
export class WatchdogService {
  private readonly logger = new Logger(WatchdogService.name);
  private readonly JANELA_SUPRESSAO_MS = 6 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailTransportService,
    private readonly destinatariosResolver: DestinatariosResolver,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { timeZone: 'America/Sao_Paulo', name: 'fiscal:watchdog' })
  async verificar(): Promise<void> {
    try {
      // Plano v2.0 §2.1: 2 corridas diárias (12:00 e 06:00). Se alguma delas
      // passou mais de 18h sem rodar, algo está travado e o GESTOR_FISCAL é alertado.
      const LIMITE_18H = 18 * 60 * 60 * 1000;
      await this.verificarTipo('MOVIMENTO_MEIO_DIA', LIMITE_18H);
      await this.verificarTipo('MOVIMENTO_MANHA_SEGUINTE', LIMITE_18H);
    } catch (err) {
      this.logger.error(`Watchdog falhou: ${(err as Error).message}`);
    }
  }

  private async verificarTipo(tipo: TipoSincronizacao, limiteMs: number): Promise<void> {
    const ultima = await this.prisma.cadastroSincronizacao.findFirst({
      where: { tipo },
      orderBy: { iniciadoEm: 'desc' },
    });

    if (!ultima) {
      // Nenhuma execução ainda — provavelmente go-live recente, não alerta.
      return;
    }

    const idade = Date.now() - ultima.iniciadoEm.getTime();
    if (idade <= limiteMs) return; // dentro do esperado

    // Está atrasado. Verifica janela de supressão.
    if (await this.jaAlertadoRecentemente(tipo)) {
      this.logger.debug(`Watchdog: ${tipo} atrasado, mas alerta suprimido (ainda dentro da janela de 6h).`);
      return;
    }

    const horasAtraso = Math.round(idade / 3600_000);
    const assunto = `[FISCAL] Rotina ${tipo} atrasada (${horasAtraso}h desde a última execução)`;
    const corpo = this.buildHtmlAlerta(tipo, ultima.iniciadoEm, horasAtraso);

    const { destinatarios } = await this.destinatariosResolver.resolve();
    const emails = destinatarios.map((d) => d.email);

    const result = await this.mail.send({
      to: emails,
      subject: assunto,
      html: corpo,
      text: `Rotina ${tipo} atrasada. Última execução: ${ultima.iniciadoEm.toISOString()}.`,
    });

    await this.prisma.auditLog.create({
      data: {
        usuarioEmail: 'sistema:watchdog',
        acao: 'WATCHDOG_ALERTA',
        recurso: tipo,
        payload: {
          ultimaExecucao: ultima.iniciadoEm.toISOString(),
          horasAtraso,
          destinatarios: emails,
          enviado: result.sent,
          erro: result.error ?? null,
        },
      },
    });

    if (result.sent) {
      this.logger.warn(`Watchdog: alerta enviado — ${tipo} atrasado ${horasAtraso}h`);
    } else {
      this.logger.error(`Watchdog: alerta falhou (${result.error}) para ${tipo}`);
    }
  }

  private async jaAlertadoRecentemente(tipo: TipoSincronizacao): Promise<boolean> {
    const cutoff = new Date(Date.now() - this.JANELA_SUPRESSAO_MS);
    const recente = await this.prisma.auditLog.findFirst({
      where: {
        acao: 'WATCHDOG_ALERTA',
        recurso: tipo,
        createdAt: { gte: cutoff },
      },
    });
    return recente !== null;
  }

  private buildHtmlAlerta(tipo: TipoSincronizacao, ultima: Date, horas: number): string {
    return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#fef3c7;padding:20px">
      <div style="max-width:640px;margin:0 auto;background:#fff;border:2px solid #f59e0b;border-radius:8px;padding:24px">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#92400e">Plataforma Capul — Módulo Fiscal</div>
        <h2 style="color:#92400e;margin:8px 0 16px">⚠ Rotina agendada atrasada</h2>
        <p>A rotina automática <strong>${tipo}</strong> do motor de cruzamento não roda há <strong>${horas} hora(s)</strong>.</p>
        <p><strong>Última execução registrada:</strong> ${ultima.toLocaleString('pt-BR')}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
        <p style="font-size:13px;color:#475569">Verifique:</p>
        <ul style="font-size:13px;color:#475569">
          <li>Se o container <code>fiscal-backend</code> está online</li>
          <li>Se o scheduler BullMQ está ativo (veja <code>GET /api/v1/fiscal/cruzamento/scheduler/status</code>)</li>
          <li>Se <code>ambiente_config.pauseSync</code> não foi ativado acidentalmente</li>
          <li>Se há circuit breakers abertos que possam estar bloqueando execuções</li>
        </ul>
        <p style="font-size:11px;color:#94a3b8;margin-top:20px">Alerta disparado automaticamente pelo Watchdog. Próximo alerta suprimido por 6h.</p>
      </div>
    </body></html>`;
  }
}
