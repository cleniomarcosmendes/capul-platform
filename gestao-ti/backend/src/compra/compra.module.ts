import { Module } from '@nestjs/common';
import { CompraController } from './compra.controller';
import { CompraService } from './compra.service';
import { CompraConfigService } from './services/compra-config.service';
import { CompraNotaFiscalService } from './services/compra-nota-fiscal.service';
import { FiscalNfeClient } from './services/fiscal-nfe.client';

@Module({
  controllers: [CompraController],
  providers: [
    CompraConfigService,
    CompraNotaFiscalService,
    CompraService,
    FiscalNfeClient,
  ],
  exports: [CompraService],
})
export class CompraModule {}
