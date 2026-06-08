import { Module } from '@nestjs/common';
import { PrismaCofreModule } from '../prisma/prisma-cofre.module.js';
import { CofreStorageService } from './cofre-storage.service.js';
import { CofreService } from './cofre.service.js';
import { ComprovanteController } from './comprovante.controller.js';

/**
 * Cofre de comprovante de entrega (Fase 1b). Expõe o CofreService p/ a baixa
 * de entrega (1b.3) gravar a prova e o ComprovanteController p/ a consulta do
 * financeiro (1b.4) lê-la. O PrismaCofreModule é @Global; o store fica
 * encapsulado aqui.
 */
@Module({
  imports: [PrismaCofreModule],
  controllers: [ComprovanteController],
  providers: [CofreStorageService, CofreService],
  exports: [CofreService],
})
export class CofreModule {}
