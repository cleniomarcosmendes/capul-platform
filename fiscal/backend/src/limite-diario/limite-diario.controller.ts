import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { FiscalGuard } from '../common/guards/fiscal.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { RoleMinima } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { FiscalAuthenticatedUser } from '../common/interfaces/jwt-payload.interface.js';
import { LimiteDiarioService } from './limite-diario.service.js';

interface AtualizarLimitesDto {
  limiteDiario?: number;
  alertaAmarelo?: number;
  alertaVermelho?: number;
}

@Controller('operacao/limites')
@UseGuards(JwtAuthGuard, FiscalGuard, RolesGuard)
export class LimiteDiarioController {
  constructor(private readonly service: LimiteDiarioService) {}

  @Get()
  @RoleMinima('GESTOR_FISCAL')
  async status() {
    return this.service.getStatus();
  }

  @Put()
  @RoleMinima('ADMIN_TI')
  async atualizar(
    @Body() body: AtualizarLimitesDto,
    @CurrentUser() user: FiscalAuthenticatedUser,
  ) {
    return this.service.setLimites(body, user.email);
  }

  @Post('liberar')
  @RoleMinima('ADMIN_TI')
  async liberar(@CurrentUser() user: FiscalAuthenticatedUser) {
    await this.service.liberarManual(user.email);
    return { ok: true };
  }

  @Post('reset')
  @RoleMinima('ADMIN_TI')
  async reset(@CurrentUser() user: FiscalAuthenticatedUser) {
    await this.service.reset(`manual:${user.email}`);
    return { ok: true };
  }
}
