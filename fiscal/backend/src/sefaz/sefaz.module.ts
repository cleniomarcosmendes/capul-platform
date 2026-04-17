import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CertificadoModule } from '../certificado/certificado.module.js';
import { AlertasModule } from '../alertas/alertas.module.js';
import { SefazAgentService } from './sefaz-agent.service.js';
import { SefazCaService } from './sefaz-ca.service.js';
import { SefazCaController } from './sefaz-ca.controller.js';
import { NfeDistribuicaoClient } from './nfe-distribuicao.client.js';
import { NfeConsultaProtocoloClient } from './nfe-consulta-protocolo.client.js';
import { CteDistribuicaoClient } from './cte-distribuicao.client.js';
import { CteConsultaProtocoloClient } from './cte-consulta-protocolo.client.js';
import { CccClient } from './ccc-client.service.js';

/**
 * SEFAZ module — concentra o agente mTLS + clients dos web services consumidos
 * pelo Módulo Fiscal.
 *
 * Importa CertificadoModule para obter o CertificadoReaderService, que carrega
 * o certificado A1 ativo e fornece buffer+senha para o https.Agent.
 *
 * Exportado para NfeModule, CteModule e CadastroModule.
 */
@Module({
  imports: [ConfigModule, CertificadoModule, AlertasModule],
  controllers: [SefazCaController],
  providers: [
    SefazCaService,
    SefazAgentService,
    NfeDistribuicaoClient,
    NfeConsultaProtocoloClient,
    CteDistribuicaoClient,
    CteConsultaProtocoloClient,
    CccClient,
  ],
  exports: [
    SefazCaService,
    SefazAgentService,
    NfeDistribuicaoClient,
    NfeConsultaProtocoloClient,
    CteDistribuicaoClient,
    CteConsultaProtocoloClient,
    CccClient,
  ],
})
export class SefazModule {}
