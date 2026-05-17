import { Module } from '@nestjs/common';
import { RfbWebdavService } from './rfb-webdav.service.js';
import { RfbDeteccaoService } from './rfb-deteccao.service.js';
import { RfbController } from './rfb.controller.js';

// Sub-módulo "Base Pública CNPJ (RFB)" dentro do Fiscal.
// F1.2: cliente WebDAV + detecção. F1.3 import, F1.4 cron+UI, F1.5 cruzamento.
@Module({
  controllers: [RfbController],
  providers: [RfbWebdavService, RfbDeteccaoService],
  exports: [RfbWebdavService, RfbDeteccaoService],
})
export class RfbModule {}
