import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as path from 'path';
import * as fs from 'fs';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'paradas');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

@Injectable()
export class ParadaAnexoService {
  constructor(private readonly prisma: PrismaService) {}

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
