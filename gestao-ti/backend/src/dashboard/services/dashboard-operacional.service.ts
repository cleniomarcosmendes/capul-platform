import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { resolvePeriodo } from './dashboard-utils.js';

@Injectable()
export class DashboardOperacionalService {
  constructor(private readonly prisma: PrismaService) {}

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

  async getOrdensServico(filters?: { dataInicio?: string; dataFim?: string; filialId?: string }) {
    const { inicio, fim } = resolvePeriodo(filters);
    const periodoFilter = { gte: inicio, lte: fim };
    const filialFilter = filters?.filialId ? { filialId: filters.filialId } : {};

    // Periodo anterior (mesmo intervalo antes)
    const diffMs = fim.getTime() - inicio.getTime();
    const inicioAnterior = new Date(inicio.getTime() - diffMs);
    const fimAnterior = new Date(inicio.getTime() - 1);

    const [
      totalPeriodo, totalAnterior,
      porStatus, porFilial,
      porTecnico, totalChamadosVinculados,
      concluidas, todasOs,
    ] = await Promise.all([
      // Total OS no periodo
      this.prisma.ordemServico.count({ where: { createdAt: periodoFilter, ...filialFilter } }),
      // Total OS no periodo anterior
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
      // Todas OS do periodo para media de chamados
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

    // Variacao percentual vs periodo anterior
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

  private formatDuration(minutos: number): string {
    if (minutos < 1) return '< 1m';
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }
}
