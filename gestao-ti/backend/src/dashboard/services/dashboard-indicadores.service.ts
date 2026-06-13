import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ChamadoExternoService } from '../../chamado-externo/chamado-externo.service.js';
import { getDeptoIdsDoUser, applyDepartamentoFilter } from '../../common/helpers/departamento-filter.helper.js';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';

@Injectable()
export class DashboardIndicadoresService {
  private readonly logger = new Logger(DashboardIndicadoresService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chamadoExternoService: ChamadoExternoService,
  ) {}

  async getIndicadores(mes: number, ano: number, tiposParada?: string[], user?: JwtPayload, role?: string) {
    // Calcular periodo
    const dataInicio = new Date(ano, mes - 1, 1);
    const dataFim = new Date(ano, mes, 0, 23, 59, 59, 999); // ultimo dia do mes
    const diasNoMes = dataFim.getDate();
    const horasTotais = diasNoMes * 24;

    const [investimentos, licencas, disponibilidade, chamados, horasDesenvolvimento, chamadosExternos] = await Promise.all([
      this.getInvestimentos(dataInicio, dataFim, user, role),
      this.getLicencas(user, role),
      this.getDisponibilidade(dataInicio, dataFim, horasTotais, tiposParada, user, role),
      this.getChamados(dataInicio, dataFim, user, role),
      this.getHorasDesenvolvimento(dataInicio, dataFim),
      this.chamadoExternoService.getKpiPeriodo(mes, ano, user, role),
    ]);

    return {
      periodo: { mes, ano, dataInicio, dataFim, diasNoMes },
      investimentos,
      licencas,
      disponibilidade,
      chamados,
      horasDesenvolvimento,
      chamadosExternos,
    };
  }

  private async getInvestimentos(dataInicio: Date, dataFim: Date, user?: JwtPayload, role?: string) {
    // Workspace Onda 2 C2.7 — escopo workspace. Parcela filtra pelo
    // departamento do contrato (parcela não tem depto próprio).
    const deptoIds = getDeptoIdsDoUser(user, role);
    const parcelaDeptoWhere =
      deptoIds === null ? {} : { contrato: { departamentoId: { in: deptoIds } } };
    const nfDeptoWhere = applyDepartamentoFilter({}, user, role);

    // Parcelas de contratos pagas no periodo
    const parcelas = await this.prisma.parcelaContrato.findMany({
      where: {
        status: 'PAGA',
        dataPagamento: { gte: dataInicio, lte: dataFim },
        ...parcelaDeptoWhere,
      },
      include: {
        contrato: { select: { id: true, numero: true, titulo: true } },
      },
      orderBy: { dataPagamento: 'asc' },
    });

    const totalParcelas = parcelas.reduce((sum, p) => sum + Number(p.valor), 0);

    // NFs no periodo (nao canceladas)
    const nfs = await this.prisma.notaFiscal.findMany({
      where: {
        status: { not: 'CANCELADA' },
        dataLancamento: { gte: dataInicio, lte: dataFim },
        ...nfDeptoWhere,
      },
      include: {
        fornecedor: true,
        itens: { include: { produto: true } },
      },
      orderBy: { dataLancamento: 'asc' },
    });

    const totalNFs = nfs.reduce((sum, nf) => sum + Number(nf.valorTotal), 0);

    return {
      totalParcelas,
      totalNFs,
      totalInvestimento: totalParcelas + totalNFs,
      qtdParcelas: parcelas.length,
      qtdNFs: nfs.length,
      detalheParcelas: parcelas.map(p => ({
        id: p.id,
        numero: p.numero,
        valor: Number(p.valor),
        dataPagamento: p.dataPagamento,
        contrato: p.contrato,
      })),
      detalheNFs: nfs.map(nf => ({
        id: nf.id,
        numero: nf.numero,
        valorTotal: Number(nf.valorTotal),
        dataLancamento: nf.dataLancamento,
        fornecedor: `${nf.fornecedor.codigo} - ${nf.fornecedor.nome}`,
        qtdItens: nf.itens.length,
      })),
    };
  }

