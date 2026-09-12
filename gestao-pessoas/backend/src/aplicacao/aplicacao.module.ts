import { Module } from '@nestjs/common';
import { AplicacaoController } from './aplicacao.controller.js';
import { AplicacaoService } from './aplicacao.service.js';
import { DesignacaoModule } from '../designacao/designacao.module.js';

/**
 * ⚠️ `DesignacaoModule` entra porque o CARTÃO da aplicação concilia o público
 * (fora do ciclo × sem avaliador) pela MESMA régua do painel. Sem ciclo de
 * dependência: `DesignacaoService` não conhece `AplicacaoService`.
 */
@Module({
  imports: [DesignacaoModule],
  controllers: [AplicacaoController],
  providers: [AplicacaoService],
  exports: [AplicacaoService],
})
export class AplicacaoModule {}
