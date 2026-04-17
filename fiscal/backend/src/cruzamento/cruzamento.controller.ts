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
   * Dispara manualmente uma sincronização.
   * `diaria-manual` por padrão; `completa-manual` exige GESTOR_FISCAL.
   */
  @Post('sincronizar')
  @RoleMinima('ANALISTA_CADASTRO')
  async sincronizar(
    @Body() body: { tipo?: 'diaria-manual' | 'completa-manual' | 'bootstrap' },
    @CurrentUser() user: FiscalAuthenticatedUser,
  ) {
    const tipoPedido = body.tipo ?? 'diaria-manual';
    const tipoEnum = this.mapTipoBody(tipoPedido);

    // COMPLETA_MANUAL exige GESTOR_FISCAL
    if (tipoEnum === 'COMPLETA_MANUAL' && user.fiscalRole === 'ANALISTA_CADASTRO') {
      throw new ForbiddenException({
        erro: 'ROLE_INSUFICIENTE',
        mensagem: 'Carga completa exige role GESTOR_FISCAL ou ADMIN_TI.',
      });
    }

    const id = await this.execucao.iniciar(tipoEnum, user.email);
    return { sincronizacaoId: id, tipo: tipoEnum, status: 'EM_EXECUCAO' };
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
      'diaria-manual': 'DIARIA_MANUAL',
      'completa-manual': 'COMPLETA_MANUAL',
      bootstrap: 'BOOTSTRAP',
    };
    const t = map[tipo];
    if (!t) {
      throw new BadRequestException({
        erro: 'TIPO_SINCRONIZACAO_INVALIDO',
        mensagem: `Tipo "${tipo}" inválido. Valores aceitos: diaria-manual, completa-manual, bootstrap.`,
      });
    }
    return t;
  }
}
