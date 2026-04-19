import { Global, Module } from '@nestjs/common';
import { AlertasModule } from '../alertas/alertas.module.js';
import { LimiteDiarioService } from './limite-diario.service.js';
import { LimiteDiarioController } from './limite-diario.controller.js';

@Global()
@Module({
  imports: [AlertasModule],
  controllers: [LimiteDiarioController],
  providers: [LimiteDiarioService],
  exports: [LimiteDiarioService],
})
export class LimiteDiarioModule {}
