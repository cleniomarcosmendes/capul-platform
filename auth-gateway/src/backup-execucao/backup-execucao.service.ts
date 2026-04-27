import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface RegistrarDto {
  tipo: string;
  status: 'SUCESSO' | 'FALHA' | 'EM_ANDAMENTO';
  iniciadoEm?: string;
  finalizadoEm?: string;
  duracaoMs?: number;
  tamanhoBytes?: number;
  hostname?: string;
  destino?: string;
  cifrado?: boolean;
  mensagem?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class BackupExecucaoService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(opts: { take: number; status?: string }) {
    const where = opts.status ? { status: opts.status } : {};
    const items = await this.prisma.backupExecucao.findMany({
      where,
      orderBy: { iniciadoEm: 'desc' },
      take: opts.take,
    });
    // BigInt nao serializa em JSON — converter pra string
    return items.map((i) => ({
      ...i,
      tamanhoBytes: i.tamanhoBytes ? i.tamanhoBytes.toString() : null,
    }));
  }

  async detalhe(id: string) {
    const item = await this.prisma.backupExecucao.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Execucao de backup nao encontrada');
    return {
      ...item,
      tamanhoBytes: item.tamanhoBytes ? item.tamanhoBytes.toString() : null,
    };
  }

  /**
   * Status atual: ultimo backup full + contagens dos ultimos 7 dias.
   */
  async statusAtual() {
    const ultimoSucesso = await this.prisma.backupExecucao.findFirst({
      where: { status: 'SUCESSO', tipo: 'full' },
      orderBy: { iniciadoEm: 'desc' },
    });

    const ultimaFalha = await this.prisma.backupExecucao.findFirst({
      where: { status: 'FALHA' },
      orderBy: { iniciadoEm: 'desc' },
    });

    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    const contagem7d = await this.prisma.backupExecucao.groupBy({
      by: ['status'],
      where: { iniciadoEm: { gte: seteDiasAtras } },
      _count: { _all: true },
    });

    return {
      ultimoSucesso: ultimoSucesso
        ? {
            ...ultimoSucesso,
            tamanhoBytes: ultimoSucesso.tamanhoBytes
              ? ultimoSucesso.tamanhoBytes.toString()
              : null,
          }
        : null,
      ultimaFalha: ultimaFalha
        ? {
            ...ultimaFalha,
            tamanhoBytes: ultimaFalha.tamanhoBytes
              ? ultimaFalha.tamanhoBytes.toString()
              : null,
          }
        : null,
      contagem7d: contagem7d.reduce((acc, row) => {
        acc[row.status] = row._count._all;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  async registrar(dto: RegistrarDto) {
    return this.prisma.backupExecucao.create({
      data: {
        tipo: dto.tipo,
        status: dto.status,
        iniciadoEm: dto.iniciadoEm ? new Date(dto.iniciadoEm) : new Date(),
        finalizadoEm: dto.finalizadoEm ? new Date(dto.finalizadoEm) : null,
        duracaoMs: dto.duracaoMs ?? null,
        tamanhoBytes: dto.tamanhoBytes ? BigInt(dto.tamanhoBytes) : null,
        hostname: dto.hostname ?? null,
        destino: dto.destino ?? null,
        cifrado: dto.cifrado ?? false,
        mensagem: dto.mensagem ?? null,
        metadata: dto.metadata
          ? (dto.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  }
}
