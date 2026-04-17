import { Module } from '@nestjs/common';
import { SefazModule } from '../sefaz/sefaz.module.js';
import { AmbienteModule } from '../ambiente/ambiente.module.js';
import { NfeController } from './nfe.controller.js';
import { NfeService } from './nfe.service.js';
import { NfeParserService } from './parsers/nfe-parser.service.js';
import { DocumentoConsultaService } from './documento-consulta.service.js';
import { DocumentoEventoService } from './documento-evento.service.js';
import { DanfeGeneratorService } from './pdf/danfe-generator.service.js';

@Module({
  imports: [SefazModule, AmbienteModule],
  controllers: [NfeController],
  providers: [
    NfeService,
    NfeParserService,
    DocumentoConsultaService,
    DocumentoEventoService,
    DanfeGeneratorService,
  ],
  exports: [
    NfeParserService,
    DocumentoConsultaService,
    DocumentoEventoService,
    DanfeGeneratorService,
  ],
})
export class NfeModule {}
