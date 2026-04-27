import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { PrismaModule } from './prisma/prisma.module.js';
import { EquipeModule } from './equipe/equipe.module.js';
import { CatalogoServicoModule } from './catalogo-servico/catalogo-servico.module.js';
import { SlaModule } from './sla/sla.module.js';
import { ChamadoModule } from './chamado/chamado.module.js';
import { OrdemServicoModule } from './ordem-servico/ordem-servico.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { SoftwareModule } from './software/software.module.js';
import { LicencaModule } from './licenca/licenca.module.js';
import { ContratoModule } from './contrato/contrato.module.js';
import { ParadaModule } from './parada/parada.module.js';
import { ProjetoModule } from './projeto/projeto.module.js';
import { AtivoModule } from './ativo/ativo.module.js';
import { ConhecimentoModule } from './conhecimento/conhecimento.module.js';
import { NotificacaoModule } from './notificacao/notificacao.module.js';
import { ExportModule } from './export/export.module.js';
import { ImportModule } from './import/import.module.js';
import { MonitorModule } from './monitor/monitor.module.js';
import { HorarioModule } from './horario/horario.module.js';
import { CompraModule } from './compra/compra.module.js';
import { ProtheusModule } from './protheus/protheus.module.js';
import { JwtStrategy } from './common/strategies/jwt.strategy.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { HealthModule } from './health/health.module.js';

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
          ignore: (req) => req.url === '/api/v1/gestao-ti/health' || req.url === '/health',
        },
        redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-api-key"]'],
      },
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ThrottlerModule.forRoot([{
      ttl: 60000,   // 1 minuto
      limit: 60,    // 60 requisicoes por minuto (geral)
    }]),
    PrismaModule,
    EquipeModule,
    CatalogoServicoModule,
    SlaModule,
    ChamadoModule,
    OrdemServicoModule,
    SoftwareModule,
    LicencaModule,
    ContratoModule,
    ParadaModule,
    ProjetoModule,
    AtivoModule,
    ConhecimentoModule,
    NotificacaoModule,
    ExportModule,
    ImportModule,
    MonitorModule,
    HorarioModule,
    CompraModule,
    ProtheusModule,
    DashboardModule,
    HealthModule,
  ],
  providers: [
    JwtStrategy,
    // Ordem: Throttler primeiro (rate limit antes de auth) → JwtAuthGuard depois.
    // JwtAuthGuard global protege todos endpoints; usar @Public() para excecionar.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
