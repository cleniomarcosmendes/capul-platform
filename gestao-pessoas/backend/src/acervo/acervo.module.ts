import { Module } from '@nestjs/common';
import { AcervoController } from './acervo.controller.js';
import { AcervoService } from './acervo.service.js';

@Module({ controllers: [AcervoController], providers: [AcervoService] })
export class AcervoModule {}
