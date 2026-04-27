import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';

import { PrismaModule } from './prisma/prisma.module.js';
import { CryptoModule } from './common/crypto/crypto.module.js';
import { BullMqModule } from './bullmq/bullmq.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProtheusModule } from './protheus/protheus.module.js';
import { SefazModule } from './sefaz/sefaz.module.js';

import { HealthModule } from './health/health.module.js';
import { AmbienteModule } from './ambiente/ambiente.module.js';
import { CertificadoModule } from './certificado/certificado.module.js';
import { AlertasModule } from './alertas/alertas.module.js';
import { NfeModule } from './nfe/nfe.module.js';
import { CteModule } from './cte/cte.module.js';
import { CadastroModule } from './cadastro/cadastro.module.js';
import { CruzamentoModule } from './cruzamento/cruzamento.module.js';
import { RelatorioModule } from './relatorio/relatorio.module.js';
import { HistoricoModule } from './historico/historico.module.js';
import { LimiteDiarioModule } from './limite-diario/limite-diario.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { FiliaisModule } from './filiais/filiais.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Logs estruturados em JSON com correlation ID via X-Request-ID.
    // Auditoria observabilidade 26/04/2026 #1.
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
          ignore: (req) => req.url === '/api/v1/fiscal/health' || req.url === '/health',
        },
        redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-api-key"]'],
      },
    }),
    ThrottlerModule.forRoot([
      // default: 200 req/min por IP — protege endpoints gerais contra DoS
      { name: 'default', ttl: 60_000, limit: 200 },
      // sefaz: 20 req/min por IP — endpoints que consomem cota SEFAZ
      // (NFeDistribuicaoDFe, CCC, NfeConsultaProtocolo). SEFAZ aplica suas
      // próprias cotas; este limite evita que um usuário isolado esgote tudo.
      { name: 'sefaz', ttl: 60_000, limit: 20 },
    ]),
    ScheduleModule.forRoot(),

    PrismaModule,
    CryptoModule,
    BullMqModule,
    AuthModule,
    ProtheusModule,
    SefazModule,

    HealthModule,
    LimiteDiarioModule,
    AmbienteModule,
    CertificadoModule,
    AlertasModule,
    FiliaisModule,
    NfeModule,
    CteModule,
    CadastroModule,
    CruzamentoModule,
    DashboardModule,
    RelatorioModule,
    HistoricoModule,
  ],
  providers: [
    // Ordem: Throttler primeiro (rate limit antes de auth) → JwtAuthGuard depois.
    // JwtAuthGuard global protege todos endpoints; usar @Public() para excecionar.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
