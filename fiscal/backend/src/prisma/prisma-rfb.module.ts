import { Global, Module } from '@nestjs/common';
import { PrismaRfbService } from './prisma-rfb.service.js';

/**
 * Módulo global do cliente Prisma da base RFB dedicada (capul-db-rfb).
 * Injetável em qualquer serviço que consulte a RFB (rfb-*, cadastro).
 */
@Global()
@Module({
  providers: [PrismaRfbService],
  exports: [PrismaRfbService],
})
export class PrismaRfbModule {}
