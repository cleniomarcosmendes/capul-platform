import { Module } from '@nestjs/common';
import { ChamadoController } from './chamado.controller.js';
import { ChamadoService } from './chamado.service.js';
import { NotificacaoModule } from '../notificacao/notificacao.module.js';

@Module({
  imports: [NotificacaoModule],
  controllers: [ChamadoController],
  providers: [ChamadoService],
  exports: [ChamadoService],
})
export class ChamadoModule {}
