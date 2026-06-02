import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient as PrismaClientRfb } from '@prisma-rfb/client';

/**
 * Cliente Prisma da base RFB em BANCO DEDICADO (capul-db-rfb / RFB_DATABASE_URL).
 * Decisão 02/06: a base RFB (Receita Dados Abertos, ~99M registros) vive em
 * máquina/banco exclusivo, separada do `capul-db` operacional — desempenho de
 * consulta e liberdade total de SQL. Sem extensão read-only (a importação
 * escreve nas tabelas rfb).
 */
@Injectable()
export class PrismaRfbService extends PrismaClientRfb implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaRfbService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma RFB conectado (banco dedicado capul_rfb)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma RFB desconectado');
  }
}
