import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    AmbienteModule,
    CertificadoModule,
    AlertasModule,
    NfeModule,
    CteModule,
    CadastroModule,
    CruzamentoModule,
    RelatorioModule,
    HistoricoModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
