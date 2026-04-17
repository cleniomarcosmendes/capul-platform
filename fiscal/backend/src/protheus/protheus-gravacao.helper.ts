import { Injectable, Logger } from '@nestjs/common';
import { ProtheusXmlService } from './protheus-xml.service.js';
import { XmlFiscalProtheusError } from './interfaces/xml-fiscal.interface.js';
import {
  type ProtheusGravacaoStatus,
  mapearCodigoProtheus,
} from './interfaces/protheus-status.interface.js';

export interface TentativaGravacaoResult {
  gravacao: ProtheusGravacaoStatus;
  gravacaoMensagem: string | null;
  gravacaoErro: string | null;
  /** true quando o Protheus indicou que o XML já existia (corrida entre exists e post). */
  raceCondition: boolean;
}

/**
 * Helper compartilhado para gravação de XML no Protheus (POST /xmlFiscal).
 *
 * Tanto `NfeService` quanto `CteService` tinham implementações **quase idênticas**
 * dessa tentativa — 60+ linhas duplicadas. Este helper centraliza:
 *
 * 1. Chamada a `ProtheusXmlService.post`
 * 2. Tratamento de `XmlFiscalProtheusError` (erro tipado da API)
 * 3. Tratamento de erros inesperados (rede, parser, etc)
 * 4. Mensagens amigáveis via `mapearCodigoProtheus`
 *
 * Retorna sempre um `TentativaGravacaoResult` — **nunca lança exceção**,
 * é best effort por design (se Protheus cai, a consulta SEFAZ continua válida).
 */
@Injectable()
export class ProtheusGravacaoHelper {
  private readonly logger = new Logger(ProtheusGravacaoHelper.name);

  constructor(private readonly protheusXml: ProtheusXmlService) {}

  async tentarGravar(params: {
    chave: string;
    tipoDocumento: 'NFE' | 'CTE';
    filial: string;
    xml: string;
    usuarioEmail: string;
  }): Promise<TentativaGravacaoResult> {
    const { chave, tipoDocumento, filial, xml, usuarioEmail } = params;
    const docLabel = tipoDocumento === 'CTE' ? 'CT-e' : 'NF-e';

    try {
      const postResp = await this.protheusXml.post({
        chave,
        tipoDocumento,
        filial,
        xml,
        usuarioCapulQueDisparou: usuarioEmail,
      });

      if (postResp.status === 'GRAVADO') {
        return {
          gravacao: 'GRAVADO',
          gravacaoMensagem: `XML gravado no Protheus (SZR010 + SZQ010).`,
          gravacaoErro: null,
          raceCondition: false,
        };
      }

      // Qualquer outro status de sucesso = race condition (outro processo gravou antes)
      return {
        gravacao: 'JA_EXISTIA',
        gravacaoMensagem:
          'XML já havia sido gravado por outro processo — sem ação necessária.',
        gravacaoErro: null,
        raceCondition: true,
      };
    } catch (err) {
      if (err instanceof XmlFiscalProtheusError) {
        this.logger.warn(
          `xmlFiscal.post ${docLabel} falhou (${err.code}): ${err.message} — consulta segue, ` +
            `mas XML não ficou persistido no Protheus.`,
        );
        return {
          gravacao: 'FALHA_TECNICA',
          gravacaoMensagem: `Não foi possível gravar o ${docLabel} em SZR010/SZQ010. ${mapearCodigoProtheus(err.code)}`,
          gravacaoErro: `${err.code}: ${err.message}`,
          raceCondition: false,
        };
      }

      // Erro inesperado (rede, parser, etc)
      const errMsg = (err as Error).message;
      this.logger.error(`Erro inesperado em xmlFiscal.post ${docLabel}: ${errMsg}`);
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
