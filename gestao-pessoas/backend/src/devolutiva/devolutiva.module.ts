import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { ResultadoModule } from '../resultado/resultado.module.js';
import { DevolutivaController } from './devolutiva.controller.js';
import { DevolutivaDoAvaliadorController } from './devolutiva-do-avaliador.controller.js';
import { DevolutivaService } from './devolutiva.service.js';

@Module({
  imports: [AuditoriaModule, ResultadoModule],
  controllers: [DevolutivaController, DevolutivaDoAvaliadorController],
  providers: [DevolutivaService],
  exports: [DevolutivaService],
})
export class DevolutivaModule {}
