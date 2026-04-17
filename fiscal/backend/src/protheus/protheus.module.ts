import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProtheusHttpClient } from './protheus-http.client.js';
import { ProtheusCadastroService } from './protheus-cadastro.service.js';
import { ProtheusXmlService } from './protheus-xml.service.js';
import { ProtheusGravacaoHelper } from './protheus-gravacao.helper.js';

/**
 * Módulo Protheus — fachada para os dois recursos REST do contrato API v2.0:
 *   - cadastroFiscal (SA1010 + SA2010 read)
 *   - xmlFiscal      (SZR010 + SZQ010 read/write)
 *
 * Marcado como @Global para que qualquer outro módulo do fiscal possa injetar
 * `ProtheusCadastroService` / `ProtheusXmlService` / `ProtheusGravacaoHelper`
 * sem reimportar.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    ProtheusHttpClient,
    ProtheusCadastroService,
    ProtheusXmlService,
    ProtheusGravacaoHelper,
  ],
  exports: [
    ProtheusHttpClient,
    ProtheusCadastroService,
    ProtheusXmlService,
    ProtheusGravacaoHelper,
  ],
})
export class ProtheusModule {}
