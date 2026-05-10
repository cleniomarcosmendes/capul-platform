import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Sub-service de relatórios do dashboard — auditoria 10/05/2026 #DT5-M2.
 *
 * Extraído de DashboardAcompanhamentoService (que estava com 1210 linhas)
 * para separar concerns: acompanhamento (calcula intervalos/gaps em tempo real)
 * vs relatórios (consolida dados históricos com bastante detalhe).
 *
 * Os 4 métodos abaixo são essencialmente queries pesadas com agregação. Não
 * usam o cálculo de gaps de expediente que é o coração do AcompanhamentoService.
 */
@Injectable()
export class DashboardRelatorioService {
  constructor(private readonly prisma: PrismaService) {}

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

  // ========== RELATORIO DE CHAMADO ==========

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

  // ========== RELATORIO DE PROJETO ==========

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
}
