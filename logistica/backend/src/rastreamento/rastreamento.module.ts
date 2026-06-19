import { Module } from '@nestjs/common';
import { RastreamentoController } from './rastreamento.controller.js';
import { RastreamentoService } from './rastreamento.service.js';

@Module({
  controllers: [RastreamentoController],
  providers: [RastreamentoService],
})
export class RastreamentoModule {}
