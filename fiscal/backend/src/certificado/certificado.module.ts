import { Module } from '@nestjs/common';
import { CryptoModule } from '../common/crypto/crypto.module.js';
import { CertificadoController } from './certificado.controller.js';
import { CertificadoService } from './certificado.service.js';
import { CertParserService } from './cert-parser.service.js';
import { CertificadoReaderService } from './certificado-reader.service.js';

/**
 * Gestão do certificado A1 ICP-Brasil do Módulo Fiscal.
 *
 * Decisões da Etapa 3 da Onda 1 + mitigação 11.A do addendum v1.5:
 * - Senha do .pfx cifrada com AES-256-GCM usando FISCAL_MASTER_KEY.
 * - Certificado DEDICADO (não compartilha com Protheus emissão).
 * - Alerta automático quando validade < 60 dias.
 * - Apenas 1 certificado ativo por vez (transação atômica de troca).
 * - ADMIN_TI cadastra/ativa/remove; GESTOR_FISCAL só visualiza metadados.
 * - CertificadoReaderService exposto para o futuro SefazClient (Etapa 4).
 */
@Module({
  imports: [CryptoModule],
  controllers: [CertificadoController],
  providers: [CertificadoService, CertParserService, CertificadoReaderService],
  exports: [CertificadoReaderService],
})
export class CertificadoModule {}
