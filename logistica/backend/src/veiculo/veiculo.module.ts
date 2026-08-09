import { Module } from '@nestjs/common';
import { VeiculoController } from './veiculo.controller.js';
import { VeiculoService } from './veiculo.service.js';
import { CoreModule } from '../core/core.module.js';

@Module({
  imports: [CoreModule],
  controllers: [VeiculoController],
  providers: [VeiculoService],
})
export class VeiculoModule {}
