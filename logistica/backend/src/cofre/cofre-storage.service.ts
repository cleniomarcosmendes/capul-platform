import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client as MinioClient } from 'minio';
import { createHash, randomUUID } from 'node:crypto';

/**
 * Object store do COFRE (binários da prova: foto/assinatura).
 *
 * Isolado do banco — o Postgres do cofre guarda só metadados; o arquivo em si
 * vive aqui (MinIO em DEV; S3/MinIO dedicado em PROD). Mantém o banco enxuto e
 * o backup do binário separado do backup do metadado.
 *
 * Como o PrismaCofreService, é DEGRADÁVEL: se o store estiver fora, a gravação
 * de prova falha graciosamente (a baixa pode ser reportada como erro), sem
 * derrubar o backend.
 */
@Injectable()
export class CofreStorageService implements OnModuleInit {
  private readonly logger = new Logger(CofreStorageService.name);
  private readonly client: MinioClient;
  private readonly bucket: string;
  private bucketReady = false;

  constructor() {
    const endpoint = process.env.COFRE_S3_ENDPOINT ?? 'http://minio:9000';
    const url = new URL(endpoint);
    this.bucket = process.env.COFRE_S3_BUCKET ?? 'comprovantes';
    this.client = new MinioClient({
      endPoint: url.hostname,
      port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
      useSSL: url.protocol === 'https:',
      accessKey: process.env.COFRE_S3_ACCESS_KEY ?? '',
      secretKey: process.env.COFRE_S3_SECRET_KEY ?? '',
    });
  }

  async onModuleInit() {
    // Garante o bucket no boot — sem derrubar o módulo se o store estiver fora.
    await this.ensureBucket().catch((e) =>
      this.logger.error(
        `Object store do cofre indisponível no boot: ${(e as Error).message}. ` +
          'Gravação de prova ficará indisponível até o store responder.',
      ),
    );
  }

  private async ensureBucket(): Promise<void> {
    if (this.bucketReady) return;
    const exists = await this.client.bucketExists(this.bucket).catch(() => false);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
      this.logger.log(`Bucket "${this.bucket}" criado no object store do cofre`);
    }
    this.bucketReady = true;
  }

  /**
   * Grava o binário e devolve a chave (objectKey) + o hash SHA-256.
   * O objectKey é particionado por filial/refId p/ organização e auditoria
   * (refId = entrega na prova de entrega; despesa no recibo de frota).
   */
  async put(
    binario: Buffer,
    opts: { filialId: string; refId: string; mimeType?: string },
  ): Promise<{ objectKey: string; hash: string; tamanhoBytes: number }> {
    await this.ensureBucket();
    const hash = createHash('sha256').update(binario).digest('hex');
    const ext = this.extFromMime(opts.mimeType);
    const objectKey = `${opts.filialId}/${opts.refId}/${randomUUID()}${ext}`;
    await this.client.putObject(this.bucket, objectKey, binario, binario.length, {
      'Content-Type': opts.mimeType ?? 'application/octet-stream',
      // Hash redundante nos metadados do objeto — defesa em profundidade.
      'x-amz-meta-sha256': hash,
    });
    return { objectKey, hash, tamanhoBytes: binario.length };
  }

  /** Lê o binário da prova pelo objectKey (consulta do financeiro). */
  async get(objectKey: string): Promise<Buffer> {
    await this.ensureBucket();
    const stream = await this.client.getObject(this.bucket, objectKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  }

  private extFromMime(mime?: string): string {
    if (!mime) return '';
    if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
    if (mime.includes('png')) return '.png';
    if (mime.includes('webp')) return '.webp';
    if (mime.includes('pdf')) return '.pdf';
    return '';
  }
}
