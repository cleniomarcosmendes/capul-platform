import { Global, Module } from '@nestjs/common';
import { ProtheusClienteService } from './protheus-cliente.service.js';
import { ProtheusCondutorService } from './protheus-condutor.service.js';

@Global()
@Module({
  providers: [ProtheusClienteService, ProtheusCondutorService],
  exports: [ProtheusClienteService, ProtheusCondutorService],
})
export class ProtheusModule {}
