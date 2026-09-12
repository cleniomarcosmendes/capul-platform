import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { AcervoController } from './acervo.controller.js';
import { AcervoService } from './acervo.service.js';
import { ClassificacaoController } from './classificacao.controller.js';
import { ClassificacaoService } from './classificacao.service.js';

@Module({
  imports: [AuditoriaModule],
  controllers: [AcervoController, ClassificacaoController],
  providers: [AcervoService, ClassificacaoService],
})
export class AcervoModule {}