  /**
   * Investimento do mês AGRUPADO (tela "Indicadores — Análise"). Espelha EXATO
   * os filtros de getInvestimentos (período + status + escopo workspace) para o
   * total reconciliar com o KPI manchete. Cada agrupamento SOMA ao total via
   * baldes de resíduo — nada some, nada conta duas vezes:
   *  - por Centro de Custo: itens da NF + rateio das parcelas (+ resíduos)
   *  - por Tipo de Produto: itens da NF (Não classificado p/ vazio) + contratos
   *  - por Departamento: header da NF + departamento do contrato (reconcilia 100%)
   */
  async getInvestimentoAnalitico(mes: number, ano: number, user?: JwtPayload, role?: string) {
    const dataInicio = new Date(ano, mes - 1, 1);
    const dataFim = new Date(ano, mes, 0, 23, 59, 59, 999);
    const deptoIds = getDeptoIdsDoUser(user, role);
    const parcelaDeptoWhere =
      deptoIds === null ? {} : { contrato: { departamentoId: { in: deptoIds } } };
    const nfDeptoWhere = applyDepartamentoFilter({}, user, role);

    const [parcelas, nfs] = await Promise.all([
      this.prisma.parcelaContrato.findMany({
        where: { status: 'PAGA', dataPagamento: { gte: dataInicio, lte: dataFim }, ...parcelaDeptoWhere },
        include: {
          contrato: { select: { departamentoId: true, departamento: { select: { nome: true } } } },
          rateioItens: { include: { centroCusto: { select: { id: true, codigo: true, nome: true } } } },
        },
      }),
      this.prisma.notaFiscal.findMany({
        where: { status: { not: 'CANCELADA' }, dataLancamento: { gte: dataInicio, lte: dataFim }, ...nfDeptoWhere },
        include: {
          departamento: { select: { id: true, nome: true } },
          itens: {
            include: {
              produto: { include: { tipoProduto: { select: { id: true, descricao: true } } } },
              centroCusto: { select: { id: true, codigo: true, nome: true } },
            },
          },
        },
      }),
    ]);

    type Bucket = Map<string, { label: string; valor: number; qtd: number }>;
    const add = (m: Bucket, key: string, label: string, valor: number) => {
      const cur = m.get(key) ?? { label, valor: 0, qtd: 0 };
      cur.valor += valor;
      cur.qtd += 1;
      m.set(key, cur);
    };
    const cents = (n: number) => Math.round(n * 100) / 100;
    const arr = (m: Bucket) =>
      [...m.entries()].map(([id, v]) => ({ id, label: v.label, valor: cents(v.valor), qtd: v.qtd }))
        .sort((a, b) => b.valor - a.valor);

    const cc: Bucket = new Map();
    const tipo: Bucket = new Map();
    const depto: Bucket = new Map();
    let totalNFs = 0;
    let totalParcelas = 0;

    for (const nf of nfs) {
      const v = Number(nf.valorTotal);
      totalNFs += v;
      add(depto, nf.departamento?.id ?? '__sd', nf.departamento?.nome ?? 'Sem departamento', v);
      let somaItens = 0;
      for (const it of nf.itens) {
        const iv = Number(it.valorTotal);
        somaItens += iv;
        add(cc, it.centroCustoId, `${it.centroCusto.codigo} · ${it.centroCusto.nome}`, iv);
        const t = it.produto.tipoProduto;
        add(tipo, t?.id ?? '__nc', t?.descricao ?? 'Não classificado', iv);
      }
      const resid = cents(v - somaItens);
      if (Math.abs(resid) >= 0.01) {
        add(cc, '__nf_resid', 'NFs — valor não detalhado em itens', resid);
        add(tipo, '__nf_resid', 'NFs — valor não detalhado em itens', resid);
      }
    }

    for (const p of parcelas) {
      const v = Number(p.valor);
      totalParcelas += v;
      add(depto, p.contrato.departamentoId ?? '__sd', p.contrato.departamento?.nome ?? 'Sem departamento', v);
      add(tipo, '__contrato', 'Contratos/serviços (sem produto)', v);
      if (p.rateioItens.length) {
        let somaR = 0;
        for (const ri of p.rateioItens) {
          const rv = Number(ri.valorCalculado);
          somaR += rv;
          add(cc, ri.centroCustoId, `${ri.centroCusto.codigo} · ${ri.centroCusto.nome}`, rv);
        }
        const residR = cents(v - somaR);
        if (Math.abs(residR) >= 0.01) add(cc, '__parc_resid', 'Contratos — rateio incompleto', residR);
      } else {
        add(cc, '__parc_norateio', 'Contratos — sem rateio de centro de custo', v);
      }
    }

    return {
      periodo: { mes, ano, dataInicio, dataFim },
      totalInvestimento: cents(totalNFs + totalParcelas),
      totalNFs: cents(totalNFs),
      totalParcelas: cents(totalParcelas),
      porCentroCusto: arr(cc),
      porTipoProduto: arr(tipo),
      porDepartamento: arr(depto),
    };
  }

