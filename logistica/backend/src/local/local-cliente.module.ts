import { Module } from '@nestjs/common';
import { LocalClienteController } from './local-cliente.controller.js';
import { LocalClienteService } from './local-cliente.service.js';

// Locais geolocalizados do cliente (Fase A geo). Exporta o service para o SupervisorModule
// (e futuramente a Frota) dispararem a consolidação após cada marcação.
@Module({
  controllers: [LocalClienteController],
  providers: [LocalClienteService],
  exports: [LocalClienteService],
})
export class LocalClienteModule {}
