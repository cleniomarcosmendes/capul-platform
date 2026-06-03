import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CteParserService } from './cte-parser.service.js';

describe('CteParserService', () => {
  let parser: CteParserService;
  let xml: string;

  beforeAll(() => {
    parser = new CteParserService();
    xml = readFileSync(resolve(process.cwd(), 'test/fixtures/cte-fixture.xml'), 'utf8');
  });

  it('extrai dados gerais do CT-e', () => {
    const r = parser.parse(xml);
    expect(r.dadosGerais.chave).toBe('31260400000000000000570010000000011000000010');
    expect(r.dadosGerais.modelo).toBe('57');
    expect(r.dadosGerais.numero).toBe('987654');
    expect(r.dadosGerais.tipoCteDescricao).toBe('Normal');
    expect(r.dadosGerais.modalidadeDescricao).toBe('Rodoviário');
    expect(r.dadosGerais.tipoServicoDescricao).toBe('Normal');
    expect(r.dadosGerais.ufInicio).toBe('MG');
    expect(r.dadosGerais.ufFim).toBe('SP');
    expect(r.dadosGerais.cfop).toBe('6352');
  });

  it('extrai emitente, remetente e destinatário', () => {
    const r = parser.parse(xml);
    expect(r.emitente.cnpj).toBe('11222333000144');
    expect(r.emitente.razaoSocial).toBe('TRANSPORTADORA TESTE LTDA');
    expect(r.remetente.cnpj).toBe('98765432000155');
    expect(r.remetente.razaoSocial).toBe('COOPERATIVA AGROPECUARIA UNAI LTDA');
    expect(r.destinatario.cnpj).toBe('55666777000188');
    expect(r.destinatario.endereco?.uf).toBe('SP');
  });

  it('extrai tomador como Remetente (toma=0)', () => {
    const r = parser.parse(xml);
    expect(r.tomador).toBe('Remetente');
  });

  it('extrai componentes de valor e ICMS', () => {
    const r = parser.parse(xml);
    expect(r.valores.valorTotalPrestacao).toBe(1500);
    expect(r.valores.valorReceber).toBe(1500);
    expect(r.valores.componentes).toHaveLength(3);
    expect(r.valores.componentes[0]?.nome).toBe('FRETE PESO');
    expect(r.valores.componentes[0]?.valor).toBe(1200);
    expect(r.valores.icmsAliquota).toBe(12);
    expect(r.valores.icmsValor).toBe(180);
  });

  it('extrai informações de carga e quantidades', () => {
    const r = parser.parse(xml);
    expect(r.carga.valorCarga).toBe(17250);
    expect(r.carga.produtoPredominante).toBe('ADUBO E SEMENTES');
    expect(r.carga.outrasCaracteristicas).toBe('CARGA PERECIVEL');
    expect(r.carga.quantidades).toHaveLength(2);
    expect(r.carga.quantidades[0]?.descricao).toBe('KG');
    expect(r.carga.quantidades[0]?.quantidade).toBe(7500);
  });

  it('extrai documentos transportados (NFe relacionada)', () => {
    const r = parser.parse(xml);
    expect(r.documentosTransportados).toHaveLength(1);
    expect(r.documentosTransportados[0]?.chaveNFe).toBe(
      '31260400000000000000550010000000011000000010',
    );
  });

  it('extrai protocolo de autorização', () => {
    const r = parser.parse(xml);
    expect(r.protocoloAutorizacao).not.toBeNull();
    expect(r.protocoloAutorizacao!.protocolo).toBe('131260000000002');
    expect(r.protocoloAutorizacao!.cStat).toBe('100');
  });

  it('rejeita XML sem CTe', () => {
    expect(() => parser.parse('<?xml version="1.0"?><NFe/>')).toThrow(/CTe.*não encontrada/);
  });
});

describe('CteParserService.parseEventoCteXml', () => {
  const parser = new CteParserService();
  const CHAVE = '29260357346218000110570010000094911234465642';

  it('extrai Prestação de Serviço em Desacordo (610110) com Observação (xObs)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<procEventoCTe versao="4.00" xmlns="http://www.portalfiscal.inf.br/cte">
  <eventoCTe versao="4.00">
    <infEvento Id="ID61011${CHAVE}001">
      <cOrgao>29</cOrgao><tpAmb>1</tpAmb>
      <CNPJ>25834847000100</CNPJ>
      <chCTe>${CHAVE}</chCTe>
      <dhEvento>2026-03-18T10:36:12-03:00</dhEvento>
      <tpEvento>610110</tpEvento><nSeqEvento>1</nSeqEvento>
      <detEvento versaoEvento="4.00">
        <evPrestDesacordo>
          <descEvento>Prestacao do Servico em Desacordo</descEvento>
          <indDesacordoOper>1</indDesacordoOper>
          <xObs>EMITIDO INCORRETAMENTE</xObs>
        </evPrestDesacordo>
      </detEvento>
    </infEvento>
  </eventoCTe>
  <retEventoCTe versao="4.00">
    <infEvento>
      <cStat>135</cStat><xMotivo>Evento registrado e vinculado a CT-e</xMotivo>
      <nProt>329260059835918</nProt><dhRegEvento>2026-03-18T10:36:13-03:00</dhRegEvento>
    </infEvento>
  </retEventoCTe>
</procEventoCTe>`;
    const d = parser.parseEventoCteXml(xml);
    expect(d.tipoEvento).toBe('610110');
    expect(d.tipoEventoDescricao).toBe('610110 - Prestação de Serviço em Desacordo');
    expect(d.autorCnpj).toBe('25834847000100');
    expect(d.ambienteDescricao).toBe('1 - Produção');
    expect(d.orgaoRecepcao).toBe('29');
    expect(d.chave).toBe(CHAVE);
    expect(d.observacao).toBe('EMITIDO INCORRETAMENTE');
    expect(d.autorizacaoCStat).toBe('135');
    expect(d.autorizacaoProtocolo).toBe('329260059835918');
  });

  it('extrai Cancelamento (110111) com Justificativa (xJust)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<procEventoCTe versao="4.00" xmlns="http://www.portalfiscal.inf.br/cte">
  <eventoCTe versao="4.00">
    <infEvento Id="ID11011${CHAVE}001">
      <cOrgao>29</cOrgao><tpAmb>1</tpAmb>
      <CNPJ>09199470000109</CNPJ>
      <chCTe>${CHAVE}</chCTe>
      <dhEvento>2026-03-19T08:00:00-03:00</dhEvento>
      <tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento>
      <detEvento versaoEvento="4.00">
        <evCancCTe>
          <descEvento>Cancelamento</descEvento>
          <nProt>129260000000001</nProt>
          <xJust>Erro de digitacao no valor do frete</xJust>
        </evCancCTe>
      </detEvento>
    </infEvento>
  </eventoCTe>
  <retEventoCTe versao="4.00">
    <infEvento><cStat>135</cStat><xMotivo>Evento registrado e vinculado a CT-e</xMotivo>
      <nProt>329260000099999</nProt></infEvento>
  </retEventoCTe>
</procEventoCTe>`;
    const d = parser.parseEventoCteXml(xml);
    expect(d.tipoEvento).toBe('110111');
    expect(d.tipoEventoDescricao).toBe('110111 - Cancelamento');
    expect(d.justificativa).toBe('Erro de digitacao no valor do frete');
    expect(d.observacao).toBeNull();
  });

  it('rejeita XML de evento sem infEvento', () => {
    expect(() => parser.parseEventoCteXml('<?xml version="1.0"?><procEventoCTe/>')).toThrow(
      /infEvento/,
    );
  });
});
