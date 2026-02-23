import { Module } from '@nestjs/common';
import { SlaController } from './sla.controller.js';
import { SlaService } from './sla.service.js';

@Module({
  controllers: [SlaController],
  providers: [SlaService],
  exports: [SlaService],
})
export class SlaModule {}
