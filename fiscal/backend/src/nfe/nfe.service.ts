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
import { NfeParserService, ORGAO_RECEPCAO_MAP } from './parsers/nfe-parser.service.js';
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
      const candidateXml = Buffer.from(xmlNfeResp.xmlBase64, 'base64').toString('utf8');
      // SPED156.DOCXMLRET às vezes guarda apenas o `<resNFe>` (resumo do
      // NFeDistribuicaoDFe quando só houve Ciência sem Confirmação). Sem o
      // `<NFe>` completo o parser quebra. Tratamos como cache miss e caímos
      // pro fallback SEFAZ — mesmo caminho de quando o Protheus retorna 404.
      const temNFeCompleta = /<NFe\b/.test(candidateXml) || /<nfeProc\b/.test(candidateXml);
      if (!temNFeCompleta) {
        this.logger.warn(
          `xmlNfe HIT mas sem NF-e completa (origem=${xmlNfeResp.origem}, ` +
            `provavelmente <resNFe>) — chave ${chave.slice(0, 6)}… filial=${filial}. ` +
            `Caindo para fallback SEFAZ.`,
        );
        leitura = 'CACHE_MISS';
        leituraMensagem =
          xmlNfeResp.origem === 'SPED156'
            ? 'Protheus tem apenas resumo (resNFe) em SPED156 — XML completo será baixado da SEFAZ.'
            : 'Protheus retornou conteúdo sem NF-e completa — buscando na SEFAZ.';
        xmlNfeResp = null;
      }
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
      // Sem procEventoNFe salvo (autorização inicial OU evento vindo do
      // Protheus /eventosNfe, que só devolve metadados). Construímos um
      // detalhe sintético com os campos deriváveis — fica ~80% igual ao
      // portal SEFAZ. Os 3 campos que dependem exclusivamente do XML
      // (Id do Evento / Sequencial / Protocolo + Data Autorização) ficam
      // nulos e o frontend mostra "-" pra eles, com nota explicativa.
      const detalheSintetico = this.construirDetalheSintetico(evento, doc);
      return {
        id: evento.id,
        tipoEvento: evento.tipoEvento,
        descricao: evento.descricao,
        dataEvento: evento.dataEvento.toISOString(),
        protocolo: evento.protocoloEvento,
        cStat: evento.cStat,
        xMotivo: evento.xMotivo,
        detalhe: detalheSintetico,
      };
    }
    const detalhe = this.parser.parseEventoXml(evento.xmlEvento);
    // Shape Protheus 28/04 (`<infEvento>` puro) não tem `<retEvento>` —
    // complementamos os campos de autorização SEFAZ com o que está persistido
    // no documento_evento (vindo do JSON do /eventosNfe). Para
    // `<procEventoNFe>` completo (XSD oficial), o parser já preenche e os
    // valores do banco apenas confirmam.
    if (!detalhe.autorizacaoCStat && evento.cStat) {
      detalhe.autorizacaoCStat = evento.cStat;
      detalhe.autorizacaoMotivo =
        evento.cStat === '135' ? 'Evento registrado e vinculado a NF-e' : null;
      detalhe.autorizacaoMensagem =
        evento.cStat === '135'
          ? '135 - Evento registrado e vinculado a NF-e'
          : evento.cStat;
    }
    if (!detalhe.autorizacaoProtocolo && evento.protocoloEvento) {
      detalhe.autorizacaoProtocolo = evento.protocoloEvento;
    }
    if (!detalhe.autorizacaoDataHora) {
      // dhRegEvento (registro SEFAZ) não vem no shape Protheus puro.
      // Usamos `dataEvento` (= `<dhEvento>` autoral) como aproximação —
      // diferença típica de segundos para manifestações.
      detalhe.autorizacaoDataHora = evento.dataEvento.toISOString();
    }
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
   * Monta um "NfeEventoDetalhe" parcial a partir dos dados que já temos
   * quando o procEventoNFe completo não foi persistido (caso típico:
   * eventos sincronizados via Protheus /eventosNfe).
   *
   * Derivações seguras (não palpite):
   *   - Órgão Recepção: manifestações (210200/210/220/240) vão SEMPRE ao
   *     Ambiente Nacional (91). CC-e, Cancelamento, EPEC vão à UF emitente.
   *   - Ambiente: vem do documento_consulta.ambienteSefaz (registrado na
   *     consulta que trouxe o XML).
   *   - Autor Evento (CNPJ): manifestações = destinatário; demais tipos
   *     (cancelamento/CC-e) = emitente.
   *   - Mensagem de Autorização: cStat 135 = "Evento registrado e vinculado
   *     a NF-e" (único status de autorização bem-sucedida de evento).
   *
   * Campos que ficam null (sem XML do procEventoNFe não há como derivar):
   *   - Id do Evento, Sequencial, Versão Evento, Justificativa,
   *     Protocolo SEFAZ, Data/Hora da Autorização.
   */
  private construirDetalheSintetico(
    evento: {
      tipoEvento: string;
      descricao: string;
      dataEvento: Date;
      cStat: string | null;
      idEvento?: string | null;
      protocoloEvento?: string | null;
    },
    doc: { chave: string; cnpjEmitente: string | null; cnpjDestinatario: string | null; ambienteSefaz: string },
  ): import('./parsers/nfe-parsed.interface.js').NfeEventoDetalhe {
    const tpEvento = evento.tipoEvento;
    const ehManifestacao = ['210200', '210210', '210220', '210240'].includes(tpEvento);
    // Órgão: 91 (AN) para manifestações; cUF do emitente para cancelamento/CC-e/EPEC
    const cUfEmitente = doc.chave.slice(0, 2);
    const orgaoRecepcao = ehManifestacao ? '91' : cUfEmitente;
    const orgaoRecepcaoDescricao = ORGAO_RECEPCAO_MAP[orgaoRecepcao] ?? null;
    // Autor: destinatário para manifestações, emitente para os demais
    const autorCnpj = ehManifestacao ? doc.cnpjDestinatario : doc.cnpjEmitente;
    const ambiente: '1' | '2' = doc.ambienteSefaz === 'PRODUCAO' ? '1' : '2';
    const ambienteDescricao = ambiente === '1' ? '1 - Produção' : '2 - Homologação';
    // Mensagem de autorização: cStat 135 é o único "sucesso" padrão para eventos.
    const autorizacaoMensagem =
      evento.cStat === '135'
        ? '135 - Evento registrado e vinculado a NF-e'
        : evento.cStat
          ? `${evento.cStat}`
          : null;
    return {
      orgaoRecepcao,
      orgaoRecepcaoDescricao,
      ambiente,
      ambienteDescricao,
      versao: '1.00',
      chave: doc.chave,
      // idEvento agora vem do Protheus /eventosNfe (contrato 27/04/2026).
      // Continua null para eventos que o Protheus não devolve esse campo
      // (ex.: autorização sintética da própria NF-e).
      idEvento: evento.idEvento ?? null,
      autorCnpj,
      autorCpf: null,
      dataEvento: evento.dataEvento.toISOString(),
      tipoEvento: tpEvento,
      // Combina código + descrição igual portal SEFAZ (ex: "210240 - Operação não Realizada").
      // Só faz sentido quando tpEvento é numérico — para 'AUTORIZACAO' mantém a descrição original.
      tipoEventoDescricao: /^\d+$/.test(tpEvento)
        ? `${tpEvento} - ${evento.descricao}`
        : evento.descricao,
      // Manifestações (210200/210210/210220/210240) sempre são únicas por NF-e
      // (operador só manifesta uma vez em cada modalidade) — nSeqEvento=1.
      // CC-e (110110) pode ter múltiplas; sem o XML não dá pra inferir o número.
      sequencial: ehManifestacao ? 1 : null,
      versaoEvento: '1.00',
      descricaoEvento: evento.descricao,
      justificativa: null, // Protheus /eventosNfe não devolve
      autorizacaoCStat: evento.cStat,
      autorizacaoMotivo: evento.cStat === '135' ? 'Evento registrado e vinculado a NF-e' : null,
      autorizacaoMensagem,
      // Protocolo SEFAZ específico do evento — Protheus disponibilizou em
      // 27/04/2026 via /eventosNfe. Distinto do protocolo da autorização
      // original da NF-e (esse fica em documento_consulta.protocolo).
      autorizacaoProtocolo: evento.protocoloEvento ?? null,
      // Aproximação pelo `dataEvento` (= `quando` do Protheus). No XML
      // procEventoNFe há dois timestamps próximos: `dhEvento` (intenção do
      // autor) e `dhRegEvento` (registro pela SEFAZ). O Protheus expõe
      // apenas um campo `quando` — usamos como Data/Hora Autorização
      // enquanto o ERP não devolve `dhRegEvento` separado. Em geral diferem
      // por segundos, suficiente para auditoria visual.
      autorizacaoDataHora: evento.dataEvento.toISOString(),
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
   * Atualiza a timeline de eventos da NF-e usando o Protheus como fonte —
   * SEM consumir slot SEFAZ. Chama `/eventosNfe` (SPED150 + SPED156 + SZR010)
   * e persiste os eventos em `fiscal.documento_evento`.
   *
   * Racional: o SEFAZ, após "consumir" um evento via distDFe/consChNFe,
   * normalmente não o devolve novamente — por isso o botão "Atualizar status
   * no SEFAZ" pode voltar vazio mesmo quando o portal SEFAZ mostra 8 eventos.
   * O Protheus mantém a timeline histórica em SPED156, então é a fonte
   * confiável. Endpoint separado do /atualizar-status para o operador poder
   * escolher: Protheus (gratuito, sem slot SEFAZ) ou SEFAZ (quando precisa
   * forçar reconsulta).
   */
  async atualizarEventosProtheus(chave: string, filial: string, _user: FiscalAuthenticatedUser) {
    this.validateChave(chave);
    const doc = await this.documentoConsulta.findByChave(chave, filial);
    if (!doc) {
      throw new NotFoundException(
        `Documento ${chave} filial ${filial} não encontrado. Faça a consulta primeiro.`,
      );
    }

    this.logger.log(
      `atualizarEventosProtheus: iniciando para chave=${chave.slice(0, 10)}… filial=${filial}`,
    );

    let respProtheus;
    try {
      respProtheus = await this.protheusEventos.listar(chave);
      this.logger.log(
        `atualizarEventosProtheus: Protheus retornou ${respProtheus.quantidade} evento(s) brutos para ${chave.slice(0, 10)}…`,
      );
      // Loga TODOS os campos de cada evento — precisamos saber se o
      // campo `detalhes` carrega a justificativa (NT 2012/003), que é o
      // único campo "enriquecido" que o portal SEFAZ mostra além dos
      // metadados básicos. Se não vier, pedimos à equipe Protheus.
      if (respProtheus.eventos.length > 0) {
        for (const [idx, e] of respProtheus.eventos.entries()) {
          this.logger.log(
            `atualizarEventosProtheus: evento[${idx}] origem=${e.origem} tipo="${e.tipo}" quando=${e.quando} ator="${e.ator}" detalhes="${e.detalhes}"`,
          );
        }
      }
    } catch (err) {
      const msg = (err as Error).message ?? '';
      const name = (err as Error).name ?? '';
      this.logger.warn(
        `atualizarEventosProtheus: erro Protheus — name=${name} msg=${msg.slice(0, 200)}`,
      );
      const apiIndisponivel =
        msg.includes("'<'") ||
        msg.includes('not valid JSON') ||
        msg.includes('other side closed') ||
        msg.includes('Connect Timeout') ||
        name === 'SocketError' ||
        name === 'ConnectTimeoutError';
      if (apiIndisponivel) {
        throw new ServiceUnavailableException({
          erro: 'EVENTOSNFE_NAO_DISPONIVEL',
          mensagem:
            'Endpoint /eventosNfe do Protheus ainda não está publicado. Enquanto isso, use "Atualizar status no SEFAZ" (consome slot).',
        });
      }
      throw err;
    }

    const eventosParaPersistir: EventoInput[] = [];
    let ignoradosNaoTimeline = 0;
    let ignoradosDataInvalida = 0;
    for (const ev of respProtheus.eventos) {
      // Eventos não-SEFAZ (SF1010 entrada fiscal, SZR010 importação interna)
      // não pertencem à timeline oficial — são atos do Protheus, não da SEFAZ.
      if (ev.origem === 'SF1010' || ev.origem === 'SZR010') {
        ignoradosNaoTimeline++;
        continue;
      }
      const dataEvento = this.parseDataProtheus(ev.quando);
      if (!dataEvento) {
        ignoradosDataInvalida++;
        this.logger.warn(
          `atualizarEventosProtheus: data inválida ignorada — "${ev.quando}" origem=${ev.origem} tipo=${ev.tipo}`,
        );
        continue;
      }
      const tipoNormalizado = this.mapearTipoEventoProtheus(ev.tipo, ev.origem);
      const descricao = TIPO_EVENTO_LABEL[tipoNormalizado] ?? ev.tipo;
      // Extrai cStat do `detalhes` quando vier no formato "… [cStat 135]" —
      // dá pra mostrar como "Mensagem de Autorização" no modal/impressão do
      // evento, igual ao portal SEFAZ.
      const cStatMatch = ev.detalhes?.match(/\[cStat\s+(\d{1,4})\]/);
      const cStatExtraido = cStatMatch ? cStatMatch[1] : null;
      const xMotivoComplementar = [`[${ev.origem}]`, ev.ator, ev.detalhes]
        .filter((s) => s && s.trim())
        .join(' · ');
      // Protheus disponibilizou em 27/04/2026 o `id_evento` e o `protocolo`
      // específico do evento. Vêm como string vazia para eventos que não os
      // geram (ex.: SPED156 autorização original) — normalizamos para null.
      const idEventoProtheus = ev.id_evento && ev.id_evento.trim() !== '' ? ev.id_evento.trim() : null;
      const protocoloProtheus = ev.protocolo && ev.protocolo.trim() !== '' ? ev.protocolo.trim() : null;
      // Em 28/04/2026 Protheus passou a entregar também `xmlBase64` por evento —
      // contém o `<infEvento>` autoral (com `<detEvento>` e `<xJust>` quando
      // aplicável). Decodificamos aqui e persistimos em documento_evento.xmlEvento;
      // o detalhe completo passa a ser parseado pelo `parseEventoXml` em vez
      // do detalhe sintético.
      const xmlEventoProtheus =
        ev.xmlBase64 && ev.xmlBase64.trim() !== ''
          ? Buffer.from(ev.xmlBase64.trim(), 'base64').toString('utf8')
          : null;
      eventosParaPersistir.push({
        tipoEvento: tipoNormalizado,
        descricao,
        dataEvento,
        cStat: cStatExtraido,
        xMotivo: xMotivoComplementar,
        idEvento: idEventoProtheus,
        protocoloEvento: protocoloProtheus,
        xmlEvento: xmlEventoProtheus,
      });
    }

    this.logger.log(
      `atualizarEventosProtheus: ${eventosParaPersistir.length} evento(s) para persistir ` +
        `(ignorados: ${ignoradosNaoTimeline} não-timeline [SF1010/SZR010], ${ignoradosDataInvalida} data inválida)`,
    );

    await this.documentoEvento.upsertMany(doc.id, eventosParaPersistir);
    const eventosTimeline = await this.carregarEventosDoBanco(doc.id);
    this.logger.log(
      `atualizarEventosProtheus: timeline final = ${eventosTimeline.length} evento(s) persistido(s) no banco.`,
    );

    return {
      chave,
      filial,
      consultadoEm: new Date().toISOString(),
      origem: 'PROTHEUS_SPED156',
      quantidadeProtheus: respProtheus.quantidade,
      quantidadeRecebidaUtil: eventosParaPersistir.length,
      quantidadePersistida: eventosParaPersistir.length,
      ignoradosSF1010: ignoradosNaoTimeline,
      ignoradosDataInvalida,
      eventos: eventosTimeline,
    };
  }

  /**
   * Parse da data Protheus no formato "YYYYMMDD HH:MM:SS" (timezone BRT).
   * Retorna null se o formato não bater — não queremos persistir eventos
   * com timestamp inválido.
   */
  private parseDataProtheus(quando: string): Date | null {
    const m = quando.match(/^(\d{4})(\d{2})(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return null;
    // Protheus devolve em horário local (BRT = UTC-3). Construímos um ISO
    // com offset explícito para não depender do TZ do processo Node.
    const [, y, mo, d, h, mi, s] = m;
    const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}-03:00`;
    const dt = new Date(iso);
    return isNaN(dt.getTime()) ? null : dt;
  }

  /**
   * Traduz o campo `tipo` do Protheus (texto livre tipo "Manif: Confirmacao
   * da Operacao", "NFe autorizada SEFAZ") para o código numérico SEFAZ
   * correspondente. Crítico para o dedup de `fiscal.documento_evento`
   * (@@unique documentoId+tipoEvento+dataEvento) — se não bater, o mesmo
   * evento vira 2 linhas (uma "210200" vinda do SEFAZ, outra
   * "MANIF: CONFIRMACAO DA OPERACAO" vinda do Protheus).
   *
   * Também restrito a ≤ 20 chars para caber em VARCHAR(20) da coluna
   * `tipo_evento` — strings maiores silenciosamente falhavam o upsert
   * (descoberto 24/04/2026 quando 4 eventos Protheus estouraram a coluna).
   */
  private mapearTipoEventoProtheus(tipo: string, origem: string): string {
    // Normaliza: uppercase + remove acentos + colapsa espaços + remove
    // prefixos conhecidos ("Manif: ", "NFe "). O Protheus devolve o mesmo
    // evento com formatações diferentes dependendo da origem (SPED150 usa
    // "Manif: X", SPED156 usa "X" direto).
    const normal = tipo
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .replace(/^MANIF:\s*/, '')
      .replace(/^NFE\s+/, '');

    const map: Record<string, string> = {
      AUTORIZACAO: TIPO_EVENTO_AUTORIZACAO,
      'AUTORIZACAO DE USO': TIPO_EVENTO_AUTORIZACAO,
      'AUTORIZADA SEFAZ': TIPO_EVENTO_AUTORIZACAO,
      CANCELAMENTO: '110111',
      'CANCELAMENTO POR SUBSTITUICAO': '110112',
      'CC-E': '110110',
      CCE: '110110',
      'CARTA DE CORRECAO': '110110',
      EPEC: '110113',
      CIENCIA: '210210',
      'CIENCIA DA OPERACAO': '210210',
      CONFIRMACAO: '210200',
      'CONFIRMACAO DA OPERACAO': '210200',
      DESCONHECIMENTO: '210220',
      'DESCONHECIMENTO DA OPERACAO': '210220',
      'OPERACAO NAO REALIZADA': '210240',
      'MDF-E AUTORIZADO': '310610',
      'CANCELAMENTO DE MDF-E': '310620',
      'REGISTRO PASSAGEM MDF-E': '510630',
      'CT-E AUTORIZADO': '510620',
    };
    if (map[normal]) return map[normal];

    // Fallback: origem + tipo truncado para caber em VARCHAR(20).
    // Ex.: "SPED156/EPEC", "SPED150/X" — serve para o operador identificar
    // que o Protheus mandou um tipo não mapeado, sem derrubar a persistência.
    const fallback = `${origem}/${normal}`.slice(0, 20);
    this.logger.warn(
      `mapearTipoEventoProtheus: tipo "${tipo}" (origem=${origem}) não mapeado — usando fallback "${fallback}". Adicionar ao map se recorrente.`,
    );
    return fallback;
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
