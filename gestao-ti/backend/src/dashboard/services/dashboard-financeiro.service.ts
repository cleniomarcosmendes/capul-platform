import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { resolvePeriodo } from './dashboard-utils.js';

@Injectable()
export class DashboardFinanceiroService {
  constructor(private readonly prisma: PrismaService) {}

  async getFinanceiro(filters?: { dataInicio?: string; dataFim?: string }) {
    const hasPeriod = !!filters?.dataInicio || !!filters?.dataFim;

    let contratosVencendoWhere: Record<string, unknown>;
    let parcelasWhere: Record<string, unknown>;

    if (hasPeriod) {
      const { inicio, fim } = resolvePeriodo(filters);
      contratosVencendoWhere = { status: 'ATIVO', dataFim: { gte: inicio, lte: fim } };
      parcelasWhere = { status: 'PENDENTE', dataVencimento: { gte: inicio, lte: fim } };
    } else {
      const limit90d = new Date();
      limit90d.setDate(limit90d.getDate() + 90);
      const limit30d = new Date();
      limit30d.setDate(limit30d.getDate() + 30);
      contratosVencendoWhere = { status: 'ATIVO', dataFim: { lte: limit90d, gte: new Date() } };
      parcelasWhere = { status: 'PENDENTE', dataVencimento: { lte: limit30d } };
    }

    const [
      contratosPorTipo,
      contratosPorStatus,
      contratosVencendo,
      parcelasProximas,
      rateioItens,
    ] = await Promise.all([
      this.prisma.contrato.groupBy({
        by: ['tipoContratoId'],
        where: { status: { in: ['ATIVO', 'SUSPENSO'] } },
        _count: true,
        _sum: { valorTotal: true },
      }),
      this.prisma.contrato.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.prisma.contrato.findMany({
        where: contratosVencendoWhere,
        select: {
          id: true,
          numero: true,
          titulo: true,
          fornecedor: true,
          valorTotal: true,
          dataFim: true,
          software: { select: { id: true, nome: true } },
        },
        orderBy: { dataFim: 'asc' },
      }),
      this.prisma.parcelaContrato.findMany({
        where: parcelasWhere,
        include: {
          contrato: { select: { id: true, numero: true, titulo: true, fornecedor: true } },
        },
        orderBy: { dataVencimento: 'asc' },
      }),
      this.prisma.parcelaRateioItem.findMany({
        where: {
          parcela: { contrato: { status: { in: ['ATIVO', 'SUSPENSO'] } } },
        },
        include: {
          centroCusto: { select: { id: true, codigo: true, nome: true } },
        },
      }),
    ]);

    // Agrupar despesas por centro de custo
    const ccMap = new Map<string, { centroCusto: { id: string; codigo: string; nome: string }; valorTotal: number }>();
    for (const item of rateioItens) {
      const key = item.centroCustoId;
      const existing = ccMap.get(key);
      const valor = Number(item.valorCalculado ?? 0);
      if (existing) {
        existing.valorTotal += valor;
      } else {
        ccMap.set(key, { centroCusto: item.centroCusto, valorTotal: valor });
      }
    }

    const { inicio, fim } = hasPeriod
      ? resolvePeriodo(filters)
      : { inicio: new Date(), fim: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) };

    // Lookup nomes dos tipos de contrato
    const tipoIds = contratosPorTipo
      .map((g) => g.tipoContratoId)
      .filter(Boolean) as string[];
    const tiposContrato = tipoIds.length > 0
      ? await this.prisma.tipoContratoConfig.findMany({
          where: { id: { in: tipoIds } },
          select: { id: true, codigo: true, nome: true },
        })
      : [];
    const tipoMap = Object.fromEntries(tiposContrato.map((t) => [t.id, t]));

