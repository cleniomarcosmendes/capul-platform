import { Module } from '@nestjs/common';
import { GeocodeService } from './geocode.service.js';
import { RotaService } from './rota.service.js';

@Module({
  providers: [GeocodeService, RotaService],
  exports: [RotaService],
})
export class RotaModule {}
