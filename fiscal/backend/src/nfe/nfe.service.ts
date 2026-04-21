import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ProtheusXmlService } from '../protheus/protheus-xml.service.js';
import { ProtheusGravacaoHelper } from '../protheus/protheus-gravacao.helper.js';
import { ProtheusEventosService } from '../protheus/protheus-eventos.service.js';
import type { EventoNfeRaw } from '../protheus/interfaces/eventos-nfe.interface.js';
import type { XmlNfeResult } from '../protheus/interfaces/xml-nfe.interface.js';
import { NfeDistribuicaoClient, SefazConsultaError } from '../sefaz/nfe-distribuicao.client.js';
import {
  NfeConsultaProtocoloClient,
  NfeConsultaProtocoloError,
} from '../sefaz/nfe-consulta-protocolo.client.js';
import { AmbienteService } from '../ambiente/ambiente.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NfeParserService } from './parsers/nfe-parser.service.js';
import { DocumentoConsultaService } from './documento-consulta.service.js';
import {
  DocumentoEventoService,
  TIPO_EVENTO_AUTORIZACAO,
  TIPO_EVENTO_LABEL,
  type EventoInput,
} from './documento-evento.service.js';
import type {
  NfeParsed,
  NfeEventoInfo,
} from './parsers/nfe-parsed.interface.js';
import type { FiscalAuthenticatedUser } from '../common/interfaces/jwt-payload.interface.js';
import type { OrigemConsulta } from '@prisma/client';

import {
  type ProtheusStatus,
  type ProtheusLeituraStatus,
  type ProtheusGravacaoStatus,
  construirAlertaLegado,
} from '../protheus/interfaces/protheus-status.interface.js';
import { ufFromChave, assertChaveFormato } from '../common/helpers/chave.helper.js';

export interface NfeConsultaResult {
  chave: string;
  filial: string;
  origem: OrigemConsulta;
  documentoConsultaId: string;
  parsed: NfeParsed;
  xml: string;
  protheusStatus: ProtheusStatus;
  /** @deprecated usar `protheusStatus` — mantido para compatibilidade com frontend antigo */
  alertaProtheus?: string;
}

/**
 * Fluxo completo da Etapa 5 (parser) + Etapa 4 (SefazClient) + Etapa 7 (persistência).
 *
 * consultarPorChave():
 *   1. Valida chave (44 dígitos, DV).
 *   2. Consulta Protheus: se existe, baixa SZR010 e marca origem=PROTHEUS_CACHE.
 *   3. Senão, baixa do SEFAZ via NFeDistribuicaoDFe e grava em SZR010/SZQ010
 *      via ProtheusXmlService.post (alimenta monitor NF-e). Marca origem=SEFAZ_DOWNLOAD.
 *   4. Parseia o XML em abas estruturadas.
 *   5. Upsert em fiscal.documento_consulta com metadados.
 *   6. Retorna { origem, parsed, xml } para o controller/frontend.
 *
 * atualizarStatusSefaz():
 *   - Chama NfeConsultaProtocolo, atualiza consultaSefazAtualizadaEm no banco
 *     e retorna o status + eventos posteriores (cancelamento, CC-e, etc.).
 */
@Injectable()
export class NfeService {
  private readonly logger = new Logger(NfeService.name);

  /**
   * Cooldown por chave+filial (em ms) para o botão "Atualizar status no SEFAZ".
   * Cada clique dispara 2 chamadas SEFAZ (NfeConsultaProtocolo + distDFe
   * consChNFe); este cooldown protege o CNPJ consulente contra consumo
   * indevido (cStat=656) e garante que um usuário impaciente apertando o
   * botão não cause bloqueio.
   */
  private static readonly ATUALIZACAO_COOLDOWN_MS = 30_000;
  private static readonly ultimaAtualizacao = new Map<string, number>();

