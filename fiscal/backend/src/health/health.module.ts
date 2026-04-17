import { Module } from '@nestjs/common';
import { AlertasModule } from '../alertas/alertas.module.js';
import { SefazModule } from '../sefaz/sefaz.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [AlertasModule, SefazModule],
  controllers: [HealthController],
})
export class HealthModule {}
