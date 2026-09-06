import { Module } from '@nestjs/common';
import { DesignacaoController } from './designacao.controller.js';
import { DesignacaoService } from './designacao.service.js';

@Module({ controllers: [DesignacaoController], providers: [DesignacaoService], exports: [DesignacaoService] })
export class DesignacaoModule {}
