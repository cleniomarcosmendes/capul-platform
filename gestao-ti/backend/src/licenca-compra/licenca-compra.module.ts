import { Module } from '@nestjs/common';
import { LicencaCompraController } from './licenca-compra.controller.js';
import { LicencaCompraService } from './licenca-compra.service.js';

@Module({
  controllers: [LicencaCompraController],
  providers: [LicencaCompraService],
  exports: [LicencaCompraService],
})
export class LicencaCompraModule {}
