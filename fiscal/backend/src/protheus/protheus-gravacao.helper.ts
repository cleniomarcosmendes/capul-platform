import { Injectable, Logger } from '@nestjs/common';
import { ProtheusXmlService } from './protheus-xml.service.js';
import { XmlFiscalProtheusError } from './interfaces/xml-fiscal.interface.js';
import {
  type ProtheusGravacaoStatus,
  mapearCodigoProtheus,
} from './interfaces/protheus-status.interface.js';
import { XmlParserToSzrSzqService } from './xml-parser-to-szr-szq.service.js';

export interface TentativaGravacaoResult {
  gravacao: ProtheusGravacaoStatus;
  gravacaoMensagem: string | null;
  gravacaoErro: string | null;
  /** true quando o Protheus indicou que o XML já existia (corrida entre leitura e post). */
  raceCondition: boolean;
}

/**
 * Helper compartilhado para gravação de XML no Protheus (POST /grvXML — contrato
 * 18/04/2026). Centraliza:
 *
 * 1. Extração dos campos SZR/SZQ via `XmlParserToSzrSzqService.montarBody()`
 * 2. Chamada a `ProtheusXmlService.grvXml()`
 * 3. Tratamento de `XmlFiscalProtheusError` (erro tipado da API)
 * 4. Tratamento de erros inesperados (rede, parser, etc)
 * 5. Mensagens amigáveis via `mapearCodigoProtheus`
 *
 * Retorna sempre um `TentativaGravacaoResult` — **nunca lança exceção**, é best
 * effort por design (se Protheus cai, a consulta SEFAZ continua válida).
 *
 * Para pendências do contrato (CODFOR/LOJSIG, campos siga, USRREC, response
 * format), ver `docs/PENDENCIAS_PROTHEUS_18ABR2026.md` §3.1 a §3.8.
 */
@Injectable()
export class ProtheusGravacaoHelper {
  private readonly logger = new Logger(ProtheusGravacaoHelper.name);

  constructor(
    private readonly protheusXml: ProtheusXmlService,
    private readonly parser: XmlParserToSzrSzqService,
  ) {}

  async tentarGravar(params: {
    chave: string;
    tipoDocumento: 'NFE' | 'CTE';
    filial: string;
    xml: string;
    usuarioEmail: string;
  }): Promise<TentativaGravacaoResult> {
    const { chave, tipoDocumento, filial, xml, usuarioEmail } = params;
    const docLabel = tipoDocumento === 'CTE' ? 'CT-e' : 'NF-e';

    // Monta o body grvXML via parser (pendências 3.1/3.2/3.3 mantidas como
    // defaults enquanto equipe Protheus não confirma).
    let body;
    try {
      body = this.parser.montarBody(xml, {
        filial,
        usuarioRec: usuarioEmail,
      });
    } catch (err) {
      const errMsg = (err as Error).message;
      this.logger.warn(
        `Falha ao montar body grvXML para ${docLabel} ${chave.slice(0, 6)}…: ${errMsg}`,
      );
      return {
        gravacao: 'FALHA_TECNICA',
        gravacaoMensagem: `Não foi possível montar o payload para gravar o ${docLabel}: ${errMsg}`,
        gravacaoErro: errMsg,
        raceCondition: false,
      };
    }

    try {
      const resp = (await this.protheusXml.grvXml(body)) as
        | { status?: 'GRAVADO' | 'JA_EXISTIA' | 'JA_EXISTENTE' }
        | null
        | undefined;

      // O contrato da resposta (§3.8) ainda é parcial — tratamos dois casos
      // explícitos e qualquer outro status de sucesso como gravação OK.
      const status = resp?.status;
      if (status === 'JA_EXISTIA' || status === 'JA_EXISTENTE') {
        this.logger.log(
          `grvXML ${docLabel} ${chave.slice(0, 6)}… filial=${filial} status=JA_EXISTIA (race condition — outro processo já gravou).`,
        );
        return {
          gravacao: 'JA_EXISTIA',
          gravacaoMensagem:
            'XML já havia sido gravado por outro processo — sem ação necessária.',
          gravacaoErro: null,
          raceCondition: true,
        };
      }

      this.logger.log(
        `grvXML ${docLabel} ${chave.slice(0, 6)}… filial=${filial} status=GRAVADO (SZR010 + SZQ010).`,
      );
      return {
        gravacao: 'GRAVADO',
        gravacaoMensagem: 'XML gravado no Protheus (SZR010 + SZQ010).',
        gravacaoErro: null,
        raceCondition: false,
      };
    } catch (err) {
      if (err instanceof XmlFiscalProtheusError) {
        this.logger.warn(
          `grvXML ${docLabel} falhou (${err.code}): ${err.message} — consulta segue, ` +
            `mas XML não ficou persistido no Protheus.`,
        );
        return {
          gravacao: 'FALHA_TECNICA',
          gravacaoMensagem: `Não foi possível gravar o ${docLabel} em SZR010/SZQ010. ${mapearCodigoProtheus(err.code)}`,
          gravacaoErro: `${err.code}: ${err.message}`,
          raceCondition: false,
        };
      }

      const errMsg = (err as Error).message;
      this.logger.error(`Erro inesperado em grvXML ${docLabel}: ${errMsg}`);
      return {
        gravacao: 'FALHA_TECNICA',
        gravacaoMensagem:
          `Gravação do ${docLabel} no Protheus falhou por erro inesperado. ` +
          `A consulta à SEFAZ continua válida.`,
        gravacaoErro: errMsg,
        raceCondition: false,
      };
    }
  }
}
