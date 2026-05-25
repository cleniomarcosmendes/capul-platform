import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSlaDto } from './dto/create-sla.dto.js';
import { UpdateSlaDto } from './dto/update-sla.dto.js';
import { StatusGeral } from '@prisma/client';
import { getDeptoIdsDoUser, assertStaffEmDepto } from '../common/helpers/departamento-filter.helper.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';

@Injectable()
export class SlaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(equipeId?: string, user?: JwtPayload, role?: string, workspaceAtivoId?: string | null) {
    // Workspace Onda 2 C2.4.5 — escopo via equipe.departamentoId.
    // `equipeId` explícito (UI criação de chamado) bypassa filtro.
    // S15.2 (25/05) — workspaceAtivoId restringe à equipe daquele depto.
    const deptoIds = getDeptoIdsDoUser(user, role);
    const equipeDeptoWhere = workspaceAtivoId
      ? { equipe: { departamentoId: workspaceAtivoId } }
      : (deptoIds === null || equipeId
          ? {}
          : { equipe: { departamentoId: { in: deptoIds } } });

    return this.prisma.slaDefinicao.findMany({
      where: {
        ...(equipeId ? { equipeId } : {}),
        status: 'ATIVO',
        ...equipeDeptoWhere,
      },
      include: { equipe: { select: { id: true, nome: true, sigla: true } } },
      orderBy: { prioridade: 'asc' },
    });
  }

  async findOne(id: string) {
    const sla = await this.prisma.slaDefinicao.findUnique({
      where: { id },
      include: { equipe: { select: { id: true, nome: true, sigla: true } } },
    });
    if (!sla) throw new NotFoundException('SLA nao encontrado');
    return sla;
  }

  async create(dto: CreateSlaDto, user?: JwtPayload) {
    // S13c — só staff do depto da equipe pode criar SLA.
    if (user) {
      const equipe = await this.prisma.equipe.findUnique({
        where: { id: dto.equipeId }, select: { departamentoId: true },
      });
      assertStaffEmDepto(user, equipe?.departamentoId);
    }
    const existing = await this.prisma.slaDefinicao.findUnique({
      where: { equipeId_prioridade: { equipeId: dto.equipeId, prioridade: dto.prioridade } },
    });
    if (existing) throw new ConflictException('Ja existe um SLA para esta prioridade nesta equipe');

    return this.prisma.slaDefinicao.create({
      data: dto,
      include: { equipe: { select: { id: true, nome: true, sigla: true } } },
    });
  }

  async update(id: string, dto: UpdateSlaDto, user?: JwtPayload) {
    const existing = await this.findOne(id);
    if (user) {
      const equipe = await this.prisma.equipe.findUnique({
        where: { id: existing.equipeId }, select: { departamentoId: true },
      });
      assertStaffEmDepto(user, equipe?.departamentoId);
      if (dto.equipeId && dto.equipeId !== existing.equipeId) {
        const equipeNova = await this.prisma.equipe.findUnique({
          where: { id: dto.equipeId }, select: { departamentoId: true },
        });
        assertStaffEmDepto(user, equipeNova?.departamentoId);
      }
    }
    return this.prisma.slaDefinicao.update({
      where: { id },
      data: dto,
      include: { equipe: { select: { id: true, nome: true, sigla: true } } },
    });
  }

  async updateStatus(id: string, status: StatusGeral, user?: JwtPayload) {
    const existing = await this.findOne(id);
    if (user) {
      const equipe = await this.prisma.equipe.findUnique({
        where: { id: existing.equipeId }, select: { departamentoId: true },
      });
      assertStaffEmDepto(user, equipe?.departamentoId);
    }
    return this.prisma.slaDefinicao.update({ where: { id }, data: { status } });
  }

  async remove(id: string, user?: JwtPayload) {
    const existing = await this.prisma.slaDefinicao.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('SLA nao encontrado');
    if (user) {
      const equipe = await this.prisma.equipe.findUnique({
        where: { id: existing.equipeId }, select: { departamentoId: true },
      });
      assertStaffEmDepto(user, equipe?.departamentoId);
    }
    const vinculos = await this.prisma.chamado.count({ where: { slaDefinicaoId: id } });
    if (vinculos > 0) throw new BadRequestException(`SLA possui ${vinculos} chamado(s) vinculado(s). Inative-o em vez de excluir.`);
    await this.prisma.slaDefinicao.delete({ where: { id } });
    return { success: true };
  }
}
