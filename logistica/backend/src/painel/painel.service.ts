import { Injectable } from '@nestjs/common';
import { Prisma, SituacaoVeiculo, StatusEntrega, StatusViagem, TipoViagem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CoreLookupService } from '../core/core-lookup.service.js';

/**
 * Indicadores da Fase 1a — computáveis SEM o app do entregador (PR7).
 * Pendentes / em viagem / despachadas + recortes por dia, filial, veículo e
 * motorista (da montagem). Tudo read-only (count/groupBy + um $queryRaw pro
 * recorte por dia, que o groupBy não cobre). Filtro opcional por filial.
 */

/** Filtros opcionais da Análise de Entregas (estreitam o conjunto; total reconcilia). */
export interface FiltroEntrega {
  origem?: string;       // origemVenda (ou 'NAO_INFORMADO')
  status?: string;
  motoristaId?: string;  // chave da dimensão 'motorista'
  bairro?: string;       // bairroKey normalizado
}

@Injectable()
export class PainelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: CoreLookupService,
  ) {}

  async resumo(filialId: string | undefined, mes: number, ano: number) {
    const escopo = filialId ? { filialId } : {};
    // Janela do MÊS [1º, 1º do mês seguinte) em UTC — consistente com o storage.
    const ini = new Date(Date.UTC(ano, mes - 1, 1));
    const fimExcl = new Date(Date.UTC(ano, mes, 1));
    // Cartões de FILA são "agora" (sem recorte); tabelas/movimento seguem o mês.
    const periodo = { criadoEm: { gte: ini, lt: fimExcl } };

    const [
      entPendentes, entEmViagem, entEntregues, entNaoEntregues, entCanceladas,
      vgRascunho, vgEmCurso, vgConcluidas,
      veicDisponiveis, veicEmUso, veicManutencao,
      porFilialRaw, porVeiculoRaw, porMotoristaRaw, porOrigemRaw, prazoRaw,
    ] = await Promise.all([
      // FILA agora (sem recorte de mês — estado operacional corrente).
      this.prisma.entrega.count({ where: { ...escopo, status: StatusEntrega.PENDENTE } }),
      this.prisma.entrega.count({ where: { ...escopo, status: StatusEntrega.EM_VIAGEM } }),
      // FLUXO do mês (entregues/não entregues/canceladas no mês selecionado).
      this.prisma.entrega.count({ where: { ...escopo, ...periodo, status: StatusEntrega.ENTREGUE } }),
      this.prisma.entrega.count({ where: { ...escopo, ...periodo, status: StatusEntrega.NAO_ENTREGUE } }),
      this.prisma.entrega.count({ where: { ...escopo, ...periodo, status: StatusEntrega.CANCELADA } }),
      this.prisma.viagem.count({ where: { ...escopo, situacao: StatusViagem.RASCUNHO } }),
      this.prisma.viagem.count({ where: { ...escopo, situacao: StatusViagem.EM_CURSO } }),
      this.prisma.viagem.count({ where: { ...escopo, situacao: StatusViagem.CONCLUIDA } }),
      this.prisma.veiculo.count({ where: { ...escopo, situacao: SituacaoVeiculo.DISPONIVEL } }),
      this.prisma.veiculo.count({ where: { ...escopo, situacao: SituacaoVeiculo.EM_USO } }),
      this.prisma.veiculo.count({ where: { ...escopo, situacao: SituacaoVeiculo.EM_MANUTENCAO } }),
      this.prisma.entrega.groupBy({ by: ['filialId', 'status'], where: { ...escopo, ...periodo }, _count: { _all: true } }),
      this.prisma.viagem.groupBy({
        by: ['veiculoId'],
        where: { ...escopo, ...periodo, situacao: { not: StatusViagem.CANCELADA } },
        _count: { _all: true },
      }),
      this.prisma.viagem.groupBy({
        by: ['motoristaId'],
        where: { ...escopo, ...periodo, situacao: { not: StatusViagem.CANCELADA } },
        _count: { _all: true },
      }),
      // Indicador de CANAL (pedido 11/06): presencial × tele-venda × outro.
      // null = entregas anteriores à feature (mostrado como "não informado").
      this.prisma.entrega.groupBy({
        by: ['origemVenda'],
        where: { ...escopo, ...periodo, status: { not: StatusEntrega.CANCELADA } },
        _count: { _all: true },
      }),
      // Prazo médio de ENTREGA (pedido 12/06): lançamento (criado_em) → baixa
      // entregue (data_hora_entrega), recortado pelo MÊS selecionado.
      this.prisma.$queryRaw<{ media_horas: number | null; total: number }[]>(Prisma.sql`
        SELECT avg(EXTRACT(EPOCH FROM (data_hora_entrega - criado_em)))/3600 AS media_horas,
               count(*)::int AS total
        FROM "logistica"."entrega"
        WHERE status = 'ENTREGUE'
          AND data_hora_entrega IS NOT NULL
          AND data_hora_entrega >= ${ini} AND data_hora_entrega < ${fimExcl}
          ${filialId ? Prisma.sql`AND filial_id = ${filialId}` : Prisma.empty}`),
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
    const veiculoIds = porVeiculoRaw.map((v) => v.veiculoId).filter((x): x is string => !!x);
    const veiculos = veiculoIds.length
      ? await this.prisma.veiculo.findMany({ where: { id: { in: veiculoIds } }, select: { id: true, placa: true } })
      : [];
    const placaPorId = new Map(veiculos.map((v) => [v.id, v.placa]));
    const porVeiculo = porVeiculoRaw
      .filter((v) => !!v.veiculoId)
      .map((v) => ({ veiculoId: v.veiculoId as string, placa: placaPorId.get(v.veiculoId as string) ?? '—', viagens: v._count._all }))
      .sort((a, b) => b.viagens - a.viagens);

    // Nomes de motorista/filial são resolvidos no frontend (core) — aqui só IDs+contagem.
    const porMotorista = porMotoristaRaw
      .filter((m) => !!m.motoristaId)
      .map((m) => ({ motoristaId: m.motoristaId as string, viagens: m._count._all }))
      .sort((a, b) => b.viagens - a.viagens);

    // ── Por dia (série contínua via generate_series — TZ-consistente, sem buracos):
    // entregas criadas (criado_em) × viagens despachadas (data_hora_saida). ──
    const fEnt = filialId ? Prisma.sql`AND filial_id = ${filialId}` : Prisma.empty;
    const fVg = filialId ? Prisma.sql`AND filial_id = ${filialId}` : Prisma.empty;
    // Série dos dias do MÊS: do 1º até o último dia (ou até hoje, no mês corrente
    // — evita uma cauda de dias vazios). criadas (criado_em) × despachadas (saída).
    const porDia = await this.prisma.$queryRaw<{ dia: string; criadas: number; despachadas: number }[]>(Prisma.sql`
      SELECT to_char(d, 'YYYY-MM-DD') AS dia,
             coalesce(c.n, 0)::int AS criadas,
             coalesce(v.n, 0)::int AS despachadas
      FROM generate_series(
             ${ini}::timestamptz,
             LEAST(${fimExcl}::timestamptz - interval '1 day', date_trunc('day', now())),
             interval '1 day'
           ) AS d
      LEFT JOIN (
        SELECT date_trunc('day', criado_em) AS dd, count(*) AS n
        FROM "logistica"."entrega"
        WHERE criado_em >= ${ini} AND criado_em < ${fimExcl} ${fEnt}
        GROUP BY 1
      ) c ON c.dd = d
      LEFT JOIN (
        SELECT date_trunc('day', data_hora_saida) AS dd, count(*) AS n
        FROM "logistica"."viagem"
        WHERE data_hora_saida IS NOT NULL
          AND data_hora_saida >= ${ini} AND data_hora_saida < ${fimExcl} ${fVg}
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
      filtros: { filialId: filialId ?? null, mes, ano },
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
      prazoMedio: {
        horas: prazoRaw[0]?.media_horas != null ? Number(prazoRaw[0].media_horas) : null,
        amostra: prazoRaw[0]?.total ?? 0,
      },
      porOrigem: porOrigemRaw
        .map((o) => ({ origem: o.origemVenda ?? 'NAO_INFORMADO', total: o._count._all }))
        .sort((a, b) => b.total - a.total),
    };
  }

  /**
   * Indicadores ANALÍTICOS por MÊS (pedido 12/06 — padrão "Indicadores" do
   * workspace). Recorte por entrega.criado_em dentro do mês (numa operação de
   * entrega no mesmo dia, criado_em ≈ data da venda/entrega). Read-only.
   * KM rodados ficou fora por ora: kmInicial/kmFinal ainda não são capturados
   * (decisão 12/06 — ver backlog: captura de hodômetro).
   */
  async indicadoresMes(filialId: string | undefined, mes: number, ano: number) {
    // Janela [1º do mês, 1º do mês seguinte) em UTC — consistente com o storage.
    const ini = new Date(Date.UTC(ano, mes - 1, 1));
    const fim = new Date(Date.UTC(ano, mes, 1));
    const fEnt = filialId ? Prisma.sql`AND e.filial_id = ${filialId}` : Prisma.empty;
    const fEntS = filialId ? Prisma.sql`AND filial_id = ${filialId}` : Prisma.empty;

    const [origemRaw, motoristaRaw, demandaRaw, totaisRaw] = await Promise.all([
      // Por origem da venda: valor (soma de cupons, sem multiplicar volumes via
      // LATERAL 1-linha-por-entrega), nº de entregas e volumes.
      this.prisma.$queryRaw<{ origem: string | null; entregas: number; volumes: number; valor: string }[]>(Prisma.sql`
        SELECT e.origem_venda AS origem,
               COUNT(*)::int AS entregas,
               COALESCE(SUM(e.quantidade_volumes), 0)::int AS volumes,
               COALESCE(SUM(cup.valor), 0)::numeric AS valor
        FROM "logistica"."entrega" e
        LEFT JOIN LATERAL (
          SELECT SUM(c.valor) AS valor FROM "logistica"."entrega_cupom" c WHERE c.entrega_id = e.id
        ) cup ON true
        WHERE e.criado_em >= ${ini} AND e.criado_em < ${fim}
          AND e.status <> 'CANCELADA' ${fEnt}
        GROUP BY e.origem_venda`),
      // Por motorista: entregas no mês + taxa de sucesso (entregue × não-entregue)
      // + volumes entregues. Junta parada→viagem pra chegar no motorista.
      this.prisma.$queryRaw<{ motorista_id: string; total: number; entregues: number; nao_entregues: number; volumes: number }[]>(Prisma.sql`
        SELECT v.motorista_id AS motorista_id,
               COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE e.status = 'ENTREGUE')::int AS entregues,
               COUNT(*) FILTER (WHERE e.status = 'NAO_ENTREGUE')::int AS nao_entregues,
               COALESCE(SUM(e.quantidade_volumes) FILTER (WHERE e.status = 'ENTREGUE'), 0)::int AS volumes
        FROM "logistica"."entrega" e
        JOIN "logistica"."parada" p ON p.entrega_id = e.id
        JOIN "logistica"."viagem" v ON v.id = p.viagem_id
        WHERE e.criado_em >= ${ini} AND e.criado_em < ${fim}
          AND v.motorista_id IS NOT NULL ${fEnt}
        GROUP BY v.motorista_id`),
      // Demanda por bairro (com cidade): onde concentramos entregas (top 12).
      // Agrupa case/acento-insensível pela chave em UPPER(TRIM) — senão o texto
      // livre fragmenta "Centro"/"CENTRO". Exibe com INITCAP (Inicial Maiúscula).
      this.prisma.$queryRaw<{ cidade: string | null; bairro: string | null; total: number }[]>(Prisma.sql`
        SELECT NULLIF(INITCAP(cidade_key), '') AS cidade,
               NULLIF(INITCAP(bairro_key), '') AS bairro,
               total
        FROM (
          SELECT translate(UPPER(TRIM(COALESCE(end_cidade, ''))), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC') AS cidade_key,
                 translate(UPPER(TRIM(COALESCE(end_bairro, ''))), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC') AS bairro_key,
                 COUNT(*)::int AS total
          FROM "logistica"."entrega"
          WHERE criado_em >= ${ini} AND criado_em < ${fim}
            AND status <> 'CANCELADA' ${fEntS}
          GROUP BY 1, 2
          ORDER BY total DESC
          LIMIT 12
        ) t`),
      // Totais do mês: entregas, volumes transportados, re-entregas (2ª+).
      this.prisma.$queryRaw<{ total: number; volumes: number; reentregas: number; valor: string }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS total,
               COALESCE(SUM(e.quantidade_volumes), 0)::int AS volumes,
               COUNT(*) FILTER (WHERE e.tentativas > 1)::int AS reentregas,
               COALESCE((
                 SELECT SUM(c.valor) FROM "logistica"."entrega_cupom" c
                 JOIN "logistica"."entrega" e2 ON e2.id = c.entrega_id
                 WHERE e2.criado_em >= ${ini} AND e2.criado_em < ${fim}
                   AND e2.status <> 'CANCELADA' ${filialId ? Prisma.sql`AND e2.filial_id = ${filialId}` : Prisma.empty}
               ), 0)::numeric AS valor
        FROM "logistica"."entrega" e
        WHERE e.criado_em >= ${ini} AND e.criado_em < ${fim}
          AND e.status <> 'CANCELADA' ${fEnt}`),
    ]);

    // KM rodado no mês: viagens CONCLUÍDAS (janela pela chegada) com hodômetro
    // de saída E chegada preenchidos. Auto-conclusão pelo app não tem hodômetro
    // → entra sem km (não conta). Agrega por veículo e por motorista + km/entrega.
    const kmViagens = await this.prisma.viagem.findMany({
      where: {
        tipo: TipoViagem.ENTREGA, // só entregas — frota tem seu próprio Monitor
        situacao: StatusViagem.CONCLUIDA,
        kmInicial: { not: null },
        kmFinal: { not: null },
        dataHoraChegada: { gte: ini, lt: fim },
        ...(filialId ? { filialId } : {}),
      },
      select: {
        motoristaId: true, kmInicial: true, kmFinal: true,
        veiculo: { select: { id: true, placa: true } },
        _count: { select: { paradas: true } },
      },
    });

    const kmTotal = kmViagens.reduce((s, v) => s + ((v.kmFinal ?? 0) - (v.kmInicial ?? 0)), 0);
    const paradasComKm = kmViagens.reduce((s, v) => s + v._count.paradas, 0);
    const kmPorVeiculoMap = new Map<string, { placa: string; km: number }>();
    const kmPorMotoristaMap = new Map<string, number>();
    for (const v of kmViagens) {
      const km = (v.kmFinal ?? 0) - (v.kmInicial ?? 0);
      if (v.veiculo) {
        const cur = kmPorVeiculoMap.get(v.veiculo.id) ?? { placa: v.veiculo.placa, km: 0 };
        cur.km += km; kmPorVeiculoMap.set(v.veiculo.id, cur);
      }
      if (v.motoristaId) kmPorMotoristaMap.set(v.motoristaId, (kmPorMotoristaMap.get(v.motoristaId) ?? 0) + km);
    }

    const nomesMot = await this.core.nomesUsuarios([
      ...motoristaRaw.map((m) => m.motorista_id),
      ...kmPorMotoristaMap.keys(),
    ]);

    const kmPorVeiculo = [...kmPorVeiculoMap.values()].sort((a, b) => b.km - a.km);
    const kmPorMotorista = [...kmPorMotoristaMap.entries()]
      .map(([motoristaId, km]) => ({ motoristaId, nomeMotorista: nomesMot.get(motoristaId) ?? null, km }))
      .sort((a, b) => b.km - a.km);

    const porOrigem = origemRaw
      .map((o) => {
        const entregas = Number(o.entregas);
        const valor = Number(o.valor);
        return {
          origem: o.origem ?? 'NAO_INFORMADO',
          entregas,
          volumes: Number(o.volumes),
          valor,
          ticketMedio: entregas > 0 ? valor / entregas : 0,
        };
      })
      .sort((a, b) => b.valor - a.valor);

    const porMotorista = motoristaRaw
      .map((m) => {
        const finalizadas = Number(m.entregues) + Number(m.nao_entregues);
        return {
          motoristaId: m.motorista_id,
          nomeMotorista: nomesMot.get(m.motorista_id) ?? null,
          total: Number(m.total),
          entregues: Number(m.entregues),
          naoEntregues: Number(m.nao_entregues),
          volumes: Number(m.volumes),
          taxaSucesso: finalizadas > 0 ? Number(m.entregues) / finalizadas : null,
        };
      })
      .sort((a, b) => b.total - a.total);

    const demanda = demandaRaw.map((d) => ({
      cidade: d.cidade,
      bairro: d.bairro ?? 'Sem bairro',
      total: Number(d.total),
    }));

    const t = totaisRaw[0] ?? { total: 0, volumes: 0, reentregas: 0, valor: '0' };
    const total = Number(t.total);
    const reentregas = Number(t.reentregas);
    const valorTotal = Number(t.valor);

    return {
      filtros: { filialId: filialId ?? null, mes, ano },
      totais: {
        entregas: total,
        volumes: Number(t.volumes),
        valorTotal,
        ticketMedio: total > 0 ? valorTotal / total : 0,
        reentregas,
        taxaReentrega: total > 0 ? reentregas / total : 0,
      },
      km: {
        // Cobertura: viagens com hodômetro / total de entregas concluídas com KM.
        total: kmTotal,
        viagens: kmViagens.length,
        porEntrega: paradasComKm > 0 ? kmTotal / paradasComKm : null,
        porVeiculo: kmPorVeiculo,
        porMotorista: kmPorMotorista,
      },
      porOrigem,
      porMotorista,
      demanda,
    };
  }

  // ---------- Análise de Entregas (manchete + grupos + drill-down) ----------
  // Métrica primária: nº de entregas (reconcilia entre as dimensões); valor
  // (cupons) aparece por linha no drill. Exclui CANCELADA. Escopo por filial.
  private readonly ORIGEM_LABEL: Record<string, string> = {
    PRESENCIAL: 'Presencial', TELE_VENDA: 'Tele-venda', OUTRO: 'Outro', NAO_INFORMADO: 'Não informado',
  };
  private readonly STATUS_LABEL: Record<string, string> = {
    PENDENTE: 'Pendente', EM_VIAGEM: 'Em viagem', ENTREGUE: 'Entregue', NAO_ENTREGUE: 'Não entregue',
  };
  private deaccentUpper(s: string): string {
    return s.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  private async entregasDoMes(filialId: string | undefined, mes: number, ano: number, filtro?: FiltroEntrega) {
    const ini = new Date(Date.UTC(ano, mes - 1, 1));
    const fim = new Date(Date.UTC(ano, mes, 1));
    const entregas = await this.prisma.entrega.findMany({
      where: { ...(filialId ? { filialId } : {}), criadoEm: { gte: ini, lt: fim }, status: { not: StatusEntrega.CANCELADA } },
      select: {
        id: true, destinatarioNome: true, origemVenda: true, endBairro: true, endCidade: true,
        status: true, criadoEm: true,
        cupons: { select: { valor: true } },
        parada: { select: { viagem: { select: { motoristaId: true } } } },
      },
      orderBy: { criadoEm: 'desc' },
    });
    const mapped = entregas.map((e) => ({
      ...e,
      valor: e.cupons.reduce((s, c) => s + Number(c.valor), 0),
      motoristaId: e.parada?.viagem?.motoristaId ?? null,
      bairroKey: e.endBairro ? this.deaccentUpper(`${e.endBairro}|${e.endCidade ?? ''}`) : '__sem',
    }));
    if (!filtro) return mapped;
    // Filtra em memória pelas mesmas chaves de dimensão (motorista vem de relação
    // e bairro é chave normalizada — mais simples e consistente que no banco).
    return mapped.filter((e) =>
      (!filtro.origem || this.chaveEntrega(e, 'origem') === filtro.origem)
      && (!filtro.status || e.status === filtro.status)
      && (!filtro.motoristaId || this.chaveEntrega(e, 'motorista') === filtro.motoristaId)
      && (!filtro.bairro || e.bairroKey === filtro.bairro));
  }

  private chaveEntrega(e: { origemVenda: string | null; status: string; motoristaId: string | null; bairroKey: string }, dim: string): string {
    switch (dim) {
      case 'origem': return e.origemVenda ?? 'NAO_INFORMADO';
      case 'status': return e.status;
      case 'motorista': return e.motoristaId ?? '__sem';
      case 'bairro': return e.bairroKey;
      default: return '__sem';
    }
  }

  async analiseEntregas(filialId: string | undefined, mes: number, ano: number, filtro?: FiltroEntrega) {
    const entregas = await this.entregasDoMes(filialId, mes, ano, filtro);
    const totalEntregas = entregas.length;
    const valorTotal = entregas.reduce((s, e) => s + e.valor, 0);

    const motoristaIds = [...new Set(entregas.map((e) => e.motoristaId).filter(Boolean) as string[])];
    const nomesMot = motoristaIds.length ? await this.core.nomesUsuarios(motoristaIds) : new Map<string, string>();

    const agrupar = (dim: string, rotulo: (e: (typeof entregas)[number]) => string) => {
      const m = new Map<string, { label: string; qtd: number; valor: number }>();
      for (const e of entregas) {
        const id = this.chaveEntrega(e, dim);
        const cur = m.get(id) ?? { label: rotulo(e), qtd: 0, valor: 0 };
        cur.qtd += 1; cur.valor += e.valor;
        m.set(id, cur);
      }
      return [...m.entries()].map(([id, g]) => ({ id, ...g })).sort((a, b) => b.qtd - a.qtd);
    };

    return {
      totalEntregas, valorTotal,
      porOrigem: agrupar('origem', (e) => this.ORIGEM_LABEL[e.origemVenda ?? 'NAO_INFORMADO'] ?? 'Não informado'),
      porStatus: agrupar('status', (e) => this.STATUS_LABEL[e.status] ?? e.status),
      porMotorista: agrupar('motorista', (e) => (e.motoristaId ? (nomesMot.get(e.motoristaId) ?? 'Motorista') : 'Sem motorista (não despachada)')),
      porBairro: agrupar('bairro', (e) => (e.endBairro ? `${e.endBairro}${e.endCidade ? ` · ${e.endCidade}` : ''}` : 'Sem bairro')),
    };
  }

  async analiseEntregasDocumentos(filialId: string | undefined, mes: number, ano: number, dimensao: string, chave: string, filtro?: FiltroEntrega) {
    const entregas = await this.entregasDoMes(filialId, mes, ano, filtro);
    return entregas
      .filter((e) => this.chaveEntrega(e, dimensao) === chave)
      .map((e) => ({
        id: e.id,
        principal: e.destinatarioNome,
        secundario: `${e.endBairro ?? 'Sem bairro'}${e.endCidade ? ` · ${e.endCidade}` : ''} · ${this.ORIGEM_LABEL[e.origemVenda ?? 'NAO_INFORMADO'] ?? 'Não informado'}`,
        terciario: this.STATUS_LABEL[e.status] ?? e.status,
        data: e.criadoEm,
        valor: e.valor,
      }));
  }
}
