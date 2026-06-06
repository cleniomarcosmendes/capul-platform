import { Global, Module } from '@nestjs/common';
import { ProtheusClienteService } from './protheus-cliente.service.js';

@Global()
@Module({
  providers: [ProtheusClienteService],
  exports: [ProtheusClienteService],
})
export class ProtheusModule {}
