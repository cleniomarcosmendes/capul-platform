import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { AvaliacaoModule } from '../avaliacao/avaliacao.module.js';
import { ResultadoController } from './resultado.controller.js';
import { ResultadoService } from './resultado.service.js';

@Module({
  imports: [AvaliacaoModule, AuditoriaModule],
  controllers: [ResultadoController],
  providers: [ResultadoService],
})
export class ResultadoModule {}
