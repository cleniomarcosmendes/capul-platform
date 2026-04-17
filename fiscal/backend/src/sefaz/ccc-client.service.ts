import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { SefazAgentService } from './sefaz-agent.service.js';
import { getCccUrl, type AmbienteSefazStr } from './sefaz-endpoints.map.js';
import { buildSoapEnvelope } from './soap-envelope.helper.js';
import { soapPost } from './sefaz-http.helper.js';

/**
 * Retorno bruto do CadConsultaCadastro4 — mapeado diretamente a partir do
 * infCons/infCad da SEFAZ, sem transformar para o shape persistido.
 */
export interface CccConsultaRaw {
  cStat: string;
  xMotivo: string;
  ufConsultada: string;
  dataConsulta: string | null;
  contribuintes: Array<{
    ie?: string | null;
    cnpj?: string | null;
    cpf?: string | null;
    uf: string;
    situacaoCadastral: string; // "Habilitado" | "Não habilitado" | "Suspenso" | "Inapto" | "Baixado"
    dataSituacao?: string | null; // dUltSit
    dataFimAtividade?: string | null; // dFimAtiv
    regimeApuracao?: string | null; // xRegApur (ex: "Normal", "Simples Nacional")
    ieDestinatario?: string | null; // indCredNFe → "Opcional" | "Obrigatório" | "Não credenciado"
    ieDestinatarioCTe?: string | null; // indCredCTe
    razaoSocial?: string | null;
    nomeFantasia?: string | null;
    cnae?: string | null;
    inicioAtividade?: string | null;
    endereco?: {
      logradouro?: string | null;
      numero?: string | null;
      complemento?: string | null;
      bairro?: string | null;
      municipio?: string | null;
      codigoMunicipio?: string | null;
      cep?: string | null;
    } | null;
  }>;
}

/**
 * Cliente do web service CadConsultaCadastro4 — consulta cadastral
 * de contribuintes via SOAP 1.2 na SEFAZ de cada UF.
 *
 * Uso em 3 modos na Onda 1:
 *   - Consulta PONTUAL (Etapa 11): 1 CNPJ + UF.
 *   - Cruzamento INCREMENTAL (Onda 2): lote de CNPJs filtrados.
 *   - Cruzamento COMPLETO (Onda 2): bootstrap/semanal.
 *
 * Apenas o modo pontual está exposto ao frontend na Onda 1. Os modos em lote
 * são iteração deste método pelo `cruzamento/execucao.service.ts` (Onda 2).
 */
@Injectable()
export class CccClient {
  private readonly logger = new Logger(CccClient.name);
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

  /**
   * Consulta cadastral por UF + CNPJ ou CPF.
   * O CCC da SEFAZ aceita ambos — a diferença é o tag XML:
   * `<CNPJ>` para 14 dígitos, `<CPF>` para 11 dígitos.
   */
  async consultarPorCnpj(
    documento: string,
    uf: string,
    ambiente: AmbienteSefazStr,
  ): Promise<CccConsultaRaw> {
    const digits = documento.replace(/\D/g, '');
    if (digits.length !== 14 && digits.length !== 11) {
      throw new Error(`Documento inválido (esperado 11 ou 14 dígitos): ${documento}`);
    }
    const isCpf = digits.length === 11;
    const tagDoc = isCpf ? `<CPF>${digits}</CPF>` : `<CNPJ>${digits}</CNPJ>`;
    const ufUpper = uf.toUpperCase();
    const tpAmb = ambiente === 'PRODUCAO' ? '1' : '2';

    const url = getCccUrl(ufUpper, ambiente);
    const agent = await this.agentService.getAgent();
    const consCad = `<ConsCad xmlns="http://www.portalfiscal.inf.br/nfe" versao="2.00"><infCons><xServ>CONS-CAD</xServ><UF>${ufUpper}</UF>${tagDoc}</infCons></ConsCad>`;

    // Envelope CCC v4: <nfeDadosMsg> direto no Body (operação despachada pelo
    // header SOAPAction, não por wrapper). SEM CDATA, SEM XML declaration, SEM
    // whitespace — padrão extraído do NFeWizard-io (NFEStatusServicoService).
    const inner = `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/CadConsultaCadastro4">${consCad}</nfeDadosMsg>`;
    const envelope = buildSoapEnvelope(inner);

    this.logger.log(`CCC: ${isCpf ? 'CPF' : 'CNPJ'} ${digits.slice(0, 6)}… UF=${ufUpper} ambiente=${ambiente}`);

    const { statusCode, rawResponse } = await soapPost({
      url,
      envelope,
      agent,
      soapAction: 'http://www.portalfiscal.inf.br/nfe/wsdl/CadConsultaCadastro4/consultaCadastro',
      timeoutMs: 20_000,
    });

    // SOAP faults retornam HTTP 500 mas com corpo XML estruturado — extrair mensagem
    if (statusCode !== 200) {
      const faultMsg = this.extractSoapFault(rawResponse);
      if (faultMsg) {
        throw new Error(`SEFAZ ${ufUpper} retornou erro: ${faultMsg}`);
      }
      throw new Error(`CCC HTTP ${statusCode} — SEFAZ ${ufUpper} indisponível. Tente novamente em alguns minutos.`);
    }

    this.logger.debug(`CCC raw response (${rawResponse.length} bytes): ${rawResponse.slice(0, 1500)}`);
    return this.parseResponse(rawResponse, ufUpper);
  }

