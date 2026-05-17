import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProtheusCadastroService } from '../protheus/protheus-cadastro.service.js';
import type { TipoCadastroProtheus } from '../protheus/interfaces/cadastro-fiscal.interface.js';

// F1.5 — Cruzamento massa SA1+SA2 (Protheus) × base RFB local. O payoff do
// "achado": SEM certificado, SEM SEFAZ — só JOIN local. Snapshot persistido
// (roda 1x → consulta N). Não consulta Protheus a cada page view.

const POR_PAGINA = 500;
const CHUNK = 1000;
const so = (s: string | null | undefined) => (s ? s.replace(/\D/g, '') : '');

/** Código situação_cadastral RFB → alerta. 02 ATIVA · 03 SUSPENSA ·
 *  04 INAPTA · 08 BAIXADA · 01 NULA. */
function classificar(achado: boolean, sit: string | null): string {
  if (!achado) return 'NAO_ENCONTRADO';
  const c = (sit || '').padStart(2, '0');
  if (c === '02') return 'OK';
  if (c === '04' || c === '08') return 'IRREGULAR';
  if (c === '03' || c === '01') return 'ATENCAO';
  return 'ATENCAO'; // código inesperado → revisar
}

interface Reg {
  cnpj: string; origem: TipoCadastroProtheus; filial?: string | null;
  codigo: string; loja: string; razSoc: string; bloquead: boolean;
}

@Injectable()
export class RfbCruzamentoService {
  private readonly logger = new Logger(RfbCruzamentoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly protheus: ProtheusCadastroService,
  ) {}

  async iniciar(userId: string) {
    const rodando = await this.prisma.rfbCruzamentoExec.findFirst({ where: { status: 'RODANDO' } });
    if (rodando) throw new ConflictException('Cruzamento já em andamento');
    const exec = await this.prisma.rfbCruzamentoExec.create({
      data: { status: 'RODANDO', disparadoPor: userId },
    });
    this.executar(exec.id).catch((e) => this.logger.error(`Cruzamento falhou: ${e?.message}`));
    return { iniciado: true, execId: exec.id };
  }

  private async coletarProtheus(tipo: TipoCadastroProtheus): Promise<Reg[]> {
    const out: Reg[] = [];
    let pagina = 1;
    for (;;) {
      const r = await this.protheus.listar({ tipo, ativo: true, pagina, porPagina: POR_PAGINA });
      const itens = r.itens || [];
      for (const i of itens) {
        out.push({
          cnpj: so(i.cnpj), origem: tipo, filial: i.filial ?? null,
          codigo: i.codigo, loja: i.loja, razSoc: i.razSoc, bloquead: !!i.bloquead,
        });
      }
      const totalPag = r.paginacao?.totalPaginas ?? 1;
      if (itens.length === 0 || pagina >= totalPag || pagina >= 10000) break;
      pagina++;
    }
    return out;
  }

