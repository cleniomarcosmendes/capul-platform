import { Module } from '@nestjs/common';
import { AvaliacaoAcessoService } from './avaliacao-acesso.service.js';

@Module({ providers: [AvaliacaoAcessoService], exports: [AvaliacaoAcessoService] })
export class AvaliacaoModule {}
