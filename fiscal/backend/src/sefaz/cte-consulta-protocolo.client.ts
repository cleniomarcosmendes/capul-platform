import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { SefazAgentService } from './sefaz-agent.service.js';
import { getCteConsultaProtocoloUrl, type AmbienteSefazStr } from './sefaz-endpoints.map.js';
import { buildSoapEnvelope } from './soap-envelope.helper.js';
import { soapPost } from './sefaz-http.helper.js';
import { ufFromChave } from '../common/helpers/chave.helper.js';

export class CteConsultaProtocoloError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'CteConsultaProtocoloError';
  }
}

export interface CteConsultaProtocoloResult {
  cStat: string;
  xMotivo: string;
  dataRecebimento: string | null;
  protocolo: string | null;
  digestValue: string | null;
  eventos: Array<{
    tipoEvento: string;
    descricao: string;
    dataEvento: string;
    protocolo: string | null;
    cStat: string | null;
    xMotivo: string | null;
  }>;
}

/**
 * Cliente do web service CTeConsultaProtocolo V4 (SOAP 1.2, per UF).
 *
 * É o ÚNICO serviço SEFAZ que aceita consulta de CT-e por chave.
 * Retorna status/protocolo/eventos — NUNCA o XML autorizado completo
 * (esse só vem via Protheus cache ou via CTeDistribuicaoDFe por NSU).
 *
 * Referência: sped-cte Tools.php::sefazConsultaChave
 *   https://github.com/nfephp-org/sped-cte/blob/master/src/Tools.php
 */
@Injectable()
export class CteConsultaProtocoloClient {
  private readonly logger = new Logger(CteConsultaProtocoloClient.name);
  private readonly parser: XMLParser;

