import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SituacaoVeiculo } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CoreLookupService } from '../core/core-lookup.service.js';
import { CreateVeiculoDto, UpdateVeiculoDto } from './dto.js';

@Injectable()
export class VeiculoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: CoreLookupService,
  ) {}

  /** Anexa os nomes do core (filial/depto/supervisor) a cada veículo. */
  private async enriquecer<T extends { filialId: string; departamentoLotacaoId: string; supervisorId: string }>(veiculos: T[]) {
    const [filiais, deptos, usuarios] = await Promise.all([
      this.core.nomesFiliais(veiculos.map((v) => v.filialId)),
      this.core.nomesDepartamentos(veiculos.map((v) => v.departamentoLotacaoId)),
      this.core.nomesUsuarios(veiculos.map((v) => v.supervisorId)),
    ]);
    return veiculos.map((v) => ({
      ...v,
      filialNome: filiais.get(v.filialId) ?? null,
      departamentoNome: deptos.get(v.departamentoLotacaoId) ?? null,
      supervisorNome: usuarios.get(v.supervisorId) ?? null,
    }));
  }

  /**
   * Cria o veículo + registra o supervisor inicial no histórico (entidade
   * separada — exigência Fase 2: preservar mudanças de supervisor).
   */
  async create(dto: CreateVeiculoDto, criadoPorId: string) {
    // Valida os FKs do core antes de gravar (evita ID órfão).
    await Promise.all([
      this.core.validarFilial(dto.filialId),
      this.core.validarDepartamento(dto.departamentoLotacaoId),
      this.core.validarUsuario(dto.supervisorId, 'Supervisor'),
    ]);
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

  async list(params: { filialId?: string; situacao?: SituacaoVeiculo; incluirInativos?: boolean }) {
    const veiculos = await this.prisma.veiculo.findMany({
      where: {
        ...(params.filialId ? { filialId: params.filialId } : {}),
        ...(params.situacao ? { situacao: params.situacao } : {}),
        ...(params.incluirInativos ? {} : { ativo: true }),
      },
      orderBy: { placa: 'asc' },
      take: 300,
    });
    return this.enriquecer(veiculos);
  }

  async findOne(id: string) {
    const v = await this.prisma.veiculo.findUnique({
      where: { id },
      include: { historicoSupervisor: { orderBy: { alteradoEm: 'desc' } } },
    });
    if (!v) throw new NotFoundException('Veículo não encontrado.');
    // Nomes do veículo + nomes dos usuários citados no histórico de supervisor.
    const [enriquecido] = await this.enriquecer([v]);
    const usuariosHist = await this.core.nomesUsuarios(
      v.historicoSupervisor.flatMap((h) => [h.supervisorAnteriorId, h.supervisorNovoId, h.alteradoPorId].filter((x): x is string => !!x)),
    );
    return {
      ...enriquecido,
      historicoSupervisor: v.historicoSupervisor.map((h) => ({
        ...h,
        supervisorAnteriorNome: h.supervisorAnteriorId ? usuariosHist.get(h.supervisorAnteriorId) ?? null : null,
        supervisorNovoNome: usuariosHist.get(h.supervisorNovoId) ?? null,
        alteradoPorNome: usuariosHist.get(h.alteradoPorId) ?? null,
      })),
    };
  }

  async update(id: string, dto: UpdateVeiculoDto, alteradoPorId: string, userFilialId?: string) {
    const atual = await this.prisma.veiculo.findUnique({ where: { id } });
    if (!atual) throw new NotFoundException('Veículo não encontrado.');
    if (userFilialId && atual.filialId !== userFilialId) throw new ForbiddenException('Veículo de outra filial.');

    // Valida FKs do core que vierem no update.
    await Promise.all([
      dto.departamentoLotacaoId ? this.core.validarDepartamento(dto.departamentoLotacaoId) : Promise.resolve(),
      dto.supervisorId ? this.core.validarUsuario(dto.supervisorId, 'Supervisor') : Promise.resolve(),
    ]);

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
  async remove(id: string, userFilialId?: string) {
    const v = await this.prisma.veiculo.findUnique({ where: { id }, select: { id: true, filialId: true } });
    if (!v) throw new NotFoundException('Veículo não encontrado.');
    if (userFilialId && v.filialId !== userFilialId) throw new ForbiddenException('Veículo de outra filial.');
    return this.prisma.veiculo.update({ where: { id }, data: { ativo: false } });
  }
}
