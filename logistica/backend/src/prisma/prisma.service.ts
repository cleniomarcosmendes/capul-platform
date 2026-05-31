import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService do módulo Logística (schema `logistica`).
 *
 * PR1: schema isolado, sem models de `core` ainda — quando a PR2 trouxer o
 * mirror read-only de core (usuarios/filiais/departamentos), adicionar aqui
 * a extensão de bloqueio de escrita em core (mesmo padrão de fiscal/gestao-ti).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma conectado (schema: logistica)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma desconectado');
  }
}
