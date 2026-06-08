import { Global, Module } from '@nestjs/common';
import { PrismaCofreService } from './prisma-cofre.service.js';

/**
 * Módulo global do cliente Prisma do COFRE dedicado (capul-db-cofre).
 * Injetável em qualquer serviço que grave/consulte comprovante de entrega.
 */
@Global()
@Module({
  providers: [PrismaCofreService],
  exports: [PrismaCofreService],
})
export class PrismaCofreModule {}
