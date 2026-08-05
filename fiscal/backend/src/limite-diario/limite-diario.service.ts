import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailTransportService } from '../alertas/mail-transport.service.js';
import { DestinatariosResolver } from '../alertas/destinatarios.resolver.js';
import { LimiteDiarioAtingidoException } from './limite-diario.exception.js';
import { ConsumoIndevidoBloqueadoException } from './consumo-indevido.exception.js';

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

  /**
   * Duração do freio após um cStat=656. Mesma janela que o fluxo de
   * distribuição CT-e já usa (`NsuControleService.bloquearPor656`) — a
   * marcação de consumo indevido da SEFAZ costuma normalizar em cerca de
   * uma hora. ADMIN_TI pode liberar antes por `liberarManual()`.
   */
  private static readonly BLOQUEIO_656_MS = 60 * 60 * 1000;

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

    // Freio de consumo indevido vem ANTES do corte diário: é a condição mais
    // grave e a mensagem é outra. Se caísse no LimiteDiarioAtingido, o
    // operador leria "limite diário" e esperaria a virada do dia — quando na
    // verdade a SEFAZ marcou o certificado e o risco é de bloqueio do CNPJ.
    if (cfg.bloqueio656Ate && cfg.bloqueio656Ate.getTime() > Date.now()) {
      throw new ConsumoIndevidoBloqueadoException(cfg.bloqueio656Ate, cfg.bloqueio656Motivo);
    }

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

  /**
   * Aciona o freio global após a SEFAZ devolver cStat=656 (consumo indevido).
   * Chamado pelos clientes SEFAZ no ponto em que o cStat é lido.
   *
   * Global de propósito: a SEFAZ marca o CERTIFICADO consulente, e o mTLS usa
   * um único certificado para todas as filiais (`SefazAgentService.getAgent`
   * carrega `certReader.loadActive()`, sem parâmetro de filial). Trocar a
   * filial muda só o campo `<CNPJ>` do XML — a identidade vista pela SEFAZ é
   * a mesma. Por isso não existe "tentar por outra filial" que escape do 656:
   * só multiplicaria as chamadas sob a marcação.
   *
   * Não-bloqueante em caso de falha: se a gravação do freio falhar, logamos e
   * deixamos a exceção original do 656 subir — nunca mascarar o erro real.
   *
   * Idempotente por janela: se já existe bloqueio ativo, ESTENDE para a nova
   * janela (um segundo 656 significa que a SEFAZ ainda está incomodada).
   */
  async bloquearPorConsumoIndevido(origem: string, xMotivo: string): Promise<void> {
    try {
      const ate = new Date(Date.now() + LimiteDiarioService.BLOQUEIO_656_MS);
      const motivo = `${origem} — ${xMotivo}`.slice(0, 500);
      await this.getOrCreate();
      await this.prisma.limiteDiario.update({
        where: { id: 1 },
        data: {
          bloqueio656Ate: ate,
          bloqueio656Em: new Date(),
          bloqueio656Motivo: motivo,
          atualizadoPor: 'sistema:cstat-656',
        },
      });
      this.logger.error(
        `[FREIO_656] Consultas SEFAZ BLOQUEADAS até ${ate.toISOString()} — ${motivo}. ` +
          `Trocar de filial NÃO contorna (certificado único). Acionar ADMIN_TI.`,
      );
      this.enviarAlerta656(ate, motivo).catch((err) => {
        this.logger.error(`Falha ao enviar alerta de consumo indevido: ${(err as Error).message}`);
      });
    } catch (err) {
      this.logger.error(
        `Falha ao gravar o freio de consumo indevido: ${(err as Error).message}. ` +
          `O 656 original segue sendo propagado ao chamador.`,
      );
    }
  }

  async getStatus() {
    const cfg = await this.getOrCreate();
    // Staleness: se o `dataContador` não é hoje (BRT), o contador é de um dia
    // anterior e ainda não foi zerado (cron 00:05 não rodou — ex.: container
    // desligado no horário, ou linha veio de restore de backup com consumo de
    // outro dia). Reportar 0 p/ "hoje" — espelha o reset inline do
    // checkAndIncrement(). Sem isso o dashboard exibe consumo obsoleto como se
    // fosse de hoje (incidente DEV 01/06: 851 de 29/05 vindo de restore PROD).
    const ehHoje = this.toYmd(cfg.dataContador) === this.hoje();
    const contadorHoje = ehHoje ? cfg.contadorHoje : 0;
    const pausadoAutomatico = ehHoje ? cfg.pausadoAutomatico : false;
    // Freio 656 é independente do dia: expira por tempo, não pelo reset.
    const bloqueio656Ativo = !!cfg.bloqueio656Ate && cfg.bloqueio656Ate.getTime() > Date.now();
    return {
      contadorHoje,
      limiteDiario: cfg.limiteDiario,
      alertaAmarelo: cfg.alertaAmarelo,
      alertaVermelho: cfg.alertaVermelho,
      dataContador: cfg.dataContador,
      pausadoAutomatico,
      pausadoEm: ehHoje ? cfg.pausadoEm : null,
      percentualConsumido: cfg.limiteDiario > 0 ? (contadorHoje / cfg.limiteDiario) : 0,
      bloqueio656Ativo,
      bloqueio656Ate: bloqueio656Ativo ? cfg.bloqueio656Ate : null,
      bloqueio656Em: bloqueio656Ativo ? cfg.bloqueio656Em : null,
      bloqueio656Motivo: bloqueio656Ativo ? cfg.bloqueio656Motivo : null,
      bloqueio656MinutosRestantes: bloqueio656Ativo
        ? Math.max(1, Math.ceil((cfg.bloqueio656Ate!.getTime() - Date.now()) / 60_000))
        : 0,
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
    // NÃO limpa `bloqueio656*` de propósito: o freio de consumo indevido
    // expira por tempo, não pela virada do dia. Um 656 às 23:50 tem que
    // continuar valendo depois das 00:05 — a SEFAZ não zera a marcação dela
    // porque o nosso contador diário zerou.
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
   * automático sem resetar contador, e também o freio de consumo indevido.
   *
   * O 656 entra aqui porque não existe outra saída manual: se a SEFAZ
   * normalizar antes da janela de 1h e o setor fiscal estiver travado, o
   * ADMIN_TI precisa poder destravar. Log em nível WARN separado para o caso
   * ficar rastreável — liberar um 656 na mão é decisão de risco, diferente
   * de liberar cota estourada.
   */
  async liberarManual(usuario: string): Promise<void> {
    const antes = await this.getOrCreate();
    const tinha656 = !!antes.bloqueio656Ate && antes.bloqueio656Ate.getTime() > Date.now();
    await this.prisma.limiteDiario.update({
      where: { id: 1 },
      data: {
        pausadoAutomatico: false,
        pausadoEm: null,
        bloqueio656Ate: null,
        bloqueio656Em: null,
        bloqueio656Motivo: null,
        atualizadoPor: usuario,
      },
    });
    this.logger.warn(`Corte automático liberado manualmente por ${usuario}.`);
    if (tinha656) {
      this.logger.warn(
        `[FREIO_656] Freio de consumo indevido liberado MANUALMENTE por ${usuario} ` +
          `antes de ${antes.bloqueio656Ate!.toISOString()}. Consultas SEFAZ voltam a sair.`,
      );
    }
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

  /**
   * Alerta de consumo indevido (cStat=656). Vai para GESTOR_FISCAL + ADMIN_TI
   * como o alerta crítico de cota, mas com texto próprio: aqui o problema não
   * é volume, é a SEFAZ ter marcado o certificado — e a ação certa é NÃO
   * insistir, o oposto do reflexo de "tentar de novo".
   */
  private async enviarAlerta656(ate: Date, motivo: string): Promise<void> {
    const { destinatarios, fallback } = await this.destinatarios.resolveByRoles([
      'GESTOR_FISCAL',
      'ADMIN_TI',
    ]);
    if (destinatarios.length === 0) {
      this.logger.warn(
        `Alerta de consumo indevido (656) nao enviado — sem destinatarios validos e ` +
          `FISCAL_FALLBACK_EMAIL nao configurado.`,
      );
      return;
    }
    const prefix = fallback ? '[FALLBACK — sem destinatários configurados] ' : '';
    const hora = ate.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    });
    const subject = `${prefix}🚨 [FISCAL] SEFAZ acusou consumo indevido (656) — consultas PARADAS`;

    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#1e293b;max-width:600px;margin:0 auto;padding:20px;">
<div style="background:#fecaca;border-left:4px solid #dc2626;padding:16px;border-radius:4px;">
  <h2 style="margin:0 0 8px 0;color:#dc2626;font-size:16px;">SEFAZ retornou cStat=656 — consumo indevido</h2>
  <p style="margin:0;font-size:14px;">A plataforma <strong>parou todas as consultas SEFAZ</strong> automaticamente. Liberação prevista para <strong>${hora}</strong>.</p>
</div>
<p><strong>Não tentar de novo agora.</strong> Cada nova consulta agrava o risco de bloqueio do CNPJ da CAPUL — o que pararia NF-e, CT-e e cadastro.</p>
<p>Tentar por outra filial <strong>não contorna</strong>: o certificado digital é único para todas as filiais, então a SEFAZ vê o mesmo consulente.</p>
<p>Para o que for urgente nas próximas horas: buscar o XML no <strong>Protheus (SZR010)</strong> — se já foi baixado antes, está em cache — ou solicitar ao <strong>emitente</strong>.</p>
<p style="color:#64748b;font-size:12px;margin-top:24px;">
Origem: <code>${motivo}</code><br>
ADMIN_TI pode liberar antes da hora em <code>Operação → Limites e Política de Consultas</code>, ciente do risco.<br>
<em>Plataforma Capul — Módulo Fiscal</em>
</p>
</body></html>`;

    const text =
      `SEFAZ retornou cStat=656 (consumo indevido).\n\n` +
      `A plataforma parou todas as consultas SEFAZ. Liberação prevista para ${hora}.\n\n` +
      `NÃO tentar de novo agora — cada consulta agrava o risco de bloqueio do CNPJ da CAPUL.\n` +
      `Tentar por outra filial não contorna: o certificado é único.\n\n` +
      `Urgências: Protheus (SZR010) ou solicitar o XML ao emitente.\n\n` +
      `Origem: ${motivo}\n` +
      `Plataforma Capul — Módulo Fiscal`;

    const result = await this.mail.send({ to: destinatarios.map((d) => d.email), subject, html, text });
    if (result.sent) {
      this.logger.log(`Alerta 656 enviado: destinatarios=${destinatarios.length} fallback=${fallback}`);
    } else {
      this.logger.error(`Alerta 656 não enviado: ${result.error}`);
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
