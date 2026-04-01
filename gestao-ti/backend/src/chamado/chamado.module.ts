import { Module } from '@nestjs/common';
import { ChamadoController } from './chamado.controller.js';
import { ChamadoService } from './chamado.service.js';
import { ChamadoHelpersService } from './services/chamado-helpers.service.js';
import { ChamadoTempoService } from './services/chamado-tempo.service.js';
import { ChamadoCoreService } from './services/chamado-core.service.js';
import { ChamadoColaboradorService } from './services/chamado-colaborador.service.js';
import { ChamadoAnexoService } from './services/chamado-anexo.service.js';
import { NotificacaoModule } from '../notificacao/notificacao.module.js';

@Module({
  imports: [NotificacaoModule],
  controllers: [ChamadoController],
  providers: [
    ChamadoHelpersService,
    ChamadoTempoService,
    ChamadoCoreService,
    ChamadoColaboradorService,
    ChamadoAnexoService,
    ChamadoService,
  ],
  exports: [ChamadoService],
})
export class ChamadoModule {}
