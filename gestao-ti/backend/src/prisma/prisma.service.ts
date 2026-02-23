import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { readOnlyCoreExtension } from './prisma-read-only.middleware.js';

const ExtendedPrismaClient = class extends PrismaClient {
  constructor() {
    super();
  }
};

const ExtendedClient = Object.assign(
  ExtendedPrismaClient,
  ExtendedPrismaClient.prototype,
);

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private _extended: ReturnType<typeof this.$extends> | undefined;

  get extended() {
    if (!this._extended) {
      this._extended = this.$extends(readOnlyCoreExtension);
    }
    return this._extended;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
