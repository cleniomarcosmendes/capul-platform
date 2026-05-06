import { Module } from '@nestjs/common';
import { PresencaController } from './presenca.controller';
import { PresencaService } from './presenca.service';

/**
 * Modulo de presenca: heartbeat de usuarios online e avisos da plataforma
 * (banner de manutencao). Depende de RedisModule (Global) e PrismaModule
 * (ja importados no AppModule).
 */
@Module({
  controllers: [PresencaController],
  providers: [PresencaService],
})
export class PresencaModule {}
