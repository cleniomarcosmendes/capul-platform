import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { AcervoController } from './acervo.controller.js';
import { AcervoService } from './acervo.service.js';
import { ClassificacaoController } from './classificacao.controller.js';
import { ClassificacaoService } from './classificacao.service.js';
import { QuestaoController } from './questao.controller.js';
import { QuestaoService } from './questao.service.js';

@Module({
  imports: [AuditoriaModule],
  controllers: [AcervoController, ClassificacaoController, QuestaoController],
  providers: [AcervoService, ClassificacaoService, QuestaoService],
})
export class AcervoModule {}
