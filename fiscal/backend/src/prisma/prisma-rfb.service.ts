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
    // Boot resiliente: se a RFB estiver fora no boot (ex.: banco dedicado em
    // outra máquina momentaneamente indisponível), NÃO derruba o módulo Fiscal
    // — a RFB é consultiva/degradável (NF-e/CT-e/Protheus seguem). O Prisma
    // reconecta lazy na 1ª query; consultas RFB falham graciosamente até lá.
    try {
      await this.$connect();
      this.logger.log('Prisma RFB conectado (banco dedicado)');
    } catch (e) {
      this.logger.error(
        `Prisma RFB NÃO conectou no boot (RFB_DATABASE_URL): ${(e as Error).message}. ` +
          'Consultas RFB ficarão indisponíveis até o banco responder (reconexão lazy).',
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma RFB desconectado');
  }
}
