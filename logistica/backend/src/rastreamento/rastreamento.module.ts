import { Module } from '@nestjs/common';
import { RastreamentoController } from './rastreamento.controller.js';
import { RastreamentoService } from './rastreamento.service.js';
import { RastreamentoPurgaService } from './rastreamento-purga.service.js';

@Module({
  controllers: [RastreamentoController],
  providers: [RastreamentoService, RastreamentoPurgaService],
})
export class RastreamentoModule {}
