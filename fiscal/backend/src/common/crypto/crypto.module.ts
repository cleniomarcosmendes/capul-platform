import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CryptoService } from './crypto.service.js';

/**
 * Módulo global do helper de criptografia (AES-256-GCM).
 * Usado por: CertificadoModule, futuros serviços que precisem cifrar
 * credenciais (SMTP password, Protheus auth, etc.).
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
