import { Injectable, Logger } from '@nestjs/common';
import { ProtheusXmlService } from './protheus-xml.service.js';
import { IntegracaoApiResolver } from './integracao-api.resolver.js';
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
  /**
   * Body JSON serializado que foi enviado ao POST /grvXML. Persistido
   * em `documento_consulta.protheus_grv_request` ou
   * `cte_documento.protheus_grv_request` pelo caller — pra setor fiscal
   * autoatender debug sem depender de logs do container. NULL quando
   * a montagem do body falhou antes da chamada (gravacao=FALHA_TECNICA
   * com `gravacaoErro` indicando erro de parser).
   */
  requestBody: string | null;
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
    private readonly integracaoResolver: IntegracaoApiResolver,
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

    // Gating ambiente cruzado (07/05/2026): se XML HOM e Protheus PROD (ou
    // vice-versa), PULA gravacao por defesa. Caso real do tick 12:00 BRT 07/05:
    // doc id=6 (XML tpAmb=2 HOM) acabou em Protheus PROD por mistura de
    // configuracoes em transicao. Sem gating, XMLs de homologacao gravam
    // em SZR010 de PROD, confundindo setor fiscal.
    //
    // Extrai tpAmb direto do XML — primeira ocorrencia (todos os schemas
    // SEFAZ tem o campo no <ide> ou inicio do envelope). Regex e suficiente
    // pra evitar parse XML completo (que e caro).
    const tpAmbMatch = xml.match(/<tpAmb>(\d)<\/tpAmb>/);
    const ambienteDocumento = tpAmbMatch ? parseInt(tpAmbMatch[1], 10) : null;
    if (ambienteDocumento === 1 || ambienteDocumento === 2) {
      try {
        const integracao = await this.integracaoResolver.resolve('grvXML');
        if (integracao) {
          const ambienteIntegracaoNum = integracao.ambiente === 'PRODUCAO' ? 1 : 2;
          if (ambienteDocumento !== ambienteIntegracaoNum) {
            this.logger.warn(
              `grvXML ${docLabel} ${chave.slice(0, 6)}… filial=${filial} SKIP — ` +
                `ambiente XML=${ambienteDocumento === 1 ? 'PROD' : 'HOM'} difere de ` +
                `integracao Protheus=${integracao.ambiente}. Gravacao pulada por defesa.`,
            );
            return {
              gravacao: 'NAO_APLICAVEL',
              gravacaoMensagem:
                `Gravacao pulada — XML em ${ambienteDocumento === 1 ? 'PRODUCAO' : 'HOMOLOGACAO'} ` +
                `e integracao Protheus em ${integracao.ambiente}. Ambientes precisam coincidir pra gravar.`,
              gravacaoErro: null,
              raceCondition: false,
              requestBody: null,
            };
          }
        }
      } catch (err) {
        // Falha do resolver nao bloqueia — segue gravacao (comportamento legado)
        this.logger.warn(
          `grvXML ${docLabel} ${chave.slice(0, 6)}… gating ambiente falhou: ${(err as Error).message} — seguindo gravacao padrao.`,
        );
      }
    }

    // Pré-check (07/05/2026): Protheus grvXML SOBRESCREVE silenciosamente
    // quando a chave já existe em SZR010 — não retorna JA_EXISTIA conforme
    // contrato §3.8 esperado. Validado em teste local: 2 chamadas idênticas
    // retornaram GRAVADO + GRAVADO em vez de GRAVADO + JA_EXISTIA.
    //
    // Risco real: setor fiscal grava manualmente em SZR010 com USRREC=fulano;
    // depois nosso enriquecimento sobrescreve com USRREC=sistema:cte-enriq,
    // perdendo auditoria de quem importou primeiro.
    //
    // Defesa: ANTES de chamar grvXML, GET xmlNfe pela chave. Se SZR010 já
    // tem o XML, marca JA_EXISTIA sem gravar. Se está em SPED156 ou 404,
    // segue pro grvXML normal. Erros de rede/auth no pré-check não bloqueiam:
    // segue grvXML padrão (pior caso = sobrescreve, mesmo cenário sem o
    // pré-check, sem regressão).
    //
    // Pendência paralela (Pedido A): equipe Protheus padronizar grvXML
    // pra retornar JA_EXISTIA quando a chave já existe. Quando isso for
    // resolvido, este pré-check vira redundante mas não causa dano (custo
    // de 1 GET extra é desprezível diante da segurança operacional).
    try {
      const existente = await this.protheusXml.buscarXml(chave);
      if (existente.found && existente.origem === 'SZR010') {
        this.logger.log(
          `grvXML ${docLabel} ${chave.slice(0, 6)}… filial=${filial} SKIP — pré-check xmlNfe encontrou em SZR010 (origem=${existente.origem}). Marcando JA_EXISTIA pra preservar auditoria de gravação manual.`,
        );
        return {
          gravacao: 'JA_EXISTIA',
          gravacaoMensagem:
            `XML já existe em SZR010 do Protheus (verificado via xmlNfe pré-check). ` +
            `Não regravado pra preservar auditoria de quem importou primeiro.`,
          gravacaoErro: null,
          raceCondition: false,
          requestBody: null,
        };
      }
      // found=true && origem=SPED156 → SZR010 vazia, precisa popular: segue
      // found=false → 404, não existe em lugar nenhum: segue
    } catch (err) {
      // Erro no pré-check (rede, auth, timeout) — não bloqueia, segue grvXML
      // (pior caso fica igual ao comportamento antes do pré-check).
      this.logger.warn(
        `grvXML ${docLabel} ${chave.slice(0, 6)}… pré-check xmlNfe falhou (${(err as Error).message}) — seguindo pro grvXML padrão.`,
      );
    }

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
        requestBody: null,
      };
    }

    // Body serializado pra persistência (visível pelo setor fiscal no modal
    // de detalhe) e pra log estruturado.
    const requestBody = JSON.stringify(body, null, 2);

    // Log do body completo antes do POST — necessário pra debug com a equipe
    // Protheus quando uma chave específica falha (request real enviado).
    // Pode ser silenciado em prod via LOG_LEVEL=warn (logger nestjs-pino respeita).
    this.logger.log(
      `grvXML ${docLabel} ${chave} filial=${filial} request: ${JSON.stringify(body)}`,
    );

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
          requestBody,
        };
      }

      // Validação pós-gravação (Pedido D — 07/05/2026): Protheus retorna
      // GRAVADO mas em ~15% dos casos NAO PERSISTE silenciosamente em SZR010.
      // Detectado em 07/05 com 102/693 desaparecidos (proporcional, sem
      // padrao temporal — bug intermitente do Protheus). Defesa: apos cada
      // GRAVADO, fazer 1 GET xmlNfe pra confirmar que o registro persistiu.
      // Se nao confirmar, retorna FALHA_TECNICA pra que retry da camada
      // superior tente de novo (limite MAX_TENTATIVAS_PROTHEUS=5).
      //
      // Custo: +1 GET xmlNfe por GRAVADO (JA_EXISTIA continua sem custo
      // adicional pois passou pelo pre-check). Aceitavel diante da
      // confiabilidade ganha (15% perda silenciosa → 0%).
      //
      // Pendencia paralela: Pedido C documentado em §3.10 — equipe Protheus
      // investigar perda silenciosa em grvXML (causa raiz desconhecida).
      const SLEEP_PRE_VERIFY_MS = 500;
      await new Promise((r) => setTimeout(r, SLEEP_PRE_VERIFY_MS));
      try {
        const verif = await this.protheusXml.buscarXml(chave);
        if (!verif.found || verif.origem !== 'SZR010') {
          this.logger.warn(
            `grvXML ${docLabel} ${chave.slice(0, 6)}… filial=${filial} ` +
              `Protheus retornou GRAVADO mas xmlNfe pos-verificacao nao encontrou em SZR010 ` +
              `(found=${verif.found}, origem=${verif.found ? verif.origem : 'n/a'}). ` +
              `Marcando FALHA_TECNICA pra retry.`,
          );
          return {
            gravacao: 'FALHA_TECNICA',
            gravacaoMensagem:
              `Protheus disse GRAVADO mas xmlNfe pos-verificacao nao confirmou em SZR010. ` +
              `Possivel bug intermitente Protheus (perda silenciosa — Pedido C). Sera ` +
              `feito retry no proximo ciclo.`,
            gravacaoErro: 'POS_VERIFICACAO_FALHOU',
            raceCondition: false,
            requestBody,
          };
        }
      } catch (err) {
        // Erro na verificacao nao bloqueia — assume gravacao OK e segue.
        // Se a perda de fato ocorreu, sera detectada na proxima passagem
        // (cron de enriquecimento ou consulta manual).
        this.logger.warn(
          `grvXML ${docLabel} ${chave.slice(0, 6)}… pos-verificacao xmlNfe falhou (${(err as Error).message}) — assumindo GRAVADO.`,
        );
      }

      this.logger.log(
        `grvXML ${docLabel} ${chave.slice(0, 6)}… filial=${filial} status=GRAVADO (SZR010 + SZQ010, pos-verificado).`,
      );
      return {
        gravacao: 'GRAVADO',
        gravacaoMensagem: 'XML gravado no Protheus (SZR010 + SZQ010).',
        gravacaoErro: null,
        raceCondition: false,
        requestBody,
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
          requestBody,
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
        requestBody,
      };
    }
  }
}
