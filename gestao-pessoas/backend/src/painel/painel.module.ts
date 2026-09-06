import { Module } from '@nestjs/common';
import { ApuracaoModule } from '../apuracao/apuracao.module.js';
import { DesignacaoModule } from '../designacao/designacao.module.js';
import { PainelController } from './painel.controller.js';
import { PainelService } from './painel.service.js';

@Module({
  imports: [ApuracaoModule, DesignacaoModule],
  controllers: [PainelController],
  providers: [PainelService],
})
export class PainelModule {}
