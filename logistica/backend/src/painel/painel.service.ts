import { Injectable } from '@nestjs/common';
import { Prisma, SituacaoVeiculo, StatusEntrega, StatusViagem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CoreLookupService } from '../core/core-lookup.service.js';

/**
 * Indicadores da Fase 1a — computáveis SEM o app do entregador (PR7).
 * Pendentes / em viagem / despachadas + recortes por dia, filial, veículo e
 * motorista (da montagem). Tudo read-only (count/groupBy + um $queryRaw pro
 * recorte por dia, que o groupBy não cobre). Filtro opcional por filial.
 */
@Injectable()
export class PainelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: CoreLookupService,
  ) {}

  async resumo(filialId?: string, dias = 14) {
    const janela = Math.min(Math.max(Number(dias) || 14, 1), 90);
    const escopo = filialId ? { filialId } : {};

    const [
      entPendentes, entEmViagem, entEntregues, entNaoEntregues, entCanceladas,
      vgRascunho, vgEmCurso, vgConcluidas,
      veicDisponiveis, veicEmUso, veicManutencao,
      porFilialRaw, porVeiculoRaw, porMotoristaRaw,
    ] = await Promise.all([
      this.prisma.entrega.count({ where: { ...escopo, status: StatusEntrega.PENDENTE } }),
      this.prisma.entrega.count({ where: { ...escopo, status: StatusEntrega.EM_VIAGEM } }),
      this.prisma.entrega.count({ where: { ...escopo, status: StatusEntrega.ENTREGUE } }),
      this.prisma.entrega.count({ where: { ...escopo, status: StatusEntrega.NAO_ENTREGUE } }),
      this.prisma.entrega.count({ where: { ...escopo, status: StatusEntrega.CANCELADA } }),
      this.prisma.viagem.count({ where: { ...escopo, situacao: StatusViagem.RASCUNHO } }),
      this.prisma.viagem.count({ where: { ...escopo, situacao: StatusViagem.EM_CURSO } }),
      this.prisma.viagem.count({ where: { ...escopo, situacao: StatusViagem.CONCLUIDA } }),
      this.prisma.veiculo.count({ where: { ...escopo, situacao: SituacaoVeiculo.DISPONIVEL } }),
      this.prisma.veiculo.count({ where: { ...escopo, situacao: SituacaoVeiculo.EM_USO } }),
      this.prisma.veiculo.count({ where: { ...escopo, situacao: SituacaoVeiculo.EM_MANUTENCAO } }),
      this.prisma.entrega.groupBy({ by: ['filialId', 'status'], where: escopo, _count: { _all: true } }),
      this.prisma.viagem.groupBy({
        by: ['veiculoId'],
        where: { ...escopo, situacao: { not: StatusViagem.CANCELADA } },
        _count: { _all: true },
      }),
      this.prisma.viagem.groupBy({
        by: ['motoristaId'],
        where: { ...escopo, situacao: { not: StatusViagem.CANCELADA } },
        _count: { _all: true },
      }),
    ]);

    // ── Por filial: agrega os status de entrega por filial ──
    const filialMap = new Map<string, { filialId: string; pendentes: number; emViagem: number; entregues: number; total: number }>();
    for (const r of porFilialRaw) {
      const e = filialMap.get(r.filialId) ?? { filialId: r.filialId, pendentes: 0, emViagem: 0, entregues: 0, total: 0 };
      const n = r._count._all;
      if (r.status === StatusEntrega.PENDENTE) e.pendentes += n;
      else if (r.status === StatusEntrega.EM_VIAGEM) e.emViagem += n;
      else if (r.status === StatusEntrega.ENTREGUE) e.entregues += n;
      e.total += n;
      filialMap.set(r.filialId, e);
    }

    // ── Por veículo: junta a placa (local) ──
    const veiculoIds = porVeiculoRaw.map((v) => v.veiculoId);
    const veiculos = veiculoIds.length
      ? await this.prisma.veiculo.findMany({ where: { id: { in: veiculoIds } }, select: { id: true, placa: true } })
      : [];
    const placaPorId = new Map(veiculos.map((v) => [v.id, v.placa]));
    const porVeiculo = porVeiculoRaw
      .map((v) => ({ veiculoId: v.veiculoId, placa: placaPorId.get(v.veiculoId) ?? '—', viagens: v._count._all }))
      .sort((a, b) => b.viagens - a.viagens);

    // Nomes de motorista/filial são resolvidos no frontend (core) — aqui só IDs+contagem.
    const porMotorista = porMotoristaRaw
      .map((m) => ({ motoristaId: m.motoristaId, viagens: m._count._all }))
      .sort((a, b) => b.viagens - a.viagens);

    // ── Por dia (série contínua via generate_series — TZ-consistente, sem buracos):
    // entregas criadas (criado_em) × viagens despachadas (data_hora_saida). ──
    const fEnt = filialId ? Prisma.sql`AND filial_id = ${filialId}` : Prisma.empty;
    const fVg = filialId ? Prisma.sql`AND filial_id = ${filialId}` : Prisma.empty;
    const porDia = await this.prisma.$queryRaw<{ dia: string; criadas: number; despachadas: number }[]>(Prisma.sql`
      SELECT to_char(d, 'YYYY-MM-DD') AS dia,
             coalesce(c.n, 0)::int AS criadas,
             coalesce(v.n, 0)::int AS despachadas
      FROM generate_series(
             date_trunc('day', now()) - make_interval(days => ${janela - 1}::int),
             date_trunc('day', now()),
             interval '1 day'
           ) AS d
      LEFT JOIN (
        SELECT date_trunc('day', criado_em) AS dd, count(*) AS n
        FROM "logistica"."entrega"
        WHERE criado_em >= date_trunc('day', now()) - make_interval(days => ${janela - 1}::int) ${fEnt}
        GROUP BY 1
      ) c ON c.dd = d
      LEFT JOIN (
        SELECT date_trunc('day', data_hora_saida) AS dd, count(*) AS n
        FROM "logistica"."viagem"
        WHERE data_hora_saida IS NOT NULL
          AND data_hora_saida >= date_trunc('day', now()) - make_interval(days => ${janela - 1}::int) ${fVg}
        GROUP BY 1
      ) v ON v.dd = d
      ORDER BY d`);

    // Nomes (core) para filial e motorista — painel autossuficiente.
    const filiaisOrden = [...filialMap.values()].sort((a, b) => b.total - a.total);
    const [nomesFil, nomesMot] = await Promise.all([
      this.core.nomesFiliais(filiaisOrden.map((f) => f.filialId)),
      this.core.nomesUsuarios(porMotorista.map((m) => m.motoristaId)),
    ]);

    return {
      filtros: { filialId: filialId ?? null, dias: janela },
      cards: {
        entregasPendentes: entPendentes,
        entregasEmViagem: entEmViagem,
        entregasEntregues: entEntregues,
        entregasNaoEntregues: entNaoEntregues,
        entregasCanceladas: entCanceladas,
        viagensRascunho: vgRascunho,
        viagensEmCurso: vgEmCurso,
        viagensConcluidas: vgConcluidas,
        veiculosDisponiveis: veicDisponiveis,
        veiculosEmUso: veicEmUso,
        veiculosManutencao: veicManutencao,
      },
      porDia,
      porFilial: filiaisOrden.map((f) => ({ ...f, nomeFilial: nomesFil.get(f.filialId) ?? null })),
      porVeiculo,
      porMotorista: porMotorista.map((m) => ({ ...m, nomeMotorista: nomesMot.get(m.motoristaId) ?? null })),
    };
  }
}