  private parseResponse(raw: string, ufConsultada: string): CccConsultaRaw {
    const parsed = this.parser.parse(raw);
    const envelope = parsed?.Envelope;
    const body = envelope?.Body;
    // A SEFAZ retorna a resposta com nomenclatura variável entre UFs:
    // MG: <consultaCadastro4Result><retConsCad>...
    // SVRS: <consultaCadastro2Response><consultaCadastro2Result><retConsCad>...
    // Outros: <consultaCadastroResponse><consultaCadastroResult><retConsCad>...
    const retConsCad =
      body?.nfeResultMsg?.retConsCad ??
      body?.consultaCadastro4Result?.retConsCad ??
      body?.consultaCadastro2Result?.retConsCad ??
      body?.consultaCadastro2Response?.consultaCadastro2Result?.retConsCad ??
      body?.consultaCadastro4Response?.consultaCadastro4Result?.retConsCad ??
      body?.consultaCadastroResponse?.consultaCadastroResult?.retConsCad ??
      body?.retConsCad;
    if (!retConsCad) {
      throw new Error(`Resposta CCC sem <retConsCad>. Raw: ${raw.slice(0, 500)}`);
    }

    const infCons = retConsCad.infCons;
    if (!infCons) {
      throw new Error(`<retConsCad> sem <infCons>. Raw: ${raw.slice(0, 400)}`);
    }

    const cStat = String(infCons.cStat ?? '');
    const xMotivo = String(infCons.xMotivo ?? '');
    const dataConsulta = infCons.dhCons ? String(infCons.dhCons) : null;

    // infCad: pode ser objeto único ou array, ou ausente (quando não encontrou)
    const infCadRaw = infCons.infCad;
    const infCadList = infCadRaw
      ? Array.isArray(infCadRaw)
        ? infCadRaw
        : [infCadRaw]
      : [];

    const contribuintes = infCadList.map((c: any) => {
      const ender = c.ender ?? null;
      return {
        ie: str(c.IE),
        cnpj: str(c.CNPJ),
        cpf: str(c.CPF),
        uf: String(c.UF ?? ufConsultada),
        situacaoCadastral: this.mapSituacao(String(c.cSit ?? '0')),
        // dUltSit = "data última alteração cadastral" (campo oficial CCC v4).
        // Fallbacks para dSit/dtSitCad em caso de UFs que usam nomes antigos.
        dataSituacao: str(c.dUltSit ?? c.dSit ?? c.dtSitCad),
        dataFimAtividade: str(c.dFimAtiv),
        regimeApuracao: str(c.xRegApur),
        ieDestinatario: this.mapIndCred(c.indCredNFe),
        ieDestinatarioCTe: this.mapIndCred(c.indCredCTe),
        razaoSocial: str(c.xNome),
        nomeFantasia: str(c.xFant),
        cnae: str(c.CNAE),
        inicioAtividade: str(c.dIniAtiv),
        endereco: ender
          ? {
              logradouro: str(ender.xLgr),
              numero: str(ender.nro),
              complemento: str(ender.xCpl),
              bairro: str(ender.xBairro),
              municipio: str(ender.xMun),
              codigoMunicipio: str(ender.cMun),
              cep: str(ender.CEP),
            }
          : null,
      };
    });

    return { cStat, xMotivo, ufConsultada, dataConsulta, contribuintes };
  }

  /**
   * Mapa cSit → situação legível. Os valores retornados pela SEFAZ são:
   *   0 = Não habilitado
   *   1 = Habilitado
   *   2 = Suspenso
   *   3 = Inapto
   *   4 = Baixado
   *   5 = Nulo
   */
  private mapSituacao(cSit: string): string {
    const map: Record<string, string> = {
      '0': 'Não habilitado',
      '1': 'Habilitado',
      '2': 'Suspenso',
      '3': 'Inapto',
      '4': 'Baixado',
      '5': 'Nulo',
    };
    return map[cSit] ?? `Desconhecido (${cSit})`;
  }

  /**
   * Mapeia `indCredNFe` / `indCredCTe` (credenciamento da IE como destinatário
   * de NF-e ou CT-e):
   *   0 = Não credenciado
   *   1 = Credenciado
   *   2 = Credenciado com obrigatoriedade para todas as operações
   *   3 = Credenciado com obrigatoriedade parcial
   *   4 = A UF não exige credenciamento (opcional)
   */
  private mapIndCred(ind: unknown): string | null {
    if (ind === undefined || ind === null || ind === '') return null;
    const map: Record<string, string> = {
      '0': 'Não credenciado',
      '1': 'Credenciado',
      '2': 'Obrigatório (todas operações)',
      '3': 'Obrigatório (parcial)',
      '4': 'Opcional',
    };
    const key = String(ind);
    return map[key] ?? `Código ${key}`;
  }

  private extractSoapFault(xml: string): string | null {
    try {
      const parsed = this.parser.parse(xml);
      const fault = parsed?.Envelope?.Body?.Fault;
      if (!fault) return xml.slice(0, 400);
      const reasonNode = fault?.Reason?.Text;
      const reason = typeof reasonNode === 'string'
        ? reasonNode
        : (reasonNode?.['#text'] ?? (typeof reasonNode === 'object' ? JSON.stringify(reasonNode) : String(reasonNode ?? '')));
      const detail = fault?.Detail?.text ?? fault?.detail ?? fault?.faultstring;
      const detailStr = typeof detail === 'string' ? detail : (detail ? JSON.stringify(detail) : null);
      return [reason, detailStr].filter(Boolean).join(' — ') || xml.slice(0, 400);
    } catch {
      return xml.slice(0, 400);
    }
  }
}

function str(v: any): string | null {
  if (v === undefined || v === null || v === '') return null;
  return String(v);
}
