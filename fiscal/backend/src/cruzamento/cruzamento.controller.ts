import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { FiscalGuard } from '../common/guards/fiscal.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { RoleMinima } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { FiscalAuthenticatedUser } from '../common/interfaces/jwt-payload.interface.js';
import { CircuitBreakerService } from './circuit-breaker.service.js';
import { ExecucaoService } from './execucao.service.js';
import { SchedulerService } from './scheduler.service.js';
import { ExpurgoService } from './expurgo.service.js';
import { AlertasService } from '../alertas/alertas.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CircuitState, TipoSincronizacao } from '@prisma/client';

@Controller('cruzamento')
@UseGuards(JwtAuthGuard, FiscalGuard, RolesGuard)
export class CruzamentoController {
  constructor(
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly execucao: ExecucaoService,
    private readonly scheduler: SchedulerService,
    private readonly expurgo: ExpurgoService,
    private readonly alertas: AlertasService,
    private readonly prisma: PrismaService,
  ) {}

  // ----- Execução manual -----

  /**
   * Dispara manualmente uma sincronização (Plano v2.0).
   * Body aceita `tipo`: 'manual' (default), 'movimento-meio-dia' ou 'movimento-manha-seguinte'.
   * GESTOR_FISCAL é o role mínimo para forçar manualmente uma corrida automática.
   */
  @Post('sincronizar')
  @RoleMinima('ANALISTA_CADASTRO')
  async sincronizar(
    @Body()
    body: {
      tipo?: 'manual' | 'movimento-meio-dia' | 'movimento-manha-seguinte';
      dataInicio?: string;
      dataFim?: string;
    },
    @CurrentUser() user: FiscalAuthenticatedUser,
  ) {
    const tipoPedido = body.tipo ?? 'manual';
    const tipoEnum = this.mapTipoBody(tipoPedido);

    if (
      (tipoEnum === 'MOVIMENTO_MEIO_DIA' || tipoEnum === 'MOVIMENTO_MANHA_SEGUINTE') &&
      user.fiscalRole === 'ANALISTA_CADASTRO'
    ) {
      throw new ForbiddenException({
        erro: 'ROLE_INSUFICIENTE',
        mensagem: 'Disparo manual de corrida automática exige GESTOR_FISCAL ou ADMIN_TI.',
      });
    }

    // Janela personalizada (manual com datas) — valida e monta objeto Date.
    let janela: { inicio: Date; fim: Date } | undefined;
    if (body.dataInicio || body.dataFim) {
      if (tipoEnum !== 'MANUAL') {
        throw new BadRequestException({
          erro: 'JANELA_APENAS_MANUAL',
          mensagem: 'Janela personalizada (dataInicio/dataFim) so e valida para tipo=manual.',
        });
      }
      if (!body.dataInicio || !body.dataFim) {
        throw new BadRequestException({
          erro: 'JANELA_INCOMPLETA',
          mensagem: 'dataInicio e dataFim sao obrigatorios quando um deles e informado.',
        });
      }
      janela = this.validarJanela(body.dataInicio, body.dataFim);
    }

    const id = await this.execucao.iniciar(tipoEnum, user.email, janela);
    return { sincronizacaoId: id, tipo: tipoEnum, status: 'EM_EXECUCAO', janela };
  }

