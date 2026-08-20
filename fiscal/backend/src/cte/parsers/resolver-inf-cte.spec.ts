import { resolverInfCte, chaveDoInfCte, resolverProtCTe } from './resolver-inf-cte.js';
import { XMLParser } from 'fast-xml-parser';

/**
 * O que estes testes protegem: **nenhuma variante de CT-e pode entrar na base
 * sem chave.**
 *
 * Caso real (19/08/2026): o CT-e 1950 da Distribuidora Carvalho, autorizado em
 * 17/08 com a CAPUL como tomadora, chegou pela distNSU e ficou guardado com
 * `chave = NULL` — porque o extrator procurava a raiz do CT-e NORMAL
 * (`cteProc/CTe`) também no Simplificado. O documento existia, o XML estava
 * íntegro, e a busca por chave não o achava. O operador foi procurá-lo no SEFAZ,
 * com o certificado da CAPUL, por um problema que era nosso.
 *
 * Os XMLs abaixo são os que estavam em PRODUÇÃO (recortados).
 */

const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false });

const CHAVE_SIMP = '31260804555709000104570010000019501021867448';
const CHAVE_OS = '31260800033613000125670000000018951010554643';

// CT-e Simplificado — o caso que sumiu.
const XML_SIMP = `<cteSimpProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/cte"><CTeSimp xmlns="http://www.portalfiscal.inf.br/cte"><infCte Id="CTe${CHAVE_SIMP}" versao="4.00"><ide><cUF>31</cUF><CFOP>5932</CFOP><mod>57</mod><serie>1</serie><nCT>1950</nCT><dhEmi>2026-08-17T14:43:52-03:00</dhEmi></ide><emit><xNome>DISTRIBUIDORA CARVALHO P LTDA</xNome></emit></infCte></CTeSimp><protCTe versao="4.00"><infProt><nProt>131264770901328</nProt><cStat>100</cStat></infProt></protCTe></cteSimpProc>`;

// CT-e OS (modelo 67) — mesma raiz do problema, gravado como DESCONHECIDO.
const XML_OS = `<cteOSProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/cte"><CTeOS xmlns="http://www.portalfiscal.inf.br/cte" versao="4.00"><infCte Id="CTe${CHAVE_OS}" versao="4.00"><ide><cUF>31</cUF><CFOP>5353</CFOP><mod>67</mod><serie>0</serie><nCT>1895</nCT><dhEmi>2026-08-17T10:00:00-03:00</dhEmi></ide><emit><xNome>TRANSPORTADORA X</xNome></emit></infCte></CTeOS><protCTe versao="4.00"><infProt><nProt>999</nProt></infProt></protCTe></cteOSProc>`;

const XML_NORMAL = `<cteProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/cte"><CTe><infCte Id="CTe${CHAVE_SIMP}" versao="4.00"><ide><mod>57</mod></ide></infCte></CTe><protCTe><infProt><nProt>1</nProt></infProt></protCTe></cteProc>`;

describe('resolverInfCte', () => {
  it('CT-e Simplificado (cteSimpProc/CTeSimp) — o documento que sumiu', () => {
    const r = resolverInfCte(parser.parse(XML_SIMP));
    expect(r).not.toBeNull();
    expect(r!.raiz).toBe('cteSimpProc/CTeSimp');
    expect(r!.generico).toBe(false);
    expect(chaveDoInfCte(r!.infCte)).toBe(CHAVE_SIMP);
    expect(Number(r!.infCte.ide.mod)).toBe(57);
  });

  it('CT-e OS (cteOSProc/CTeOS, modelo 67)', () => {
    const r = resolverInfCte(parser.parse(XML_OS));
    expect(r!.raiz).toBe('cteOSProc/CTeOS');
    expect(chaveDoInfCte(r!.infCte)).toBe(CHAVE_OS);
    expect(Number(r!.infCte.ide.mod)).toBe(67);
  });

  it('CT-e normal segue funcionando (não podia regredir)', () => {
    const r = resolverInfCte(parser.parse(XML_NORMAL));
    expect(r!.raiz).toBe('cteProc/CTe');
    expect(chaveDoInfCte(r!.infCte)).toBe(CHAVE_SIMP);
  });

  it('⭐ raiz DESCONHECIDA da SEFAZ ainda entrega a chave, pela varredura genérica', () => {
    // A lista de variantes vai crescer: o Simplificado é NT de nov/2024 e só
    // apareceu aqui em jul/2026. Uma raiz nova não pode voltar a sumir.
    const futuro = XML_SIMP.replace(/cteSimpProc/g, 'cteFuturoProc').replace(/CTeSimp/g, 'CTeFuturo');
    const r = resolverInfCte(parser.parse(futuro));
    expect(r).not.toBeNull();
    expect(r!.generico).toBe(true);   // sinaliza para catalogar o caminho
    expect(chaveDoInfCte(r!.infCte)).toBe(CHAVE_SIMP);
  });

  it('XML que não é CT-e devolve null (não inventa chave)', () => {
    expect(resolverInfCte(parser.parse('<nfeProc><NFe><infNFe Id="NFe123"/></NFe></nfeProc>'))).toBeNull();
  });

  it('Id malformado não vira chave', () => {
    expect(chaveDoInfCte({ '@_Id': 'CTe123' })).toBeNull();
    expect(chaveDoInfCte({})).toBeNull();
  });
});

describe('resolverProtCTe', () => {
  it('acha o protocolo em cada envelope — sem ele o CT-e abre sem prova de autorização', () => {
    expect(resolverProtCTe(parser.parse(XML_SIMP)).infProt.nProt).toBe('131264770901328');
    expect(resolverProtCTe(parser.parse(XML_OS)).infProt.nProt).toBe('999');
    expect(resolverProtCTe(parser.parse(XML_NORMAL)).infProt.nProt).toBe('1');
  });
});
