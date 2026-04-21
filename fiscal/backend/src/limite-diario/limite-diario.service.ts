import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailTransportService } from '../alertas/mail-transport.service.js';
import { DestinatariosResolver } from '../alertas/destinatarios.resolver.js';
import { LimiteDiarioAtingidoException } from './limite-diario.exception.js';

interface AlertasEnviadosHoje {
  amarelo?: boolean;
  vermelho?: boolean;
  critico?: boolean;
}

type NivelAlerta = 'amarelo' | 'vermelho' | 'critico';

/**
 * Controla o limite diário global de consultas SEFAZ (Plano v2.0 §6.2 — camada 4).
 *
 * Regra singleton (id=1) em `fiscal.limite_diario`:
 *   - `limiteDiario` (default 2000) — bloqueia consultas quando atingido
 *   - `alertaAmarelo` (default 1600 = 80%) — dispara alerta ao GESTOR_FISCAL
 *   - `alertaVermelho` (default 1800 = 90%) — dispara alerta crítico
 *   - Reset automático todos os dias às 00:05 via cron
 *   - ADMIN_TI pode liberar manualmente via `liberarManual()` em caso de urgência
 */
@Injectable()
export class LimiteDiarioService {
  private readonly logger = new Logger(LimiteDiarioService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailTransportService,
    private readonly destinatarios: DestinatariosResolver,
  ) {}

  /**
   * Chamado antes de cada consulta SEFAZ. Verifica se o contador não passou
   * do limite e se o corte automático não está ativo. Se OK, **incrementa**
   * atomicamente e devolve o novo valor. Se atingiu o limite, lança exceção.
   *
   * Usar assim nos clientes SEFAZ:
   *   await this.limiteDiario.checkAndIncrement();
   *   // ... faz a chamada SEFAZ aqui
   *
   * Nota: contar antes da chamada é conservador — se a chamada falhar, ainda
   * conta. Isso é intencional: o SEFAZ vê a chamada mesmo com erro.
   */
  async checkAndIncrement(): Promise<number> {
    const cfg = await this.getOrCreate();

    if (cfg.pausadoAutomatico) {
      throw new LimiteDiarioAtingidoException(cfg.contadorHoje, cfg.limiteDiario);
    }

    // Se a data mudou (ex: cron de reset não rodou por downtime), zera inline
    const hoje = this.hoje();
    if (this.toYmd(cfg.dataContador) !== hoje) {
      await this.reset('sistema:check-inline');
      return this.checkAndIncrement();
    }

    if (cfg.contadorHoje >= cfg.limiteDiario) {
      // Corte automático: marca pausado para próximas consultas não precisarem
      // consultar a tabela de novo
      await this.prisma.limiteDiario.update({
        where: { id: 1 },
        data: { pausadoAutomatico: true, pausadoEm: new Date() },
      });
      this.logger.warn(
        `Limite diário atingido (${cfg.contadorHoje}/${cfg.limiteDiario}). Corte automático ativado.`,
      );
      // Alerta crítico: 100% — GESTOR_FISCAL + ADMIN_TI (não-bloqueante)
      const enviados = (cfg.alertasEnviadosHoje as AlertasEnviadosHoje | null) ?? {};
      if (!enviados.critico) {
        this.enviarAlerta('critico', cfg.contadorHoje, cfg.limiteDiario).catch((err) => {
          this.logger.error(`Falha ao enviar alerta crítico 100%: ${(err as Error).message}`);
        });
        await this.prisma.limiteDiario.update({
          where: { id: 1 },
          data: { alertasEnviadosHoje: { ...enviados, critico: true } as object },
        });
      }
      throw new LimiteDiarioAtingidoException(cfg.contadorHoje, cfg.limiteDiario);
    }

    const atualizado = await this.prisma.limiteDiario.update({
      where: { id: 1 },
      data: { contadorHoje: { increment: 1 } },
    });

    await this.avaliarAlertas(atualizado.contadorHoje, atualizado.limiteDiario, atualizado.alertaAmarelo, atualizado.alertaVermelho, atualizado.alertasEnviadosHoje as AlertasEnviadosHoje | null);

    return atualizado.contadorHoje;
  }

  async getStatus() {
    const cfg = await this.getOrCreate();
    return {
      contadorHoje: cfg.contadorHoje,
      limiteDiario: cfg.limiteDiario,
      alertaAmarelo: cfg.alertaAmarelo,
      alertaVermelho: cfg.alertaVermelho,
      dataContador: cfg.dataContador,
      pausadoAutomatico: cfg.pausadoAutomatico,
      pausadoEm: cfg.pausadoEm,
      percentualConsumido: cfg.limiteDiario > 0 ? (cfg.contadorHoje / cfg.limiteDiario) : 0,
    };
  }

