import { Module } from '@nestjs/common';
import { AmbienteController } from './ambiente.controller.js';
import { AmbienteService } from './ambiente.service.js';

@Module({
  controllers: [AmbienteController],
  providers: [AmbienteService],
  exports: [AmbienteService],
})
export class AmbienteModule {}
