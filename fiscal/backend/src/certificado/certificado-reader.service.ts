import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CertificadoService } from './certificado.service.js';

/**
 * Fornece ao SefazClient (Etapa 4 da Onda 1) o par { buffer, senha } do
 * certificado A1 atualmente ativo.
 *
 * Separado do CertificadoService porque:
 *   - CertificadoService faz CRUD + validação, nunca retorna dados sensíveis.
 *   - CertificadoReaderService é o ÚNICO ponto que combina binário + senha
 *     decifrada, usado exclusivamente pelo SefazClient para montar o agent mTLS.
 *
 * O binário do .pfx vive em `${certsDir}/<certificadoId>.pfx`, persistido
 * com `chmod 600` pelo CertificadoService.upload. A senha fica cifrada no banco.
 *
 * Se o binário não existir em disco (ex.: volume inconsistente ou remoção
 * manual), lança ServiceUnavailableException — sinal de reprovisionamento.
 */
@Injectable()
export class CertificadoReaderService {
  private readonly logger = new Logger(CertificadoReaderService.name);
  private readonly certsDir: string;
  private cache: { id: string; buffer: Buffer; senha: string; cnpj: string; expiraEm: number } | null = null;
  private readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

  constructor(
    private readonly service: CertificadoService,
    config: ConfigService,
  ) {
    this.certsDir = config.get<string>('FISCAL_NFE_CERT_PATH')?.replace(/\/[^/]+$/, '') ?? '/app/certs';
  }

  /**
   * Retorna o certificado A1 ativo (buffer + senha) pronto para uso em mTLS.
   *
   * Cache em memória de 10 minutos — evita descriptografar a senha e ler o
   * arquivo a cada chamada, mas expira para absorver trocas de certificado
   * sem precisar reiniciar o processo.
   */
  async loadActive(): Promise<{ id: string; buffer: Buffer; senha: string; cnpj: string }> {
    if (this.cache && this.cache.expiraEm > Date.now()) {
      return this.cache;
    }

    const meta = await this.service.getActiveWithPassword();
    if (!meta) {
      const total = await this.service.contarCertificados();
      const msg = total > 0
        ? `Existe(m) ${total} certificado(s) cadastrado(s), mas nenhum está ativo. Acesse o Configurador → Certificado A1 e ative um certificado para liberar as consultas ao SEFAZ.`
        : 'Nenhum certificado digital cadastrado. Acesse o Configurador → Certificado A1, faça o upload do arquivo .pfx e ative-o para liberar as consultas ao SEFAZ.';
      throw new ServiceUnavailableException(msg);
    }

    const path = resolve(this.certsDir, `${meta.id}.pfx`);
    let buffer: Buffer;
    try {
      buffer = await readFile(path);
    } catch (err) {
      this.logger.error(
        `Binário do certificado ${meta.id} não encontrado em ${path}. Arquivo pode ter sido removido manualmente do volume. Refazer upload via CertificadoController.`,
      );
      throw new ServiceUnavailableException(
        `Binário do certificado ativo não encontrado em disco (${path}). Refazer upload.`,
      );
    }

    this.cache = {
      id: meta.id,
      buffer,
      senha: meta.senha,
      cnpj: meta.cnpj,
      expiraEm: Date.now() + this.CACHE_TTL_MS,
    };
    this.logger.log(`Certificado ativo carregado (id=${meta.id}, CNPJ=${meta.cnpj.slice(0, 2)}…)`);
    return this.cache;
  }

  /**
   * Invalida o cache. Chamar após upload/ativar/remover para forçar reload.
   */
  invalidateCache(): void {
    this.cache = null;
  }
}