  constructor(
    private readonly protheusXml: ProtheusXmlService,
    private readonly protheusEventos: ProtheusEventosService,
    private readonly gravacaoHelper: ProtheusGravacaoHelper,
    private readonly sefazDistribuicao: NfeDistribuicaoClient,
    private readonly sefazConsulta: NfeConsultaProtocoloClient,
    private readonly parser: NfeParserService,
    private readonly documentoConsulta: DocumentoConsultaService,
    private readonly documentoEvento: DocumentoEventoService,
    private readonly ambiente: AmbienteService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Timeline consolidada de eventos de uma NF-e a partir do Protheus
   * (SPED150/SPED156/SZR010/SF1010), aplicando a regra interna de separar
   * SF1010 em bloco "alertas" (fora da timeline estrita SPED + SZR).
   *
   * Ver memory `feedback_fiscal_timeline_so_sped` e
   * `docs/PENDENCIAS_PROTHEUS_18ABR2026.md` §4.4.
   */
  async timeline(chave: string): Promise<{
    chave: string;
    quantidade: number;
    timeline: EventoNfeRaw[];
    alertasEntrada: EventoNfeRaw[];
  }> {
    assertChaveFormato(chave);
    try {
      const resp = await this.protheusEventos.listar(chave);
      const timeline: EventoNfeRaw[] = [];
      const alertasEntrada: EventoNfeRaw[] = [];
      for (const ev of resp.eventos) {
        if (ev.origem === 'SF1010') alertasEntrada.push(ev);
        else timeline.push(ev);
      }
      return { chave: resp.chave, quantidade: resp.quantidade, timeline, alertasEntrada };
    } catch (err) {
      // Protheus pode não ter publicado /eventosNfe ainda — erros comuns:
      //   - "Unexpected token '<'" (retornou HTML 404 em vez de JSON)
      //   - "other side closed" / "SocketError" (servidor dropou a conexão)
      //   - timeouts de rede
      // Traduz qualquer um deles para 503 com mensagem clara ao operador.
      const msg = (err as Error).message ?? '';
      const name = (err as Error).name ?? '';
      const apiIndisponivel =
        msg.includes("'<'") ||
        msg.includes('not valid JSON') ||
        msg.includes('other side closed') ||
        msg.includes('Connect Timeout') ||
        name === 'SocketError' ||
        name === 'ConnectTimeoutError';
      if (apiIndisponivel) {
        this.logger.warn(`/eventosNfe Protheus indisponível (${name}: ${msg.slice(0, 120)})`);
        throw new ServiceUnavailableException({
          erro: 'EVENTOSNFE_NAO_DISPONIVEL',
          mensagem:
            'Endpoint /eventosNfe do Protheus ainda não está publicado em homologação. Aguarde liberação pela equipe Protheus.',
        });
      }
      throw err;
    }
  }

  async consultarPorChave(
    chave: string,
    filial: string,
    user: FiscalAuthenticatedUser,
  ): Promise<NfeConsultaResult> {
    this.validateChave(chave);
    this.validateFilial(filial);

    let xmlString: string;
    let origem: OrigemConsulta;

    // Estado granular da integracao Protheus — preenchido ao longo do fluxo
    // e retornado ao frontend para dar transparencia total ao usuario.
    let leitura: ProtheusLeituraStatus = 'NAO_CONSULTADO';
    let leituraMensagem: string | null = null;
    let leituraErro: string | null = null;
    let gravacao: ProtheusGravacaoStatus = 'NAO_TENTADO';
    let gravacaoMensagem: string | null = null;
    let gravacaoErro: string | null = null;

    // ---------- passo 1: GET /xmlNfe (busca SZR010 → fallback SPED156) ----------
    let xmlNfeResp: XmlNfeResult | null = null;
    try {
      xmlNfeResp = await this.protheusXml.buscarXml(chave);
      if (xmlNfeResp.found) {
        leitura = 'CACHE_HIT';
        leituraMensagem =
          xmlNfeResp.origem === 'SZR010'
            ? 'XML encontrado no cache do Protheus (SZR010).'
            : 'XML encontrado no Protheus (SPED156) — gravando em SZR/SZQ.';
      } else {
        leitura = 'CACHE_MISS';
        leituraMensagem = 'XML não encontrado no Protheus — baixando da SEFAZ.';
      }
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.warn(
        `xmlNfe falhou para chave ${chave.slice(0, 6)}…: ${msg} — seguindo para SEFAZ.`,
      );
      leitura = 'FALHA_TECNICA';
      leituraMensagem =
        'Não foi possível consultar o XML no Protheus. Buscando direto na SEFAZ.';
      leituraErro = msg;
    }

    if (xmlNfeResp?.found) {
      this.logger.log(
        `xmlNfe HIT origem=${xmlNfeResp.origem} — chave ${chave.slice(0, 6)}… filial=${filial}`,
      );
      xmlString = Buffer.from(xmlNfeResp.xmlBase64, 'base64').toString('utf8');
      origem = 'PROTHEUS_CACHE';

      if (xmlNfeResp.origem === 'SZR010') {
        // Já estava em SZR/SZQ — gravação não é necessária
        gravacao = 'NAO_APLICAVEL';
        gravacaoMensagem = 'XML já estava em SZR/SZQ — gravação não é necessária.';
      } else {
        // Veio de SPED156 — Protheus NÃO auto-grava SZR/SZQ. A plataforma
        // faz o /grvXML para popular o cache (best effort).
        const result = await this.gravacaoHelper.tentarGravar({
          chave,
          tipoDocumento: 'NFE',
          filial,
          xml: xmlString,
          usuarioEmail: user.email,
        });
        gravacao = result.gravacao;
        gravacaoMensagem = result.gravacaoMensagem;
        gravacaoErro = result.gravacaoErro;
        if (result.raceCondition) origem = 'PROTHEUS_CACHE_RACE';
      }
    } else {
      // 404 (cache miss) ou falha técnica — fallback SEFAZ + grvXML
      this.logger.log(
        `xmlNfe MISS — baixando do SEFAZ — chave ${chave.slice(0, 6)}… filial=${filial}`,
      );
      xmlString = await this.baixarDoSefaz(chave, filial);
      origem = 'SEFAZ_DOWNLOAD';

      const result = await this.gravacaoHelper.tentarGravar({
        chave,
        tipoDocumento: 'NFE',
        filial,
        xml: xmlString,
        usuarioEmail: user.email,
      });
      gravacao = result.gravacao;
      gravacaoMensagem = result.gravacaoMensagem;
      gravacaoErro = result.gravacaoErro;
      if (result.raceCondition) origem = 'PROTHEUS_CACHE_RACE';
    }

    const protheusStatus: ProtheusStatus = {
      leitura,
      leituraMensagem,
      leituraErro,
      gravacao,
      gravacaoMensagem,
      gravacaoErro,
      permiteReexecucao: gravacao === 'FALHA_TECNICA' || leitura === 'FALHA_TECNICA',
      modoMock: this.protheusXml.isMockAtivo(),
    };

    // Back-compat: monta uma mensagem consolidada (legado)
    const alertaProtheus = construirAlertaLegado(protheusStatus);

    // --- passo 2: parser ---
    const parsed = this.parser.parse(xmlString);

    // --- passo 3: upsert em fiscal.documento_consulta ---
    const ambienteCfg = await this.ambiente.getOrCreate();
    const doc = await this.documentoConsulta.registrar({
      chave,
      tipoDocumento: 'NFE',
      filial,
      usuarioId: user.id,
      usuarioEmail: user.email,
      origem,
      ambienteSefaz: ambienteCfg.ambienteAtivo,
      protocoloAutorizacao: parsed.protocoloAutorizacao?.protocolo ?? null,
      dataAutorizacao: parsed.protocoloAutorizacao?.dataRecebimento
        ? new Date(parsed.protocoloAutorizacao.dataRecebimento)
        : null,
      cnpjEmitente: parsed.emitente.cnpj ?? null,
      cnpjDestinatario: parsed.destinatario.cnpj ?? null,
      numeroNF: parsed.dadosGerais.numero || null,
      serie: parsed.dadosGerais.serie || null,
      valorTotal: parsed.totais.valorNota,
      statusAtual: parsed.protocoloAutorizacao?.motivo ?? null,
    });

    // --- passo 4: garantir evento de AUTORIZACAO persistido (idempotente) + carregar timeline ---
    // Não chama SEFAZ aqui — apenas lê o que já existe. Novos eventos só são
    // obtidos quando o usuário aciona "Atualizar status no SEFAZ" (lazy).
    if (parsed.protocoloAutorizacao?.protocolo && parsed.protocoloAutorizacao.dataRecebimento) {
      await this.documentoEvento.upsertMany(doc.id, [
        {
          tipoEvento: TIPO_EVENTO_AUTORIZACAO,
          descricao: parsed.protocoloAutorizacao.motivo || 'Autorizado o uso da NF-e',
          dataEvento: new Date(parsed.protocoloAutorizacao.dataRecebimento),
          protocoloEvento: parsed.protocoloAutorizacao.protocolo,
          cStat: parsed.protocoloAutorizacao.cStat,
          xMotivo: parsed.protocoloAutorizacao.motivo,
        },
      ]);
    }
    parsed.eventos = await this.carregarEventosDoBanco(doc.id);

    return {
      chave,
      filial,
      origem,
      documentoConsultaId: doc.id,
      parsed,
      xml: xmlString,
      protheusStatus,
      alertaProtheus,
    };
  }

  /**
   * Retorna o detalhe completo de um evento — parseia o xmlEvento armazenado
   * em fiscal.documento_evento. Usado pelo modal de detalhe do frontend
   * (imagem 2 do portal SEFAZ). Sem chamadas SEFAZ.
   */
  async obterEventoDetalhe(chave: string, filial: string, eventoId: string) {
    this.validateChave(chave);
    const doc = await this.documentoConsulta.findByChave(chave, filial);
    if (!doc) {
      throw new NotFoundException(
        `Documento ${chave} filial ${filial} não encontrado.`,
      );
    }
    const evento = await this.documentoEvento.findById(eventoId);
    if (!evento || evento.documentoId !== doc.id) {
      throw new NotFoundException(`Evento ${eventoId} não encontrado para esta NF-e.`);
    }
    if (!evento.xmlEvento) {
      // Autorização (AUTORIZACAO) não tem procEventoNFe salvo — devolvemos o
      // que temos direto do registro para manter o modal funcional.
      return {
        id: evento.id,
        tipoEvento: evento.tipoEvento,
        descricao: evento.descricao,
        dataEvento: evento.dataEvento.toISOString(),
        protocolo: evento.protocoloEvento,
        cStat: evento.cStat,
        xMotivo: evento.xMotivo,
        detalhe: null,
      };
    }
    const detalhe = this.parser.parseEventoXml(evento.xmlEvento);
    return {
      id: evento.id,
      tipoEvento: evento.tipoEvento,
      descricao: evento.descricao,
      dataEvento: evento.dataEvento.toISOString(),
      protocolo: evento.protocoloEvento,
      cStat: evento.cStat,
      xMotivo: evento.xMotivo,
      detalhe,
    };
  }

  /**
   * Lê a timeline persistida em fiscal.documento_evento para o documento
   * e converte para o shape NfeEventoInfo do parsed. Ordena por dataEvento.
   */
  private async carregarEventosDoBanco(documentoId: string): Promise<NfeEventoInfo[]> {
    const persistidos = await this.documentoEvento.listarPorDocumento(documentoId);
    return persistidos.map((e) => ({
      id: e.id,
      tipoEvento: e.tipoEvento,
      descricao:
        e.descricao || TIPO_EVENTO_LABEL[e.tipoEvento] || `Evento ${e.tipoEvento}`,
      dataEvento: e.dataEvento.toISOString(),
      protocolo: e.protocoloEvento ?? null,
      cStat: e.cStat ?? null,
      xMotivo: e.xMotivo ?? null,
      possuiDetalhe: Boolean(e.xmlEvento),
    }));
  }

  /**
   * Regrava um XML ja persistido no Protheus. Usado pelo botao
   * "Tentar gravar novamente" no frontend quando a gravacao inicial falhou.
   * Re-executa somente a etapa de gravacao — nao consulta SEFAZ de novo.
   *
   * Estrategia: re-executa o fluxo completo `consultarPorChave`. O cache check
   * vai identificar se o XML foi gravado entretanto por outra sessao;
   * se nao, o fluxo cai na SEFAZ e tenta gravar de novo.
   *
   * TODO: quando persistirmos o XML em fiscal.documento_consulta, trocar
   * este re-execucao por uma simples re-tentativa do POST /xmlFiscal
   * direto, sem gastar uma chamada SEFAZ adicional.
   */
  async regravarNoProtheus(
    chave: string,
    filial: string,
    user: FiscalAuthenticatedUser,
  ): Promise<ProtheusStatus> {
    this.validateChave(chave);
    this.validateFilial(filial);
    const resultado = await this.consultarPorChave(chave, filial, user);
    return resultado.protheusStatus;
  }

  /**
   * Atualiza o status da NF-e chamando NfeConsultaProtocolo.
   * Usado pelo botão "Atualizar status no SEFAZ" — não baixa XML de novo,
   * só verifica autorização/cancelamento/CC-e via web service per UF.
   */
  async atualizarStatus(chave: string, filial: string, _user: FiscalAuthenticatedUser) {
    this.validateChave(chave);
    const doc = await this.documentoConsulta.findByChave(chave, filial);
    if (!doc) {
      throw new NotFoundException(
        `Documento ${chave} filial ${filial} não encontrado. Faça a consulta primeiro.`,
      );
    }

    // ---------- Proteção anti-abuso / anti-bloqueio SEFAZ ----------
    // Cooldown por (chave, filial): mínimo de ATUALIZACAO_COOLDOWN_MS entre
    // duas chamadas "Atualizar status" na mesma chave. Se o usuário insistir
    // dentro da janela, devolvemos o estado do banco sem tocar SEFAZ e
    // avisamos quanto tempo falta. Protege o CNPJ da CAPUL contra
    // consumo indevido (cStat=656).
    const cooldownKey = `${chave}:${filial}`;
    const agora = Date.now();
    const ultima = NfeService.ultimaAtualizacao.get(cooldownKey) ?? 0;
    const restanteMs = ultima + NfeService.ATUALIZACAO_COOLDOWN_MS - agora;
    if (restanteMs > 0) {
      const eventosTimeline = await this.carregarEventosDoBanco(doc.id);
      throw new BadRequestException({
        erro: 'ATUALIZACAO_EM_COOLDOWN',
        mensagem: `Aguarde ${Math.ceil(restanteMs / 1000)}s antes de atualizar esta NF-e novamente — proteção contra consumo indevido do SEFAZ.`,
        cooldownSegundos: Math.ceil(restanteMs / 1000),
        eventos: eventosTimeline,
      });
    }
    NfeService.ultimaAtualizacao.set(cooldownKey, agora);

    const ambienteCfg = await this.ambiente.getOrCreate();
    const ambienteStr = ambienteCfg.ambienteAtivo === 'PRODUCAO' ? 'PRODUCAO' : 'HOMOLOGACAO';

    try {
      const statusResp = await this.sefazConsulta.consultar(chave, ambienteStr);
      const statusTxt = `${statusResp.cStat} — ${statusResp.xMotivo}`;

      await this.documentoConsulta.marcarStatusSefazAtualizado(doc.id, statusTxt);

      // Persiste o protocolo de autorização atualizado (caso o XML local não tivesse)
      // e cada procEventoNFe retornado, guardando o XML completo para detalhe posterior.
      const eventosParaPersistir: EventoInput[] = [];
      if (statusResp.protocolo && statusResp.dataRecebimento) {
        eventosParaPersistir.push({
          tipoEvento: TIPO_EVENTO_AUTORIZACAO,
          descricao: statusResp.xMotivo,
          dataEvento: new Date(statusResp.dataRecebimento),
          protocoloEvento: statusResp.protocolo,
          cStat: statusResp.cStat,
          xMotivo: statusResp.xMotivo,
        });
      }
      for (const evt of statusResp.eventos) {
        if (!evt.dataEvento) continue;
        eventosParaPersistir.push({
          tipoEvento: evt.tipoEvento || 'DESCONHECIDO',
          descricao:
            evt.descricao ||
            TIPO_EVENTO_LABEL[evt.tipoEvento] ||
            `Evento ${evt.tipoEvento}`,
          dataEvento: new Date(evt.dataEvento),
          protocoloEvento: evt.protocolo,
          cStat: evt.cStat,
          xMotivo: evt.xMotivo,
          xmlEvento: evt.rawXml,
        });
      }

      // ---------- Complementa com eventos do Ambiente Nacional ----------
      // NfeConsultaProtocolo (SEFAZ UF) devolve apenas o protocolo + eventos
      // filed na UF de origem. Eventos registrados no AN (Ciência da Operação,
      // Confirmação, Desconhecimento, Op. Não Realizada — cOrgao=91) só vêm
      // via NFeDistribuicaoDFe/consChNFe. O SEFAZ só devolve documentos
      // quando o CNPJ informado em <distDFeInt><CNPJ> é um ator do documento
      // (emitente, destinatário ou terceiro autorizado). Como a CAPUL tem
      // várias filiais e o certificado é único (25834847000100) com procuração
      // e-CAC para toda a família, precisamos informar o CNPJ do destinatário
      // real da NFe — derivamos do XML parseado. Isolamos a chamada: se o
      // distDFe falhar, preservamos o que já veio do NfeConsultaProtocolo.
      let eventosAnStatus: 'OK' | 'ERRO' | 'VAZIO' | 'NAO_AUTORIZADO' = 'VAZIO';
      let eventosAnMensagem: string | null = null;
      try {
        const ufOrigem = ufFromChave(chave);
        // O CNPJ consulente precisa ser o destinatário real da NFe — já
        // está gravado em documento_consulta.cnpjDestinatario desde a
        // consulta inicial, evitando reparsear o XML aqui.
        const cnpjConsulenteOverride = doc.cnpjDestinatario ?? null;

        const distResp = await this.sefazDistribuicao.consultarEventosPorChave(
          chave,
          ufOrigem,
          ambienteStr,
          cnpjConsulenteOverride,
        );
        for (const evt of distResp.eventos) {
          if (!evt.dataEvento) continue;
          eventosParaPersistir.push({
            tipoEvento: evt.tipoEvento || 'DESCONHECIDO',
            descricao:
              evt.descricao ||
              TIPO_EVENTO_LABEL[evt.tipoEvento] ||
              `Evento ${evt.tipoEvento}`,
            dataEvento: new Date(evt.dataEvento),
            protocoloEvento: evt.protocolo,
            cStat: evt.cStat,
            xMotivo: evt.xMotivo,
            xmlEvento: evt.rawXml,
          });
        }
        eventosAnStatus = distResp.eventos.length > 0 ? 'OK' : 'VAZIO';
        this.logger.log(
          `distDFe consChNFe (consulente=${distResp.cnpjConsulenteUsado.slice(0, 8)}…) retornou ${distResp.eventos.length} evento(s) AN para ${chave.slice(0, 6)}…`,
        );
      } catch (err) {
        if (err instanceof SefazConsultaError) {
          // 249 = consulente não autorizado; 293 = consulente inválido para
          // a chave (acontece quando o CNPJ não é ator do documento).
          if (err.cStat === '249' || err.cStat === '293') {
            eventosAnStatus = 'NAO_AUTORIZADO';
            eventosAnMensagem = `${err.cStat} — ${err.xMotivo}`;
          } else {
            eventosAnStatus = 'ERRO';
            eventosAnMensagem = `${err.cStat} — ${err.xMotivo}`;
          }
        } else {
          eventosAnStatus = 'ERRO';
          eventosAnMensagem = (err as Error).message;
        }
        this.logger.warn(
          `distDFe consChNFe falhou para ${chave.slice(0, 6)}… (tolerante): ${eventosAnMensagem}`,
        );
      }

      await this.documentoEvento.upsertMany(doc.id, eventosParaPersistir);
      const eventosTimeline = await this.carregarEventosDoBanco(doc.id);

      return {
        chave,
        filial,
        consultadoEm: new Date().toISOString(),
        cStat: statusResp.cStat,
        xMotivo: statusResp.xMotivo,
        protocolo: statusResp.protocolo,
        dataRecebimento: statusResp.dataRecebimento,
        eventos: eventosTimeline,
        eventosAnStatus,
        eventosAnMensagem,
      };
    } catch (err) {
      if (err instanceof NfeConsultaProtocoloError) {
        // Erro de negócio/disponibilidade do serviço SEFAZ — mensagem amigável
        this.logger.warn(
          `NfeConsultaProtocolo falhou para chave ${chave.slice(0, 6)}…: ${err.message}`,
        );
        if (err.statusCode >= 500) {
          throw new ServiceUnavailableException({
            erro: 'SEFAZ_CONSULTA_PROTOCOLO_INDISPONIVEL',
            mensagem: err.message,
          });
        }
        throw new BadRequestException({
          erro: 'SEFAZ_CONSULTA_PROTOCOLO_ERRO',
          mensagem: err.message,
        });
      }
      // Erro técnico inesperado — log + mensagem genérica amigável
      const errMsg = (err as Error).message;
      this.logger.error(
        `Falha técnica em NfeConsultaProtocolo para ${chave.slice(0, 6)}…: ${errMsg}`,
        (err as Error).stack,
      );
      throw new ServiceUnavailableException({
        erro: 'SEFAZ_CONSULTA_PROTOCOLO_FALHA_TECNICA',
        mensagem:
          'Não foi possível atualizar o status na SEFAZ no momento. ' +
          'O serviço pode estar temporariamente indisponível — tente novamente em alguns minutos.',
      });
    }
  }

  /**
   * Baixa o XML autorizado da SEFAZ via NFeDistribuicaoDFe.
   * Trata erros tipados (SefazConsultaError) e erros técnicos (timeout, schema, etc.)
   * com mensagens específicas para o frontend.
   *
   * Resolve o CNPJ consulente pelo `filial` do request: o NFeDistribuicaoDFe
   * só devolve documentos quando o consulente é ator (emitente/destinatário).
   * Em transferências entre filiais CAPUL, a matriz (FISCAL_CNPJ_CONSULENTE)
   * pode não ser ator — nesse caso o CNPJ da filial selecionada é quem
   * aparece na NF. O certificado matriz cobre toda a família 25834847 via
   * procuração e-CAC. Se a filial não for encontrada, mantém o default.
   */
  private async baixarDoSefaz(chave: string, filial: string): Promise<string> {
    const ambienteCfg = await this.ambiente.getOrCreate();
    const ambienteStr = ambienteCfg.ambienteAtivo === 'PRODUCAO' ? 'PRODUCAO' : 'HOMOLOGACAO';
    const ufAutor = ufFromChave(chave);
    const cnpjConsulenteOverride = await this.resolverCnpjConsulentePorFilial(filial);

    try {
      const baixado = await this.sefazDistribuicao.consultarPorChave(
        chave,
        ufAutor,
        ambienteStr,
        cnpjConsulenteOverride,
      );
      this.logger.log(
        `distDFe consChNFe (consulente=${baixado.cnpjConsulenteUsado.slice(0, 8)}…) ` +
          `retornou XML para ${chave.slice(0, 6)}… filial=${filial}`,
      );
      return baixado.xml;
    } catch (err) {
      // Erro semântico tipado da SEFAZ (cStat ≠ 138)
      if (err instanceof SefazConsultaError) {
        // cStat=641: "NF-e indisponível para o emitente" — a chave foi emitida
        // pelo próprio CNPJ consulente. NFeDistribuicaoDFe é só para destinatários;
        // para o próprio emitente o XML vem do Protheus (SZR010) ou do ERP.
        if (err.cStat === '641') {
          const cnpjChave = chave.slice(6, 20);
          throw new NotFoundException({
            erro: 'NFE_EMITIDA_PELO_CONSULENTE',
            mensagem:
              `Esta NF-e foi emitida pelo CNPJ ${this.formatCnpj(cnpjChave)} ` +
              `(a própria empresa). O serviço NFeDistribuicaoDFe da SEFAZ só permite ` +
              `download para destinatários — use o Protheus (módulo Fiscal / SZR010) ` +
              `para obter o XML de notas emitidas pela empresa.`,
          });
        }
        // cStat=632: "Solicitação fora de prazo" — o serviço NFeDistribuicaoDFe
        // tem uma janela de aproximadamente 90 dias a contar do evento (autorização,
        // ciência, etc). NF-es mais antigas não podem ser baixadas por este serviço.
        // O XML original continua existindo — mas precisa ser obtido de outra fonte.
        if (err.cStat === '632') {
          const diasEstimados = this.diasDesdeEmissao(chave);
          throw new NotFoundException({
            erro: 'NFE_FORA_DE_PRAZO_SEFAZ',
            mensagem:
              `Esta NF-e está fora da janela de download do serviço SEFAZ ` +
              `NFeDistribuicaoDFe${diasEstimados ? ` (emitida há ~${diasEstimados} dias)` : ''}. ` +
              `A SEFAZ permite download apenas nos primeiros ~90 dias após a emissão/evento. ` +
              `Para obter esta NF-e: (1) verifique no Protheus (SZR010) se ela foi baixada ` +
              `anteriormente e está em cache, ou (2) solicite o XML diretamente ao emitente.`,
          });
        }
        throw new NotFoundException({
          erro: 'SEFAZ_NAO_RETORNOU_DOCUMENTO',
          mensagem: `SEFAZ não retornou o documento: ${err.xMotivo} (cStat=${err.cStat})`,
        });
      }
      // Erro técnico (rede, schema XML, parser, etc.) — log detalhado + mensagem amigável
      const errMsg = (err as Error).message;
      this.logger.error(
        `Falha técnica em NFeDistribuicaoDFe para chave ${chave.slice(0, 6)}…: ${errMsg}`,
        (err as Error).stack,
      );
      throw new BadRequestException({
        erro: 'SEFAZ_FALHA_TECNICA',
        mensagem: `Falha ao consultar a SEFAZ: ${errMsg}. Verifique o certificado A1 e tente novamente.`,
      });
    }
  }

  /**
   * Retorna o CNPJ (somente dígitos) da filial ativa com o `codigo` dado,
   * ou `null` se não encontrada / sem CNPJ — nesse caso o chamador mantém
   * o consulente padrão (FISCAL_CNPJ_CONSULENTE). Não lança.
   */
  private async resolverCnpjConsulentePorFilial(codigo: string): Promise<string | null> {
    try {
      const filial = await this.prisma.filialCore.findFirst({
        where: { codigo, status: 'ATIVO' },
        select: { cnpj: true },
      });
      const cnpj = filial?.cnpj?.replace(/\D/g, '') ?? '';
      return cnpj.length === 14 ? cnpj : null;
    } catch (err) {
      this.logger.warn(
        `Falha ao resolver CNPJ da filial ${codigo} — usando consulente padrão. ${(err as Error).message}`,
      );
      return null;
    }
  }

  // ----- validação -----

  private validateChave(chave: string): void {
    // Formato + DV módulo 11 (economiza round-trip SEFAZ quando usuário digita errado)
    assertChaveFormato(chave);
    // DV não é obrigatório aqui — a SEFAZ valida no consumo. Usamos apenas
    // quando a origem é digitação manual. Para colar de sistemas externos,
    // deixamos passar e deixamos a SEFAZ responder se estiver errado.
  }

  private validateFilial(filial: string): void {
    if (!/^\d{2}$/.test(filial)) {
      throw new BadRequestException(`Filial inválida: esperado 2 dígitos, recebido "${filial}"`);
    }
  }

  private formatCnpj(cnpj: string): string {
    if (cnpj.length !== 14) return cnpj;
    return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
  }

  /**
   * Estima dias desde a emissão a partir dos dígitos AAMM da chave (posições 2-5).
   * Usa dia 15 do mês como aproximação (não sabemos o dia exato só pela chave).
   * Retorna null se a chave for inválida ou se a data estimada estiver no futuro.
   */
  private diasDesdeEmissao(chave: string): number | null {
    if (!/^\d{44}$/.test(chave)) return null;
    const yy = parseInt(chave.slice(2, 4), 10);
    const mm = parseInt(chave.slice(4, 6), 10);
    if (isNaN(yy) || isNaN(mm) || mm < 1 || mm > 12) return null;
    const year = 2000 + yy;
    const emissao = new Date(year, mm - 1, 15);
    const hoje = new Date();
    const diff = Math.floor((hoje.getTime() - emissao.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : null;
  }

}
