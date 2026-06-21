import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const FINALIZADOS = ['RESOLVIDO', 'FECHADO', 'CANCELADO'];

/**
 * SAC Fase 4c — indicadores do SAC. "Chamado de SAC" = aquele cuja equipe atual
 * tem atendeSac. Janela = mês (mes/ano). Reconcilia volume + canal + equipe +
 * status + tempo de resolução + estatística do e-mail de entrada.
 */
@Injectable()
export class SacIndicadoresService {
  constructor(private readonly prisma: PrismaService) {}

  async indicadores(mes: number, ano: number) {
    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 1);

    const equipes = await this.prisma.equipe.findMany({ where: { atendeSac: true }, select: { id: true, nome: true, sigla: true } });
    const equipeIds = equipes.map((e) => e.id);
    const nomePorEquipe = new Map(equipes.map((e) => [e.id, e.sigla ? `${e.sigla} — ${e.nome}` : e.nome]));

    if (equipeIds.length === 0) {
      return this.vazio(mes, ano);
    }

    const baseSac = { equipeAtualId: { in: equipeIds } };
    const noMes = { gte: inicio, lt: fim };

    const [abertosNoMes, resolvidosNoMes, backlogAtual, porCanalRaw, porEquipeRaw, porStatusRaw, resolvidos, emailRaw, triagemPendente, backlogRows] =
      await Promise.all([
        this.prisma.chamado.count({ where: { ...baseSac, createdAt: noMes } }),
        this.prisma.chamado.count({ where: { ...baseSac, dataResolucao: noMes } }),
        this.prisma.chamado.count({ where: { ...baseSac, status: { notIn: FINALIZADOS as never[] } } }),
        this.prisma.chamado.groupBy({ by: ['canalOrigem'], where: { ...baseSac, createdAt: noMes }, _count: { _all: true } }),
        this.prisma.chamado.groupBy({ by: ['equipeAtualId'], where: { ...baseSac, createdAt: noMes }, _count: { _all: true } }),
        this.prisma.chamado.groupBy({ by: ['status'], where: { ...baseSac, createdAt: noMes }, _count: { _all: true } }),
        this.prisma.chamado.findMany({ where: { ...baseSac, dataResolucao: noMes }, select: { createdAt: true, dataResolucao: true, dataLimiteSla: true } }),
        this.prisma.sacEmailIngestao.groupBy({ by: ['resultado'], where: { processadoEm: noMes }, _count: { _all: true } }),
        this.prisma.sacEmailIngestao.count({ where: { triagemStatus: 'PENDENTE' } }),
        this.prisma.chamado.findMany({ where: { ...baseSac, status: { notIn: FINALIZADOS as never[] } }, select: { createdAt: true, dataLimiteSla: true } }),
      ]);

    // Tempo médio de resolução (horas) dos resolvidos no mês.
    let tempoResolucaoMedioHoras: number | null = null;
    if (resolvidos.length > 0) {
      const somaMs = resolvidos.reduce((acc, c) => acc + (c.dataResolucao!.getTime() - c.createdAt.getTime()), 0);
      tempoResolucaoMedioHoras = Math.round((somaMs / resolvidos.length / 3_600_000) * 10) / 10;
    }

    // SLA (4d): backlog atual por situação + cumprimento dos resolvidos no mês.
    const agora = Date.now();
    const slaBacklog = { vencidos: 0, emRisco: 0, noPrazo: 0, semSla: 0 };
    for (const c of backlogRows) {
      if (!c.dataLimiteSla) { slaBacklog.semSla++; continue; }
      const limite = c.dataLimiteSla.getTime();
      if (limite < agora) { slaBacklog.vencidos++; continue; }
      const total = limite - c.createdAt.getTime();
      const consumido = agora - c.createdAt.getTime();
      if (total > 0 && consumido / total >= 0.8) slaBacklog.emRisco++;
      else slaBacklog.noPrazo++;
    }
    const slaMes = { cumpridos: 0, estourados: 0, semSla: 0 };
    for (const c of resolvidos) {
      if (!c.dataLimiteSla) { slaMes.semSla++; continue; }
      if (c.dataResolucao!.getTime() <= c.dataLimiteSla.getTime()) slaMes.cumpridos++;
      else slaMes.estourados++;
    }
    const comSlaMes = slaMes.cumpridos + slaMes.estourados;
    const percentualCumprimento = comSlaMes > 0 ? Math.round((slaMes.cumpridos / comSlaMes) * 100) : null;

    const porCanal = porCanalRaw
      .map((r) => ({ canal: r.canalOrigem ?? 'NAO_INFORMADO', total: r._count._all }))
      .sort((a, b) => b.total - a.total);
    const porEquipe = porEquipeRaw
      .map((r) => ({ equipeId: r.equipeAtualId, nome: nomePorEquipe.get(r.equipeAtualId) ?? r.equipeAtualId, total: r._count._all }))
      .sort((a, b) => b.total - a.total);
    const porStatus = porStatusRaw
      .map((r) => ({ status: r.status, total: r._count._all }))
      .sort((a, b) => b.total - a.total);

    const emailMap = new Map(emailRaw.map((r) => [r.resultado, r._count._all]));
    const email = {
      ingeridosNoMes: emailRaw.reduce((a, r) => a + r._count._all, 0),
      casados: emailMap.get('MATCHED') ?? 0,
      triagem: emailMap.get('UNMATCHED') ?? 0,
      ignorados: (emailMap.get('SKIPPED_AUTO') ?? 0) + (emailMap.get('SKIPPED_OWN') ?? 0),
      duplicados: emailMap.get('DUPLICATE') ?? 0,
      triagemPendente,
    };

    return {
      periodo: { mes, ano },
      volume: { abertosNoMes, resolvidosNoMes, backlogAtual },
      tempoResolucaoMedioHoras,
      sla: { backlog: slaBacklog, mes: { ...slaMes, percentualCumprimento } },
      porCanal,
      porEquipe,
      porStatus,
      email,
    };
  }

  private vazio(mes: number, ano: number) {
    return {
      periodo: { mes, ano },
      volume: { abertosNoMes: 0, resolvidosNoMes: 0, backlogAtual: 0 },
      tempoResolucaoMedioHoras: null as number | null,
      sla: { backlog: { vencidos: 0, emRisco: 0, noPrazo: 0, semSla: 0 }, mes: { cumpridos: 0, estourados: 0, semSla: 0, percentualCumprimento: null as number | null } },
      porCanal: [] as { canal: string; total: number }[],
      porEquipe: [] as { equipeId: string; nome: string; total: number }[],
      porStatus: [] as { status: string; total: number }[],
      email: { ingeridosNoMes: 0, casados: 0, triagem: 0, ignorados: 0, duplicados: 0, triagemPendente: 0 },
    };
  }
}
