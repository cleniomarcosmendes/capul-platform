import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { gunzipSync } from 'node:zlib';
import { XMLParser } from 'fast-xml-parser';
import { SefazAgentService } from './sefaz-agent.service.js';
import { getCteDistribuicaoUrl, type AmbienteSefazStr } from './sefaz-endpoints.map.js';
import { buildSoapEnvelope } from './soap-envelope.helper.js';
import { soapPost } from './sefaz-http.helper.js';
import { SefazConsultaError } from './nfe-distribuicao.client.js';
import { cufFromUf } from '../common/helpers/chave.helper.js';
import { decodeXmlBytes } from './xml-encoding.util.js';

export interface CteDocZip {
  /** NSU do documento no atributo @NSU do <docZip> */
  nsu: string;
  /** schema do XML (ex: procCTe_v4.00.xsd, resCTe_v4.00.xsd) */
  schema: string;
  /** XML completo descomprimido (UTF-8) */
  xml: string;
}

export interface RetDistDFeIntCte {
  cStat: string;
  xMotivo: string;
  /** NSU mais alto retornado neste lote (cliente usa como próximo ultNSU) */
  ultNSU: string;
  /** NSU mais alto disponível na SEFAZ pra este consulente */
  maxNSU: string;
  dhResp?: string;
  tpAmb: string;
  /** Documentos retornados (vazio quando cStat=137) */
  docZips: CteDocZip[];
}

/**
 * Cliente do web service CTeDistribuicaoDFe — análogo ao NFeDistribuicaoDFe,
 * mas para modelo 57 (CT-e).
 *
 * Mesmo padrão: cStat=138 sucesso, docZip base64+gzip, mTLS via SefazAgentService.
 *
 * Modos:
 * - `consultarPorNsu` — modo distNSU (descoberta sequencial). É o modo principal
 *   suportado pelo Ambiente Nacional. Use este para ingestão automática.
 * - `consultarPorChave` — modo consChCTe. ATENÇÃO: o Nacional NÃO suporta este
 *   modo (limitação documentada na NT 2014.002 e confirmada na PoC 05/05/2026).
 *   Mantido por compatibilidade histórica; será movido para CTeConsultaProtocolo
 *   (per UF) ou SVRS_CTE em sprint futura.
 */
@Injectable()
export class CteDistribuicaoClient {
  private readonly logger = new Logger(CteDistribuicaoClient.name);
  private readonly cnpjConsulente: string;
  private readonly parser: XMLParser;

