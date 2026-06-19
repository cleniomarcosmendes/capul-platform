import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StatusViagem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CoreLookupService } from '../core/core-lookup.service.js';
import type { JwtPayload } from '../common/decorators/current-user.decorator.js';
import { RegistrarPosicaoDto } from './dto.js';

/**
 * Rastreamento em tempo real (Fase A, 19/06/2026) — o app envia pings de GPS
 * enquanto a viagem está EM_CURSO (foreground); o Monitor da Frota mostra a
 * última posição de cada viagem ativa da filial.
 *
 * LGPD: só grava com a viagem EM_CURSO (liga na saída, para no retorno) — fora
 * disso ignora silenciosamente. Leitura do mapa é restrita a gestores no
 * controller. Rastreia a ENTREGA/viagem, não a pessoa 24h.
 */
@Injectable()
export class RastreamentoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: CoreLookupService,
  ) {}

  /** Grava um ponto do trajeto. Best-effort: posição não vale a pena reter se a
   *  viagem já fechou (200 sem gravar, pra o app não tratar como erro). */
  async registrar(dto: RegistrarPosicaoDto, user: JwtPayload) {
    if (!user.filialId) throw new BadRequestException('Usuário sem filial definida.');
    const v = await this.prisma.viagem.findUnique({
      where: { id: dto.viagemId },
      select: { id: true, filialId: true, situacao: true },
    });
    if (!v) throw new NotFoundException('Viagem não encontrada.');
    if (v.filialId !== user.filialId) throw new ForbiddenException('Viagem de outra filial.');
    if (v.situacao !== StatusViagem.EM_CURSO) return { ok: false, motivo: 'viagem_inativa' as const };

    await this.prisma.posicaoVeiculo.create({
      data: {
        viagemId: v.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        precisao: dto.precisao ?? null,
        velocidade: dto.velocidade ?? null,
        bateria: dto.bateria ?? null,
        capturadoEm: dto.capturadoEm ? new Date(dto.capturadoEm) : new Date(),
      },
    });
    return { ok: true as const };
  }

  /** Estatísticas do rastro pra tela de política no Configurador (visão geral,
   *  sem recorte de filial — é um panorama administrativo). */
  async estatisticas() {
    const [totalPosicoes, agg, viagens] = await Promise.all([
      this.prisma.posicaoVeiculo.count(),
      this.prisma.posicaoVeiculo.aggregate({ _min: { capturadoEm: true } }),
      this.prisma.posicaoVeiculo.findMany({ distinct: ['viagemId'], select: { viagemId: true } }),
    ]);
    return {
      totalPosicoes,
      viagensComPosicao: viagens.length,
      posicaoMaisAntiga: agg._min.capturadoEm,
    };
  }

  /** Última posição de cada viagem EM_CURSO da filial — alimenta o mapa ao vivo. */
  async ativos(filialId: string) {
    const viagens = await this.prisma.viagem.findMany({
      where: { filialId, situacao: StatusViagem.EM_CURSO },
      select: {
        id: true,
        numero: true,
        tipo: true,
        condutorNome: true,
        motoristaId: true,
        dataHoraSaida: true,
        veiculo: { select: { placa: true, modelo: true } },
        posicoes: {
          orderBy: { capturadoEm: 'desc' },
          take: 1,
          select: { latitude: true, longitude: true, precisao: true, velocidade: true, bateria: true, capturadoEm: true },
        },
      },
      orderBy: { dataHoraSaida: 'desc' },
    });

    // Nome do condutor: FROTA já tem `condutorNome` na viagem; ENTREGA usa o
    // motoristaId (usuário do core) — resolve em lote.
    const nomesMot = await this.core.nomesUsuarios(
      viagens.map((v) => v.motoristaId).filter((x): x is string => !!x),
    );

    return viagens.map((v) => {
      const p = v.posicoes[0];
      return {
        viagemId: v.id,
        numero: v.numero,
        tipo: v.tipo,
        condutor: v.condutorNome ?? (v.motoristaId ? nomesMot.get(v.motoristaId) ?? null : null),
        veiculoPlaca: v.veiculo?.placa ?? null,
        veiculoModelo: v.veiculo?.modelo ?? null,
        dataHoraSaida: v.dataHoraSaida,
        posicao: p
          ? {
              latitude: Number(p.latitude),
              longitude: Number(p.longitude),
              precisao: p.precisao != null ? Number(p.precisao) : null,
              velocidade: p.velocidade != null ? Number(p.velocidade) : null,
              bateria: p.bateria,
              capturadoEm: p.capturadoEm,
            }
          : null,
      };
    });
  }
}
