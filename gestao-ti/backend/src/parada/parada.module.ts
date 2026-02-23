import { Module } from '@nestjs/common';
import { ParadaController } from './parada.controller';
import { ParadaService } from './parada.service';

@Module({
  controllers: [ParadaController],
  providers: [ParadaService],
  exports: [ParadaService],
})
export class ParadaModule {}
