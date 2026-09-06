import { Module } from '@nestjs/common';
import { CicloController } from './ciclo.controller.js';
import { CicloService } from './ciclo.service.js';

@Module({ controllers: [CicloController], providers: [CicloService], exports: [CicloService] })
export class CicloModule {}
