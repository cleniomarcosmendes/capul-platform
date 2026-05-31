import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SituacaoVeiculo } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateVeiculoDto, UpdateVeiculoDto } from './dto.js';

@Injectable()
export class VeiculoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria o veículo + registra o supervisor inicial no histórico (entidade
   * separada — exigência Fase 2: preservar mudanças de supervisor).
   */
  async create(dto: CreateVeiculoDto, criadoPorId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const v = await tx.veiculo.create({
          data: {
            filialId: dto.filialId,
            placa: dto.placa.trim().toUpperCase(),
            renavam: dto.renavam?.trim() || null,
            chassi: dto.chassi?.trim().toUpperCase() || null,
            modelo: dto.modelo?.trim() || null,
            marca: dto.marca?.trim() || null,
            ano: dto.ano ?? null,
            cor: dto.cor?.trim() || null,
            tipo: dto.tipo ?? 'CARRO',
            kmAtual: dto.kmAtual ?? 0,
            capacidadeCarga: dto.capacidadeCarga?.trim() || null,
            situacao: dto.situacao ?? 'DISPONIVEL',
            departamentoLotacaoId: dto.departamentoLotacaoId,
            supervisorId: dto.supervisorId,
          },
        });
        await tx.veiculoSupervisorHistorico.create({
          data: {
            veiculoId: v.id,
            supervisorAnteriorId: null,
            supervisorNovoId: dto.supervisorId,
            alteradoPorId: criadoPorId,
          },
        });
        return v;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('Já existe veículo com essa placa nesta filial.');
      }
      throw e;
    }
  }

  list(params: { filialId?: string; situacao?: SituacaoVeiculo; incluirInativos?: boolean }) {
    return this.prisma.veiculo.findMany({
      where: {
        ...(params.filialId ? { filialId: params.filialId } : {}),
        ...(params.situacao ? { situacao: params.situacao } : {}),
        ...(params.incluirInativos ? {} : { ativo: true }),
      },
      orderBy: { placa: 'asc' },
      take: 300,
    });
  }

  async findOne(id: string) {
    const v = await this.prisma.veiculo.findUnique({
      where: { id },
      include: { historicoSupervisor: { orderBy: { alteradoEm: 'desc' } } },
    });
    if (!v) throw new NotFoundException('Veículo não encontrado.');
    return v;
  }

  async update(id: string, dto: UpdateVeiculoDto, alteradoPorId: string) {
    const atual = await this.prisma.veiculo.findUnique({ where: { id } });
    if (!atual) throw new NotFoundException('Veículo não encontrado.');

    const trocaSupervisor = dto.supervisorId && dto.supervisorId !== atual.supervisorId;

    return this.prisma.$transaction(async (tx) => {
      const v = await tx.veiculo.update({
        where: { id },
        data: {
          placa: dto.placa?.trim().toUpperCase(),
          renavam: dto.renavam?.trim(),
          chassi: dto.chassi?.trim().toUpperCase(),
          modelo: dto.modelo?.trim(),
          marca: dto.marca?.trim(),
          ano: dto.ano,
          cor: dto.cor?.trim(),
          tipo: dto.tipo,
          kmAtual: dto.kmAtual,
          capacidadeCarga: dto.capacidadeCarga?.trim(),
          situacao: dto.situacao,
          departamentoLotacaoId: dto.departamentoLotacaoId,
          supervisorId: dto.supervisorId,
          ativo: dto.ativo,
        },
      });
      if (trocaSupervisor) {
        await tx.veiculoSupervisorHistorico.create({
          data: {
            veiculoId: id,
            supervisorAnteriorId: atual.supervisorId,
            supervisorNovoId: dto.supervisorId!,
            alteradoPorId,
          },
        });
      }
      return v;
    });
  }

  /** Soft-delete (ativo=false) — preserva histórico/viagens. */
  async remove(id: string) {
    const v = await this.prisma.veiculo.findUnique({ where: { id }, select: { id: true } });
    if (!v) throw new NotFoundException('Veículo não encontrado.');
    return this.prisma.veiculo.update({ where: { id }, data: { ativo: false } });
  }
}
