import { BadRequestException, Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import type {
  CteCarga,
  CteDadosGerais,
  CteDocumentoAnterior,
  CteDocumentoTransportado,
  CteEndereco,
  CteIcms,
  CteIcmsUFFim,
  CteInfoAdicionais,
  CteInfTribFed,
  CteIssqn,
  CteModal,
  CteModalAereo,
  CteModalAquaviario,
  CteModalDutoviario,
  CteModalFerroviario,
  CteModalMultimodal,
  CteModalRodoviario,
  CteModalRodoviarioVeiculo,
  CteParsed,
  CteParticipante,
  CteProtocoloAutorizacao,
  CteSeguro,
  CteUnidadeCarga,
  CteUnidadeTransporte,
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

const TIPO_EMISSAO_MAP: Record<string, string> = {
  '1': 'Normal',
  '4': 'EPEC pela SVC',
  '5': 'FS-DA (Contingência DA)',
  '7': 'SVC-RS',
  '8': 'SVC-SP',
};

const CRT_MAP: Record<string, string> = {
  '1': 'Simples Nacional',
  '2': 'Simples Nacional - excesso de sublimite',
  '3': 'Regime Normal',
};

const RESPONSAVEL_SEGURO_MAP: Record<string, string> = {
  '4': 'Remetente',
  '5': 'Expedidor',
  '6': 'Recebedor',
  '7': 'Destinatário',
  '8': 'Emitente do CT-e',
  '9': 'Tomador do Serviço',
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
    const tomadorOutros = inf.ide?.toma4 ? this.parseParticipante(inf.ide.toma4, 'tomador4') : null;

    const infCTeNorm = inf.infCTeNorm ?? null;
    const carga = this.parseCarga(infCTeNorm?.infCarga);
    const valores = this.parseValores(inf.vPrest, inf.imp);
    const documentosTransportados = this.parseDocumentos(infCTeNorm?.infDoc);
    const unidadesTransporte = this.parseUnidadesTransporte(infCTeNorm?.infDoc);
    const unidadesCarga = this.parseUnidadesCarga(infCTeNorm?.infDoc);
    const documentosAnteriores = this.parseDocumentosAnteriores(inf);
    const modal = this.parseModal(dadosGerais.modalidade, infCTeNorm);
    const seguro = this.parseSeguro(infCTeNorm?.seg) ?? this.extrairSeguroDoModal(modal);
    const infoAdicionais = this.parseInfoAdicionais(inf);

    const protocolo = cteProc ? this.parseProtocolo(cteProc.protCTe) : null;
    if (protocolo && !protocolo.chave) protocolo.chave = dadosGerais.chave;

    return {
      dadosGerais,
      emitente,
      remetente,
      expedidor,
      recebedor,
      destinatario,
      tomador,
      tomadorOutros,
      carga,
      valores,
      documentosTransportados,
      unidadesTransporte,
      unidadesCarga,
      documentosAnteriores,
      modal,
      seguro,
      infoAdicionais,
      protocoloAutorizacao: protocolo,
      observacoes: infoAdicionais.observacoes,
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
    const tpEmis = ide.tpEmis ? String(ide.tpEmis) : null;

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
      tipoEmissao: tpEmis,
      tipoEmissaoDescricao: tpEmis ? (TIPO_EMISSAO_MAP[tpEmis] ?? tpEmis) : null,
      dataContingencia: str(ide.dhCont),
      justificativaContingencia: str(ide.xJust),
      municipioInicioCodigo: str(ide.cMunIni),
      municipioInicioNome: str(ide.xMunIni),
      municipioFimCodigo: str(ide.cMunFim),
      municipioFimNome: str(ide.xMunFim),
    };
  }

  private parseParticipante(p: any, tipo: string): CteParticipante {
    if (!p) throw new BadRequestException(`Bloco <${tipo}> ausente.`);
    const end =
      p.enderEmit ?? p.enderReme ?? p.enderExped ?? p.enderReceb ?? p.enderDest ?? p.enderToma ?? null;
    const crt = p.CRT ? String(p.CRT) : null;
    return {
      cnpj: str(p.CNPJ),
      cpf: str(p.CPF),
      razaoSocial: String(p.xNome ?? ''),
      nomeFantasia: str(p.xFant),
      inscricaoEstadual: str(p.IE),
      inscricaoEstadualST: str(p.IEST),
      inscricaoSUFRAMA: str(p.ISUF),
      crt,
      crtDescricao: crt ? (CRT_MAP[crt] ?? crt) : null,
      email: str(p.email),
      endereco: end ? this.parseEndereco(end, p.fone) : null,
    };
  }

  private parseEndereco(end: any, foneOuter?: any): CteEndereco {
    return {
      logradouro: str(end.xLgr),
      numero: str(end.nro),
      complemento: str(end.xCpl),
      bairro: str(end.xBairro),
      municipio: str(end.xMun),
      codigoMunicipio: str(end.cMun),
      uf: str(end.UF),
      cep: str(end.CEP),
      pais: str(end.xPais),
      codigoPais: str(end.cPais),
      fone: str(end.fone) ?? str(foneOuter),
    };
  }

  private parseCarga(infCarga: any): CteCarga {
    if (!infCarga) {
      return { valorCarga: 0, produtoPredominante: '', outrasCaracteristicas: null, quantidades: [] };
    }
    const quantList = arr(infCarga.infQ);
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

  private parseValores(vPrest: any, imp: any): CteValores {
    const componentes: CteValores['componentes'] = [];
    if (vPrest?.Comp) {
      const list = arr(vPrest.Comp);
      for (const c of list) {
        componentes.push({ nome: String(c.xNome ?? ''), valor: num(c.vComp) });
      }
    }

    const icmsBlock = imp?.ICMS;
    const icms = this.parseIcms(icmsBlock);

    // Atalhos legados (mantém UI antiga funcionando)
    const legacyInner = icmsBlock
      ? (icmsBlock.ICMS00 ?? icmsBlock.ICMS20 ?? icmsBlock.ICMS45 ?? icmsBlock.ICMS60 ?? icmsBlock.ICMS90 ?? icmsBlock.ICMSSN ?? icmsBlock.ICMSOutraUF)
      : null;

    return {
      valorTotalPrestacao: num(vPrest?.vTPrest),
      valorReceber: num(vPrest?.vRec),
      componentes,
      vTotTrib: optNum(imp?.vTotTrib),
      icms,
      icmsUFFim: this.parseIcmsUFFim(imp?.ICMSUFFim),
      issqn: this.parseIssqn(imp?.ISSQN),
      infTribFed: this.parseInfTribFed(imp?.infTribFed),
      icmsCst: legacyInner?.CST ?? legacyInner?.CSOSN ?? null,
      icmsBase: optNum(legacyInner?.vBC),
      icmsAliquota: optNum(legacyInner?.pICMS),
      icmsValor: optNum(legacyInner?.vICMS),
    };
  }

  private parseIcms(icmsBlock: any): CteIcms | null {
    if (!icmsBlock) return null;
    // ICMSSN = Simples Nacional (CSOSN); demais (ICMS00, 20, 45, 60, 90, ICMSOutraUF) usam CST
    const inner =
      icmsBlock.ICMS00 ??
      icmsBlock.ICMS20 ??
      icmsBlock.ICMS45 ??
      icmsBlock.ICMS60 ??
      icmsBlock.ICMS90 ??
      icmsBlock.ICMSSN ??
      icmsBlock.ICMSOutraUF ??
      null;
    if (!inner) return null;
    const isSN = !!icmsBlock.ICMSSN;
    return {
      cst: !isSN ? str(inner.CST) : null,
      csosn: isSN ? str(inner.CSOSN ?? inner.indSN) : null,
      modalidadeBase: str(inner.modBC),
      vBC: optNum(inner.vBC),
      pICMS: optNum(inner.pICMS),
      vICMS: optNum(inner.vICMS),
      vBCSTRet: optNum(inner.vBCSTRet),
      vICMSSTRet: optNum(inner.vICMSSTRet),
      pRedBC: optNum(inner.pRedBC),
      vBCSubstituidoPorOutraUF: optNum(inner.vBCOutraUF),
      vICMSSubstituidoPorOutraUF: optNum(inner.vICMSOutraUF),
      pCredSN: optNum(inner.pCredSN),
      vCredICMSSN: optNum(inner.vCredICMSSN),
    };
  }

  private parseIcmsUFFim(icmsUFFim: any): CteIcmsUFFim | null {
    if (!icmsUFFim) return null;
    return {
      vBCUFFim: optNum(icmsUFFim.vBCUFFim),
      pFCPUFFim: optNum(icmsUFFim.pFCPUFFim),
      pICMSUFFim: optNum(icmsUFFim.pICMSUFFim),
      pICMSInter: optNum(icmsUFFim.pICMSInter),
      vFCPUFFim: optNum(icmsUFFim.vFCPUFFim),
      vICMSUFFim: optNum(icmsUFFim.vICMSUFFim),
      vICMSUFIni: optNum(icmsUFFim.vICMSUFIni),
    };
  }

  private parseIssqn(issqn: any): CteIssqn | null {
    if (!issqn) return null;
    return {
      vBC: optNum(issqn.vBC),
      vAliq: optNum(issqn.vAliq),
      vISSQN: optNum(issqn.vISSQN),
      cMunFG: str(issqn.cMunFG),
      cListServ: str(issqn.cListServ),
      vDeducao: optNum(issqn.vDeducao),
      vOutro: optNum(issqn.vOutro),
      vDescIncond: optNum(issqn.vDescIncond),
      vDescCond: optNum(issqn.vDescCond),
      cSitTrib: str(issqn.cSitTrib),
      indISS: str(issqn.indISS),
      cServico: str(issqn.cServico),
      indIncentivo: str(issqn.indIncentivo),
    };
  }

  private parseInfTribFed(infTribFed: any): CteInfTribFed | null {
    if (!infTribFed) return null;
    return {
      vPIS: optNum(infTribFed.vPIS),
      vCOFINS: optNum(infTribFed.vCOFINS),
      vIR: optNum(infTribFed.vIR),
      vCSLL: optNum(infTribFed.vCSLL),
      vINSS: optNum(infTribFed.vINSS),
      infAdFisco: str(infTribFed.infAdFisco),
    };
  }

  private parseDocumentos(infDoc: any): CteDocumentoTransportado[] {
    if (!infDoc) return [];
    const out: CteDocumentoTransportado[] = [];
    if (infDoc.infNFe) {
      const list = arr(infDoc.infNFe);
      for (const n of list) {
        out.push({
          chaveNFe: String(n.chave ?? ''),
          pin: str(n.PIN),
        });
      }
    }
    if (infDoc.infNF) {
      const list = arr(infDoc.infNF);
      for (const n of list) {
        out.push({
          numeroNF: String(n.nDoc ?? ''),
          serie: String(n.serie ?? ''),
          valor: optNum(n.valor),
          pesoTotal: optNum(n.pesoTotal),
        });
      }
    }
    if (infDoc.infOutros) {
      const list = arr(infDoc.infOutros);
      for (const n of list) {
        out.push({
          tipoOutro: str(n.tpDoc),
          descOutro: str(n.descOutros),
          numeroOutro: str(n.nDoc),
          valor: optNum(n.vDocFisc),
        });
      }
    }
    return out;
  }

  private parseUnidadesTransporte(infDoc: any): CteUnidadeTransporte[] {
    if (!infDoc?.infUnidTransp) return [];
    const list = arr(infDoc.infUnidTransp);
    return list.map((u: any) => ({
      tipoUnidade: str(u.tpUnidTransp),
      identificacao: str(u.idUnidTransp),
      lacres: arr(u.lacUnidTransp).map((l: any) => String(l.nLacre ?? '')).filter(Boolean),
      qtdRat: optNum(u.qtdRat),
    }));
  }

  private parseUnidadesCarga(infDoc: any): CteUnidadeCarga[] {
    const out: CteUnidadeCarga[] = [];
    if (!infDoc) return out;
    // Pode estar dentro de infUnidTransp ou direto
    const list = arr(infDoc.infUnidCarga);
    for (const u of list) {
      out.push({
        tipoUnidade: str(u.tpUnidCarga),
        identificacao: str(u.idUnidCarga),
        lacres: arr(u.lacUnidCarga).map((l: any) => String(l.nLacre ?? '')).filter(Boolean),
        qtdRat: optNum(u.qtdRat),
      });
    }
    // Também buscar dentro de cada infUnidTransp[].infUnidCarga[]
    const transp = arr(infDoc.infUnidTransp);
    for (const t of transp) {
      const carg = arr(t.infUnidCarga);
      for (const u of carg) {
        out.push({
          tipoUnidade: str(u.tpUnidCarga),
          identificacao: str(u.idUnidCarga),
          lacres: arr(u.lacUnidCarga).map((l: any) => String(l.nLacre ?? '')).filter(Boolean),
          qtdRat: optNum(u.qtdRat),
        });
      }
    }
    return out;
  }

  private parseDocumentosAnteriores(inf: any): CteDocumentoAnterior[] {
    const out: CteDocumentoAnterior[] = [];

    // CT-e Complemento — referência ao CT-e original
    if (inf.infCteComp?.chCTe) {
      out.push({ tipo: 'CTe', chave: String(inf.infCteComp.chCTe) });
    }

    // CT-e Anulação
    if (inf.infCteAnu?.chCte) {
      out.push({
        tipo: 'CTe',
        chave: String(inf.infCteAnu.chCte),
        dataEmissao: str(inf.infCteAnu.dEmi),
      });
    }

    // CT-e Substituto
    if (inf.infCteSub?.chCte) {
      out.push({ tipo: 'CTe', chave: String(inf.infCteSub.chCte) });
    }

    // Documentos anteriores genéricos (infDocAnt)
    const docAnt = inf.infCTeNorm?.infDocAnt;
    if (docAnt) {
      const emis = arr(docAnt.emiDocAnt);
      for (const e of emis) {
        const cnpj = str(e.CNPJ);
        const idDocs = arr(e.idDocAnt);
        for (const d of idDocs) {
          // Pode ter idDocAntEle (eletrônico — chave) ou idDocAntPap (papel)
          const ele = arr(d.idDocAntEle);
          for (const x of ele) {
            out.push({
              tipo: 'CTe',
              chave: str(x.chCTe),
              cnpjEmitente: cnpj,
            });
          }
          const pap = arr(d.idDocAntPap);
          for (const x of pap) {
            out.push({
              tipo: 'NF',
              modelo: str(x.tpDoc),
              serie: str(x.serie),
              subserie: str(x.subser),
              numero: str(x.nDoc),
              dataEmissao: str(x.dEmi),
              cnpjEmitente: cnpj,
            });
          }
        }
      }
    }

    return out;
  }

  private parseModal(modalidade: string, infCTeNorm: any): CteModal {
    if (!infCTeNorm) return null;
    // CT-e 4.00: bloco do modal específico fica dentro de <infModal>.
    // Algumas implementações antigas/mal-formadas colocam direto em infCTeNorm
    // — cobrimos os 2 caminhos.
    const infModal = infCTeNorm.infModal ?? infCTeNorm;
    switch (modalidade) {
      case '01':
        return this.parseModalRodoviario(infModal.rodo);
      case '02':
        return this.parseModalAereo(infModal.aereo);
      case '03':
        return this.parseModalAquaviario(infModal.aquav);
      case '04':
        return this.parseModalFerroviario(infModal.ferrov);
      case '05':
        return this.parseModalDutoviario(infModal.duto);
      case '06':
        return this.parseModalMultimodal(infModal.multimodal);
      default:
        return null;
    }
  }

  private parseModalRodoviario(rodo: any): CteModalRodoviario | null {
    if (!rodo) return null;
    const ocorrList = arr(rodo.ocorr);
    const motoristasList = arr(rodo.moto ?? rodo.veicNovos);
    const reboquesList = arr(rodo.veicReboque);
    const valePedagioList = arr(rodo.valePed);

    return {
      modalidade: '01',
      rntrc: str(rodo.RNTRC),
      ocorrencias: ocorrList.map((o: any) => ({
        descricao: String(o.descOcorr ?? ''),
        data: String(o.dhOcorr ?? ''),
      })),
      veiculo: rodo.veic ? this.parseVeiculo(rodo.veic) : null,
      reboques: reboquesList.map((r: any) => this.parseVeiculo(r)).filter((v): v is CteModalRodoviarioVeiculo => v !== null),
      motoristas: motoristasList
        .filter((m: any) => m && (m.CPF || m.xNome))
        .map((m: any) => ({ cpf: str(m.CPF), nome: str(m.xNome) })),
      valesPedagio: valePedagioList.map((v: any) => ({
        cnpjFornecedor: str(v.CNPJForn),
        cnpjResponsavel: str(v.CNPJPg),
        numeroComprovante: str(v.nCompra),
        valor: optNum(v.vValePed),
        tipoVale: str(v.tpVale),
      })),
    };
  }

  private parseVeiculo(veic: any): CteModalRodoviarioVeiculo {
    const prop = veic.prop ?? null;
    return {
      placa: str(veic.placa),
      renavam: str(veic.RENAVAM),
      ufPlaca: str(veic.UF),
      proprietario: prop
        ? {
            cnpj: str(prop.CNPJ),
            cpf: str(prop.CPF),
            razaoSocial: str(prop.xNome),
            rntrc: str(prop.RNTRC),
            inscricaoEstadual: str(prop.IE),
            uf: str(prop.UF),
            tipoProprietario: str(prop.tpProp),
          }
        : null,
      tipoRodado: str(veic.tpRod),
      tipoCarroceria: str(veic.tpCar),
      tara: optNum(veic.tara),
      capacidadeKG: optNum(veic.capKG),
      capacidadeM3: optNum(veic.capM3),
    };
  }

  private parseModalAereo(aereo: any): CteModalAereo | null {
    if (!aereo) return null;
    const tarifa = aereo.tarifa ?? null;
    const natCarga = aereo.natCarga ?? null;
    return {
      modalidade: '02',
      numeroMinuta: str(aereo.nMinu),
      numeroOperacionalAWB: str(aereo.nOCA),
      dataPrevistaEntrega: str(aereo.dPrevAereo),
      natCarga: natCarga
        ? {
            xDime: str(natCarga.xDime),
            cInfManu: arr(natCarga.cInfManu).map((c: any) => String(c)),
          }
        : null,
      tarifa: tarifa
        ? {
            classeTarifa: str(tarifa.CL),
            codigoTarifa: str(tarifa.cTar),
            valorTarifa: optNum(tarifa.vTar),
          }
        : null,
    };
  }

  private parseModalAquaviario(aquav: any): CteModalAquaviario | null {
    if (!aquav) return null;
    const balsasList = arr(aquav.balsa);
    const detContList = arr(aquav.detCont);
    return {
      modalidade: '03',
      vPrest: optNum(aquav.vPrest),
      vAFRMM: optNum(aquav.vAFRMM),
      xNavio: str(aquav.xNavio),
      balsas: balsasList.map((b: any) => ({ xBalsa: str(b.xBalsa) })),
      numeroBookings: str(aquav.nBooking),
      numeroCE: str(aquav.nCtrl),
      numeroBL: str(aquav.nBL),
      direcao: str(aquav.direc),
      irinNavio: str(aquav.irin),
      tipoNavegacao: str(aquav.tpNav),
      detContainers: detContList.map((d: any) => ({
        nCont: str(d.nCont),
        lacres: arr(d.lacre).map((l: any) => String(l.nLacre ?? '')).filter(Boolean),
        detNFe: arr(d.detNFe).map((n: any) => ({ nNF: str(n.nNF), chave: str(n.chave) })),
      })),
    };
  }

  private parseModalFerroviario(ferrov: any): CteModalFerroviario | null {
    if (!ferrov) return null;
    const trafMutuo = ferrov.trafMut ?? null;
    return {
      modalidade: '04',
      tipoTrafego: str(ferrov.tpTraf),
      trafegoMutuo: trafMutuo
        ? {
            respFat: str(trafMutuo.respFat),
            ferrEmi: str(trafMutuo.ferrEmi),
            fluxoPagamento: str(trafMutuo.fluxo),
            icmsTransporte: optNum(trafMutuo.vFrete),
            chaveCTe: str(trafMutuo.chCTe),
          }
        : null,
      fluxoFerroviario: str(ferrov.fluxo),
    };
  }

  private parseModalDutoviario(duto: any): CteModalDutoviario | null {
    if (!duto) return null;
    return {
      modalidade: '05',
      valorTarifa: optNum(duto.vTar),
      dataInicio: str(duto.dIni),
      dataFim: str(duto.dFim),
    };
  }

  private parseModalMultimodal(multimodal: any): CteModalMultimodal | null {
    if (!multimodal) return null;
    return {
      modalidade: '06',
      cotm: str(multimodal.COTM),
      indicadorNegociavel: str(multimodal.indNegociavel),
      seguro: this.parseSeguro(multimodal.seg),
    };
  }

  private parseSeguro(seg: any): CteSeguro | null {
    if (!seg) return null;
    const resp = seg.respSeg ? String(seg.respSeg) : null;
    return {
      responsavelSeguro: resp,
      responsavelDescricao: resp ? (RESPONSAVEL_SEGURO_MAP[resp] ?? resp) : null,
      nomeSeguradora: str(seg.xSeg),
      cnpjSeguradora: str(seg.CNPJ),
      numeroApolice: str(seg.nApol),
      numeroAverbacao: str(seg.nAver),
      valorCarga: optNum(seg.vCarga),
      valorAverbado: optNum(seg.vMerc),
    };
  }

  private extrairSeguroDoModal(modal: CteModal): CteSeguro | null {
    if (!modal) return null;
    if (modal.modalidade === '06' && modal.seguro) return modal.seguro;
    return null;
  }

  private parseInfoAdicionais(inf: any): CteInfoAdicionais {
    const compl = inf.compl ?? {};
    const obsList = arr(compl.ObsCont);
    const obsFiscoList = arr(compl.ObsFisco);
    const autXmlList = arr(inf.autXML);

    return {
      observacoes: str(compl.xObs),
      infAdFisco: str(compl.infAdFisco) ?? str(inf.infAdFisco),
      infCpl: str(compl.infCpl) ?? str(inf.infCpl),
      emailEntrega: str(compl.email),
      observacoesContribuinte: obsList.map((o: any) => ({
        xTexto: String(o.xTexto ?? ''),
        xCampo: str(o['@_xCampo']) ?? str(o.xCampo),
      })),
      observacoesFiscais: obsFiscoList.map((o: any) => ({
        xTexto: String(o.xTexto ?? ''),
        xCampo: str(o['@_xCampo']) ?? str(o.xCampo),
      })),
      autorizadosBaixarXml: autXmlList.map((a: any) => ({
        cnpj: str(a.CNPJ),
        cpf: str(a.CPF),
      })),
    };
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
      digestValue: str(inf.digVal),
      versaoAplicacao: str(inf.verAplic),
      chave: str(inf.chCTe),
    };
  }
}

// ====================== Helpers ======================

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
function arr<T = any>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}
