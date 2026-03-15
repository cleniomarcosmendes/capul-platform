import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { HorarioModule } from '../horario/horario.module.js';

@Module({
  imports: [HorarioModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
