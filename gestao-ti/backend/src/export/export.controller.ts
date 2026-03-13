import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { ExportService } from './export.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { Response } from 'express';

@Controller('export')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)
export class ExportController {
  constructor(private readonly service: ExportService) {}

  @Get('ordem-servico/:id/relatorio')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  async relatorioOs(@Param('id') id: string, @Res() res: Response) {
    return this.service.exportRelatorioOs(id, res);
  }

  @Get('contrato/:id/parcela/:pid/rateio')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  async relatorioRateioParcela(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @Res() res: Response,
  ) {
    return this.service.exportRelatorioRateioParcela(id, pid, res);
  }

  @Get(':entidade')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  async exportar(@Param('entidade') entidade: string, @Res() res: Response) {
    return this.service.exportar(entidade, res);
  }
}
