import { Module } from '@nestjs/common';
import { OrdemServicoController } from './ordem-servico.controller.js';
import { OrdemServicoService } from './ordem-servico.service.js';

@Module({
  controllers: [OrdemServicoController],
  providers: [OrdemServicoService],
  exports: [OrdemServicoService],
})
export class OrdemServicoModule {}
