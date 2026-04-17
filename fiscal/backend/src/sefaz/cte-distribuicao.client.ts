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

/**
 * Cliente do web service CTeDistribuicaoDFe — análogo ao NFeDistribuicaoDFe,
 * mas para modelo 57 (CT-e).
 *
 * Mesmo padrão: consulta por chave, cStat=138 sucesso, docZip base64+gzip,
 * mTLS via SefazAgentService.
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
    const xml = gunzipSync(compressed).toString('utf8');

    return { xml, cStat, xMotivo };
  }

}
