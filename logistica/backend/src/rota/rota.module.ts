import { Module } from '@nestjs/common';
import { GeocodeService } from './geocode.service.js';
import { OsrmService } from './osrm.service.js';
import { RotaService } from './rota.service.js';

@Module({
  providers: [GeocodeService, OsrmService, RotaService],
  exports: [RotaService, GeocodeService],
})
export class RotaModule {}
