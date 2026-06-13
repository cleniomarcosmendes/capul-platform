import { Module } from '@nestjs/common';
import { FrotaController } from './frota.controller.js';
import { FrotaService } from './frota.service.js';

@Module({
  controllers: [FrotaController],
  providers: [FrotaService],
})
export class FrotaModule {}
