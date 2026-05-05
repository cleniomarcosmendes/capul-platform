import { Module } from '@nestjs/common';
import { SefazModule } from '../sefaz/sefaz.module.js';
import { AmbienteModule } from '../ambiente/ambiente.module.js';
import { NfeModule } from '../nfe/nfe.module.js';
import { CteController } from './cte.controller.js';
import { CteService } from './cte.service.js';
import { CteParserService } from './parsers/cte-parser.service.js';
import { DacteGeneratorService } from './pdf/dacte-generator.service.js';
import { NsuControleService } from './distribuicao/nsu-controle.service.js';
import { DistribuicaoNsuService } from './distribuicao/distribuicao-nsu.service.js';
import { CteDocumentoService } from './distribuicao/cte-documento.service.js';
import { CteLoteConsultaService } from './distribuicao/cte-lote-consulta.service.js';
import { CteSchedulerService } from './distribuicao/cte-scheduler.service.js';

@Module({
  // LimiteDiarioModule é @Global no app.module — não precisa importar.
  // PrismaModule também é @Global.
  // ScheduleModule já registrado no app.module (usado por outros schedulers).
  imports: [SefazModule, AmbienteModule, NfeModule],
  controllers: [CteController],
  providers: [
    CteService,
    CteParserService,
    DacteGeneratorService,
    NsuControleService,
    DistribuicaoNsuService,
    CteDocumentoService,
    CteLoteConsultaService,
    CteSchedulerService,
  ],
  exports: [CteParserService, DacteGeneratorService],
})
export class CteModule {}
