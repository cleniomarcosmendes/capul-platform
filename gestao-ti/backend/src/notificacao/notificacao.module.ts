import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { NotificacaoService } from './notificacao.service.js';
import { NotificacaoController } from './notificacao.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [NotificacaoController],
  providers: [NotificacaoService],
  exports: [NotificacaoService],
})
export class NotificacaoModule {}
