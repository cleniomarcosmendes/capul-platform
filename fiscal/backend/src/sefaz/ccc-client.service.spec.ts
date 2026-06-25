const soapPostMock = jest.fn();
jest.mock('./sefaz-http.helper.js', () => ({ soapPost: (...args: unknown[]) => soapPostMock(...args) }));

import { CccClient } from './ccc-client.service';

// Resposta CCC mínima (cStat 111 = não encontrado) só pra o parse não estourar —
// o foco do teste é a REQUISIÇÃO (qual tag de documento foi enviada).
const RESP =
  '<Envelope><Body><nfeResultMsg><retConsCad><infCons><cStat>111</cStat><xMotivo>nao encontrado</xMotivo></infCons></retConsCad></nfeResultMsg></Body></Envelope>';

describe('CccClient — tag do documento na consulta CCC', () => {
  let client: CccClient;
  const envelope = () => (soapPostMock.mock.calls[0]![0] as { envelope: string }).envelope;

  beforeEach(() => {
    soapPostMock.mockReset().mockResolvedValue({ statusCode: 200, rawResponse: RESP });
    const agent = { getAgent: jest.fn().mockResolvedValue(undefined) };
    const limite = { checkAndIncrement: jest.fn().mockResolvedValue(1) };
    client = new CccClient(agent as never, limite as never);
  });

  it('consultarPorIe → envia <IE> (só dígitos) e a UF', async () => {
    await client.consultarPorIe('95774273-45', 'pr', 'PRODUCAO');
    expect(envelope()).toContain('<IE>9577427345</IE>');
    expect(envelope()).toContain('<UF>PR</UF>');
  });

  it('consultarPorCnpj com CPF → envia <CPF>', async () => {
    await client.consultarPorCnpj('633.542.761-34', 'PR', 'PRODUCAO');
    expect(envelope()).toContain('<CPF>63354276134</CPF>');
  });

  it('consultarPorCnpj com CNPJ → envia <CNPJ>', async () => {
    await client.consultarPorCnpj('11.222.333/0001-81', 'MG', 'PRODUCAO');
    expect(envelope()).toContain('<CNPJ>11222333000181</CNPJ>');
  });
});
