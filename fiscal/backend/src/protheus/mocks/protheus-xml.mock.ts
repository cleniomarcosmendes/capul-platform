/**
 * MOCK do recurso `xmlFiscal` da Especificação API Protheus v2.0.
 *
 * Em uso ENQUANTO o time Protheus não publica o endpoint real (até a reunião
 * de 13/04/2026 e respectiva implementação). Habilitado por env
 * `FISCAL_PROTHEUS_MOCK=true`.
 *
 * O mock simula:
 * - Cache em memória de XMLs gravados (Map).
 * - Validações leves (chave 44 dígitos, idempotência, tipo bate).
 * - Respostas com a mesma forma do contrato real.
 *
 * NÃO simula validação XSD nem assinatura digital — isso é responsabilidade
 * do Protheus real e nunca chega a ser exigência do mock para testes locais.
 */
import type {
  XmlFiscalExistsResponse,
  XmlFiscalGetResponse,
  XmlFiscalPostBody,
  XmlFiscalPostResponse,
} from '../interfaces/xml-fiscal.interface.js';
import { XmlFiscalProtheusError } from '../interfaces/xml-fiscal.interface.js';
import {
  XmlNfeProtheusError,
  type XmlNfeResult,
} from '../interfaces/xml-nfe.interface.js';
import type { GrvXmlBody } from '../interfaces/grv-xml.interface.js';

interface MockEntry {
  body: XmlFiscalPostBody;
  gravadoEm: string;
  usuarioRecebedor: string;
  itensCount: number;
  modelo: string;
}

export class ProtheusXmlMock {
  private readonly cache = new Map<string, MockEntry>();
  private readonly sped156Seed = new Map<string, string>();

  reset(): void {
    this.cache.clear();
    this.sped156Seed.clear();
  }

  size(): number {
    return this.cache.size;
  }

  /**
   * Mock do `GET /xmlNfe`. Reusa o cache populado por `post()` para simular
   * o lado SZR010. Aceita também uma "carga sintética SPED156" via
   * `seedSped156(chave, xmlBase64)` para exercitar o branch de fallback.
   */
  async buscarXml(chave: string): Promise<XmlNfeResult> {
    if (!/^\d{44}$/.test(chave)) {
      throw new XmlNfeProtheusError(
        'CHAVE_INVALIDA',
        `Chave ${chave} fora do formato 44 dígitos (mock).`,
        400,
      );
    }
    const found = this.findByChave(chave);
    if (found) {
      return {
        found: true,
        chave,
        origem: 'SZR010',
        xmlBase64: Buffer.from(found.body.xml, 'utf8').toString('base64'),
      };
    }
    const seeded = this.sped156Seed.get(chave);
    if (seeded) {
      return { found: true, chave, origem: 'SPED156', xmlBase64: seeded };
    }
    return {
      found: false,
      chave,
      message: 'XML nao localizado em SZR010 nem em SPED156 para a chave informada.',
    };
  }

  /**
   * Helper de teste: simula que o XML existe em SPED156 mas ainda não foi
   * gravado em SZR010 — exercita o branch onde a plataforma precisa chamar
   * `/grvXML` após receber a resposta.
   */
  seedSped156(chave: string, xmlBase64: string): void {
    this.sped156Seed.set(chave, xmlBase64);
  }

  /**
   * Mock do `POST /grvXML`. Extrai a chave do campo CHVNFE do XMLCAB e
   * reusa o cache para simular idempotência.
   */
  async grvXml(body: GrvXmlBody): Promise<{ status: 'GRAVADO' | 'JA_EXISTIA'; chave: string; itensGravados: number }> {
    const cab = body.itens.find((i) => i.alias === 'XMLCAB');
    if (!cab || cab.alias !== 'XMLCAB') {
      throw new XmlFiscalProtheusError('XML_MALFORMADO', 'Body grvXML sem XMLCAB (mock).', 400);
    }
    const chaveCampo = cab.campos.find((c) => c.campo === 'CHVNFE');
    const chave = chaveCampo?.valor ?? '';
    if (!/^\d{44}$/.test(chave)) {
      throw new XmlFiscalProtheusError('CHAVE_INVALIDA', `CHVNFE inválido no XMLCAB (mock).`, 400);
    }
    const itensCount = body.itens.filter((i) => i.alias === 'XMLIT').length;
    const existing = this.findByChave(chave);
    if (existing) {
      return { status: 'JA_EXISTIA', chave, itensGravados: existing.itensCount };
    }
    const filialCampo = cab.campos.find((c) => c.campo === 'FILIAL');
    const tpXmlCampo = cab.campos.find((c) => c.campo === 'TPXML');
    const modeloCampo = cab.campos.find((c) => c.campo === 'MODELO');
    const userCampo = cab.campos.find((c) => c.campo === 'USRREC');
    const entry: MockEntry = {
      body: {
        chave,
        tipoDocumento: tpXmlCampo?.valor === 'CTe' ? 'CTE' : 'NFE',
        filial: filialCampo?.valor ?? '01',
        xml: Buffer.from(cab.xmlBase64, 'base64').toString('utf8'),
        usuarioCapulQueDisparou: userCampo?.valor,
      },
      gravadoEm: new Date().toISOString(),
      usuarioRecebedor: userCampo?.valor ?? 'API_FISCAL',
      itensCount,
      modelo: modeloCampo?.valor ?? '55',
    };
    this.cache.set(this.key(chave, entry.body.filial), entry);
    return { status: 'GRAVADO', chave, itensGravados: itensCount };
  }

