import { BadRequestException, Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import type {
  NfeCobranca,
  NfeDadosGerais,
  NfeEmitenteDestinatario,
  NfeEventoDetalhe,
  NfeEventoInfo,
  NfeParsed,
  NfeProduto,
  NfeProtocoloAutorizacao,
  NfeTotais,
  NfeTransporte,
} from './nfe-parsed.interface.js';

const TIPO_OP_MAP: Record<string, 'Entrada' | 'Saída'> = { '0': 'Entrada', '1': 'Saída' };
const FINALIDADE_MAP: Record<string, string> = {
  '1': 'Normal',
  '2': 'Complementar',
  '3': 'Ajuste',
  '4': 'Devolução',
};
const MOD_FRETE_MAP: Record<string, string> = {
  '0': 'Contratação do Frete por Conta do Remetente',
  '1': 'Contratação do Frete por Conta do Destinatário',
  '2': 'Contratação do Frete por Conta de Terceiros',
  '3': 'Transporte Próprio por Conta do Remetente',
  '4': 'Transporte Próprio por Conta do Destinatário',
  '9': 'Sem Ocorrência de Transporte',
};
const REGIME_TRIBUTARIO_MAP: Record<string, string> = {
  '1': 'Simples Nacional',
  '2': 'Simples Nacional — excesso de sublimite de receita bruta',
  '3': 'Regime Normal',
  '4': 'MEI — Microempreendedor Individual',
};
const PROC_EMISSAO_MAP: Record<string, string> = {
  '0': 'Emissão com aplicativo do Contribuinte',
  '1': 'Emissão avulsa pelo Fisco',
  '2': 'Emissão avulsa pelo Contribuinte com site do Fisco',
  '3': 'Emissão NF-e pelo contribuinte com aplicativo fornecido pelo Fisco',
};
const IND_PRESENCA_MAP: Record<string, string> = {
  '0': 'Não se aplica',
  '1': 'Operação presencial',
  '2': 'Operação não presencial, pela Internet',
  '3': 'Operação não presencial, Teleatendimento',
  '4': 'NFC-e em operação com entrega a domicílio',
  '5': 'Operação presencial, fora do estabelecimento',
  '9': 'Operação não presencial (outros)',
};
const IND_DESTINO_MAP: Record<string, string> = {
  '1': 'Operação Interna',
  '2': 'Operação Interestadual',
  '3': 'Operação com exterior',
};
const CONSUMIDOR_FINAL_MAP: Record<string, string> = {
  '0': 'Normal',
  '1': 'Consumidor final',
};
const IND_INTERMED_MAP: Record<string, string> = {
  '0': 'Operação sem intermediador',
  '1': 'Operação em site ou plataforma de terceiros (intermediadores/marketplace)',
};
const IND_IE_DEST_MAP: Record<string, string> = {
  '1': 'Contribuinte ICMS (informar a IE do destinatário)',
  '2': 'Contribuinte isento de Inscrição no cadastro de Contribuintes',
  '9': 'Não Contribuinte, que pode ou não possuir Inscrição',
};
const IND_PAG_MAP: Record<string, string> = {
  '0': 'Pagamento à vista',
  '1': 'Pagamento a prazo',
  '2': 'Outros',
};
const MEIO_PAG_MAP: Record<string, string> = {
  '01': 'Dinheiro',
  '02': 'Cheque',
  '03': 'Cartão de Crédito',
  '04': 'Cartão de Débito',
  '05': 'Crédito Loja',
  '10': 'Vale Alimentação',
  '11': 'Vale Refeição',
  '12': 'Vale Presente',
  '13': 'Vale Combustível',
  '14': 'Duplicata Mercantil',
  '15': 'Boleto Bancário',
  '16': 'Depósito Bancário',
  '17': 'Pagamento Instantâneo (PIX)',
  '18': 'Transferência bancária, Carteira Digital',
  '19': 'Programa de fidelidade, Cashback, Crédito Virtual',
  '90': 'Sem pagamento',
  '99': 'Outros',
};
const IND_ESCALA_MAP: Record<string, string> = {
  S: 'Produzido em Escala Relevante',
  N: 'Produzido em Escala NÃO Relevante',
};
const IND_TOTAL_MAP: Record<string, string> = {
  '0': 'O valor do item (vProd) não compõe o valor total da NF-e',
  '1': 'O valor do item (vProd) compõe o valor total da NF-e (vProd)',
};
const ICMS_ORIG_MAP: Record<string, string> = {
  '0': 'Nacional, exceto as indicadas nos códigos 3 a 5, 8',
  '1': 'Estrangeira - Importação direta, exceto a indicada no código 6',
  '2': 'Estrangeira - Adquirida no Mercado Interno',
  '3': 'Nacional, mercadoria ou bem com CI superior a 40%',
  '4': 'Nacional, cuja produção tenha sido feita em conformidade com processos produtivos básicos',
  '5': 'Nacional, mercadoria ou bem com CI inferior ou igual a 40%',
  '6': 'Estrangeira - Importação direta, sem similar nacional',
  '7': 'Estrangeira - Adquirida no Mercado Interno, sem similar nacional',
  '8': 'Nacional, mercadoria ou bem com CI superior a 70%',
};
const ICMS_CST_MAP: Record<string, string> = {
  '00': 'Tributada integralmente',
  '10': 'Tributada e com cobrança do ICMS por substituição tributária',
  '20': 'Com redução de base de cálculo',
  '30': 'Isenta ou não tributada e com cobrança do ICMS por substituição tributária',
  '40': 'Isenta',
  '41': 'Não tributada',
  '50': 'Suspensão',
  '51': 'Diferimento',
  '60': 'ICMS cobrado anteriormente por substituição tributária',
  '70': 'Com redução de base de cálculo e cobrança do ICMS por substituição tributária',
  '90': 'Outras',
};
/**
 * Códigos CSOSN — Código de Situação da Operação no Simples Nacional.
 * Aplicável quando o emitente é optante pelo Simples Nacional (CRT=1 ou 2).
 * Anexo III da NT 2010/001.
 */
const ICMS_CSOSN_MAP: Record<string, string> = {
  '101': 'Tributada pelo Simples Nacional com permissão de crédito',
  '102': 'Tributada pelo Simples Nacional sem permissão de crédito',
  '103': 'Isenção do ICMS no Simples Nacional para faixa de receita bruta',
  '201': 'Tributada pelo Simples Nacional com permissão de crédito e com cobrança do ICMS por substituição tributária',
  '202': 'Tributada pelo Simples Nacional sem permissão de crédito e com cobrança do ICMS por substituição tributária',
  '203': 'Isenção do ICMS no Simples Nacional para faixa de receita bruta e com cobrança do ICMS por substituição tributária',
  '300': 'Imune',
  '400': 'Não tributada pelo Simples Nacional',
  '500': 'ICMS cobrado anteriormente por substituição tributária (substituído) ou por antecipação',
  '900': 'Outros',
};
const MOD_BC_MAP: Record<string, string> = {
  '0': 'Margem Valor Agregado (%)',
  '1': 'Pauta (valor)',
  '2': 'Preço Tabelado Máximo (valor)',
  '3': 'Valor da Operação',
};
const MOD_BC_ST_MAP: Record<string, string> = {
  '0': 'Preço tabelado ou máximo sugerido',
  '1': 'Lista Negativa (valor)',
  '2': 'Lista Positiva (valor)',
  '3': 'Lista Neutra (valor)',
  '4': 'Margem Valor Agregado (%)',
  '5': 'Pauta (valor)',
  '6': 'Valor da Operação',
};
/**
 * Motivo de desoneração do ICMS — NT 2016/002 Anexo II. Aplicável tanto ao
 * ICMS Normal (motDesICMS) quanto ao ICMS ST (motDesICMSST) — mesmos códigos.
 */
const MOT_DES_ICMS_MAP: Record<string, string> = {
  '1': 'Táxi',
  '3': 'Produtor Agropecuário',
  '4': 'Frotista/Locadora',
  '5': 'Diplomático/Consular',
  '6': 'Utilitários e Motocicletas da Amazônia Ocidental e Áreas de Livre Comércio',
  '7': 'SUFRAMA',
  '8': 'Venda a Órgão Público',
  '9': 'Outros',
  '10': 'Deficiente Condutor',
  '11': 'Deficiente Não Condutor',
  '12': 'Órgão de Fomento e Desenvolvimento Agropecuário',
  '16': 'Olimpíadas Rio 2016',
  '90': 'Solicitado pelo Fisco',
};
export const ORGAO_RECEPCAO_MAP: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP',
  '17': 'TO', '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB',
  '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES',
  '33': 'RJ', '35': 'SP', '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS',
  '51': 'MT', '52': 'GO', '53': 'DF',
  '91': 'AMBIENTE NACIONAL',
};
const TP_EVENTO_MAP: Record<string, string> = {
  '110110': 'Carta de Correção (CC-e)',
  '110111': 'Cancelamento',
  '110112': 'Cancelamento por substituição',
  '110113': 'EPEC',
  '110140': 'EPEC',
  '210200': 'Confirmação da Operação',
  '210210': 'Ciência da Operação',
  '210220': 'Desconhecimento da Operação',
  '210240': 'Operação não Realizada',
  '310610': 'MDF-e Autorizado vinculado ao CT-e',
  '310620': 'Cancelamento de MDF-e vinculado ao CT-e',
  '510620': 'CT-e Autorizado',
  '510630': 'Registro de Passagem (MDFe)',
};
const FORMATO_DANFE_MAP: Record<string, string> = {
  '0': 'Sem geração de DANFE',
  '1': 'DANFE normal, retrato',
  '2': 'DANFE normal, paisagem',
  '3': 'DANFE Simplificado',
  '4': 'DANFE NFC-e',
  '5': 'DANFE NFC-e em mensagem eletrônica',
};

