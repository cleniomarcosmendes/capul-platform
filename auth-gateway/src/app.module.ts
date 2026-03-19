import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 60000,   // 1 minuto
      limit: 30,    // 30 requisicoes por minuto (geral)
    }]),
    PrismaModule,
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
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