    return {
      periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
      contratosPorTipo: contratosPorTipo.map((g) => ({
        tipoContratoId: g.tipoContratoId,
        tipoNome: g.tipoContratoId ? (tipoMap[g.tipoContratoId]?.nome || 'Desconhecido') : 'Sem tipo',
        total: g._count,
        valorTotal: Number(g._sum.valorTotal ?? 0),
      })),
      contratosPorStatus: contratosPorStatus.map((g) => ({
        status: g.status,
        total: g._count,
      })),
      despesasPorCentroCusto: Array.from(ccMap.values()).sort((a, b) => b.valorTotal - a.valorTotal),
      contratosVencendo: contratosVencendo.map((c) => ({
        ...c,
        valorTotal: Number(c.valorTotal),
      })),
      parcelasProximas: parcelasProximas.map((p) => ({
        ...p,
        valor: Number(p.valor),
      })),
    };
  }

  async getCsat(filters?: { dataInicio?: string; dataFim?: string; departamentoId?: string }) {
    const { inicio, fim } = resolvePeriodo(filters);
    const periodoFilter = { gte: inicio, lte: fim };
    const deptoFilter = filters?.departamentoId ? { departamentoId: filters.departamentoId } : {};

    // Ultimos 6 meses para evolucao
    const seisAtras = new Date();
    seisAtras.setMonth(seisAtras.getMonth() - 5);
    seisAtras.setDate(1);
    seisAtras.setHours(0, 0, 0, 0);

    const [
      totalFechados,
      totalAvaliados,
      somaNotas,
      distribuicaoRaw,
      avaliadosComTecnico,
      avaliadosComEquipe,
      avaliadosComServico,
      evolucaoRaw,
      chamadosNotaBaixa,
    ] = await Promise.all([
      this.prisma.chamado.count({
        where: { status: { in: ['RESOLVIDO', 'FECHADO'] }, createdAt: periodoFilter, ...deptoFilter },
      }),
      this.prisma.chamado.count({
        where: { notaSatisfacao: { not: null }, createdAt: periodoFilter, ...deptoFilter },
      }),
      this.prisma.chamado.aggregate({
        where: { notaSatisfacao: { not: null }, createdAt: periodoFilter, ...deptoFilter },
        _avg: { notaSatisfacao: true },
      }),
      this.prisma.chamado.groupBy({
        by: ['notaSatisfacao'],
        where: { notaSatisfacao: { not: null }, createdAt: periodoFilter, ...deptoFilter },
        _count: true,
      }),
      this.prisma.chamado.groupBy({
        by: ['tecnicoId'],
        where: { notaSatisfacao: { not: null }, tecnicoId: { not: null }, createdAt: periodoFilter, ...deptoFilter },
        _count: true,
        _avg: { notaSatisfacao: true },
      }),
      this.prisma.chamado.groupBy({
        by: ['equipeAtualId'],
        where: { notaSatisfacao: { not: null }, createdAt: periodoFilter, ...deptoFilter },
        _count: true,
        _avg: { notaSatisfacao: true },
      }),
      this.prisma.chamado.groupBy({
        by: ['catalogoServicoId'],
        where: { notaSatisfacao: { not: null }, createdAt: periodoFilter, ...deptoFilter },
        _count: true,
        _avg: { notaSatisfacao: true },
      }),
      this.prisma.chamado.findMany({
        where: { notaSatisfacao: { not: null }, createdAt: { gte: seisAtras }, ...deptoFilter },
        select: { notaSatisfacao: true, createdAt: true },
      }),
      this.prisma.chamado.findMany({
        where: { notaSatisfacao: { lte: 2 }, createdAt: periodoFilter, ...deptoFilter },
        select: {
          id: true, numero: true, titulo: true, notaSatisfacao: true,
          comentarioSatisfacao: true, status: true, createdAt: true,
          solicitante: { select: { id: true, nome: true } },
          tecnico: { select: { id: true, nome: true } },
          equipeAtual: { select: { id: true, nome: true, sigla: true } },
          catalogoServico: { select: { id: true, nome: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Buscar nomes de tecnicos
    const tecnicoIds = avaliadosComTecnico.map((t) => t.tecnicoId).filter(Boolean) as string[];
    const tecnicos = tecnicoIds.length > 0
      ? await this.prisma.usuario.findMany({ where: { id: { in: tecnicoIds } }, select: { id: true, nome: true } })
      : [];
    const tecnicoMap = Object.fromEntries(tecnicos.map((t) => [t.id, t]));

    // Buscar nomes de equipes
    const equipeIds = avaliadosComEquipe.map((e) => e.equipeAtualId);
    const equipes = equipeIds.length > 0
      ? await this.prisma.equipeTI.findMany({ where: { id: { in: equipeIds } }, select: { id: true, nome: true, sigla: true } })
      : [];
    const equipeMap = Object.fromEntries(equipes.map((e) => [e.id, e]));

    // Buscar nomes de servicos
    const servicoIds = avaliadosComServico.map((s) => s.catalogoServicoId).filter(Boolean) as string[];
    const servicos = servicoIds.length > 0
      ? await this.prisma.catalogoServico.findMany({ where: { id: { in: servicoIds } }, select: { id: true, nome: true } })
      : [];
    const servicoMap = Object.fromEntries(servicos.map((s) => [s.id, s]));

    // Distribuicao de notas (garantir 1-5)
    const distMap = new Map<number, number>();
    for (const d of distribuicaoRaw) {
      if (d.notaSatisfacao !== null) distMap.set(d.notaSatisfacao, d._count);
    }
    const distribuicaoNotas = [1, 2, 3, 4, 5].map((nota) => ({
      nota,
      total: distMap.get(nota) || 0,
    }));

    // Evolucao mensal
    const mesMap = new Map<string, { soma: number; count: number }>();
    for (const c of evolucaoRaw) {
      const d = new Date(c.createdAt);
      const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const existing = mesMap.get(mes);
      if (existing) {
        existing.soma += c.notaSatisfacao!;
        existing.count++;
      } else {
        mesMap.set(mes, { soma: c.notaSatisfacao!, count: 1 });
      }
    }
    const evolucaoMensal = Array.from(mesMap.entries())
      .map(([mes, v]) => ({ mes, media: +(v.soma / v.count).toFixed(2), total: v.count }))
      .sort((a, b) => a.mes.localeCompare(b.mes));

    const taxaResposta = totalFechados > 0
      ? +((totalAvaliados / totalFechados) * 100).toFixed(1)
      : 0;

    return {
      periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
      totalFechados,
      totalAvaliados,
      taxaResposta,
      csatMedio: +(somaNotas._avg.notaSatisfacao ?? 0).toFixed(2),
      distribuicaoNotas,
      porTecnico: avaliadosComTecnico.map((t) => ({
        tecnico: tecnicoMap[t.tecnicoId!] || { id: t.tecnicoId, nome: 'Desconhecido' },
        media: +(t._avg.notaSatisfacao ?? 0).toFixed(2),
        total: t._count,
      })).sort((a, b) => b.media - a.media),
      porEquipe: avaliadosComEquipe.map((e) => ({
        equipe: equipeMap[e.equipeAtualId] || { id: e.equipeAtualId, nome: 'Desconhecida', sigla: '?' },
        media: +(e._avg.notaSatisfacao ?? 0).toFixed(2),
        total: e._count,
      })).sort((a, b) => b.media - a.media),
      porCategoria: avaliadosComServico.map((s) => ({
        servico: s.catalogoServicoId ? (servicoMap[s.catalogoServicoId] || null) : null,
        media: +(s._avg.notaSatisfacao ?? 0).toFixed(2),
        total: s._count,
      })).sort((a, b) => b.media - a.media),
      evolucaoMensal,
      chamadosNotaBaixa,
    };
  }
}
