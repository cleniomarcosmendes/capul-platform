import { BadRequestException } from '@nestjs/common';
import { XmlParserToSzrSzqService } from './xml-parser-to-szr-szq.service.js';
import type { GrvXmlItemCabecalho, GrvXmlItemDetalhe } from './interfaces/grv-xml.interface.js';

/**
 * Amostra baseada no exemplo real recebido em `szr010-szq010.txt` (18/04/2026).
 * Emitente: VINICIUS DE CASTRO (DF). Destinatário: CAPUL. 4 itens.
 * Chave: 53260455087053000183550010000008961143366160
 */
const XML_SAMPLE_ENTRADA = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe53260455087053000183550010000008961143366160" versao="4.00">
      <ide>
        <cUF>53</cUF>
        <cNF>14336616</cNF>
        <natOp>Venda de mercadoria</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>896</nNF>
        <dhEmi>2026-04-16T11:35:12-03:00</dhEmi>
        <tpNF>1</tpNF>
        <idDest>2</idDest>
        <cMunFG>5300108</cMunFG>
      </ide>
      <emit>
        <CNPJ>55087053000183</CNPJ>
        <xNome>VINICIUS DE CASTRO</xNome>
        <xFant>TOMATES MONTE CASTRO</xFant>
        <enderEmit>
          <xLgr>RODOVIA DF-240KM 86</xLgr>
          <nro>.</nro>
          <xBairro>VICENTE PIRES</xBairro>
          <cMun>5300108</cMun>
          <xMun>BRASILIA</xMun>
          <UF>DF</UF>
          <CEP>72127991</CEP>
          <fone>61999238003</fone>
        </enderEmit>
        <IE>0829993000109</IE>
      </emit>
      <det nItem="1">
        <prod>
          <cProd>01</cProd>
          <cEAN>SEM GTIN</cEAN>
          <xProd>TOMATE COMUM</xProd>
          <NCM>07020000</NCM>
          <CFOP>6102</CFOP>
          <uCom>CX</uCom>
          <qCom>30.0000</qCom>
          <vUnCom>140.0000000000</vUnCom>
          <vProd>4200.00</vProd>
        </prod>
      </det>
      <det nItem="2">
        <prod>
          <cProd>02</cProd>
          <cEAN>SEM GTIN</cEAN>
          <xProd>TOMATE ITALIANO</xProd>
          <NCM>07020000</NCM>
          <CFOP>6102</CFOP>
          <uCom>CX</uCom>
          <qCom>5.0000</qCom>
          <vUnCom>140.0000000000</vUnCom>
          <vProd>700.00</vProd>
        </prod>
      </det>
    </infNFe>
  </NFe>
