import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { SchemaCte, CteDocumento, CteEvento, TipoEventoCte } from '@prisma/client';
import type { CteDocZip } from '../../sefaz/cte-distribuicao.client.js';

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

  constructor(private readonly prisma: PrismaService) {
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
  ): { chave: string | null; modelo: number | null; dhEmi: Date | null; erro: string | null } {
    try {
      const parsed = this.parser.parse(xml);

      if (schema === 'procCTe' || schema === 'procCTeSimp') {
        const infCte = parsed?.cteProc?.CTe?.infCte ?? parsed?.CTe?.infCte;
        if (!infCte) {
          return { chave: null, modelo: null, dhEmi: null, erro: `Estrutura ${schema} inesperada` };
        }
        const idAttr = typeof infCte['@_Id'] === 'string' ? infCte['@_Id'] : '';
        const chave = idAttr.startsWith('CTe') && idAttr.length === 47 ? idAttr.substring(3) : null;
        const modelo = infCte.ide?.mod ? Number(infCte.ide.mod) : null;
        return {
          chave,
          modelo,
          dhEmi: this.parseDateSafe(infCte.ide?.dhEmi),
          erro: null,
        };
      }

      if (schema === 'resCTe') {
        // resCTe: <resCTe><chCTe>44</chCTe><CNPJ>...</CNPJ><dhEmi>...</dhEmi>...
        const r = parsed?.resCTe;
        if (!r) return { chave: null, modelo: null, dhEmi: null, erro: 'Estrutura resCTe inesperada' };
        return {
          chave: typeof r.chCTe === 'string' ? r.chCTe : null,
          modelo: 57,
          dhEmi: this.parseDateSafe(r.dhEmi),
          erro: null,
        };
      }

      return { chave: null, modelo: null, dhEmi: null, erro: 'Schema desconhecido — XML preservado' };
    } catch (err) {
      return { chave: null, modelo: null, dhEmi: null, erro: (err as Error).message };
    }
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
    protheusStatus?: string;
    dataInicio?: Date;
    dataFim?: Date;
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
    if (filtros.cnpjConsulente) where.cnpjConsulente = filtros.cnpjConsulente.replace(/\D/g, '');
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

    // Filtro overlay (08/05/2026): pendencias de correcao = status problematico
    // AND ainda nao resolvido manualmente.
    if (filtros.inconsistenciaFiltro === 'pendentes') {
      where.protheusStatus = { in: ['GRAVADO_PRENOTA_FALHOU', 'GRAVADO_AGUARDANDO_AMARRACAO'] };
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
          papelCapul: true,
          xmlBytes: true,
          recebidoEm: true,
          processadoEm: true,
          erroParse: true,
          protheusGravadoEm: true,
          protheusStatus: true,
          protheusErro: true,
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
