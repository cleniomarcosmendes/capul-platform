import { Module } from '@nestjs/common';
import { ViagemController } from './viagem.controller.js';
import { ViagemService } from './viagem.service.js';
import { RotaModule } from '../rota/rota.module.js';

@Module({
  imports: [RotaModule],
  controllers: [ViagemController],
  providers: [ViagemService],
})
export class ViagemModule {}
