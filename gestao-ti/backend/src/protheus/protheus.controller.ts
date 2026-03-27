import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ProtheusService } from './protheus.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';

@Controller('protheus')
@UseGuards(JwtAuthGuard, GestaoTiGuard)
export class ProtheusController {
  constructor(private readonly service: ProtheusService) {}

  @Get('colaborador/:matricula')
  async buscarColaborador(@Param('matricula') matricula: string) {
    const resultado = await this.service.buscarColaborador(matricula);
    if (!resultado) return { encontrado: false, matricula, nome: null };
    return { encontrado: true, ...resultado };
  }
}
