import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { FiscalGuard } from '../common/guards/fiscal.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { RoleMinima } from '../common/decorators/roles.decorator.js';
import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, FiscalGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  @RoleMinima('GESTOR_FISCAL')
  async overview() {
    return this.service.getOverview();
  }
}
