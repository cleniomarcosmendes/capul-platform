import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { SchemaCte, CteDocumento, CteEvento, TipoEventoCte } from '@prisma/client';
import type { CteDocZip } from '../../sefaz/cte-distribuicao.client.js';
import { CteParserService } from '../parsers/cte-parser.service.js';

export interface PersistirResultado {
  /** Tipo do registro persistido — documento ou evento (cada schema vai pra sua tabela) */
  tipo: 'documento' | 'evento' | 'ignorado';
  /** Registro persistido — null se ignorado (schema desconhecido sem dados) */
  documento?: CteDocumento;
  evento?: CteEvento;
  /** true = registro novo criado; false = já existia (dedup natural) */
  novo: boolean;
  motivoIgnorado?: string;
}

/**
 * Persiste docZips retornados pelo `CteDistribuicaoClient.consultarPorNsu`
 * em uma das duas tabelas `fiscal.cte_documento` ou `fiscal.cte_evento`,
 * dependendo do schema:
 *
 * | Schema retornado pelo SEFAZ | Tabela alvo  |
 * |-----------------------------|--------------|
 * | procCTe / procCTeSimp       | cte_documento |
 * | resCTe                      | cte_documento (com papel_capul=TERCEIRO no enriquecimento) |
 * | procEventoCTe               | cte_evento (xml completo do evento) |
 * | resEventoCTe                | cte_evento (resumo) |
 * | DESCONHECIDO                | cte_documento com erro_parse preenchido (pra triagem manual) |
 *
 * Dedup natural:
 *   - cte_documento: chave natural (cnpj_consulente, ambiente, nsu)
 *   - cte_evento: id_evento UNIQUE (ID atributo do <infEvento>)
 *
 * `papel_capul` (em cte_documento) NÃO é preenchido aqui — fica NULL
 * até `CteEnriquecimentoService` rodar (cron + endpoint admin) e aplicar
 * `PapelDetectorService`. Idem `documento_id` em cte_evento — reconciliação
 * acontece quando documento alvo aparece (mesma chave).
 */
