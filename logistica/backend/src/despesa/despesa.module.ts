import { Module } from '@nestjs/common';
import { CofreModule } from '../cofre/cofre.module.js';
import { CoreModule } from '../core/core.module.js';
import { DespesaController } from './despesa.controller.js';
import { DespesaService } from './despesa.service.js';

// Importa o CofreModule p/ reusar o CofreStorageService (object store MinIO) no
// recibo de despesa — só o binário; o metadado (objectKey/hash/mime) fica no
// próprio registro de despesa, no schema logistica. CoreModule p/ resolver
// nomes de departamento na Análise (read-only do schema core).
@Module({
  imports: [CofreModule, CoreModule],
  controllers: [DespesaController],
  providers: [DespesaService],
})
export class DespesaModule {}
