import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { AvaliacaoModule } from '../avaliacao/avaliacao.module.js';
import { ResultadoController } from './resultado.controller.js';
import { ResultadoService } from './resultado.service.js';

@Module({
  imports: [AvaliacaoModule, AuditoriaModule],
  controllers: [ResultadoController],
  providers: [ResultadoService],
  // ⭐ Exportado para a DEVOLUTIVA reusar `memoria()` — o payload é o mesmo,
  //    e uma segunda montagem divergiria no primeiro campo novo.
  exports: [ResultadoService],
})
export class ResultadoModule {}
