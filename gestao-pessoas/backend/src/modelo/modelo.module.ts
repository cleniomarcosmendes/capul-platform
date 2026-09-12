import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { VersaoController } from './versao.controller.js';
import { VersaoService } from './versao.service.js';
import { ArranjoService } from './arranjo.service.js';
import { PublicacaoService } from './publicacao.service.js';

@Module({
  imports: [AuditoriaModule],
  controllers: [VersaoController],
  providers: [VersaoService, ArranjoService, PublicacaoService],
})
export class ModeloModule {}
