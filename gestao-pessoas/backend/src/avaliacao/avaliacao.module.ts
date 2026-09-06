import { Module } from '@nestjs/common';
import { AvaliacaoController } from './avaliacao.controller.js';
import { AvaliacaoAcessoService } from './avaliacao-acesso.service.js';
import { AvaliacaoService } from './avaliacao.service.js';

@Module({
  controllers: [AvaliacaoController],
  providers: [AvaliacaoAcessoService, AvaliacaoService],
  exports: [AvaliacaoAcessoService, AvaliacaoService],
})
export class AvaliacaoModule {}
