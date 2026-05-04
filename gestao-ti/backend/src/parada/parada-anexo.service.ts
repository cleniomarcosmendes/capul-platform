import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as path from 'path';
import * as fs from 'fs';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'paradas');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

@Injectable()
export class ParadaAnexoService implements OnModuleInit {
  private readonly logger = new Logger(ParadaAnexoService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifica no startup se o diretório de uploads é gravável pelo usuário
   * do container (appuser uid=100). Falha comum em PROD: o named volume
   * `uploads_data` foi criado em deploy anterior quando o container rodava
   * como root, ficou com ownership root:root, e após o hardening (USER
   * non-root) o appuser não consegue mais escrever — gera "Erro ao enviar
   * anexo" silencioso na UI. Esta verificação loga ERROR no boot com
   * instrução exata pro admin corrigir.
   */
  async onModuleInit() {
    const testPath = path.join(UPLOADS_DIR, '.write-test');
    try {
      await fs.promises.writeFile(testPath, 'ok', { flag: 'w' });
      await fs.promises.unlink(testPath).catch(() => undefined);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'EACCES' || code === 'EPERM') {
        this.logger.error(
          `[UPLOADS_DIR_NAO_GRAVAVEL] ${UPLOADS_DIR} não é gravável pelo usuário do ` +
            `container (appuser uid=100 gid=101). Anexos de Parada VÃO FALHAR. ` +
            `Solução no host (executar uma vez): ` +
            `\`docker volume inspect capul-platform_uploads_data --format '{{.Mountpoint}}'\` ` +
            `para descobrir o caminho, e depois ` +
            `\`sudo chown -R 100:101 <caminho>\` + \`docker compose restart gestao-ti-backend\`. ` +
            `Detalhe técnico: ${(err as Error).message}`,
        );
      } else {
        this.logger.warn(
          `Falha ao validar UPLOADS_DIR ${UPLOADS_DIR} no startup (não-EACCES): ${(err as Error).message}`,
        );
      }
    }
  }

  async listAnexos(paradaId: string) {
    await this.getParadaOrFail(paradaId);
    return this.prisma.anexoParada.findMany({
      where: { paradaId },
      include: { usuario: { select: { id: true, nome: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addAnexo(paradaId: string, file: Express.Multer.File, userId: string, descricao?: string) {
    const parada = await this.getParadaOrFail(paradaId);
    this.assertEditavel(parada, 'anexar arquivo');
    return this.prisma.anexoParada.create({
      data: {
        nomeOriginal: file.originalname,
        nomeArquivo: file.filename,
        mimeType: file.mimetype,
        tamanho: file.size,
        descricao,
        paradaId,
        usuarioId: userId,
      },
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  async getAnexoFile(paradaId: string, anexoId: string) {
    const anexo = await this.prisma.anexoParada.findFirst({
      where: { id: anexoId, paradaId },
    });
    if (!anexo) throw new NotFoundException('Anexo nao encontrado nesta parada');

    const filePath = path.join(UPLOADS_DIR, anexo.nomeArquivo);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Arquivo nao encontrado no disco');
    }
    return { filePath, anexo };
  }

  async removeAnexo(paradaId: string, anexoId: string) {
    const parada = await this.getParadaOrFail(paradaId);
    this.assertEditavel(parada, 'remover anexo');

    const anexo = await this.prisma.anexoParada.findFirst({
      where: { id: anexoId, paradaId },
    });
    if (!anexo) throw new NotFoundException('Anexo nao encontrado nesta parada');

    const filePath = path.join(UPLOADS_DIR, anexo.nomeArquivo);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await this.prisma.anexoParada.delete({ where: { id: anexoId } });
    return { deleted: true };
  }

  private async getParadaOrFail(id: string) {
    const parada = await this.prisma.registroParada.findUnique({ where: { id } });
    if (!parada) throw new NotFoundException('Parada nao encontrada');
    return parada;
  }

  /**
   * Bloqueia mutações em paradas em estado terminal. Espelhada do
   * ParadaService.assertParadaEditavel — não compartilhamos o helper
   * porque os 2 services não compartilham módulo de utilidades comum.
   */
  private assertEditavel(parada: { status: string }, operacao: string): void {
    if (parada.status === 'CANCELADA') {
      throw new BadRequestException(
        `Nao e possivel ${operacao} em parada cancelada. Cancelamento e estado terminal — registre uma nova parada se necessario.`,
      );
    }
    if (parada.status === 'FINALIZADA') {
      throw new BadRequestException(
        `Nao e possivel ${operacao} em parada finalizada. Reabra a parada (botao "Reabrir") antes de modifica-la.`,
      );
    }
  }

  static getUploadsDir() {
    return UPLOADS_DIR;
  }
}
