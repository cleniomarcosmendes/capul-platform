import { Module } from '@nestjs/common';
import { LicencaController } from './licenca.controller.js';
import { LicencaService } from './licenca.service.js';

@Module({
  controllers: [LicencaController],
  providers: [LicencaService],
  exports: [LicencaService],
})
export class LicencaModule {}
