import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { FiscalGuard } from '../common/guards/fiscal.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { RoleMinima } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { FiscalAuthenticatedUser } from '../common/interfaces/jwt-payload.interface.js';
import { AmbienteService } from './ambiente.service.js';
import { AtualizarCronsDto } from './dto/atualizar-crons.dto.js';
import { AmbienteSefaz } from '@prisma/client';

@Controller('ambiente')
@UseGuards(JwtAuthGuard, FiscalGuard, RolesGuard)
export class AmbienteController {
  constructor(private readonly ambiente: AmbienteService) {}

  @Get()
  @RoleMinima('GESTOR_FISCAL')
  async getStatus() {
    return this.ambiente.getStatus();
  }

  @Put()
  @RoleMinima('GESTOR_FISCAL')
  async alterarAmbiente(
    @Body() body: { ambiente: AmbienteSefaz },
    @CurrentUser() user: FiscalAuthenticatedUser,
  ) {
    return this.ambiente.alterarAmbiente(body.ambiente, user.email);
  }

  @Put('crons')
  @RoleMinima('ADMIN_TI')
  async atualizarCrons(
    @Body() dto: AtualizarCronsDto,
    @CurrentUser() user: FiscalAuthenticatedUser,
  ) {
    return this.ambiente.atualizarCrons(
      dto.cronMovimentoMeioDia,
      dto.cronMovimentoManhaSeguinte,
      user.email,
    );
  }

  @Post('pause-sync')
  @RoleMinima('ADMIN_TI')
  async pauseSync(@CurrentUser() user: FiscalAuthenticatedUser) {
    return this.ambiente.pauseSync(user.email);
  }

  @Post('resume-sync')
  @RoleMinima('ADMIN_TI')
  async resumeSync(@CurrentUser() user: FiscalAuthenticatedUser) {
    return this.ambiente.resumeSync(user.email);
  }
}
