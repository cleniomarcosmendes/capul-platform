import { Module } from '@nestjs/common';
import { ProjetoController } from './projeto.controller';
import { ProjetoService } from './projeto.service';
import { NotificacaoModule } from '../notificacao/notificacao.module.js';

@Module({
  imports: [NotificacaoModule],
  controllers: [ProjetoController],
  providers: [ProjetoService],
  exports: [ProjetoService],
})
export class ProjetoModule {}
