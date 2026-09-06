import { Module } from '@nestjs/common';
import { AvaliacaoModule } from '../avaliacao/avaliacao.module.js';
import { ResultadoController } from './resultado.controller.js';
import { ResultadoService } from './resultado.service.js';

@Module({
  imports: [AvaliacaoModule],
  controllers: [ResultadoController],
  providers: [ResultadoService],
})
export class ResultadoModule {}
