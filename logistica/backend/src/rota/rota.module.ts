import { Module } from '@nestjs/common';
import { GeocodeService } from './geocode.service.js';
import { OsrmService } from './osrm.service.js';
import { RotaService } from './rota.service.js';
import { LocalAprendidoService } from './local-aprendido.service.js';

@Module({
  providers: [GeocodeService, OsrmService, RotaService, LocalAprendidoService],
  exports: [RotaService, GeocodeService, LocalAprendidoService],
})
export class RotaModule {}
