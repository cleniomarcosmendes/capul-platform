import { Module } from '@nestjs/common';
import { SefazModule } from '../sefaz/sefaz.module.js';
import { AmbienteModule } from '../ambiente/ambiente.module.js';
import { NfeModule } from '../nfe/nfe.module.js';
import { CteController } from './cte.controller.js';
import { CteService } from './cte.service.js';
import { CteParserService } from './parsers/cte-parser.service.js';
import { DacteGeneratorService } from './pdf/dacte-generator.service.js';

@Module({
  imports: [SefazModule, AmbienteModule, NfeModule],
  controllers: [CteController],
  providers: [CteService, CteParserService, DacteGeneratorService],
  exports: [CteParserService, DacteGeneratorService],
})
export class CteModule {}
