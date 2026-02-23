import { Module } from '@nestjs/common';
import { AtivoController } from './ativo.controller.js';
import { AtivoService } from './ativo.service.js';

@Module({
  controllers: [AtivoController],
  providers: [AtivoService],
  exports: [AtivoService],
})
export class AtivoModule {}
