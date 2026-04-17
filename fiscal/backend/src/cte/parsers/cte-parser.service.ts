import { BadRequestException, Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import type {
  CteCarga,
  CteDadosGerais,
  CteDocumentoTransportado,
  CteParsed,
  CteParticipante,
  CteProtocoloAutorizacao,
  CteValores,
} from './cte-parsed.interface.js';

const TIPO_CTE_MAP: Record<string, string> = {
  '0': 'Normal',
  '1': 'Complemento de valores',
  '2': 'Anulação',
  '3': 'Substituto',
};

const TIPO_SERVICO_MAP: Record<string, string> = {
  '0': 'Normal',
  '1': 'Subcontratação',
  '2': 'Redespacho',
  '3': 'Redespacho intermediário',
  '4': 'Serviço vinculado a multimodal',
  '5': 'Redespacho ou redespacho intermediário',
  '6': 'Simples',
  '7': 'Transporte de excedente',
};

const MODALIDADE_MAP: Record<string, string> = {
  '01': 'Rodoviário',
  '02': 'Aéreo',
  '03': 'Aquaviário',
  '04': 'Ferroviário',
  '05': 'Dutoviário',
  '06': 'Multimodal',
};

const TOMADOR_MAP: Record<string, CteParsed['tomador']> = {
  '0': 'Remetente',
  '1': 'Expedidor',
  '2': 'Recebedor',
  '3': 'Destinatário',
  '4': 'Outros',
};

const TIPO_MEDIDA_MAP: Record<string, string> = {
  '00': 'M3',
  '01': 'KG',
  '02': 'TON',
  '03': 'UNIDADE',
  '04': 'LITROS',
  '05': 'MMBTU',
};

@Injectable()
export class CteParserService {
  private readonly xmlParser: XMLParser;

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: true,
      parseTagValue: false,
      trimValues: true,
      removeNSPrefix: true,
    });
  }

  parse(xml: string): CteParsed {
    let root: any;
    try {
      root = this.xmlParser.parse(xml);
    } catch (err) {
      throw new BadRequestException(`XML CT-e inválido: ${(err as Error).message}`);
    }

    const cteProc = root?.cteProc;
    const CTe = cteProc?.CTe ?? root?.CTe;
    if (!CTe) throw new BadRequestException('Estrutura <CTe> não encontrada.');
    const inf = CTe.infCte;
    if (!inf) throw new BadRequestException('Bloco <infCte> ausente.');

    const dadosGerais = this.parseDadosGerais(inf);
    const emitente = this.parseParticipante(inf.emit, 'emitente');
    const remetente = this.parseParticipante(inf.rem, 'remetente');
    const expedidor = inf.exped ? this.parseParticipante(inf.exped, 'expedidor') : null;
    const recebedor = inf.receb ? this.parseParticipante(inf.receb, 'recebedor') : null;
    const destinatario = this.parseParticipante(inf.dest, 'destinatario');
    const tomador = TOMADOR_MAP[String(inf.ide?.toma ?? '4')] ?? 'Outros';
    const carga = this.parseCarga(inf.infCTeNorm?.infCarga);
    const valores = this.parseValores(inf.vPrest, inf.imp?.ICMS);
    const documentosTransportados = this.parseDocumentos(inf.infCTeNorm?.infDoc);
    const protocolo = cteProc ? this.parseProtocolo(cteProc.protCTe) : null;

    return {
      dadosGerais,
      emitente,
      remetente,
      expedidor,
      recebedor,
      destinatario,
      tomador,
      carga,
      valores,
      documentosTransportados,
      observacoes: str(inf.compl?.xObs),
      protocoloAutorizacao: protocolo,
    };
  }

  private parseDadosGerais(inf: any): CteDadosGerais {
    const id = String(inf['@_Id'] ?? '');
    const chave = id.replace(/^CTe/, '').trim();
    if (!/^\d{44}$/.test(chave)) {
      throw new BadRequestException(`Chave CT-e extraída inválida: "${chave}"`);
    }
    const ide = inf.ide ?? {};
    const tipoCte = String(ide.tpCTe ?? '0') as '0' | '1' | '2' | '3';
    const tipoServico = String(ide.tpServ ?? '0') as any;
    const modal = String(ide.modal ?? '01') as any;

    return {
      chave,
      modelo: String(ide.mod ?? '57'),
      serie: String(ide.serie ?? ''),
      numero: String(ide.nCT ?? ''),
      dataEmissao: String(ide.dhEmi ?? ''),
      tipoCte,
      tipoCteDescricao: TIPO_CTE_MAP[tipoCte] ?? tipoCte,
      tipoServico,
      tipoServicoDescricao: TIPO_SERVICO_MAP[tipoServico] ?? tipoServico,
      modalidade: modal,
      modalidadeDescricao: MODALIDADE_MAP[modal] ?? modal,
      naturezaOperacao: String(ide.natOp ?? ''),
      ufInicio: String(ide.UFIni ?? ''),
      ufFim: String(ide.UFFim ?? ''),
      ambiente: String(ide.tpAmb ?? '1') as '1' | '2',
      cfop: String(ide.CFOP ?? ''),
    };
  }

  private parseParticipante(p: any, tipo: string): CteParticipante {
    if (!p) throw new BadRequestException(`Bloco <${tipo}> ausente.`);
    const end = p.enderEmit ?? p.enderReme ?? p.enderExped ?? p.enderReceb ?? p.enderDest ?? null;
    return {
      cnpj: str(p.CNPJ),
      cpf: str(p.CPF),
      razaoSocial: String(p.xNome ?? ''),
      inscricaoEstadual: str(p.IE),
      endereco: end
        ? {
            logradouro: str(end.xLgr),
            numero: str(end.nro),
            bairro: str(end.xBairro),
            municipio: str(end.xMun),
            codigoMunicipio: str(end.cMun),
            uf: str(end.UF),
            cep: str(end.CEP),
          }
        : null,
    };
  }

  private parseCarga(infCarga: any): CteCarga {
    if (!infCarga) {
      return { valorCarga: 0, produtoPredominante: '', outrasCaracteristicas: null, quantidades: [] };
    }
    const quantList = infCarga.infQ
      ? (Array.isArray(infCarga.infQ) ? infCarga.infQ : [infCarga.infQ])
      : [];
    return {
      valorCarga: num(infCarga.vCarga),
      produtoPredominante: String(infCarga.proPred ?? ''),
      outrasCaracteristicas: str(infCarga.xOutCat),
      quantidades: quantList.map((q: any) => ({
        tipoMedida: String(q.cUnid ?? ''),
        descricao: TIPO_MEDIDA_MAP[String(q.cUnid ?? '')] ?? String(q.tpMed ?? ''),
        quantidade: num(q.qCarga),
      })),
    };
  }

  private parseValores(vPrest: any, icms: any): CteValores {
    const componentes: CteValores['componentes'] = [];
    if (vPrest?.Comp) {
      const list = Array.isArray(vPrest.Comp) ? vPrest.Comp : [vPrest.Comp];
      for (const c of list) {
        componentes.push({ nome: String(c.xNome ?? ''), valor: num(c.vComp) });
      }
    }
    const icmsInner = icms ? (icms.ICMS00 ?? icms.ICMS20 ?? icms.ICMS45 ?? icms.ICMS60 ?? icms.ICMS90 ?? icms.ICMSSN ?? icms.ICMSOutraUF) : null;
    return {
      valorTotalPrestacao: num(vPrest?.vTPrest),
      valorReceber: num(vPrest?.vRec),
      componentes,
      icmsCst: icmsInner?.CST ?? null,
      icmsBase: optNum(icmsInner?.vBC),
      icmsAliquota: optNum(icmsInner?.pICMS),
      icmsValor: optNum(icmsInner?.vICMS),
    };
  }

  private parseDocumentos(infDoc: any): CteDocumentoTransportado[] {
    if (!infDoc) return [];
    const out: CteDocumentoTransportado[] = [];
    if (infDoc.infNFe) {
      const list = Array.isArray(infDoc.infNFe) ? infDoc.infNFe : [infDoc.infNFe];
      for (const n of list) {
        out.push({
          chaveNFe: String(n.chave ?? ''),
          numeroNF: null,
          serie: null,
          valor: null,
          pesoTotal: null,
        });
      }
    }
    if (infDoc.infNF) {
      const list = Array.isArray(infDoc.infNF) ? infDoc.infNF : [infDoc.infNF];
      for (const n of list) {
        out.push({
          chaveNFe: null,
          numeroNF: String(n.nDoc ?? ''),
          serie: String(n.serie ?? ''),
          valor: optNum(n.valor),
          pesoTotal: optNum(n.pesoTotal),
        });
      }
    }
    return out;
  }

  private parseProtocolo(protCTe: any): CteProtocoloAutorizacao | null {
    if (!protCTe?.infProt) return null;
    const inf = protCTe.infProt;
    return {
      protocolo: String(inf.nProt ?? ''),
      dataRecebimento: String(inf.dhRecbto ?? ''),
      cStat: String(inf.cStat ?? ''),
      motivo: String(inf.xMotivo ?? ''),
      ambiente: String(inf.tpAmb ?? '1') as '1' | '2',
    };
  }
}

function str(v: any): string | null {
  if (v === undefined || v === null || v === '') return null;
  return String(v);
}
function num(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function optNum(v: any): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
