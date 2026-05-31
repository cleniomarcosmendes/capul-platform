import { Module } from '@nestjs/common';
import { ViagemController } from './viagem.controller.js';
import { ViagemService } from './viagem.service.js';

@Module({
  controllers: [ViagemController],
  providers: [ViagemService],
})
export class ViagemModule {}
