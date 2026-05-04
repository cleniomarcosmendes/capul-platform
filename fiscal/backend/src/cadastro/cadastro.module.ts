import { Module } from '@nestjs/common';
import { SefazModule } from '../sefaz/sefaz.module.js';
import { AmbienteModule } from '../ambiente/ambiente.module.js';
import { CadastroController } from './cadastro.controller.js';
import { CadastroService } from './cadastro.service.js';
import { ReceitaClient } from './receita.client.js';
import { DivergenciaController } from './divergencia.controller.js';
import { DivergenciaService } from './divergencia.service.js';
import { ComprovanteIeGeneratorService } from './pdf/comprovante-ie-generator.service.js';

@Module({
  imports: [SefazModule, AmbienteModule],
  controllers: [CadastroController, DivergenciaController],
  providers: [CadastroService, ReceitaClient, DivergenciaService, ComprovanteIeGeneratorService],
  exports: [CadastroService, DivergenciaService, ComprovanteIeGeneratorService],
})
export class CadastroModule {}
