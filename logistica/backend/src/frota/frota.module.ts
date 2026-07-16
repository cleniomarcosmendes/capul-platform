import { Module } from '@nestjs/common';
import { LocalClienteModule } from '../local/local-cliente.module.js';
import { FrotaController } from './frota.controller.js';
import { FrotaService } from './frota.service.js';

@Module({
  imports: [LocalClienteModule],
  controllers: [FrotaController],
  providers: [FrotaService],
})
export class FrotaModule {}
