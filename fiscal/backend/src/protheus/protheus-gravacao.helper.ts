import { Injectable, Logger } from '@nestjs/common';
import { ProtheusXmlService } from './protheus-xml.service.js';
import { IntegracaoApiResolver } from './integracao-api.resolver.js';
import { XmlFiscalProtheusError } from './interfaces/xml-fiscal.interface.js';
import {
  type ProtheusGravacaoStatus,
  mapearCodigoProtheus,
} from './interfaces/protheus-status.interface.js';
import type {
  GrvXmlBody,
  GrvXmlResponse,
} from './interfaces/grv-xml.interface.js';

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
 * SIMPLIFICADO 08/05/2026). Centraliza:
 *
 * 1. Montagem do body no formato novo: `{ itens: [{ xmlBase64 }] }`
 *    (Protheus extrai todos os campos do XML — fim do array `campos`)
 * 2. Chamada a `ProtheusXmlService.grvXml()`
 * 3. Parse do response batch: `{ totalSucesso, resultados: [{ sucesso,
 *    xmlGravado, preNotaFalhou, mensagem, ... }] }`
 * 4. Mapeamento pra ProtheusGravacaoStatus (incluindo GRAVADO_PRENOTA_FALHOU
 *    quando XML grava mas pre-nota falha)
 * 5. Pos-verify via xmlNfe (defesa contra perda silenciosa — bug §3.10)
 *
 * Retorna sempre um `TentativaGravacaoResult` — **nunca lança exceção**, é best
 * effort por design (se Protheus cai, a consulta SEFAZ continua válida).
 *
 * Migration 08/05/2026: pendencias §3.1, §3.2, §3.3, §3.10 obsoletas
 * (Protheus passou a extrair tudo do XML — sem CODFOR/LOJSIG/USRREC enviados
 * no payload).
 */
@Injectable()
export class ProtheusGravacaoHelper {
  private readonly logger = new Logger(ProtheusGravacaoHelper.name);

