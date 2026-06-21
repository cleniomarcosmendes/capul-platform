import { Module } from '@nestjs/common';
import { SacIndicadoresController } from './sac-indicadores.controller.js';
import { SacIndicadoresService } from './sac-indicadores.service.js';

/** SAC 4c — indicadores. PrismaModule é @Global. */
@Module({
  controllers: [SacIndicadoresController],
  providers: [SacIndicadoresService],
})
export class SacIndicadoresModule {}
