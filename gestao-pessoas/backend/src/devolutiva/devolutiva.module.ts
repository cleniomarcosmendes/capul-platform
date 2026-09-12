import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { DevolutivaController } from './devolutiva.controller.js';
import { DevolutivaService } from './devolutiva.service.js';

@Module({
  imports: [AuditoriaModule],
  controllers: [DevolutivaController],
  providers: [DevolutivaService],
  exports: [DevolutivaService],
})
export class DevolutivaModule {}