  /**
   * Drill-down: os DOCUMENTOS (NFs/parcelas de contrato) que compõem um grupo
   * específico do investimento analítico. `valor` é a parcela do documento
   * ATRIBUÍDA àquele grupo — mesma regra de atribuição do agrupamento, então a
   * soma dos documentos reconcilia com o valor do grupo.
   */
  async getInvestimentoDocumentos(
    mes: number, ano: number,
    dimensao: 'centroCusto' | 'tipoProduto' | 'departamento',
    chave: string,
    user?: JwtPayload, role?: string,
  ) {
    const dataInicio = new Date(ano, mes - 1, 1);
    const dataFim = new Date(ano, mes, 0, 23, 59, 59, 999);
    const deptoIds = getDeptoIdsDoUser(user, role);
    const parcelaDeptoWhere = deptoIds === null ? {} : { contrato: { departamentoId: { in: deptoIds } } };
    const nfDeptoWhere = applyDepartamentoFilter({}, user, role);

    const [parcelas, nfs] = await Promise.all([
      this.prisma.parcelaContrato.findMany({
        where: { status: 'PAGA', dataPagamento: { gte: dataInicio, lte: dataFim }, ...parcelaDeptoWhere },
        include: {
          contrato: { select: { numero: true, titulo: true, departamentoId: true } },
          rateioItens: { select: { centroCustoId: true, valorCalculado: true } },
        },
        orderBy: { dataPagamento: 'asc' },
      }),
      this.prisma.notaFiscal.findMany({
        where: { status: { not: 'CANCELADA' }, dataLancamento: { gte: dataInicio, lte: dataFim }, ...nfDeptoWhere },
        include: {
          fornecedor: { select: { codigo: true, nome: true } },
          departamento: { select: { id: true } },
          itens: { select: { valorTotal: true, centroCustoId: true, produto: { select: { tipoProdutoId: true } } } },
        },
        orderBy: { dataLancamento: 'asc' },
      }),
    ]);

    const cents = (n: number) => Math.round(n * 100) / 100;
    type Doc = { tipo: 'NF' | 'PARCELA'; id: string; numero: string; descricao: string; data: Date | null; valor: number };
    const docs: Doc[] = [];
    const nfDoc = (nf: typeof nfs[number], valor: number): Doc => ({
      tipo: 'NF', id: nf.id, numero: String(nf.numero),
      descricao: `${nf.fornecedor.codigo} - ${nf.fornecedor.nome}`, data: nf.dataLancamento, valor: cents(valor),
    });
    const parcDoc = (p: typeof parcelas[number], valor: number): Doc => ({
      tipo: 'PARCELA', id: p.id, numero: `Parcela ${p.numero}`,
      descricao: `${p.contrato.numero} - ${p.contrato.titulo}`, data: p.dataPagamento, valor: cents(valor),
    });

    if (dimensao === 'centroCusto') {
      for (const nf of nfs) {
        if (chave === '__nf_resid') {
          const resid = cents(Number(nf.valorTotal) - nf.itens.reduce((s, i) => s + Number(i.valorTotal), 0));
          if (Math.abs(resid) >= 0.01) docs.push(nfDoc(nf, resid));
        } else {
          const v = nf.itens.filter((i) => i.centroCustoId === chave).reduce((s, i) => s + Number(i.valorTotal), 0);
          if (v > 0) docs.push(nfDoc(nf, v));
        }
      }
      for (const p of parcelas) {
        if (chave === '__parc_norateio') {
          if (!p.rateioItens.length) docs.push(parcDoc(p, Number(p.valor)));
        } else if (chave === '__parc_resid') {
          if (p.rateioItens.length) {
            const resid = cents(Number(p.valor) - p.rateioItens.reduce((s, r) => s + Number(r.valorCalculado), 0));
            if (Math.abs(resid) >= 0.01) docs.push(parcDoc(p, resid));
          }
        } else {
          const v = p.rateioItens.filter((r) => r.centroCustoId === chave).reduce((s, r) => s + Number(r.valorCalculado), 0);
          if (v > 0) docs.push(parcDoc(p, v));
        }
      }
    } else if (dimensao === 'tipoProduto') {
      for (const nf of nfs) {
        if (chave === '__nf_resid') {
          const resid = cents(Number(nf.valorTotal) - nf.itens.reduce((s, i) => s + Number(i.valorTotal), 0));
          if (Math.abs(resid) >= 0.01) docs.push(nfDoc(nf, resid));
        } else {
          const v = nf.itens.filter((i) => (i.produto.tipoProdutoId ?? '__nc') === chave).reduce((s, i) => s + Number(i.valorTotal), 0);
          if (v > 0) docs.push(nfDoc(nf, v));
        }
      }
      if (chave === '__contrato') for (const p of parcelas) docs.push(parcDoc(p, Number(p.valor)));
    } else {
      for (const nf of nfs) if ((nf.departamento?.id ?? '__sd') === chave) docs.push(nfDoc(nf, Number(nf.valorTotal)));
      for (const p of parcelas) if ((p.contrato.departamentoId ?? '__sd') === chave) docs.push(parcDoc(p, Number(p.valor)));
    }

    return docs.sort((a, b) => b.valor - a.valor);
  }

