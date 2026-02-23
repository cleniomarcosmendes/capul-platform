import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, GestaoTiGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  getResumo() {
    return this.service.getResumo();
  }

  @Get('executivo')
  getExecutivo() {
    return this.service.getExecutivo();
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
  getFinanceiro() {
    return this.service.getFinanceiro();
  }
}
