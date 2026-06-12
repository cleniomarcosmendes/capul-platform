import { Module } from '@nestjs/common';
import { CofreModule } from '../cofre/cofre.module.js';
import { RotaModule } from '../rota/rota.module.js';
import { EntregaController } from './entrega.controller.js';
import { EntregaService } from './entrega.service.js';

@Module({
  imports: [CofreModule, RotaModule],
  controllers: [EntregaController],
  providers: [EntregaService],
})
export class EntregaModule {}