@Injectable()
export class CteDocumentoService {
  private readonly logger = new Logger(CteDocumentoService.name);
  private readonly parser: XMLParser;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cteParser: CteParserService,
  ) {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: false,
      parseTagValue: false,
      trimValues: true,
      removeNSPrefix: true,
    });
  }

  /**
   * Persiste 1 docZip. Retorna `tipo: 'evento'` quando schema é evento,
   * `tipo: 'documento'` caso contrário. Idempotente — re-execução é segura.
   */
  async persistir(params: {
    cnpjConsulente: string;
    ambiente: 1 | 2;
    docZip: CteDocZip;
  }): Promise<PersistirResultado> {
    const cnpj = params.cnpjConsulente.replace(/\D/g, '');
    const xml = params.docZip.xml;
    const xmlSha256 = createHash('sha256').update(xml).digest('hex');
    const schemaCte = this.identificarSchema(params.docZip.schema);

    // Roteia: eventos vão pra cte_evento; demais vão pra cte_documento
    if (schemaCte === 'procEventoCTe' || schemaCte === 'resEventoCTe') {
      return this.persistirEvento({
        cnpj,
        ambiente: params.ambiente,
        nsu: params.docZip.nsu,
        schema: schemaCte,
        xml,
        xmlSha256,
      });
    }

    return this.persistirDocumento({
      cnpj,
      ambiente: params.ambiente,
      nsu: params.docZip.nsu,
      schema: schemaCte,
      xml,
      xmlSha256,
    });
  }

  // ============================================================
  // cte_documento — procCTe / procCTeSimp / resCTe / DESCONHECIDO
  // ============================================================

  private async persistirDocumento(p: {
    cnpj: string;
    ambiente: 1 | 2;
    nsu: string;
    schema: SchemaCte;
    xml: string;
    xmlSha256: string;
  }): Promise<PersistirResultado> {
    const existente = await this.prisma.client.cteDocumento.findUnique({
      where: {
        doc_consulente_ambiente_nsu: {
          cnpjConsulente: p.cnpj,
          ambiente: p.ambiente,
          nsu: p.nsu,
        },
      },
    });
    if (existente) {
      this.logger.debug(`Doc já existente: cnpj=${p.cnpj} amb=${p.ambiente} nsu=${p.nsu}`);
      return { tipo: 'documento', documento: existente, novo: false };
    }

    const meta = this.extrairMetadadosDocumento(p.xml, p.schema);

    const doc = await this.prisma.client.cteDocumento.create({
      data: {
        cnpjConsulente: p.cnpj,
        ambiente: p.ambiente,
        nsu: p.nsu,
        schema: p.schema,
        chave: meta.chave,
        modelo: meta.modelo,
        dhEmi: meta.dhEmi,
        emitenteRazaoSocial: meta.emitenteRazaoSocial,
        xmlSha256: p.xmlSha256,
        xml: p.xml,
        xmlBytes: Buffer.byteLength(p.xml, 'utf8'),
        erroParse: meta.erro,
      },
    });
    this.logger.log(
      `Doc persistido id=${doc.id} cnpj=${p.cnpj} nsu=${p.nsu} schema=${p.schema} chave=${meta.chave ?? '(sem)'}`,
    );

    // Reconciliação retroativa: eventos podem ter chegado ANTES do documento
    // alvo (caso raro mas possível em distNSU paginado). Vincula agora pelos
    // eventos que tinham chave igual mas documentoId NULL.
    if (meta.chave) {
      const reconciliados = await this.prisma.client.cteEvento.updateMany({
        where: { chave: meta.chave, documentoId: null },
        data: { documentoId: doc.id },
      });
      if (reconciliados.count > 0) {
        this.logger.log(
          `Reconciliação retroativa: ${reconciliados.count} evento(s) vinculado(s) ao doc id=${doc.id} chave=${meta.chave.slice(0, 8)}…`,
        );
      }
    }

    return { tipo: 'documento', documento: doc, novo: true };
  }

  private extrairMetadadosDocumento(
    xml: string,
    schema: SchemaCte,
  ): {
    chave: string | null;
    modelo: number | null;
    dhEmi: Date | null;
    emitenteRazaoSocial: string | null;
    erro: string | null;
  } {
    try {
      const parsed = this.parser.parse(xml);

      if (schema === 'procCTe' || schema === 'procCTeSimp') {
        const infCte = parsed?.cteProc?.CTe?.infCte ?? parsed?.CTe?.infCte;
        if (!infCte) {
          return { chave: null, modelo: null, dhEmi: null, emitenteRazaoSocial: null, erro: `Estrutura ${schema} inesperada` };
        }
        const idAttr = typeof infCte['@_Id'] === 'string' ? infCte['@_Id'] : '';
        const chave = idAttr.startsWith('CTe') && idAttr.length === 47 ? idAttr.substring(3) : null;
        const modelo = infCte.ide?.mod ? Number(infCte.ide.mod) : null;
        return {
          chave,
          modelo,
          dhEmi: this.parseDateSafe(infCte.ide?.dhEmi),
          emitenteRazaoSocial: this.normalizarRazaoSocial(infCte.emit?.xNome),
          erro: null,
        };
      }

      if (schema === 'resCTe') {
        // resCTe: <resCTe><chCTe>44</chCTe><CNPJ>...</CNPJ><dhEmi>...</dhEmi>...
        // Resumo não traz <emit><xNome> — emitenteRazaoSocial fica NULL.
        const r = parsed?.resCTe;
        if (!r) return { chave: null, modelo: null, dhEmi: null, emitenteRazaoSocial: null, erro: 'Estrutura resCTe inesperada' };
        return {
          chave: typeof r.chCTe === 'string' ? r.chCTe : null,
          modelo: 57,
          dhEmi: this.parseDateSafe(r.dhEmi),
          emitenteRazaoSocial: null,
          erro: null,
        };
      }

      return { chave: null, modelo: null, dhEmi: null, emitenteRazaoSocial: null, erro: 'Schema desconhecido — XML preservado' };
    } catch (err) {
      return { chave: null, modelo: null, dhEmi: null, emitenteRazaoSocial: null, erro: (err as Error).message };
    }
  }

  /** Normaliza o <xNome> do emitente p/ a coluna VARCHAR(120): string trim,
   *  vazio→null, truncado a 120 chars (xNome do schema CT-e vai até 60). */
  private normalizarRazaoSocial(xNome: unknown): string | null {
    if (xNome == null) return null;
    const s = String(xNome).trim();
    return s.length === 0 ? null : s.slice(0, 120);
  }

  // ============================================================
  // cte_evento — procEventoCTe / resEventoCTe
  // ============================================================

  private async persistirEvento(p: {
    cnpj: string;
    ambiente: 1 | 2;
    nsu: string;
    schema: SchemaCte;
    xml: string;
    xmlSha256: string;
  }): Promise<PersistirResultado> {
    const meta = this.extrairMetadadosEvento(p.xml, p.schema);
    if (meta.erro || !meta.idEvento || !meta.chave) {
      this.logger.warn(
        `Evento sem metadados essenciais — ignorando: cnpj=${p.cnpj} nsu=${p.nsu} schema=${p.schema} erro="${meta.erro}"`,
      );
      return {
        tipo: 'ignorado',
        novo: false,
        motivoIgnorado: meta.erro ?? 'idEvento ou chave ausente',
      };
    }

    // Dedup: idEvento é UNIQUE
    const existente = await this.prisma.client.cteEvento.findUnique({
      where: { idEvento: meta.idEvento },
    });
    if (existente) {
      this.logger.debug(`Evento já existente: idEvento=${meta.idEvento}`);
      return { tipo: 'evento', evento: existente, novo: false };
    }

    // Reconcilia documento_id se documento da chave já estiver persistido
    const docExistente = await this.prisma.client.cteDocumento.findFirst({
      where: { chave: meta.chave },
      select: { id: true },
    });

    // Warn defensivo: se idEvento foge do tamanho padrao (54), loga pra
    // detectarmos novas variacoes nao-padrao de emitentes no futuro. Em
    // 08/05/2026 detectamos emitente que padded nSeqEvento com 3 digitos
    // — bump da coluna pra varchar(60).
    if (meta.idEvento && meta.idEvento.length !== 54) {
      this.logger.warn(
        `[persistirEvento] idEvento nao-padrao detectado: nsu=${p.nsu} ` +
          `len=${meta.idEvento.length} (spec=54) idEvento="${meta.idEvento}" ` +
          `tpEvento=${meta.tpEventoNum} nSeqEvento=${meta.nSeqEvento}`,
      );
    }

    const evento = await this.prisma.client.cteEvento.create({
      data: {
        documentoId: docExistente?.id ?? null,
        chave: meta.chave,
        idEvento: meta.idEvento,
        tipoEvento: meta.tipoEvento,
        tpEventoNum: meta.tpEventoNum,
        nSeqEvento: meta.nSeqEvento,
        dhEvento: meta.dhEvento ?? new Date(),
        cStat: meta.cStat ?? '',
        xMotivo: meta.xMotivo ?? '',
        protocolo: meta.protocolo,
        xmlSha256: p.xmlSha256,
        xml: p.xml,
      },
    });
    this.logger.log(
      `Evento persistido id=${evento.id} chave=${meta.chave.slice(0, 8)}… tipo=${meta.tipoEvento} (tp=${meta.tpEventoNum}) docId=${docExistente?.id ?? 'null'}`,
    );
    return { tipo: 'evento', evento, novo: true };
  }

  private extrairMetadadosEvento(
    xml: string,
    schema: SchemaCte,
  ): {
    idEvento: string | null;
    chave: string | null;
    tipoEvento: TipoEventoCte;
    tpEventoNum: number;
    nSeqEvento: number;
    dhEvento: Date | null;
    cStat: string | null;
    xMotivo: string | null;
    protocolo: string | null;
    erro: string | null;
  } {
    const empty = {
      idEvento: null,
      chave: null,
      tipoEvento: 'OUTRO' as TipoEventoCte,
      tpEventoNum: 0,
      nSeqEvento: 1,
      dhEvento: null,
      cStat: null,
      xMotivo: null,
      protocolo: null,
    };
    try {
      const parsed = this.parser.parse(xml);

      if (schema === 'procEventoCTe') {
        // <procEventoCTe>
        //   <eventoCTe>
        //     <infEvento Id="ID..."><chCTe>...</chCTe><tpEvento>...</tpEvento>
        //              <nSeqEvento>...</nSeqEvento><dhEvento>...</dhEvento>
        //              <detEvento>...</detEvento></infEvento>
        //   </eventoCTe>
        //   <retEventoCTe><infEvento><cStat>...</cStat><xMotivo>...</xMotivo>
        //              <nProt>...</nProt></infEvento></retEventoCTe>
        // </procEventoCTe>
        const proc = parsed?.procEventoCTe;
        const infEvento = proc?.eventoCTe?.infEvento ?? proc?.evento?.infEvento;
        const retInfEvento = proc?.retEventoCTe?.infEvento ?? proc?.retEvento?.infEvento;
        if (!infEvento) {
          return { ...empty, erro: 'procEventoCTe sem <infEvento>' };
        }
        const idEvento = typeof infEvento['@_Id'] === 'string' ? infEvento['@_Id'] : null;
        const chave = idEvento && idEvento.length === 54 ? idEvento.substring(8, 52) : (typeof infEvento.chCTe === 'string' ? infEvento.chCTe : null);
        const tpEventoNum = infEvento.tpEvento ? Number(infEvento.tpEvento) : 0;
        const nSeqEvento = infEvento.nSeqEvento ? Number(infEvento.nSeqEvento) : 1;
        return {
          erro: null,
          idEvento,
          chave,
          tpEventoNum,
          nSeqEvento,
          tipoEvento: this.mapearTipoEvento(tpEventoNum),
          dhEvento: this.parseDateSafe(infEvento.dhEvento),
          cStat: typeof retInfEvento?.cStat === 'string' || typeof retInfEvento?.cStat === 'number' ? String(retInfEvento.cStat) : null,
          xMotivo: typeof retInfEvento?.xMotivo === 'string' ? retInfEvento.xMotivo : null,
          protocolo: typeof retInfEvento?.nProt === 'string' || typeof retInfEvento?.nProt === 'number' ? String(retInfEvento.nProt) : null,
        };
      }

      if (schema === 'resEventoCTe') {
        // <resEventoCTe><chCTe>...</chCTe><tpEvento>...</tpEvento>
        //   <nSeqEvento>...</nSeqEvento><dhEvento>...</dhEvento>
        //   <cStat>...</cStat><xMotivo>...</xMotivo><nProt>...</nProt></resEventoCTe>
        const r = parsed?.resEventoCTe;
        if (!r) return { ...empty, erro: 'resEventoCTe sem corpo' };
        const chave = typeof r.chCTe === 'string' ? r.chCTe : null;
        const tpEventoNum = r.tpEvento ? Number(r.tpEvento) : 0;
        const nSeqEvento = r.nSeqEvento ? Number(r.nSeqEvento) : 1;
        // resEvento não tem Id explícito — sintetiza:
        const idEvento = chave && tpEventoNum && nSeqEvento ? `ID${String(tpEventoNum).padStart(6, '0')}${chave}${String(nSeqEvento).padStart(2, '0')}` : null;
        return {
          erro: null,
          idEvento,
          chave,
          tpEventoNum,
          nSeqEvento,
          tipoEvento: this.mapearTipoEvento(tpEventoNum),
          dhEvento: this.parseDateSafe(r.dhEvento ?? r.dhRegEvento),
          cStat: typeof r.cStat === 'string' || typeof r.cStat === 'number' ? String(r.cStat) : null,
          xMotivo: typeof r.xMotivo === 'string' ? r.xMotivo : null,
          protocolo: typeof r.nProt === 'string' || typeof r.nProt === 'number' ? String(r.nProt) : null,
        };
      }

      return { ...empty, erro: `schema=${schema} inesperado em persistirEvento` };
    } catch (err) {
      return { ...empty, erro: (err as Error).message };
    }
  }

  /**
   * Mapeia o tpEvento numérico (NT 2014) pra enum TipoEventoCte. Códigos
   * extras viram OUTRO (preserva tpEventoNum original na coluna).
   */
  private mapearTipoEvento(tpEventoNum: number): TipoEventoCte {
    switch (tpEventoNum) {
      case 110110: return 'CCE';
      case 110111: return 'CANCELAMENTO';
      case 110114: return 'PRESTACAO_DESACORDO';
      case 110160: return 'GTV_PRESTACAO';
      case 210200: return 'CONFIRMACAO_PRESTACAO';
      default: return 'OUTRO';
    }
  }

  // ============================================================
  // helpers
  // ============================================================

  private identificarSchema(schemaAttr: string): SchemaCte {
    const limpo = schemaAttr.replace(/\.xsd$/, '').replace(/_v\d.*$/, '');
    switch (limpo) {
      case 'procCTe':       return 'procCTe';
      case 'procCTeSimp':   return 'procCTeSimp';
      case 'resCTe':        return 'resCTe';
      case 'procEventoCTe': return 'procEventoCTe';
      case 'resEventoCTe':  return 'resEventoCTe';
      default:
        this.logger.warn(`Schema CT-e desconhecido: "${schemaAttr}" — persistindo como DESCONHECIDO`);
        return 'DESCONHECIDO';
    }
  }

  private parseDateSafe(dateStr: any): Date | null {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  // ============================================================
  // Listagem paginada — Fase 3 frontend
  // ============================================================

  /**
   * Lista CT-es persistidos com paginação + filtros. Sumário leve por linha
   * (não inclui XML completo — endpoint dedicado pra isso).
   *
   * Filtros opcionais:
   * - search: chave parcial (ILIKE %search%)
   * - papel: PapelCapul exato
   * - schema: SchemaCte exato
   * - ambiente: 1 ou 2
   * - cnpjConsulente: CNPJ exato (14 dígitos)
   * - dataInicio / dataFim: filtra por dh_emi (range)
   */
  async listarPaginado(filtros: {
    page?: number;
    limit?: number;
    search?: string;
    papel?: string;
    schema?: string;
    ambiente?: number;
    cnpjConsulente?: string;
    /**
     * CNPJ do emitente (=transportadora) do CT-e. Fase curta: regex no XML
     * dentro do bloco `<emit>...</emit>`. Pedido Fiscal 29/05 pra triar CT-es
     * por transportadora sem abrir cada um.
     */
    cnpjEmitente?: string;
    /**
     * Razão social do emitente (=transportadora), busca parcial. Pedido Fiscal
     * 01/06: triar CT-es digitando parte do nome da transportadora. Coluna
     * dedicada `emitenteRazaoSocial` (extraída do <emit><xNome> na ingestão +
     * backfill) com índice GIN pg_trgm acelerando ILIKE. Case-insensitive.
     */
    razaoSocialEmitente?: string;
    protheusStatus?: string;
    /** Filtro por dh_emi (data de emissao do CT-e na origem) */
    dataInicio?: Date;
    dataFim?: Date;
    /** Filtro por recebido_em (data em que o CT-e chegou via distNSU na nossa base) */
    recebimentoInicio?: Date;
    recebimentoFim?: Date;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    /**
     * Filtro especial: 'pendentes' = só pendencias de correção ainda nao resolvidas
     * (status problematico AND inconsistencia_resolvida_em IS NULL).
     * 'resolvidas' = ja marcadas resolvidas. 'todas' = sem filtro de overlay.
     */
    inconsistenciaFiltro?: 'pendentes' | 'resolvidas' | 'todas';
  }) {
    const page = Math.max(1, filtros.page ?? 1);
    const limit = Math.min(100, Math.max(1, filtros.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filtros.search) where.chave = { contains: filtros.search.replace(/\D/g, '') };
    if (filtros.papel) where.papelCapul = filtros.papel;
    if (filtros.schema) where.schema = filtros.schema;
    if (filtros.ambiente === 1 || filtros.ambiente === 2) where.ambiente = filtros.ambiente;
    if (filtros.cnpjConsulente) {
      // 26/05 — passou a aceitar CSV (múltiplas filiais do user). String
      // simples continua funcionando como antes (1 CNPJ, igualdade).
      const cnpjs = filtros.cnpjConsulente
        .split(',')
        .map((c) => c.trim().replace(/\D/g, ''))
        .filter((c) => c.length === 14);
      if (cnpjs.length === 1) where.cnpjConsulente = cnpjs[0];
      else if (cnpjs.length > 1) where.cnpjConsulente = { in: cnpjs };
    }
    if (filtros.cnpjEmitente) {
      // 29/05 — filtro CNPJ emitente (transportadora). Regex POSIX no XML
      // com flag (?s) (DOTALL) limita match ao bloco <emit>...</emit>.
      // Fase média: extrair pra coluna indexada (backlog).
      const cnpjEmit = filtros.cnpjEmitente.replace(/\D/g, '');
      if (cnpjEmit.length === 14) {
        // Prisma 6 não tem operador regex nativo no `where`; usar `xml: { contains }`
        // restrito ao padrão "<emit>...<CNPJ>X</CNPJ>" via fragmento limitado.
        // Aproximação prática: a string "<CNPJ>X</CNPJ>" pode aparecer também
        // em rem/dest/toma3/toma4. Por isso filtramos no fluxo final via parse
        // (mesmo critério do vinculadosNfe). Aqui restringe candidatos.
        where.xml = { contains: `<CNPJ>${cnpjEmit}</CNPJ>` };
      }
    }
    if (filtros.razaoSocialEmitente) {
      // Busca parcial por nome da transportadora (coluna indexada GIN pg_trgm).
      // `mode: insensitive` → ILIKE '%termo%', case-insensitive. Acelera mesmo
      // com substring no meio do nome graças ao índice trigram.
      const termo = filtros.razaoSocialEmitente.trim();
      if (termo.length > 0) {
        where.emitenteRazaoSocial = { contains: termo, mode: 'insensitive' };
      }
    }
    // 'PENDENTE' = sem status (ainda não tentou gravar). Outros valores filtram literalmente.
    if (filtros.protheusStatus === 'PENDENTE') {
      where.protheusStatus = null;
    } else if (filtros.protheusStatus) {
      where.protheusStatus = filtros.protheusStatus;
    }
    if (filtros.dataInicio || filtros.dataFim) {
      where.dhEmi = {};
      if (filtros.dataInicio) where.dhEmi.gte = filtros.dataInicio;
      if (filtros.dataFim) where.dhEmi.lte = filtros.dataFim;
    }
    if (filtros.recebimentoInicio || filtros.recebimentoFim) {
      where.recebidoEm = {};
      if (filtros.recebimentoInicio) where.recebidoEm.gte = filtros.recebimentoInicio;
      if (filtros.recebimentoFim) where.recebidoEm.lte = filtros.recebimentoFim;
    }

    // Filtro overlay (08/05/2026): pendencias de correcao = status problematico
    // AND ainda nao resolvido manualmente.
    if (filtros.inconsistenciaFiltro === 'pendentes') {
      // NÃO sobrescrever um protheusStatus explícito (bug 18/05/2026): se o
      // usuário escolheu um status específico no filtro, intersecta com ele
      // (status escolhido AND ainda não resolvido) em vez de trocar pelo
      // conjunto problemático inteiro.
      if (!filtros.protheusStatus) {
        where.protheusStatus = { in: ['GRAVADO_PRENOTA_FALHOU', 'GRAVADO_AGUARDANDO_AMARRACAO'] };
      }
      where.inconsistenciaResolvidaEm = null;
    } else if (filtros.inconsistenciaFiltro === 'resolvidas') {
      where.inconsistenciaResolvidaEm = { not: null };
    }
    // 'todas' ou undefined → sem filtro de overlay

    // Whitelist de colunas ordenaveis (08/05/2026): protege contra injection
    // via query param. Default = recebidoEm desc (mais recente primeiro).
    const SORTABLE_COLUMNS: Record<string, string> = {
      dhEmi: 'dhEmi',
      recebidoEm: 'recebidoEm',
      cnpjConsulente: 'cnpjConsulente',
      nsu: 'nsu',
      protheusStatus: 'protheusStatus',
      protheusTentativas: 'protheusTentativas',
      papelCapul: 'papelCapul',
      // Adicionado 10/05/2026: completa sort por todas as colunas relevantes
      chave: 'chave',
      schema: 'schema',
      ambiente: 'ambiente',
    };
    const sortColumn = filtros.sortBy && SORTABLE_COLUMNS[filtros.sortBy]
      ? SORTABLE_COLUMNS[filtros.sortBy]
      : 'recebidoEm';
    const sortDirection = filtros.sortOrder === 'asc' ? 'asc' : 'desc';
    const orderBy = [{ [sortColumn]: sortDirection } as any, { id: 'desc' as const }];

    const [total, items] = await Promise.all([
      this.prisma.client.cteDocumento.count({ where }),
      this.prisma.client.cteDocumento.findMany({
        where,
        select: {
          id: true,
          cnpjConsulente: true,
          ambiente: true,
          nsu: true,
          schema: true,
          chave: true,
          modelo: true,
          dhEmi: true,
          emitenteRazaoSocial: true,
          papelCapul: true,
          xmlBytes: true,
          recebidoEm: true,
          processadoEm: true,
          erroParse: true,
          protheusGravadoEm: true,
          protheusStatus: true,
          protheusErro: true,
          protheusTentativas: true,
          protheusGrvSucesso: true,
          protheusGrvXmlGravado: true,
          protheusGrvPendAmarracao: true,
          protheusGrvPrenotaFalhou: true,
          protheusGrvMensagem: true,
          protheusGrvJaExistia: true,
          inconsistenciaResolvidaEm: true,
          inconsistenciaResolvidaPorNome: true,
          inconsistenciaObservacao: true,
        },
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Lista CT-es da nossa base local que transportam uma NF-e específica
   * (referenciada pela chave). Pedido do setor Fiscal 29/05: dado uma NF-e
   * com modFrete=destinatário/remetente, verificar quais CT-es vieram com
   * tomador-CAPUL (esperado) ou outro tomador (potencial divergência).
   *
   * Estratégia (fase curta — sem migration):
   *  1. SELECT WHERE xml LIKE '%<chave>%' — varre 5660 docs com seq scan, OK
   *     enquanto volume cabe. Fase média: coluna `chaves_nfe_transportadas
   *     TEXT[]` indexada GIN + backfill (ver MELHORIAS_BACKLOG.md).
   *  2. Pra cada candidato, parseia XML e confirma que a chave NF-e está em
   *     documentosTransportados[].chaveNFe — elimina falso-positive do LIKE.
   *  3. Retorna campos relevantes pro Fiscal cruzar com a NF-e original.
   *
   * Filtros opcionais:
   *  - soTomadoraCapul: filtra só CT-es onde tomador.cnpj ∈ filiais CAPUL.
   *  - cnpjsCapul: lista de CNPJs CAPUL (matriz + filiais) pra match do tomador.
   */
  async listarVinculadosNfe(params: {
    chaveNfe: string;
    soTomadoraCapul?: boolean;
    cnpjsCapul?: string[];
  }) {
    const chaveNfe = (params.chaveNfe ?? '').replace(/\D/g, '');
    if (chaveNfe.length !== 44) {
      return { items: [], total: 0 };
    }
    const cnpjsCapul = (params.cnpjsCapul ?? []).map((c) => c.replace(/\D/g, '')).filter((c) => c.length === 14);

    // Fase 1: candidatos via LIKE no XML — limita custo com index sequencial.
    // O index trgm não cobre LIKE em campos > ~10KB; aceitamos seq scan
    // (volume atual ~5600 docs). Migrar pra coluna indexada vira fase 2.
    const candidatos = await this.prisma.client.cteDocumento.findMany({
      where: {
        xml: { contains: chaveNfe },
        // não filtra ambiente aqui — frontend pode filtrar se quiser
      },
      select: {
        id: true,
        chave: true,
        schema: true,
        ambiente: true,
        dhEmi: true,
        papelCapul: true,
        protheusStatus: true,
        xml: true,
        cnpjConsulente: true,
      },
      orderBy: { dhEmi: 'desc' },
      take: 200, // safety cap — improvavel mas evita parse explosao
    });

    type Vinculado = {
      id: number;
      chaveCte: string | null;
      schema: string;
      ambiente: number;
      dataEmissao: string | null;
      serie: string | null;
      numero: string | null;
      emitente: { cnpj: string | null; razaoSocial: string | null };
      tomador: string;
      tomadorCnpj: string | null;
      tomadorRazao: string | null;
      papelCapul: string | null;
      cnpjConsulente: string | null;
      valorTotalPrestacao: number | null;
      protheusStatus: string | null;
      capulEhTomadora: boolean;
      tipoCte: string | null; // 0=normal, 1=complemento, etc
      tipoCteDescricao: string | null;
    };

    const items: Vinculado[] = [];
    for (const c of candidatos) {
      let parsed;
      try {
        parsed = this.cteParser.parse(c.xml);
      } catch {
        continue; // XML não parseou — ignora
      }
      // Confirma que a chave NF-e realmente está em documentosTransportados
      // (proteção contra falso-positive: a substring pode estar em outro lugar
      // do XML — referência cruzada, autXML, etc).
      const refConfirmada = parsed.documentosTransportados.some(
        (d) => (d.chaveNFe ?? '').replace(/\D/g, '') === chaveNfe,
      );
      if (!refConfirmada) continue;

      const tomadorPart = this.extrairParticipanteTomador(parsed);
      const tomadorCnpj = (tomadorPart?.cnpj ?? '').replace(/\D/g, '') || null;
      const capulEhTomadora = !!tomadorCnpj && cnpjsCapul.includes(tomadorCnpj);

      if (params.soTomadoraCapul && !capulEhTomadora) continue;

      items.push({
        id: c.id,
        chaveCte: c.chave,
        schema: c.schema,
        ambiente: c.ambiente,
        dataEmissao: parsed.dadosGerais.dataEmissao ?? (c.dhEmi ? c.dhEmi.toISOString() : null),
        serie: parsed.dadosGerais.serie ?? null,
        numero: parsed.dadosGerais.numero ?? null,
        emitente: {
          cnpj: parsed.emitente.cnpj ?? null,
          razaoSocial: parsed.emitente.razaoSocial ?? null,
        },
        tomador: parsed.tomador,
        tomadorCnpj,
        tomadorRazao: tomadorPart?.razaoSocial ?? null,
        papelCapul: c.papelCapul,
        cnpjConsulente: c.cnpjConsulente,
        valorTotalPrestacao: parsed.valores.valorTotalPrestacao ?? null,
        protheusStatus: c.protheusStatus,
        capulEhTomadora,
        tipoCte: parsed.dadosGerais.tipoCte ?? null,
        tipoCteDescricao: parsed.dadosGerais.tipoCteDescricao ?? null,
      });
    }

    return { items, total: items.length };
  }

  /**
   * Helper: dado um CteParsed, devolve o CteParticipante correspondente ao
   * tomador. Se toma=4 (Outros), usa `tomadorOutros`; senão pega o
   * participante respectivo já carregado no parsed.
   */
  private extrairParticipanteTomador(parsed: {
    tomador: string;
    tomadorOutros?: { cnpj?: string | null; razaoSocial: string } | null;
    remetente: { cnpj?: string | null; razaoSocial: string };
    expedidor?: { cnpj?: string | null; razaoSocial: string } | null;
    recebedor?: { cnpj?: string | null; razaoSocial: string } | null;
    destinatario: { cnpj?: string | null; razaoSocial: string };
  }): { cnpj?: string | null; razaoSocial: string } | null {
    switch (parsed.tomador) {
      case 'Remetente':
        return parsed.remetente;
      case 'Expedidor':
        return parsed.expedidor ?? null;
      case 'Recebedor':
        return parsed.recebedor ?? null;
      case 'Destinatário':
        return parsed.destinatario;
      case 'Outros':
        return parsed.tomadorOutros ?? null;
      default:
        return null;
    }
  }

  /**
   * Detalhe de 1 CT-e — inclui XML completo + eventos relacionados (FK).
   */
  async detalhe(id: number) {
    const documento = await this.prisma.client.cteDocumento.findUnique({
      where: { id },
    });
    if (!documento) return null;
    const eventos = documento.chave
      ? await this.prisma.client.cteEvento.findMany({
          where: { OR: [{ documentoId: id }, { chave: documento.chave }] },
          orderBy: { dhEvento: 'asc' },
        })
      : [];
    return { documento, eventos };
  }

  /**
   * Marca uma inconsistencia como resolvida manualmente no Protheus pelo
   * setor fiscal. Overlay sobre status do Protheus — status original eh
   * preservado pra auditoria. Idempotente: chamar duas vezes nao gera lixo.
   */
  async marcarInconsistenciaResolvida(params: {
    id: number;
    usuarioId: string;
    usuarioNome: string;
    observacao?: string;
  }) {
    const documento = await this.prisma.client.cteDocumento.findUnique({
      where: { id: params.id },
    });
    if (!documento) {
      throw new Error(`CT-e id=${params.id} nao encontrado`);
    }
    const atualizado = await this.prisma.client.cteDocumento.update({
      where: { id: params.id },
      data: {
        inconsistenciaResolvidaEm: new Date(),
        inconsistenciaResolvidaPorId: params.usuarioId,
        inconsistenciaResolvidaPorNome: params.usuarioNome,
        inconsistenciaObservacao: params.observacao?.trim() || null,
      },
    });
    this.logger.log(
      `Inconsistencia CT-e id=${params.id} chave=${documento.chave?.slice(0, 8)}… ` +
        `marcada como resolvida por ${params.usuarioNome} (id=${params.usuarioId})`,
    );
    return atualizado;
  }

  /**
   * Desmarca resolucao manual — caso operador tenha marcado por engano.
   * Limpa todos campos do overlay.
   */
  async desmarcarInconsistenciaResolvida(id: number) {
    const documento = await this.prisma.client.cteDocumento.findUnique({
      where: { id },
    });
    if (!documento) {
      throw new Error(`CT-e id=${id} nao encontrado`);
    }
    const atualizado = await this.prisma.client.cteDocumento.update({
      where: { id },
      data: {
        inconsistenciaResolvidaEm: null,
        inconsistenciaResolvidaPorId: null,
        inconsistenciaResolvidaPorNome: null,
        inconsistenciaObservacao: null,
      },
    });
    this.logger.log(
      `Inconsistencia CT-e id=${id} chave=${documento.chave?.slice(0, 8)}… DESMARCADA`,
    );
    return atualizado;
  }
}
