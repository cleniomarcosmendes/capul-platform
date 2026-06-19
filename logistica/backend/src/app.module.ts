import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';

import { PrismaModule } from './prisma/prisma.module.js';
import { PrismaCofreModule } from './prisma/prisma-cofre.module.js';
import { CofreModule } from './cofre/cofre.module.js';
import { CoreModule } from './core/core.module.js';
import { ProtheusModule } from './protheus/protheus.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { CadastroModule } from './cadastro/cadastro.module.js';
import { EntregaModule } from './entrega/entrega.module.js';
import { VeiculoModule } from './veiculo/veiculo.module.js';
import { ViagemModule } from './viagem/viagem.module.js';
import { FrotaModule } from './frota/frota.module.js';
import { DespesaModule } from './despesa/despesa.module.js';
import { PainelModule } from './painel/painel.module.js';
import { RastreamentoModule } from './rastreamento/rastreamento.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Logging estruturado (JSON) + correlation id por request (x-request-id),
    // mesmo padrão de gestao-ti/fiscal (observabilidade da plataforma).
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true, translateTime: 'HH:MM:ss.l' } },
        genReqId: (req, res) => {
          const existing = req.headers['x-request-id'];
          const id = (typeof existing === 'string' && existing) || randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        customLogLevel: (_req, res, err) => {
          if (err || res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
        serializers: {
          req: (req) => ({ id: req.id, method: req.method, url: req.url, remoteAddress: req.remoteAddress }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
        customProps: (req) => ({ reqId: (req as { id?: string }).id }),
        autoLogging: {
          ignore: (req) => req.url === '/api/v1/logistica/health' || req.url === '/health',
        },
        redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-api-key"]'],
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    PrismaCofreModule,
    CofreModule,
    CoreModule,
    ProtheusModule,
    AuthModule,
    HealthModule,
    CadastroModule,
    EntregaModule,
    VeiculoModule,
    ViagemModule,
    FrotaModule,
    DespesaModule,
    PainelModule,
    RastreamentoModule,
  ],
  providers: [
    // Ordem: rate-limit → autenticação (JWT) → autorização (roles).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
