import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { SefazAgentService } from './sefaz-agent.service.js';
import { getNfeConsultaProtocoloUrl, type AmbienteSefazStr } from './sefaz-endpoints.map.js';
import { buildSoapEnvelope } from './soap-envelope.helper.js';
import { soapPost } from './sefaz-http.helper.js';
import { ufFromChave } from '../common/helpers/chave.helper.js';

/**
 * Erro tipado para falhas do web service NfeConsultaProtocolo4.
 * Permite que o caller (NfeService) distinga erros da SEFAZ e gere mensagem
 * amigavel para o usuario em vez de "Erro interno do servidor".
 */
export class NfeConsultaProtocoloError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'NfeConsultaProtocoloError';
  }
}

/**
 * Cliente do web service NfeConsultaProtocolo4 (SOAP 1.2, per UF).
 *
 * Uso: o botão "Atualizar status no SEFAZ" na tela de consulta NF-e.
 * Retorna o status atual da NF-e (autorizada/cancelada/denegada/etc.) e,
 * quando aplicável, a lista de eventos associados.
 *
 * Diferente do NFeDistribuicaoDFe (nacional), este web service é **per UF**
 * da autorizadora. O UF é extraído da chave de acesso (posições 3-4).
 */
@Injectable()
export class NfeConsultaProtocoloClient {
  private readonly logger = new Logger(NfeConsultaProtocoloClient.name);
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

  async consultar(
    chave: string,
    ambiente: AmbienteSefazStr,
  ): Promise<{
    cStat: string;
    xMotivo: string;
    dataRecebimento: string | null;
    protocolo: string | null;
    eventos: Array<{
      tipoEvento: string;
      descricao: string;
      dataEvento: string;
      protocolo: string | null;
      cStat: string | null;
      xMotivo: string | null;
      rawXml: string | null;
    }>;
  }> {
    if (!/^\d{44}$/.test(chave)) {
      throw new Error(`Chave inválida: ${chave}`);
    }

    const uf = ufFromChave(chave);
    const tpAmb = ambiente === 'PRODUCAO' ? '1' : '2';

    const consSitNFe = `<consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${tpAmb}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${chave}</chNFe></consSitNFe>`;
    // <nfeDadosMsg> direto no Body — a operação é despachada pelo header SOAPAction,
    // não por wrapper. Mesma regra do CCC e NFEStatusServico (padrão extraído do
    // NFeWizard-io). Adicionar wrapper <nfeConsultaNF> faz o Axis do SEFAZ MG
    // retornar "Não é possível localizar o método de despacho".
    const inner = `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4">${consSitNFe}</nfeDadosMsg>`;
    const envelope = buildSoapEnvelope(inner);
    const url = getNfeConsultaProtocoloUrl(uf, ambiente);
    const agent = await this.agentService.getAgent();

    this.logger.log(`NfeConsultaProtocolo: chave ${chave.slice(0, 6)}… UF=${uf} ambiente=${ambiente}`);

    const { statusCode, rawResponse } = await soapPost({
      url,
      envelope,
      agent,
      soapAction: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4/nfeConsultaNF',
      timeoutMs: 20_000,
    });

    if (statusCode !== 200) {
      // Tenta extrair SOAP Fault (que pode ter vindo no corpo HTTP 500)
      const fault = this.tryParseSoapFault(rawResponse);
      this.logger.error(
        `NfeConsultaProtocolo HTTP ${statusCode} — url=${url} — fault=${fault ?? 'n/a'} — raw=${rawResponse.slice(0, 500)}`,
      );
      throw new NfeConsultaProtocoloError(
        fault
          ? `SEFAZ ${uf} retornou erro: ${fault}`
          : `Serviço NfeConsultaProtocolo da SEFAZ ${uf} indisponível (HTTP ${statusCode}). Tente novamente em alguns minutos.`,
        statusCode,
      );
    }

    const parsed = this.parser.parse(rawResponse);
    const envelopeResp = parsed?.Envelope;
    const bodyResp = envelopeResp?.Body;
    // Estruturas possíveis de retorno (variam por UF):
    //  - MG (Axis): <nfeResultMsg><retConsSitNFe>…
    //  - SVRS (.asmx): <nfeConsultaNFResponse><nfeConsultaNFResult><retConsSitNFe>…
    //  - Alguns Java: <nfeConsultaNFResponse><retConsSitNFe>… (sem Result)
    const retConsSitNFe =
      bodyResp?.nfeResultMsg?.retConsSitNFe ??
      bodyResp?.nfeConsultaNFResponse?.nfeConsultaNFResult?.retConsSitNFe ??
      bodyResp?.nfeConsultaNFResponse?.retConsSitNFe ??
      bodyResp?.retConsSitNFe;
    if (!retConsSitNFe) {
      // Resposta 200 mas sem retConsSitNFe — pode ser um fault inesperado
      const fault = this.tryParseSoapFault(rawResponse);
      this.logger.error(
        `NfeConsultaProtocolo resposta inválida — fault=${fault ?? 'n/a'} — raw=${rawResponse.slice(0, 500)}`,
      );
      throw new NfeConsultaProtocoloError(
        fault
          ? `SEFAZ ${uf} respondeu: ${fault}`
          : `SEFAZ ${uf} retornou resposta sem <retConsSitNFe>.`,
        200,
      );
    }

    const cStat = String(retConsSitNFe.cStat ?? '');
    const xMotivo = String(retConsSitNFe.xMotivo ?? '');
    const protNFe = retConsSitNFe.protNFe?.infProt;
    const protocolo = protNFe ? String(protNFe.nProt ?? '') : null;
    const dataRecebimento = protNFe ? String(protNFe.dhRecbto ?? '') : null;

    // Eventos vêm em <procEventoNFe> (0..N)
    const procEventoRaw = retConsSitNFe.procEventoNFe;
    const procEventos = procEventoRaw
      ? Array.isArray(procEventoRaw)
        ? procEventoRaw
        : [procEventoRaw]
      : [];

    // Extrai cada bloco <procEventoNFe>...</procEventoNFe> bruto na ordem em
    // que aparecem na resposta — usado para persistir o XML completo de cada
    // evento em `documento_evento.xmlEvento` (permite parse detalhado depois).
    const rawProcEventos = Array.from(
      rawResponse.matchAll(/<procEventoNFe[\s\S]*?<\/procEventoNFe>/g),
    ).map((m) => m[0]);

    const eventos = procEventos.map((p: any, idx: number) => {
      const infEvento = p?.evento?.infEvento ?? {};
      const retEvento = p?.retEvento?.infEvento ?? {};
      return {
        tipoEvento: String(infEvento.tpEvento ?? ''),
        descricao: String(retEvento.xEvento ?? infEvento.detEvento?.descEvento ?? ''),
        dataEvento: String(infEvento.dhEvento ?? ''),
        protocolo: retEvento.nProt ? String(retEvento.nProt) : null,
        cStat: retEvento.cStat ? String(retEvento.cStat) : null,
        xMotivo: retEvento.xMotivo ? String(retEvento.xMotivo) : null,
        rawXml: rawProcEventos[idx] ?? null,
      };
    });

    return { cStat, xMotivo, dataRecebimento, protocolo, eventos };
  }

  /**
   * Tenta extrair mensagem util de um SOAP Fault no corpo da resposta.
   * Usado quando o servidor retorna HTTP 5xx com SOAP fault estruturado.
   */
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
