import { Module } from '@nestjs/common';
import { RfbWebdavService } from './rfb-webdav.service.js';
import { RfbDeteccaoService } from './rfb-deteccao.service.js';
import { RfbImportacaoService } from './rfb-importacao.service.js';
import { RfbCronService } from './rfb-cron.service.js';
import { RfbCruzamentoService } from './rfb-cruzamento.service.js';
import { RfbConsultaService } from './rfb-consulta.service.js';
import { RfbController } from './rfb.controller.js';

// Sub-módulo "Base Pública CNPJ (RFB)" dentro do Fiscal.
// F1.2: cliente WebDAV + detecção. F1.3 import, F1.4 cron+UI, F1.5 cruzamento.
@Module({
  controllers: [RfbController],
  providers: [RfbWebdavService, RfbDeteccaoService, RfbImportacaoService, RfbCronService, RfbCruzamentoService, RfbConsultaService],
  exports: [RfbWebdavService, RfbDeteccaoService, RfbImportacaoService, RfbCruzamentoService, RfbConsultaService],
})
export class RfbModule {}
