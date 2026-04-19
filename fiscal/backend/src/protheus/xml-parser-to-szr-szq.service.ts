import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import type {
  GrvXmlBody,
  GrvXmlContext,
  GrvXmlExtracted,
  GrvXmlItem,
} from './interfaces/grv-xml.interface.js';

/**
 * Parser que extrai campos do XML autorizado (nfeProc / cteProc) e monta o
 * body do endpoint `POST /grvXML` do Protheus.
 *
 * Responsabilidades:
 *   1. Validar que o XML é um nfeProc (NF-e modelo 55/65) ou cteProc (CT-e 57/67)
 *   2. Extrair ~25 campos de cabeçalho (SZR010 / ZR_*)
 *   3. Extrair N campos por item (SZQ010 / ZQ_*)
 *   4. Montar o body JSON aceito pelo Protheus
 *
 * Não faz:
 *   - Consulta a `/cadastroFiscal` para resolver CODFOR/LOJSIG (cabe ao caller)
 *   - Cálculo de campos "siga" (cabe ao caller se houver — ver GrvXmlContext.siga)
 *   - Chamada HTTP ao Protheus (cabe ao ProtheusXmlService / futuro GrvXmlService)
 *
 * Para pendências do contrato (CODFOR/LOJSIG, siga, USRREC), ver
 * `docs/PENDENCIAS_PROTHEUS_18ABR2026.md` §3.1 a §3.3.
 */
