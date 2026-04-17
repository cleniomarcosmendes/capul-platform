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
