import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * AES-256-GCM encrypt/decrypt helper.
 *
 * A master key é lida de `FISCAL_MASTER_KEY` (env ou Docker secret).
 * Formato aceito:
 *   - Base64 de 32 bytes (256 bits) → usado diretamente.
 *   - Passphrase qualquer → derivada via scrypt(salt='fiscal-salt', N=16384).
 *
 * A segunda forma existe só para DX local (passphrase legível). Em PRODUÇÃO
 * sempre use uma chave aleatória de 32 bytes base64, gerada com:
 *   openssl rand -base64 32
 */
@Injectable()
export class CryptoService {
  private readonly masterKey: Buffer;

  constructor(config: ConfigService) {
    const raw = config.get<string>('FISCAL_MASTER_KEY');
    if (!raw) {
      throw new Error('FISCAL_MASTER_KEY ausente — obrigatório.');
    }
    this.masterKey = this.deriveKey(raw);
  }

  private deriveKey(raw: string): Buffer {
    // Se for base64 válido de exatamente 32 bytes, aceita direto.
    try {
      const decoded = Buffer.from(raw, 'base64');
      if (decoded.length === 32 && decoded.toString('base64') === raw) {
        return decoded;
      }
    } catch {
      // fall-through
    }
    // Caso contrário, deriva via scrypt.
    return scryptSync(raw, 'capul-fiscal-salt', 32);
  }

  /**
   * Cifra uma string (utf-8). Retorna iv + ciphertext + authTag, separados,
   * todos em base64. Use-os como 3 colunas diferentes no banco.
   */
  encrypt(plaintext: string): { iv: string; ciphertext: string; authTag: string } {
    const iv = randomBytes(12); // GCM recomenda IV de 96 bits (12 bytes)
    const cipher = createCipheriv('aes-256-gcm', this.masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      iv: iv.toString('base64'),
      ciphertext: encrypted.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  }

  decrypt(iv: string, ciphertext: string, authTag: string): string {
    const decipher = createDecipheriv('aes-256-gcm', this.masterKey, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}
