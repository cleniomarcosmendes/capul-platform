import { Module } from '@nestjs/common';
import { CadastroController } from './cadastro.controller.js';
import { ClienteLocalService } from './cliente-local.service.js';
import { EnderecoService } from './endereco.service.js';
import { BuscaService } from './busca.service.js';
import { CepService } from './cep.service.js';

@Module({
  controllers: [CadastroController],
  providers: [ClienteLocalService, EnderecoService, BuscaService, CepService],
})
export class CadastroModule {}
