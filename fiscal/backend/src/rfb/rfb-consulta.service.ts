import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ReceitaFederalData } from '../cadastro/receita.client.js';

// F2.1 — Consulta pontual por CNPJ na base RFB LOCAL. Mesma forma de dados
// da Receita Federal online (ReceitaFederalData), mas instantânea, sem
// rate-limit e zero risco SEFAZ. É a FONTE PRIMÁRIA da Consulta Cadastral;
// o online (BrasilAPI/ReceitaWS) vira fallback quando o CNPJ não está na
// base local (aberto após o último snapshot ou base ainda não importada).
//
// Limitações conscientes do subconjunto essencial importado (F1.1):
// cnaesSecundarios/dataAbertura/motivoSituacao não são guardados → null
// (o fallback online cobre quando há miss). O essencial (situação, razão,
// endereço, porte, CNAE principal) está completo.

const SITUACAO: Record<string, string> = {
  '01': 'NULA', '02': 'ATIVA', '03': 'SUSPENSA', '04': 'INAPTA', '08': 'BAIXADA',
};
const PORTE: Record<string, string> = {
  '01': 'MICRO EMPRESA', '03': 'EMPRESA DE PEQUENO PORTE',
};

export interface SocioLocal {
  tipo: string; // PF | PJ | Estrangeiro
  nome: string | null;
  documento: string | null;
  qualificacao: string | null;
  dataEntrada: string | null;
  pais: string | null;
  faixaEtaria: string | null;
  representante: string | null;
}
/** Campos analíticos F1.9 (Camada 2+3) anexados ao ReceitaFederalData. */
export type ReceitaLocalExtra = {
  versaoRfb?: string;
  situacaoEspecial?: string | null;
  dataSituacaoEspecial?: string | null;
  qualificacaoResponsavel?: string | null;
  enteFederativo?: string | null;
  paisEstab?: string | null;
  socios?: SocioLocal[];
};

@Injectable()
export class RfbConsultaService {
  constructor(private readonly prisma: PrismaService) {}

