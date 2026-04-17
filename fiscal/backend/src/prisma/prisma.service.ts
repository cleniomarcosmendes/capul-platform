import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Schema `core` é leitura-apenas — bloqueia create/update/delete/upsert
 * para qualquer model marcado com @@schema("core").
 *
 * Mesmo padrão do gestao-ti/backend.
 */
const readOnlyCoreExtension = Prisma.defineExtension({
  name: 'readOnlyCore',
  query: {
    $allModels: {
      async create({ model, args, query }) {
        if (isCoreModel(model)) throw new Error(`SCHEMA core é read-only — bloqueado create em ${model}`);
        return query(args);
      },
      async createMany({ model, args, query }) {
        if (isCoreModel(model)) throw new Error(`SCHEMA core é read-only — bloqueado createMany em ${model}`);
        return query(args);
      },
      async update({ model, args, query }) {
        if (isCoreModel(model)) throw new Error(`SCHEMA core é read-only — bloqueado update em ${model}`);
        return query(args);
      },
      async updateMany({ model, args, query }) {
        if (isCoreModel(model)) throw new Error(`SCHEMA core é read-only — bloqueado updateMany em ${model}`);
        return query(args);
      },
      async delete({ model, args, query }) {
        if (isCoreModel(model)) throw new Error(`SCHEMA core é read-only — bloqueado delete em ${model}`);
        return query(args);
      },
      async deleteMany({ model, args, query }) {
        if (isCoreModel(model)) throw new Error(`SCHEMA core é read-only — bloqueado deleteMany em ${model}`);
        return query(args);
      },
      async upsert({ model, args, query }) {
        if (isCoreModel(model)) throw new Error(`SCHEMA core é read-only — bloqueado upsert em ${model}`);
        return query(args);
      },
    },
  },
});

const CORE_MODELS = new Set(['UsuarioCore', 'UsuarioModuloCore']);
function isCoreModel(model: string): boolean {
  return CORE_MODELS.has(model);
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private extended = this.$extends(readOnlyCoreExtension);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma conectado (schemas: fiscal, core)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma desconectado');
  }

  /**
   * Retorna o client com a extensão read-only aplicada.
   * Use sempre via `prisma.client.modelName.method(...)` em vez de
   * `prisma.modelName.method(...)` para garantir o bloqueio.
   */
  get client() {
    return this.extended;
  }
}
