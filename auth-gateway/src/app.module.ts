import { Module, Injectable, ExecutionContext } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
  ],
  providers: [
    { provide: APP_GUARD, useClass: ProxyAwareThrottlerGuard },
  ],
})
export class AppModule {}
