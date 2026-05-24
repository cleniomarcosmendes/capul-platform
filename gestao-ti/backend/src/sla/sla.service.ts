import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSlaDto } from './dto/create-sla.dto.js';
import { UpdateSlaDto } from './dto/update-sla.dto.js';
import { StatusGeral } from '@prisma/client';
import { getDeptoIdsDoUser } from '../common/helpers/departamento-filter.helper.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';

@Injectable()
export class SlaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(equipeId?: string, user?: JwtPayload, role?: string) {
    // Workspace Onda 2 C2.4.5 — escopo via equipe.departamentoId.
    // `equipeId` explícito (UI criação de chamado) bypassa filtro.
    const deptoIds = getDeptoIdsDoUser(user, role);
    const equipeDeptoWhere =
      deptoIds === null || equipeId
        ? {}
        : { equipe: { departamentoId: { in: deptoIds } } };

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

  async create(dto: CreateSlaDto) {
    const existing = await this.prisma.slaDefinicao.findUnique({
      where: { equipeId_prioridade: { equipeId: dto.equipeId, prioridade: dto.prioridade } },
    });
    if (existing) throw new ConflictException('Ja existe um SLA para esta prioridade nesta equipe');

    return this.prisma.slaDefinicao.create({
      data: dto,
      include: { equipe: { select: { id: true, nome: true, sigla: true } } },
    });
  }

  async update(id: string, dto: UpdateSlaDto) {
    await this.findOne(id);
    return this.prisma.slaDefinicao.update({
      where: { id },
      data: dto,
      include: { equipe: { select: { id: true, nome: true, sigla: true } } },
    });
  }

  async updateStatus(id: string, status: StatusGeral) {
    await this.findOne(id);
    return this.prisma.slaDefinicao.update({ where: { id }, data: { status } });
  }

  async remove(id: string) {
    const existing = await this.prisma.slaDefinicao.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('SLA nao encontrado');
    const vinculos = await this.prisma.chamado.count({ where: { slaDefinicaoId: id } });
    if (vinculos > 0) throw new BadRequestException(`SLA possui ${vinculos} chamado(s) vinculado(s). Inative-o em vez de excluir.`);
    await this.prisma.slaDefinicao.delete({ where: { id } });
    return { success: true };
  }
}
