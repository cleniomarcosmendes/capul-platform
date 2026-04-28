import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateParadaDto } from './dto/create-parada.dto';
import { UpdateParadaDto } from './dto/update-parada.dto';
import { FinalizarParadaDto } from './dto/finalizar-parada.dto';
import { CreateMotivoParadaDto } from './dto/create-motivo-parada.dto';
import { UpdateMotivoParadaDto } from './dto/update-motivo-parada.dto';
import { paginate } from '../common/prisma/paginate.helper.js';

const paradaListInclude = {
  motivoParada: { select: { id: true, nome: true } },
  software: { select: { id: true, nome: true, tipo: true, criticidade: true } },
  softwareModulo: { select: { id: true, nome: true } },
  chamados: {
    include: { chamado: { select: { id: true, numero: true, titulo: true, status: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
  registradoPor: { select: { id: true, nome: true, username: true } },
  filiaisAfetadas: {
    include: { filial: { select: { id: true, codigo: true, nomeFantasia: true } } },
  },
  colaboradores: {
    include: { usuario: { select: { id: true, nome: true, username: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  _count: { select: { filiaisAfetadas: true, chamados: true, colaboradores: true } },
};

const paradaDetailInclude = {
  ...paradaListInclude,
  finalizadoPor: { select: { id: true, nome: true, username: true } },
  reabertaPor: { select: { id: true, nome: true, username: true } },
  historico: {
    include: { usuario: { select: { id: true, nome: true, username: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
};

@Injectable()
export class ParadaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: {
    softwareId?: string;
    moduloId?: string;
    filialId?: string;
    tipo?: string;
    impacto?: string;
    status?: string;
    motivoParadaId?: string;
    dataInicio?: string;
    dataFim?: string;
    page?: number;
    pageSize?: number;
  }) {
    const where: Record<string, unknown> = {};

    if (filters.softwareId) where.softwareId = filters.softwareId;
    if (filters.moduloId) where.softwareModuloId = filters.moduloId;
    if (filters.tipo) where.tipo = filters.tipo;
    if (filters.impacto) where.impacto = filters.impacto;
    if (filters.status) where.status = filters.status;
    if (filters.motivoParadaId) where.motivoParadaId = filters.motivoParadaId;

    if (filters.filialId) {
      where.filiaisAfetadas = { some: { filialId: filters.filialId } };
    }

    if (filters.dataInicio || filters.dataFim) {
      const inicio: Record<string, Date> = {};
      if (filters.dataInicio) inicio.gte = new Date(filters.dataInicio);
      if (filters.dataFim) inicio.lte = new Date(filters.dataFim);
      where.inicio = inicio;
    }

    return paginate(this.prisma, this.prisma.registroParada, {
      where,
      include: paradaListInclude,
      orderBy: { inicio: 'desc' },
      page: filters.page,
      pageSize: filters.pageSize,
    });
  }

  async findOne(id: string) {
    const parada = await this.prisma.registroParada.findUnique({
      where: { id },
      include: paradaDetailInclude,
    });
    if (!parada) throw new NotFoundException('Parada nao encontrada');
    return parada;
  }

  async create(dto: CreateParadaDto, userId: string) {
    const software = await this.prisma.software.findUnique({ where: { id: dto.softwareId } });
    if (!software) throw new NotFoundException('Software nao encontrado');

    if (dto.softwareModuloId) {
      const modulo = await this.prisma.softwareModulo.findFirst({
        where: { id: dto.softwareModuloId, softwareId: dto.softwareId },
      });
      if (!modulo) throw new BadRequestException('Modulo nao pertence ao software informado');
    }

    const inicio = new Date(dto.inicio);
    let status: 'EM_ANDAMENTO' | 'FINALIZADA' = 'EM_ANDAMENTO';
    let fim: Date | undefined;
    let duracaoMinutos: number | undefined;

    if (dto.fim) {
      fim = new Date(dto.fim);
      if (fim <= inicio) throw new BadRequestException('Data fim deve ser posterior ao inicio');
      duracaoMinutos = Math.round((fim.getTime() - inicio.getTime()) / 60000);
      status = 'FINALIZADA';
    }

    const criada = await this.prisma.registroParada.create({
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        tipo: dto.tipo,
        impacto: dto.impacto,
        status,
        inicio,
        fim,
        duracaoMinutos,
        observacoes: dto.observacoes,
        motivoParadaId: dto.motivoParadaId,
        softwareId: dto.softwareId,
        softwareModuloId: dto.softwareModuloId,
        registradoPorId: userId,
        finalizadoPorId: status === 'FINALIZADA' ? userId : undefined,
        filiaisAfetadas: {
          create: dto.filialIds.map((filialId) => ({ filialId })),
        },
      },
      include: paradaDetailInclude,
    });
    // Timeline: registra criação. Se já criou finalizada (caso raro de
    // backfill ou registro tardio), adiciona também a finalização.
    await this.registrarHistorico(criada.id, 'REGISTRADA', userId, dto.observacoes ?? null, {
      inicio: inicio.toISOString(),
      tipo: dto.tipo,
      impacto: dto.impacto,
    });
    if (status === 'FINALIZADA' && fim) {
      await this.registrarHistorico(criada.id, 'FINALIZADA', userId, dto.observacoes ?? null, {
        fim: fim.toISOString(),
        duracaoMinutos,
      });
    }
    return this.findOne(criada.id);
  }

  /**
   * Bloqueia mutações em paradas em estado terminal. CANCELADA é terminal
   * absoluto (cancelamento é decisão deliberada — não há "descancelar").
   * FINALIZADA é "frozen" mas reversível via /reabrir — a mensagem orienta
   * o operador a usar esse caminho em vez de tentar editar direto.
   */
  private assertParadaEditavel(
    parada: { status: string },
    operacao: string,
  ): void {
    if (parada.status === 'CANCELADA') {
      throw new BadRequestException(
        `Nao e possivel ${operacao} em parada cancelada. Cancelamento e estado terminal — registre uma nova parada se necessario.`,
      );
    }
    if (parada.status === 'FINALIZADA') {
      throw new BadRequestException(
        `Nao e possivel ${operacao} em parada finalizada. Reabra a parada (botao "Reabrir") antes de modifica-la.`,
      );
    }
  }

  /**
   * Registra uma entrada na timeline da parada. Imutável (auditoria) —
   * nunca atualizamos ou deletamos linhas existentes. Cada transição de
   * estado vira uma linha. Aceita prismaClient explicito para uso dentro
   * de transação ($transaction); caso contrario usa o prismaService.
   */
  private async registrarHistorico(
    paradaId: string,
    tipoEvento: 'REGISTRADA' | 'REABERTA' | 'FINALIZADA' | 'CANCELADA',
    usuarioId: string | null,
    observacoes: string | null,
    metadata?: Record<string, unknown>,
    tx?: { paradaHistorico: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> } },
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.paradaHistorico.create({
      data: {
        paradaId,
        tipoEvento,
        usuarioId,
        observacoes: observacoes && observacoes.trim() !== '' ? observacoes.trim() : null,
        metadata:
          metadata && Object.keys(metadata).length > 0
            ? (metadata as Prisma.InputJsonValue)
            : undefined,
      },
    });
  }

  async update(id: string, dto: UpdateParadaDto, userId?: string) {
    const parada = await this.prisma.registroParada.findUnique({ where: { id } });
    if (!parada) throw new NotFoundException('Parada nao encontrada');
    // Antes só bloqueava CANCELADA — agora bloqueia FINALIZADA também (reabrir antes).
    // Exceção: se o caller está APENAS preenchendo `fim` em parada EM_ANDAMENTO
    // (fluxo legítimo de "concluir editando"), o assert não é aplicado.
    this.assertParadaEditavel(parada, 'editar');

    if (dto.softwareId) {
      const software = await this.prisma.software.findUnique({ where: { id: dto.softwareId } });
      if (!software) throw new NotFoundException('Software nao encontrado');
    }

    if (dto.softwareModuloId) {
      const swId = dto.softwareId || parada.softwareId;
      const modulo = await this.prisma.softwareModulo.findFirst({
        where: { id: dto.softwareModuloId, softwareId: swId },
      });
      if (!modulo) throw new BadRequestException('Modulo nao pertence ao software informado');
    }

    const { filialIds, fim, ...data } = dto;
    const updateData: Record<string, unknown> = { ...data };
    if (data.inicio) updateData.inicio = new Date(data.inicio);

    // Tratar campo fim: se preenchido, finalizar a parada
    if (fim) {
      const fimDate = new Date(fim);
      const inicioDate = data.inicio ? new Date(data.inicio) : parada.inicio;
      if (fimDate <= inicioDate) {
        throw new BadRequestException('Data fim deve ser posterior ao inicio');
      }
      updateData.fim = fimDate;
      updateData.duracaoMinutos = Math.round((fimDate.getTime() - inicioDate.getTime()) / 60000);
      if (parada.status === 'EM_ANDAMENTO') {
        updateData.status = 'FINALIZADA';
        if (userId) updateData.finalizadoPorId = userId;
      }
    }

    if (filialIds) {
      return this.prisma.$transaction(async (tx) => {
        await tx.paradaFilialAfetada.deleteMany({ where: { paradaId: id } });
        return tx.registroParada.update({
          where: { id },
          data: {
            ...updateData,
            filiaisAfetadas: {
              create: filialIds.map((filialId) => ({ filialId })),
            },
          },
          include: paradaDetailInclude,
        });
      });
    }

    return this.prisma.registroParada.update({
      where: { id },
      data: updateData,
      include: paradaDetailInclude,
    });
  }

  async finalizar(id: string, dto: FinalizarParadaDto, userId: string) {
    const parada = await this.prisma.registroParada.findUnique({ where: { id } });
    if (!parada) throw new NotFoundException('Parada nao encontrada');
    if (parada.status !== 'EM_ANDAMENTO') {
      throw new BadRequestException('So e possivel finalizar paradas em andamento');
    }

    // Se a parada foi reaberta antes (reabertaEm setado), exigir observações
    // que documentem o motivo da reabertura / o que foi alterado. Sem essa
    // regra, operador pode reabrir + refinalizar sem deixar rastro.
    if (parada.reabertaEm) {
      const obs = dto.observacoes?.trim() ?? '';
      if (obs.length < 10) {
        throw new BadRequestException(
          'Observações obrigatórias ao finalizar parada reaberta (mínimo 10 caracteres). ' +
            'Documente o que foi alterado ou o motivo da reabertura.',
        );
      }
    }

    const fim = dto.fim ? new Date(dto.fim) : new Date();
    if (fim <= parada.inicio) {
      throw new BadRequestException('Data fim deve ser posterior ao inicio');
    }

    const duracaoMinutos = Math.round((fim.getTime() - parada.inicio.getTime()) / 60000);

    const atualizada = await this.prisma.registroParada.update({
      where: { id },
      data: {
        status: 'FINALIZADA',
        fim,
        duracaoMinutos,
        finalizadoPorId: userId,
        observacoes: dto.observacoes ?? parada.observacoes,
        // Zera campos de reabertura — próxima finalização dessa parada (caso
        // seja reaberta de novo) só exige obs novamente se for reaberta de novo.
        reabertaEm: null,
        reabertaPorId: null,
      },
      include: paradaDetailInclude,
    });
    await this.registrarHistorico(id, 'FINALIZADA', userId, dto.observacoes ?? null, {
      fim: fim.toISOString(),
      duracaoMinutos,
      foiReaberta: !!parada.reabertaEm,
    });
    return atualizada;
  }

  async cancelar(id: string, userId?: string) {
    const parada = await this.prisma.registroParada.findUnique({ where: { id } });
    if (!parada) throw new NotFoundException('Parada nao encontrada');
    if (parada.status !== 'EM_ANDAMENTO') {
      throw new BadRequestException('So e possivel cancelar paradas em andamento');
    }

    const atualizada = await this.prisma.registroParada.update({
      where: { id },
      data: { status: 'CANCELADA' },
      include: paradaDetailInclude,
    });
    await this.registrarHistorico(id, 'CANCELADA', userId ?? null, null);
    return atualizada;
  }

  /**
   * Reabre uma parada FINALIZADA — devolve para EM_ANDAMENTO e zera os
   * dados de finalização (`fim`, `duracaoMinutos`, `finalizadoPorId`).
   * Caso de uso: operador finalizou cedo demais, esqueceu colaborador,
   * faltou anexar evidência, etc. CANCELADA continua terminal — não reabre.
   */
  async reabrir(id: string, userId: string) {
    const parada = await this.prisma.registroParada.findUnique({ where: { id } });
    if (!parada) throw new NotFoundException('Parada nao encontrada');
    if (parada.status === 'EM_ANDAMENTO') {
      throw new BadRequestException('Esta parada ja esta em andamento — nao precisa reabrir.');
    }
    if (parada.status === 'CANCELADA') {
      throw new BadRequestException(
        'Parada cancelada nao pode ser reaberta. Cancelamento e estado terminal — registre uma nova parada se necessario.',
      );
    }
    // status === 'FINALIZADA'. Registra reabertura para que finalizar()
    // subsequente exija observações documentando o que foi alterado.
    const atualizada = await this.prisma.registroParada.update({
      where: { id },
      data: {
        status: 'EM_ANDAMENTO',
        fim: null,
        duracaoMinutos: null,
        finalizadoPorId: null,
        reabertaEm: new Date(),
        reabertaPorId: userId,
      },
      include: paradaDetailInclude,
    });
    await this.registrarHistorico(id, 'REABERTA', userId, null, {
      fimAnterior: parada.fim?.toISOString(),
      duracaoMinutosAnterior: parada.duracaoMinutos,
    });
    return atualizada;
  }

  async vincularChamado(paradaId: string, chamadoId: string) {
    const parada = await this.prisma.registroParada.findUnique({ where: { id: paradaId } });
    if (!parada) throw new NotFoundException('Parada nao encontrada');
    this.assertParadaEditavel(parada, 'vincular chamado');

    const chamado = await this.prisma.chamado.findUnique({ where: { id: chamadoId } });
    if (!chamado) throw new NotFoundException('Chamado nao encontrado');

    const existing = await this.prisma.paradaChamado.findUnique({
      where: { paradaId_chamadoId: { paradaId, chamadoId } },
    });
    if (existing) throw new BadRequestException('Chamado ja vinculado a esta parada');

    await this.prisma.paradaChamado.create({
      data: { paradaId, chamadoId },
    });

    return this.findOne(paradaId);
  }

  // === Motivos de Parada ===

  async findAllMotivos() {
    return this.prisma.motivoParada.findMany({
      orderBy: { nome: 'asc' },
    });
  }

  async createMotivo(dto: CreateMotivoParadaDto) {
    return this.prisma.motivoParada.create({ data: dto });
  }

  async updateMotivo(id: string, dto: UpdateMotivoParadaDto) {
    const motivo = await this.prisma.motivoParada.findUnique({ where: { id } });
    if (!motivo) throw new NotFoundException('Motivo de parada nao encontrado');
    return this.prisma.motivoParada.update({ where: { id }, data: dto });
  }

  async removeMotivo(id: string) {
    const existing = await this.prisma.motivoParada.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Motivo de parada nao encontrado');
    const vinculos = await this.prisma.registroParada.count({ where: { motivoParadaId: id } });
    if (vinculos > 0) throw new BadRequestException(`Motivo possui ${vinculos} parada(s) vinculada(s). Inative-o em vez de excluir.`);
    await this.prisma.motivoParada.delete({ where: { id } });
    return { success: true };
  }

  async listarColaboradores(paradaId: string) {
    return this.prisma.paradaColaborador.findMany({
      where: { paradaId },
      include: { usuario: { select: { id: true, nome: true, username: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async adicionarColaborador(paradaId: string, usuarioId: string) {
    const parada = await this.prisma.registroParada.findUnique({ where: { id: paradaId } });
    if (!parada) throw new NotFoundException('Parada nao encontrada');
    this.assertParadaEditavel(parada, 'adicionar colaborador');
    if (parada.registradoPorId === usuarioId) {
      throw new BadRequestException('O usuario que registrou a parada nao pode ser adicionado como colaborador');
    }
    const jaExiste = await this.prisma.paradaColaborador.findFirst({
      where: { paradaId, usuarioId },
    });
    if (jaExiste) {
      throw new BadRequestException('Usuario ja e colaborador desta parada');
    }
    await this.prisma.paradaColaborador.create({
      data: { paradaId, usuarioId },
    });
    return this.findOne(paradaId);
  }

  async removerColaborador(paradaId: string, colaboradorId: string) {
    const parada = await this.prisma.registroParada.findUnique({ where: { id: paradaId } });
    if (!parada) throw new NotFoundException('Parada nao encontrada');
    this.assertParadaEditavel(parada, 'remover colaborador');
    const reg = await this.prisma.paradaColaborador.findFirst({
      where: { id: colaboradorId, paradaId },
    });
    if (!reg) throw new NotFoundException('Colaborador nao encontrado nesta parada');
    await this.prisma.paradaColaborador.delete({ where: { id: colaboradorId } });
    return this.findOne(paradaId);
  }

  async desvincularChamado(paradaId: string, chamadoId: string) {
    const parada = await this.prisma.registroParada.findUnique({ where: { id: paradaId } });
    if (!parada) throw new NotFoundException('Parada nao encontrada');
    this.assertParadaEditavel(parada, 'desvincular chamado');

    const vinculo = await this.prisma.paradaChamado.findUnique({
      where: { paradaId_chamadoId: { paradaId, chamadoId } },
    });
    if (!vinculo) throw new NotFoundException('Vinculo nao encontrado');

    await this.prisma.paradaChamado.delete({
      where: { id: vinculo.id },
    });

    return this.findOne(paradaId);
  }
}