/**
 * Parser NF-e 4.00 — aceita `<nfeProc>` (com protocolo) ou `<NFe>` isolado.
 * Responsável pelo conteúdo das abas do frontend; NÃO executa validação XSD
 * nem verifica assinatura (isso é feito pelo Protheus no POST /xmlFiscal).
 */
@Injectable()
export class NfeParserService {
  private readonly xmlParser: XMLParser;

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: true,
      parseTagValue: false, // mantém strings — converto só o necessário
      trimValues: true,
      removeNSPrefix: true, // remove xmlns
    });
  }

  parse(xml: string): NfeParsed {
    let root: any;
    try {
      root = this.xmlParser.parse(xml);
    } catch (err) {
      throw new BadRequestException(`XML inválido: ${(err as Error).message}`);
    }

    const nfeProc = root?.nfeProc;
    const NFe = nfeProc?.NFe ?? root?.NFe;
    if (!NFe) {
      throw new BadRequestException('Estrutura <NFe> não encontrada — não é um XML de NF-e.');
    }
    const inf = NFe.infNFe;
    if (!inf) {
      throw new BadRequestException('Bloco <infNFe> ausente.');
    }

    const versaoXml = str(inf['@_versao']) ?? str(NFe['@_versao']);
    const dadosGerais = this.parseDadosGerais(inf);
    dadosGerais.versaoXml = versaoXml ?? null;
    dadosGerais.digestValue = str(NFe.Signature?.SignedInfo?.Reference?.DigestValue) ?? null;
    const emitente = this.parseEmitente(inf.emit);
    const destinatario = this.parseDestinatario(inf.dest);
    const produtos = this.parseProdutos(inf.det);
    const totais = this.parseTotais(inf.total?.ICMSTot, inf.total?.IBSCBSTot);
    const transporte = this.parseTransporte(inf.transp);
    const cobranca = this.parseCobranca(inf.cobr, inf.pag);
    const autorizadosXml = this.parseAutorizadosXml(inf.autXML);
    const protocolo = nfeProc ? this.parseProtocolo(nfeProc.protNFe) : null;
    const eventos: NfeEventoInfo[] = []; // recém-baixado não tem eventos

    const formatoDanfe = str(inf.ide?.tpImp);
    return {
      dadosGerais,
      emitente,
      destinatario,
      produtos,
      totais,
      transporte,
      cobranca,
      eventos,
      protocoloAutorizacao: protocolo,
      autorizadosXml,
      informacoesAdicionais: inf.infAdic || formatoDanfe
        ? {
            informacoesComplementares: str(inf.infAdic?.infCpl),
            informacoesFisco: str(inf.infAdic?.infAdFisco),
            formatoImpressaoDanfe: formatoDanfe,
            formatoImpressaoDanfeDescricao:
              formatoDanfe && FORMATO_DANFE_MAP[formatoDanfe]
                ? FORMATO_DANFE_MAP[formatoDanfe]
                : null,
          }
        : null,
    };
  }

  // ---------- dados gerais ----------

  private parseDadosGerais(inf: any): NfeDadosGerais {
    const id: string = String(inf['@_Id'] ?? '');
    const chave = id.replace(/^NFe/, '').trim();
    if (!/^\d{44}$/.test(chave)) {
      throw new BadRequestException(`Chave extraída do XML é inválida: "${chave}"`);
    }
    const ide = inf.ide ?? {};
    const tipoOperacao = String(ide.tpNF ?? '1') as '0' | '1';
    const finalidade = String(ide.finNFe ?? '1');
    const procEmi = String(ide.procEmi ?? '0');
    const indPres = String(ide.indPres ?? '');
    const idDest = str(ide.idDest);
    const indFinal = str(ide.indFinal);
    const indIntermed = str(ide.indIntermed);

    return {
      chave,
      modelo: String(ide.mod ?? '55'),
      serie: String(ide.serie ?? ''),
      numero: String(ide.nNF ?? ''),
      dataEmissao: String(ide.dhEmi ?? ide.dEmi ?? ''),
      dataSaidaEntrada: str(ide.dhSaiEnt ?? ide.dSaiEnt),
      tipoOperacao,
      tipoOperacaoDescricao: TIPO_OP_MAP[tipoOperacao] ?? 'Saída',
      finalidade,
      finalidadeDescricao: FINALIDADE_MAP[finalidade] ?? finalidade,
      naturezaOperacao: String(ide.natOp ?? ''),
      ufEmitente: String(ide.cUF ?? ''),
      codigoMunicipioFatoGerador: String(ide.cMunFG ?? ''),
      digitoChave: String(ide.cDV ?? chave.slice(-1)),
      ambiente: String(ide.tpAmb ?? '1') as '1' | '2',
      processoEmissao: procEmi,
      processoEmissaoDescricao: PROC_EMISSAO_MAP[procEmi] ?? null,
      versaoProcesso: String(ide.verProc ?? ''),
      indicadorPresenca: indPres,
      indicadorPresencaDescricao: IND_PRESENCA_MAP[indPres] ?? null,
      indicadorDestino: idDest,
      indicadorDestinoDescricao: idDest ? IND_DESTINO_MAP[idDest] ?? null : null,
      consumidorFinal: indFinal,
      consumidorFinalDescricao: indFinal ? CONSUMIDOR_FINAL_MAP[indFinal] ?? null : null,
      indicadorIntermediador: indIntermed,
      indicadorIntermediadorDescricao: indIntermed ? IND_INTERMED_MAP[indIntermed] ?? null : null,
    };
  }

  // ---------- emitente / destinatário ----------

  private parseEmitente(emit: any): NfeEmitenteDestinatario {
    if (!emit) throw new BadRequestException('Bloco <emit> ausente.');
    const crt = str(emit.CRT);
    return {
      cnpj: str(emit.CNPJ),
      cpf: str(emit.CPF),
      razaoSocial: String(emit.xNome ?? ''),
      nomeFantasia: str(emit.xFant),
      inscricaoEstadual: str(emit.IE),
      inscricaoEstadualSubstituto: str(emit.IEST),
      inscricaoMunicipal: str(emit.IM),
      cnae: str(emit.CNAE),
      regimeTributario: crt,
      regimeTributarioDescricao: crt ? REGIME_TRIBUTARIO_MAP[crt] ?? null : null,
      endereco: this.parseEndereco(emit.enderEmit),
    };
  }

  private parseDestinatario(dest: any): NfeEmitenteDestinatario {
    if (!dest) throw new BadRequestException('Bloco <dest> ausente.');
    const indIE = str(dest.indIEDest);
    return {
      cnpj: str(dest.CNPJ),
      cpf: str(dest.CPF),
      razaoSocial: String(dest.xNome ?? ''),
      nomeFantasia: str(dest.xFant),
      inscricaoEstadual: str(dest.IE),
      inscricaoMunicipal: str(dest.IM),
      email: str(dest.email),
      indicadorIE: indIE,
      indicadorIEDescricao: indIE ? IND_IE_DEST_MAP[indIE] ?? null : null,
      suframa: str(dest.ISUF),
      endereco: this.parseEndereco(dest.enderDest),
    };
  }

  private parseAutorizadosXml(autXML: any): Array<{ cnpj?: string | null; cpf?: string | null }> {
    if (!autXML) return [];
    const list = Array.isArray(autXML) ? autXML : [autXML];
    return list.map((a) => ({
      cnpj: str(a.CNPJ),
      cpf: str(a.CPF),
    }));
  }

  private parseEndereco(end: any): NfeEmitenteDestinatario['endereco'] {
    if (!end) return {};
    return {
      logradouro: str(end.xLgr),
      numero: str(end.nro),
      complemento: str(end.xCpl),
      bairro: str(end.xBairro),
      codigoMunicipio: str(end.cMun),
      municipio: str(end.xMun),
      uf: str(end.UF),
      cep: str(end.CEP),
      codigoPais: str(end.cPais),
      pais: str(end.xPais),
      telefone: str(end.fone),
    };
  }

  // ---------- produtos ----------

  private parseProdutos(det: any): NfeProduto[] {
    if (!det) return [];
    const list = Array.isArray(det) ? det : [det];
    return list.map((d) => this.parseProduto(d));
  }

  private parseProduto(d: any): NfeProduto {
    const prod = d.prod ?? {};
    const imposto = d.imposto ?? {};
    const icms = this.firstIcms(imposto.ICMS);
    const ipi = imposto.IPI?.IPITrib ?? imposto.IPI?.IPINT ?? null;
    const pis = imposto.PIS?.PISAliq ?? imposto.PIS?.PISNT ?? imposto.PIS?.PISOutr ?? null;
    const cofins = imposto.COFINS?.COFINSAliq ?? imposto.COFINS?.COFINSNT ?? imposto.COFINS?.COFINSOutr ?? null;

    const icmsParsed = this.parseIcmsProduto(icms);
    const ibsCbs = this.parseIbsCbsProduto(imposto.IBSCBS);

    const indEscala = str(prod.indEscala);
    const indTotal = str(prod.indTot);

    return {
      item: Number(d['@_nItem'] ?? 0),
      codigo: String(prod.cProd ?? ''),
      ean: str(prod.cEAN),
      descricao: String(prod.xProd ?? ''),
      ncm: str(prod.NCM),
      cest: str(prod.CEST),
      cBenef: str(prod.cBenef),
      cnpjFabricante: str(prod.CNPJFab),
      exTipi: str(prod.EXTIPI),
      indEscala,
      indEscalaDescricao: indEscala ? IND_ESCALA_MAP[indEscala] ?? null : null,
      indTotal,
      indTotalDescricao: indTotal ? IND_TOTAL_MAP[indTotal] ?? null : null,
      nFci: str(prod.nFCI),
      cfop: String(prod.CFOP ?? ''),
      unidadeComercial: String(prod.uCom ?? ''),
      quantidadeComercial: num(prod.qCom),
      valorUnitarioComercial: num(prod.vUnCom),
      valorTotalBruto: num(prod.vProd),
      eanTributavel: str(prod.cEANTrib),
      unidadeTributavel: str(prod.uTrib),
      quantidadeTributavel: optNum(prod.qTrib),
      valorUnitarioTributavel: optNum(prod.vUnTrib),
      valorDesconto: optNum(prod.vDesc),
      valorFrete: optNum(prod.vFrete),
      valorSeguro: optNum(prod.vSeg),
      valorOutros: optNum(prod.vOutro),
      pedidoCompra: str(prod.xPed),
      numeroItemPedido: str(prod.nItemPed),
      valorAproximadoTributosItem: optNum(d.vItem),
      impostos: {
        icms: icmsParsed,
        ibsCbs,
        ipiCst: ipi?.CST ?? null,
        ipiAliquota: optNum(ipi?.pIPI),
        ipiValor: optNum(ipi?.vIPI),
        pisCst: pis?.CST ?? null,
        pisBase: optNum(pis?.vBC),
        pisAliquota: optNum(pis?.pPIS),
        pisValor: optNum(pis?.vPIS),
        cofinsCst: cofins?.CST ?? null,
        cofinsBase: optNum(cofins?.vBC),
        cofinsAliquota: optNum(cofins?.pCOFINS),
        cofinsValor: optNum(cofins?.vCOFINS),
        // campos legados (flat) mantidos por compat
        icmsCst: icmsParsed.cst,
        icmsOrig: icmsParsed.orig,
        icmsBase: icmsParsed.base,
        icmsAliquota: icmsParsed.aliquota,
        icmsValor: icmsParsed.valor,
      },
      informacoesAdicionais: str(d.infAdProd),
    };
  }

  /**
   * ICMS vem com um nó child dinâmico (ICMS00, ICMS10, ..., ICMS90, ICMSSN101, etc.).
   * Retorna o primeiro sub-bloco encontrado, que é o que de fato contém os dados.
   */
  private firstIcms(icmsBlock: any): any {
    if (!icmsBlock || typeof icmsBlock !== 'object') return null;
    const keys = Object.keys(icmsBlock);
    if (keys.length === 0) return null;
    return icmsBlock[keys[0]];
  }

  /** Mapeia o sub-bloco ICMSxx ou ICMSSNxxx para a estrutura canônica. */
  private parseIcmsProduto(icms: any): import('./nfe-parsed.interface.js').NfeIcmsProduto {
    if (!icms) return {};
    const cst = str(icms.CST ?? icms.CSOSN);
    const orig = str(icms.orig);
    const modBC = str(icms.modBC);
    const modBCST = str(icms.modBCST);
    const motDes = str(icms.motDesICMS);
    const motDesST = str(icms.motDesICMSST);
    // CSOSN tem 3 dígitos (101, 102, 201, 900, etc.), CST normal tem 2 (00, 10, 20...).
    // Tenta CSOSN primeiro — se não tem mapa, cai para CST.
    const cstDescricao = cst
      ? (cst.length === 3 ? ICMS_CSOSN_MAP[cst] : ICMS_CST_MAP[cst]) ?? null
      : null;
    return {
      cst,
      cstDescricao,
      orig,
      origDescricao: orig ? ICMS_ORIG_MAP[orig] ?? null : null,
      modBC,
      modBCDescricao: modBC ? MOD_BC_MAP[modBC] ?? null : null,
      base: optNum(icms.vBC),
      aliquota: optNum(icms.pICMS),
      valor: optNum(icms.vICMS),
      percentualReducaoBC: optNum(icms.pRedBC),
      baseFcp: optNum(icms.vBCFCP),
      percentualFcp: optNum(icms.pFCP),
      valorFcp: optNum(icms.vFCP),
      modBCST,
      modBCSTDescricao: modBCST ? MOD_BC_ST_MAP[modBCST] ?? null : null,
      percentualReducaoBCST: optNum(icms.pRedBCST),
      percentualMvaST: optNum(icms.pMVAST),
      baseST: optNum(icms.vBCST),
      aliquotaST: optNum(icms.pICMSST),
      valorST: optNum(icms.vICMSST),
      baseFcpST: optNum(icms.vBCFCPST),
      percentualFcpST: optNum(icms.pFCPST),
      valorFcpST: optNum(icms.vFCPST),
      baseFcpStRetido: optNum(icms.vBCFCPSTRet),
      percentualFcpStRetido: optNum(icms.pFCPSTRet),
      valorFcpStRetido: optNum(icms.vFCPSTRet),
      valorIcmsSTDesonerado: optNum(icms.vICMSSTDeson),
      motivoDesoneracaoST: motDesST,
      motivoDesoneracaoSTDescricao: motDesST ? MOT_DES_ICMS_MAP[motDesST] ?? null : null,
      valorIcmsDesonerado: optNum(icms.vICMSDeson),
      motivoDesoneracao: motDes,
      motivoDesoneracaoDescricao: motDes ? MOT_DES_ICMS_MAP[motDes] ?? null : null,
      // Simples Nacional — presentes em ICMSSN101, ICMSSN201, ICMSSN900.
      aliquotaCreditoSN: optNum(icms.pCredSN),
      valorCreditoICMSSN: optNum(icms.vCredICMSSN),
    };
  }

  /** Bloco IBSCBS por item (Reforma Tributária — NT 2024.002). */
  private parseIbsCbsProduto(
    ibsCbs: any,
  ): import('./nfe-parsed.interface.js').NfeIbsCbsProduto | null {
    if (!ibsCbs) return null;
    const g = ibsCbs.gIBSCBS ?? {};
    const gIBSUF = g.gIBSUF ?? {};
    const gIBSMun = g.gIBSMun ?? {};
    const gCBS = g.gCBS ?? {};
    const op = str(ibsCbs.gIBSOp?.indOperDoacao);
    return {
      cst: str(ibsCbs.CST),
      cClassTrib: str(ibsCbs.cClassTrib),
      operacaoDoacao: op,
      base: optNum(g.vBC),
      aliquotaIbsUF: optNum(gIBSUF.pIBSUF),
      valorIbsUF: optNum(gIBSUF.vIBSUF),
      aliquotaIbsMun: optNum(gIBSMun.pIBSMun),
      valorIbsMun: optNum(gIBSMun.vIBSMun),
      valorIbsTotal: optNum(g.vIBS),
      aliquotaCbs: optNum(gCBS.pCBS),
      valorCbs: optNum(gCBS.vCBS),
    };
  }

  // ---------- totais ----------

  private parseTotais(icmsTot: any, ibsCbsTot: any): NfeTotais {
    const ibsCbs = this.parseIbsCbsTotais(ibsCbsTot);
    if (!icmsTot) {
      return {
        baseCalculoIcms: 0, valorIcms: 0, valorIcmsDesonerado: 0, valorFcp: 0,
        baseCalculoIcmsSt: 0, valorIcmsSt: 0, valorFcpSt: 0, valorFcpStRetido: 0,
        valorProdutos: 0, valorFrete: 0, valorSeguro: 0, valorDesconto: 0,
        valorII: 0, valorIpi: 0, valorIpiDevolvido: 0, valorPis: 0,
        valorCofins: 0, valorOutros: 0, valorNota: 0, ibsCbs,
      };
    }
    return {
      baseCalculoIcms: num(icmsTot.vBC),
      valorIcms: num(icmsTot.vICMS),
      valorIcmsDesonerado: num(icmsTot.vICMSDeson),
      valorFcp: num(icmsTot.vFCP),
      baseCalculoIcmsSt: num(icmsTot.vBCST),
      valorIcmsSt: num(icmsTot.vST),
      valorFcpSt: num(icmsTot.vFCPST),
      valorFcpStRetido: num(icmsTot.vFCPSTRet),
      valorProdutos: num(icmsTot.vProd),
      valorFrete: num(icmsTot.vFrete),
      valorSeguro: num(icmsTot.vSeg),
      valorDesconto: num(icmsTot.vDesc),
      valorII: num(icmsTot.vII),
      valorIpi: num(icmsTot.vIPI),
      valorIpiDevolvido: num(icmsTot.vIPIDevol),
      valorPis: num(icmsTot.vPIS),
      valorCofins: num(icmsTot.vCOFINS),
      valorOutros: num(icmsTot.vOutro),
      valorNota: num(icmsTot.vNF),
      valorTotalTributos: optNum(icmsTot.vTotTrib),
      ibsCbs,
    };
  }

  private parseIbsCbsTotais(
    ibsCbsTot: any,
  ): import('./nfe-parsed.interface.js').NfeIbsCbsTotais | null {
    if (!ibsCbsTot) return null;
    const gIBS = ibsCbsTot.gIBS ?? {};
    const gIBSUF = gIBS.gIBSUF ?? {};
    const gIBSMun = gIBS.gIBSMun ?? {};
    const gCBS = ibsCbsTot.gCBS ?? {};
    return {
      baseCalculo: num(ibsCbsTot.vBCIBSCBS),
      ibsEstadualDiferimento: num(gIBSUF.vDif),
      ibsEstadualDevolucao: num(gIBSUF.vDevTrib),
      ibsEstadualValor: num(gIBSUF.vIBSUF),
      ibsMunicipalDiferimento: num(gIBSMun.vDif),
      ibsMunicipalDevolucao: num(gIBSMun.vDevTrib),
      ibsMunicipalValor: num(gIBSMun.vIBSMun),
      ibsTotal: num(gIBS.vIBS),
      ibsCreditoPresumido: num(gIBS.vCredPres),
      ibsCreditoPresumidoCondSus: num(gIBS.vCredPresCondSus),
      cbsDiferimento: num(gCBS.vDif),
      cbsDevolucao: num(gCBS.vDevTrib),
      cbsValor: num(gCBS.vCBS),
      cbsCreditoPresumido: num(gCBS.vCredPres),
      cbsCreditoPresumidoCondSus: num(gCBS.vCredPresCondSus),
    };
  }

  // ---------- transporte ----------

  private parseTransporte(transp: any): NfeTransporte {
    if (!transp) {
      return { modalidadeFrete: '9', modalidadeFreteDescricao: MOD_FRETE_MAP['9']!, volumes: [] };
    }
    const modFrete = String(transp.modFrete ?? '9');
    const vols = transp.vol
      ? (Array.isArray(transp.vol) ? transp.vol : [transp.vol]).map((v: any) => ({
          quantidade: optNum(v.qVol),
          especie: str(v.esp),
          marca: str(v.marca),
          numeracao: str(v.nVol),
          pesoLiquido: optNum(v.pesoL),
          pesoBruto: optNum(v.pesoB),
        }))
      : [];
    return {
      modalidadeFrete: modFrete,
      modalidadeFreteDescricao: MOD_FRETE_MAP[modFrete] ?? modFrete,
      transportador: transp.transporta
        ? {
            cnpj: str(transp.transporta.CNPJ),
            cpf: str(transp.transporta.CPF),
            razaoSocial: str(transp.transporta.xNome),
            inscricaoEstadual: str(transp.transporta.IE),
            endereco: str(transp.transporta.xEnder),
            municipio: str(transp.transporta.xMun),
            uf: str(transp.transporta.UF),
          }
        : null,
      veiculo: transp.veicTransp
        ? {
            placa: str(transp.veicTransp.placa),
            uf: str(transp.veicTransp.UF),
            rntc: str(transp.veicTransp.RNTC),
          }
        : null,
      volumes: vols,
    };
  }

  // ---------- cobrança ----------

  private parseCobranca(cobr: any, pag: any): NfeCobranca {
    const fatura = cobr?.fat
      ? {
          numero: str(cobr.fat.nFat),
          valorOriginal: optNum(cobr.fat.vOrig),
          valorDesconto: optNum(cobr.fat.vDesc),
          valorLiquido: optNum(cobr.fat.vLiq),
        }
      : null;
    const duplicatas = cobr?.dup
      ? (Array.isArray(cobr.dup) ? cobr.dup : [cobr.dup]).map((d: any) => ({
          numero: str(d.nDup),
          vencimento: str(d.dVenc),
          valor: optNum(d.vDup),
        }))
      : [];

    // pag/detPag: bloco obrigatório a partir da NT 2020.006 (NF-e 4.00)
    const detPag = pag?.detPag;
    const formasPagamento = detPag
      ? (Array.isArray(detPag) ? detPag : [detPag]).map((p: any) => {
          const indPag = str(p.indPag);
          const tPag = str(p.tPag);
          return {
            indicadorPagamento: indPag,
            indicadorPagamentoDescricao: indPag ? IND_PAG_MAP[indPag] ?? null : null,
            meioPagamento: tPag,
            meioPagamentoDescricao: tPag ? MEIO_PAG_MAP[tPag] ?? null : null,
            descricaoMeioPagamento: str(p.xPag),
            valorPagamento: optNum(p.vPag),
            valorTroco: optNum(pag?.vTroco),
          };
        })
      : [];

    return { fatura, duplicatas, formasPagamento };
  }

  // ---------- detalhe de evento (procEventoNFe) ----------

  /**
   * Parseia o XML de um evento e retorna o detalhe pra UI. Aceita 3 shapes:
   *
   *   1. `<procEventoNFe>` completo (XSD oficial SEFAZ — `<evento>` autoral
   *      + `<retEvento>` resposta + `<Signature>`). Caso ideal — todos os
   *      campos chegam diretamente.
   *   2. `<evento>` autoral isolado — sem `<retEvento>`. Campos de autorização
   *      (cStat, protocolo, dhRegEvento) ficam null.
   *   3. **`<infEvento>` puro** — formato compacto que a equipe Protheus passou
   *      a entregar em 28/04/2026 via `eventosNfe.xmlBase64`. Diferenças do
   *      XSD oficial: `Id`, `versao` e `verEvento` vêm como ELEMENTO em vez
   *      de atributo. Sem `<retEvento>` (caller deve complementar).
   */
  parseEventoXml(xml: string): NfeEventoDetalhe {
    let root: any;
    try {
      root = this.xmlParser.parse(xml);
    } catch (err) {
      throw new BadRequestException(`XML de evento inválido: ${(err as Error).message}`);
    }
    const proc = root?.procEventoNFe ?? root;
    const evento = proc?.evento ?? proc?.Evento;
    const retEvento = proc?.retEvento ?? proc?.RetEvento;
    // Caso 3: shape Protheus — `<infEvento>` puro como root.
    const infEventoPuro = !evento && (root?.infEvento || proc?.infEvento);
    const inf = evento?.infEvento ?? infEventoPuro;
    if (!inf) {
      throw new BadRequestException('Bloco <infEvento> ausente no XML do evento.');
    }
    const ret = retEvento?.infEvento ?? {};
    const detEvento = inf.detEvento ?? {};

    const ambiente = String(inf.tpAmb ?? '1') as '1' | '2';
    const tipoEvento = String(inf.tpEvento ?? '');
    const orgao = str(inf.cOrgao);
    const cnpj = str(inf.CNPJ);
    const cpf = str(inf.CPF);

    const cStatRet = str(ret.cStat);
    const xMotRet = str(ret.xMotivo);

    // Id pode vir como atributo (`@_Id`, XSD oficial) ou elemento (`<Id>`, Protheus 28/04).
    const idEvento = str(inf['@_Id']) ?? str(inf.Id) ?? '';
    // Versão `<verEvento>` (Protheus 28/04 expõe como elemento) ou `@_versao` em <evento> wrapper.
    const versaoEvento =
      str(detEvento['@_versao']) ??
      str(detEvento.versao) ??
      str(inf.verEvento) ??
      null;

    return {
      orgaoRecepcao: orgao,
      orgaoRecepcaoDescricao: orgao ? ORGAO_RECEPCAO_MAP[orgao] ?? null : null,
      ambiente,
      ambienteDescricao: ambiente === '1' ? '1 - Produção' : '2 - Homologação',
      versao: str(evento?.['@_versao']) ?? str(inf['@_versao']) ?? str(inf.verEvento),
      chave: String(inf.chNFe ?? ''),
      idEvento,
      autorCnpj: cnpj,
      autorCpf: cpf,
      dataEvento: String(inf.dhEvento ?? ''),
      tipoEvento,
      tipoEventoDescricao: tipoEvento
        ? `${tipoEvento} - ${TP_EVENTO_MAP[tipoEvento] ?? str(detEvento.descEvento) ?? 'Evento'}`
        : str(detEvento.descEvento) ?? '-',
      sequencial: Number(inf.nSeqEvento ?? 1),
      versaoEvento,
      descricaoEvento: str(detEvento.descEvento),
      justificativa: str(detEvento.xJust),
      autorizacaoCStat: cStatRet,
      autorizacaoMotivo: xMotRet,
      autorizacaoMensagem:
        cStatRet && xMotRet ? `${cStatRet} - ${xMotRet}` : xMotRet ?? cStatRet,
      autorizacaoProtocolo: str(ret.nProt),
      autorizacaoDataHora: str(ret.dhRegEvento),
    };
  }

  // ---------- protocolo ----------

  private parseProtocolo(protNFe: any): NfeProtocoloAutorizacao | null {
    if (!protNFe?.infProt) return null;
    const inf = protNFe.infProt;
    return {
      protocolo: String(inf.nProt ?? ''),
      dataRecebimento: String(inf.dhRecbto ?? ''),
      cStat: String(inf.cStat ?? ''),
      motivo: String(inf.xMotivo ?? ''),
      ambiente: String(inf.tpAmb ?? '1') as '1' | '2',
    };
  }
}

// ---------- helpers ----------

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