  private async getLicencas(user?: JwtPayload, role?: string) {
    const licSelect = {
      id: true, nome: true, modeloLicenca: true, quantidade: true, dataVencimento: true, status: true,
      software: { select: { id: true, nome: true } },
      categoria: { select: { id: true, nome: true } },
    };

    // Workspace Onda 2 C2.7 — licenças e softwares filtram por depto-dono.
    const licDeptoWhere = applyDepartamentoFilter({}, user, role);
    const swDeptoWhere = applyDepartamentoFilter({}, user, role);

    const [licencasAtivasList, softwaresAtivosList, licencasVencendo30List, licencasVencendo60List, licencasVencendo90List] = await Promise.all([
      this.prisma.softwareLicenca.findMany({
        where: { status: 'ATIVA', ...licDeptoWhere },
        select: licSelect,
        orderBy: [{ software: { nome: 'asc' } }, { nome: 'asc' }],
      }),
      this.prisma.software.findMany({
        where: { status: 'ATIVO', ...swDeptoWhere },
        select: { id: true, nome: true, fabricante: true, tipo: true, criticidade: true, versaoAtual: true, _count: { select: { licencas: true, modulos: true } } },
        orderBy: { nome: 'asc' },
      }),
      this.prisma.softwareLicenca.findMany({
        where: {
          status: 'ATIVA',
          dataVencimento: { gte: new Date(), lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
          ...licDeptoWhere,
        },
        select: licSelect,
        orderBy: { dataVencimento: 'asc' },
      }),
      // 02/06 — janela de 60 dias (antes hardcoded 0 no retorno).
      this.prisma.softwareLicenca.findMany({
        where: {
          status: 'ATIVA',
          dataVencimento: { gte: new Date(), lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) },
          ...licDeptoWhere,
        },
        select: licSelect,
        orderBy: { dataVencimento: 'asc' },
      }),
      this.prisma.softwareLicenca.findMany({
        where: {
          status: 'ATIVA',
          dataVencimento: { gte: new Date(), lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
          ...licDeptoWhere,
        },
        select: licSelect,
        orderBy: { dataVencimento: 'asc' },
      }),
    ]);

    return {
      licencasAtivas: licencasAtivasList.length,
      totalSoftwares: softwaresAtivosList.length,
      licencasVencendo30: licencasVencendo30List.length,
      licencasVencendo60: licencasVencendo60List.length,
      licencasVencendo90: licencasVencendo90List.length,
      detalheSoftwares: softwaresAtivosList,
      detalheLicencasAtivas: licencasAtivasList,
      detalheLicencasVencendo30: licencasVencendo30List,
      detalheLicencasVencendo60: licencasVencendo60List,
      detalheLicencasVencendo90: licencasVencendo90List,
    };
  }

  private async getDisponibilidade(dataInicio: Date, dataFim: Date, horasTotais: number, tiposParada?: string[], user?: JwtPayload, role?: string) {
    // Tipos para calculo de disponibilidade (default: nao-programadas)
    const tiposCalculo = tiposParada && tiposParada.length > 0
      ? tiposParada
      : ['PARADA_NAO_PROGRAMADA'];

    // Workspace Onda 2 C2.7 — paradas filtram pelo depto-dono.
    const paradaDeptoWhere = applyDepartamentoFilter({}, user, role);

    // Buscar TODAS as paradas finalizadas no periodo (para exibir visao completa)
    const paradas = await this.prisma.registroParada.findMany({
      where: {
        status: 'FINALIZADA',
        inicio: { lte: dataFim },
        OR: [
          { fim: { gte: dataInicio } },
          { fim: null },
        ],
        ...paradaDeptoWhere,
      },
      include: {
        software: { select: { id: true, nome: true } },
        motivoParada: { select: { id: true, nome: true } },
      },
      orderBy: [{ software: { nome: 'asc' } }, { inicio: 'asc' }],
    });

    // Calcular horas de cada parada no periodo
    let minutosParadaCalculo = 0; // apenas tipos selecionados
    const paradasComHoras = paradas.map(p => {
      const inicio = p.inicio < dataInicio ? dataInicio : p.inicio;
      const fim = p.fim ? (p.fim > dataFim ? dataFim : p.fim) : dataFim;
      const minutos = Math.max(0, (fim.getTime() - inicio.getTime()) / (1000 * 60));

      // Acumular apenas os tipos selecionados para calculo de disponibilidade
      if (tiposCalculo.includes(p.tipo)) {
        minutosParadaCalculo += minutos;
      }

      return {
        id: p.id,
        titulo: p.titulo,
        tipo: p.tipo,
        impacto: p.impacto,
        softwareId: p.software.id,
        softwareNome: p.software.nome,
        motivo: p.motivoParada?.nome || null,
        inicio: p.inicio,
        fim: p.fim,
        horasNoPeriodo: Number((minutos / 60).toFixed(1)),
      };
    });

    // Agrupar por software > tipo > impacto
    const porSoftware = new Map<string, {
      softwareId: string;
      softwareNome: string;
      linhas: {
        tipo: string;
        impacto: string;
        qtdParadas: number;
        horasTotal: number;
        paradas: { id: string; titulo: string; motivo: string | null; inicio: Date; fim: Date | null; horasNoPeriodo: number }[];
      }[];
    }>();

    for (const p of paradasComHoras) {
      if (!porSoftware.has(p.softwareId)) {
        porSoftware.set(p.softwareId, {
          softwareId: p.softwareId,
          softwareNome: p.softwareNome,
          linhas: [],
        });
      }

      const sw = porSoftware.get(p.softwareId)!;
      let linha = sw.linhas.find(l => l.tipo === p.tipo && l.impacto === p.impacto);
      if (!linha) {
        linha = { tipo: p.tipo, impacto: p.impacto, qtdParadas: 0, horasTotal: 0, paradas: [] };
        sw.linhas.push(linha);
      }
      linha.qtdParadas++;
      linha.horasTotal = Number((linha.horasTotal + p.horasNoPeriodo).toFixed(1));
      linha.paradas.push({
        id: p.id,
        titulo: p.titulo,
        motivo: p.motivo,
        inicio: p.inicio,
        fim: p.fim,
        horasNoPeriodo: p.horasNoPeriodo,
      });
    }

    // Ordenar linhas dentro de cada software: tipo asc, impacto asc
    for (const sw of porSoftware.values()) {
      sw.linhas.sort((a, b) => {
        const cmp = a.tipo.localeCompare(b.tipo);
        return cmp !== 0 ? cmp : a.impacto.localeCompare(b.impacto);
      });
    }

    const horasParada = minutosParadaCalculo / 60;
    const disponibilidade = horasTotais > 0 ? ((horasTotais - horasParada) / horasTotais) * 100 : 100;

    return {
      horasTotais,
      horasParada: Number(horasParada.toFixed(1)),
      disponibilidadePercent: Number(disponibilidade.toFixed(2)),
      qtdParadas: paradas.length,
      tiposFiltrados: tiposCalculo,
      porSoftware: Array.from(porSoftware.values()).sort((a, b) => a.softwareNome.localeCompare(b.softwareNome)),
    };
  }

  private async getChamados(dataInicio: Date, dataFim: Date, user?: JwtPayload, role?: string) {
    const chamadoSelect = {
      id: true, numero: true, titulo: true, status: true, prioridade: true,
      createdAt: true, updatedAt: true, dataResolucao: true, dataFechamento: true,
      solicitante: { select: { id: true, nome: true } },
      tecnico: { select: { id: true, nome: true } },
      equipeAtual: { select: { id: true, sigla: true } },
    };

    // Workspace Onda 2 C2.7 + C2.9 — solicitante OU depto OU equipe que sou membro.
    const deptoIds = getDeptoIdsDoUser(user, role);
    let equipeIds: string[] = [];
    if (deptoIds !== null && user?.sub) {
      const equipesAtivas = await this.prisma.membroEquipe.findMany({
        where: { usuarioId: user.sub, status: 'ATIVO' },
        select: { equipeId: true },
      });
      equipeIds = equipesAtivas.map((m) => m.equipeId);
    }
    const wsFilter = (extra: Record<string, unknown>): Record<string, unknown> =>
      deptoIds === null
        ? extra
        : {
            AND: [
              extra,
              {
                OR: [
                  { solicitanteId: user?.sub ?? '' },
                  { departamentoId: { in: deptoIds } },
                  ...(equipeIds.length > 0 ? [{ equipeAtualId: { in: equipeIds } }] : []),
                ],
              },
            ],
          };

    const [abertosList, resolvidosList, emAbertoList] = await Promise.all([
      this.prisma.chamado.findMany({
        where: wsFilter({ createdAt: { gte: dataInicio, lte: dataFim } }),
        select: chamadoSelect,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.chamado.findMany({
        // 02/06 — "resolvido no período" passa a usar data_resolucao (fallback
        // data_fechamento), não updated_at. updated_at muda em qualquer edição
        // pós-resolução (ex.: comentário), inflando contagem e tempo médio.
        where: wsFilter({
          status: { in: ['RESOLVIDO', 'FECHADO'] },
          OR: [
            { dataResolucao: { gte: dataInicio, lte: dataFim } },
            { dataResolucao: null, dataFechamento: { gte: dataInicio, lte: dataFim } },
          ],
        }),
        select: chamadoSelect,
        orderBy: { dataResolucao: 'desc' },
      }),
      this.prisma.chamado.findMany({
        where: wsFilter({ status: { in: ['ABERTO', 'EM_ATENDIMENTO', 'PENDENTE', 'REABERTO'] } }),
        select: chamadoSelect,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Tempo médio = (resolução − abertura). Usa data_resolucao (fallback
    // data_fechamento, fallback updated_at p/ registros legados sem as datas).
    let tempoMedioHoras = 0;
    if (resolvidosList.length > 0) {
      const totalMinutos = resolvidosList.reduce((sum, c) => {
        const fim = c.dataResolucao ?? c.dataFechamento ?? c.updatedAt;
        return sum + (fim.getTime() - c.createdAt.getTime()) / (1000 * 60);
      }, 0);
      tempoMedioHoras = Number((totalMinutos / resolvidosList.length / 60).toFixed(1));
    }

    return {
      abertosNoPeriodo: abertosList.length,
      resolvidosNoPeriodo: resolvidosList.length,
      emAbertoAtual: emAbertoList.length,
      tempoMedioResolucaoHoras: tempoMedioHoras,
      detalheAbertos: abertosList,
      detalheResolvidos: resolvidosList,
      detalheEmAberto: emAbertoList,
    };
  }

  private async getHorasDesenvolvimento(dataInicio: Date, dataFim: Date) {
    // Buscar projetos de desenvolvimento interno (pelo tipoProjeto.codigo)
    const tipoDesenv = await this.prisma.tipoProjetoConfig.findFirst({
      where: { codigo: 'DESENVOLVIMENTO_INTERNO' },
    });

    // Guard (02/06): sem o tipo DESENVOLVIMENTO_INTERNO, a query SEM o filtro
    // contaria TODOS os apontamentos (manutenção/infra/etc.), inflando o KPI.
    // Melhor retornar 0 + logar do que entregar número errado silenciosamente.
    if (!tipoDesenv) {
      this.logger.error(
        'KPI horas-dev: tipoProjetoConfig DESENVOLVIMENTO_INTERNO não encontrado — ' +
          'retornando 0 (evita contar apontamentos de todos os tipos). Cadastre o tipo.',
      );
      return { totalHoras: 0, totalApontamentos: 0, porProjeto: [], porAnalista: [] };
    }

    // Buscar registros de tempo (player) das atividades de projetos do tipo Desenvolvimento Interno
    const where: Record<string, unknown> = {
      horaInicio: { gte: dataInicio, lte: dataFim },
      horaFim: { not: null },
      duracaoMinutos: { not: null, gt: 0 },
      atividade: { projeto: { tipoProjetoId: tipoDesenv.id } },
    };

    const registros = await this.prisma.registroTempo.findMany({
      where,
      include: {
        atividade: {
          select: {
            id: true,
            projeto: { select: { id: true, numero: true, nome: true } },
          },
        },
        usuario: { select: { id: true, nome: true } },
      },
      orderBy: { horaInicio: 'asc' },
    });

    const totalMinutos = registros.reduce((sum, r) => sum + (r.duracaoMinutos || 0), 0);
    const totalHoras = totalMinutos / 60;

    // Agrupar por projeto
    const porProjeto = new Map<string, { projeto: { id: string; numero: number; nome: string }; horas: number }>();
    for (const r of registros) {
      const proj = r.atividade.projeto;
      const key = proj.id;
      if (!porProjeto.has(key)) {
        porProjeto.set(key, { projeto: proj, horas: 0 });
      }
      porProjeto.get(key)!.horas += (r.duracaoMinutos || 0) / 60;
    }

    // Agrupar por analista
    const porAnalista = new Map<string, { usuario: { id: string; nome: string }; horas: number }>();
    for (const r of registros) {
      const key = r.usuario.id;
      if (!porAnalista.has(key)) {
        porAnalista.set(key, { usuario: r.usuario, horas: 0 });
      }
      porAnalista.get(key)!.horas += (r.duracaoMinutos || 0) / 60;
    }

    return {
      totalHoras: Number(totalHoras.toFixed(1)),
      totalApontamentos: registros.length,
      porProjeto: Array.from(porProjeto.values())
        .map(p => ({ ...p, horas: Number(p.horas.toFixed(1)) }))
        .sort((a, b) => b.horas - a.horas),
      porAnalista: Array.from(porAnalista.values())
        .map(a => ({ ...a, horas: Number(a.horas.toFixed(1)) }))
        .sort((a, b) => b.horas - a.horas),
    };
  }
}
