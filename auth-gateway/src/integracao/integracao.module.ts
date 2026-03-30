import { Module } from '@nestjs/common';
import { IntegracaoController } from './integracao.controller';
import { IntegracaoInternalController } from './integracao-internal.controller';
import { IntegracaoService } from './integracao.service';

@Module({
  controllers: [IntegracaoController, IntegracaoInternalController],
  providers: [IntegracaoService],
  exports: [IntegracaoService],
})
export class IntegracaoModule {}
