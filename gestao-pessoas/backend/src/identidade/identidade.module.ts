import { Global, Module } from '@nestjs/common';
import { IdentidadeService } from './identidade.service.js';

@Global()
@Module({ providers: [IdentidadeService], exports: [IdentidadeService] })
export class IdentidadeModule {}
