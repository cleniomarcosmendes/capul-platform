import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EmpresaModule } from './empresa/empresa.module';
import { FilialModule } from './filial/filial.module';
import { UsuarioModule } from './usuario/usuario.module';
import { DepartamentoModule } from './departamento/departamento.module';
import { CentroCustoModule } from './centro-custo/centro-custo.module';
import { ModuloModule } from './modulo/modulo.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    EmpresaModule,
    FilialModule,
    UsuarioModule,
    DepartamentoModule,
    CentroCustoModule,
    ModuloModule,
  ],
})
export class AppModule {}
