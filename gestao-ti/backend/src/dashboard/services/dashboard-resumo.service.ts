import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { resolvePeriodo } from './dashboard-utils.js';

@Injectable()
export class DashboardResumoService {
  constructor(private readonly prisma: PrismaService) {}

  async getResumo(filters?: { dataInicio?: string; dataFim?: string; departamentoId?: string }) {
    const { inicio, fim } = resolvePeriodo(filters);
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
    const { inicio, fim } = resolvePeriodo(filters);
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
}