  async porCnpj(cnpj: string): Promise<(ReceitaFederalData & ReceitaLocalExtra) | null> {
    const c = (cnpj || '').replace(/\D/g, '');
    if (c.length !== 14) return null; // base RFB é só CNPJ (não CPF)

    const estab = await this.prisma.rfbEstabelecimento.findUnique({ where: { cnpjCompleto: c } });
    if (!estab) return null; // não está na base local → caller faz fallback online

    const basico = c.slice(0, 8);
    const [emp, mun, cnae, ultimo] = await Promise.all([
      this.prisma.rfbEmpresa.findUnique({ where: { cnpjBasico: basico } }),
      estab.municipio
        ? this.prisma.rfbMunicipio.findUnique({ where: { codigo: estab.municipio } })
        : Promise.resolve(null),
      estab.cnaePrincipal
        ? this.prisma.rfbCnae.findUnique({ where: { codigo: estab.cnaePrincipal } })
        : Promise.resolve(null),
      this.prisma.rfbControleImportacao.findFirst({
        where: { status: 'CONCLUIDO' }, orderBy: { versaoRfb: 'desc' },
      }),
    ]);

    // Resolve a descrição da natureza jurídica (temos o domínio importado —
    // antes mostrava só o código cru, ex. "2062"). Não dá p/ ir no Promise.all
    // acima porque depende de `emp`; consulta pontual, custo desprezível.
    const nat = emp?.naturezaJuridica
      ? await this.prisma.rfbNatureza.findUnique({ where: { codigo: emp.naturezaJuridica } })
      : null;

    // F1.9 — enriquecimento analítico (Camada 2 campos + Camada 3 QSA).
    const secCodes = (estab.cnaeSecundaria || '')
      .split(',').map((x) => x.trim()).filter(Boolean).slice(0, 30);
    const socsRaw = await this.prisma.$queryRaw<Array<{
      identificador_socio: string | null; nome_socio: string | null;
      cnpj_cpf_socio: string | null; qualificacao_socio: string | null;
      data_entrada: string | null; pais: string | null;
      repr_legal_nome: string | null; faixa_etaria: string | null;
    }>>`SELECT identificador_socio, nome_socio, cnpj_cpf_socio, qualificacao_socio,
          data_entrada, pais, repr_legal_nome, faixa_etaria
        FROM rfb.socios WHERE cnpj_basico = ${basico}
        ORDER BY nome_socio LIMIT 50`;

    const qCodes = [...new Set(socsRaw.map((s) => s.qualificacao_socio).filter((x): x is string => !!x))];
    if (emp?.qualificacaoResponsavel) qCodes.push(emp.qualificacaoResponsavel);
    const pCodes = [...new Set(
      [estab.pais, ...socsRaw.map((s) => s.pais)].filter((x): x is string => !!x),
    )];
    const [motivo, secCnaes, quals, paises] = await Promise.all([
      estab.motivoSituacao
        ? this.prisma.rfbMotivo.findUnique({ where: { codigo: estab.motivoSituacao } })
        : Promise.resolve(null),
      secCodes.length
        ? this.prisma.rfbCnae.findMany({ where: { codigo: { in: secCodes } } })
        : Promise.resolve([] as { codigo: string; descricao: string | null }[]),
      qCodes.length
        ? this.prisma.rfbQualificacao.findMany({ where: { codigo: { in: qCodes } } })
        : Promise.resolve([] as { codigo: string; descricao: string | null }[]),
      pCodes.length
        ? this.prisma.rfbPais.findMany({ where: { codigo: { in: pCodes } } })
        : Promise.resolve([] as { codigo: string; descricao: string | null }[]),
    ]);
    const qMap = new Map(quals.map((q) => [q.codigo, q.descricao]));
    const pMap = new Map(paises.map((p) => [p.codigo, p.descricao]));
    const cMap = new Map(secCnaes.map((x) => [x.codigo, x.descricao]));
    const comDesc = (cod: string | null | undefined, m: Map<string, string | null>) =>
      cod ? `${cod}${m.get(cod) ? ' — ' + m.get(cod) : ''}` : null;
    const socios: SocioLocal[] = socsRaw.map((s) => ({
      tipo: s.identificador_socio === '1' ? 'PJ' : s.identificador_socio === '3' ? 'Estrangeiro' : 'PF',
      nome: s.nome_socio ?? null,
      documento: s.cnpj_cpf_socio ?? null,
      qualificacao: comDesc(s.qualificacao_socio, qMap),
      dataEntrada: s.data_entrada ?? null,
      pais: s.pais ? (pMap.get(s.pais) ?? s.pais) : null,
      faixaEtaria: s.faixa_etaria ?? null,
      representante: s.repr_legal_nome || null,
    }));

    const sit = (estab.situacaoCadastral || '').padStart(2, '0');
    const tel = estab.ddd1 && estab.telefone1 ? `(${estab.ddd1}) ${estab.telefone1}` : null;

    return {
      cnpj: c,
      razaoSocial: emp?.razaoSocial ?? null,
      nomeFantasia: estab.nomeFantasia ?? null,
      situacao: SITUACAO[sit] ?? null,
      dataSituacao: estab.dataSituacao ?? null,
      motivoSituacao: estab.motivoSituacao
        ? `${estab.motivoSituacao}${motivo?.descricao ? ' — ' + motivo.descricao : ''}`
        : null,
      naturezaJuridica: emp?.naturezaJuridica
        ? `${emp.naturezaJuridica}${nat?.descricao ? ' — ' + nat.descricao : ''}`
        : null,
      porte: emp?.porte ? (PORTE[emp.porte] ?? 'DEMAIS') : null,
      capitalSocial: emp?.capitalSocial != null ? Number(emp.capitalSocial) : null,
      cnaeFiscal: estab.cnaePrincipal ?? null,
      cnaeFiscalDescricao: cnae?.descricao ?? null,
      cnaesSecundarios: secCodes.map((cod) => ({ codigo: cod, descricao: cMap.get(cod) ?? '' })),
      dataAbertura: estab.dataInicioAtividade ?? null,
      endereco: {
        logradouro: estab.logradouro ?? null,
        numero: estab.numero ?? null,
        complemento: null,
        bairro: estab.bairro ?? null,
        municipio: mun?.descricao ?? estab.municipio ?? null,
        uf: estab.uf ?? null,
        cep: estab.cep ?? null,
      },
      telefone: tel,
      email: estab.correioEletronico ?? null,
      fonte: 'RFB_LOCAL',
      consultadoEm: new Date().toISOString(),
      situacaoEspecial: estab.situacaoEspecial ?? null,
      dataSituacaoEspecial: estab.dataSituacaoEspecial ?? null,
      qualificacaoResponsavel: comDesc(emp?.qualificacaoResponsavel, qMap),
      enteFederativo: emp?.enteFederativo ?? null,
      paisEstab: estab.pais ? (pMap.get(estab.pais) ?? estab.pais) : null,
      socios,
      versaoRfb: ultimo?.versaoRfb,
    };
  }

