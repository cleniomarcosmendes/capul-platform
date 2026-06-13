import { Module } from '@nestjs/common';
import { DespesaController } from './despesa.controller.js';
import { DespesaService } from './despesa.service.js';

@Module({
  controllers: [DespesaController],
  providers: [DespesaService],
})
export class DespesaModule {}
