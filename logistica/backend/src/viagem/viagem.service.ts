import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SituacaoVeiculo, StatusEntrega, StatusViagem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CoreLookupService } from '../core/core-lookup.service.js';
import { CreateViagemDto, DespacharViagemDto } from './dto.js';

@Injectable()
export class ViagemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: CoreLookupService,
  ) {}

  /**
   * Cria a viagem em RASCUNHO (montagem). As entregas selecionadas (já na
   * ordem da rota) viram paradas. Numeração sequencial por filial. tipo=ENTREGA
   * (Fase 1). Não despacha — isso é um passo explícito.
   */
  async create(dto: CreateViagemDto, criadoPorId: string) {
    const veiculo = await this.prisma.veiculo.findUnique({ where: { id: dto.veiculoId } });
    if (!veiculo || !veiculo.ativo) throw new BadRequestException('Veículo inválido.');
    if (veiculo.filialId !== dto.filialId) {
      throw new BadRequestException('Veículo é de outra filial.');
    }
    // Motorista é colaborador do core — valida que existe (evita ID órfão).
    await this.core.validarUsuario(dto.motoristaId, 'Motorista');

    const entregaIds = dto.entregaIds ?? [];
    if (entregaIds.length) {
      await this.validarEntregasParaParada(entregaIds, dto.filialId);
    }

    return this.prisma.$transaction(async (tx) => {
      const contador = await tx.contadorSequencial.upsert({
        where: { filialId_escopo: { filialId: dto.filialId, escopo: 'VIAGEM' } },
        create: { filialId: dto.filialId, escopo: 'VIAGEM', ultimoNumero: 1 },
        update: { ultimoNumero: { increment: 1 } },
      });
      return tx.viagem.create({
        data: {
          numero: contador.ultimoNumero,
          filialId: dto.filialId,
          tipo: 'ENTREGA',
          veiculoId: dto.veiculoId,
          motoristaId: dto.motoristaId,
          situacao: StatusViagem.RASCUNHO,
          criadoPorId,
          paradas: {
            create: entregaIds.map((entregaId, i) => ({ entregaId, sequencia: i + 1 })),
          },
        },
        include: { paradas: { include: { entrega: true }, orderBy: { sequencia: 'asc' } } },
      });
    });
  }

  async list(params: { filialId?: string; situacao?: StatusViagem; veiculoId?: string }) {
    const viagens = await this.prisma.viagem.findMany({
      where: {
        ...(params.filialId ? { filialId: params.filialId } : {}),
        ...(params.situacao ? { situacao: params.situacao } : {}),
        ...(params.veiculoId ? { veiculoId: params.veiculoId } : {}),
      },
      include: { veiculo: { select: { placa: true } }, _count: { select: { paradas: true } } },
      orderBy: { criadoEm: 'desc' },
      take: 200,
    });
    // Nome do motorista (core) em cada viagem — evita o front resolver à parte.
    const motoristas = await this.core.nomesUsuarios(viagens.map((v) => v.motoristaId));
    return viagens.map((v) => ({ ...v, motoristaNome: motoristas.get(v.motoristaId) ?? null }));
  }

  async findOne(id: string) {
    const v = await this.prisma.viagem.findUnique({
      where: { id },
      include: {
        veiculo: { select: { placa: true, modelo: true } },
        paradas: { include: { entrega: true }, orderBy: { sequencia: 'asc' } },
      },
    });
    if (!v) throw new NotFoundException('Viagem não encontrada.');
    return v;
  }

  /**
   * Despacha: RASCUNHO → EM_CURSO. As entregas das paradas viram EM_VIAGEM e o
   * veículo vira EM_USO. Exige veículo DISPONIVEL e ao menos 1 parada.
   */
  async despachar(id: string, dto: DespacharViagemDto) {
    const v = await this.prisma.viagem.findUnique({
      where: { id },
      include: { paradas: { select: { entregaId: true } } },
    });
    if (!v) throw new NotFoundException('Viagem não encontrada.');
    if (v.situacao !== StatusViagem.RASCUNHO) {
      throw new BadRequestException(`Só despacha viagem em RASCUNHO (atual: ${v.situacao}).`);
    }
    if (v.paradas.length === 0) throw new BadRequestException('Viagem sem entregas — adicione paradas antes de despachar.');

    const veiculo = await this.prisma.veiculo.findUnique({ where: { id: v.veiculoId } });
    if (!veiculo) throw new BadRequestException('Veículo não encontrado.');
    if (veiculo.situacao !== SituacaoVeiculo.DISPONIVEL) {
      throw new BadRequestException(`Veículo não está disponível (situação: ${veiculo.situacao}).`);
    }

    const entregaIds = v.paradas.map((p) => p.entregaId).filter((x): x is string => !!x);

    return this.prisma.$transaction(async (tx) => {
      await tx.entrega.updateMany({
        where: { id: { in: entregaIds }, status: StatusEntrega.PENDENTE },
        data: { status: StatusEntrega.EM_VIAGEM },
      });
      await tx.veiculo.update({ where: { id: v.veiculoId }, data: { situacao: SituacaoVeiculo.EM_USO } });
      return tx.viagem.update({
        where: { id },
        data: {
          situacao: StatusViagem.EM_CURSO,
          dataHoraSaida: new Date(),
          localSaida: dto.localSaida?.trim() || null,
          observacoesSaida: dto.observacoesSaida?.trim() || null,
        },
        include: { paradas: { include: { entrega: true }, orderBy: { sequencia: 'asc' } } },
      });
    });
  }

  /** Descarta uma montagem (RASCUNHO) — libera as entregas (cascade nas paradas). */
  async descartar(id: string) {
    const v = await this.prisma.viagem.findUnique({ where: { id }, select: { situacao: true } });
    if (!v) throw new NotFoundException('Viagem não encontrada.');
    if (v.situacao !== StatusViagem.RASCUNHO) {
      throw new BadRequestException('Só é possível descartar viagem em RASCUNHO (ainda não despachada).');
    }
    await this.prisma.viagem.delete({ where: { id } }); // cascade remove paradas; entregas seguem PENDENTE
    return { ok: true };
  }

  private async validarEntregasParaParada(entregaIds: string[], filialId: string) {
    const entregas = await this.prisma.entrega.findMany({
      where: { id: { in: entregaIds } },
      select: { id: true, filialId: true, status: true, parada: { select: { id: true } } },
    });
    if (entregas.length !== entregaIds.length) {
      throw new BadRequestException('Alguma entrega não foi encontrada.');
    }
    for (const e of entregas) {
      if (e.filialId !== filialId) throw new BadRequestException('Entrega de outra filial na seleção.');
      if (e.status !== StatusEntrega.PENDENTE) throw new BadRequestException('Entrega não está PENDENTE.');
      if (e.parada) throw new BadRequestException('Entrega já está em outra viagem.');
    }
  }
}
