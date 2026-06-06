import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { PrismaModule } from './prisma/prisma.module.js';
import { CoreModule } from './core/core.module.js';
import { ProtheusModule } from './protheus/protheus.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { CadastroModule } from './cadastro/cadastro.module.js';
import { EntregaModule } from './entrega/entrega.module.js';
import { VeiculoModule } from './veiculo/veiculo.module.js';
import { ViagemModule } from './viagem/viagem.module.js';
import { PainelModule } from './painel/painel.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    CoreModule,
    ProtheusModule,
    AuthModule,
    HealthModule,
    CadastroModule,
    EntregaModule,
    VeiculoModule,
    ViagemModule,
    PainelModule,
  ],
  providers: [
    // Ordem: rate-limit → autenticação (JWT) → autorização (roles).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