  /** Metadados da base local p/ a UI deixar claro a origem/idade do dado
   *  (foto mensal — pode estar desatualizada vs SEFAZ ao vivo). */
  async infoBase(): Promise<{ versaoRfb: string | null; importadaEm: Date | null }> {
    const u = await this.prisma.rfbControleImportacao.findFirst({
      where: { status: 'CONCLUIDO' },
      orderBy: { versaoRfb: 'desc' },
      select: { versaoRfb: true, dataFim: true },
    });
    return { versaoRfb: u?.versaoRfb ?? null, importadaEm: u?.dataFim ?? null };
  }

  /**
   * Busca reversa: nome do sócio → empresas vinculadas (base RFB local,
   * dado público Dados Abertos). Min 3 chars (exigência do índice GIN
   * trgm — trigramas). Paginação por hasMore (pega pageSize+1) em vez de
   * COUNT — evita scan caro em 27M p/ nomes comuns. ILIKE %termo% usa o
   * índice socios_nome_trgm_idx. Join empresas (razão) + estab matriz
   * (situação/UF/município) + resolve qualificação.
   */
  async buscarPorSocio(nome: string, page = 1, pageSize = 30) {
    const termo = (nome || '').trim();
    const ps = Math.min(50, Math.max(10, Number(pageSize) || 30));
    const pg = Math.max(1, Number(page) || 1);
    if (termo.length < 3) {
      return { itens: [], page: 1, pageSize: ps, hasMore: false, termoCurto: true };
    }
    const rows = await this.prisma.$queryRaw<Array<{
      cnpj_basico: string; nome_socio: string | null; identificador_socio: string | null;
      qualificacao_socio: string | null; data_entrada: string | null; faixa_etaria: string | null;
      razao_social: string | null; cnpj_completo: string | null;
      situacao_cadastral: string | null; uf: string | null; municipio: string | null;
    }>>`
      SELECT s.cnpj_basico, s.nome_socio, s.identificador_socio, s.qualificacao_socio,
             s.data_entrada, s.faixa_etaria, e.razao_social,
             est.cnpj_completo, est.situacao_cadastral, est.uf,
             COALESCE(m.descricao, est.municipio) AS municipio
      FROM rfb.socios s
      JOIN rfb.empresas e ON e.cnpj_basico = s.cnpj_basico
      LEFT JOIN LATERAL (
        SELECT cnpj_completo, situacao_cadastral, uf, municipio
        FROM rfb.estabelecimentos
        WHERE cnpj_basico = s.cnpj_basico AND matriz_filial = '1'
        LIMIT 1
      ) est ON true
      LEFT JOIN rfb.municipios m ON m.codigo = est.municipio
      WHERE s.nome_socio ILIKE '%' || ${termo} || '%'
      ORDER BY s.nome_socio, e.razao_social
      LIMIT ${ps + 1} OFFSET ${(pg - 1) * ps}
    `;
    const hasMore = rows.length > ps;
    const slice = rows.slice(0, ps);
    const qCodes = [...new Set(slice.map((r) => r.qualificacao_socio).filter((x): x is string => !!x))];
    const quals = qCodes.length
      ? await this.prisma.rfbQualificacao.findMany({ where: { codigo: { in: qCodes } } })
      : [];
    const qMap = new Map(quals.map((q) => [q.codigo, q.descricao]));
    const itens = slice.map((r) => ({
      cnpjBasico: r.cnpj_basico,
      cnpjCompleto: r.cnpj_completo ?? null,
      razaoSocial: r.razao_social ?? null,
      situacao: r.situacao_cadastral
        ? (SITUACAO[r.situacao_cadastral.padStart(2, '0')] ?? r.situacao_cadastral)
        : null,
      uf: r.uf ?? null,
      municipio: r.municipio ?? null,
      socioNome: r.nome_socio ?? null,
      socioTipo: r.identificador_socio === '1' ? 'PJ'
        : r.identificador_socio === '3' ? 'Estrangeiro' : 'PF',
      qualificacao: r.qualificacao_socio
        ? `${r.qualificacao_socio}${qMap.get(r.qualificacao_socio) ? ' — ' + qMap.get(r.qualificacao_socio) : ''}`
        : null,
      dataEntrada: r.data_entrada ?? null,
      faixaEtaria: r.faixa_etaria ?? null,
    }));
    return { itens, page: pg, pageSize: ps, hasMore, termoCurto: false };
  }

