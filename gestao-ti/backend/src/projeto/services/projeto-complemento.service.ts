import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateRiscoDto } from '../dto/create-risco.dto.js';
import { CreateDependenciaDto } from '../dto/create-dependencia.dto.js';
import { CreateAnexoDto } from '../dto/create-anexo.dto.js';
import { ProjetoHelpersService } from './projeto-helpers.service.js';
import { PROJETO_UPLOADS_DIR } from './projeto.constants.js';

@Injectable()
export class ProjetoComplementoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly helpers: ProjetoHelpersService,
  ) {}

  // --- Riscos ---

  async listRiscos(projetoId: string) {
    const projeto = await this.helpers.ensureProjetoExists(projetoId);
    if (projeto.modo !== 'COMPLETO') {
      throw new BadRequestException('Riscos so estao disponiveis em projetos modo COMPLETO');
    }
    return this.prisma.riscoProjeto.findMany({
      where: { projetoId },
      include: { responsavel: { select: { id: true, nome: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addRisco(projetoId: string, dto: CreateRiscoDto) {
    const projeto = await this.helpers.ensureProjetoExists(projetoId);
    if (projeto.modo !== 'COMPLETO') {
      throw new BadRequestException('Riscos so estao disponiveis em projetos modo COMPLETO');
    }
    return this.prisma.riscoProjeto.create({
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        probabilidade: dto.probabilidade,
        impacto: dto.impacto,
        status: dto.status || 'IDENTIFICADO',
        planoMitigacao: dto.planoMitigacao,
        responsavelId: dto.responsavelId,
        observacoes: dto.observacoes,
        projetoId,
      },
      include: { responsavel: { select: { id: true, nome: true } } },
    });
  }

  async updateRisco(projetoId: string, riscoId: string, dto: CreateRiscoDto) {
    const risco = await this.prisma.riscoProjeto.findFirst({
      where: { id: riscoId, projetoId },
    });
    if (!risco) throw new NotFoundException('Risco nao encontrado neste projeto');

    const data: Record<string, unknown> = {};
    if (dto.titulo !== undefined) data.titulo = dto.titulo;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.probabilidade !== undefined) data.probabilidade = dto.probabilidade;
    if (dto.impacto !== undefined) data.impacto = dto.impacto;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.planoMitigacao !== undefined) data.planoMitigacao = dto.planoMitigacao;
    if (dto.responsavelId !== undefined) data.responsavelId = dto.responsavelId;
    if (dto.observacoes !== undefined) data.observacoes = dto.observacoes;

    return this.prisma.riscoProjeto.update({
      where: { id: riscoId },
      data,
      include: { responsavel: { select: { id: true, nome: true } } },
    });
  }

  async removeRisco(projetoId: string, riscoId: string) {
    const risco = await this.prisma.riscoProjeto.findFirst({
      where: { id: riscoId, projetoId },
    });
    if (!risco) throw new NotFoundException('Risco nao encontrado neste projeto');
    await this.prisma.riscoProjeto.delete({ where: { id: riscoId } });
    return { deleted: true };
  }

  // --- Dependencias ---

  async listDependencias(projetoId: string) {
    const projeto = await this.helpers.ensureProjetoExists(projetoId);
    if (projeto.modo !== 'COMPLETO') {
      throw new BadRequestException('Dependencias so estao disponiveis em projetos modo COMPLETO');
    }

    const [origem, destino] = await Promise.all([
      this.prisma.dependenciaProjeto.findMany({
        where: { projetoOrigemId: projetoId },
        include: {
          projetoDestino: { select: { id: true, numero: true, nome: true, status: true } },
        },
      }),
      this.prisma.dependenciaProjeto.findMany({
        where: { projetoDestinoId: projetoId },
        include: {
          projetoOrigem: { select: { id: true, numero: true, nome: true, status: true } },
        },
      }),
    ]);

    return { origem, destino };
  }

  async addDependencia(projetoId: string, dto: CreateDependenciaDto) {
    const projeto = await this.helpers.ensureProjetoExists(projetoId);
    if (projeto.modo !== 'COMPLETO') {
      throw new BadRequestException('Dependencias so estao disponiveis em projetos modo COMPLETO');
    }

    if (dto.projetoDestinoId === projetoId) {
      throw new BadRequestException('Um projeto nao pode depender de si mesmo');
    }

    const destino = await this.prisma.projeto.findUnique({
      where: { id: dto.projetoDestinoId },
    });
    if (!destino) throw new NotFoundException('Projeto destino nao encontrado');

    const existing = await this.prisma.dependenciaProjeto.findUnique({
      where: {
        projetoOrigemId_projetoDestinoId_tipo: {
          projetoOrigemId: projetoId,
          projetoDestinoId: dto.projetoDestinoId,
          tipo: dto.tipo,
        },
      },
    });
    if (existing) throw new BadRequestException('Esta dependencia ja existe');

    return this.prisma.dependenciaProjeto.create({
      data: {
        projetoOrigemId: projetoId,
        projetoDestinoId: dto.projetoDestinoId,
        tipo: dto.tipo,
        descricao: dto.descricao,
      },
      include: {
        projetoDestino: { select: { id: true, numero: true, nome: true, status: true } },
      },
    });
  }

  async removeDependencia(projetoId: string, depId: string) {
    const dep = await this.prisma.dependenciaProjeto.findFirst({
      where: {
        id: depId,
        OR: [{ projetoOrigemId: projetoId }, { projetoDestinoId: projetoId }],
      },
    });
    if (!dep) throw new NotFoundException('Dependencia nao encontrada neste projeto');
    await this.prisma.dependenciaProjeto.delete({ where: { id: depId } });
    return { deleted: true };
  }

  // --- Anexos ---

  async listAnexos(projetoId: string) {
    await this.helpers.ensureProjetoExists(projetoId);
    return this.prisma.anexoProjeto.findMany({
      where: { projetoId },
      include: { usuario: { select: { id: true, nome: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addAnexo(projetoId: string, dto: CreateAnexoDto, userId: string) {
    await this.helpers.ensureProjetoExists(projetoId);
    return this.prisma.anexoProjeto.create({
      data: {
        titulo: dto.titulo,
        url: dto.url,
        tipo: dto.tipo || 'DOCUMENTO',
        tamanho: dto.tamanho,
        descricao: dto.descricao,
        projetoId,
        usuarioId: userId,
      },
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  async uploadAnexo(projetoId: string, file: Express.Multer.File, userId: string, descricao?: string) {
    await this.helpers.ensureProjetoExists(projetoId);
    return this.prisma.anexoProjeto.create({
      data: {
        titulo: file.originalname,
        url: file.filename,
        tipo: 'ARQUIVO',
        nomeArquivo: file.filename,
        nomeOriginal: file.originalname,
        mimeType: file.mimetype,
        tamanhoBytes: file.size,
        tamanho: file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${(file.size / 1024).toFixed(0)} KB`,
        descricao,
        projetoId,
        usuarioId: userId,
      },
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  async getAnexoFile(projetoId: string, anexoId: string) {
    const anexo = await this.prisma.anexoProjeto.findFirst({
      where: { id: anexoId, projetoId },
    });
    if (!anexo) throw new NotFoundException('Anexo nao encontrado neste projeto');
    if (anexo.tipo !== 'ARQUIVO' || !anexo.nomeArquivo) {
      throw new BadRequestException('Este anexo nao e um arquivo para download');
    }
    const filePath = path.join(PROJETO_UPLOADS_DIR, anexo.nomeArquivo);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Arquivo nao encontrado no disco');
    }
    return { filePath, anexo };
  }

  async removeAnexo(projetoId: string, anexoId: string) {
    const anexo = await this.prisma.anexoProjeto.findFirst({
      where: { id: anexoId, projetoId },
    });
    if (!anexo) throw new NotFoundException('Anexo nao encontrado neste projeto');

    // Remove file from disk if it's a file attachment
    if (anexo.tipo === 'ARQUIVO' && anexo.nomeArquivo) {
      const filePath = path.join(PROJETO_UPLOADS_DIR, anexo.nomeArquivo);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await this.prisma.anexoProjeto.delete({ where: { id: anexoId } });
    return { deleted: true };
  }

  // --- Chamados (vincular/desvincular) ---

  async vincularChamado(projetoId: string, chamadoId: string) {
    await this.helpers.ensureProjetoExists(projetoId);

    const chamado = await this.prisma.chamado.findUnique({ where: { id: chamadoId } });
    if (!chamado) throw new NotFoundException('Chamado nao encontrado');

    if (chamado.projetoId) {
      throw new BadRequestException('Chamado ja esta vinculado a um projeto');
    }

    return this.prisma.chamado.update({
      where: { id: chamadoId },
      data: { projetoId },
      select: { id: true, numero: true, titulo: true, status: true, prioridade: true },
    });
  }

  async desvincularChamado(projetoId: string, chamadoId: string) {
    const chamado = await this.prisma.chamado.findFirst({
      where: { id: chamadoId, projetoId },
    });
    if (!chamado) throw new NotFoundException('Chamado nao encontrado neste projeto');

    return this.prisma.chamado.update({
      where: { id: chamadoId },
      data: { projetoId: null },
      select: { id: true, numero: true, titulo: true, status: true },
    });
  }

  async getChamadosProjeto(projetoId: string) {
    await this.helpers.ensureProjetoExists(projetoId);
    return this.prisma.chamado.findMany({
      where: { projetoId },
      include: {
        solicitante: { select: { id: true, nome: true, username: true } },
        tecnico: { select: { id: true, nome: true, username: true } },
        equipeAtual: { select: { id: true, nome: true, sigla: true, cor: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
