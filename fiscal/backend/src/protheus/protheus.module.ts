import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IntegracaoApiResolver } from './integracao-api.resolver.js';
import { ProtheusHttpClient } from './protheus-http.client.js';
import { ProtheusCadastroService } from './protheus-cadastro.service.js';
import { ProtheusXmlService } from './protheus-xml.service.js';
import { ProtheusEventosService } from './protheus-eventos.service.js';
import { ProtheusGravacaoHelper } from './protheus-gravacao.helper.js';
import { XmlParserToSzrSzqService } from './xml-parser-to-szr-szq.service.js';

/**
 * Módulo Protheus — fachada para os recursos REST do contrato API:
 *   - cadastroFiscal (SA1010 + SA2010 read)
 *   - xmlFiscal      (SZR010 + SZQ010 read/write)
 *
 * URLs e autenticação resolvidas dinamicamente via IntegracaoApiResolver
 * (cadastro em `core.integracoes_api_endpoints` do auth-gateway).
 * Fallback para env vars PROTHEUS_API_URL/PROTHEUS_API_AUTH durante transição.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    IntegracaoApiResolver,
    ProtheusHttpClient,
    ProtheusCadastroService,
    ProtheusXmlService,
    ProtheusEventosService,
    ProtheusGravacaoHelper,
    XmlParserToSzrSzqService,
  ],
  exports: [
    IntegracaoApiResolver,
    ProtheusHttpClient,
    ProtheusCadastroService,
    ProtheusXmlService,
    ProtheusEventosService,
    ProtheusGravacaoHelper,
    XmlParserToSzrSzqService,
  ],
})
export class ProtheusModule {}
