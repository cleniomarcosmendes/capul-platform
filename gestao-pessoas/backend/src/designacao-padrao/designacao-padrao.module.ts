import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { DesignacaoPadraoController } from './designacao-padrao.controller.js';
import { DesignacaoPadraoService } from './designacao-padrao.service.js';

@Module({
  imports: [AuditoriaModule],
  controllers: [DesignacaoPadraoController],
  providers: [DesignacaoPadraoService],
  exports: [DesignacaoPadraoService],
})
export class DesignacaoPadraoModule {}