</nfeProc>`;

describe('XmlParserToSzrSzqService', () => {
  let service: XmlParserToSzrSzqService;

  beforeEach(() => {
    service = new XmlParserToSzrSzqService();
  });

  describe('extrair', () => {
    it('extrai os campos de cabeçalho de uma NF-e', () => {
      const r = service.extrair(XML_SAMPLE_ENTRADA);
      expect(r.tipoXml).toBe('NFe');
      expect(r.modelo).toBe('55');
      expect(r.chave).toBe('53260455087053000183550010000008961143366160');
      expect(r.serie).toBe('001');
      expect(r.numeroNF).toBe('000000896');
      expect(r.dataEmissao).toBe('20260416');
      expect(r.tipoNF).toBe('1');
      expect(r.emitente.cnpj).toBe('55087053000183');
      expect(r.emitente.nome).toBe('VINICIUS DE CASTRO');
      expect(r.emitente.ie).toBe('0829993000109');
      expect(r.emitente.uf).toBe('DF');
      expect(r.emitente.cep).toBe('72127991');
      expect(r.emitente.codMunicipio).toBe('5300108');
    });

    it('extrai 2 itens com campos corretos', () => {
      const r = service.extrair(XML_SAMPLE_ENTRADA);
      expect(r.itens).toHaveLength(2);
      expect(r.itens[0]).toEqual({
        numItem: '001',
        cProd: '01',
        cEAN: 'SEM GTIN',
        xProd: 'TOMATE COMUM',
        uCom: 'CX',
        qCom: '30',
        vUnCom: '140',
        vProd: '4200.00',
        cfop: '6102',
      });
      expect(r.itens[1].xProd).toBe('TOMATE ITALIANO');
      expect(r.itens[1].qCom).toBe('5');
    });

    it('recusa XML vazio', () => {
      expect(() => service.extrair('')).toThrow(BadRequestException);
    });

    it('recusa XML não reconhecido', () => {
      expect(() => service.extrair('<?xml version="1.0"?><foo/>')).toThrow(BadRequestException);
    });
  });

  describe('montarBody', () => {
    it('monta body com XMLCAB contendo xmlBase64 e 25 campos obrigatórios', () => {
      const body = service.montarBody(XML_SAMPLE_ENTRADA, {
        filial: '02',
        usuarioRec: 'FRANCIELE SILVA',
        dataHoraRec: new Date('2026-04-17T07:56:08-03:00'),
      });

      const cab = body.itens.find((i) => i.alias === 'XMLCAB') as GrvXmlItemCabecalho;
      expect(cab).toBeDefined();
      expect(cab.xmlBase64.length).toBeGreaterThan(100);
      expect(Buffer.from(cab.xmlBase64, 'base64').toString('utf-8')).toContain('<NFe');

      const mapa = Object.fromEntries(cab.campos.map((c) => [c.campo, c.valor]));
      expect(mapa.FILIAL).toBe('02');
      expect(mapa.TPXML).toBe('NFe');
      expect(mapa.CHVNFE).toBe('53260455087053000183550010000008961143366160');
      expect(mapa.MODELO).toBe('55');
      expect(mapa.EMISSA).toBe('20260416');
      expect(mapa.TPNF).toBe('1');
      expect(mapa.TERCEIR).toBe('F');
      expect(mapa.NNF).toBe('000000896');
      expect(mapa.SERIE).toBe('001');
      expect(mapa.ECNPJ).toBe('55087053000183');
      expect(mapa.USRREC).toBe('FRANCIELE SILVA');
      expect(mapa.CODFOR).toBe(''); // default vazio (aguarda Protheus)
      expect(mapa.LOJSIG).toBe('0001'); // default
    });

    it('monta 1 XMLIT por item da NF-e', () => {
      const body = service.montarBody(XML_SAMPLE_ENTRADA, {
        filial: '02',
        usuarioRec: 'TESTE',
      });
      const itens = body.itens.filter((i) => i.alias === 'XMLIT') as GrvXmlItemDetalhe[];
      expect(itens).toHaveLength(2);

      const it1 = Object.fromEntries(itens[0].campos.map((c) => [c.campo, c.valor]));
      expect(it1.ITEM).toBe('001');
      expect(it1.PROD).toBe('01');
      expect(it1.DESCRI).toBe('TOMATE COMUM');
      expect(it1.QTDE).toBe('30');
      expect(it1.VLUNIT).toBe('140');
      expect(it1.TOTAL).toBe('4200.00');
      expect(it1.CFOP).toBe('6102');
      expect(it1.CHVNFE).toBe('53260455087053000183550010000008961143366160');
      expect(it1.XMLIMP).toBe('');
      // Campos "siga" vazios por default (aguardam decisão Protheus)
      expect(it1.CODSIG).toBe('');
      expect(it1.QTSIGA).toBe('');
    });

    it('preenche campos siga quando context fornece', () => {
      const body = service.montarBody(XML_SAMPLE_ENTRADA, {
        filial: '02',
        usuarioRec: 'TESTE',
        codFor: 'F14059',
        lojSig: '0001',
        siga: {
          '001': { codSig: '00034164', qtSiga: '540', vlSiga: '7.7778', pedCom: '431037' },
        },
      });
      const cab = body.itens.find((i) => i.alias === 'XMLCAB') as GrvXmlItemCabecalho;
      expect(Object.fromEntries(cab.campos.map((c) => [c.campo, c.valor])).CODFOR).toBe('F14059');

      const it1 = body.itens.find(
        (i) => i.alias === 'XMLIT' && i.campos.find((c) => c.campo === 'ITEM')?.valor === '001',
      ) as GrvXmlItemDetalhe;
      const mapa = Object.fromEntries(it1.campos.map((c) => [c.campo, c.valor]));
      expect(mapa.CODSIG).toBe('00034164');
      expect(mapa.QTSIGA).toBe('540');
      expect(mapa.PEDCOM).toBe('431037');
    });
  });
});
