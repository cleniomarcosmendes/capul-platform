import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import type { GrvXmlExtracted } from './interfaces/grv-xml.interface.js';

/**
 * Parser que extrai campos do XML autorizado (nfeProc / cteProc) — usado
 * para inspeção, debug e testes.
 *
 * Migration 08/05/2026: a montagem do body grvXML migrou pra
 * `{ itens: [{ xmlBase64 }] }` (Protheus extrai do XML). Este service
 * mantém apenas `extrair()` pra cenarios onde precisamos olhar campos
 * estruturados (validação cruzada, alertas, telas de debug).
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

}
