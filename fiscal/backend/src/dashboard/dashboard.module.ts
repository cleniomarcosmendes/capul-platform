import { Module } from '@nestjs/common';
import { AmbienteModule } from '../ambiente/ambiente.module.js';
import { CertificadoModule } from '../certificado/certificado.module.js';
import { CruzamentoModule } from '../cruzamento/cruzamento.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

/**
 * DashboardModule — endpoint agregador para a tela inicial do Modulo Fiscal.
 * Reaproveita services de AmbienteModule, CertificadoModule, CruzamentoModule
 * (SchedulerService) e LimiteDiarioModule (@Global, sem import explicito).
 */
@Module({
  imports: [AmbienteModule, CertificadoModule, CruzamentoModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
