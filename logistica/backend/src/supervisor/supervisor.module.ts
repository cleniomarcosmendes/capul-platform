import { Module } from '@nestjs/common';
import { CofreModule } from '../cofre/cofre.module.js';
import { SupervisorController } from './supervisor.controller.js';
import { SupervisorService } from './supervisor.service.js';

// CofreModule: reusa o CofreStorageService (object store MinIO) p/ o comprovante
// da despesa do supervisor — só o binário; metadado (objectKey/hash/mime) fica no
// próprio registro (mesmo padrão da frota).
@Module({
  imports: [CofreModule],
  controllers: [SupervisorController],
  providers: [SupervisorService],
})
export class SupervisorModule {}
