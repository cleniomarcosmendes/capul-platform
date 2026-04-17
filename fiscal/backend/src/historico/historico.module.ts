// @TODO Onda 1 — listagem unificada de DocumentoConsulta (NF-e + CT-e) com filtros e export.
import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { FiscalGuard } from '../common/guards/fiscal.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { RoleMinima } from '../common/decorators/roles.decorator.js';

@Controller('historico')
@UseGuards(JwtAuthGuard, FiscalGuard, RolesGuard)
class HistoricoController {
  @Get('health')
  @RoleMinima('OPERADOR_ENTRADA')
  health() {
    return { ok: true, modulo: 'historico', status: 'stub' };
  }
}

@Module({ controllers: [HistoricoController] })
export class HistoricoModule {}
