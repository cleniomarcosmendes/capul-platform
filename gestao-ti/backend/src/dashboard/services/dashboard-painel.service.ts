import { Injectable } from '@nestjs/common';
import { StatusChamado } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import { getDeptoIdsDoUser } from '../../common/helpers/departamento-filter.helper.js';

/**
 * Painel de Gestão — endpoints de "o que está no meu radar".
 *
 * Distinto do Dashboard (visão executiva agregada), Monitor (real-time),
 * Acompanhamento (produtividade individual), Indicadores (KPIs mensais).
 * Foco: itens com prazo onde o user tem vínculo.
 *
 * Dois painéis distintos por persona:
 * - **Painel Chamado**: SUPORTE/atendente — SLA, fila, atribuídos
 * - **Painel Projeto**: GESTOR/UC/TERC — atividades, pendências, atrasos
 */
@Injectable()
export class DashboardPainelService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Painel de Gestão de Chamado ──────────────────────────────────

  async getPainelChamados(user: JwtPayload, role: string, equipeIdFiltro?: string) {
    const userId = user.sub;
    const isAdmin = role === 'ADMIN';

    // Equipes onde o user é membro ativo (visibilidade C2.9 + filtro UI)
    const equipesMembro = await this.prisma.membroEquipe.findMany({
      where: { usuarioId: userId, status: 'ATIVO' },
      include: { equipe: { select: { id: true, nome: true, sigla: true, cor: true, departamentoId: true } } },
    });
    const equipeIdsMembro = equipesMembro.map((m) => m.equipeId);
    const equipesDoUser = equipesMembro.map((m) => m.equipe);

    // Visibilidade base (não-ADMIN): solicitante OR colaborador OR
    // equipe-membro OR depto-workspace. Mesma regra do C2.9 + colaborador.
    const deptoIds = getDeptoIdsDoUser(user, role);
    function visibilityOr(): Record<string, unknown>[] {
      const arr: Record<string, unknown>[] = [
        { solicitanteId: userId },
        { colaboradores: { some: { usuarioId: userId } } },
      ];
      if (deptoIds && deptoIds.length > 0) arr.push({ departamentoId: { in: deptoIds } });
      if (equipeIdsMembro.length > 0) arr.push({ equipeAtualId: { in: equipeIdsMembro } });
      return arr;
    }

    // Filtro de equipe escolhido no UI (afeta SLA Crítico e Resumo)
    const equipeFilter = equipeIdFiltro ? { equipeAtualId: equipeIdFiltro } : {};

    // Statuses considerados "abertos" pra fins de painel
    const statusAbertos: StatusChamado[] = ['ABERTO', 'EM_ATENDIMENTO', 'PENDENTE', 'PENDENTE_USUARIO', 'REABERTO'];

    const agora = new Date();
    const em24h = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
    const fimDoDia = new Date(agora);
    fimDoDia.setHours(23, 59, 59, 999);

    const chamadoInclude = {
      equipeAtual: { select: { id: true, nome: true, sigla: true, cor: true } },
      solicitante: { select: { id: true, nome: true, username: true } },
      tecnico: { select: { id: true, nome: true, username: true } },
    };

    // ── SLA Crítico: dataLimiteSla vencida OU vence em 24h ──
    const slaWhere: Record<string, unknown> = {
      status: { in: statusAbertos },
      dataLimiteSla: { not: null, lte: em24h },
      ...equipeFilter,
    };
    if (!isAdmin) {
      slaWhere.AND = [{ OR: visibilityOr() }];
    }
    const slaCritico = await this.prisma.chamado.findMany({
      where: slaWhere,
      include: chamadoInclude,
      orderBy: { dataLimiteSla: 'asc' },
      take: 30,
    });

    // ── Atribuídos a mim: sempre pessoal, ignora filtro de equipe ──
    const atribuidosAMim = await this.prisma.chamado.findMany({
      where: { tecnicoId: userId, status: { in: statusAbertos } },
      include: chamadoInclude,
      orderBy: [{ dataLimiteSla: 'asc' }, { updatedAt: 'desc' }],
      take: 30,
    });

    // ── Aguardando minha resposta: sou solicitante e está PENDENTE_USUARIO ──
    const aguardandoResposta = await this.prisma.chamado.findMany({
      where: { solicitanteId: userId, status: 'PENDENTE_USUARIO' },
      include: chamadoInclude,
      orderBy: { updatedAt: 'desc' },
      take: 30,
    });

    // ── Resumo por Equipe (matriz): só quando NÃO filtrou equipe ──
    let resumoPorEquipe: {
      equipe: { id: string; nome: string; sigla: string; cor: string | null };
      vencidos: number;
      hoje: number;
      prox24h: number;
      total: number;
    }[] = [];
    if (!equipeIdFiltro && equipesDoUser.length > 0) {
      resumoPorEquipe = await Promise.all(
        equipesDoUser.map(async (eq) => {
          const baseWhere = { equipeAtualId: eq.id, status: { in: statusAbertos } };
          const [vencidos, hoje, prox24h, total] = await Promise.all([
            this.prisma.chamado.count({
              where: { ...baseWhere, dataLimiteSla: { not: null, lt: agora } },
            }),
            this.prisma.chamado.count({
              where: { ...baseWhere, dataLimiteSla: { gte: agora, lte: fimDoDia } },
            }),
            this.prisma.chamado.count({
              where: { ...baseWhere, dataLimiteSla: { gte: agora, lte: em24h } },
            }),
            this.prisma.chamado.count({ where: baseWhere }),
          ]);
          return {
            equipe: { id: eq.id, nome: eq.nome, sigla: eq.sigla, cor: eq.cor },
            vencidos,
            hoje,
            prox24h,
            total,
          };
        }),
      );
    }

    return {
      equipesDoUser: equipesDoUser.map((e) => ({ id: e.id, nome: e.nome, sigla: e.sigla, cor: e.cor })),
      equipeIdFiltro: equipeIdFiltro ?? null,
      slaCritico,
      atribuidosAMim,
      aguardandoResposta,
      resumoPorEquipe,
      resumo: {
        slaCriticoTotal: slaCritico.length,
        atribuidosTotal: atribuidosAMim.length,
        aguardandoTotal: aguardandoResposta.length,
      },
    };
  }

  // ─── Painel de Gestão de Projeto ──────────────────────────────────

  async getPainelProjetos(user: JwtPayload, role: string) {
    const userId = user.sub;
    const isAdmin = role === 'ADMIN';
    const isUCouTerc = role === 'USUARIO_CHAVE' || role === 'TERCEIRIZADO';

    const deptoIds = getDeptoIdsDoUser(user, role);

    // Visibilidade de projeto (C2.10):
    // - ADMIN escapa
    // - UC/TERC: só vinculados (usuariosChave)
    // - STAFF: depto-dono OR responsável OR membro OR usuariosChave
    function projetoVisibilityOr(): Record<string, unknown>[] {
      if (isUCouTerc) {
        return [{ usuariosChave: { some: { usuarioId: userId, ativo: true } } }];
      }
      const arr: Record<string, unknown>[] = [
        { responsavelId: userId },
        { membros: { some: { usuarioId: userId } } },
        { usuariosChave: { some: { usuarioId: userId, ativo: true } } },
      ];
      if (deptoIds && deptoIds.length > 0) arr.push({ departamentoId: { in: deptoIds } });
      return arr;
    }

    const agora = new Date();
    const em7d = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);
    const em30d = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000);
    const fimDoDia = new Date(agora);
    fimDoDia.setHours(23, 59, 59, 999);

    // ── Atividades: vence em 7d OU vencida ──
    // Visibilidade: responsável da atividade OU projeto visível.
    const atividadesWhere: Record<string, unknown> = {
      status: { in: ['PENDENTE', 'EM_ANDAMENTO'] },
      dataFimPrevista: { not: null, lte: em7d },
    };
    if (!isAdmin) {
      atividadesWhere.AND = [
        {
          OR: [
            { usuarioId: userId },
            { responsaveis: { some: { usuarioId: userId } } },
            { projeto: { OR: projetoVisibilityOr() } },
          ],
        },
      ];
    }
    const atividades = await this.prisma.atividadeProjeto.findMany({
      where: atividadesWhere,
      include: {
        projeto: { select: { id: true, numero: true, nome: true } },
        fase: { select: { id: true, nome: true } },
        usuario: { select: { id: true, nome: true } },
      },
      orderBy: { dataFimPrevista: 'asc' },
      take: 30,
    });

    // ── Pendências: vence em 7d OU vencida OU urgente aberta ──
    const pendenciasWhere: Record<string, unknown> = {
      status: { in: ['ABERTA', 'EM_ANDAMENTO', 'AGUARDANDO_VALIDACAO'] },
      OR: [
        { dataLimite: { not: null, lte: em7d } },
        { prioridade: { in: ['URGENTE', 'ALTA'] } },
      ],
    };
    if (!isAdmin) {
      pendenciasWhere.AND = [
        {
          OR: [
            { responsavelId: userId },
            { projeto: { OR: projetoVisibilityOr() } },
          ],
        },
      ];
    }
    const pendencias = await this.prisma.pendenciaProjeto.findMany({
      where: pendenciasWhere,
      include: {
        projeto: { select: { id: true, numero: true, nome: true } },
        fase: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
        criador: { select: { id: true, nome: true } },
      },
      orderBy: [{ prioridade: 'asc' }, { dataLimite: 'asc' }],
      take: 30,
    });

    // ── Projetos atrasados: dataFimPrevista < agora, status != Concluído/Cancelado ──
    const projetosAtrasadosWhere: Record<string, unknown> = {
      dataFimPrevista: { not: null, lt: agora },
      status: { notIn: ['CONCLUIDO', 'CANCELADO'] },
    };
    if (!isAdmin) {
      projetosAtrasadosWhere.OR = projetoVisibilityOr();
    }
    const projetosAtrasados = await this.prisma.projeto.findMany({
      where: projetosAtrasadosWhere,
      include: {
        responsavel: { select: { id: true, nome: true } },
        departamento: { select: { id: true, nome: true } },
      },
      orderBy: { dataFimPrevista: 'asc' },
      take: 30,
    });

    // ── Marcos próximos: fases com dataFimPrevista nos próximos 30d ──
    const marcosWhere: Record<string, unknown> = {
      dataFimPrevista: { not: null, gte: agora, lte: em30d },
    };
    if (!isAdmin) {
      marcosWhere.projeto = { OR: projetoVisibilityOr() };
    }
    const marcosProximos = await this.prisma.faseProjeto.findMany({
      where: marcosWhere,
      include: {
        projeto: { select: { id: true, numero: true, nome: true } },
      },
      orderBy: { dataFimPrevista: 'asc' },
      take: 30,
    });

    // Stats vencidas vs no prazo (pra header semáforo)
    const atividadesVencidas = atividades.filter((a) => a.dataFimPrevista && a.dataFimPrevista < agora).length;
    const atividadesHoje = atividades.filter(
      (a) => a.dataFimPrevista && a.dataFimPrevista >= agora && a.dataFimPrevista <= fimDoDia,
    ).length;
    const pendenciasVencidas = pendencias.filter((p) => p.dataLimite && p.dataLimite < agora).length;
    const pendenciasUrgentes = pendencias.filter((p) => ['URGENTE', 'ALTA'].includes(p.prioridade)).length;

    return {
      atividades,
      pendencias,
      projetosAtrasados,
      marcosProximos,
      resumo: {
        atividadesTotal: atividades.length,
        atividadesVencidas,
        atividadesHoje,
        pendenciasTotal: pendencias.length,
        pendenciasVencidas,
        pendenciasUrgentes,
        projetosAtrasadosTotal: projetosAtrasados.length,
        marcosProximosTotal: marcosProximos.length,
      },
    };
  }
}
