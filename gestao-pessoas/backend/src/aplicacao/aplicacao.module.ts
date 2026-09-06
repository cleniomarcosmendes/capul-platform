import { Module } from '@nestjs/common';
import { AplicacaoController } from './aplicacao.controller.js';
import { AplicacaoService } from './aplicacao.service.js';

@Module({ controllers: [AplicacaoController], providers: [AplicacaoService], exports: [AplicacaoService] })
export class AplicacaoModule {}
