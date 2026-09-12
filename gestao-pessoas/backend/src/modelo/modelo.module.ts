import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { VersaoController } from './versao.controller.js';
import { VersaoService } from './versao.service.js';

@Module({
  imports: [AuditoriaModule],
  controllers: [VersaoController],
  providers: [VersaoService],
})
export class ModeloModule {}
