import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile, unlink, chmod } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { PrismaService } from '../prisma/prisma.service.js';
import { CryptoService } from '../common/crypto/crypto.service.js';
import { CertParserService } from './cert-parser.service.js';
import type { Certificado } from '@prisma/client';

export interface CertificadoPublico {
  id: string;
  nomeArquivo: string;
  cnpj: string;
  cnpjMascarado: string;
  validoDe: Date;
  validoAte: Date;
  ativo: boolean;
  diasParaVencer: number;
  vencendoEmMenosDe60Dias: boolean;
  observacoes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class CertificadoService {
  private readonly logger = new Logger(CertificadoService.name);
  private readonly certsDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly parser: CertParserService,
    config: ConfigService,
  ) {
    // Diretório onde os binários .pfx ficam armazenados.
    // Derivado de FISCAL_NFE_CERT_PATH (que aponta para o arquivo principal):
    // pega o diretório pai. Em produção é /app/certs (volume Docker read-write
    // para este container, read-only para os demais).
    const certPath = config.get<string>('FISCAL_NFE_CERT_PATH') ?? '/app/certs/certificado.pfx';
    this.certsDir = dirname(certPath);
  }

  /**
   * Recebe o buffer do .pfx + senha, valida, extrai metadados, cifra a senha
   * com AES-256-GCM e grava. Não ativa automaticamente — ADMIN_TI decide depois.
   */
  async upload(
    nomeArquivo: string,
    buffer: Buffer,
    senhaPlaintext: string,
    observacoes: string | undefined,
  ): Promise<CertificadoPublico> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Arquivo vazio.');
    }
    if (buffer.length > 100 * 1024) {
      throw new BadRequestException('Arquivo muito grande — esperado < 100 KB para um .pfx.');
    }

    const metadata = this.parser.parse(buffer, senhaPlaintext);

    if (metadata.notAfter.getTime() < Date.now()) {
      throw new BadRequestException(
        `Certificado já expirado em ${metadata.notAfter.toISOString().slice(0, 10)}.`,
      );
    }

    const { iv, ciphertext, authTag } = this.crypto.encrypt(senhaPlaintext);

    // Grava primeiro o registro do banco (para ter o UUID), depois persiste o
    // binário em ${certsDir}/${id}.pfx com permissão 0600. Se a gravação em
    // disco falhar, faz rollback do registro no banco (operação composta).
    const novo = await this.prisma.certificado.create({
      data: {
        nomeArquivo,
        cnpj: metadata.cnpj,
        validoDe: metadata.notBefore,
        validoAte: metadata.notAfter,
        senhaCifrada: ciphertext,
        iv,
        authTag,
        ativo: false,
        observacoes: observacoes ?? null,
      },
    });

    try {
      await mkdir(this.certsDir, { recursive: true, mode: 0o700 });
      const path = resolve(this.certsDir, `${novo.id}.pfx`);
      await writeFile(path, buffer, { mode: 0o600, flag: 'wx' });
      // chmod best-effort: bind mounts em WSL2 (filesystem 9P) negam chmod
      // porque mapeiam todo UID para o usuário do host. O mode do writeFile já
      // foi solicitado; em prod Linux nativo é honrado.
      try {
        await chmod(path, 0o600);
      } catch (chmodErr) {
        this.logger.warn(
          `chmod ${path} falhou (provável bind mount sem suporte): ${(chmodErr as Error).message}`,
        );
      }
    } catch (err) {
      await this.prisma.certificado.delete({ where: { id: novo.id } }).catch(() => undefined);
      throw new BadRequestException(
        `Falha ao persistir binário do certificado: ${(err as Error).message}`,
      );
    }

    this.logger.log(
      `Certificado ${novo.id} cadastrado — CNPJ ${this.mask(metadata.cnpj)} — válido até ${metadata.notAfter.toISOString().slice(0, 10)} — binário em ${this.certsDir}/${novo.id}.pfx`,
    );

    return this.toPublico(novo);
  }

  async listar(): Promise<CertificadoPublico[]> {
    const certs = await this.prisma.certificado.findMany({
      orderBy: [{ ativo: 'desc' }, { validoAte: 'desc' }],
    });
    return certs.map((c) => this.toPublico(c));
  }

  async contarCertificados(): Promise<number> {
    return this.prisma.certificado.count();
  }

  async getAtivo(): Promise<CertificadoPublico | null> {
    const cert = await this.prisma.certificado.findFirst({ where: { ativo: true } });
    return cert ? this.toPublico(cert) : null;
  }

  /**
   * Ativa um certificado (desativando o anterior). Operação atômica.
   */
  async ativar(id: string): Promise<CertificadoPublico> {
    const alvo = await this.prisma.certificado.findUnique({ where: { id } });
    if (!alvo) throw new NotFoundException(`Certificado ${id} não encontrado.`);
    if (alvo.validoAte.getTime() < Date.now()) {
      throw new BadRequestException('Certificado expirado — não pode ser ativado.');
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      await tx.certificado.updateMany({ where: { ativo: true }, data: { ativo: false } });
      return tx.certificado.update({ where: { id }, data: { ativo: true } });
    });

    this.logger.log(`Certificado ${id} ativado (CNPJ ${this.mask(resultado.cnpj)}).`);
    return this.toPublico(resultado);
  }

  async remover(id: string): Promise<void> {
    const cert = await this.prisma.certificado.findUnique({ where: { id } });
    if (!cert) throw new NotFoundException(`Certificado ${id} não encontrado.`);
    if (cert.ativo) {
      throw new BadRequestException('Não é possível remover o certificado ativo. Ative outro antes.');
    }
    await this.prisma.certificado.delete({ where: { id } });
    // Apaga o binário em disco — best effort; falha não bloqueia a remoção do
    // registro porque o arquivo pode já não existir (por exemplo se foi removido
    // manualmente no volume).
    try {
      await unlink(resolve(this.certsDir, `${id}.pfx`));
    } catch (err) {
      this.logger.warn(`Falha ao apagar binário de ${id}.pfx: ${(err as Error).message}`);
    }
    this.logger.log(`Certificado ${id} removido.`);
  }

  /**
   * Método interno usado pelo CertificadoReaderService (futuro SefazClient):
   * retorna o certificado ativo com a senha já decifrada.
   *
   * NUNCA exponha este retorno em endpoint REST.
   */
  async getActiveWithPassword(): Promise<{ id: string; cnpj: string; senha: string } | null> {
    const cert = await this.prisma.certificado.findFirst({ where: { ativo: true } });
    if (!cert) return null;
    const senha = this.crypto.decrypt(cert.iv, cert.senhaCifrada, cert.authTag);
    return { id: cert.id, cnpj: cert.cnpj, senha };
  }

  // ----- helpers -----

  private toPublico(c: Certificado): CertificadoPublico {
    const now = Date.now();
    const diasParaVencer = Math.floor((c.validoAte.getTime() - now) / (1000 * 60 * 60 * 24));
    return {
      id: c.id,
      nomeArquivo: c.nomeArquivo,
      cnpj: c.cnpj,
      cnpjMascarado: this.mask(c.cnpj),
      validoDe: c.validoDe,
      validoAte: c.validoAte,
      ativo: c.ativo,
      diasParaVencer,
      vencendoEmMenosDe60Dias: diasParaVencer <= 60,
      observacoes: c.observacoes,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  private mask(cnpj: string): string {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
}
