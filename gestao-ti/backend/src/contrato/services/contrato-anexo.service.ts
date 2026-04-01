import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import * as fs from 'fs';
import * as path from 'path';
import { ContratoCoreService } from './contrato-core.service.js';
import { UPLOADS_DIR } from './contrato.constants.js';

@Injectable()
export class ContratoAnexoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: ContratoCoreService,
  ) {}

  async listarAnexos(contratoId: string) {
    await this.core.findOne(contratoId);
    return this.prisma.anexoContrato.findMany({
      where: { contratoId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async uploadAnexo(contratoId: string, file: Express.Multer.File) {
    await this.core.findOne(contratoId);

    return this.prisma.anexoContrato.create({
      data: {
        contratoId,
        nomeOriginal: file.originalname,
        nomeArquivo: file.filename,
        mimeType: file.mimetype,
        tamanho: file.size,
      },
    });
  }

  async downloadAnexo(contratoId: string, anexoId: string) {
    const anexo = await this.prisma.anexoContrato.findFirst({
      where: { id: anexoId, contratoId },
    });
    if (!anexo) {
      throw new NotFoundException('Anexo nao encontrado neste contrato');
    }

    const filePath = path.join(UPLOADS_DIR, anexo.nomeArquivo);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Arquivo nao encontrado no disco');
    }

    return { anexo, filePath };
  }

  async excluirAnexo(contratoId: string, anexoId: string, usuarioId: string) {
    const anexo = await this.prisma.anexoContrato.findFirst({
      where: { id: anexoId, contratoId },
    });
    if (!anexo) {
      throw new NotFoundException('Anexo nao encontrado neste contrato');
    }

    const filePath = path.join(UPLOADS_DIR, anexo.nomeArquivo);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await this.prisma.anexoContrato.delete({ where: { id: anexoId } });

    await this.core.criarHistorico(contratoId, 'OBSERVACAO', `Anexo removido: ${anexo.nomeOriginal}`, usuarioId);

    return { deleted: true };
  }

  async listarRenovacoes(contratoId: string) {
    await this.core.findOne(contratoId);

    const renovacoes = await this.prisma.contratoRenovacaoReg.findMany({
      where: {
        OR: [
          { contratoAnteriorId: contratoId },
          { contratoNovoId: contratoId },
        ],
      },
      include: {
        contratoAnterior: { select: { id: true, numero: true, titulo: true, valorTotal: true, status: true } },
        contratoNovo: { select: { id: true, numero: true, titulo: true, valorTotal: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return renovacoes;
  }

  async vincularLicenca(contratoId: string, licencaId: string, usuarioId: string, role: string = 'ADMIN') {
    const contrato = await this.core.findOne(contratoId);
    await this.core.ensureContratoPermission(contrato.equipeId, usuarioId, role);
    if (['RENOVADO', 'CANCELADO', 'ENCERRADO'].includes(contrato.status)) {
      throw new BadRequestException('Nao e possivel vincular licencas a contrato finalizado');
    }

    const licenca = await this.prisma.softwareLicenca.findUnique({ where: { id: licencaId } });
    if (!licenca) {
      throw new NotFoundException('Licenca nao encontrada');
    }
    if (licenca.contratoId) {
      throw new ConflictException('Licenca ja esta vinculada a outro contrato');
    }

    const updated = await this.prisma.softwareLicenca.update({
      where: { id: licencaId },
      data: { contratoId },
      include: { software: { select: { id: true, nome: true } } },
    });

    await this.core.criarHistorico(contratoId, 'OBSERVACAO', `Licenca vinculada: ${updated.software?.nome || updated.nome || 'Licenca avulsa'}`, usuarioId);

    return updated;
  }

  async desvincularLicenca(contratoId: string, licencaId: string, usuarioId: string, role: string = 'ADMIN') {
    const contrato = await this.core.findOne(contratoId);
    await this.core.ensureContratoPermission(contrato.equipeId, usuarioId, role);
    if (['RENOVADO', 'CANCELADO', 'ENCERRADO'].includes(contrato.status)) {
      throw new BadRequestException('Nao e possivel desvincular licencas de contrato finalizado');
    }

    const licenca = await this.prisma.softwareLicenca.findFirst({
      where: { id: licencaId, contratoId },
      include: { software: { select: { id: true, nome: true } } },
    });
    if (!licenca) {
      throw new NotFoundException('Licenca nao encontrada neste contrato');
    }

    const updated = await this.prisma.softwareLicenca.update({
      where: { id: licencaId },
      data: { contratoId: null },
    });

    await this.core.criarHistorico(contratoId, 'OBSERVACAO', `Licenca desvinculada: ${licenca.software?.nome || licenca.nome || 'Licenca avulsa'}`, usuarioId);

    return updated;
  }
}
