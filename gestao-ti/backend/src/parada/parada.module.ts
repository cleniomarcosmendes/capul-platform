import { Module } from '@nestjs/common';
import { ParadaController } from './parada.controller';
import { ParadaService } from './parada.service';
import { ParadaAnexoService } from './parada-anexo.service';

@Module({
  controllers: [ParadaController],
  providers: [ParadaService, ParadaAnexoService],
  exports: [ParadaService],
})
export class ParadaModule {}