  /**
   * Gap A — explorador da base RFB (universo de empresas, NÃO só as do
   * Protheus). Filtros: razão (trgm), UF, situação, CNAE (prefixo), porte
   * + toggle `semProtheus` (NOT EXISTS no snapshot do cruzamento) p/
   * prospecção / validar antes de cadastrar. Anchor = matriz (1 linha
   * por empresa). Exige ≥1 filtro relevante (razão≥3 OU uf OU cnae) p/
   * não varrer 71M. Paginação por hasMore (sem COUNT). $queryRawUnsafe
   * com params posicionais ($N) — parametrizado (sem injeção).
   */
  async buscarEmpresas(q: {
    razao?: string; uf?: string; situacao?: string; cnae?: string;
    porte?: string; semProtheus?: boolean; page?: number; pageSize?: number;
  }) {
    const razao = (q.razao ?? '').trim();
    const uf = (q.uf ?? '').trim().toUpperCase();
    const cnae = (q.cnae ?? '').replace(/\D/g, '');
    const ps = Math.min(50, Math.max(10, Number(q.pageSize) || 30));
    const pg = Math.max(1, Number(q.page) || 1);
    const temFiltro = razao.length >= 3 || !!uf || !!cnae;
    if (!temFiltro) {
      return { itens: [], page: 1, pageSize: ps, hasMore: false, semFiltro: true };
    }
    const cond: string[] = [`est.matriz_filial = '1'`];
    const params: unknown[] = [];
    const add = (frag: string, val: unknown) => { params.push(val); cond.push(frag.replace('?', `$${params.length}`)); };
    if (razao.length >= 3) add(`e.razao_social ILIKE '%' || ? || '%'`, razao);
    if (uf) add(`est.uf = ?`, uf);
    if (q.situacao) add(`est.situacao_cadastral = ?`, q.situacao);
    if (cnae) add(`est.cnae_principal LIKE ? || '%'`, cnae);
    if (q.porte) add(`e.porte = ?`, q.porte);
    if (q.semProtheus) cond.push(`NOT EXISTS (SELECT 1 FROM rfb.cruzamento_resultado c WHERE c.cnpj = est.cnpj_completo)`);
    params.push(ps + 1, (pg - 1) * ps);
    const sql = `
      SELECT est.cnpj_completo, est.situacao_cadastral, est.uf, est.cnae_principal,
             est.data_situacao, e.razao_social, e.porte,
             COALESCE(m.descricao, est.municipio) AS municipio,
             cn.descricao AS cnae_desc,
             EXISTS (SELECT 1 FROM rfb.cruzamento_resultado c WHERE c.cnpj = est.cnpj_completo) AS no_protheus
      FROM rfb.estabelecimentos est
      JOIN rfb.empresas e ON e.cnpj_basico = est.cnpj_basico
      LEFT JOIN rfb.municipios m ON m.codigo = est.municipio
      LEFT JOIN rfb.cnaes cn ON cn.codigo = est.cnae_principal
      WHERE ${cond.join(' AND ')}
      ORDER BY e.razao_social
      LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const rows = await this.prisma.$queryRawUnsafe<Array<{
      cnpj_completo: string; situacao_cadastral: string | null; uf: string | null;
      cnae_principal: string | null; data_situacao: string | null;
      razao_social: string | null; porte: string | null; municipio: string | null;
      cnae_desc: string | null; no_protheus: boolean;
    }>>(sql, ...params);
    const hasMore = rows.length > ps;
    const itens = rows.slice(0, ps).map((r) => ({
      cnpjCompleto: r.cnpj_completo,
      razaoSocial: r.razao_social ?? null,
      situacao: r.situacao_cadastral
        ? (SITUACAO[r.situacao_cadastral.padStart(2, '0')] ?? r.situacao_cadastral) : null,
      uf: r.uf ?? null,
      municipio: r.municipio ?? null,
      cnae: r.cnae_principal
        ? `${r.cnae_principal}${r.cnae_desc ? ' — ' + r.cnae_desc : ''}` : null,
      porte: r.porte ? (PORTE[r.porte] ?? 'DEMAIS') : null,
      dataSituacao: r.data_situacao ?? null,
      emProtheus: r.no_protheus, // true = JÁ é cliente/fornecedor da CAPUL
    }));
    return { itens, page: pg, pageSize: ps, hasMore, semFiltro: false };
  }
}
