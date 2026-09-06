import { Module } from '@nestjs/common';
import { CatalogoController } from './catalogo.controller.js';
import { CatalogoService } from './catalogo.service.js';

@Module({ controllers: [CatalogoController], providers: [CatalogoService], exports: [CatalogoService] })
export class CatalogoModule {}