  async exists(chave: string): Promise<XmlFiscalExistsResponse> {
    this.assertChave(chave);
    const key = this.key(chave);
    const found = this.findByChave(chave);
    if (!found) {
      return { existe: false, chave };
    }
    return {
      existe: true,
      chave,
      tipoDocumento: found.body.tipoDocumento,
      modelo: found.modelo,
      filial: found.body.filial,
      gravadoEm: found.gravadoEm,
      usuarioRecebedor: found.usuarioRecebedor,
      totalItens: found.itensCount,
    };
  }

  async get(chave: string): Promise<XmlFiscalGetResponse> {
    this.assertChave(chave);
    const found = this.findByChave(chave);
    if (!found) {
      throw new XmlFiscalProtheusError(
        'CHAVE_NAO_ENCONTRADA',
        `Chave ${chave} não encontrada em SZR010 (mock).`,
        404,
      );
    }
    return this.toGetResponse(found);
  }

  async post(body: XmlFiscalPostBody): Promise<XmlFiscalPostResponse> {
    this.assertChave(body.chave);
    if (!/^\d{2}$/.test(body.filial)) {
      throw new XmlFiscalProtheusError('FILIAL_INVALIDA', `Filial ${body.filial} inválida (mock).`, 400);
    }
    if (!body.xml || body.xml.length < 50) {
      throw new XmlFiscalProtheusError('XML_MALFORMADO', 'XML vazio ou muito curto (mock).', 400);
    }

    const k = this.key(body.chave, body.filial);
    const existing = this.cache.get(k);
    if (existing) {
      return {
        status: 'JA_EXISTENTE',
        chave: body.chave,
        filial: body.filial,
        gravadoEmOriginal: existing.gravadoEm,
        usuarioRecebedorOriginal: existing.usuarioRecebedor,
      };
    }

    const usuarioRecebedor = body.usuarioCapulQueDisparou
      ? `API_FISCAL:${body.usuarioCapulQueDisparou}`.slice(0, 30)
      : 'API_FISCAL';

    // Aproximação: conta `<det` para estimar itens. Para mock é suficiente.
    const itensCount = (body.xml.match(/<det\b/g) ?? []).length || 1;

    const entry: MockEntry = {
      body,
      gravadoEm: new Date().toISOString(),
      usuarioRecebedor,
      itensCount,
      modelo: body.tipoDocumento === 'NFE' ? '55' : '57',
    };
    this.cache.set(k, entry);

    return {
      status: 'GRAVADO',
      chave: body.chave,
      filial: body.filial,
      tipoDocumento: body.tipoDocumento,
      modelo: entry.modelo,
      itensGravados: itensCount,
      fornecedorProtheus: { codigo: '999999', loja: '01' }, // mock
      gravadoEm: entry.gravadoEm,
    };
  }

  // ----- helpers -----

  private key(chave: string, filial = '*'): string {
    return `${filial}:${chave}`;
  }

  private findByChave(chave: string): MockEntry | undefined {
    for (const entry of this.cache.values()) {
      if (entry.body.chave === chave) return entry;
    }
    return undefined;
  }

  private assertChave(chave: string): void {
    if (!/^\d{44}$/.test(chave)) {
      throw new XmlFiscalProtheusError('CHAVE_INVALIDA', `Chave ${chave} fora do formato 44 dígitos (mock).`, 400);
    }
  }

  private toGetResponse(entry: MockEntry): XmlFiscalGetResponse {
    return {
      chave: entry.body.chave,
      filial: entry.body.filial,
      tipoDocumento: entry.body.tipoDocumento,
      modelo: entry.modelo,
      tipoNF: '1',
      serie: '001',
      numeroNF: '000000001',
      dataEmissao: entry.gravadoEm.slice(0, 10),
      xml: entry.body.xml,
      emitente: {
        cnpj: '12345678000190',
        razaoSocial: 'FORNECEDOR MOCK LTDA',
        inscricaoEstadual: '123456789',
        logradouro: 'RUA EXEMPLO MOCK',
        numero: '123',
        bairro: 'CENTRO',
        municipio: 'UNAI',
        codigoMunicipio: '3170206',
        uf: 'MG',
        cep: '38610000',
        telefone: null,
      },
      fornecedorProtheus: { codigo: '999999', loja: '01' },
      terceiro: false,
      transporte: {
        ufOrigem: null,
        municipioOrigem: null,
        ufDestino: null,
        municipioDestino: null,
        valorCte: null,
      },
      recebimento: {
        data: entry.gravadoEm.slice(0, 10),
        hora: entry.gravadoEm.slice(11, 19),
        usuario: entry.usuarioRecebedor,
      },
      totalItens: entry.itensCount,
    };
  }
}