  private async executar(execId: number) {
    const t0 = Date.now();
    const cont = { IRREGULAR: 0, ATENCAO: 0, OK: 0, NAO_ENCONTRADO: 0 };
    try {
      const regs = [
        ...(await this.coletarProtheus('SA1010')),
        ...(await this.coletarProtheus('SA2010')),
      ];

      await this.prisma.$executeRawUnsafe('TRUNCATE rfb.cruzamento_resultado');

      for (let i = 0; i < regs.length; i += CHUNK) {
        const lote = regs.slice(i, i + CHUNK);
        const cnpj14 = [...new Set(lote.map((r) => r.cnpj).filter((c) => c.length === 14))];
        const cnpj8 = [...new Set(cnpj14.map((c) => c.slice(0, 8)))];

        const [estabs, emps, simps] = await Promise.all([
          this.prisma.rfbEstabelecimento.findMany({
            where: { cnpjCompleto: { in: cnpj14 } },
            select: { cnpjCompleto: true, situacaoCadastral: true, dataSituacao: true, uf: true, municipio: true, cnaePrincipal: true },
          }),
          this.prisma.rfbEmpresa.findMany({
            where: { cnpjBasico: { in: cnpj8 } },
            select: { cnpjBasico: true, razaoSocial: true, porte: true },
          }),
          this.prisma.rfbSimples.findMany({
            where: { cnpjBasico: { in: cnpj8 } },
            select: { cnpjBasico: true, optanteSimples: true },
          }),
        ]);
        const mE = new Map(estabs.map((e) => [e.cnpjCompleto, e]));
        const mR = new Map(emps.map((e) => [e.cnpjBasico, e]));
        const mS = new Map(simps.map((s) => [s.cnpjBasico, s.optanteSimples]));

        const data = lote.map((r) => {
          const e = r.cnpj.length === 14 ? mE.get(r.cnpj) : undefined;
          const achado = !!e;
          const alerta = classificar(achado, e?.situacaoCadastral ?? null);
          cont[alerta as keyof typeof cont]++;
          return {
            cnpj: r.cnpj, origem: r.origem, filial: r.filial, codigo: r.codigo, loja: r.loja,
            razaoProtheus: r.razSoc, bloqueado: r.bloquead, achadoRfb: achado,
            situacaoRfb: e?.situacaoCadastral ?? null,
            dataSituacao: e?.dataSituacao ?? null,
            razaoRfb: mR.get(r.cnpj.slice(0, 8))?.razaoSocial ?? null,
            ufRfb: e?.uf ?? null, municipioRfb: e?.municipio ?? null,
            cnae: e?.cnaePrincipal ?? null,
            porte: mR.get(r.cnpj.slice(0, 8))?.porte ?? null,
            optanteSimples: mS.get(r.cnpj.slice(0, 8)) ?? null, alerta,
          };
        });
        if (data.length) await this.prisma.rfbCruzamentoResultado.createMany({ data });
      }

      await this.prisma.rfbCruzamentoExec.update({
        where: { id: execId },
        data: {
          status: 'CONCLUIDO', fim: new Date(), total: regs.length,
          alertaIrregular: cont.IRREGULAR, alertaAtencao: cont.ATENCAO,
          alertaOk: cont.OK, naoEncontrado: cont.NAO_ENCONTRADO,
          observacao: `OK (${((Date.now() - t0) / 60000).toFixed(1)} min)`,
        },
      });
      this.logger.log(`Cruzamento RFB CONCLUIDO — ${regs.length} vínculos, ${cont.IRREGULAR} irregulares`);
    } catch (e: any) {
      await this.prisma.rfbCruzamentoExec.update({
        where: { id: execId },
        data: { status: 'ERRO', fim: new Date(), observacao: String(e?.message || e).slice(0, 800) },
      }).catch(() => undefined);
      throw e;
    }
  }

  /** Consulta paginada/filtrada do snapshot + resumo da última execução. */
  async consultar(q: {
    alerta?: string; origem?: string; uf?: string; situacao?: string; porte?: string; simples?: string;
    soRecente?: string; search?: string; sort?: string; dir?: string; page?: number; pageSize?: number;
  }) {
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(200, Math.max(10, Number(q.pageSize) || 50));
    const where = this.montarWhere(q);
    // Ordenação por clique no cabeçalho — whitelist (evita injeção de coluna).
    const SORTABLE: Record<string, string> = {
      cnpj: 'cnpj', origem: 'origem', razaoProtheus: 'razaoProtheus',
      razaoRfb: 'razaoRfb', situacaoRfb: 'situacaoRfb', ufRfb: 'ufRfb', alerta: 'alerta',
    };
    const col = q.sort && SORTABLE[q.sort];
    const dir = q.dir === 'desc' ? 'desc' : 'asc';
    const orderBy = col
      ? [{ [col]: dir }, { id: 'asc' as const }]
      : [{ alerta: 'asc' as const }, { id: 'asc' as const }];

    const [itens, total, ultimas] = await Promise.all([
      this.prisma.rfbCruzamentoResultado.findMany({
        where, orderBy,
        skip: (page - 1) * pageSize, take: pageSize,
      }),
      this.prisma.rfbCruzamentoResultado.count({ where }),
      this.prisma.rfbCruzamentoExec.findMany({ orderBy: { id: 'desc' }, take: 5 }),
    ]);
    return { itens, total, page, pageSize, execucoes: ultimas };
  }

  /** "Situação recente" SEM histórico: usa rfb.data_situacao (AAAAMMDD) vs
   *  hoje-N dias. Comparação lexicográfica de YYYYMMDD = cronológica. */
  private cutoffRecente(dias = 90): string {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    return d.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  }

