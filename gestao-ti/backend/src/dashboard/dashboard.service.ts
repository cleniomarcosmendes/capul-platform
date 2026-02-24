import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private resolvePeriodo(filters?: { dataInicio?: string; dataFim?: string }) {
    const now = new Date();
    const fim = filters?.dataFim
      ? new Date(filters.dataFim + 'T23:59:59.999Z')
      : now;
    const inicio = filters?.dataInicio
      ? new Date(filters.dataInicio + 'T00:00:00.000Z')
      : new Date(now.getFullYear(), now.getMonth(), 1);
    return { inicio, fim };
  }

  async getResumo(filters?: { dataInicio?: string; dataFim?: string; departamentoId?: string }) {
    const { inicio, fim } = this.resolvePeriodo(filters);
    const limitVencendo30d = new Date();
    limitVencendo30d.setDate(limitVencendo30d.getDate() + 30);
    const periodoFilter = { gte: inicio, lte: fim };
    const deptoFilter = filters?.departamentoId ? { departamentoId: filters.departamentoId } : {};

    const [
      totalAbertos,
      totalEmAtendimento,
      totalPendentes,
      totalResolvidos,
      totalFechados,
      chamadosPorEquipe,
      chamadosPorPrioridade,
      equipes,
      osAbertas,
      totalSoftwares,
      totalLicencasAtivas,
      licencasVencendo30d,
      custoAnualLicencas,
      totalContratosAtivos,
      valorTotalContratos,
      contratosVencendo30d,
      parcelasPendentes,
      parcelasAtrasadas,
      paradasEmAndamento,
      totalParadasPeriodo,
      projetosAtivos,
      projetosEmAndamento,
      custoProjetosPrevisto,
      custoProjetosRealizado,
      totalHorasApontadas,
      riscosAbertos,
      totalAtivosAtivos,
      totalArtigosPublicados,
    ] = await Promise.all([
      this.prisma.chamado.count({ where: { status: 'ABERTO', createdAt: periodoFilter, ...deptoFilter } }),
      this.prisma.chamado.count({ where: { status: 'EM_ATENDIMENTO', createdAt: periodoFilter, ...deptoFilter } }),
      this.prisma.chamado.count({ where: { status: 'PENDENTE', createdAt: periodoFilter, ...deptoFilter } }),
      this.prisma.chamado.count({ where: { status: 'RESOLVIDO', createdAt: periodoFilter, ...deptoFilter } }),
      this.prisma.chamado.count({ where: { status: 'FECHADO', createdAt: periodoFilter, ...deptoFilter } }),
      this.prisma.chamado.groupBy({
        by: ['equipeAtualId'],
        where: { status: { in: ['ABERTO', 'EM_ATENDIMENTO', 'PENDENTE'] }, createdAt: periodoFilter, ...deptoFilter },
        _count: true,
      }),
      this.prisma.chamado.groupBy({
        by: ['prioridade'],
        where: { status: { in: ['ABERTO', 'EM_ATENDIMENTO', 'PENDENTE'] }, createdAt: periodoFilter, ...deptoFilter },
        _count: true,
      }),
      this.prisma.equipeTI.findMany({
        where: { status: 'ATIVO' },
        select: { id: true, nome: true, sigla: true, cor: true },
      }),
      this.prisma.ordemServico.count({ where: { status: { in: ['ABERTA', 'EM_EXECUCAO'] }, createdAt: periodoFilter } }),
      this.prisma.software.count({ where: { status: 'ATIVO' } }),
      this.prisma.softwareLicenca.count({ where: { status: 'ATIVA' } }),
      this.prisma.softwareLicenca.count({
        where: {
          status: 'ATIVA',
          dataVencimento: { lte: limitVencendo30d, gte: new Date() },
        },
      }),
      this.prisma.softwareLicenca.aggregate({
        where: { status: 'ATIVA' },
        _sum: { valorTotal: true },
      }),
      this.prisma.contrato.count({ where: { status: 'ATIVO' } }),
      this.prisma.contrato.aggregate({
        where: { status: { in: ['ATIVO', 'SUSPENSO'] } },
        _sum: { valorTotal: true },
      }),
      this.prisma.contrato.count({
        where: {
          status: 'ATIVO',
          dataFim: { lte: limitVencendo30d, gte: new Date() },
        },
      }),
      this.prisma.parcelaContrato.count({ where: { status: 'PENDENTE' } }),
      this.prisma.parcelaContrato.count({
        where: { status: 'PENDENTE', dataVencimento: { lt: new Date() } },
      }),
      this.prisma.registroParada.count({ where: { status: 'EM_ANDAMENTO' } }),
      this.prisma.registroParada.count({
        where: { inicio: periodoFilter },
      }),
      this.prisma.projeto.count({
        where: {
          status: { in: ['PLANEJAMENTO', 'EM_ANDAMENTO', 'PAUSADO'] },
          nivel: 1,
        },
      }),
      this.prisma.projeto.count({
        where: { status: 'EM_ANDAMENTO', nivel: 1 },
      }),
      this.prisma.projeto.aggregate({
        where: {
          status: { in: ['PLANEJAMENTO', 'EM_ANDAMENTO', 'PAUSADO'] },
          nivel: 1,
        },
        _sum: { custoPrevisto: true },
      }),
      this.prisma.projeto.aggregate({
        where: {
          status: { in: ['PLANEJAMENTO', 'EM_ANDAMENTO', 'PAUSADO'] },
          nivel: 1,
        },
        _sum: { custoRealizado: true },
      }),
      this.prisma.apontamentoHoras.aggregate({
        where: { data: periodoFilter },
        _sum: { horas: true },
      }),
      this.prisma.riscoProjeto.count({
        where: { status: { in: ['IDENTIFICADO', 'EM_ANALISE', 'MITIGANDO'] } },
      }),
      this.prisma.ativo.count({ where: { status: 'ATIVO' } }),
      this.prisma.artigoConhecimento.count({ where: { status: 'PUBLICADO' } }),
    ]);

    const equipeMap = Object.fromEntries(equipes.map((e) => [e.id, e]));

    return {
      periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
      chamados: {
        abertos: totalAbertos,
        emAtendimento: totalEmAtendimento,
        pendentes: totalPendentes,
        resolvidos: totalResolvidos,
        fechados: totalFechados,
      },
      porEquipe: chamadosPorEquipe.map((g) => ({
        equipe: equipeMap[g.equipeAtualId] || { id: g.equipeAtualId },
        total: g._count,
      })),
      porPrioridade: chamadosPorPrioridade.map((g) => ({
        prioridade: g.prioridade,
        total: g._count,
      })),
      ordensServico: { abertas: osAbertas },
      portfolio: {
        totalSoftwares,
        totalLicencasAtivas,
        licencasVencendo30d,
        custoAnualLicencas: Number(custoAnualLicencas._sum.valorTotal ?? 0),
      },
      contratos: {
        totalAtivos: totalContratosAtivos,
        valorTotalComprometido: Number(valorTotalContratos._sum.valorTotal ?? 0),
        vencendo30d: contratosVencendo30d,
        parcelasPendentes,
        parcelasAtrasadas,
      },
      sustentacao: {
        paradasEmAndamento,
        totalParadasMes: totalParadasPeriodo,
      },
      projetos: {
        totalAtivos: projetosAtivos,
        emAndamento: projetosEmAndamento,
        custoPrevistoTotal: Number(custoProjetosPrevisto._sum.custoPrevisto ?? 0),
        custoRealizadoTotal: Number(custoProjetosRealizado._sum.custoRealizado ?? 0),
        totalHorasApontadas: Number(totalHorasApontadas._sum.horas ?? 0),
        riscosAbertos,
      },
      ativos: {
        totalAtivos: totalAtivosAtivos,
      },
      conhecimento: {
        totalArtigosPublicados,
      },
    };
  }

  async getExecutivo(filters?: { dataInicio?: string; dataFim?: string }) {
    const { inicio, fim } = this.resolvePeriodo(filters);
    const now = new Date();
    const limit30d = new Date();
    limit30d.setDate(limit30d.getDate() + 30);
    const periodoFilter = { gte: inicio, lte: fim };

    const [
      chamadosAbertos,
      chamadosEmAtendimento,
      chamadosPendentes,
      chamadosFechadosMes,
      chamadosSlaEstourado,
      chamadosFechadosParaSla,
      chamadosResolvidosRecentes,
      contratosAtivos,
      valorContratos,
      contratosVencendo30d,
      parcelasAtrasadas,
      paradasEmAndamento,
      totalParadasMes,
      paradasFinalizadasRecentes,
      projetosAtivos,
      projetosEmAndamento,
      custoPrevisto,
      custoRealizado,
      riscosAbertos,
      totalSoftwares,
      licencasAtivas,
      licencasVencendo30d,
      custoLicencas,
      totalAtivosAtivos,
      ativosPorTipo,
      ativosPorStatus,
      totalArtigosPublicados,
    ] = await Promise.all([
      // Chamados — filtrados por periodo
      this.prisma.chamado.count({ where: { status: 'ABERTO', createdAt: periodoFilter } }),
      this.prisma.chamado.count({ where: { status: 'EM_ATENDIMENTO', createdAt: periodoFilter } }),
      this.prisma.chamado.count({ where: { status: 'PENDENTE', createdAt: periodoFilter } }),
      this.prisma.chamado.count({
        where: { status: 'FECHADO', dataFechamento: periodoFilter },
      }),
      this.prisma.chamado.count({
        where: {
          status: { notIn: ['FECHADO', 'CANCELADO'] },
          createdAt: periodoFilter,
          dataLimiteSla: { lt: now, not: null },
        },
      }),
      this.prisma.chamado.findMany({
        where: {
          status: 'FECHADO',
          dataFechamento: periodoFilter,
          dataResolucao: { not: null },
          dataLimiteSla: { not: null },
        },
        select: { dataResolucao: true, dataLimiteSla: true },
      }),
      this.prisma.chamado.findMany({
        where: {
          status: { in: ['RESOLVIDO', 'FECHADO'] },
          dataResolucao: { not: null, ...periodoFilter },
        },
        select: { createdAt: true, dataResolucao: true },
      }),
      // Contratos — snapshot
      this.prisma.contrato.count({ where: { status: 'ATIVO' } }),
      this.prisma.contrato.aggregate({
        where: { status: { in: ['ATIVO', 'SUSPENSO'] } },
        _sum: { valorTotal: true },
      }),
      this.prisma.contrato.count({
        where: { status: 'ATIVO', dataFim: { lte: limit30d, gte: now } },
      }),
      this.prisma.parcelaContrato.count({
        where: { status: 'PENDENTE', dataVencimento: { lt: now } },
      }),
      // Sustentacao — filtrados por periodo
      this.prisma.registroParada.count({ where: { status: 'EM_ANDAMENTO' } }),
      this.prisma.registroParada.count({
        where: { inicio: periodoFilter },
      }),
      this.prisma.registroParada.findMany({
        where: {
          status: 'FINALIZADA',
          fim: periodoFilter,
          duracaoMinutos: { not: null },
        },
        select: { duracaoMinutos: true },
      }),
      // Projetos — snapshot
      this.prisma.projeto.count({
        where: { status: { in: ['PLANEJAMENTO', 'EM_ANDAMENTO', 'PAUSADO'] }, nivel: 1 },
      }),
      this.prisma.projeto.count({ where: { status: 'EM_ANDAMENTO', nivel: 1 } }),
      this.prisma.projeto.aggregate({
        where: { status: { in: ['PLANEJAMENTO', 'EM_ANDAMENTO', 'PAUSADO'] }, nivel: 1 },
        _sum: { custoPrevisto: true },
      }),
      this.prisma.projeto.aggregate({
        where: { status: { in: ['PLANEJAMENTO', 'EM_ANDAMENTO', 'PAUSADO'] }, nivel: 1 },
        _sum: { custoRealizado: true },
      }),
      this.prisma.riscoProjeto.count({
        where: { status: { in: ['IDENTIFICADO', 'EM_ANALISE', 'MITIGANDO'] } },
      }),
      // Portfolio — snapshot
      this.prisma.software.count({ where: { status: 'ATIVO' } }),
      this.prisma.softwareLicenca.count({ where: { status: 'ATIVA' } }),
      this.prisma.softwareLicenca.count({
        where: { status: 'ATIVA', dataVencimento: { lte: limit30d, gte: now } },
      }),
      this.prisma.softwareLicenca.aggregate({
        where: { status: 'ATIVA' },
        _sum: { valorTotal: true },
      }),
      // Ativos — snapshot
      this.prisma.ativo.count({ where: { status: 'ATIVO' } }),
      this.prisma.ativo.groupBy({ by: ['tipo'], _count: true }),
      this.prisma.ativo.groupBy({ by: ['status'], _count: true }),
      // Conhecimento — snapshot
      this.prisma.artigoConhecimento.count({ where: { status: 'PUBLICADO' } }),
    ]);

    // SLA compliance %
    const chamadosDentroSla = chamadosFechadosParaSla.filter(
      (c) => c.dataResolucao! <= c.dataLimiteSla!,
    ).length;
    const slaCompliancePercent = chamadosFechadosParaSla.length > 0
      ? +((chamadosDentroSla / chamadosFechadosParaSla.length) * 100).toFixed(1)
      : 100;

    // Tempo medio resolucao em horas
    let tempoMedioResolucaoHoras = 0;
    if (chamadosResolvidosRecentes.length > 0) {
      const totalHoras = chamadosResolvidosRecentes.reduce((sum, c) => {
        const diff = (c.dataResolucao!.getTime() - c.createdAt.getTime()) / 3600000;
        return sum + diff;
      }, 0);
      tempoMedioResolucaoHoras = +(totalHoras / chamadosResolvidosRecentes.length).toFixed(1);
    }

    // MTTR sustentacao
    let mttrMinutos = 0;
    if (paradasFinalizadasRecentes.length > 0) {
      const total = paradasFinalizadasRecentes.reduce((s, p) => s + (p.duracaoMinutos ?? 0), 0);
      mttrMinutos = Math.round(total / paradasFinalizadasRecentes.length);
    }

    return {
      periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
      chamados: {
        abertos: chamadosAbertos,
        emAtendimento: chamadosEmAtendimento,
        pendentes: chamadosPendentes,
        fechadosMes: chamadosFechadosMes,
        slaEstourado: chamadosSlaEstourado,
        tempoMedioResolucaoHoras,
        slaCompliancePercent,
      },
      contratos: {
        totalAtivos: contratosAtivos,
        valorComprometido: Number(valorContratos._sum.valorTotal ?? 0),
        vencendo30d: contratosVencendo30d,
        parcelasAtrasadas,
      },
      sustentacao: {
        paradasEmAndamento,
        totalParadasMes,
        mttrMinutos,
        mttrFormatado: this.formatDuration(mttrMinutos),
      },
      projetos: {
        totalAtivos: projetosAtivos,
        emAndamento: projetosEmAndamento,
        custoPrevistoTotal: Number(custoPrevisto._sum.custoPrevisto ?? 0),
        custoRealizadoTotal: Number(custoRealizado._sum.custoRealizado ?? 0),
        riscosAbertos,
      },
      portfolio: {
        totalSoftwares,
        licencasAtivas,
        licencasVencendo30d,
        custoLicencas: Number(custoLicencas._sum.valorTotal ?? 0),
      },
      ativos: {
        totalAtivos: totalAtivosAtivos,
        porTipo: ativosPorTipo.map((g) => ({ tipo: g.tipo, total: g._count })),
        porStatus: ativosPorStatus.map((g) => ({ status: g.status, total: g._count })),
      },
      conhecimento: {
        totalArtigosPublicados,
      },
    };
  }

  private formatDuration(minutos: number): string {
    if (minutos < 1) return '< 1m';
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  async getDisponibilidade(filters: {
    dataInicio?: string;
    dataFim?: string;
    softwareId?: string;
    filialId?: string;
  }) {
    const fim = filters.dataFim ? new Date(filters.dataFim) : new Date();
    const inicio = filters.dataInicio
      ? new Date(filters.dataInicio)
      : new Date(fim.getTime() - 30 * 24 * 60 * 60 * 1000);

    const periodoTotalMinutos = Math.round((fim.getTime() - inicio.getTime()) / 60000);

    const where: Record<string, unknown> = {
      status: { in: ['FINALIZADA', 'EM_ANDAMENTO'] },
      inicio: { lte: fim },
      OR: [
        { fim: { gte: inicio } },
        { fim: null },
      ],
    };
    if (filters.softwareId) where.softwareId = filters.softwareId;
    if (filters.filialId) {
      where.filiaisAfetadas = { some: { filialId: filters.filialId } };
    }

    const paradas = await this.prisma.registroParada.findMany({
      where,
      include: {
        software: { select: { id: true, nome: true, tipo: true, criticidade: true } },
        softwareModulo: { select: { id: true, nome: true } },
        registradoPor: { select: { id: true, nome: true, username: true } },
        filiaisAfetadas: {
          include: { filial: { select: { id: true, codigo: true, nomeFantasia: true } } },
        },
      },
      orderBy: { inicio: 'desc' },
    });

    // Agrupa por software
    const swMap = new Map<string, {
      software: { id: string; nome: string; tipo: string; criticidade: string | null };
      downtimeMinutos: number;
      totalParadas: number;
      paradasTotal: number;
      paradasParcial: number;
      duracoes: number[];
    }>();

    for (const p of paradas) {
      const pInicio = p.inicio < inicio ? inicio : p.inicio;
      const pFim = p.fim ? (p.fim > fim ? fim : p.fim) : fim;
      const downtime = Math.max(0, Math.round((pFim.getTime() - pInicio.getTime()) / 60000));

      const key = p.softwareId;
      const existing = swMap.get(key);
      if (existing) {
        existing.downtimeMinutos += downtime;
        existing.totalParadas++;
        if (p.impacto === 'TOTAL') existing.paradasTotal++;
        else existing.paradasParcial++;
        if (p.duracaoMinutos) existing.duracoes.push(p.duracaoMinutos);
      } else {
        swMap.set(key, {
          software: p.software as { id: string; nome: string; tipo: string; criticidade: string | null },
          downtimeMinutos: downtime,
          totalParadas: 1,
          paradasTotal: p.impacto === 'TOTAL' ? 1 : 0,
          paradasParcial: p.impacto === 'PARCIAL' ? 1 : 0,
          duracoes: p.duracaoMinutos ? [p.duracaoMinutos] : [],
        });
      }
    }

    const disponibilidadePorSoftware = Array.from(swMap.values())
      .map((s) => ({
        software: s.software,
        downtimeMinutos: s.downtimeMinutos,
        downtimeHoras: +(s.downtimeMinutos / 60).toFixed(1),
        uptimePercent: periodoTotalMinutos > 0
          ? +((1 - s.downtimeMinutos / periodoTotalMinutos) * 100).toFixed(2)
          : 100,
        totalParadas: s.totalParadas,
        paradasTotal: s.paradasTotal,
        paradasParcial: s.paradasParcial,
      }))
      .sort((a, b) => a.uptimePercent - b.uptimePercent);

    // MTTR
    const todasDuracoes = paradas
      .filter((p) => p.status === 'FINALIZADA' && p.duracaoMinutos)
      .map((p) => p.duracaoMinutos!);
    const mttrMinutos = todasDuracoes.length > 0
      ? Math.round(todasDuracoes.reduce((a, b) => a + b, 0) / todasDuracoes.length)
      : 0;

    // Paradas por tipo e impacto
    const tipoCount: Record<string, number> = {};
    const impactoCount: Record<string, number> = {};
    for (const p of paradas) {
      tipoCount[p.tipo] = (tipoCount[p.tipo] || 0) + 1;
      impactoCount[p.impacto] = (impactoCount[p.impacto] || 0) + 1;
    }

    const paradasEmAndamento = paradas.filter((p) => p.status === 'EM_ANDAMENTO').length;

    return {
      periodo: {
        inicio: inicio.toISOString(),
        fim: fim.toISOString(),
        totalMinutos: periodoTotalMinutos,
      },
      resumo: {
        paradasEmAndamento,
        totalParadasPeriodo: paradas.length,
        mttrMinutos,
        mttrFormatado: this.formatDuration(mttrMinutos),
      },
      disponibilidadePorSoftware,
      paradasPorTipo: Object.entries(tipoCount).map(([tipo, total]) => ({ tipo, total })),
      paradasPorImpacto: Object.entries(impactoCount).map(([impacto, total]) => ({ impacto, total })),
      paradasRecentes: paradas.slice(0, 20),
    };
  }

  async getFinanceiro(filters?: { dataInicio?: string; dataFim?: string }) {
    const hasPeriod = !!filters?.dataInicio || !!filters?.dataFim;

    let contratosVencendoWhere: Record<string, unknown>;
    let parcelasWhere: Record<string, unknown>;

    if (hasPeriod) {
      const { inicio, fim } = this.resolvePeriodo(filters);
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
        by: ['tipo'],
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
      this.prisma.contratoRateioItem.findMany({
        where: {
          config: { contrato: { status: { in: ['ATIVO', 'SUSPENSO'] } } },
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
      ? this.resolvePeriodo(filters)
      : { inicio: new Date(), fim: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) };

    return {
      periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
      contratosPorTipo: contratosPorTipo.map((g) => ({
        tipo: g.tipo,
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
    const { inicio, fim } = this.resolvePeriodo(filters);
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