  /**
   * Valida e converte janela de datas informada pelo usuario.
   * Regras: datas no formato YYYY-MM-DD, inicio <= fim, inicio no maximo
   * 60 dias atras (evita consumo excessivo da cota SEFAZ), fim nao futuro.
   */
  private validarJanela(dataInicio: string, dataFim: string): { inicio: Date; fim: Date } {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dataInicio) || !regex.test(dataFim)) {
      throw new BadRequestException({
        erro: 'DATA_FORMATO',
        mensagem: 'dataInicio e dataFim devem estar no formato YYYY-MM-DD.',
      });
    }
    const inicio = new Date(`${dataInicio}T00:00:00-03:00`);
    const fim = new Date(`${dataFim}T23:59:59-03:00`);
    if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
      throw new BadRequestException({ erro: 'DATA_INVALIDA', mensagem: 'Data invalida.' });
    }
    if (inicio.getTime() > fim.getTime()) {
      throw new BadRequestException({
        erro: 'JANELA_INVERTIDA',
        mensagem: 'dataInicio deve ser anterior ou igual a dataFim.',
      });
    }
    const agora = new Date();
    if (fim.getTime() > agora.getTime() + 24 * 60 * 60_000) {
      throw new BadRequestException({
        erro: 'DATA_FUTURA',
        mensagem: 'dataFim nao pode ser no futuro.',
      });
    }
    const LIMITE_DIAS = 60;
    const maxPast = new Date(agora.getTime() - LIMITE_DIAS * 24 * 60 * 60_000);
    if (inicio.getTime() < maxPast.getTime()) {
      throw new BadRequestException({
        erro: 'JANELA_MUITO_ANTIGA',
        mensagem: `dataInicio nao pode ser anterior a ${LIMITE_DIAS} dias atras (protecao contra consumo excessivo da cota SEFAZ).`,
      });
    }
    return { inicio, fim };
  }

  @Get('execucoes')
  @RoleMinima('ANALISTA_CADASTRO')
  async listarExecucoes(@Query('tipo') tipo?: TipoSincronizacao, @Query('limit') limit?: string) {
    const take = Math.min(Number(limit ?? '50'), 200);
    return this.prisma.cadastroSincronizacao.findMany({
      where: tipo ? { tipo } : undefined,
      orderBy: { iniciadoEm: 'desc' },
      take,
    });
  }

  @Get('execucoes/:id')
  @RoleMinima('ANALISTA_CADASTRO')
  async getExecucao(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.prisma.cadastroSincronizacao.findUnique({
      where: { id },
      include: { alertas: true },
    });
  }

  /**
   * Cancela uma execucao em andamento. Marca como CANCELADA no banco e
   * remove jobs pendentes da fila. Jobs ja em processamento continuam ate
   * acabar (BullMQ nao permite abort seguro), mas o digest final nao sera
   * emitido pois a execucao ja esta marcada como CANCELADA.
   */
  @Post('execucoes/:id/cancelar')
  @HttpCode(200)
  @RoleMinima('ADMIN_TI')
  async cancelarExecucao(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: FiscalAuthenticatedUser,
  ) {
    return this.execucao.cancelar(id, user.email);
  }

  // ----- Scheduler -----

  @Get('scheduler/status')
  @RoleMinima('GESTOR_FISCAL')
  async getSchedulerStatus() {
    return this.scheduler.getStatus();
  }

  @Post('scheduler/recarregar')
  @RoleMinima('ADMIN_TI')
  async reloadScheduler() {
    await this.scheduler.registrar();
    return { ok: true };
  }

  // ----- Circuit breaker -----

  @Get('circuit-breaker')
  @RoleMinima('ANALISTA_CADASTRO')
  async getCircuitBreakerStates() {
    return this.circuitBreaker.getAllStates();
  }

  @Post('circuit-breaker/force')
  @RoleMinima('ADMIN_TI')
  async forceCircuitBreaker(
    @Body() body: { uf: string; estado: CircuitState; motivo: string },
  ) {
    await this.circuitBreaker.forceState(body.uf, body.estado, body.motivo);
    return { ok: true };
  }

  // ----- Alertas -----

  @Post('alertas/:id/reenviar')
  @HttpCode(200)
  @RoleMinima('GESTOR_FISCAL')
  async reenviarAlerta(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.alertas.reenviarDigest(id);
    return { ok: true };
  }

  @Get('alertas/historico')
  @RoleMinima('GESTOR_FISCAL')
  async historicoAlertas(@Query('limit') limit?: string) {
    const take = Math.min(Number(limit ?? '50'), 200);
    return this.prisma.alertaEnviado.findMany({
      orderBy: { enviadoEm: 'desc' },
      take,
      include: { sincronizacao: true },
    });
  }

  // ----- Expurgo -----

  @Delete('expurgo')
  @RoleMinima('ADMIN_TI')
  async expurgoManual() {
    return this.expurgo.expurgar();
  }

  // ----- Health -----

  @Get('health')
  @RoleMinima('ANALISTA_CADASTRO')
  async health() {
    return {
      ok: true,
      modulo: 'cruzamento',
      onda: 2,
      implementado: [
        'CircuitBreakerService',
        'ExecucaoService',
        'CruzamentoWorker',
        'SchedulerService',
        'WatchdogService',
        'ExpurgoService',
      ],
    };
  }

  private mapTipoBody(tipo: string): TipoSincronizacao {
    const map: Record<string, TipoSincronizacao> = {
      manual: 'MANUAL',
      'movimento-meio-dia': 'MOVIMENTO_MEIO_DIA',
      'movimento-manha-seguinte': 'MOVIMENTO_MANHA_SEGUINTE',
    };
    const t = map[tipo];
    if (!t) {
      throw new BadRequestException({
        erro: 'TIPO_SINCRONIZACAO_INVALIDO',
        mensagem: `Tipo "${tipo}" inválido. Valores aceitos: manual, movimento-meio-dia, movimento-manha-seguinte.`,
      });
    }
    return t;
  }
}
