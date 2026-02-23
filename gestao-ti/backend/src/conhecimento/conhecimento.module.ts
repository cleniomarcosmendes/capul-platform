import { Module } from '@nestjs/common';
import { ConhecimentoController } from './conhecimento.controller.js';
import { ConhecimentoService } from './conhecimento.service.js';

@Module({
  controllers: [ConhecimentoController],
  providers: [ConhecimentoService],
  exports: [ConhecimentoService],
})
export class ConhecimentoModule {}
