import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { HorarioService } from '../../horario/horario.service.js';

@Injectable()
export class DashboardAcompanhamentoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly horarioService: HorarioService,
  ) {}

  async getAcompanhamento(filters: {
    usuarioId?: string;
    dataInicio?: string;
    dataFim?: string;
    tzOffset?: number; // minutos (ex: -180 para BRT)
  }) {
    // Resolve periodo — para acompanhamento, default = hoje
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

    // Buscar horario de trabalho configurado
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

    // KPIs — somar duracoes brutas (para detalhamento)
    const totalMinutosChamados = registrosChamado.reduce((s, r) => s + (r.duracaoMinutos ?? 0), 0);
    const totalMinutosAtividades = registrosAtividade.reduce((s, r) => s + (r.duracaoMinutos ?? 0), 0);

    // Calcular tempo real trabalhado (merge de intervalos sobrepostos)
    const intervalos = timeline
      .filter((r) => r.horaFim)
      .map((r) => ({ start: r.horaInicio.getTime(), end: r.horaFim!.getTime() }))
      .sort((a, b) => a.start - b.start);

    const merged: { start: number; end: number }[] = [];
    for (const iv of intervalos) {
      if (merged.length > 0 && iv.start <= merged[merged.length - 1].end) {
        merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, iv.end);
      } else {
        merged.push({ ...iv });
      }
    }
    const totalMinutosTrabalhados = Math.round(
      merged.reduce((sum, iv) => sum + (iv.end - iv.start), 0) / 60000,
    );

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

    // Chamados unicos trabalhados
    const chamadosUnicos = new Set(registrosChamado.map((r) => r.chamadoId));
    const atividadesUnicas = new Set(registrosAtividade.map((r) => r.atividadeId));

    // Tempo medio por chamado
    const tempoMedioPorChamado = chamadosUnicos.size > 0
      ? Math.round(totalMinutosChamados / chamadosUnicos.size)
      : 0;

    // Analise de gaps (periodos ociosos > 15min, incluindo bordas do expediente)
    const gaps: { inicio: Date; fim: Date; duracaoMinutos: number; tipo: 'ocioso' | 'almoco' }[] = [];

    // Helper para converter UTC <-> hora local
    // tzOffset vem do frontend como getTimezoneOffset() -> 180 para BRT (UTC-3)
    // UTC->local: localHour = utcHour - (tzOffset / 60)
    // local->UTC: utcHour = localHour + (tzOffset / 60)
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

      // Merge de intervalos sobrepostos para calculo correto de gaps
      const mergedDia: { start: number; end: number }[] = [];
      for (const r of registrosFinalizados) {
        const iv = { start: r.horaInicio.getTime(), end: r.horaFim!.getTime() };
        if (mergedDia.length > 0 && iv.start <= mergedDia[mergedDia.length - 1].end) {
          mergedDia[mergedDia.length - 1].end = Math.max(mergedDia[mergedDia.length - 1].end, iv.end);
        } else {
          mergedDia.push({ ...iv });
        }
      }

      // Construir inicio e fim do expediente para este dia, convertendo local->UTC
      const diaDate = new Date(diaKey + 'T00:00:00.000Z');
      const iniUtc = localToUtcH(horarioConfig.inicioExpediente);
      const fimUtc = localToUtcH(horarioConfig.fimExpediente);
      const inicioExpedienteDia = new Date(diaDate);
      inicioExpedienteDia.setUTCHours(Math.floor(iniUtc), Math.round((iniUtc % 1) * 60), 0, 0);
      const fimExpedienteDia = new Date(diaDate);
      fimExpedienteDia.setUTCHours(Math.floor(fimUtc), Math.round((fimUtc % 1) * 60), 0, 0);

      // Gap de borda: inicio do expediente -> primeiro bloco merged
      if (mergedDia[0].start > inicioExpedienteDia.getTime()) {
        addGap(inicioExpedienteDia, new Date(mergedDia[0].start));
      }

      // Gaps entre blocos merged consecutivos
      for (let i = 0; i < mergedDia.length - 1; i++) {
        addGap(new Date(mergedDia[i].end), new Date(mergedDia[i + 1].start));
      }

      // Gap de borda: ultimo bloco merged -> fim do expediente
      if (mergedDia[mergedDia.length - 1].end < fimExpedienteDia.getTime()) {
        addGap(new Date(mergedDia[mergedDia.length - 1].end), fimExpedienteDia);
      }
    }

    gaps.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

    // Sobreposicoes (multitasking)
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
          if (overlapMin >= 1) {
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

    // Interacoes no periodo (historico de chamados)
    const interacoesPorTipo: Record<string, number> = {};
    for (const h of chamadosAssumidos) {
      interacoesPorTipo[h.tipo] = (interacoesPorTipo[h.tipo] || 0) + 1;
    }

    // Agrupamento por usuario (quando sem filtro de usuario)
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

  async buscarChamados(filters: { q?: string; status?: string; prioridade?: string; equipeId?: string; tecnicoId?: string; dataInicio?: string; dataFim?: string }) {
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
    if (filters.dataInicio || filters.dataFim) {
      const createdAt: Record<string, unknown> = {};
      if (filters.dataInicio) createdAt.gte = new Date(filters.dataInicio);
      if (filters.dataFim) createdAt.lte = new Date(filters.dataFim + 'T23:59:59');
      where.createdAt = createdAt;
    }
    const chamados = await this.prisma.chamado.findMany({
      where,
      select: {
        id: true, numero: true, titulo: true, status: true, prioridade: true,
        createdAt: true,
        solicitante: { select: { id: true, nome: true } },
        tecnico: { select: { id: true, nome: true } },
        equipeAtual: { select: { id: true, nome: true, sigla: true } },
        registrosTempo: { select: { duracaoMinutos: true } },
      },
      orderBy: { numero: 'desc' },
      take: 50,
    });
    return chamados.map((c) => {
      const totalMinutos = c.registrosTempo.reduce((sum, r) => sum + (r.duracaoMinutos || 0), 0);
      const { registrosTempo: _, ...rest } = c;
      return { ...rest, totalMinutos };
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

    // Historico completo (lifecycle)
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

    // KPIs — merge de intervalos sobrepostos para tempo real
    const intervalosChamado = registrosTempo
      .filter((r) => r.horaFim)
      .map((r) => ({ start: r.horaInicio.getTime(), end: r.horaFim!.getTime() }))
      .sort((a, b) => a.start - b.start);
    const mergedChamado: { start: number; end: number }[] = [];
    for (const iv of intervalosChamado) {
      if (mergedChamado.length > 0 && iv.start <= mergedChamado[mergedChamado.length - 1].end) {
        mergedChamado[mergedChamado.length - 1].end = Math.max(mergedChamado[mergedChamado.length - 1].end, iv.end);
      } else {
        mergedChamado.push({ ...iv });
      }
    }
    const totalMinutosTrabalhados = Math.round(
      mergedChamado.reduce((sum, iv) => sum + (iv.end - iv.start), 0) / 60000,
    );
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

    // Tempo de resposta (abertura -> primeiro ASSUMIDO)
    const primeiroAssumido = historicos.find((h) => h.tipo === 'ASSUMIDO');
    const tempoRespostaMinutos = primeiroAssumido
      ? Math.round((primeiroAssumido.createdAt.getTime() - chamado.createdAt.getTime()) / 60000)
      : null;

    // Tempo de resolucao (abertura -> RESOLVIDO)
    const tempoResolucaoMinutos = chamado.dataResolucao
      ? Math.round((chamado.dataResolucao.getTime() - chamado.createdAt.getTime()) / 60000)
      : null;

    // Por tecnico
    const porTecnico = new Map<string, { nome: string; minutos: number; sessoes: number }>();
    for (const r of registrosTempo) {
      const t = porTecnico.get(r.usuarioId) || { nome: r.usuario.nome, minutos: 0, sessoes: 0 };
      t.minutos += r.duracaoMinutos ?? 0;
      t.sessoes++;
      porTecnico.set(r.usuarioId, t);
    }

    // Transferencias
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

  async buscarAtividades(q?: string, projetoId?: string, status?: string, dataInicio?: string, dataFim?: string, responsavelId?: string, faseId?: string) {
    const where: Record<string, unknown> = {};
    if (projetoId) where.projetoId = projetoId;
    if (status) where.status = status;
    if (responsavelId) where.usuarioId = responsavelId;
    if (faseId) where.faseId = faseId;
    if (q) {
      where.titulo = { contains: q, mode: 'insensitive' };
    }
    if (dataInicio || dataFim) {
      const createdAt: Record<string, unknown> = {};
      if (dataInicio) createdAt.gte = new Date(dataInicio);
      if (dataFim) createdAt.lte = new Date(dataFim + 'T23:59:59');
      where.createdAt = createdAt;
    }
    const atividades = await this.prisma.atividadeProjeto.findMany({
      where,
      select: {
        id: true, titulo: true, status: true, dataInicio: true, dataFimPrevista: true, createdAt: true,
        usuario: { select: { id: true, nome: true } },
        projeto: { select: { id: true, numero: true, nome: true } },
        fase: { select: { id: true, nome: true } },
        registrosTempo: { select: { duracaoMinutos: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return atividades.map((a) => {
      const totalMinutos = a.registrosTempo.reduce((sum, r) => sum + (r.duracaoMinutos || 0), 0);
      const { registrosTempo: _, ...rest } = a;
      return { ...rest, totalMinutos };
    });
  }

  async listarFasesAtivas() {
    const fases = await this.prisma.faseProjeto.findMany({
      where: { projeto: { status: { not: 'CANCELADO' } } },
      select: { id: true, nome: true, projeto: { select: { numero: true, nome: true } } },
      orderBy: [{ projeto: { numero: 'desc' } }, { ordem: 'asc' }],
    });
    // Deduplica por nome para o filtro
    const seen = new Set<string>();
    return fases.filter((f) => {
      const key = f.nome;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
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

    // KPIs — merge de intervalos sobrepostos para tempo real
    const intervalosAtiv = registrosTempo
      .filter((r) => r.horaFim)
      .map((r) => ({ start: r.horaInicio.getTime(), end: r.horaFim!.getTime() }))
      .sort((a, b) => a.start - b.start);
    const mergedAtiv: { start: number; end: number }[] = [];
    for (const iv of intervalosAtiv) {
      if (mergedAtiv.length > 0 && iv.start <= mergedAtiv[mergedAtiv.length - 1].end) {
        mergedAtiv[mergedAtiv.length - 1].end = Math.max(mergedAtiv[mergedAtiv.length - 1].end, iv.end);
      } else {
        mergedAtiv.push({ ...iv });
      }
    }
    const totalMinutosTrabalhados = Math.round(
      mergedAtiv.reduce((sum, iv) => sum + (iv.end - iv.start), 0) / 60000,
    );
    const participantes = new Set(registrosTempo.map((r) => r.usuarioId));
    const totalSessoes = registrosTempo.length;
    const tempoMedioPorSessao = totalSessoes > 0 ? Math.round(totalMinutosTrabalhados / totalSessoes) : 0;

    // Duracao prevista (em dias)
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

  // ========== RELATORIO DE OS ==========

  async getRelatorioOs(tecnicoId: string, dataInicio: string, dataFim: string) {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim + 'T23:59:59');

    // 1) Registros de tempo em CHAMADOS
    const registrosChamado = await this.prisma.registroTempoChamado.findMany({
      where: {
        usuarioId: tecnicoId,
        horaInicio: { gte: inicio, lte: fim },
        horaFim: { not: null },
      },
      include: {
        chamado: {
          select: {
            id: true, numero: true, titulo: true, descricao: true, status: true, prioridade: true,
            equipeAtual: { select: { sigla: true, nome: true } },
            historicos: {
              where: { tipo: 'COMENTARIO', createdAt: { gte: inicio, lte: fim } },
              select: { descricao: true, createdAt: true, usuario: { select: { nome: true } } },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        usuario: { select: { nome: true } },
      },
      orderBy: { horaInicio: 'asc' },
    });

    // 2) Registros de tempo em ATIVIDADES
    const registrosAtividade = await this.prisma.registroTempo.findMany({
      where: {
        usuarioId: tecnicoId,
        horaInicio: { gte: inicio, lte: fim },
        horaFim: { not: null },
      },
      include: {
        atividade: {
          select: {
            id: true, titulo: true, descricao: true, status: true,
            projeto: { select: { id: true, numero: true, nome: true } },
            fase: { select: { nome: true } },
            comentarios: {
              where: { createdAt: { gte: inicio, lte: fim } },
              select: { texto: true, createdAt: true, usuario: { select: { nome: true } } },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        usuario: { select: { nome: true } },
      },
      orderBy: { horaInicio: 'asc' },
    });

    // 3) Apontamentos manuais
    const apontamentos = await this.prisma.apontamentoHoras.findMany({
      where: {
        usuarioId: tecnicoId,
        data: { gte: inicio, lte: fim },
      },
      include: {
        projeto: { select: { id: true, numero: true, nome: true } },
        fase: { select: { nome: true } },
        usuario: { select: { nome: true } },
      },
      orderBy: { data: 'asc' },
    });

    // Agrupar registros por chamado
    const chamadosMap = new Map<string, {
      chamado: typeof registrosChamado[0]['chamado'];
      sessoes: { horaInicio: Date; horaFim: Date; duracaoMinutos: number; observacoes: string | null }[];
      totalMinutos: number;
    }>();
    for (const r of registrosChamado) {
      const key = r.chamado.id;
      if (!chamadosMap.has(key)) {
        chamadosMap.set(key, { chamado: r.chamado, sessoes: [], totalMinutos: 0 });
      }
      const entry = chamadosMap.get(key)!;
      const dur = r.duracaoMinutos || 0;
      entry.sessoes.push({ horaInicio: r.horaInicio, horaFim: r.horaFim!, duracaoMinutos: dur, observacoes: r.observacoes });
      entry.totalMinutos += dur;
    }

    // Agrupar registros por atividade
    const atividadesMap = new Map<string, {
      atividade: typeof registrosAtividade[0]['atividade'];
      sessoes: { horaInicio: Date; horaFim: Date; duracaoMinutos: number; observacoes: string | null }[];
      totalMinutos: number;
    }>();
    for (const r of registrosAtividade) {
      const key = r.atividade.id;
      if (!atividadesMap.has(key)) {
        atividadesMap.set(key, { atividade: r.atividade, sessoes: [], totalMinutos: 0 });
      }
      const entry = atividadesMap.get(key)!;
      const dur = r.duracaoMinutos || 0;
      entry.sessoes.push({ horaInicio: r.horaInicio, horaFim: r.horaFim!, duracaoMinutos: dur, observacoes: r.observacoes });
      entry.totalMinutos += dur;
    }

    const chamadosArr = Array.from(chamadosMap.values()).sort((a, b) => b.totalMinutos - a.totalMinutos);
    const atividadesArr = Array.from(atividadesMap.values()).sort((a, b) => b.totalMinutos - a.totalMinutos);

    const totalMinChamados = chamadosArr.reduce((s, c) => s + c.totalMinutos, 0);
    const totalMinAtividades = atividadesArr.reduce((s, a) => s + a.totalMinutos, 0);
    const totalMinApontamentos = apontamentos.reduce((s, a) => s + Math.round(Number(a.horas) * 60), 0);

    return {
      chamados: chamadosArr,
      atividades: atividadesArr,
      apontamentos: apontamentos.map((a) => ({
        id: a.id,
        data: a.data,
        horas: Number(a.horas),
        descricao: a.descricao,
        observacoes: a.observacoes,
        projeto: a.projeto,
        fase: a.fase,
      })),
      resumo: {
        totalMinutosChamados: totalMinChamados,
        totalMinutosAtividades: totalMinAtividades,
        totalMinutosApontamentos: totalMinApontamentos,
        totalMinutosGeral: totalMinChamados + totalMinAtividades + totalMinApontamentos,
        totalHorasGeral: +((totalMinChamados + totalMinAtividades + totalMinApontamentos) / 60).toFixed(1),
        qtdChamados: chamadosArr.length,
        qtdAtividades: atividadesArr.length,
        qtdApontamentos: apontamentos.length,
      },
    };
  }

  async getRelatorioChamado(chamadoId: string) {
    const chamado = await this.prisma.chamado.findUniqueOrThrow({
      where: { id: chamadoId },
      include: {
        solicitante: { select: { id: true, nome: true, username: true, email: true } },
        tecnico: { select: { id: true, nome: true, username: true } },
        equipeAtual: { select: { id: true, nome: true, sigla: true, cor: true } },
        filial: { select: { id: true, codigo: true, nomeFantasia: true } },
        departamento: { select: { id: true, nome: true } },
        catalogoServico: { select: { id: true, nome: true } },
        slaDefinicao: { select: { id: true, nome: true, horasResposta: true, horasResolucao: true } },
        software: { select: { id: true, nome: true } },
        softwareModulo: { select: { id: true, nome: true } },
        projeto: { select: { id: true, numero: true, nome: true } },
        ativo: { select: { id: true, nome: true, tipo: true, tag: true } },
        colaboradores: { include: { usuario: { select: { id: true, nome: true } } } },
        historicos: {
          include: {
            usuario: { select: { id: true, nome: true } },
            equipeOrigem: { select: { id: true, nome: true, sigla: true } },
            equipeDestino: { select: { id: true, nome: true, sigla: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        registrosTempo: {
          where: { horaFim: { not: null } },
          include: { usuario: { select: { id: true, nome: true } } },
          orderBy: { horaInicio: 'asc' },
        },
        anexos: {
          include: { usuario: { select: { id: true, nome: true } } },
          orderBy: { createdAt: 'desc' },
        },
        osChamados: {
          include: {
            os: {
              select: {
                id: true, numero: true, titulo: true, status: true,
                dataAgendamento: true, dataInicio: true, dataFim: true,
                filial: { select: { id: true, codigo: true, nomeFantasia: true } },
                tecnicos: { include: { tecnico: { select: { id: true, nome: true } } } },
              },
            },
          },
        },
      },
    });

    const { registrosTempo, osChamados, anexos, historicos, ...chamadoBase } = chamado;
    const totalMinutos = registrosTempo.reduce((s, r) => s + (r.duracaoMinutos ?? 0), 0);

    return {
      chamado: { ...chamadoBase, historicos, anexos },
      sessoes: registrosTempo.map((r) => ({
        id: r.id,
        horaInicio: r.horaInicio,
        horaFim: r.horaFim,
        duracaoMinutos: r.duracaoMinutos,
        observacoes: r.observacoes,
        usuario: r.usuario,
      })),
      ordensServico: osChamados.map((oc) => oc.os),
      resumo: {
        totalMinutos,
        totalHoras: +(totalMinutos / 60).toFixed(1),
        qtdSessoes: registrosTempo.length,
        qtdOs: osChamados.length,
        qtdAnexos: anexos.length,
        qtdHistoricos: historicos.length,
      },
    };
  }

  async getRelatorioProjeto(projetoId: string) {
    const [projeto, pendencias] = await Promise.all([
      this.prisma.projeto.findUniqueOrThrow({
        where: { id: projetoId },
        include: {
          responsavel: { select: { id: true, nome: true, username: true } },
          tipoProjeto: { select: { id: true, codigo: true, descricao: true } },
          software: { select: { id: true, nome: true } },
          contrato: { select: { id: true, numero: true, titulo: true } },
          membros: {
            include: { usuario: { select: { id: true, nome: true, username: true } } },
            orderBy: { papel: 'asc' },
          },
          usuariosChave: {
            where: { ativo: true },
            include: { usuario: { select: { id: true, nome: true } } },
          },
          terceirizados: {
            where: { ativo: true },
            include: { usuario: { select: { id: true, nome: true } } },
          },
          fases: { orderBy: { ordem: 'asc' } },
          atividades: {
            include: {
              fase: { select: { id: true, nome: true } },
              responsaveis: { include: { usuario: { select: { id: true, nome: true } } } },
              registrosTempo: {
                where: { horaFim: { not: null } },
                select: { duracaoMinutos: true },
              },
            },
            orderBy: [{ fase: { ordem: 'asc' } }, { createdAt: 'asc' }],
          },
          apontamentos: {
            include: {
              usuario: { select: { id: true, nome: true } },
              fase: { select: { id: true, nome: true } },
            },
            orderBy: { data: 'asc' },
          },
          riscos: {
            include: { responsavel: { select: { id: true, nome: true } } },
            orderBy: { createdAt: 'desc' },
          },
          custos: { orderBy: { data: 'asc' } },
          cotacoes: { orderBy: { dataRecebimento: 'desc' } },
          subProjetos: {
            select: { id: true, numero: true, nome: true, status: true, nivel: true },
            orderBy: { numero: 'asc' },
          },
          anexos: {
            include: { usuario: { select: { id: true, nome: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.pendenciaProjeto.findMany({
        where: { projetoId },
        include: {
          responsavel: { select: { id: true, nome: true } },
          criador: { select: { id: true, nome: true } },
          fase: { select: { id: true, nome: true } },
          interacoes: {
            include: { usuario: { select: { id: true, nome: true } } },
            orderBy: { createdAt: 'asc' },
          },
          atividades: { select: { id: true, titulo: true, status: true } },
        },
        orderBy: [{ status: 'asc' }, { prioridade: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    // Cálculos de resumo
    const totalFases = projeto.fases.length;
    const fasesAprovadas = projeto.fases.filter((f) => f.status === 'APROVADA').length;

    const atividadesPendentes = projeto.atividades.filter((a) => a.status === 'PENDENTE').length;
    const atividadesEmAndamento = projeto.atividades.filter((a) => a.status === 'EM_ANDAMENTO').length;
    const atividadesConcluidas = projeto.atividades.filter((a) => a.status === 'CONCLUIDA').length;

    const minutosRegistrosTempo = projeto.atividades.reduce(
      (sum, a) => sum + a.registrosTempo.reduce((s, r) => s + (r.duracaoMinutos ?? 0), 0), 0,
    );
    const horasApontamentos = projeto.apontamentos.reduce((s, a) => s + Number(a.horas), 0);
    const totalHoras = +(horasApontamentos + minutosRegistrosTempo / 60).toFixed(1);

    const riscosAbertos = projeto.riscos.filter((r) => !['ACEITO', 'RESOLVIDO'].includes(r.status)).length;
    const pendenciasAbertas = pendencias.filter((p) => ['ABERTA', 'EM_ANDAMENTO', 'AGUARDANDO_VALIDACAO'].includes(p.status)).length;

    return {
      projeto: {
        ...projeto,
        atividades: projeto.atividades.map((a) => ({
          ...a,
          totalMinutosRegistros: a.registrosTempo.reduce((s, r) => s + (r.duracaoMinutos ?? 0), 0),
          registrosTempo: undefined,
        })),
      },
      pendencias,
      resumo: {
        totalFases,
        fasesAprovadas,
        atividadesPendentes,
        atividadesEmAndamento,
        atividadesConcluidas,
        totalAtividades: projeto.atividades.length,
        totalHoras,
        horasApontamentos: +horasApontamentos.toFixed(1),
        minutosRegistrosTempo,
        riscosAbertos,
        totalRiscos: projeto.riscos.length,
        pendenciasAbertas,
        totalPendencias: pendencias.length,
        custoPrevistoTotal: Number(projeto.custoPrevisto ?? 0),
        custoRealizadoTotal: Number(projeto.custoRealizado ?? 0),
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