@Injectable()
export class XmlParserToSzrSzqService {
  private readonly logger = new Logger(XmlParserToSzrSzqService.name);
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
  });

  /**
   * Extrai os campos relevantes do XML sem ainda montar o body.
   * Útil para validação, logs e testes.
   */
  extrair(xml: string): GrvXmlExtracted {
    if (!xml || typeof xml !== 'string' || xml.trim().length === 0) {
      throw new BadRequestException('XML vazio.');
    }

    const doc = this.parser.parse(xml) as Record<string, unknown>;

    // nfeProc → NFe → infNFe  |  cteProc → CTe → infCte
    const nfeProc = doc.nfeProc as Record<string, unknown> | undefined;
    const cteProc = doc.cteProc as Record<string, unknown> | undefined;

    if (nfeProc) return this.extrairNfe(nfeProc);
    if (cteProc) return this.extrairCte(cteProc);

    // Alguns fluxos trabalham com XML "headless" (sem envelope nfeProc):
    if (doc.NFe) return this.extrairNfe({ NFe: doc.NFe });
    if (doc.CTe) return this.extrairCte({ CTe: doc.CTe });

    throw new BadRequestException(
      'XML não reconhecido: esperado nfeProc / NFe (modelos 55/65) ou cteProc / CTe (modelos 57/67).',
    );
  }

  /**
   * Monta o body completo do POST /grvXML a partir do XML + contexto de gravação.
   *
   * @param xml XML original (string, não base64)
   * @param ctx dados externos ao XML (filial, usuário, codFor opcional, etc.)
   */
  montarBody(xml: string, ctx: GrvXmlContext): GrvXmlBody {
    const extracted = this.extrair(xml);
    const xmlBase64 = Buffer.from(xml, 'utf-8').toString('base64');
    const agora = ctx.dataHoraRec ?? new Date();

    const itens: GrvXmlItem[] = [
      {
        alias: 'XMLCAB',
        xmlBase64,
        campos: [
          { campo: 'FILIAL', valor: ctx.filial },
          { campo: 'TPXML', valor: extracted.tipoXml },
          { campo: 'CHVNFE', valor: extracted.chave },
          { campo: 'DTREC', valor: this.formatDate(agora) },
          { campo: 'HRREC', valor: this.formatTime(agora) },
          { campo: 'USRREC', valor: ctx.usuarioRec },
          { campo: 'MODELO', valor: extracted.modelo },
          { campo: 'EMISSA', valor: extracted.dataEmissao },
          { campo: 'TPNF', valor: extracted.tipoNF },
          { campo: 'TERCEIR', valor: ctx.terceir ?? 'F' },
          { campo: 'NNF', valor: extracted.numeroNF },
          { campo: 'SERIE', valor: extracted.serie },
          { campo: 'ECNPJ', valor: extracted.emitente.cnpj },
          { campo: 'ENOME', valor: extracted.emitente.nome },
          { campo: 'EIE', valor: extracted.emitente.ie },
          { campo: 'ELGR', valor: extracted.emitente.logradouro },
          { campo: 'ENRO', valor: extracted.emitente.numero },
          { campo: 'EBAIRR', valor: extracted.emitente.bairro },
          { campo: 'ECMUN', valor: extracted.emitente.codMunicipio },
          { campo: 'EXMUN', valor: extracted.emitente.municipio },
          { campo: 'EUF', valor: extracted.emitente.uf },
          { campo: 'ECEP', valor: extracted.emitente.cep },
          { campo: 'EFONE', valor: extracted.emitente.fone },
          { campo: 'CODFOR', valor: ctx.codFor ?? '' },
          { campo: 'LOJSIG', valor: ctx.lojSig ?? '0001' },
        ],
      },
    ];

    for (const item of extracted.itens) {
      const siga = ctx.siga?.[item.numItem] ?? {};
      itens.push({
        alias: 'XMLIT',
        campos: [
          { campo: 'FILIAL', valor: ctx.filial },
          { campo: 'CHVNFE', valor: extracted.chave },
          { campo: 'ITEM', valor: item.numItem },
          { campo: 'PROD', valor: item.cProd },
          { campo: 'EAN', valor: item.cEAN },
          { campo: 'DESCRI', valor: item.xProd },
          { campo: 'UM', valor: item.uCom },
          { campo: 'QTDE', valor: item.qCom },
          { campo: 'VLUNIT', valor: item.vUnCom },
          { campo: 'TOTAL', valor: item.vProd },
          { campo: 'CFOP', valor: item.cfop },
          { campo: 'XMLIMP', valor: '' },
          { campo: 'CODSIG', valor: siga.codSig ?? '' },
          { campo: 'QTSIGA', valor: siga.qtSiga ?? '' },
          { campo: 'VLSIGA', valor: siga.vlSiga ?? '' },
          { campo: 'PEDCOM', valor: siga.pedCom ?? '' },
        ],
      });
    }

    return { itens };
  }

  // ----- internos -----

  private extrairNfe(root: Record<string, unknown>): GrvXmlExtracted {
    const nfe = (root.NFe ?? (root.nfeProc as Record<string, unknown> | undefined)?.NFe) as
      | Record<string, unknown>
      | undefined;
    const infNFe = nfe?.infNFe as Record<string, unknown> | undefined;
    if (!infNFe) throw new BadRequestException('XML inválido: infNFe ausente.');

    const ide = (infNFe.ide ?? {}) as Record<string, string>;
    const emit = (infNFe.emit ?? {}) as Record<string, unknown>;
    const enderEmit = (emit.enderEmit ?? {}) as Record<string, string>;
    const idAttr = (infNFe.Id ?? '') as string;
    const chave = idAttr.replace(/^NFe/i, '');

    const detRaw = infNFe.det;
    const dets = Array.isArray(detRaw) ? detRaw : detRaw ? [detRaw] : [];

    return {
      tipoXml: 'NFe',
      modelo: this.str(ide.mod),
      chave,
      serie: this.padSerie(this.str(ide.serie)),
      numeroNF: this.padNumero(this.str(ide.nNF)),
      dataEmissao: this.ymdFromIso(this.str(ide.dhEmi)),
      tipoNF: this.str(ide.tpNF),
      emitente: {
        cnpj: this.str(emit.CNPJ as string) || this.str(emit.CPF as string),
        nome: this.str(emit.xNome as string),
        ie: this.str(emit.IE as string),
        logradouro: this.str(enderEmit.xLgr),
        numero: this.str(enderEmit.nro),
        bairro: this.str(enderEmit.xBairro),
        codMunicipio: this.str(enderEmit.cMun),
        municipio: this.str(enderEmit.xMun),
        uf: this.str(enderEmit.UF),
        cep: this.str(enderEmit.CEP),
        fone: this.str(enderEmit.fone),
      },
      itens: dets.map((det) => this.extrairItemNfe(det as Record<string, unknown>)),
    };
  }

  private extrairItemNfe(det: Record<string, unknown>): GrvXmlExtracted['itens'][number] {
    const nItem = (det.nItem ?? '') as string;
    const prod = (det.prod ?? {}) as Record<string, string>;
    return {
      numItem: this.padItem(this.str(nItem)),
      cProd: this.str(prod.cProd),
      cEAN: this.str(prod.cEAN),
      xProd: this.str(prod.xProd),
      uCom: this.str(prod.uCom),
      qCom: this.stripTrailingZeros(this.str(prod.qCom)),
      vUnCom: this.stripTrailingZeros(this.str(prod.vUnCom)),
      vProd: this.str(prod.vProd),
      cfop: this.str(prod.CFOP),
    };
  }

  private extrairCte(root: Record<string, unknown>): GrvXmlExtracted {
    const cte = (root.CTe ?? (root.cteProc as Record<string, unknown> | undefined)?.CTe) as
      | Record<string, unknown>
      | undefined;
    const infCte = cte?.infCte as Record<string, unknown> | undefined;
    if (!infCte) throw new BadRequestException('XML inválido: infCte ausente.');

    const ide = (infCte.ide ?? {}) as Record<string, string>;
    const emit = (infCte.emit ?? {}) as Record<string, unknown>;
    const enderEmit = (emit.enderEmit ?? {}) as Record<string, string>;
    const idAttr = (infCte.Id ?? '') as string;
    const chave = idAttr.replace(/^CTe/i, '');

    return {
      tipoXml: 'CTe',
      modelo: this.str(ide.mod),
      chave,
      serie: this.padSerie(this.str(ide.serie)),
      numeroNF: this.padNumero(this.str(ide.nCT)),
      dataEmissao: this.ymdFromIso(this.str(ide.dhEmi)),
      tipoNF: this.str(ide.tpCTe) || '0',
      emitente: {
        cnpj: this.str(emit.CNPJ as string) || this.str(emit.CPF as string),
        nome: this.str(emit.xNome as string),
        ie: this.str(emit.IE as string),
        logradouro: this.str(enderEmit.xLgr),
        numero: this.str(enderEmit.nro),
        bairro: this.str(enderEmit.xBairro),
        codMunicipio: this.str(enderEmit.cMun),
        municipio: this.str(enderEmit.xMun),
        uf: this.str(enderEmit.UF),
        cep: this.str(enderEmit.CEP),
        fone: this.str(enderEmit.fone),
      },
      itens: [], // CT-e tem estrutura de itens distinta; tratamento específico fica para Onda 2
    };
  }

  // ----- helpers -----

  private str(v: unknown): string {
    if (v === undefined || v === null) return '';
    return String(v).trim();
  }

  private padSerie(s: string): string {
    if (!s) return '';
    return s.padStart(3, '0');
  }

  private padNumero(s: string): string {
    if (!s) return '';
    return s.padStart(9, '0');
  }

  private padItem(s: string): string {
    if (!s) return '';
    return s.padStart(3, '0');
  }

  private ymdFromIso(iso: string): string {
    if (!iso) return '';
    // Entrada: 2026-04-16T11:35:12-03:00  |  Saída: 20260416
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[1]}${match[2]}${match[3]}` : '';
  }

  private stripTrailingZeros(s: string): string {
    if (!s || !s.includes('.')) return s;
    return s.replace(/\.?0+$/, '');
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${dd}`;
  }

  private formatTime(d: Date): string {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }
}
