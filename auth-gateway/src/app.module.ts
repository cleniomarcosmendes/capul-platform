import { Module, Injectable, ExecutionContext } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EmpresaModule } from './empresa/empresa.module';
import { FilialModule } from './filial/filial.module';
import { UsuarioModule } from './usuario/usuario.module';
import { DepartamentoModule } from './departamento/departamento.module';
import { TipoDepartamentoModule } from './tipo-departamento/tipo-departamento.module';
import { CentroCustoModule } from './centro-custo/centro-custo.module';
import { ModuloModule } from './modulo/modulo.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { IntegracaoModule } from './integracao/integracao.module';
import { HealthModule } from './health/health.module';
import { BackupExecucaoModule } from './backup-execucao/backup-execucao.module';
import { AlertNotifierModule } from './alert-notifier/alert-notifier.module';
import { AuditLogRetentionModule } from './audit-log-retention/audit-log-retention.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Injectable()
class ProxyAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) {
      return typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0];
    }
    return req.ip;
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Logs estruturados em JSON (produção) ou pretty (dev). Inclui correlation
    // ID por request via X-Request-ID (gera se ausente). Auditoria observabilidade
    // 26/04/2026 #1 — base pra agregação futura (Loki/ELK).
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
          req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            remoteAddress: req.remoteAddress,
          }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
        // Garante que reqId apareca no top-level dos logs de cada request
        customProps: (req) => ({ reqId: (req as { id?: string }).id }),
        // Não logar headers sensíveis nem health-checks ruidosos
        autoLogging: {
          ignore: (req) =>
            req.url === '/api/v1/auth/health' ||
            req.url === '/api/v1/health' ||
            req.url === '/health',
        },
        redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-api-key"]'],
      },
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    PrismaModule,
    AuditLogModule,
    AuthModule,
    EmpresaModule,
    FilialModule,
    UsuarioModule,
    DepartamentoModule,
    TipoDepartamentoModule,
    CentroCustoModule,
    ModuloModule,
    IntegracaoModule,
    HealthModule,
    BackupExecucaoModule,
    AlertNotifierModule,
    AuditLogRetentionModule,
  ],
  providers: [
    // Ordem: Throttler primeiro (rate limit antes de auth) → JwtAuthGuard depois.
    // JwtAuthGuard global protege todos endpoints; usar @Public() para excecionar.
    { provide: APP_GUARD, useClass: ProxyAwareThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
