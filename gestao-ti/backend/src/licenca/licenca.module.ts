import { Module } from '@nestjs/common';
import { LicencaController } from './licenca.controller.js';
import { LicencaService } from './licenca.service.js';
import { ProtheusModule } from '../protheus/protheus.module.js';

@Module({
  imports: [ProtheusModule],
  controllers: [LicencaController],
  providers: [LicencaService],
  exports: [LicencaService],
})
export class LicencaModule {}
