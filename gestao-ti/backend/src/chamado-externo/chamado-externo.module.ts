import { Module } from '@nestjs/common';
import { ChamadoExternoController } from './chamado-externo.controller.js';
import { ChamadoExternoService } from './chamado-externo.service.js';

@Module({
  controllers: [ChamadoExternoController],
  providers: [ChamadoExternoService],
  exports: [ChamadoExternoService],
})
export class ChamadoExternoModule {}
