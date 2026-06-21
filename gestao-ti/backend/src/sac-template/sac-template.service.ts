import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSacTemplateDto, UpdateSacTemplateDto } from './dto.js';

/**
 * SAC Fase 4b — Respostas prontas (templates). CRUD gerido por admin/gestor;
 * o seletor do card "Responder ao cliente" consome só os ATIVOS.
 */
@Injectable()
export class SacTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly ordenacao = [{ ordem: 'asc' as const }, { titulo: 'asc' as const }];

  listarAtivos() {
    return this.prisma.sacRespostaTemplate.findMany({ where: { ativo: true }, orderBy: this.ordenacao });
  }

  listarTodos() {
    return this.prisma.sacRespostaTemplate.findMany({ orderBy: this.ordenacao });
  }

  criar(dto: CreateSacTemplateDto) {
    return this.prisma.sacRespostaTemplate.create({
      data: { titulo: dto.titulo.trim(), corpo: dto.corpo, ativo: dto.ativo ?? true, ordem: dto.ordem ?? 0 },
    });
  }

  async atualizar(id: string, dto: UpdateSacTemplateDto) {
    await this.getOrFail(id);
    return this.prisma.sacRespostaTemplate.update({
      where: { id },
      data: {
        ...(dto.titulo !== undefined ? { titulo: dto.titulo.trim() } : {}),
        ...(dto.corpo !== undefined ? { corpo: dto.corpo } : {}),
        ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
        ...(dto.ordem !== undefined ? { ordem: dto.ordem } : {}),
      },
    });
  }

  async remover(id: string) {
    await this.getOrFail(id);
    await this.prisma.sacRespostaTemplate.delete({ where: { id } });
    return { deleted: true };
  }

  private async getOrFail(id: string) {
    const t = await this.prisma.sacRespostaTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Resposta pronta não encontrada.');
    return t;
  }
}
