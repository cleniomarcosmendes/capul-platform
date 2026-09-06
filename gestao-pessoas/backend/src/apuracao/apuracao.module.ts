import { Module } from '@nestjs/common';
import { AvaliacaoModule } from '../avaliacao/avaliacao.module.js';
import { ApuracaoController } from './apuracao.controller.js';
import { ApuracaoService } from './apuracao.service.js';

@Module({
  imports: [AvaliacaoModule],
  controllers: [ApuracaoController],
  providers: [ApuracaoService],
  exports: [ApuracaoService],
})
export class ApuracaoModule {}
