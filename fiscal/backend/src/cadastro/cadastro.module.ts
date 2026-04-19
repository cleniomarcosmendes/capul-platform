import { Module } from '@nestjs/common';
import { SefazModule } from '../sefaz/sefaz.module.js';
import { AmbienteModule } from '../ambiente/ambiente.module.js';
import { CadastroController } from './cadastro.controller.js';
import { CadastroService } from './cadastro.service.js';
import { ReceitaClient } from './receita.client.js';
import { DivergenciaController } from './divergencia.controller.js';

@Module({
  imports: [SefazModule, AmbienteModule],
  controllers: [CadastroController, DivergenciaController],
  providers: [CadastroService, ReceitaClient],
  exports: [CadastroService],
})
export class CadastroModule {}
