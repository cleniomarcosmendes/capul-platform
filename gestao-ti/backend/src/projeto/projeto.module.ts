import { Module } from '@nestjs/common';
import { ProjetoController } from './projeto.controller';
import { ProjetoService } from './projeto.service';
import { NotificacaoModule } from '../notificacao/notificacao.module.js';
import { ProjetoHelpersService } from './services/projeto-helpers.service.js';
import { ProjetoCoreService } from './services/projeto-core.service.js';
import { ProjetoFaseService } from './services/projeto-fase.service.js';
import { ProjetoMembroService } from './services/projeto-membro.service.js';
import { ProjetoAtividadeService } from './services/projeto-atividade.service.js';
import { ProjetoPendenciaService } from './services/projeto-pendencia.service.js';
import { ProjetoTempoService } from './services/projeto-tempo.service.js';
import { ProjetoFinanceiroService } from './services/projeto-financeiro.service.js';
import { ProjetoComplementoService } from './services/projeto-complemento.service.js';

@Module({
  imports: [NotificacaoModule],
  controllers: [ProjetoController],
  providers: [
    ProjetoHelpersService,
    ProjetoCoreService,
    ProjetoFaseService,
    ProjetoMembroService,
    ProjetoAtividadeService,
    ProjetoPendenciaService,
    ProjetoTempoService,
    ProjetoFinanceiroService,
    ProjetoComplementoService,
    ProjetoService,
  ],
  exports: [ProjetoService],
})
export class ProjetoModule {}
