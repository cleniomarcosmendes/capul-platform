import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ProtheusService } from './protheus.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';

@Controller('protheus')
@UseGuards(JwtAuthGuard, GestaoTiGuard)
export class ProtheusController {
  constructor(private readonly service: ProtheusService) {}

  /**
   * Autocomplete de funcionário por NOME (portal RH). Mínimo 3 caracteres —
   * evita lista gigante e martelar o Protheus a cada tecla (o front também
   * faz debounce). Retorna `{ funcionarios: [{matricula,nome,cc}] }`.
   */
  @Get('colaboradores')
  async buscarPorNome(@Query('nome') nome?: string) {
    const q = (nome || '').trim();
    if (q.length < 3) return { funcionarios: [] };
    const funcionarios = await this.service.buscarPorNome(q);
    return { funcionarios };
  }

  @Get('colaborador/:matricula')
  async buscarColaborador(@Param('matricula') matricula: string) {
    const resultado = await this.service.buscarColaborador(matricula);
    if (!resultado) return { encontrado: false, matricula, nome: null };
    return { encontrado: true, ...resultado };
  }
}
