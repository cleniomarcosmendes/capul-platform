import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateEquipeDto } from './dto/create-equipe.dto.js';
import { UpdateEquipeDto } from './dto/update-equipe.dto.js';
import { AddMembroDto } from './dto/add-membro.dto.js';
import { UpdateMembroDto } from './dto/update-membro.dto.js';
import { StatusGeral } from '@prisma/client';

@Injectable()
export class EquipeService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: StatusGeral) {
    return this.prisma.equipeTI.findMany({
      where: status ? { status } : undefined,
      include: {
        membros: {
          include: { usuario: true },
          where: { status: 'ATIVO' },
        },
      },
      orderBy: { ordem: 'asc' },
    });
  }

  async findOne(id: string) {
    const equipe = await this.prisma.equipeTI.findUnique({
      where: { id },
      include: {
        membros: {
          include: { usuario: true },
          orderBy: [{ isLider: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!equipe) {
      throw new NotFoundException('Equipe não encontrada');
    }

    return equipe;
  }

  async create(dto: CreateEquipeDto) {
    const existing = await this.prisma.equipeTI.findFirst({
      where: {
        OR: [{ nome: dto.nome }, { sigla: dto.sigla }],
      },
    });

    if (existing) {
      throw new ConflictException(
        existing.nome === dto.nome
          ? 'Já existe uma equipe com este nome'
          : 'Já existe uma equipe com esta sigla',
      );
    }

    return this.prisma.equipeTI.create({
      data: {
        nome: dto.nome,
        sigla: dto.sigla.toUpperCase(),
        descricao: dto.descricao,
        cor: dto.cor,
        icone: dto.icone,
        aceitaChamadoExterno: dto.aceitaChamadoExterno,
        emailEquipe: dto.emailEquipe,
        ordem: dto.ordem,
      },
    });
  }

  async update(id: string, dto: UpdateEquipeDto) {
    await this.findOne(id);

    if (dto.nome || dto.sigla) {
      const existing = await this.prisma.equipeTI.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(dto.nome ? [{ nome: dto.nome }] : []),
            ...(dto.sigla ? [{ sigla: dto.sigla }] : []),
          ],
        },
      });

      if (existing) {
        throw new ConflictException(
          existing.nome === dto.nome
            ? 'Já existe uma equipe com este nome'
            : 'Já existe uma equipe com esta sigla',
        );
      }
    }

    return this.prisma.equipeTI.update({
      where: { id },
      data: {
        ...dto,
        sigla: dto.sigla ? dto.sigla.toUpperCase() : undefined,
      },
    });
  }

  async updateStatus(id: string, status: StatusGeral) {
    await this.findOne(id);

    return this.prisma.equipeTI.update({
      where: { id },
      data: { status },
    });
  }

  // ---- Membros ----

  async addMembro(equipeId: string, dto: AddMembroDto) {
    await this.findOne(equipeId);

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: dto.usuarioId },
    });

    if (!usuario) {
      throw new BadRequestException('Usuário não encontrado');
    }

    const existing = await this.prisma.membroEquipe.findUnique({
      where: {
        usuarioId_equipeId: {
          usuarioId: dto.usuarioId,
          equipeId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Usuário já é membro desta equipe');
    }

    return this.prisma.membroEquipe.create({
      data: {
        usuarioId: dto.usuarioId,
        equipeId,
        isLider: dto.isLider ?? false,
      },
      include: { usuario: true },
    });
  }

  async updateMembro(equipeId: string, membroId: string, dto: UpdateMembroDto) {
    const membro = await this.prisma.membroEquipe.findFirst({
      where: { id: membroId, equipeId },
    });

    if (!membro) {
      throw new NotFoundException('Membro não encontrado nesta equipe');
    }

    return this.prisma.membroEquipe.update({
      where: { id: membroId },
      data: dto,
      include: { usuario: true },
    });
  }

  async removeMembro(equipeId: string, membroId: string) {
    const membro = await this.prisma.membroEquipe.findFirst({
      where: { id: membroId, equipeId },
    });

    if (!membro) {
      throw new NotFoundException('Membro não encontrado nesta equipe');
    }

    await this.prisma.membroEquipe.delete({
      where: { id: membroId },
    });

    return { message: 'Membro removido com sucesso' };
  }

  /**
   * Retorna as equipes onde o usuario pode gerir contratos.
   * Para ADMIN/GESTOR_TI retorna todas as equipes ativas.
   * Para outros roles, retorna apenas equipes onde o usuario tem podeGerirContratos.
   */
  async findEquipesParaContratos(usuarioId: string, role: string) {
    if (role === 'ADMIN' || role === 'GESTOR_TI') {
      return this.prisma.equipeTI.findMany({
        where: { status: 'ATIVO' },
        orderBy: { ordem: 'asc' },
      });
    }

    const membros = await this.prisma.membroEquipe.findMany({
      where: {
        usuarioId,
        status: 'ATIVO',
        podeGerirContratos: true,
      },
      include: {
        equipe: true,
      },
    });

    return membros
      .filter(m => m.equipe.status === 'ATIVO')
      .map(m => m.equipe)
      .sort((a, b) => a.ordem - b.ordem);
  }
}
