import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { DesignacaoModule } from '../designacao/designacao.module.js';
import { DesignacaoPadraoController } from './designacao-padrao.controller.js';
import { DesignacaoPadraoService } from './designacao-padrao.service.js';

@Module({
  imports: [AuditoriaModule, DesignacaoModule],
  controllers: [DesignacaoPadraoController],
  providers: [DesignacaoPadraoService],
  exports: [DesignacaoPadraoService],
})
export class DesignacaoPadraoModule {}