  constructor(
    private readonly agentService: SefazAgentService,
    config: ConfigService,
  ) {
    this.cnpjConsulente = (config.get<string>('FISCAL_CNPJ_CONSULENTE') ?? '').replace(/\D/g, '');
    this.parser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: false,
      parseTagValue: false,
      trimValues: true,
      removeNSPrefix: true,
    });
  }

  /**
   * Consulta documentos por NSU sequencial (modo distNSU).
   *
   * Comportamento confirmado na PoC 05/05/2026 contra HOM SEFAZ:
   * - SEFAZ varre até 50 NSUs por chamada e retorna `ultNSU` do bloco processado
   *   (não do último doc localizado).
   * - Cliente deve fazer loop até `ultNSU == maxNSU`.
   * - cStat=137 ("Nenhum documento localizado") é resposta normal — não é erro;
   *   `ultNSU`/`maxNSU` retornados informam ao cliente o estado do cursor.
   * - cStat=138 indica que `loteDistDFeInt.docZip` tem documentos.
   *
   * Documentos podem ser de qualquer schema (procCTe, procCTeSimp, resCTe,
   * procEventoCTe, resEventoCTe). Caller decide como processar via @schema.
   *
   * @param params.cnpj            CNPJ consulente (14 dígitos, sem máscara)
   * @param params.cUFAutor        Código IBGE da UF do consulente (ex: "31" = MG)
   * @param params.ultNSU          Último NSU já processado (cliente envia 0 na 1ª vez)
   * @param params.ambiente        'PRODUCAO' | 'HOMOLOGACAO'
   *
   * @throws SefazConsultaError quando cStat ∉ {137, 138} (ex: 280 cert vencido,
   *   656 consumo indevido, 215 falha schema). Caller decide se é fatal.
   */
  async consultarPorNsu(params: {
    cnpj: string;
    cUFAutor: string;
    ultNSU: string;
    ambiente: AmbienteSefazStr;
  }): Promise<RetDistDFeIntCte> {
    const cnpj = params.cnpj.replace(/\D/g, '');
    if (!/^\d{14}$/.test(cnpj)) {
      throw new Error(`CNPJ inválido para consulta CT-e distNSU: ${params.cnpj}`);
    }
    const ultNSU = String(params.ultNSU).padStart(15, '0');
    const tpAmb = params.ambiente === 'PRODUCAO' ? '1' : '2';

    const distDFeXml =
      `<distDFeInt xmlns="http://www.portalfiscal.inf.br/cte" versao="1.00">` +
      `<tpAmb>${tpAmb}</tpAmb>` +
      `<cUFAutor>${params.cUFAutor}</cUFAutor>` +
      `<CNPJ>${cnpj}</CNPJ>` +
      `<distNSU><ultNSU>${ultNSU}</ultNSU></distNSU>` +
      `</distDFeInt>`;
    const inner =
      `<cteDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe">` +
      `<cteDadosMsg xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe">${distDFeXml}</cteDadosMsg>` +
      `</cteDistDFeInteresse>`;
    const envelope = buildSoapEnvelope(inner);
    const url = getCteDistribuicaoUrl(params.ambiente);
    const agent = await this.agentService.getAgent();

    this.logger.log(
      `CTeDistribuicaoDFe distNSU: cnpj=${cnpj} cUFAutor=${params.cUFAutor} ultNSU=${ultNSU} ambiente=${params.ambiente}`,
    );

    const { statusCode, rawResponse } = await soapPost({
      url,
      envelope,
      agent,
      soapAction: 'http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe/cteDistDFeInteresse',
      timeoutMs: 30_000,
    });

    if (statusCode !== 200) {
      this.logger.error(
        `CTeDistribuicaoDFe distNSU HTTP ${statusCode}: ${rawResponse.slice(0, 300)}`,
      );
      throw new Error(`CTeDistribuicaoDFe retornou HTTP ${statusCode}`);
    }

    return this.parseDistNsuResponse(rawResponse);
  }

  private parseDistNsuResponse(raw: string): RetDistDFeIntCte {
    const parsed = this.parser.parse(raw);
    const envelope = parsed?.Envelope;
    const body = envelope?.Body;
    const result = body?.cteDistDFeInteresseResponse?.cteDistDFeInteresseResult;
    const retDistDFeInt = result?.retDistDFeInt;
    if (!retDistDFeInt) {
      throw new Error(`Resposta CT-e distNSU sem <retDistDFeInt>. Raw: ${raw.slice(0, 500)}`);
    }

    const cStat = String(retDistDFeInt.cStat ?? '');
    const xMotivo = String(retDistDFeInt.xMotivo ?? '');

    // 137 e 138 são respostas normais com cursor. Outros cStat são erro
    // que deve subir como exceção pra orquestrador decidir (ex: 656 → bloqueia 1h).
    if (cStat !== '137' && cStat !== '138') {
      throw new SefazConsultaError(cStat, xMotivo);
    }

    const docZips: CteDocZip[] = [];
    const lote = retDistDFeInt.loteDistDFeInt;
    if (cStat === '138' && lote?.docZip) {
      const items = Array.isArray(lote.docZip) ? lote.docZip : [lote.docZip];
      for (const dz of items) {
        const base64 = typeof dz === 'string' ? dz : (dz['#text'] ?? '');
        const nsu = String(dz?.['@_NSU'] ?? '');
        const schema = String(dz?.['@_schema'] ?? '');
        if (!base64) {
          this.logger.warn(`docZip vazio em NSU=${nsu} — ignorando`);
          continue;
        }
        try {
          const decompressed = gunzipSync(Buffer.from(base64, 'base64'));
          const decoded = decodeXmlBytes(decompressed, `CTeDistribuicao NSU=${nsu}`);
          if (decoded.encodingAnomaly) {
            this.logger.warn(
              `[CTeDistribuicao] docZip NSU=${nsu} com encoding anomaly (latin1 fallback) — emitente nao-conforme.`,
            );
          }
          docZips.push({ nsu, schema, xml: decoded.xml });
        } catch (err) {
          this.logger.error(`Falha ao descomprimir docZip NSU=${nsu}: ${err instanceof Error ? err.message : err}`);
        }
      }
    }

    return {
      cStat,
      xMotivo,
      ultNSU: String(retDistDFeInt.ultNSU ?? '0').padStart(15, '0'),
      maxNSU: String(retDistDFeInt.maxNSU ?? '0').padStart(15, '0'),
      dhResp: retDistDFeInt.dhResp ? String(retDistDFeInt.dhResp) : undefined,
      tpAmb: String(retDistDFeInt.tpAmb ?? ''),
      docZips,
    };
  }

  /**
   * @deprecated O Ambiente Nacional NÃO suporta `<consChCTe>` — limitação
   * documentada na NT 2014.002 e confirmada na PoC 05/05/2026. Para consulta
   * por chave use `CTeConsultaProtocolo` (per UF) ou `SVRS_CTE`. Este método
   * será movido em sprint futura. Mantido para compatibilidade.
   */
  async consultarPorChave(
    chave: string,
    ufAutor: string,
    ambiente: AmbienteSefazStr,
  ): Promise<{ xml: string; cStat: string; xMotivo: string }> {
    if (!/^\d{44}$/.test(chave)) {
      throw new Error(`Chave CT-e inválida: ${chave}`);
    }
    if (!this.cnpjConsulente) {
      throw new ServiceUnavailableException(
        'FISCAL_CNPJ_CONSULENTE não configurado — obrigatório para CTeDistribuicaoDFe.',
      );
    }

    const cUF = cufFromUf(ufAutor);
    const tpAmb = ambiente === 'PRODUCAO' ? '1' : '2';

    const distDFeXml = `<distDFeInt xmlns="http://www.portalfiscal.inf.br/cte" versao="1.00"><tpAmb>${tpAmb}</tpAmb><cUFAutor>${cUF}</cUFAutor><CNPJ>${this.cnpjConsulente}</CNPJ><consChCTe><chCTe>${chave}</chCTe></consChCTe></distDFeInt>`;
    const inner = `<cteDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe"><cteDadosMsg xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe">${distDFeXml}</cteDadosMsg></cteDistDFeInteresse>`;
    const envelope = buildSoapEnvelope(inner);
    const url = getCteDistribuicaoUrl(ambiente);
    const agent = await this.agentService.getAgent();

    this.logger.log(`CTeDistribuicaoDFe: consulta chave ${chave.slice(0, 6)}… em ${ambiente}`);

    const { statusCode, rawResponse } = await soapPost({
      url,
      envelope,
      agent,
      soapAction: 'http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe/cteDistDFeInteresse',
      timeoutMs: 30_000,
    });

    if (statusCode !== 200) {
      this.logger.error(`CTeDistribuicaoDFe HTTP ${statusCode}: ${rawResponse.slice(0, 300)}`);
      throw new Error(`CTeDistribuicaoDFe retornou HTTP ${statusCode}`);
    }

    return this.parseResponse(rawResponse, chave);
  }

  private parseResponse(raw: string, chave: string): { xml: string; cStat: string; xMotivo: string } {
    const parsed = this.parser.parse(raw);
    const envelope = parsed?.Envelope;
    const body = envelope?.Body;
    const result = body?.cteDistDFeInteresseResponse?.cteDistDFeInteresseResult;
    const retDistDFeInt = result?.retDistDFeInt;
    if (!retDistDFeInt) {
      throw new Error(`Resposta CT-e sem <retDistDFeInt>. Raw: ${raw.slice(0, 500)}`);
    }

    const cStat = String(retDistDFeInt.cStat ?? '');
    const xMotivo = String(retDistDFeInt.xMotivo ?? '');

    if (cStat !== '138') {
      throw new SefazConsultaError(cStat, xMotivo);
    }

    const loteDistDFeInt = retDistDFeInt.loteDistDFeInt;
    if (!loteDistDFeInt) {
      throw new Error(`Consulta CT-e ${chave} sem loteDistDFeInt. cStat=${cStat}`);
    }
    const docsZip = Array.isArray(loteDistDFeInt.docZip) ? loteDistDFeInt.docZip : [loteDistDFeInt.docZip];
    const first = docsZip[0];
    const base64 = typeof first === 'string' ? first : (first?.['#text'] ?? '');
    if (!base64) {
      throw new Error('docZip CT-e vazio.');
    }
    const compressed = Buffer.from(base64, 'base64');
    const decoded = decodeXmlBytes(gunzipSync(compressed), `CTeConsultaPorChave ${chave}`);
    if (decoded.encodingAnomaly) {
      this.logger.warn(
        `[CTeConsulta] chave=${chave} com encoding anomaly (latin1 fallback) — emitente nao-conforme.`,
      );
    }
    return { xml: decoded.xml, cStat, xMotivo };
  }

}