  /** Where compartilhado entre consultar/facetas/export (filtros idênticos). */
  private montarWhere(q: { alerta?: string; origem?: string; uf?: string; situacao?: string; porte?: string; simples?: string; soRecente?: string; search?: string }): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    if (q.alerta) where.alerta = q.alerta;
    if (q.origem) where.origem = q.origem;
    if (q.uf) where.ufRfb = q.uf;
    if (q.situacao) where.situacaoRfb = q.situacao;
    if (q.porte) where.porte = q.porte;
    if (q.simples) where.optanteSimples = q.simples;
    if (q.soRecente === '1' || q.soRecente === 'true') {
      // data_situacao >= hoje-90d (exclui null automaticamente no Prisma).
      where.dataSituacao = { gte: this.cutoffRecente(90) };
    }
    if (q.search) {
      const s = q.search.trim();
      const digitos = s.replace(/\D/g, '');
      const or: Record<string, unknown>[] = [
        { razaoProtheus: { contains: s, mode: 'insensitive' } },
        { razaoRfb: { contains: s, mode: 'insensitive' } },
        { codigo: { contains: s, mode: 'insensitive' } },
      ];
      if (digitos.length >= 2) or.push({ cnpj: { contains: digitos } });
      where.OR = or;
    }
    return where;
  }

  /** Facetas agregadas (counts por dimensão) respeitando os filtros atuais —
   *  base da exploração "Inteligência Cadastral" (F3). */
  async facetas(q: { alerta?: string; origem?: string; uf?: string; situacao?: string; porte?: string; simples?: string; soRecente?: string; search?: string }) {
    const where = this.montarWhere(q);
    // groupBy explícito por campo (Prisma tipa pelo literal `by`); ordena/
    // limita em JS — evita o inferno de tipos do groupBy dinâmico.
    const norm = (rows: Array<{ _count: { _all: number } } & Record<string, unknown>>, campo: string, top?: number) => {
      const arr = rows
        .map((r) => ({ valor: (r[campo] as string | null) ?? '(vazio)', total: r._count._all }))
        .sort((a, b) => b.total - a.total);
      return top ? arr.slice(0, top) : arr;
    };
    const [gA, gO, gS, gU, gP, gM, gC, total] = await Promise.all([
      this.prisma.rfbCruzamentoResultado.groupBy({ by: ['alerta'], where, _count: { _all: true } }),
      this.prisma.rfbCruzamentoResultado.groupBy({ by: ['origem'], where, _count: { _all: true } }),
      this.prisma.rfbCruzamentoResultado.groupBy({ by: ['situacaoRfb'], where, _count: { _all: true } }),
      this.prisma.rfbCruzamentoResultado.groupBy({ by: ['ufRfb'], where, _count: { _all: true } }),
      this.prisma.rfbCruzamentoResultado.groupBy({ by: ['porte'], where, _count: { _all: true } }),
      this.prisma.rfbCruzamentoResultado.groupBy({ by: ['optanteSimples'], where, _count: { _all: true } }),
      this.prisma.rfbCruzamentoResultado.groupBy({ by: ['cnae'], where, _count: { _all: true } }),
      this.prisma.rfbCruzamentoResultado.count({ where }),
    ]);
    return {
      total,
      alerta: norm(gA, 'alerta'),
      origem: norm(gO, 'origem'),
      situacao: norm(gS, 'situacaoRfb'),
      uf: norm(gU, 'ufRfb', 15),
      porte: norm(gP, 'porte'),
      simples: norm(gM, 'optanteSimples'),
      cnaeTop: norm(gC, 'cnae', 15),
    };
  }

  /** Export CSV do snapshot filtrado (sem paginação). Snapshot é limitado
   *  (clientes/fornecedores), cabe em memória. */
  async exportarCsv(q: { alerta?: string; origem?: string; uf?: string; situacao?: string; porte?: string; simples?: string; soRecente?: string; search?: string }): Promise<string> {
    const where = this.montarWhere(q);
    const rows = await this.prisma.rfbCruzamentoResultado.findMany({
      where, orderBy: [{ alerta: 'asc' }, { id: 'asc' }], take: 100000,
    });
    const head = [
      'cnpj', 'origem', 'codigo', 'loja', 'razao_protheus', 'razao_rfb',
      'situacao_rfb', 'data_situacao', 'uf_rfb', 'municipio_rfb', 'cnae', 'porte',
      'optante_simples', 'bloqueado', 'achado_rfb', 'alerta',
    ];
    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const linhas = rows.map((r) => [
      r.cnpj, r.origem, r.codigo, r.loja, r.razaoProtheus, r.razaoRfb,
      r.situacaoRfb, r.dataSituacao, r.ufRfb, r.municipioRfb, r.cnae, r.porte,
      r.optanteSimples, r.bloqueado, r.achadoRfb, r.alerta,
    ].map(esc).join(';'));
    return [head.join(';'), ...linhas].join('\n');
  }
}
