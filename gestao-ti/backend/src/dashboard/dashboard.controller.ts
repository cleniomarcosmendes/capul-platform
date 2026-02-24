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

  @Get('csat')
  getCsat(
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('departamentoId') departamentoId?: string,
  ) {
    return this.service.getCsat({ dataInicio, dataFim, departamentoId });
  }
}
