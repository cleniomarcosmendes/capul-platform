import { Module } from '@nestjs/common';
import { CompraController } from './compra.controller';
import { CompraService } from './compra.service';
import { CompraConfigService } from './services/compra-config.service';
import { CompraNotaFiscalService } from './services/compra-nota-fiscal.service';

@Module({
  controllers: [CompraController],
  providers: [
    CompraConfigService,
    CompraNotaFiscalService,
    CompraService,
  ],
  exports: [CompraService],
})
export class CompraModule {}
