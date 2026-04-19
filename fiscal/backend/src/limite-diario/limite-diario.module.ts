import { Global, Module } from '@nestjs/common';
import { LimiteDiarioService } from './limite-diario.service.js';
import { LimiteDiarioController } from './limite-diario.controller.js';

@Global()
@Module({
  controllers: [LimiteDiarioController],
  providers: [LimiteDiarioService],
  exports: [LimiteDiarioService],
})
export class LimiteDiarioModule {}
