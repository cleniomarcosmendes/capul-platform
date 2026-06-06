import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService do módulo Logística (schema `logistica`).
 *
 * O acesso ao schema `core` (filiais/usuarios/departamentos) é READ-ONLY via
 * `$queryRaw` no CoreLookupService — o Prisma da logística não declara esses
 * models, então não há caminho de escrita em `core` por aqui.
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
