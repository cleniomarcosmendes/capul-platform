import { jest, describe, it, expect } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { ProtheusXmlService } from './protheus-xml.service.js';
import { ProtheusHttpClient, ProtheusHttpError } from './protheus-http.client.js';
import { XmlNfeProtheusError } from './interfaces/xml-nfe.interface.js';

/**
 * Testa o método `buscarXml(chave)` do ProtheusXmlService — adapter do
 * `GET /xmlNfe?CHAVENFEE=...` recebido em 20/04/2026.
 *
 * Cobre:
 *   - Modo MOCK (FISCAL_PROTHEUS_MOCK=true) — usa ProtheusXmlMock interno.
 *   - Modo REAL — http stubbed para validar que o resolver resolve `xmlNfe`
 *     e que 404 vira { found: false } sem lançar.
 */

const CHAVE = '53260455087053000183550010000008961143366160';

type AnyAsyncMock = (...args: unknown[]) => Promise<unknown>;

function makeService(opts: {
  mock: boolean;
  httpRequest?: AnyAsyncMock;
}): ProtheusXmlService {
  const config = {
    get: (k: string) => (k === 'FISCAL_PROTHEUS_MOCK' ? (opts.mock ? 'true' : 'false') : undefined),
  } as unknown as ConfigService;
  const http = {
    request: opts.httpRequest ?? (jest.fn() as unknown as AnyAsyncMock),
  } as unknown as ProtheusHttpClient;
  return new ProtheusXmlService(http, config);
}

describe('ProtheusXmlService.buscarXml — MOCK MODE', () => {
  it('retorna found=false para chave nunca gravada', async () => {
    const svc = makeService({ mock: true });
    const r = await svc.buscarXml(CHAVE);
    expect(r.found).toBe(false);
    if (!r.found) {
      expect(r.chave).toBe(CHAVE);
      expect(r.message).toMatch(/SZR010 nem em SPED156/);
    }
  });

  it('rejeita chave fora do formato', async () => {
    const svc = makeService({ mock: true });
    await expect(svc.buscarXml('123')).rejects.toBeInstanceOf(XmlNfeProtheusError);
  });

  it('retorna origem SZR010 quando o XML foi previamente gravado via post()', async () => {
    const svc = makeService({ mock: true });
    await svc.post({
      chave: CHAVE,
      tipoDocumento: 'NFE',
      filial: '02',
      xml: '<?xml version="1.0"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe/></nfeProc>',
      usuarioCapulQueDisparou: 'tester@capul',
    });
    const r = await svc.buscarXml(CHAVE);
    expect(r.found).toBe(true);
    if (r.found) {
      expect(r.origem).toBe('SZR010');
      expect(r.xmlBase64.length).toBeGreaterThan(0);
    }
  });
});

describe('ProtheusXmlService.buscarXml — HTTP MODE', () => {
  it('chama xmlNfe com query CHAVENFEE e devolve found=true', async () => {
    const httpRequest = jest.fn(async () => ({
      chave: CHAVE,
      origem: 'SZR010' as const,
      xmlBase64: 'PD94bWw=',
    })) as unknown as AnyAsyncMock;
    const svc = makeService({ mock: false, httpRequest });

    const r = await svc.buscarXml(CHAVE);

    expect(httpRequest).toHaveBeenCalledWith({
      operacao: 'xmlNfe',
      method: 'GET',
      query: { CHAVENFEE: CHAVE },
    });
    expect(r).toEqual({ found: true, chave: CHAVE, origem: 'SZR010', xmlBase64: 'PD94bWw=' });
  });

  it('traduz 404 estruturado para found=false', async () => {
    const httpRequest = jest.fn(async () => {
      throw new ProtheusHttpError(
        404,
        { status: 404, message: 'XML nao localizado em SZR010 nem em SPED156.', chave: CHAVE },
        'GET .../xmlNfe -> 404',
      );
    }) as unknown as AnyAsyncMock;
    const svc = makeService({ mock: false, httpRequest });

    const r = await svc.buscarXml(CHAVE);

    expect(r).toEqual({
      found: false,
      chave: CHAVE,
      message: 'XML nao localizado em SZR010 nem em SPED156.',
    });
  });

  it('traduz 400 (string raw) para XmlNfeProtheusError CHAVE_INVALIDA', async () => {
    const httpRequest = jest.fn(async () => {
      throw new ProtheusHttpError(
        400,
        'O parametro chaveNFe deve conter exatamente 44 digitos numericos.',
        'GET .../xmlNfe -> 400',
      );
    }) as unknown as AnyAsyncMock;
    const svc = makeService({ mock: false, httpRequest });

    await expect(svc.buscarXml(CHAVE)).rejects.toMatchObject({
      name: 'XmlNfeProtheusError',
      code: 'CHAVE_INVALIDA',
      httpStatus: 400,
    });
  });

  it('traduz 401/403 para NAO_AUTORIZADO', async () => {
    const httpRequest = jest.fn(async () => {
      throw new ProtheusHttpError(401, null, 'GET .../xmlNfe -> 401');
    }) as unknown as AnyAsyncMock;
    const svc = makeService({ mock: false, httpRequest });
    await expect(svc.buscarXml(CHAVE)).rejects.toMatchObject({
      code: 'NAO_AUTORIZADO',
      httpStatus: 401,
    });
  });

  it('traduz erro de rede para PROTHEUS_INDISPONIVEL', async () => {
    const httpRequest = jest.fn(async () => {
      throw new Error('socket hang up');
    }) as unknown as AnyAsyncMock;
    const svc = makeService({ mock: false, httpRequest });
    await expect(svc.buscarXml(CHAVE)).rejects.toMatchObject({
      code: 'PROTHEUS_INDISPONIVEL',
      httpStatus: 503,
    });
  });
});

describe('ProtheusXmlMock.seedSped156 — branch SPED156', () => {
  it('seedSped156 produz origem=SPED156 quando SZR está vazio', async () => {
    const svc = makeService({ mock: true });
    // Acessa o mock interno via método público que cobre o cenário SPED156
    // (helper de teste seedSped156 está exposto no mock).
    const mock = (svc as unknown as { mock: { seedSped156: (c: string, x: string) => void } }).mock;
    mock.seedSped156(CHAVE, 'PHNwZWQxNTY=');

    const r = await svc.buscarXml(CHAVE);
    expect(r.found).toBe(true);
    if (r.found) {
      expect(r.origem).toBe('SPED156');
      expect(r.xmlBase64).toBe('PHNwZWQxNTY=');
    }
  });
});
