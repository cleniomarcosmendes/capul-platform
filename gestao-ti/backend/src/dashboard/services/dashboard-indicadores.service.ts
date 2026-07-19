import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ChamadoExternoService } from '../../chamado-externo/chamado-externo.service.js';
import { getDeptoIdsDoUser, applyDepartamentoFilter, applyDepartamentoLancamentoFilterCadastroOpStaff } from '../../common/helpers/departamento-filter.helper.js';
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
          contrato: {
            select: {
              departamentoId: true,
              departamento: { select: { nome: true } },
              produtoRef: { select: { tipoProduto: { select: { id: true, descricao: true } } } },
            },
          },
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
      // Tipo de produto do CONTRATO (produtoRef → tipoProduto). Reconcilia com os
      // mesmos baldes das NFs (mesmo id de TipoProduto → mesma faixa); contrato sem
      // produto/tipo cai em "Não classificado" (__nc), igual item de NF sem tipo.
      const ctTipo = p.contrato.produtoRef?.tipoProduto;
      add(tipo, ctTipo?.id ?? '__nc', ctTipo?.descricao ?? 'Não classificado', v);
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
   * Comparação do investimento do mês com o MÊS ANTERIOR — responde "por que
   * subiu/caiu": delta total + maiores movimentações por dimensão (centro de
   * custo / tipo / departamento) + os DOCUMENTOS (NFs/parcelas) do mês, marcando
   * os de origem NOVA (fornecedor/contrato sem gasto no mês anterior).
   */
  async getInvestimentoComparativo(mes: number, ano: number, user?: JwtPayload, role?: string) {
    const mPrev = mes === 1 ? 12 : mes - 1;
    const aPrev = mes === 1 ? ano - 1 : ano;
    const [atual, anterior, docsAtual, docsAnterior] = await Promise.all([
      this.getInvestimentoAnalitico(mes, ano, user, role),
      this.getInvestimentoAnalitico(mPrev, aPrev, user, role),
      this.docsInvestimentoDoMes(mes, ano, user, role),
      this.docsInvestimentoDoMes(mPrev, aPrev, user, role),
    ]);
    const round = (n: number) => Math.round(n * 100) / 100;
    const delta = round(atual.totalInvestimento - anterior.totalInvestimento);

    type G = { id: string; label: string; valor: number };
    const movers = (a: G[], b: G[]) => {
      const ma = new Map(a.map((g) => [g.id, g]));
      const mb = new Map(b.map((g) => [g.id, g]));
      return [...new Set([...ma.keys(), ...mb.keys()])]
        .map((id) => {
          const va = ma.get(id)?.valor ?? 0;
          const vb = mb.get(id)?.valor ?? 0;
          return { label: ma.get(id)?.label ?? mb.get(id)?.label ?? '—', atual: va, anterior: vb, delta: round(va - vb) };
        })
        .filter((x) => Math.abs(x.delta) >= 0.01)
        .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
        .slice(0, 8);
    };

    const origensAnteriores = new Set(docsAnterior.map((d) => d.origem));
    const documentos = docsAtual
      .map((d) => ({ tipo: d.tipo, numero: d.numero, descricao: d.descricao, data: d.data, valor: d.valor, novo: !origensAnteriores.has(d.origem) }))
      .sort((x, y) => y.valor - x.valor)
      .slice(0, 30);

    return {
      atual: { mes, ano, total: atual.totalInvestimento },
      anterior: { mes: mPrev, ano: aPrev, total: anterior.totalInvestimento },
      delta,
      deltaPct: anterior.totalInvestimento > 0 ? Math.round((delta / anterior.totalInvestimento) * 1000) / 10 : null,
      movers: {
        centroCusto: movers(atual.porCentroCusto, anterior.porCentroCusto),
        tipoProduto: movers(atual.porTipoProduto, anterior.porTipoProduto),
        departamento: movers(atual.porDepartamento, anterior.porDepartamento),
      },
      documentos,
    };
  }

  /** Documentos de investimento do mês (NF total + parcela total) com "origem"
   *  (fornecedor/contrato) para detectar entradas novas mês a mês. */
  private async docsInvestimentoDoMes(mes: number, ano: number, user?: JwtPayload, role?: string) {
    const dataInicio = new Date(ano, mes - 1, 1);
    const dataFim = new Date(ano, mes, 0, 23, 59, 59, 999);
    const deptoIds = getDeptoIdsDoUser(user, role);
    const parcelaDeptoWhere = deptoIds === null ? {} : { contrato: { departamentoId: { in: deptoIds } } };
    const nfDeptoWhere = applyDepartamentoFilter({}, user, role);
    const [parcelas, nfs] = await Promise.all([
      this.prisma.parcelaContrato.findMany({
        where: { status: 'PAGA', dataPagamento: { gte: dataInicio, lte: dataFim }, ...parcelaDeptoWhere },
        include: { contrato: { select: { numero: true, titulo: true } }, rateioItens: { select: { valorCalculado: true } } },
      }),
      this.prisma.notaFiscal.findMany({
        where: { status: { not: 'CANCELADA' }, dataLancamento: { gte: dataInicio, lte: dataFim }, ...nfDeptoWhere },
        include: { fornecedor: { select: { codigo: true, nome: true } } },
      }),
    ]);
    const cents = (n: number) => Math.round(n * 100) / 100;
    return [
      ...nfs.map((nf) => ({
        tipo: 'NF' as const, numero: String(nf.numero),
        descricao: `${nf.fornecedor.codigo} - ${nf.fornecedor.nome}`,
        data: nf.dataLancamento, valor: cents(Number(nf.valorTotal)), origem: `F:${nf.fornecedor.codigo}`,
      })),
      ...parcelas.map((p) => ({
        tipo: 'PARCELA' as const, numero: `Parcela ${p.numero}`,
        descricao: `${p.contrato.numero} - ${p.contrato.titulo}`,
        data: p.dataPagamento, valor: cents(p.rateioItens.reduce((s, ri) => s + Number(ri.valorCalculado), 0)), origem: `C:${p.contrato.numero}`,
      })),
    ];
  }

  /**
   * Evolução do investimento nos últimos 12 meses (terminando no mês de
   * referência) — gráfico de tendência da tela "Indicadores — Análise". Usa
   * EXATAMENTE os mesmos filtros do total-manchete (NF por dataLancamento +
   * status≠CANCELADA; Parcela PAGA por dataPagamento; escopo workspace), então
   * cada ponto reconcilia com getInvestimentoAnalitico daquele mês. Para ser
   * barato, roda só DUAS queries na janela inteira e agrega por mês em memória.
   */
  async getInvestimentoEvolucao(mes: number, ano: number, user?: JwtPayload, role?: string) {
    const windowInicio = new Date(ano, mes - 12, 1);
    const windowFim = new Date(ano, mes, 0, 23, 59, 59, 999);
    const deptoIds = getDeptoIdsDoUser(user, role);
    const parcelaDeptoWhere =
      deptoIds === null ? {} : { contrato: { departamentoId: { in: deptoIds } } };
    const nfDeptoWhere = applyDepartamentoFilter({}, user, role);

    const [parcelas, nfs] = await Promise.all([
      this.prisma.parcelaContrato.findMany({
        where: { status: 'PAGA', dataPagamento: { gte: windowInicio, lte: windowFim }, ...parcelaDeptoWhere },
        select: { valor: true, dataPagamento: true },
      }),
      this.prisma.notaFiscal.findMany({
        where: { status: { not: 'CANCELADA' }, dataLancamento: { gte: windowInicio, lte: windowFim }, ...nfDeptoWhere },
        select: { valorTotal: true, dataLancamento: true },
      }),
    ]);

    // 12 baldes ordenados (mais antigo → mês de referência). A chave ano-mês usa
    // a mesma interpretação de mês da janela do analítico, garantindo o batimento.
    const buckets = new Map<string, { ano: number; mes: number; totalNFs: number; totalParcelas: number }>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(ano, mes - 1 - i, 1);
      buckets.set(`${d.getFullYear()}-${d.getMonth() + 1}`, {
        ano: d.getFullYear(), mes: d.getMonth() + 1, totalNFs: 0, totalParcelas: 0,
      });
    }
    const chave = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}`;

    for (const nf of nfs) {
      const b = buckets.get(chave(nf.dataLancamento));
      if (b) b.totalNFs += Number(nf.valorTotal);
    }
    for (const p of parcelas) {
      if (!p.dataPagamento) continue;
      const b = buckets.get(chave(p.dataPagamento));
      if (b) b.totalParcelas += Number(p.valor);
    }

    const cents = (n: number) => Math.round(n * 100) / 100;
    return [...buckets.values()].map((b) => ({
      ano: b.ano,
      mes: b.mes,
      totalNFs: cents(b.totalNFs),
      totalParcelas: cents(b.totalParcelas),
      totalInvestimento: cents(b.totalNFs + b.totalParcelas),
    }));
  }

  /**
   * Evolução do investimento nos últimos 12 meses QUEBRADA por uma dimensão
   * (centroCusto | tipoProduto | departamento) — gráfico empilhado da Análise.
   * Mesma atribuição/baldes do getInvestimentoAnalitico (inclui resíduos), então
   * a soma das faixas em cada mês reconcilia com o total daquele mês. Mantém as
   * TOP 6 faixas (pelo total dos 12 meses) e agrega o resto em "Outros" — sem
   * perder valor (continua reconciliando). Uma só leva de queries na janela.
   */
  async getInvestimentoEvolucaoDimensao(
    mes: number, ano: number,
    dimensao: 'centroCusto' | 'tipoProduto' | 'departamento',
    user?: JwtPayload, role?: string,
  ) {
    const windowInicio = new Date(ano, mes - 12, 1);
    const windowFim = new Date(ano, mes, 0, 23, 59, 59, 999);
    const deptoIds = getDeptoIdsDoUser(user, role);
    const parcelaDeptoWhere =
      deptoIds === null ? {} : { contrato: { departamentoId: { in: deptoIds } } };
    const nfDeptoWhere = applyDepartamentoFilter({}, user, role);

    const [parcelas, nfs] = await Promise.all([
      this.prisma.parcelaContrato.findMany({
        where: { status: 'PAGA', dataPagamento: { gte: windowInicio, lte: windowFim }, ...parcelaDeptoWhere },
        include: {
          contrato: {
            select: {
              departamentoId: true,
              departamento: { select: { nome: true } },
              produtoRef: { select: { tipoProduto: { select: { id: true, descricao: true } } } },
            },
          },
          rateioItens: { include: { centroCusto: { select: { id: true, codigo: true, nome: true } } } },
        },
      }),
      this.prisma.notaFiscal.findMany({
        where: { status: { not: 'CANCELADA' }, dataLancamento: { gte: windowInicio, lte: windowFim }, ...nfDeptoWhere },
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

    const cents = (n: number) => Math.round(n * 100) / 100;
    // índice de mês 0..11 (mais antigo → referência)
    const monthIndex = new Map<string, number>();
    const monthKeys: { ano: number; mes: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(ano, mes - 1 - i, 1);
      monthIndex.set(`${d.getFullYear()}-${d.getMonth() + 1}`, 11 - i);
      monthKeys.push({ ano: d.getFullYear(), mes: d.getMonth() + 1 });
    }
    const mkey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}`;

    const series = new Map<string, { label: string; total: number; porMes: number[] }>();
    const addS = (key: string, label: string, mi: number, valor: number) => {
      const cur = series.get(key) ?? { label, total: 0, porMes: new Array(12).fill(0) };
      cur.porMes[mi] += valor;
      cur.total += valor;
      series.set(key, cur);
    };

    for (const nf of nfs) {
      const mi = monthIndex.get(mkey(nf.dataLancamento));
      if (mi === undefined) continue;
      const v = Number(nf.valorTotal);
      if (dimensao === 'departamento') {
        addS(nf.departamento?.id ?? '__sd', nf.departamento?.nome ?? 'Sem departamento', mi, v);
        continue;
      }
      let somaItens = 0;
      for (const it of nf.itens) {
        const iv = Number(it.valorTotal);
        somaItens += iv;
        if (dimensao === 'centroCusto') {
          addS(it.centroCustoId, `${it.centroCusto.codigo} · ${it.centroCusto.nome}`, mi, iv);
        } else {
          const t = it.produto.tipoProduto;
          addS(t?.id ?? '__nc', t?.descricao ?? 'Não classificado', mi, iv);
        }
      }
      const resid = cents(v - somaItens);
      if (Math.abs(resid) >= 0.01) addS('__nf_resid', 'NFs — valor não detalhado em itens', mi, resid);
    }

    for (const p of parcelas) {
      if (!p.dataPagamento) continue;
      const mi = monthIndex.get(mkey(p.dataPagamento));
      if (mi === undefined) continue;
      const v = Number(p.valor);
      if (dimensao === 'departamento') {
        addS(p.contrato.departamentoId ?? '__sd', p.contrato.departamento?.nome ?? 'Sem departamento', mi, v);
      } else if (dimensao === 'tipoProduto') {
        const ctTipo = p.contrato.produtoRef?.tipoProduto;
        addS(ctTipo?.id ?? '__nc', ctTipo?.descricao ?? 'Não classificado', mi, v);
      } else if (p.rateioItens.length) {
        let somaR = 0;
        for (const ri of p.rateioItens) {
          const rv = Number(ri.valorCalculado);
          somaR += rv;
          addS(ri.centroCustoId, `${ri.centroCusto.codigo} · ${ri.centroCusto.nome}`, mi, rv);
        }
        const residR = cents(v - somaR);
        if (Math.abs(residR) >= 0.01) addS('__parc_resid', 'Contratos — rateio incompleto', mi, residR);
      } else {
        addS('__parc_norateio', 'Contratos — sem rateio de centro de custo', mi, v);
      }
    }

    // TOP 10 por total; o resto agrega em "Outros" (sem perder valor → reconcilia)
    const ordered = [...series.entries()].sort((a, b) => b[1].total - a[1].total);
    const TOP = 10;
    const top = ordered.slice(0, TOP);
    const rest = ordered.slice(TOP);
    const outros = new Array(12).fill(0);
    for (const [, v] of rest) for (let i = 0; i < 12; i++) outros[i] += v.porMes[i];

    const seriesOut = top.map(([key, v]) => ({ key, label: v.label }));
    const pontos = monthKeys.map((mk, i) => {
      const valores: Record<string, number> = {};
      for (const [key, v] of top) valores[key] = cents(v.porMes[i]);
      return { ano: mk.ano, mes: mk.mes, valores };
    });
    if (rest.length && outros.some((x) => Math.abs(x) >= 0.01)) {
      seriesOut.push({ key: '__outros', label: 'Outros' });
      pontos.forEach((p, i) => { p.valores['__outros'] = cents(outros[i]); });
    }

    return { dimensao, series: seriesOut, pontos };
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
          contrato: { select: { numero: true, titulo: true, departamentoId: true, produtoRef: { select: { tipoProdutoId: true } } } },
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
      for (const p of parcelas) {
        if ((p.contrato.produtoRef?.tipoProdutoId ?? '__nc') === chave) docs.push(parcDoc(p, Number(p.valor)));
      }
    } else {
      for (const nf of nfs) if ((nf.departamento?.id ?? '__sd') === chave) docs.push(nfDoc(nf, Number(nf.valorTotal)));
      for (const p of parcelas) if ((p.contrato.departamentoId ?? '__sd') === chave) docs.push(parcDoc(p, Number(p.valor)));
    }

    return docs.sort((a, b) => b.valor - a.valor);
  }

  /**
   * Escopo de WORKSPACE para os INDICADORES de chamado: PURO por departamento
   * (departamentoId ∈ deptos do workspace), null = ADMIN (todos). Diferente do
   * escopo OPERACIONAL do KPI (solicitante OU depto OU equipe-membro), que
   * traz chamados de OUTROS workspaces (ex.: que eu abri pro Fiscal) — errado
   * para um indicador "do workspace T.I.". Aqui o workspace é o recorte.
   */
  private chamadoWorkspaceWhere(user?: JwtPayload, role?: string): { departamentoId?: { in: string[] } } {
    const deptoIds = getDeptoIdsDoUser(user, role);
    return deptoIds === null ? {} : { departamentoId: { in: deptoIds } };
  }

  /**
   * Chamados ABERTOS no mês AGRUPADOS (Indicadores — Análise). Métrica = contagem.
   * Reconcilia com o total de abertos no período. Dimensões: setor (departamento),
   * prioridade, equipe.
   */
  async getChamadosAnalitico(mes: number, ano: number, user?: JwtPayload, role?: string) {
    const dataInicio = new Date(ano, mes - 1, 1);
    const dataFim = new Date(ano, mes, 0, 23, 59, 59, 999);
    const wsWhere = this.chamadoWorkspaceWhere(user, role);
    const chamados = await this.prisma.chamado.findMany({
      where: { createdAt: { gte: dataInicio, lte: dataFim }, ...wsWhere },
      select: {
        prioridade: true,
        equipeAtualId: true, equipeAtual: { select: { sigla: true, nome: true } },
        // SETOR = departamento do SOLICITANTE (cadastro de quem abriu), NÃO o
        // workspace-alvo do chamado (departamentoId). O workspace é só o escopo.
        solicitante: { select: { departamentoId: true } },
      },
    });
    // Nomes dos setores (departamento do solicitante) — lookup batched (Usuario
    // não tem relação `departamento` no schema; resolvo aqui, sem JOIN forçado).
    const setorIds = [...new Set(chamados.map((c) => c.solicitante?.departamentoId).filter((x): x is string => !!x))];
    const deptos = setorIds.length
      ? await this.prisma.departamento.findMany({ where: { id: { in: setorIds } }, select: { id: true, nome: true } })
      : [];
    const nomeSetor = new Map(deptos.map((d) => [d.id, d.nome]));

    type Bucket = Map<string, { label: string; valor: number; qtd: number }>;
    const add = (m: Bucket, key: string, label: string) => {
      const cur = m.get(key) ?? { label, valor: 0, qtd: 0 };
      cur.valor += 1; cur.qtd += 1; m.set(key, cur);
    };
    const arr = (m: Bucket) => [...m.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.valor - a.valor);
    const PRIO: Record<string, string> = { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta', CRITICA: 'Crítica' };

    const setor: Bucket = new Map();
    const prioridade: Bucket = new Map();
    const equipe: Bucket = new Map();
    for (const c of chamados) {
      const sid = c.solicitante?.departamentoId;
      // Consolida por NOME do setor — mesmo setor em filiais diferentes (ids
      // distintos) vira uma linha só. A chave/label é o próprio nome.
      const nome = (sid && nomeSetor.get(sid)) || 'Sem setor';
      add(setor, nome, nome);
      add(prioridade, c.prioridade, PRIO[c.prioridade] ?? c.prioridade);
      add(equipe, c.equipeAtualId ?? '__se', c.equipeAtual?.sigla || c.equipeAtual?.nome || 'Sem equipe');
    }

    return {
      periodo: { mes, ano },
      totalAbertos: chamados.length,
      porSetor: arr(setor),
      porPrioridade: arr(prioridade),
      porEquipe: arr(equipe),
    };
  }

  /** Drill: chamados de um grupo (setor/prioridade/equipe) abertos no mês. */
  async getChamadosDocumentos(
    mes: number, ano: number,
    dimensao: 'setor' | 'prioridade' | 'equipe', chave: string,
    user?: JwtPayload, role?: string,
  ) {
    const dataInicio = new Date(ano, mes - 1, 1);
    const dataFim = new Date(ano, mes, 0, 23, 59, 59, 999);
    const wsWhere = this.chamadoWorkspaceWhere(user, role);
    let campo: Prisma.ChamadoWhereInput;
    if (dimensao === 'prioridade') {
      campo = { prioridade: chave } as Prisma.ChamadoWhereInput;
    } else if (dimensao === 'equipe') {
      campo = { equipeAtualId: chave };
    } else {
      // setor = NOME do departamento do SOLICITANTE → resolve p/ todos os ids
      // com esse nome (consolidação multi-filial) e filtra pela relação.
      const deptos = await this.prisma.departamento.findMany({ where: { nome: chave }, select: { id: true } });
      campo = { solicitante: { departamentoId: { in: deptos.map((d) => d.id) } } };
    }

    const chamados = await this.prisma.chamado.findMany({
      where: { createdAt: { gte: dataInicio, lte: dataFim }, ...wsWhere, ...campo },
      select: {
        id: true, numero: true, titulo: true, status: true, prioridade: true, createdAt: true,
        solicitante: { select: { nome: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return chamados.map((c) => ({
      id: c.id, numero: c.numero, titulo: c.titulo, status: c.status,
      prioridade: c.prioridade, solicitante: c.solicitante?.nome ?? '—', data: c.createdAt,
    }));
  }

  // ───────── Operacionais (Análise): Licenças / Disponibilidade / Horas Dev ─────────
  // Shape genérico: { total, metrica, titulo, grupos[] }. Cada grupo reconcilia
  // com o total (sem baldes, pois aqui não há item-level a residualizar).

  /** Licenças ATIVAS agrupadas — contagem. Snapshot (independe do mês). Escopo workspace. */
  async getLicencasAnalitico(user?: JwtPayload, role?: string) {
    const where = applyDepartamentoFilter({ status: 'ATIVA' as const }, user, role);
    const lics = await this.prisma.softwareLicenca.findMany({
      where,
      select: {
        fornecedor: true,
        software: { select: { id: true, nome: true } },
        categoria: { select: { id: true, nome: true } },
        departamento: { select: { id: true, nome: true } },
      },
    });
    type B = Map<string, { label: string; valor: number; qtd: number }>;
    const add = (m: B, k: string, l: string) => { const c = m.get(k) ?? { label: l, valor: 0, qtd: 0 }; c.valor += 1; c.qtd += 1; m.set(k, c); };
    const arr = (m: B) => [...m.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.valor - a.valor);
    const forn: B = new Map(); const soft: B = new Map(); const cat: B = new Map();
    for (const l of lics) {
      add(forn, l.fornecedor?.trim() || '__sf', l.fornecedor?.trim() || 'Sem fornecedor');
      add(soft, l.software?.id ?? '__ss', l.software?.nome ?? 'Sem software');
      add(cat, l.categoria?.id ?? '__sc', l.categoria?.nome ?? 'Sem categoria');
    }
    return {
      total: lics.length, metrica: 'contagem' as const, titulo: 'Licenças ativas',
      grupos: [
        { dimensao: 'fornecedor', titulo: 'Por fornecedor', itens: arr(forn) },
        { dimensao: 'software', titulo: 'Por software', itens: arr(soft) },
        { dimensao: 'categoria', titulo: 'Por categoria', itens: arr(cat) },
      ],
    };
  }

  async getLicencasDocumentos(dimensao: 'fornecedor' | 'software' | 'categoria', chave: string, user?: JwtPayload, role?: string) {
    const base = applyDepartamentoFilter({ status: 'ATIVA' as const }, user, role) as Prisma.SoftwareLicencaWhereInput;
    const f: Prisma.SoftwareLicencaWhereInput =
      dimensao === 'fornecedor' ? (chave === '__sf' ? { fornecedor: null } : { fornecedor: chave })
      : dimensao === 'software' ? (chave === '__ss' ? { softwareId: null } : { softwareId: chave })
      : (chave === '__sc' ? { categoriaId: null } : { categoriaId: chave });
    const lics = await this.prisma.softwareLicenca.findMany({
      where: { ...base, ...f },
      select: {
        id: true, nome: true, fornecedor: true, dataVencimento: true,
        software: { select: { nome: true } }, departamento: { select: { nome: true } },
      },
      orderBy: { dataVencimento: 'asc' },
    });
    return lics.map((l) => ({
      id: l.id,
      principal: l.software?.nome || l.nome || 'Licença',
      secundario: l.fornecedor || '—',
      terciario: l.departamento?.nome ?? '',
      data: l.dataVencimento,
      valor: 0,
    }));
  }

  /** Horas de PARADA no mês agrupadas (todos os tipos). Escopo workspace. */
  async getDisponibilidadeAnalitico(mes: number, ano: number, user?: JwtPayload, role?: string) {
    const dataInicio = new Date(ano, mes - 1, 1);
    const dataFim = new Date(ano, mes, 0, 23, 59, 59, 999);
    const where = applyDepartamentoFilter(
      { inicio: { lte: dataFim }, OR: [{ fim: { gte: dataInicio } }, { fim: null }] },
      user, role,
    ) as Prisma.RegistroParadaWhereInput;
    const paradas = await this.prisma.registroParada.findMany({
      where,
      select: {
        id: true, tipo: true, inicio: true, fim: true,
        software: { select: { id: true, nome: true } },
        motivoParada: { select: { id: true, nome: true } },
      },
    });
    const TIPO: Record<string, string> = { PARADA_PROGRAMADA: 'Programada', PARADA_NAO_PROGRAMADA: 'Não programada', MANUTENCAO_PREVENTIVA: 'Manut. preventiva' };
    type B = Map<string, { label: string; valor: number; qtd: number }>;
    const add = (m: B, k: string, l: string, h: number) => { const c = m.get(k) ?? { label: l, valor: 0, qtd: 0 }; c.valor += h; c.qtd += 1; m.set(k, c); };
    const h1 = (n: number) => Math.round(n * 10) / 10;
    const arr = (m: B) => [...m.entries()].map(([id, v]) => ({ id, label: v.label, valor: h1(v.valor), qtd: v.qtd })).sort((a, b) => b.valor - a.valor);
    const soft: B = new Map(); const tipo: B = new Map(); const motivo: B = new Map();
    let total = 0;
    for (const p of paradas) {
      const ini = p.inicio < dataInicio ? dataInicio : p.inicio;
      const fim = p.fim ? (p.fim > dataFim ? dataFim : p.fim) : dataFim;
      const horas = Math.max(0, (fim.getTime() - ini.getTime()) / 3600000);
      total += horas;
      add(soft, p.software?.id ?? '__ss', p.software?.nome ?? 'Sem software', horas);
      add(tipo, p.tipo, TIPO[p.tipo] ?? p.tipo, horas);
      add(motivo, p.motivoParada?.id ?? '__sm', p.motivoParada?.nome ?? 'Sem motivo', horas);
    }
    return {
      total: h1(total), metrica: 'horas' as const, titulo: 'Horas de parada',
      grupos: [
        { dimensao: 'software', titulo: 'Por software', itens: arr(soft) },
        { dimensao: 'tipo', titulo: 'Por tipo de parada', itens: arr(tipo) },
        { dimensao: 'motivo', titulo: 'Por motivo', itens: arr(motivo) },
      ],
    };
  }

  async getDisponibilidadeDocumentos(mes: number, ano: number, dimensao: 'software' | 'tipo' | 'motivo', chave: string, user?: JwtPayload, role?: string) {
    const dataInicio = new Date(ano, mes - 1, 1);
    const dataFim = new Date(ano, mes, 0, 23, 59, 59, 999);
    const base = applyDepartamentoFilter(
      { inicio: { lte: dataFim }, OR: [{ fim: { gte: dataInicio } }, { fim: null }] },
      user, role,
    ) as Prisma.RegistroParadaWhereInput;
    const f: Prisma.RegistroParadaWhereInput =
      dimensao === 'software' ? { softwareId: chave }
      : dimensao === 'tipo' ? { tipo: chave as never }
      : (chave === '__sm' ? { motivoParadaId: null } : { motivoParadaId: chave });
    const paradas = await this.prisma.registroParada.findMany({
      where: { ...base, ...f },
      select: { id: true, tipo: true, inicio: true, fim: true, software: { select: { nome: true } }, motivoParada: { select: { nome: true } } },
      orderBy: { inicio: 'desc' },
    });
    return paradas.map((p) => {
      const ini = p.inicio < dataInicio ? dataInicio : p.inicio;
      const fim = p.fim ? (p.fim > dataFim ? dataFim : p.fim) : dataFim;
      return {
        id: p.id,
        principal: p.software?.nome ?? 'Sem software',
        secundario: p.motivoParada?.nome ?? '—',
        terciario: '',
        data: p.inicio,
        valor: Math.round(Math.max(0, (fim.getTime() - ini.getTime()) / 3600000) * 10) / 10,
      };
    });
  }

  /** Horas de DESENVOLVIMENTO INTERNO no mês agrupadas. Escopo workspace pelo
   *  departamento do PROJETO (honra "indicadores por workspace"). */
  async getHorasDevAnalitico(mes: number, ano: number, user?: JwtPayload, role?: string) {
    const dataInicio = new Date(ano, mes - 1, 1);
    const dataFim = new Date(ano, mes, 0, 23, 59, 59, 999);
    const tipoDesenv = await this.prisma.tipoProjetoConfig.findFirst({ where: { codigo: 'DESENVOLVIMENTO_INTERNO' }, select: { id: true } });
    if (!tipoDesenv) return { total: 0, metrica: 'horas' as const, titulo: 'Horas de desenvolvimento', grupos: [] };
    const deptoIds = getDeptoIdsDoUser(user, role);
    const projetoWhere = { tipoProjetoId: tipoDesenv.id, ...(deptoIds === null ? {} : { departamentoId: { in: deptoIds } }) };
    const regs = await this.prisma.registroTempo.findMany({
      where: { horaInicio: { gte: dataInicio, lte: dataFim }, duracaoMinutos: { not: null, gt: 0 }, atividade: { projeto: projetoWhere } },
      select: { duracaoMinutos: true, usuario: { select: { id: true, nome: true } }, atividade: { select: { projeto: { select: { id: true, numero: true, nome: true } } } } },
    });
    type B = Map<string, { label: string; valor: number; qtd: number }>;
    const add = (m: B, k: string, l: string, h: number) => { const c = m.get(k) ?? { label: l, valor: 0, qtd: 0 }; c.valor += h; c.qtd += 1; m.set(k, c); };
    const h1 = (n: number) => Math.round(n * 10) / 10;
    const arr = (m: B) => [...m.entries()].map(([id, v]) => ({ id, label: v.label, valor: h1(v.valor), qtd: v.qtd })).sort((a, b) => b.valor - a.valor);
    const proj: B = new Map(); const analista: B = new Map();
    let total = 0;
    for (const r of regs) {
      const h = (r.duracaoMinutos ?? 0) / 60;
      total += h;
      const p = r.atividade.projeto;
      add(proj, p.id, `#${p.numero} ${p.nome}`, h);
      add(analista, r.usuario.id, r.usuario.nome, h);
    }
    return {
      total: h1(total), metrica: 'horas' as const, titulo: 'Horas de desenvolvimento',
      grupos: [
        { dimensao: 'projeto', titulo: 'Por projeto', itens: arr(proj) },
        { dimensao: 'analista', titulo: 'Por analista', itens: arr(analista) },
      ],
    };
  }

  async getHorasDevDocumentos(mes: number, ano: number, dimensao: 'projeto' | 'analista', chave: string, user?: JwtPayload, role?: string) {
    const dataInicio = new Date(ano, mes - 1, 1);
    const dataFim = new Date(ano, mes, 0, 23, 59, 59, 999);
    const tipoDesenv = await this.prisma.tipoProjetoConfig.findFirst({ where: { codigo: 'DESENVOLVIMENTO_INTERNO' }, select: { id: true } });
    if (!tipoDesenv) return [];
    const deptoIds = getDeptoIdsDoUser(user, role);
    const projetoWhere = { tipoProjetoId: tipoDesenv.id, ...(deptoIds === null ? {} : { departamentoId: { in: deptoIds } }) };
    const f: Prisma.RegistroTempoWhereInput = dimensao === 'analista' ? { usuarioId: chave } : { atividade: { projetoId: chave } };
    const regs = await this.prisma.registroTempo.findMany({
      where: { horaInicio: { gte: dataInicio, lte: dataFim }, duracaoMinutos: { not: null, gt: 0 }, atividade: { projeto: projetoWhere }, ...f },
      select: { id: true, horaInicio: true, duracaoMinutos: true, usuario: { select: { nome: true } }, atividade: { select: { projeto: { select: { id: true, numero: true, nome: true } } } } },
      orderBy: { horaInicio: 'desc' },
    });
    return regs.map((r) => ({
      id: r.id,
      principal: dimensao === 'projeto' ? r.usuario.nome : `#${r.atividade.projeto.numero} ${r.atividade.projeto.nome}`,
      secundario: dimensao === 'projeto' ? `#${r.atividade.projeto.numero} ${r.atividade.projeto.nome}` : r.usuario.nome,
      terciario: '',
      data: r.horaInicio,
      valor: Math.round(((r.duracaoMinutos ?? 0) / 60) * 10) / 10,
      // link pro projeto de origem (Horas Dev é logada contra projeto, não chamado) —
      // resolve "não achei o projeto/chamado" no detalhe do indicador.
      projetoId: r.atividade.projeto.id,
    }));
  }

  private async getLicencas(user?: JwtPayload, role?: string) {
    const licSelect = {
      id: true, nome: true, modeloLicenca: true, quantidade: true, dataVencimento: true, status: true,
      software: { select: { id: true, nome: true } },
      categoria: { select: { id: true, nome: true } },
    };

    // Workspace — licenças e softwares filtram por depto-LANÇAMENTO (quem
    // lançou), igual às telas de Software/Licença (alocação livre, 05/06,
    // db2603f). Antes usava applyDepartamentoFilter (departamentoId = "onde é
    // usado", agora LIVRE) → o indicador divergia das telas p/ usuário escopado
    // por depto. Bypass por capability OVERSIGHT (não por role ADMIN).
    const licDeptoWhere = applyDepartamentoLancamentoFilterCadastroOpStaff({}, user ?? null);
    const swDeptoWhere = applyDepartamentoLancamentoFilterCadastroOpStaff({}, user ?? null);

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