  constructor(
    private readonly protheusXml: ProtheusXmlService,
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

    // Body grvXML SIMPLIFICADO (08/05/2026): Protheus extrai todos os campos
    // (chave, emitente, itens, etc.) diretamente do XML. Nao precisa mais
    // enviar `campos[]` (FILIAL, ECNPJ, CODFOR, LOJSIG, etc.).
    //
    // Variaveis filial/usuarioEmail mantidas no metodo pra logs/auditoria mas
    // nao vao mais no body (Protheus tira do XML + extrai usuario do header
    // de auth).
    void filial;
    void usuarioEmail;

    const xmlBase64 = Buffer.from(xml, 'utf-8').toString('base64');
    const body: GrvXmlBody = {
      itens: [{ xmlBase64 }],
    };

    // Body serializado pra persistência (visível pelo setor fiscal no modal
    // de detalhe) — armazenamos sem o xmlBase64 expandido (~30KB) pra evitar
    // ofuscar o conteudo util. Replace truncamos exibindo só os primeiros
    // chars + tamanho.
    const requestBody = JSON.stringify(
      { itens: [{ xmlBase64: `${xmlBase64.slice(0, 80)}…(${xmlBase64.length}b)` }] },
      null,
      2,
    );

    this.logger.log(
      `grvXML ${docLabel} ${chave} body=1 item, xmlBase64=${xmlBase64.length}b`,
    );

    try {
      const resp = (await this.protheusXml.grvXml(body)) as GrvXmlResponse | null;

      // Defesa: se response inesperado (null, sem resultados, etc), trata
      // como falha tecnica pra retry posterior.
      if (!resp || !Array.isArray(resp.resultados) || resp.resultados.length === 0) {
        this.logger.warn(
          `grvXML ${docLabel} ${chave.slice(0, 6)}… resposta vazia/inesperada do Protheus: ${JSON.stringify(resp)?.slice(0, 200)}`,
        );
        return {
          gravacao: 'FALHA_TECNICA',
          gravacaoMensagem:
            'Protheus respondeu em formato inesperado. Verifique com o time Protheus.',
          gravacaoErro: 'RESPONSE_FORMAT_INVALID',
          raceCondition: false,
          requestBody,
        };
      }

      const r0 = resp.resultados[0];

      // Caso 1: gravacao falhou completamente
      if (!r0.sucesso || !r0.xmlGravado) {
        this.logger.warn(
          `grvXML ${docLabel} ${chave.slice(0, 6)}… falhou: sucesso=${r0.sucesso} xmlGravado=${r0.xmlGravado} mensagem="${r0.mensagem}"`,
        );
        return {
          gravacao: 'FALHA_TECNICA',
          gravacaoMensagem:
            r0.mensagem ||
            `Protheus rejeitou a gravacao do ${docLabel} sem mensagem detalhada.`,
          gravacaoErro: r0.mensagem || 'GRAVACAO_REJEITADA',
          raceCondition: false,
          requestBody,
        };
      }

      // Caso 2: XML gravado mas pre-nota falhou — sucesso parcial (08/05/2026)
      // XML em SZR010/SZQ010 (XMLCAB/XMLIT) confirmado pelo Protheus, mas
      // a geracao da pre-nota (U_PRENF/U_NFeSaida) falhou. Exige conclusao
      // manual no Protheus. Retry nao ajuda — root cause e validacao no
      // ERP que o XML por si so nao resolve.
      if (r0.preNotaFalhou) {
        this.logger.warn(
          `grvXML ${docLabel} ${chave.slice(0, 6)}… XML gravado mas pre-nota falhou: ${r0.mensagem}`,
        );
        const mensagem =
          r0.mensagem ||
          'XML gravado em SZR010/SZQ010, mas a geracao da pre-nota falhou. Conclua via UI no Protheus.';
        return {
          gravacao: 'GRAVADO_PRENOTA_FALHOU',
          gravacaoMensagem: mensagem,
          // Persistimos a mensagem em gravacaoErro pra ela aparecer no modal
          // (campo protheus_erro) — operador precisa saber instrucao do Protheus.
          gravacaoErro: mensagem,
          raceCondition: false,
          requestBody,
        };
      }

      // Caso 3: gravacao plena (XML + pre-nota OK).
      // Pos-verify via xmlNfe — defesa do Pedido D (07/05/2026): Protheus
      // ja retornou GRAVADO em 15% dos casos sem persistir silenciosamente.
      // Apesar do response novo ser mais informativo, mantemos verificacao
      // por seguranca.
      const SLEEP_PRE_VERIFY_MS = 500;
      await new Promise((r) => setTimeout(r, SLEEP_PRE_VERIFY_MS));
      try {
        const verif = await this.protheusXml.buscarXml(chave);
        if (!verif.found || verif.origem !== 'SZR010') {
          this.logger.warn(
            `grvXML ${docLabel} ${chave.slice(0, 6)}… ` +
              `Protheus retornou sucesso mas xmlNfe pos-verificacao nao encontrou em SZR010 ` +
              `(found=${verif.found}, origem=${verif.found ? verif.origem : 'n/a'}). ` +
              `Marcando FALHA_TECNICA pra retry.`,
          );
          return {
            gravacao: 'FALHA_TECNICA',
            gravacaoMensagem:
              'Protheus disse sucesso mas xmlNfe pos-verificacao nao confirmou em SZR010. ' +
              'Possivel perda silenciosa. Sera feito retry no proximo ciclo.',
            gravacaoErro: 'POS_VERIFICACAO_FALHOU',
            raceCondition: false,
            requestBody,
          };
        }
      } catch (err) {
        this.logger.warn(
          `grvXML ${docLabel} ${chave.slice(0, 6)}… pos-verificacao xmlNfe falhou (${(err as Error).message}) — assumindo GRAVADO.`,
        );
      }

      this.logger.log(
        `grvXML ${docLabel} ${chave.slice(0, 6)}… status=GRAVADO (SZR010 + SZQ010 + pre-nota OK, pos-verificado).`,
      );
      return {
        gravacao: 'GRAVADO',
        gravacaoMensagem: r0.mensagem || 'XML gravado no Protheus (SZR010 + SZQ010).',
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
