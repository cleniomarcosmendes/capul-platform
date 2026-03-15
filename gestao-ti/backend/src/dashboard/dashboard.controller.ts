import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, GestaoTiGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  getResumo(
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('departamentoId') departamentoId?: string,
  ) {
    return this.service.getResumo({ dataInicio, dataFim, departamentoId });
  }

  @Get('executivo')
  getExecutivo(
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.service.getExecutivo({ dataInicio, dataFim });
  }

  @Get('disponibilidade')
  getDisponibilidade(
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('softwareId') softwareId?: string,
    @Query('filialId') filialId?: string,
  ) {
    return this.service.getDisponibilidade({ dataInicio, dataFim, softwareId, filialId });
  }

  @Get('financeiro')
  getFinanceiro(
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.service.getFinanceiro({ dataInicio, dataFim });
  }

  @Get('ordens-servico')
  getOrdensServico(
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('filialId') filialId?: string,
  ) {
    return this.service.getOrdensServico({ dataInicio, dataFim, filialId });
  }

  @Get('csat')
  getCsat(
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('departamentoId') departamentoId?: string,
  ) {
    return this.service.getCsat({ dataInicio, dataFim, departamentoId });
  }

  @Get('acompanhamento')
  getAcompanhamento(
    @Query('usuarioId') usuarioId?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('tzOffset') tzOffset?: string,
  ) {
    return this.service.getAcompanhamento({ usuarioId, dataInicio, dataFim, tzOffset: tzOffset ? parseInt(tzOffset, 10) : 0 });
  }

  @Get('acompanhamento/tecnicos')
  getTecnicos() {
    return this.service.getTecnicosAtivos();
  }
}
