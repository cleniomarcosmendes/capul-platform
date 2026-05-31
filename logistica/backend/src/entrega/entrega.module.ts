import { Module } from '@nestjs/common';
import { EntregaController } from './entrega.controller.js';
import { EntregaService } from './entrega.service.js';

@Module({
  controllers: [EntregaController],
  providers: [EntregaService],
})
export class EntregaModule {}