  constructor(private readonly agentService: SefazAgentService) {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: false,
      parseTagValue: false,
      trimValues: true,
      removeNSPrefix: true,
    });
  }

  async consultar(chave: string, ambiente: AmbienteSefazStr): Promise<CteConsultaProtocoloResult> {
    if (!/^\d{44}$/.test(chave)) {
      throw new Error(`Chave CT-e inválida: ${chave}`);
    }

    const uf = ufFromChave(chave);
    const tpAmb = ambiente === 'PRODUCAO' ? '1' : '2';

    const consSitCTe = `<consSitCTe xmlns="http://www.portalfiscal.inf.br/cte" versao="4.00"><tpAmb>${tpAmb}</tpAmb><xServ>CONSULTAR</xServ><chCTe>${chave}</chCTe></consSitCTe>`;
    // <cteDadosMsg> direto no Body — mesma regra do NfeConsultaProtocolo e CCC:
    // a operação é despachada pelo SOAPAction, sem wrapper.
    const inner = `<cteDadosMsg xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CTeConsultaV4">${consSitCTe}</cteDadosMsg>`;
    const envelope = buildSoapEnvelope(inner);
    const url = getCteConsultaProtocoloUrl(uf, ambiente);
    const agent = await this.agentService.getAgent();

    this.logger.log(`CteConsultaProtocolo: chave ${chave.slice(0, 6)}… UF=${uf} ambiente=${ambiente}`);

    const { statusCode, rawResponse } = await soapPost({
      url,
      envelope,
      agent,
      soapAction: 'http://www.portalfiscal.inf.br/cte/wsdl/CTeConsultaV4/cteConsultaCT',
      timeoutMs: 20_000,
    });

    if (statusCode !== 200) {
      const fault = this.tryParseSoapFault(rawResponse);
      this.logger.error(
        `CteConsultaProtocolo HTTP ${statusCode} — url=${url} — fault=${fault ?? 'n/a'} — raw=${rawResponse.slice(0, 500)}`,
      );
      throw new CteConsultaProtocoloError(
        fault
          ? `SEFAZ ${uf} retornou erro (CT-e): ${fault}`
          : `Serviço CteConsultaProtocolo da SEFAZ ${uf} indisponível (HTTP ${statusCode}). Tente novamente em alguns minutos.`,
        statusCode,
      );
    }

    const parsed = this.parser.parse(rawResponse);
    const envelopeResp = parsed?.Envelope;
    const bodyResp = envelopeResp?.Body;
    // Estruturas possíveis — variam por UF. Exemplos observados em produção:
    //  - MG (Axis):   <cteConsultaCTResult><retConsSitCTe>…
    //  - SVRS:        <cteConsultaCTResponse><cteConsultaCTResult><retConsSitCTe>…
    //  - SP/Java:     <cteResultMsg><retConsSitCTe>…
    const retConsSitCTe =
      bodyResp?.cteResultMsg?.retConsSitCTe ??
      bodyResp?.cteConsultaCTResult?.retConsSitCTe ??
      bodyResp?.cteConsultaCTResponse?.cteConsultaCTResult?.retConsSitCTe ??
      bodyResp?.cteConsultaCTResponse?.retConsSitCTe ??
      bodyResp?.retConsSitCTe;
    if (!retConsSitCTe) {
      const fault = this.tryParseSoapFault(rawResponse);
      this.logger.error(
        `CteConsultaProtocolo resposta inválida — fault=${fault ?? 'n/a'} — raw=${rawResponse.slice(0, 500)}`,
      );
      throw new CteConsultaProtocoloError(
        fault
          ? `SEFAZ ${uf} respondeu: ${fault}`
          : `SEFAZ ${uf} retornou resposta sem <retConsSitCTe>.`,
        200,
      );
    }

    const cStat = String(retConsSitCTe.cStat ?? '');
    const xMotivo = String(retConsSitCTe.xMotivo ?? '');
    const protCTe = retConsSitCTe.protCTe?.infProt;
    const protocolo = protCTe ? String(protCTe.nProt ?? '') : null;
    const dataRecebimento = protCTe ? String(protCTe.dhRecbto ?? '') : null;
    const digestValue = protCTe?.digVal ? String(protCTe.digVal) : null;

    // Eventos — em CT-e vêm em <procEventoCTe> (0..N)
    const procEventoRaw = retConsSitCTe.procEventoCTe;
    const procEventos = procEventoRaw
      ? Array.isArray(procEventoRaw)
        ? procEventoRaw
        : [procEventoRaw]
      : [];
    const eventos = procEventos.map((p: any) => {
      const infEvento = p?.eventoCTe?.infEvento ?? p?.evento?.infEvento ?? {};
      const retEvento = p?.retEventoCTe?.infEvento ?? p?.retEvento?.infEvento ?? {};
      return {
        tipoEvento: String(infEvento.tpEvento ?? ''),
        descricao: String(
          retEvento.xEvento ??
            infEvento.detEvento?.descEvento ??
            infEvento.detEvento?.xCondUso ??
            '',
        ),
        dataEvento: String(infEvento.dhEvento ?? retEvento.dhRegEvento ?? ''),
        protocolo: retEvento.nProt ? String(retEvento.nProt) : null,
        cStat: retEvento.cStat ? String(retEvento.cStat) : null,
        xMotivo: retEvento.xMotivo ? String(retEvento.xMotivo) : null,
      };
    });

    return { cStat, xMotivo, dataRecebimento, protocolo, digestValue, eventos };
  }

  private tryParseSoapFault(raw: string): string | null {
    try {
      const parsed = this.parser.parse(raw);
      const fault = parsed?.Envelope?.Body?.Fault;
      if (!fault) return null;
      const reasonNode = fault?.Reason?.Text ?? fault?.faultstring;
      const reason =
        typeof reasonNode === 'string'
          ? reasonNode
          : reasonNode?.['#text'] ?? JSON.stringify(reasonNode);
      const detail = fault?.Detail?.text ?? fault?.detail;
      const detailStr = typeof detail === 'string' ? detail : null;
      return [reason, detailStr].filter(Boolean).join(' — ') || null;
    } catch {
      return null;
    }
  }
}
