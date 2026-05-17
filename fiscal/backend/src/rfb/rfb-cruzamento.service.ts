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
            select: { cnpjCompleto: true, situacaoCadastral: true, uf: true, municipio: true },
          }),
          this.prisma.rfbEmpresa.findMany({
            where: { cnpjBasico: { in: cnpj8 } },
            select: { cnpjBasico: true, razaoSocial: true },
          }),
          this.prisma.rfbSimples.findMany({
            where: { cnpjBasico: { in: cnpj8 } },
            select: { cnpjBasico: true, optanteSimples: true },
          }),
        ]);
        const mE = new Map(estabs.map((e) => [e.cnpjCompleto, e]));
        const mR = new Map(emps.map((e) => [e.cnpjBasico, e.razaoSocial]));
        const mS = new Map(simps.map((s) => [s.cnpjBasico, s.optanteSimples]));

        const data = lote.map((r) => {
          const e = r.cnpj.length === 14 ? mE.get(r.cnpj) : undefined;
          const achado = !!e;
          const alerta = classificar(achado, e?.situacaoCadastral ?? null);
          cont[alerta as keyof typeof cont]++;
          return {
            cnpj: r.cnpj, origem: r.origem, filial: r.filial, codigo: r.codigo, loja: r.loja,
            razaoProtheus: r.razSoc, bloqueado: r.bloquead, achadoRfb: achado,
            situacaoRfb: e?.situacaoCadastral ?? null, razaoRfb: mR.get(r.cnpj.slice(0, 8)) ?? null,
            ufRfb: e?.uf ?? null, municipioRfb: e?.municipio ?? null,
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
    alerta?: string; origem?: string; uf?: string; search?: string;
    sort?: string; dir?: string; page?: number; pageSize?: number;
  }) {
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(200, Math.max(10, Number(q.pageSize) || 50));
    const where: Record<string, unknown> = {};
    if (q.alerta) where.alerta = q.alerta;
    if (q.origem) where.origem = q.origem;
    if (q.uf) where.ufRfb = q.uf;
    if (q.search) {
      const s = q.search.trim();
      const digitos = s.replace(/\D/g, '');
      // BUG corrigido: antes `{ cnpj: { contains: '' } }` (busca por nome →
      // sem dígitos) casava TODOS os registros, anulando o filtro. Só
      // inclui a cláusula de CNPJ quando há dígitos.
      const or: Record<string, unknown>[] = [
        { razaoProtheus: { contains: s, mode: 'insensitive' } },
        { razaoRfb: { contains: s, mode: 'insensitive' } },
        { codigo: { contains: s, mode: 'insensitive' } }, // matrícula Protheus
      ];
      if (digitos.length >= 2) or.push({ cnpj: { contains: digitos } });
      where.OR = or;
    }
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
}
