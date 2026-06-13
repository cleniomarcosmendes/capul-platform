import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient as PrismaClientCofre } from '@prisma-cofre/client';

/**
 * Cliente Prisma do COFRE de comprovante em BANCO DEDICADO/ISOLADO
 * (capul-db-cofre / COFRE_DATABASE_URL).
 *
 * O cofre guarda a PROVA DE ENTREGA, que lastreia a cobrança a prazo — ativo
 * insubstituível (retenção 5 anos, backup obrigatório). Por isso vive separado
 * do schema `logistica` (operacional, reconstruível), espelhando o padrão do
 * PrismaRfbService do Fiscal.
 *
 * Boot RESILIENTE: se o cofre estiver fora no boot, NÃO derruba o módulo — o
 * fluxo operacional (cadastro/montagem/despacho) segue; só a baixa COM prova e
 * a consulta de comprovante ficam indisponíveis até o cofre responder
 * (reconexão lazy do Prisma na 1ª query).
 */
@Injectable()
export class PrismaCofreService extends PrismaClientCofre implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaCofreService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma COFRE conectado (banco dedicado)');
    } catch (e) {
      this.logger.error(
        `Prisma COFRE NÃO conectou no boot (COFRE_DATABASE_URL): ${(e as Error).message}. ` +
          'Baixa com prova e consulta de comprovante ficam indisponíveis até o cofre responder (reconexão lazy).',
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma COFRE desconectado');
  }
}
