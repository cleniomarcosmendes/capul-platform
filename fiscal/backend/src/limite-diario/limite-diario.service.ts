import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { LimiteDiarioAtingidoException } from './limite-diario.exception.js';

interface AlertasEnviadosHoje {
  amarelo?: boolean;
  vermelho?: boolean;
}

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

  constructor(private readonly prisma: PrismaService) {}

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
    let mudou = false;

    if (contador >= vermelho && !status.vermelho) {
      this.logger.warn(`Consumo atingiu 90% — ${contador}/${limite}`);
      status.vermelho = true;
      mudou = true;
      // Envio real de e-mail a GESTOR_FISCAL + ADMIN_TI será integrado no passo
      // seguinte via AlertasService. Por ora, apenas marca para não repetir.
    } else if (contador >= amarelo && !status.amarelo) {
      this.logger.warn(`Consumo atingiu 80% — ${contador}/${limite}`);
      status.amarelo = true;
      mudou = true;
    }

    if (mudou) {
      await this.prisma.limiteDiario.update({
        where: { id: 1 },
        data: { alertasEnviadosHoje: status as object },
      });
    }
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
