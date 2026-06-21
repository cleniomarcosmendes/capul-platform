import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SacIndicadoresService } from './sac-indicadores.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';

/** SAC 4c — indicadores. Admin/Gestor. */
@Controller('sac-indicadores')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)
@Roles('ADMIN', 'GESTOR')
export class SacIndicadoresController {
  constructor(private readonly service: SacIndicadoresService) {}

  @Get()
  indicadores(@Query('mes') mes?: string, @Query('ano') ano?: string) {
    const now = new Date();
    const m = Math.min(Math.max(Number(mes) || now.getMonth() + 1, 1), 12);
    const a = Number(ano) || now.getFullYear();
    return this.service.indicadores(m, a);
  }
}
