import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NfeParserService } from './nfe-parser.service.js';

describe('NfeParserService', () => {
  let parser: NfeParserService;
  let xml: string;

  beforeAll(() => {
    parser = new NfeParserService();
    xml = readFileSync(resolve(process.cwd(), 'test/fixtures/nfe-fixture.xml'), 'utf8');
  });

  describe('parse() — NF-e autorizada de homologação', () => {
    it('extrai dados gerais corretamente', () => {
      const result = parser.parse(xml);
      expect(result.dadosGerais.chave).toBe('31260400000000000000550010000000011000000010');
      expect(result.dadosGerais.chave.length).toBe(44);
      expect(result.dadosGerais.modelo).toBe('55');
      expect(result.dadosGerais.serie).toBe('1');
      expect(result.dadosGerais.numero).toBe('123456');
      expect(result.dadosGerais.tipoOperacao).toBe('1');
      expect(result.dadosGerais.tipoOperacaoDescricao).toBe('Saída');
      expect(result.dadosGerais.finalidade).toBe('1');
      expect(result.dadosGerais.finalidadeDescricao).toBe('Normal');
      expect(result.dadosGerais.naturezaOperacao).toBe('VENDA DE MERCADORIA');
      expect(result.dadosGerais.ambiente).toBe('2'); // homologação
    });

    it('extrai emitente com endereço completo', () => {
      const result = parser.parse(xml);
      expect(result.emitente.cnpj).toBe('12345678000190');
      expect(result.emitente.razaoSocial).toBe('FORNECEDOR TESTE LTDA');
      expect(result.emitente.nomeFantasia).toBe('Fornecedor Teste');
      expect(result.emitente.inscricaoEstadual).toBe('1234567890');
      expect(result.emitente.endereco.logradouro).toBe('AVENIDA DOS TESTES');
      expect(result.emitente.endereco.numero).toBe('1000');
      expect(result.emitente.endereco.uf).toBe('MG');
      expect(result.emitente.endereco.cep).toBe('38610000');
      expect(result.emitente.endereco.codigoMunicipio).toBe('3170206');
    });

    it('extrai destinatário', () => {
      const result = parser.parse(xml);
      expect(result.destinatario.cnpj).toBe('98765432000155');
      expect(result.destinatario.razaoSocial).toBe('COOPERATIVA AGROPECUARIA UNAI LTDA');
      expect(result.destinatario.endereco.uf).toBe('MG');
    });

    it('extrai produtos com impostos estruturados', () => {
      const result = parser.parse(xml);
      expect(result.produtos).toHaveLength(2);

      const item1 = result.produtos[0]!;
      expect(item1.item).toBe(1);
      expect(item1.codigo).toBe('PROD001');
      expect(item1.ean).toBe('7891234567890');
      expect(item1.descricao).toBe('ADUBO NPK 20-05-20 SACA 50KG');
      expect(item1.ncm).toBe('31051000');
      expect(item1.cfop).toBe('5102');
      expect(item1.quantidadeComercial).toBe(100);
      expect(item1.valorUnitarioComercial).toBe(125.5);
      expect(item1.valorTotalBruto).toBe(12550);
      expect(item1.impostos.icmsCst).toBe('00');
      expect(item1.impostos.icmsAliquota).toBe(18);
      expect(item1.impostos.icmsValor).toBe(2259);
      expect(item1.impostos.pisAliquota).toBe(1.65);
      expect(item1.impostos.pisValor).toBe(207.08);

      const item2 = result.produtos[1]!;
      expect(item2.codigo).toBe('PROD002');
      expect(item2.descricao).toBe('SEMENTE DE MILHO HIBRIDO 20KG');
      expect(item2.impostos.pisCst).toBe('06');
      expect(item2.impostos.pisValor).toBeNull();
    });

    it('extrai totais da nota', () => {
      const result = parser.parse(xml);
      expect(result.totais.valorProdutos).toBe(17045);
      expect(result.totais.valorIcms).toBe(2798.4);
      expect(result.totais.valorFrete).toBe(250);
      expect(result.totais.valorDesconto).toBe(45);
      expect(result.totais.valorPis).toBe(207.08);
      expect(result.totais.valorCofins).toBe(953.8);
      expect(result.totais.valorNota).toBe(17250);
      expect(result.totais.valorTotalTributos).toBe(4498.28);
    });

    it('extrai transporte (modalidade, transportador, veículo, volumes)', () => {
      const result = parser.parse(xml);
      expect(result.transporte.modalidadeFrete).toBe('0');
      expect(result.transporte.modalidadeFreteDescricao).toContain('CIF');
      expect(result.transporte.transportador?.cnpj).toBe('11222333000144');
      expect(result.transporte.transportador?.razaoSocial).toBe('TRANSPORTADORA TESTE LTDA');
      expect(result.transporte.veiculo?.placa).toBe('ABC1D23');
      expect(result.transporte.volumes).toHaveLength(1);
      expect(result.transporte.volumes[0]?.quantidade).toBe(150);
      expect(result.transporte.volumes[0]?.especie).toBe('SACA');
      expect(result.transporte.volumes[0]?.pesoLiquido).toBe(7500);
    });

    it('extrai cobrança (fatura + duplicatas)', () => {
      const result = parser.parse(xml);
      expect(result.cobranca.fatura?.numero).toBe('FAT-123456');
      expect(result.cobranca.fatura?.valorLiquido).toBe(17250);
      expect(result.cobranca.duplicatas).toHaveLength(1);
      expect(result.cobranca.duplicatas[0]?.numero).toBe('001');
      expect(result.cobranca.duplicatas[0]?.valor).toBe(17250);
    });

    it('extrai protocolo de autorização', () => {
      const result = parser.parse(xml);
      expect(result.protocoloAutorizacao).not.toBeNull();
      expect(result.protocoloAutorizacao!.protocolo).toBe('131260000000001');
      expect(result.protocoloAutorizacao!.cStat).toBe('100');
      expect(result.protocoloAutorizacao!.motivo).toBe('Autorizado o uso da NF-e');
    });

    it('extrai informações adicionais', () => {
      const result = parser.parse(xml);
      expect(result.informacoesAdicionais?.informacoesComplementares).toContain('HOMOLOGACAO');
    });
  });

  describe('parse() — erros de entrada', () => {
    it('rejeita XML mal-formado', () => {
      expect(() => parser.parse('<?xml version="1.0"?><oops>')).toThrow();
    });

    it('rejeita XML sem <NFe>', () => {
      expect(() => parser.parse('<?xml version="1.0"?><root><x/></root>')).toThrow(
        /NFe.*não encontrada/,
      );
    });

    it('rejeita NFe sem infNFe', () => {
      expect(() => parser.parse('<?xml version="1.0"?><NFe><outro/></NFe>')).toThrow(/infNFe.*ausente/);
    });
  });
});
