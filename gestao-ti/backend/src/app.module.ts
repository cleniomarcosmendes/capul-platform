import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
import { ProtheusModule } from './protheus/protheus.module.js';
import { JwtStrategy } from './common/strategies/jwt.strategy.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    ProtheusModule,
    DashboardModule,
  ],
  providers: [
    JwtStrategy,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
