import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { gunzipSync } from 'node:zlib';
import { XMLParser } from 'fast-xml-parser';
import { SefazAgentService } from './sefaz-agent.service.js';
import { LimiteDiarioService } from '../limite-diario/limite-diario.service.js';
import { getNfeDistribuicaoUrl, type AmbienteSefazStr } from './sefaz-endpoints.map.js';
import { buildSoapEnvelope } from './soap-envelope.helper.js';
import { soapPost } from './sefaz-http.helper.js';
import { cufFromUf } from '../common/helpers/chave.helper.js';

/**
 * Cliente do web service NFeDistribuicaoDFe (SOAP 1.2, nacional).
 *
 * Modo suportado nesta v1: consulta por CHAVE (`consChNFe`). O modo por NSU
 * sequencial (recebimento em lote) não está aqui — se a CAPUL decidir mover
 * também esse fluxo do Protheus para este módulo, adicionamos depois.
 *
 * Regras:
 *  - XML vem base64 + gzip em `<docZip>` → descompactamos localmente.
 *  - cStat=138 (documento encontrado) → sucesso, retorna XML autorizado.
 *  - cStat=137 (nenhum documento) → lança SefazConsultaError, caller trata.
 *  - cStat=656 (consumo indevido) → rate limit, caller pode retry.
 *  - Outros cStat → SefazConsultaError com xMotivo original.
 *  - mTLS via SefazAgentService (https.Agent com pfx + passphrase).
 */
@Injectable()
export class NfeDistribuicaoClient {
  private readonly logger = new Logger(NfeDistribuicaoClient.name);
  private readonly cnpjConsulente: string;
  private readonly innerParser: XMLParser;

