import { Module } from '@nestjs/common';
import { DispositivoSessaoService } from './dispositivo-sessao.service';
import { DispositivoSessaoController } from './dispositivo-sessao.controller';

@Module({
  controllers: [DispositivoSessaoController],
  providers: [DispositivoSessaoService],
  exports: [DispositivoSessaoService], // consumido pelo AuthService (login/refresh mobile)
})
export class DispositivoSessaoModule {}