  async setLimites(params: { limiteDiario?: number; alertaAmarelo?: number; alertaVermelho?: number }, usuario: string) {
    const atual = await this.getOrCreate();
    const limiteDiario = params.limiteDiario ?? atual.limiteDiario;
    const alertaAmarelo = params.alertaAmarelo ?? atual.alertaAmarelo;
    const alertaVermelho = params.alertaVermelho ?? atual.alertaVermelho;

    if (alertaAmarelo >= alertaVermelho) {
      throw new Error('alertaAmarelo deve ser menor que alertaVermelho');
    }
    if (alertaVermelho >= limiteDiario) {
      throw new Error('alertaVermelho deve ser menor que limiteDiario');
    }

    return this.prisma.limiteDiario.update({
      where: { id: 1 },
      data: { limiteDiario, alertaAmarelo, alertaVermelho, atualizadoPor: usuario },
    });
  }

  /**
   * Reset diário automático às 00:05. Zera contador, apaga pausadoAutomatico
   * e alertasEnviadosHoje, atualiza dataContador.
   */
  @Cron('5 0 * * *', { timeZone: 'America/Sao_Paulo', name: 'fiscal:limite-diario-reset' })
  async resetDiarioAuto(): Promise<void> {
    await this.reset('sistema:cron');
  }

  async reset(origem: string): Promise<void> {
    await this.getOrCreate();
    await this.prisma.limiteDiario.update({
      where: { id: 1 },
      data: {
        contadorHoje: 0,
        dataContador: new Date(),
        pausadoAutomatico: false,
        pausadoEm: null,
        alertasEnviadosHoje: Prisma.JsonNull,
        atualizadoPor: origem,
      },
    });
    this.logger.log(`Limite diário resetado (origem=${origem})`);
  }

  /**
   * Liberação manual pelo ADMIN_TI em caso de urgência. Remove o corte
   * automático sem resetar contador.
   */
  async liberarManual(usuario: string): Promise<void> {
    await this.prisma.limiteDiario.update({
      where: { id: 1 },
      data: { pausadoAutomatico: false, pausadoEm: null, atualizadoPor: usuario },
    });
    this.logger.warn(`Corte automático liberado manualmente por ${usuario}.`);
  }

  // ----- internos -----

  private async getOrCreate() {
    let cfg = await this.prisma.limiteDiario.findUnique({ where: { id: 1 } });
    if (!cfg) {
      cfg = await this.prisma.limiteDiario.create({ data: { id: 1 } });
    }
    return cfg;
  }

  private async avaliarAlertas(
    contador: number,
    limite: number,
    amarelo: number,
    vermelho: number,
    enviados: AlertasEnviadosHoje | null,
  ): Promise<void> {
    const status = enviados ?? {};
    let nivel: NivelAlerta | null = null;

    // Ordem invertida: vermelho tem prioridade sobre amarelo — se cruzamos
    // amarelo+vermelho no mesmo incremento (improvável, mas possível), envia
    // só o vermelho. Se já enviamos vermelho antes, não manda amarelo atrasado.
    if (contador >= vermelho && !status.vermelho) {
      this.logger.warn(`Consumo atingiu 90% — ${contador}/${limite}`);
      status.vermelho = true;
      if (!status.amarelo) status.amarelo = true; // pula amarelo tardio
      nivel = 'vermelho';
    } else if (contador >= amarelo && !status.amarelo) {
      this.logger.warn(`Consumo atingiu 80% — ${contador}/${limite}`);
      status.amarelo = true;
      nivel = 'amarelo';
    }

    if (nivel) {
      await this.prisma.limiteDiario.update({
        where: { id: 1 },
        data: { alertasEnviadosHoje: status as object },
      });
      // Disparo de e-mail é não-bloqueante — se SMTP falhar, log e segue.
      this.enviarAlerta(nivel, contador, limite).catch((err) => {
        this.logger.error(`Falha ao enviar alerta ${nivel}: ${(err as Error).message}`);
      });
    }
  }

  /**
   * Envia e-mail de alerta nos thresholds do limite diário.
   *   - amarelo  (80%): GESTOR_FISCAL
   *   - vermelho (90%): GESTOR_FISCAL + ADMIN_TI
   *   - critico (100%): GESTOR_FISCAL + ADMIN_TI (corte automático ativo)
   */
  private async enviarAlerta(nivel: NivelAlerta, contador: number, limite: number): Promise<void> {
    const roles = nivel === 'amarelo' ? ['GESTOR_FISCAL', 'ADMIN_TI'] : ['GESTOR_FISCAL', 'ADMIN_TI'];
    const { destinatarios, fallback } = await this.destinatarios.resolveByRoles(roles);
    if (destinatarios.length === 0) {
      this.logger.warn(
        `Alerta ${nivel} (SEFAZ ${contador}/${limite}) nao enviado — sem destinatarios validos e FISCAL_FALLBACK_EMAIL nao configurado.`,
      );
      return;
    }
    const pct = ((contador / limite) * 100).toFixed(1);

    const cor = nivel === 'amarelo' ? '🟡' : nivel === 'vermelho' ? '🔴' : '🚨';
    const label =
      nivel === 'amarelo'
        ? 'atenção (80%)'
        : nivel === 'vermelho'
          ? 'crítico (90%)'
          : 'limite atingido (100%) — corte automático ativo';

    const prefix = fallback ? '[FALLBACK — sem destinatários configurados] ' : '';
    const subject = `${prefix}${cor} [FISCAL] Consumo SEFAZ ${label} — ${contador}/${limite}`;

    const html = this.renderHtmlAlerta(nivel, contador, limite, pct);
    const text = this.renderTextAlerta(nivel, contador, limite, pct);

    const result = await this.mail.send({
      to: destinatarios.map((d) => d.email),
      subject,
      html,
      text,
    });

    if (result.sent) {
      this.logger.log(
        `Alerta ${nivel} enviado: destinatarios=${destinatarios.length} fallback=${fallback} contador=${contador}/${limite}`,
      );
    } else {
      this.logger.error(`Alerta ${nivel} não enviado: ${result.error}`);
    }
  }

