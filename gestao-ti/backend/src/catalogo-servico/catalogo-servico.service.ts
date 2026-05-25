import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCatalogoDto } from './dto/create-catalogo.dto.js';
import { UpdateCatalogoDto } from './dto/update-catalogo.dto.js';
import { StatusGeral } from '@prisma/client';
import { getDeptoIdsDoUser, assertStaffEmDepto } from '../common/helpers/departamento-filter.helper.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';

@Injectable()
export class CatalogoServicoService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(equipeId?: string, status?: StatusGeral, user?: JwtPayload, role?: string) {
    // Workspace Onda 2 C2.4.5 — escopo workspace via equipe.departamentoId.
    // Quando o caller passa `equipeId` (UI de criação de chamado), ignora o
    // filtro de depto — Tatiane abre chamado pra equipe T.I. e precisa ver
    // o catálogo daquela equipe, não dos deptos dela. ADMIN escapa (D36).
    const deptoIds = getDeptoIdsDoUser(user, role);
    const equipeDeptoWhere =
      deptoIds === null || equipeId
        ? {}
        : { equipe: { departamentoId: { in: deptoIds } } };

    return this.prisma.catalogoServico.findMany({
      where: {
        ...(equipeId ? { equipeId } : {}),
        ...(status ? { status } : {}),
        ...equipeDeptoWhere,
      },
      include: { equipe: { select: { id: true, nome: true, sigla: true, cor: true } } },
      orderBy: { ordem: 'asc' },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.catalogoServico.findUnique({
      where: { id },
      include: { equipe: { select: { id: true, nome: true, sigla: true, cor: true } } },
    });
    if (!item) throw new NotFoundException('Servico nao encontrado no catalogo');
    return item;
  }

  async create(dto: CreateCatalogoDto, user?: JwtPayload) {
    // S13c (25/05) — só staff do depto da equipe pode criar.
    if (user) {
      const equipe = await this.prisma.equipe.findUnique({
        where: { id: dto.equipeId }, select: { departamentoId: true },
      });
      assertStaffEmDepto(user, equipe?.departamentoId);
    }
    const existing = await this.prisma.catalogoServico.findUnique({
      where: { equipeId_nome: { equipeId: dto.equipeId, nome: dto.nome } },
    });
    if (existing) throw new ConflictException('Ja existe um servico com este nome nesta equipe');

    return this.prisma.catalogoServico.create({
      data: dto,
      include: { equipe: { select: { id: true, nome: true, sigla: true, cor: true } } },
    });
  }

  async update(id: string, dto: UpdateCatalogoDto, user?: JwtPayload) {
    const existing = await this.findOne(id);
    // S13c — valida no depto da equipe ATUAL (e da nova se for trocar).
    if (user) {
      const equipeAtual = await this.prisma.equipe.findUnique({
        where: { id: existing.equipeId }, select: { departamentoId: true },
      });
      assertStaffEmDepto(user, equipeAtual?.departamentoId);
      if (dto.equipeId && dto.equipeId !== existing.equipeId) {
        const equipeNova = await this.prisma.equipe.findUnique({
          where: { id: dto.equipeId }, select: { departamentoId: true },
        });
        assertStaffEmDepto(user, equipeNova?.departamentoId);
      }
    }
    return this.prisma.catalogoServico.update({
      where: { id },
      data: dto,
      include: { equipe: { select: { id: true, nome: true, sigla: true, cor: true } } },
    });
  }

  async updateStatus(id: string, status: StatusGeral, user?: JwtPayload) {
    const existing = await this.findOne(id);
    // S13c — só staff do depto da equipe pode mudar status.
    if (user) {
      const equipe = await this.prisma.equipe.findUnique({
        where: { id: existing.equipeId }, select: { departamentoId: true },
      });
      assertStaffEmDepto(user, equipe?.departamentoId);
    }
    return this.prisma.catalogoServico.update({ where: { id }, data: { status } });
  }

  async remove(id: string, user?: JwtPayload) {
    const existing = await this.prisma.catalogoServico.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Servico nao encontrado no catalogo');
    // S13c — só staff do depto da equipe pode excluir.
    if (user) {
      const equipe = await this.prisma.equipe.findUnique({
        where: { id: existing.equipeId }, select: { departamentoId: true },
      });
      assertStaffEmDepto(user, equipe?.departamentoId);
    }
    const vinculos = await this.prisma.chamado.count({ where: { catalogoServicoId: id } });
    if (vinculos > 0) throw new BadRequestException(`Servico possui ${vinculos} chamado(s) vinculado(s). Inative-o em vez de excluir.`);
    await this.prisma.catalogoServico.delete({ where: { id } });
    return { success: true };
  }
}