  constructor(
    private readonly agentService: SefazAgentService,
    private readonly limiteDiario: LimiteDiarioService,
    config: ConfigService,
  ) {
    this.cnpjConsulente = (config.get<string>('FISCAL_CNPJ_CONSULENTE') ?? '').replace(/\D/g, '');
    this.innerParser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: false,
      parseTagValue: false,
      trimValues: true,
      removeNSPrefix: true,
    });
  }

  /**
   * Consulta uma NF-e por chave. Retorna o XML autorizado completo
   * (`<nfeProc>...</nfeProc>`) pronto para gravar em SZR010 via
   * ProtheusXmlService.post ou para parsear direto.
   */
  async consultarPorChave(
    chave: string,
    ufAutor: string,
    ambiente: AmbienteSefazStr,
  ): Promise<{ xml: string; cStat: string; xMotivo: string }> {
    const resultado = await this.consChNFeInterno(chave, ufAutor, ambiente);
    if (!resultado.xmlNfe) {
      // Sem o procNFe — normalmente aconteceria em cenário atípico (SEFAZ
      // devolveu apenas eventos). Para este método específico, consideramos
      // erro: o chamador precisa do XML autorizado.
      throw new SefazConsultaError(
        resultado.cStat,
        `${resultado.xMotivo} — consulta para chave ${chave} não retornou o procNFe.`,
      );
    }
    return {
      xml: resultado.xmlNfe,
      cStat: resultado.cStat,
      xMotivo: resultado.xMotivo,
    };
  }

  /**
   * Consulta APENAS os eventos associados a uma chave NF-e via
   * NFeDistribuicaoDFe / consChNFe. O retorno inclui eventos registrados
   * no Ambiente Nacional (Ciência da Operação, Confirmação, Desconhecimento,
   * Operação Não Realizada — cOrgao=91) que não são devolvidos por
   * NfeConsultaProtocolo da UF de origem.
   *
   * Este método é idempotente do ponto de vista SEFAZ — NÃO cria NSU novo
   * nem consome a fila do CNPJ consulente. É considerado consulta por chave
   * pontual, supervisionada (usuário clica em "Atualizar status").
   *
   * Tratamento de cStat:
   *  - 138 = documento encontrado → processa docZips e retorna eventos
   *  - 137 = nada encontrado → retorna lista vazia (não é erro)
   *  - outros → lança SefazConsultaError
   */
  async consultarEventosPorChave(
    chave: string,
    ufAutor: string,
    ambiente: AmbienteSefazStr,
    cnpjConsulenteOverride?: string | null,
  ): Promise<{
    cStat: string;
    xMotivo: string;
    cnpjConsulenteUsado: string;
    eventos: Array<{
      tipoEvento: string;
      descricao: string;
      dataEvento: string;
      protocolo: string | null;
      cStat: string | null;
      xMotivo: string | null;
      rawXml: string;
    }>;
  }> {
    const cnpjUsado = (cnpjConsulenteOverride ?? this.cnpjConsulente).replace(/\D/g, '');
    try {
      const resultado = await this.consChNFeInterno(chave, ufAutor, ambiente, cnpjUsado);
      return {
        cStat: resultado.cStat,
        xMotivo: resultado.xMotivo,
        cnpjConsulenteUsado: cnpjUsado,
        eventos: resultado.eventos,
      };
    } catch (err) {
      if (err instanceof SefazConsultaError && err.cStat === '137') {
        // Nada encontrado → tratamos como "nenhum evento". Não é erro.
        return {
          cStat: err.cStat,
          xMotivo: err.xMotivo,
          cnpjConsulenteUsado: cnpjUsado,
          eventos: [],
        };
      }
      throw err;
    }
  }

  /**
   * Implementação compartilhada — executa consChNFe, descomprime todos os
   * docZips do lote e classifica cada um em procNFe (1x no máximo) ou
   * procEventoNFe (0..N). Usado tanto pelo download do XML quanto pelo
   * fetch de eventos.
   *
   * O parâmetro `cnpjConsulenteOverride` permite passar o CNPJ do
   * destinatário da NFe quando ele difere do consulente padrão — desde que
   * o certificado digital em uso tenha permissão (via e-CAC / procuração)
   * para consultar em nome desse CNPJ. Na CAPUL, o certificado único
   * 25834847000100 cobre todas as filiais da família 25834847 através de
   * procuração e-CAC.
   */
  private async consChNFeInterno(
    chave: string,
    ufAutor: string,
    ambiente: AmbienteSefazStr,
    cnpjConsulenteOverride?: string | null,
  ): Promise<{
    cStat: string;
    xMotivo: string;
    xmlNfe: string | null;
    eventos: Array<{
      tipoEvento: string;
      descricao: string;
      dataEvento: string;
      protocolo: string | null;
      cStat: string | null;
      xMotivo: string | null;
      rawXml: string;
    }>;
  }> {
    if (!/^\d{44}$/.test(chave)) {
      throw new Error(`Chave inválida: ${chave}`);
    }
    const cnpjUsado = (cnpjConsulenteOverride ?? this.cnpjConsulente).replace(/\D/g, '');
    if (!cnpjUsado || cnpjUsado.length !== 14) {
      throw new ServiceUnavailableException(
        'CNPJ consulente ausente ou inválido — obrigatório para NFeDistribuicaoDFe.',
      );
    }

    const cUF = cufFromUf(ufAutor);
    const tpAmb = ambiente === 'PRODUCAO' ? '1' : '2';

    const distDFeXml = `<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01"><tpAmb>${tpAmb}</tpAmb><cUFAutor>${cUF}</cUFAutor><CNPJ>${cnpjUsado}</CNPJ><consChNFe><chNFe>${chave}</chNFe></consChNFe></distDFeInt>`;

    const inner = `<nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">${distDFeXml}</nfeDadosMsg></nfeDistDFeInteresse>`;

    const envelope = buildSoapEnvelope(inner);
    const url = getNfeDistribuicaoUrl(ambiente);
    const agent = await this.agentService.getAgent();

    this.logger.log(
      `NFeDistribuicaoDFe consChNFe: chave ${chave.slice(0, 6)}… consulente=${cnpjUsado.slice(0, 8)}… em ${ambiente}`,
    );

    // Camada 4 Plano v2.0 §6.2 — contabiliza consulta SEFAZ no limite diário.
    await this.limiteDiario.checkAndIncrement();

    const { statusCode, rawResponse } = await soapPost({
      url,
      envelope,
      agent,
      soapAction: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse',
      timeoutMs: 30_000,
    });

    if (statusCode !== 200) {
      this.logger.error(`NFeDistribuicaoDFe HTTP ${statusCode}: ${truncate(rawResponse, 300)}`);
      throw new Error(`NFeDistribuicaoDFe retornou HTTP ${statusCode}`);
    }

    // Log diagnóstico: quantos docZips e quais os schemas — ajuda a detectar
    // quando o AN entrega só o procNFe (sem eventos) porque os eventos já
    // foram "consumidos" por outro sistema (ex.: Monitor NFe do Protheus).
    const docZipCount = (rawResponse.match(/<docZip/g) ?? []).length;
    const schemaMatches = Array.from(rawResponse.matchAll(/schema="([^"]+)"/g)).map((m) => m[1]);
    this.logger.log(
      `distDFe raw: ${docZipCount} docZip(s), schemas=[${schemaMatches.join(',')}]`,
    );

    return this.parseResponse(rawResponse, chave);
  }

  private parseResponse(
    raw: string,
    chave: string,
  ): {
    cStat: string;
    xMotivo: string;
    xmlNfe: string | null;
    eventos: Array<{
      tipoEvento: string;
      descricao: string;
      dataEvento: string;
      protocolo: string | null;
      cStat: string | null;
      xMotivo: string | null;
      rawXml: string;
    }>;
  } {
    const parsed = this.innerParser.parse(raw);
    const envelope = parsed?.Envelope;
    const body = envelope?.Body;
    const result = body?.nfeDistDFeInteresseResponse?.nfeDistDFeInteresseResult;
    const retDistDFeInt = result?.retDistDFeInt;
    if (!retDistDFeInt) {
      throw new Error(`Resposta SEFAZ sem <retDistDFeInt>. Raw: ${truncate(raw, 500)}`);
    }

    const cStat = String(retDistDFeInt.cStat ?? '');
    const xMotivo = String(retDistDFeInt.xMotivo ?? '');

    if (cStat !== '138') {
      // 137 = nada encontrado, 656 = consumo indevido, etc.
      throw new SefazConsultaError(cStat, xMotivo);
    }

    const loteDistDFeInt = retDistDFeInt.loteDistDFeInt;
    if (!loteDistDFeInt) {
      throw new Error(`Consulta para chave ${chave} sem loteDistDFeInt. cStat=${cStat}`);
    }
    const docsZipRaw = loteDistDFeInt.docZip;
    const docsZip = Array.isArray(docsZipRaw) ? docsZipRaw : docsZipRaw ? [docsZipRaw] : [];
    if (docsZip.length === 0) {
      throw new Error(`Consulta para chave ${chave} não retornou documentos.`);
    }

    let xmlNfe: string | null = null;
    const eventos: Array<{
      tipoEvento: string;
      descricao: string;
      dataEvento: string;
      protocolo: string | null;
      cStat: string | null;
      xMotivo: string | null;
      rawXml: string;
    }> = [];

    for (const doc of docsZip) {
      const base64 =
        typeof doc === 'string' ? doc : (doc['#text'] ?? doc['_'] ?? '');
      if (!base64) continue;
      let xml: string;
      try {
        xml = gunzipSync(Buffer.from(base64, 'base64')).toString('utf8');
      } catch (err) {
        this.logger.warn(`Falha ao descomprimir docZip: ${(err as Error).message}`);
        continue;
      }

      // Classificação por elemento raiz. Em NFe 4.00 os documentos podem ser:
      //   - <nfeProc>...<NFe>...</NFe>...</nfeProc> — a NFe autorizada
      //   - <procEventoNFe>...<evento>...<retEvento>...</procEventoNFe> — um evento
      //   - <resEvento> / <resNFe> — versões "resumidas" (só em outros modos)
      if (/<\s*procEventoNFe/i.test(xml)) {
        try {
          const detalhe = this.extrairDadosEvento(xml);
          if (detalhe) {
            eventos.push({ ...detalhe, rawXml: xml });
          }
        } catch (err) {
          this.logger.warn(`Falha ao parsear procEventoNFe: ${(err as Error).message}`);
        }
      } else if (/<\s*(nfeProc|NFe)/i.test(xml)) {
        if (!xmlNfe) xmlNfe = xml;
      }
      // demais tipos ignorados
    }

    return { cStat, xMotivo, xmlNfe, eventos };
  }

  /**
   * Parser mínimo de um procEventoNFe já descomprimido — extrai só o
   * necessário para popular EventoInput (tipo, data, protocolo, cStat).
   * O XML completo é armazenado à parte em `xmlEvento` para parse rico
   * sob demanda pelo NfeParserService.parseEventoXml.
   */
  private extrairDadosEvento(
    xml: string,
  ): {
    tipoEvento: string;
    descricao: string;
    dataEvento: string;
    protocolo: string | null;
    cStat: string | null;
    xMotivo: string | null;
  } | null {
    const parsed = this.innerParser.parse(xml);
    const proc = parsed?.procEventoNFe ?? parsed;
    const inf = proc?.evento?.infEvento;
    if (!inf) return null;
    const ret = proc?.retEvento?.infEvento ?? {};
    const tipoEvento = String(inf.tpEvento ?? '');
    const dataEvento = String(inf.dhEvento ?? '');
    if (!tipoEvento || !dataEvento) return null;
    const descDetEvento =
      typeof inf.detEvento?.descEvento === 'string'
        ? inf.detEvento.descEvento
        : null;
    return {
      tipoEvento,
      descricao: String(ret.xEvento ?? descDetEvento ?? `Evento ${tipoEvento}`),
      dataEvento,
      protocolo: ret.nProt ? String(ret.nProt) : null,
      cStat: ret.cStat ? String(ret.cStat) : null,
      xMotivo: ret.xMotivo ? String(ret.xMotivo) : null,
    };
  }

}

export class SefazConsultaError extends Error {
  constructor(public readonly cStat: string, public readonly xMotivo: string) {
    super(`SEFAZ cStat=${cStat}: ${xMotivo}`);
    this.name = 'SefazConsultaError';
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n) + '…';
}
