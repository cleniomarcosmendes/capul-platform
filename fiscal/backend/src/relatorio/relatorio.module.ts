// @TODO Onda 2 — Relatório de Contribuintes (cards, gráficos, tabela, export XLSX/PDF).
import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { FiscalGuard } from '../common/guards/fiscal.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { RoleMinima } from '../common/decorators/roles.decorator.js';

@Controller('relatorio')
@UseGuards(JwtAuthGuard, FiscalGuard, RolesGuard)
class RelatorioController {
  @Get('health')
  @RoleMinima('ANALISTA_CADASTRO')
  health() {
    return { ok: true, modulo: 'relatorio', status: 'stub', onda: 2 };
  }
}

@Module({ controllers: [RelatorioController] })
export class RelatorioModule {}
