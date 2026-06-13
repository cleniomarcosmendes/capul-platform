import { Module } from '@nestjs/common';
import { VeiculoController } from './veiculo.controller.js';
import { VeiculoService } from './veiculo.service.js';

@Module({
  controllers: [VeiculoController],
  providers: [VeiculoService],
})
export class VeiculoModule {}
