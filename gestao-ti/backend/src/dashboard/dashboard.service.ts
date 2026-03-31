import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { HorarioService } from '../horario/horario.service.js';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly horarioService: HorarioService,
  ) {}

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
      atividadesPendentes,
      atividadesEmAndamento,
      atividadesConcluidas,
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
      this.prisma.atividadeProjeto.count({
        where: { status: 'PENDENTE', projeto: { status: { in: ['PLANEJAMENTO', 'EM_ANDAMENTO', 'PAUSADO'] } } },
      }),
      this.prisma.atividadeProjeto.count({
        where: { status: 'EM_ANDAMENTO', projeto: { status: { in: ['PLANEJAMENTO', 'EM_ANDAMENTO', 'PAUSADO'] } } },
      }),
      this.prisma.atividadeProjeto.count({
        where: { status: 'CONCLUIDA', projeto: { status: { in: ['PLANEJAMENTO', 'EM_ANDAMENTO', 'PAUSADO'] } } },
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
        atividades: {
          pendentes: atividadesPendentes,
          emAndamento: atividadesEmAndamento,
          concluidas: atividadesConcluidas,
        },
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
      atividadesPendentes,
      atividadesEmAndamento,
      atividadesConcluidas,
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
      this.prisma.atividadeProjeto.count({
        where: { status: 'PENDENTE', projeto: { status: { in: ['PLANEJAMENTO', 'EM_ANDAMENTO', 'PAUSADO'] } } },
      }),
      this.prisma.atividadeProjeto.count({
        where: { status: 'EM_ANDAMENTO', projeto: { status: { in: ['PLANEJAMENTO', 'EM_ANDAMENTO', 'PAUSADO'] } } },
      }),
      this.prisma.atividadeProjeto.count({
        where: { status: 'CONCLUIDA', projeto: { status: { in: ['PLANEJAMENTO', 'EM_ANDAMENTO', 'PAUSADO'] } } },
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
        atividades: {
          pendentes: atividadesPendentes,
          emAndamento: atividadesEmAndamento,
          concluidas: atividadesConcluidas,
        },
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
      ? this.resolvePeriodo(filters)
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

  async getOrdensServico(filters?: { dataInicio?: string; dataFim?: string; filialId?: string }) {
    const { inicio, fim } = this.resolvePeriodo(filters);
    const periodoFilter = { gte: inicio, lte: fim };
    const filialFilter = filters?.filialId ? { filialId: filters.filialId } : {};

    // Período anterior (mesmo intervalo antes)
    const diffMs = fim.getTime() - inicio.getTime();
    const inicioAnterior = new Date(inicio.getTime() - diffMs);
    const fimAnterior = new Date(inicio.getTime() - 1);

    const [
      totalPeriodo, totalAnterior,
      porStatus, porFilial,
      porTecnico, totalChamadosVinculados,
      concluidas, todasOs,
    ] = await Promise.all([
      // Total OS no período
      this.prisma.ordemServico.count({ where: { createdAt: periodoFilter, ...filialFilter } }),
      // Total OS no período anterior
      this.prisma.ordemServico.count({ where: { createdAt: { gte: inicioAnterior, lte: fimAnterior }, ...filialFilter } }),
      // Por status
      this.prisma.ordemServico.groupBy({
        by: ['status'], _count: true,
        where: { createdAt: periodoFilter, ...filialFilter },
      }),
      // Por filial (ranking)
      this.prisma.ordemServico.groupBy({
        by: ['filialId'], _count: true,
        where: { createdAt: periodoFilter },
        orderBy: { filialId: 'asc' },
      }),
      // Por tecnico (via join table)
      this.prisma.osTecnico.groupBy({
        by: ['tecnicoId'], _count: true,
        where: { os: { createdAt: periodoFilter, ...filialFilter } },
        orderBy: { tecnicoId: 'asc' },
      }),
      // Total chamados vinculados
      this.prisma.osChamado.count({ where: { os: { createdAt: periodoFilter, ...filialFilter } } }),
      // Concluidas (para calculo de tempo)
      this.prisma.ordemServico.findMany({
        where: { status: 'CONCLUIDA', dataInicio: { not: null }, dataFim: { not: null }, createdAt: periodoFilter, ...filialFilter },
        select: { dataInicio: true, dataFim: true },
      }),
      // Todas OS do período para média de chamados
      this.prisma.ordemServico.findMany({
        where: { createdAt: periodoFilter, ...filialFilter },
        select: { id: true, _count: { select: { chamados: true } } },
      }),
    ]);

    // Enrich filial names
    const filialIds = porFilial.map((f) => f.filialId);
    const filiaisData = filialIds.length > 0
      ? await this.prisma.filial.findMany({ where: { id: { in: filialIds } }, select: { id: true, codigo: true, nomeFantasia: true } })
      : [];
    const filialMap: Record<string, string> = {};
    for (const f of filiaisData) filialMap[f.id] = `${f.codigo} — ${f.nomeFantasia}`;

    // Enrich tecnico names
    const tecnicoIds = porTecnico.map((t) => t.tecnicoId);
    const tecnicosData = tecnicoIds.length > 0
      ? await this.prisma.usuario.findMany({ where: { id: { in: tecnicoIds } }, select: { id: true, nome: true } })
      : [];
    const tecnicoMap: Record<string, string> = {};
    for (const t of tecnicosData) tecnicoMap[t.id] = t.nome;

    // Calculos de tempo (em minutos)
    const temposMin = concluidas.map((os) => {
      const diff = new Date(os.dataFim!).getTime() - new Date(os.dataInicio!).getTime();
      return diff / 60000;
    });
    const tempoTotalMin = temposMin.reduce((a, b) => a + b, 0);
    const tempoMedioMin = temposMin.length > 0 ? tempoTotalMin / temposMin.length : 0;

    // Media chamados por OS
    const totalChamadosArr = todasOs.map((os) => os._count.chamados);
    const mediaChamadosPorOs = totalChamadosArr.length > 0
      ? totalChamadosArr.reduce((a, b) => a + b, 0) / totalChamadosArr.length : 0;

    // Evolucao mensal (ultimos 6 meses)
    const evolucao: { mes: string; total: number; concluidas: number; chamados: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mesInicio = new Date(d.getFullYear(), d.getMonth(), 1);
      const mesFim = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const [total, conc, cham] = await Promise.all([
        this.prisma.ordemServico.count({ where: { createdAt: { gte: mesInicio, lte: mesFim }, ...filialFilter } }),
        this.prisma.ordemServico.count({ where: { status: 'CONCLUIDA', createdAt: { gte: mesInicio, lte: mesFim }, ...filialFilter } }),
        this.prisma.osChamado.count({ where: { os: { createdAt: { gte: mesInicio, lte: mesFim }, ...filialFilter } } }),
      ]);
      evolucao.push({
        mes: mesInicio.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        total, concluidas: conc, chamados: cham,
      });
    }

    // Variacao percentual vs período anterior
    const variacao = totalAnterior > 0 ? Math.round(((totalPeriodo - totalAnterior) / totalAnterior) * 100) : null;

    return {
      periodo: { inicio, fim },
      resumo: {
        totalOs: totalPeriodo,
        totalAnterior,
        variacao,
        totalChamadosVinculados,
        mediaChamadosPorOs: +mediaChamadosPorOs.toFixed(1),
        concluidas: concluidas.length,
        tempoMedioMinutos: Math.round(tempoMedioMin),
        tempoTotalHoras: +(tempoTotalMin / 60).toFixed(1),
      },
      porStatus: porStatus.map((s) => ({ status: s.status, total: s._count })),
      porFilial: porFilial.map((f) => ({
        filialId: f.filialId,
        filialNome: filialMap[f.filialId] || f.filialId,
        total: f._count,
      })),
      porTecnico: porTecnico.map((t) => ({
        tecnicoId: t.tecnicoId,
        tecnicoNome: tecnicoMap[t.tecnicoId] || t.tecnicoId,
        totalOs: t._count,
      })),
      evolucaoMensal: evolucao,
    };
  }

  async getTecnicosAtivos() {
    const membros = await this.prisma.membroEquipe.findMany({
      where: { status: 'ATIVO' },
      select: { usuarioId: true },
      distinct: ['usuarioId'],
    });
    const ids = membros.map((m) => m.usuarioId);
    if (ids.length === 0) return [];
    const usuarios = await this.prisma.usuario.findMany({
      where: { id: { in: ids } },
      select: { id: true, nome: true, username: true },
      orderBy: { nome: 'asc' },
    });
    return usuarios;
  }

  async getAcompanhamento(filters: {
    usuarioId?: string;
    dataInicio?: string;
    dataFim?: string;
    tzOffset?: number; // minutos (ex: -180 para BRT)
  }) {
    // Resolve período — para acompanhamento, default = hoje
    const now = new Date();
    const inicio = filters.dataInicio
      ? new Date(filters.dataInicio + 'T00:00:00.000Z')
      : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const fim = filters.dataFim
      ? new Date(filters.dataFim + 'T23:59:59.999Z')
      : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const periodoFilter = { gte: inicio, lte: fim };
    const userFilter = filters.usuarioId ? { usuarioId: filters.usuarioId } : {};

    // Buscar registros de tempo (queries separadas para preservar tipos)
    const registrosChamado = await this.prisma.registroTempoChamado.findMany({
      where: { horaInicio: periodoFilter, ...userFilter },
      include: {
        chamado: { select: { id: true, numero: true, titulo: true, status: true, prioridade: true } },
        usuario: { select: { id: true, nome: true, username: true } },
      },
      orderBy: { horaInicio: 'asc' },
    });

    const registrosAtividade = await this.prisma.registroTempo.findMany({
      where: { horaInicio: periodoFilter, ...userFilter },
      include: {
        atividade: {
          select: {
            id: true,
            titulo: true,
            status: true,
            projeto: { select: { id: true, nome: true, numero: true } },
          },
        },
        usuario: { select: { id: true, nome: true, username: true } },
      },
      orderBy: { horaInicio: 'asc' },
    });

    const chamadosAssumidos = await this.prisma.historicoChamado.findMany({
      where: {
        createdAt: periodoFilter,
        tipo: { in: ['ASSUMIDO', 'COMENTARIO', 'RESOLVIDO'] },
        ...(filters.usuarioId ? { usuarioId: filters.usuarioId } : {}),
      },
      include: {
        chamado: { select: { id: true, numero: true, titulo: true, status: true, prioridade: true } },
        usuario: { select: { id: true, nome: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Unificar timeline
    const timeline: {
      id: string;
      tipo: 'chamado' | 'atividade';
      titulo: string;
      referencia: string;
      horaInicio: Date;
      horaFim: Date | null;
      duracaoMinutos: number | null;
      observacoes: string | null;
      detalhes: Record<string, unknown>;
      usuarioId: string;
      usuarioNome: string;
    }[] = [];

    for (const r of registrosChamado) {
      timeline.push({
        id: r.id,
        tipo: 'chamado',
        titulo: `#${r.chamado.numero} — ${r.chamado.titulo}`,
        referencia: r.chamado.id,
        horaInicio: r.horaInicio,
        horaFim: r.horaFim,
        duracaoMinutos: r.duracaoMinutos,
        observacoes: r.observacoes,
        detalhes: {
          numero: r.chamado.numero,
          status: r.chamado.status,
          prioridade: r.chamado.prioridade,
        },
        usuarioId: r.usuarioId,
        usuarioNome: r.usuario.nome,
      });
    }

    for (const r of registrosAtividade) {
      timeline.push({
        id: r.id,
        tipo: 'atividade',
        titulo: r.atividade.titulo,
        referencia: r.atividadeId,
        horaInicio: r.horaInicio,
        horaFim: r.horaFim,
        duracaoMinutos: r.duracaoMinutos,
        observacoes: r.observacoes,
        detalhes: {
          projetoId: r.atividade.projeto?.id,
          projetoNome: r.atividade.projeto?.nome,
          projetoNumero: r.atividade.projeto?.numero,
          statusAtividade: r.atividade.status,
        },
        usuarioId: r.usuarioId,
        usuarioNome: r.usuario.nome,
      });
    }

    timeline.sort((a, b) => a.horaInicio.getTime() - b.horaInicio.getTime());

    // Buscar horário de trabalho configurado
    const horarioConfig = filters.usuarioId
      ? await this.horarioService.getHorarioParaUsuario(filters.usuarioId)
      : await this.horarioService.getDefault().then((h) => {
          const parseH = (s: string) => { const [hh, mm] = s.split(':').map(Number); return hh + mm / 60; };
          const ini = parseH(h.horaInicioExpediente);
          const fim2 = parseH(h.horaFimExpediente);
          const ai = parseH(h.horaInicioAlmoco);
          const af = parseH(h.horaFimAlmoco);
          return { inicioExpediente: ini, fimExpediente: fim2, inicioAlmoco: ai, fimAlmoco: af, horasUteis: (fim2 - ini) - (af - ai) };
        });

    // KPIs
    const totalMinutosChamados = registrosChamado.reduce((s, r) => s + (r.duracaoMinutos ?? 0), 0);
    const totalMinutosAtividades = registrosAtividade.reduce((s, r) => s + (r.duracaoMinutos ?? 0), 0);
    const totalMinutosTrabalhados = totalMinutosChamados + totalMinutosAtividades;

    // Contar apenas dias uteis (seg-sex) no periodo
    let diasUteis = 0;
    const cursor = new Date(inicio);
    while (cursor <= fim) {
      const dow = cursor.getUTCDay();
      if (dow !== 0 && dow !== 6) diasUteis++;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    diasUteis = Math.max(1, diasUteis);

    const horasDisponiveis = +(diasUteis * horarioConfig.horasUteis).toFixed(1);
    const taxaOcupacao = horasDisponiveis > 0
      ? Math.min(100, +((totalMinutosTrabalhados / (horasDisponiveis * 60)) * 100).toFixed(1))
      : 0;

    // Chamados únicos trabalhados
    const chamadosUnicos = new Set(registrosChamado.map((r) => r.chamadoId));
    const atividadesUnicas = new Set(registrosAtividade.map((r) => r.atividadeId));

    // Tempo médio por chamado
    const tempoMedioPorChamado = chamadosUnicos.size > 0
      ? Math.round(totalMinutosChamados / chamadosUnicos.size)
      : 0;

    // Análise de gaps (períodos ociosos > 15min, incluindo bordas do expediente)
    const gaps: { inicio: Date; fim: Date; duracaoMinutos: number; tipo: 'ocioso' | 'almoco' }[] = [];

    // Helper para converter UTC <-> hora local
    // tzOffset vem do frontend como getTimezoneOffset() → 180 para BRT (UTC-3)
    // UTC→local: localHour = utcHour - (tzOffset / 60)
    // local→UTC: utcHour = localHour + (tzOffset / 60)
    const tzMin = filters.tzOffset ?? 0;
    const localToUtcH = (localH: number) => localH + (tzMin / 60);

    const classificarGap = (gapInicio: Date, gapFim: Date): 'ocioso' | 'almoco' => {
      const gapInicioLocal = gapInicio.getUTCHours() + gapInicio.getUTCMinutes() / 60 - (tzMin / 60);
      const gapFimLocal = gapFim.getUTCHours() + gapFim.getUTCMinutes() / 60 - (tzMin / 60);
      const isAlmoco = gapInicioLocal >= horarioConfig.inicioAlmoco - 0.25
        && gapFimLocal <= horarioConfig.fimAlmoco + 0.25;
      return isAlmoco ? 'almoco' : 'ocioso';
    };

    const addGap = (gapInicio: Date, gapFim: Date) => {
      const gapMin = (gapFim.getTime() - gapInicio.getTime()) / 60000;
      if (gapMin <= 15) return;

      // Verificar se o gap cruza o horario de almoco — se sim, dividir em 3 partes
      const gapInicioLocal = gapInicio.getUTCHours() + gapInicio.getUTCMinutes() / 60 - (tzMin / 60);
      const gapFimLocal = gapFim.getUTCHours() + gapFim.getUTCMinutes() / 60 - (tzMin / 60);
      const almocoIni = horarioConfig.inicioAlmoco;
      const almocoFim = horarioConfig.fimAlmoco;

      // Gap cruza o almoco se comeca antes do fim do almoco E termina depois do inicio do almoco
      if (gapInicioLocal < almocoFim && gapFimLocal > almocoIni) {
        // Parte 1: antes do almoco (ocioso)
        if (gapInicioLocal < almocoIni) {
          const preAlmocoFim = new Date(gapInicio.getTime() + (almocoIni - gapInicioLocal) * 3600000);
          const preMin = (preAlmocoFim.getTime() - gapInicio.getTime()) / 60000;
          if (preMin > 15) {
            gaps.push({ inicio: gapInicio, fim: preAlmocoFim, duracaoMinutos: Math.round(preMin), tipo: 'ocioso' });
          }
        }

        // Parte 2: almoco
        const almocoInicio = new Date(gapInicio.getTime() + Math.max(0, almocoIni - gapInicioLocal) * 3600000);
        const almocoFimDate = new Date(gapInicio.getTime() + (almocoFim - gapInicioLocal) * 3600000);
        const almocoRealFim = almocoFimDate.getTime() > gapFim.getTime() ? gapFim : almocoFimDate;
        const almocoMin = (almocoRealFim.getTime() - almocoInicio.getTime()) / 60000;
        if (almocoMin > 5) {
          gaps.push({ inicio: almocoInicio, fim: almocoRealFim, duracaoMinutos: Math.round(almocoMin), tipo: 'almoco' });
        }

        // Parte 3: depois do almoco (ocioso)
        if (gapFimLocal > almocoFim) {
          const posAlmocoIni = almocoFimDate.getTime() < gapInicio.getTime() ? gapInicio : almocoFimDate;
          const posMin = (gapFim.getTime() - posAlmocoIni.getTime()) / 60000;
          if (posMin > 15) {
            gaps.push({ inicio: posAlmocoIni, fim: gapFim, duracaoMinutos: Math.round(posMin), tipo: 'ocioso' });
          }
        }
      } else {
        // Gap nao cruza almoco — classificar normalmente
        gaps.push({
          inicio: gapInicio,
          fim: gapFim,
          duracaoMinutos: Math.round(gapMin),
          tipo: classificarGap(gapInicio, gapFim),
        });
      }
    };

    // Agrupar registros por dia para calcular gaps de borda
    const registrosPorDia = new Map<string, typeof timeline>();
    for (const r of timeline) {
      const diaKey = r.horaInicio.toISOString().slice(0, 10);
      const arr = registrosPorDia.get(diaKey) || [];
      arr.push(r);
      registrosPorDia.set(diaKey, arr);
    }

    // Adicionar dias uteis sem nenhum registro como gaps completos
    const cursorDia = new Date(inicio);
    while (cursorDia <= fim) {
      const dow = cursorDia.getUTCDay();
      const diaStr = cursorDia.toISOString().slice(0, 10);
      if (dow !== 0 && dow !== 6 && !registrosPorDia.has(diaStr)) {
        const diaD = new Date(diaStr + 'T00:00:00.000Z');
        const iniU = localToUtcH(horarioConfig.inicioExpediente);
        const fimU = localToUtcH(horarioConfig.fimExpediente);
        const iniExp = new Date(diaD);
        iniExp.setUTCHours(Math.floor(iniU), Math.round((iniU % 1) * 60), 0, 0);
        const fimExp = new Date(diaD);
        fimExp.setUTCHours(Math.floor(fimU), Math.round((fimU % 1) * 60), 0, 0);
        addGap(iniExp, fimExp);
      }
      cursorDia.setUTCDate(cursorDia.getUTCDate() + 1);
    }

    for (const [diaKey, registrosDia] of registrosPorDia) {
      // Ignorar fins de semana para calculo de gaps
      const diaDow = new Date(diaKey + 'T00:00:00.000Z').getUTCDay();
      if (diaDow === 0 || diaDow === 6) continue;

      const registrosFinalizados = registrosDia.filter((r) => r.horaFim).sort(
        (a, b) => a.horaInicio.getTime() - b.horaInicio.getTime(),
      );
      if (registrosFinalizados.length === 0) continue;

      // Construir início e fim do expediente para este dia, convertendo local→UTC
      // localToUtcH: ex. 08:00 BRT com offset 180 → 08 + 3 = 11:00 UTC
      const diaDate = new Date(diaKey + 'T00:00:00.000Z');
      const iniUtc = localToUtcH(horarioConfig.inicioExpediente);
      const fimUtc = localToUtcH(horarioConfig.fimExpediente);
      const inicioExpedienteDia = new Date(diaDate);
      inicioExpedienteDia.setUTCHours(Math.floor(iniUtc), Math.round((iniUtc % 1) * 60), 0, 0);
      const fimExpedienteDia = new Date(diaDate);
      fimExpedienteDia.setUTCHours(Math.floor(fimUtc), Math.round((fimUtc % 1) * 60), 0, 0);

      // Gap de borda: início do expediente → primeiro registro
      const primeiroInicio = registrosFinalizados[0].horaInicio;
      if (primeiroInicio.getTime() > inicioExpedienteDia.getTime()) {
        addGap(inicioExpedienteDia, primeiroInicio);
      }

      // Gaps entre registros consecutivos
      for (let i = 0; i < registrosFinalizados.length - 1; i++) {
        const fimAtual = registrosFinalizados[i].horaFim!;
        const inicioProx = registrosFinalizados[i + 1].horaInicio;
        addGap(fimAtual, inicioProx);
      }

      // Gap de borda: último registro → fim do expediente
      const ultimoFim = registrosFinalizados[registrosFinalizados.length - 1].horaFim!;
      if (ultimoFim.getTime() < fimExpedienteDia.getTime()) {
        addGap(ultimoFim, fimExpedienteDia);
      }
    }

    gaps.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

    // Sobreposições (multitasking)
    const sobreposicoes: { item1: string; item2: string; inicio: Date; fim: Date; duracaoMinutos: number }[] = [];
    for (let i = 0; i < timeline.length; i++) {
      for (let j = i + 1; j < timeline.length; j++) {
        const a = timeline[i];
        const b = timeline[j];
        if (!a.horaFim || !b.horaFim) continue;
        const overlapStart = Math.max(a.horaInicio.getTime(), b.horaInicio.getTime());
        const overlapEnd = Math.min(a.horaFim.getTime(), b.horaFim.getTime());
        if (overlapStart < overlapEnd) {
          const overlapMin = (overlapEnd - overlapStart) / 60000;
          if (overlapMin >= 5) {
            sobreposicoes.push({
              item1: a.titulo,
              item2: b.titulo,
              inicio: new Date(overlapStart),
              fim: new Date(overlapEnd),
              duracaoMinutos: Math.round(overlapMin),
            });
          }
        }
      }
    }

    // Interações no período (histórico de chamados)
    const interacoesPorTipo: Record<string, number> = {};
    for (const h of chamadosAssumidos) {
      interacoesPorTipo[h.tipo] = (interacoesPorTipo[h.tipo] || 0) + 1;
    }

    // Agrupamento por usuário (quando sem filtro de usuário)
    const porUsuario = new Map<string, { nome: string; minutosChamados: number; minutosAtividades: number; totalRegistros: number }>();
    for (const r of registrosChamado) {
      const u = porUsuario.get(r.usuarioId) || { nome: r.usuario.nome, minutosChamados: 0, minutosAtividades: 0, totalRegistros: 0 };
      u.minutosChamados += r.duracaoMinutos ?? 0;
      u.totalRegistros++;
      porUsuario.set(r.usuarioId, u);
    }
    for (const r of registrosAtividade) {
      const u = porUsuario.get(r.usuarioId) || { nome: r.usuario.nome, minutosChamados: 0, minutosAtividades: 0, totalRegistros: 0 };
      u.minutosAtividades += r.duracaoMinutos ?? 0;
      u.totalRegistros++;
      porUsuario.set(r.usuarioId, u);
    }

    const gapsOciosos = gaps.filter((g) => g.tipo === 'ocioso');

    return {
      periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
      horario: {
        inicioExpediente: horarioConfig.inicioExpediente,
        fimExpediente: horarioConfig.fimExpediente,
        inicioAlmoco: horarioConfig.inicioAlmoco,
        fimAlmoco: horarioConfig.fimAlmoco,
        horasUteis: horarioConfig.horasUteis,
      },
      resumo: {
        totalMinutosTrabalhados,
        totalHorasTrabalhadas: +(totalMinutosTrabalhados / 60).toFixed(1),
        horasDisponiveis,
        taxaOcupacao,
        totalMinutosChamados,
        totalMinutosAtividades,
        chamadosTrabalhados: chamadosUnicos.size,
        atividadesTrabalhadas: atividadesUnicas.size,
        tempoMedioPorChamado,
        tempoMedioPorChamadoFormatado: this.formatDuration(tempoMedioPorChamado),
        totalGaps: gapsOciosos.length,
        tempoOciosoMinutos: gapsOciosos.reduce((s, g) => s + g.duracaoMinutos, 0),
        totalSobreposicoes: sobreposicoes.length,
      },
      timeline,
      gaps,
      sobreposicoes,
      interacoesPorTipo: Object.entries(interacoesPorTipo).map(([tipo, total]) => ({ tipo, total })),
      porUsuario: Array.from(porUsuario.entries()).map(([id, u]) => ({
        usuarioId: id,
        nome: u.nome,
        minutosChamados: u.minutosChamados,
        minutosAtividades: u.minutosAtividades,
        totalMinutos: u.minutosChamados + u.minutosAtividades,
        totalHoras: +((u.minutosChamados + u.minutosAtividades) / 60).toFixed(1),
        totalRegistros: u.totalRegistros,
      })).sort((a, b) => b.totalMinutos - a.totalMinutos),
    };
  }

  // ========== ACOMPANHAMENTO POR CHAMADO ==========

  async listarEquipes() {
    return this.prisma.equipeTI.findMany({
      where: { status: 'ATIVO' },
      select: { id: true, nome: true, sigla: true },
      orderBy: { nome: 'asc' },
    });
  }

  async buscarChamados(filters: { q?: string; status?: string; prioridade?: string; equipeId?: string; tecnicoId?: string }) {
    const where: Record<string, unknown> = {};
    if (filters.q) {
      const num = parseInt(filters.q, 10);
      if (!isNaN(num)) {
        where.numero = num;
      } else {
        where.titulo = { contains: filters.q, mode: 'insensitive' };
      }
    }
    if (filters.status) where.status = filters.status;
    if (filters.prioridade) where.prioridade = filters.prioridade;
    if (filters.equipeId) where.equipeAtualId = filters.equipeId;
    if (filters.tecnicoId) where.tecnicoId = filters.tecnicoId;
    return this.prisma.chamado.findMany({
      where,
      select: {
        id: true, numero: true, titulo: true, status: true, prioridade: true,
        createdAt: true,
        solicitante: { select: { id: true, nome: true } },
        tecnico: { select: { id: true, nome: true } },
        equipeAtual: { select: { id: true, nome: true, sigla: true } },
      },
      orderBy: { numero: 'desc' },
      take: 50,
    });
  }

  async getAcompanhamentoChamado(chamadoId: string) {
    const chamado = await this.prisma.chamado.findUnique({
      where: { id: chamadoId },
      include: {
        solicitante: { select: { id: true, nome: true, username: true } },
        tecnico: { select: { id: true, nome: true, username: true } },
        equipeAtual: { select: { id: true, nome: true, sigla: true, cor: true } },
        catalogoServico: { select: { id: true, nome: true } },
        slaDefinicao: { select: { id: true, nome: true, horasResposta: true, horasResolucao: true } },
        software: { select: { id: true, nome: true } },
        softwareModulo: { select: { id: true, nome: true } },
        ativo: { select: { id: true, nome: true, tipo: true } },
        projeto: { select: { id: true, nome: true, numero: true } },
        colaboradores: {
          include: { usuario: { select: { id: true, nome: true, username: true } } },
        },
      },
    });
    if (!chamado) return null;

    // Histórico completo (lifecycle)
    const historicos = await this.prisma.historicoChamado.findMany({
      where: { chamadoId },
      include: {
        usuario: { select: { id: true, nome: true } },
        equipeOrigem: { select: { id: true, nome: true, sigla: true } },
        equipeDestino: { select: { id: true, nome: true, sigla: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Registros de tempo
    const registrosTempo = await this.prisma.registroTempoChamado.findMany({
      where: { chamadoId },
      include: {
        usuario: { select: { id: true, nome: true, username: true } },
      },
      orderBy: { horaInicio: 'asc' },
    });

    // Anexos
    const anexos = await this.prisma.anexoChamado.findMany({
      where: { chamadoId },
      include: {
        usuario: { select: { id: true, nome: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // OS vinculadas
    const osVinculadas = await this.prisma.osChamado.findMany({
      where: { chamadoId },
      include: {
        os: { select: { id: true, numero: true, titulo: true, status: true } },
      },
    });

    // KPIs
    const totalMinutosTrabalhados = registrosTempo.reduce((s, r) => s + (r.duracaoMinutos ?? 0), 0);
    const tecnicosEnvolvidos = new Set(registrosTempo.map((r) => r.usuarioId));
    const totalSessoes = registrosTempo.length;
    const tempoMedioPorSessao = totalSessoes > 0 ? Math.round(totalMinutosTrabalhados / totalSessoes) : 0;

    // SLA
    let slaStatus: 'no_prazo' | 'em_risco' | 'estourado' | 'sem_sla' = 'sem_sla';
    let slaPercentual: number | null = null;
    if (chamado.dataLimiteSla) {
      const now = chamado.dataResolucao || new Date();
      const totalSla = chamado.dataLimiteSla.getTime() - chamado.createdAt.getTime();
      const elapsed = now.getTime() - chamado.createdAt.getTime();
      slaPercentual = totalSla > 0 ? Math.round((elapsed / totalSla) * 100) : 100;
      if (now > chamado.dataLimiteSla) {
        slaStatus = 'estourado';
      } else if (slaPercentual >= 80) {
        slaStatus = 'em_risco';
      } else {
        slaStatus = 'no_prazo';
      }
    }

    // Tempo de resposta (abertura → primeiro ASSUMIDO)
    const primeiroAssumido = historicos.find((h) => h.tipo === 'ASSUMIDO');
    const tempoRespostaMinutos = primeiroAssumido
      ? Math.round((primeiroAssumido.createdAt.getTime() - chamado.createdAt.getTime()) / 60000)
      : null;

    // Tempo de resolução (abertura → RESOLVIDO)
    const tempoResolucaoMinutos = chamado.dataResolucao
      ? Math.round((chamado.dataResolucao.getTime() - chamado.createdAt.getTime()) / 60000)
      : null;

    // Por técnico
    const porTecnico = new Map<string, { nome: string; minutos: number; sessoes: number }>();
    for (const r of registrosTempo) {
      const t = porTecnico.get(r.usuarioId) || { nome: r.usuario.nome, minutos: 0, sessoes: 0 };
      t.minutos += r.duracaoMinutos ?? 0;
      t.sessoes++;
      porTecnico.set(r.usuarioId, t);
    }

    // Transferências
    const transferencias = historicos.filter((h) =>
      ['TRANSFERENCIA_EQUIPE', 'TRANSFERENCIA_TECNICO'].includes(h.tipo),
    );

    return {
      chamado: {
        id: chamado.id,
        numero: chamado.numero,
        titulo: chamado.titulo,
        descricao: chamado.descricao,
        status: chamado.status,
        prioridade: chamado.prioridade,
        visibilidade: chamado.visibilidade,
        createdAt: chamado.createdAt,
        dataLimiteSla: chamado.dataLimiteSla,
        dataResolucao: chamado.dataResolucao,
        dataFechamento: chamado.dataFechamento,
        notaSatisfacao: chamado.notaSatisfacao,
        comentarioSatisfacao: chamado.comentarioSatisfacao,
        ipMaquina: chamado.ipMaquina,
        solicitante: chamado.solicitante,
        tecnico: chamado.tecnico,
        equipeAtual: chamado.equipeAtual,
        catalogoServico: chamado.catalogoServico,
        slaDefinicao: chamado.slaDefinicao,
        software: chamado.software,
        softwareModulo: chamado.softwareModulo,
        ativo: chamado.ativo,
        projeto: chamado.projeto,
        colaboradores: chamado.colaboradores.map((c) => c.usuario),
      },
      resumo: {
        totalMinutosTrabalhados,
        totalHorasTrabalhadas: +(totalMinutosTrabalhados / 60).toFixed(1),
        tecnicosEnvolvidos: tecnicosEnvolvidos.size,
        totalSessoes,
        tempoMedioPorSessao,
        tempoMedioPorSessaoFormatado: this.formatDuration(tempoMedioPorSessao),
        tempoRespostaMinutos,
        tempoRespostaFormatado: tempoRespostaMinutos !== null ? this.formatDuration(tempoRespostaMinutos) : null,
        tempoResolucaoMinutos,
        tempoResolucaoFormatado: tempoResolucaoMinutos !== null ? this.formatDuration(tempoResolucaoMinutos) : null,
        totalTransferencias: transferencias.length,
        totalAnexos: anexos.length,
        slaStatus,
        slaPercentual,
      },
      historicos,
      registrosTempo,
      anexos,
      osVinculadas: osVinculadas.map((o) => o.os),
      porTecnico: Array.from(porTecnico.entries()).map(([id, t]) => ({
        usuarioId: id,
        nome: t.nome,
        minutos: t.minutos,
        horas: +(t.minutos / 60).toFixed(1),
        sessoes: t.sessoes,
        tempoMedioSessao: t.sessoes > 0 ? Math.round(t.minutos / t.sessoes) : 0,
      })).sort((a, b) => b.minutos - a.minutos),
    };
  }

  // ========== ACOMPANHAMENTO POR ATIVIDADE ==========

  async listarProjetosAtivos() {
    return this.prisma.projeto.findMany({
      where: { status: { in: ['PLANEJAMENTO', 'EM_ANDAMENTO', 'PAUSADO'] }, nivel: 1 },
      select: { id: true, numero: true, nome: true, status: true },
      orderBy: { nome: 'asc' },
    });
  }

  async buscarAtividades(q?: string, projetoId?: string, status?: string) {
    const where: Record<string, unknown> = {};
    if (projetoId) where.projetoId = projetoId;
    if (status) where.status = status;
    if (q) {
      where.titulo = { contains: q, mode: 'insensitive' };
    }
    return this.prisma.atividadeProjeto.findMany({
      where,
      select: {
        id: true, titulo: true, status: true, dataInicio: true, dataFimPrevista: true, createdAt: true,
        usuario: { select: { id: true, nome: true } },
        projeto: { select: { id: true, numero: true, nome: true } },
        fase: { select: { id: true, nome: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getAcompanhamentoAtividade(atividadeId: string) {
    const atividade = await this.prisma.atividadeProjeto.findUnique({
      where: { id: atividadeId },
      include: {
        usuario: { select: { id: true, nome: true, username: true } },
        projeto: {
          select: {
            id: true, numero: true, nome: true, status: true, tipo: true,
            responsavel: { select: { id: true, nome: true } },
          },
        },
        fase: { select: { id: true, nome: true, status: true } },
        comentarios: {
          include: { usuario: { select: { id: true, nome: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!atividade) return null;

    // Registros de tempo
    const registrosTempo = await this.prisma.registroTempo.findMany({
      where: { atividadeId },
      include: {
        usuario: { select: { id: true, nome: true, username: true } },
      },
      orderBy: { horaInicio: 'asc' },
    });

    // KPIs
    const totalMinutosTrabalhados = registrosTempo.reduce((s, r) => s + (r.duracaoMinutos ?? 0), 0);
    const participantes = new Set(registrosTempo.map((r) => r.usuarioId));
    const totalSessoes = registrosTempo.length;
    const tempoMedioPorSessao = totalSessoes > 0 ? Math.round(totalMinutosTrabalhados / totalSessoes) : 0;

    // Duração prevista (em dias)
    let diasPrevistos: number | null = null;
    if (atividade.dataInicio && atividade.dataFimPrevista) {
      diasPrevistos = Math.ceil(
        (atividade.dataFimPrevista.getTime() - atividade.dataInicio.getTime()) / (1000 * 60 * 60 * 24),
      );
    }

    // Dias em andamento
    let diasEmAndamento: number | null = null;
    if (atividade.dataInicio) {
      const fim = atividade.status === 'CONCLUIDA' ? atividade.createdAt : new Date();
      diasEmAndamento = Math.ceil(
        (fim.getTime() - atividade.dataInicio.getTime()) / (1000 * 60 * 60 * 24),
      );
    }

    // Por participante
    const porParticipante = new Map<string, { nome: string; minutos: number; sessoes: number }>();
    for (const r of registrosTempo) {
      const p = porParticipante.get(r.usuarioId) || { nome: r.usuario.nome, minutos: 0, sessoes: 0 };
      p.minutos += r.duracaoMinutos ?? 0;
      p.sessoes++;
      porParticipante.set(r.usuarioId, p);
    }

    // Chamados vinculados ao projeto desta atividade
    const chamadosVinculados = await this.prisma.chamado.findMany({
      where: { projetoId: atividade.projetoId },
      select: {
        id: true, numero: true, titulo: true, status: true, prioridade: true,
        tecnico: { select: { id: true, nome: true } },
      },
      orderBy: { numero: 'desc' },
      take: 10,
    });

    return {
      atividade: {
        id: atividade.id,
        titulo: atividade.titulo,
        descricao: atividade.descricao,
        status: atividade.status,
        dataAtividade: atividade.dataAtividade,
        dataInicio: atividade.dataInicio,
        dataFimPrevista: atividade.dataFimPrevista,
        createdAt: atividade.createdAt,
        usuario: atividade.usuario,
        projeto: atividade.projeto,
        fase: atividade.fase,
      },
      resumo: {
        totalMinutosTrabalhados,
        totalHorasTrabalhadas: +(totalMinutosTrabalhados / 60).toFixed(1),
        participantes: participantes.size,
        totalSessoes,
        tempoMedioPorSessao,
        tempoMedioPorSessaoFormatado: this.formatDuration(tempoMedioPorSessao),
        diasPrevistos,
        diasEmAndamento,
        totalComentarios: atividade.comentarios.length,
      },
      registrosTempo,
      comentarios: atividade.comentarios,
      chamadosVinculados,
      porParticipante: Array.from(porParticipante.entries()).map(([id, p]) => ({
        usuarioId: id,
        nome: p.nome,
        minutos: p.minutos,
        horas: +(p.minutos / 60).toFixed(1),
        sessoes: p.sessoes,
        tempoMedioSessao: p.sessoes > 0 ? Math.round(p.minutos / p.sessoes) : 0,
      })).sort((a, b) => b.minutos - a.minutos),
    };
  }

  // ========== MINHAS PENDENCIAS ==========

  async getMinhasPendencias(userId: string) {
    const [atividades, pendencias] = await Promise.all([
      this.prisma.atividadeProjeto.findMany({
        where: {
          status: { in: ['PENDENTE', 'EM_ANDAMENTO'] },
          OR: [
            { usuarioId: userId },
            { responsaveis: { some: { usuarioId: userId } } },
          ],
        },
        include: {
          projeto: { select: { id: true, numero: true, nome: true } },
          fase: { select: { id: true, nome: true } },
          pendencia: { select: { id: true, numero: true, titulo: true } },
        },
        orderBy: [{ status: 'asc' }, { dataAtividade: 'desc' }],
      }),
      this.prisma.pendenciaProjeto.findMany({
        where: {
          responsavelId: userId,
          status: { in: ['ABERTA', 'EM_ANDAMENTO', 'AGUARDANDO_VALIDACAO'] },
        },
        include: {
          projeto: { select: { id: true, numero: true, nome: true } },
          fase: { select: { id: true, nome: true } },
          criador: { select: { id: true, nome: true } },
        },
        orderBy: [{ prioridade: 'asc' }, { dataLimite: 'asc' }],
      }),
    ]);

    const now = new Date();
    const vencidas = pendencias.filter((p) => p.dataLimite && new Date(p.dataLimite) < now).length;
    const urgentes = pendencias.filter((p) => ['URGENTE', 'ALTA'].includes(p.prioridade)).length;

    return {
      atividades,
      pendencias,
      resumo: {
        totalAtividades: atividades.length,
        totalPendencias: pendencias.length,
        vencidas,
        urgentes,
      },
    };
  }
}