  private renderHtmlAlerta(nivel: NivelAlerta, contador: number, limite: number, pct: string): string {
    const corBg = nivel === 'amarelo' ? '#fef3c7' : nivel === 'vermelho' ? '#fee2e2' : '#fecaca';
    const corBorda = nivel === 'amarelo' ? '#f59e0b' : nivel === 'vermelho' ? '#ef4444' : '#dc2626';
    const titulo =
      nivel === 'amarelo'
        ? 'Consumo SEFAZ atingiu 80% do limite diário'
        : nivel === 'vermelho'
          ? 'Consumo SEFAZ atingiu 90% do limite diário'
          : 'Limite diário SEFAZ atingido — corte automático ATIVO';

    const acao =
      nivel === 'critico'
        ? '<p><strong>A plataforma PAROU todas as consultas SEFAZ.</strong> Retomam automaticamente a partir de 00:00. Em caso de urgência, ADMIN_TI pode liberar manualmente em <code>Operação → Limites e Política</code>.</p>'
        : nivel === 'vermelho'
          ? '<p><strong>Faltam apenas 10% do limite.</strong> Avaliar origem do consumo e se há algo a pausar até o reset das 00:00.</p>'
          : '<p>Monitorar o consumo ao longo do dia. Se chegar a 100%, a plataforma pausa automaticamente as consultas SEFAZ até 00:00.</p>';

    return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#1e293b;max-width:600px;margin:0 auto;padding:20px;">
<div style="background:${corBg};border-left:4px solid ${corBorda};padding:16px;border-radius:4px;">
  <h2 style="margin:0 0 8px 0;color:${corBorda};font-size:16px;">${titulo}</h2>
  <p style="margin:0;font-size:14px;">Consumo atual: <strong>${contador} / ${limite} consultas</strong> (<strong>${pct}%</strong>)</p>
</div>
${acao}
<p style="color:#64748b;font-size:12px;margin-top:24px;">
Política de consultas SEFAZ detalhada em <code>Operação → Limites e Política de Consultas</code>.<br>
Por que este limite existe? A SEFAZ monitora consumo por CNPJ; consumo excessivo pode bloquear o CNPJ da Capul, travando a emissão de NF-e.<br>
<em>Plataforma Capul — Módulo Fiscal</em>
</p>
</body></html>`;
  }

  private renderTextAlerta(nivel: NivelAlerta, contador: number, limite: number, pct: string): string {
    const titulo =
      nivel === 'amarelo'
        ? 'Consumo SEFAZ atingiu 80% do limite diário'
        : nivel === 'vermelho'
          ? 'Consumo SEFAZ atingiu 90% do limite diário'
          : 'Limite diário SEFAZ atingido — CORTE AUTOMÁTICO ATIVO';
    const acao =
      nivel === 'critico'
        ? 'A plataforma parou todas as consultas SEFAZ. Retomam automaticamente a partir de 00:00.'
        : nivel === 'vermelho'
          ? 'Faltam apenas 10% do limite. Avaliar origem do consumo.'
          : 'Monitorar o consumo ao longo do dia.';
    return `${titulo}\n\nConsumo atual: ${contador} / ${limite} consultas (${pct}%)\n\n${acao}\n\nPolítica detalhada em: Operação → Limites e Política de Consultas\nPlataforma Capul — Módulo Fiscal`;
  }

  /**
   * "Hoje" em horário de Brasília (America/Sao_Paulo, UTC-3 fixo desde 2019).
   * Importante não usar getFullYear/getMonth/getDate direto porque o horário
   * local do container Node pode ser UTC ou outro, causando mismatch com o
   * campo DATE gravado pelo Postgres (que o Prisma retorna como meia-noite UTC).
   */
  private hoje(): string {
    return this.toYmdBrt(new Date());
  }

  /**
   * Interpreta `dataContador` (DATE do Postgres, retornado pelo Prisma como
   * meia-noite UTC do dia) usando os getters UTC — corresponde ao "dia BRT"
   * que o Postgres gravou via `CURRENT_DATE` (ou equivalente).
   */
  private toYmd(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  /**
   * Formata um Date que representa um instante atual (ex: now()) como YMD
   * no horário de Brasília. Subtrai 3h do timestamp UTC e lê em UTC → dá
   * equivalente ao dia BRT sem depender do TZ do runtime.
   */
  private toYmdBrt(d: Date): string {
    const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
    const brt = new Date(d.getTime() - BRT_OFFSET_MS);
    return this.toYmd(brt);
  }
}
