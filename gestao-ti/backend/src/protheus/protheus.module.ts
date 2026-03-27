import { Module } from '@nestjs/common';
import { ProtheusController } from './protheus.controller.js';
import { ProtheusService } from './protheus.service.js';

@Module({
  controllers: [ProtheusController],
  providers: [ProtheusService],
  exports: [ProtheusService],
})
export class ProtheusModule {}
