import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';

import { PrismaModule } from './prisma/prisma.module.js';
import { AuditoriaModule } from './auditoria/auditoria.module.js';
import { IdentidadeModule } from './identidade/identidade.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { AvaliacaoModule } from './avaliacao/avaliacao.module.js';
import { SincronizacaoModule } from './sincronizacao/sincronizacao.module.js';
import { CicloModule } from './ciclo/ciclo.module.js';
import { AplicacaoModule } from './aplicacao/aplicacao.module.js';
import { DesignacaoModule } from './designacao/designacao.module.js';
import { DesignacaoPadraoModule } from './designacao-padrao/designacao-padrao.module.js';
import { ApuracaoModule } from './apuracao/apuracao.module.js';
import { AcervoModule } from './acervo/acervo.module.js';
import { ModeloModule } from './modelo/modelo.module.js';
import { CriterioModule } from './criterio/criterio.module.js';
import { CatalogoModule } from './catalogo/catalogo.module.js';
import { PainelModule } from './painel/painel.module.js';
import { ResultadoModule } from './resultado/resultado.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { IdentidadeGuard } from './common/guards/identidade.guard.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
          ignore: (req) => req.url === '/api/v1/gestao-pessoas/health' || req.url === '/health',
        },
        redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-api-key"]'],
      },
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    AuditoriaModule,
    IdentidadeModule,
    AuthModule,
    HealthModule,
    AvaliacaoModule,
    SincronizacaoModule,
    CicloModule,
    AplicacaoModule,
    DesignacaoModule,
    DesignacaoPadraoModule,
    ApuracaoModule,
    CatalogoModule,
    CriterioModule,
    AcervoModule,
    ModeloModule,
    PainelModule,
    ResultadoModule,
  ],
  providers: [
    // Ordem: rate-limit → autenticação (JWT) → autorização (papel) → IDENTIDADE.
    //
    // O IdentidadeGuard vem por último de propósito: ele consulta o banco, e não
    // faz sentido pagar essa consulta por quem já foi barrado por token inválido
    // ou por papel insuficiente. Ele resolve o COLABORADOR de quem está logado e
    // pendura em `req.colaborador` — é o "resolva uma vez" da separação de
    // funções, e falha fechada quando não consegue resolver.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: IdentidadeGuard },
  ],
})
export class AppModule {}
