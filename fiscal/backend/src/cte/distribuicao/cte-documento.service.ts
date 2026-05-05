import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { SchemaCte, CteDocumento } from '@prisma/client';
import type { CteDocZip } from '../../sefaz/cte-distribuicao.client.js';

export interface PersistirResultado {
  /** Documento persistido (novo ou já existente quando dedup bate) */
  documento: CteDocumento;
  /** true = registro novo criado; false = já existia (mesmo SHA-256) */
  novo: boolean;
}

/**
 * Persiste docZips retornados pelo `CteDistribuicaoClient.consultarPorNsu`
 * em `fiscal.cte_documento`.
 *
 * Fluxo:
 *   1. Calcula SHA-256 do XML pra dedup global
 *   2. Identifica schema do XML (SchemaCte enum)
 *   3. Extrai metadados básicos (chave, modelo, dhEmi) — sem PapelDetector
 *      (Fase 3 popula `papel_capul`)
 *   4. Faz upsert por (cnpj_consulente, ambiente, nsu) — chave natural
 *      do par (consulente, NSU) que SEFAZ entrega
 *
 * Parser de eventos vinculados (cte_evento) é responsabilidade da Fase 3.
 * Por ora, eventos chegam aqui como cte_documento com schema=procEventoCTe
 * e ficam pra Fase 3 ser desdobrar em cte_evento.
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
   * Persiste 1 docZip. Se já existe (mesma chave natural cnpj+ambiente+nsu),
   * retorna o registro existente sem alterar (idempotente — re-execução
   * do orquestrador é segura).
   */
  async persistir(params: {
    cnpjConsulente: string;
    ambiente: 1 | 2;
    docZip: CteDocZip;
  }): Promise<PersistirResultado> {
    const cnpj = params.cnpjConsulente.replace(/\D/g, '');
    const xml = params.docZip.xml;
    const xmlSha256 = createHash('sha256').update(xml).digest('hex');

    // Idempotência: se mesmo (cnpj, ambiente, nsu) já existe, devolve.
    const existente = await this.prisma.client.cteDocumento.findUnique({
      where: {
        doc_consulente_ambiente_nsu: {
          cnpjConsulente: cnpj,
          ambiente: params.ambiente,
          nsu: params.docZip.nsu,
        },
      },
    });
    if (existente) {
      this.logger.debug(
        `Doc já existente: cnpj=${cnpj} amb=${params.ambiente} nsu=${params.docZip.nsu} sha256=${xmlSha256.slice(0, 8)}`,
      );
      return { documento: existente, novo: false };
    }

    const schemaCte = this.identificarSchema(params.docZip.schema);
    const metadados = this.extrairMetadados(xml, schemaCte);

    try {
      const doc = await this.prisma.client.cteDocumento.create({
        data: {
          cnpjConsulente: cnpj,
          ambiente: params.ambiente,
          nsu: params.docZip.nsu,
          schema: schemaCte,
          chave: metadados.chave,
          modelo: metadados.modelo,
          dhEmi: metadados.dhEmi,
          xmlSha256,
          xml,
          xmlBytes: Buffer.byteLength(xml, 'utf8'),
          erroParse: metadados.erro,
        },
      });
      this.logger.log(
        `Doc persistido id=${doc.id} cnpj=${cnpj} nsu=${params.docZip.nsu} schema=${schemaCte} chave=${metadados.chave ?? '(sem)'}`,
      );
      return { documento: doc, novo: true };
    } catch (err) {
      this.logger.error(
        `Falha persistir doc cnpj=${cnpj} nsu=${params.docZip.nsu}: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  /**
   * Mapeia atributo `@schema` do <docZip> SEFAZ para enum SchemaCte.
   * Schemas conhecidos vêm com extensão `.xsd`. Tudo que não bate vira
   * `DESCONHECIDO` — XML é persistido pra análise manual posterior.
   */
  private identificarSchema(schemaAttr: string): SchemaCte {
    const limpo = schemaAttr.replace(/\.xsd$/, '').replace(/_v\d.*$/, '');
    switch (limpo) {
      case 'procCTe':
        return 'procCTe';
      case 'procCTeSimp':
        return 'procCTeSimp';
      case 'resCTe':
        return 'resCTe';
      case 'procEventoCTe':
        return 'procEventoCTe';
      case 'resEventoCTe':
        return 'resEventoCTe';
      default:
        this.logger.warn(`Schema CT-e desconhecido: "${schemaAttr}" — persistindo como DESCONHECIDO`);
        return 'DESCONHECIDO';
    }
  }

  /**
   * Extrai metadados básicos do XML (chave, modelo, data de emissão).
   * Tolerante a falha — qualquer erro vira `erroParse` na coluna pra
   * análise depois sem perder o XML bruto.
   */
  private extrairMetadados(
    xml: string,
    schema: SchemaCte,
  ): { chave: string | null; modelo: number | null; dhEmi: Date | null; erro: string | null } {
    try {
      const parsed = this.parser.parse(xml);

      // Cada schema tem caminho diferente até <infCte> ou similar
      let infCte: any;
      switch (schema) {
        case 'procCTe':
        case 'procCTeSimp':
          // <cteProc><CTe><infCte Id="CTe<chave>"><ide><dhEmi>...</dhEmi><mod>...</mod></ide></infCte></CTe></cteProc>
          infCte = parsed?.cteProc?.CTe?.infCte ?? parsed?.CTe?.infCte;
          break;
        case 'resCTe':
          // <resCTe><chCTe>44</chCTe><dhEmi>...</dhEmi>...</resCTe>
          infCte = parsed?.resCTe;
          if (infCte) {
            return {
              chave: typeof infCte.chCTe === 'string' ? infCte.chCTe : null,
              modelo: 57, // resCTe é sempre modelo 57
              dhEmi: this.parseDateSafe(infCte.dhEmi),
              erro: null,
            };
          }
          break;
        case 'procEventoCTe':
          // <procEventoCTe><eventoCTe><infEvento Id="ID<tpEvento><chave><nSeq>"><chCTe>...</chCTe></infEvento></eventoCTe></procEventoCTe>
          infCte = parsed?.procEventoCTe?.eventoCTe?.infEvento ?? parsed?.eventoCTe?.infEvento;
          if (infCte) {
            const id = typeof infCte['@_Id'] === 'string' ? infCte['@_Id'] : '';
            // Id formato: "ID" + tpEvento(6) + chave(44) + nSeq(2)
            const chave = id.length === 54 ? id.substring(8, 52) : (typeof infCte.chCTe === 'string' ? infCte.chCTe : null);
            return {
              chave,
              modelo: 57,
              dhEmi: this.parseDateSafe(infCte.dhEvento),
              erro: null,
            };
          }
          break;
        case 'resEventoCTe':
          // <resEventoCTe><chCTe>...</chCTe>...</resEventoCTe>
          infCte = parsed?.resEventoCTe;
          if (infCte) {
            return {
              chave: typeof infCte.chCTe === 'string' ? infCte.chCTe : null,
              modelo: 57,
              dhEmi: this.parseDateSafe(infCte.dhEvento ?? infCte.dhRegEvento),
              erro: null,
            };
          }
          break;
        case 'DESCONHECIDO':
          return { chave: null, modelo: null, dhEmi: null, erro: 'Schema desconhecido' };
      }

      if (!infCte) {
        return { chave: null, modelo: null, dhEmi: null, erro: `Estrutura XML inesperada para schema=${schema}` };
      }

      // procCTe / procCTeSimp
      const idAttr = typeof infCte['@_Id'] === 'string' ? infCte['@_Id'] : '';
      const chave = idAttr.startsWith('CTe') && idAttr.length === 47 ? idAttr.substring(3) : null;
      const ide = infCte.ide;
      const modelo = ide?.mod ? Number(ide.mod) : null;
      const dhEmi = this.parseDateSafe(ide?.dhEmi);

      return { chave, modelo, dhEmi, erro: null };
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.warn(`Falha extrair metadados schema=${schema}: ${msg}`);
      return { chave: null, modelo: null, dhEmi: null, erro: msg };
    }
  }

  private parseDateSafe(dateStr: any): Date | null {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }
}
