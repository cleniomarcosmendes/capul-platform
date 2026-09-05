import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService do módulo Gestão de Pessoas (schema `rh`).
 *
 * O acesso ao schema `core` (filiais/usuarios/departamentos) é READ-ONLY via
 * `$queryRaw` no CoreLookupService — o Prisma do gestao-pessoas não declara esses
 * models, então não há caminho de escrita em `core` por aqui.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma conectado (schema: rh)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma desconectado');
  }
}
