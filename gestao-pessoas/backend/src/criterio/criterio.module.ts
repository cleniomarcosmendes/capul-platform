import { Module } from '@nestjs/common';
import { CriterioController } from './criterio.controller.js';
import { CriterioService } from './criterio.service.js';
import { DistribuicaoService } from './distribuicao.service.js';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';

@Module({
  imports: [AuditoriaModule],
  controllers: [CriterioController],
  providers: [CriterioService, DistribuicaoService],
})
export class CriterioModule {}
