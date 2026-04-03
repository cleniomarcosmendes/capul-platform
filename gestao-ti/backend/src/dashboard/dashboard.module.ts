import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardResumoService } from './services/dashboard-resumo.service.js';
import { DashboardOperacionalService } from './services/dashboard-operacional.service.js';
import { DashboardFinanceiroService } from './services/dashboard-financeiro.service.js';
import { DashboardAcompanhamentoService } from './services/dashboard-acompanhamento.service.js';
import { DashboardIndicadoresService } from './services/dashboard-indicadores.service.js';
import { HorarioModule } from '../horario/horario.module.js';

@Module({
  imports: [HorarioModule],
  controllers: [DashboardController],
  providers: [
    DashboardResumoService,
    DashboardOperacionalService,
    DashboardFinanceiroService,
    DashboardAcompanhamentoService,
    DashboardIndicadoresService,
    DashboardService,
  ],
})
export class DashboardModule {}
