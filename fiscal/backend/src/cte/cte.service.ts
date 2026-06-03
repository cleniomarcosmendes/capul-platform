import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ProtheusXmlService } from '../protheus/protheus-xml.service.js';
import { ProtheusGravacaoHelper } from '../protheus/protheus-gravacao.helper.js';
import {
  CteConsultaProtocoloClient,
  CteConsultaProtocoloError,
} from '../sefaz/cte-consulta-protocolo.client.js';
import { decodeXmlBytes } from '../sefaz/xml-encoding.util.js';
import { AmbienteService } from '../ambiente/ambiente.service.js';
import { CteParserService } from './parsers/cte-parser.service.js';
import { DocumentoConsultaService } from '../nfe/documento-consulta.service.js';
import {
  DocumentoEventoService,
  TIPO_EVENTO_AUTORIZACAO,
  TIPO_EVENTO_LABEL,
  type EventoInput,
} from '../nfe/documento-evento.service.js';
import type { CteParsed } from './parsers/cte-parsed.interface.js';
import type { FiscalAuthenticatedUser } from '../common/interfaces/jwt-payload.interface.js';
import type { XmlNfeResult } from '../protheus/interfaces/xml-nfe.interface.js';
import type { OrigemConsulta } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  type ProtheusStatus,
  type ProtheusLeituraStatus,
  type ProtheusGravacaoStatus,
  construirAlertaLegado,
} from '../protheus/interfaces/protheus-status.interface.js';
import { assertModelo } from '../common/helpers/chave.helper.js';

export interface TimelineEvento {
  tipoEvento: string;
  tipoEventoLabel: string;
  descricao: string;
  dataEvento: string;
  protocolo: string | null;
  cStat: string | null;
  xMotivo: string | null;
  /**
   * Id do evento (cte_evento.idEvento) quando há detalhe disponível para abrir.
   * Null para eventos sem XML (ex.: autorização sintética, resumo SEFAZ).
   */
  id?: string | null;
  /** Indica se há XML do evento persistido para abrir o detalhe/impressão. */
  possuiDetalhe?: boolean;
}

export interface CteConsultaResult {
  chave: string;
  filial: string;
  origem: OrigemConsulta | 'SEFAZ_STATUS_ONLY'; // STATUS_ONLY = sem XML, só status/eventos
  documentoConsultaId: string;
  /**
   * Parsed é nulo quando não há XML disponível (cenário em que o CT-e não está
   * no Protheus — o SEFAZ CTeDistribuicaoDFe não permite baixar CT-e por chave,
   * só por NSU. Nesse caso a tela mostra apenas status/protocolo/eventos).
   */
  parsed: CteParsed | null;
  xml: string | null;
  /** Informa se o XML completo está disponível (true) ou só status/eventos (false). */
  xmlDisponivel: boolean;
  protheusStatus: ProtheusStatus;
  eventos: TimelineEvento[];
  consultaProtocoloStatus: {
    executado: boolean;
    sucesso: boolean;
    erro?: string | null;
  };
  /** Mensagem amigável quando só há status (sem XML). */
  avisoXmlIndisponivel?: string | null;
  /** @deprecated usar `protheusStatus` */
  alertaProtheus?: string;
}

/**
 * Fluxo CT-e — espelho do NfeService mas com parser e client próprios.
 * Usa o mesmo DocumentoConsultaService para persistência (tipoDocumento=CTE).
 */
@Injectable()
export class CteService {
  private readonly logger = new Logger(CteService.name);

  constructor(
    private readonly protheusXml: ProtheusXmlService,
    private readonly gravacaoHelper: ProtheusGravacaoHelper,
    private readonly sefazConsulta: CteConsultaProtocoloClient,
    private readonly parser: CteParserService,
    private readonly documentoConsulta: DocumentoConsultaService,
    private readonly documentoEvento: DocumentoEventoService,
    private readonly ambiente: AmbienteService,
    private readonly prisma: PrismaService,
  ) {}

  async consultarPorChave(
    chave: string,
    filial: string,
    user: FiscalAuthenticatedUser,
  ): Promise<CteConsultaResult> {
    this.validateChave(chave);
    this.validateFilial(filial);

    let xmlString: string | null = null;
    let parsed: CteParsed | null = null;
    let origem: OrigemConsulta | 'SEFAZ_STATUS_ONLY' = 'SEFAZ_STATUS_ONLY';
    let fonteXml: 'PLATAFORMA' | 'PROTHEUS' | null = null;

    let leitura: ProtheusLeituraStatus = 'NAO_CONSULTADO';
    let leituraMensagem: string | null = null;
    let leituraErro: string | null = null;
    const gravacao: ProtheusGravacaoStatus = 'NAO_APLICAVEL';
    const gravacaoMensagem =
      'Gravação CT-e não é realizada por este módulo — o Protheus grava via monitor CT-e.';
    const gravacaoErro: string | null = null;

    // --- passo 1: PLATAFORMA — buscar em fiscal.cte_documento (10/05/2026) ---
    // Source of truth quando distNSU está ativo. CT-es chegam direto do SEFAZ
    // via CTeDistribuicaoDFe e ficam armazenados em cte_documento.xml.
    // Antes (Onda 1 só) buscávamos só no Protheus — a partir de 10/05 olhamos
    // primeiro na nossa base, e Protheus vira fallback (caso o CT-e tenha sido
    // gravado manualmente lá mas não veio via distNSU — caso raro de transição).
    try {
      const docLocal = await this.prisma.cteDocumento.findFirst({
        where: { chave },
        orderBy: { recebidoEm: 'desc' },
        select: { id: true, xml: true, schema: true },
      });
      if (docLocal?.xml && (docLocal.schema === 'procCTe' || docLocal.schema === 'procCTeSimp')) {
        try {
          parsed = this.parser.parse(docLocal.xml);
          xmlString = docLocal.xml;
          // Reusa enum existente (PROTHEUS_CACHE) pra evitar migration; nota
          // semântica aqui que a fonte real é a plataforma. Próxima migration
          // pode adicionar valor PLATAFORMA_LOCAL ao enum OrigemConsulta.
          origem = 'PROTHEUS_CACHE';
          fonteXml = 'PLATAFORMA';
          leitura = 'CACHE_HIT';
          leituraMensagem = 'XML encontrado na plataforma (baixado do SEFAZ via distNSU).';
          this.logger.log(`consultarPorChave ${chave.slice(0, 6)}… — fonte=PLATAFORMA (cte_documento id=${docLocal.id})`);
        } catch (err) {
          this.logger.warn(
            `Parse do XML local falhou para CT-e ${chave.slice(0, 6)}…: ${(err as Error).message} — vou tentar Protheus.`,
          );
          xmlString = null;
          parsed = null;
        }
      }
    } catch (err) {
      this.logger.warn(
        `Busca em cte_documento falhou para ${chave.slice(0, 6)}…: ${(err as Error).message} — vou tentar Protheus.`,
      );
    }

    // --- passo 2: PROTHEUS (fallback) — GET /xmlNfe (SZR010 → SPED156) ---
    // Só executa se a plataforma não tinha o XML (ou parse falhou).
    let xmlNfeResp: XmlNfeResult | null = null;
    if (!xmlString) {
      try {
        xmlNfeResp = await this.protheusXml.buscarXml(chave);
        if (xmlNfeResp.found) {
          leitura = 'CACHE_HIT';
          leituraMensagem =
            xmlNfeResp.origem === 'SZR010'
              ? 'XML encontrado no cache do Protheus (SZR010).'
              : 'XML encontrado no Protheus (SPED156).';
        } else {
          leitura = 'CACHE_MISS';
          leituraMensagem = 'XML não encontrado nem na plataforma nem no Protheus — consultando apenas status na SEFAZ.';
        }
      } catch (err) {
        const msg = (err as Error).message;
        this.logger.warn(
          `xmlNfe falhou para CT-e chave ${chave.slice(0, 6)}…: ${msg} — seguindo apenas com status SEFAZ.`,
        );
        leitura = 'FALHA_TECNICA';
        leituraMensagem = 'Não foi possível verificar o cache no Protheus. Seguindo apenas com status SEFAZ.';
        leituraErro = msg;
      }

      // --- passo 2.1: se o XML veio do Protheus, decodifica e parseia ---
      if (xmlNfeResp?.found) {
        try {
          const decoded = decodeXmlBytes(
            Buffer.from(xmlNfeResp.xmlBase64, 'base64'),
            `xmlNfe Protheus CT-e ${chave.slice(0, 6)}…`,
          );
          xmlString = decoded.xml;
          if (decoded.encodingAnomaly) {
            this.logger.warn(
              `xmlNfe Protheus CT-e ${chave.slice(0, 6)}… retornou bytes nao-UTF-8 — fallback latin1 aplicado`,
            );
          }
          origem = 'PROTHEUS_CACHE';
          fonteXml = 'PROTHEUS';
          parsed = this.parser.parse(xmlString);
        } catch (err) {
          const msg = (err as Error).message;
          this.logger.warn(
            `Parse do XML CT-e falhou para chave ${chave.slice(0, 6)}…: ${msg} — caindo apenas para status SEFAZ.`,
          );
          leitura = 'FALHA_TECNICA';
          leituraMensagem = 'XML recebido do Protheus mas parse falhou. Seguindo apenas com status.';
          leituraErro = msg;
          xmlString = null;
          parsed = null;
        }
      }
    } else {
      // Plataforma já entregou — não precisamos do Protheus pra esta consulta
      this.logger.debug(
        `consultarPorChave ${chave.slice(0, 6)}… — pulando Protheus (XML ja achado na plataforma)`,
      );
    }
    void fonteXml; // referenciado nos logs acima; pode ser exposto na resposta no futuro

    const protheusStatus: ProtheusStatus = {
      leitura,
      leituraMensagem,
      leituraErro,
      gravacao,
      gravacaoMensagem,
      gravacaoErro,
      permiteReexecucao: leitura === 'FALHA_TECNICA',
      modoMock: this.protheusXml.isMockAtivo(),
      // CteService Onda 1 não dispara grvXML aqui — gravação fica delegada
      // ao Protheus via /xmlNfe (lazy). grvRequest persistido em
      // documento_consulta.protheus_grv_request quando regravarNoProtheus
      // ou tentarGravar forem chamados em outro fluxo.
      grvRequest: null,
    };
    const alertaProtheus = construirAlertaLegado(protheusStatus);

    // --- passo 3: upsert em fiscal.documento_consulta ---
    // Se não temos parsed, usamos metadados mínimos (só chave/filial). Serão
    // atualizados com os dados do CteConsultaProtocolo logo em seguida.
    const ambienteCfg = await this.ambiente.getOrCreate();
    const doc = await this.documentoConsulta.registrar({
      chave,
      tipoDocumento: 'CTE',
      filial,
      usuarioId: user.id,
      usuarioEmail: user.email,
      origem: parsed ? (origem as OrigemConsulta) : 'SEFAZ_DOWNLOAD',
      ambienteSefaz: ambienteCfg.ambienteAtivo,
      protocoloAutorizacao: parsed?.protocoloAutorizacao?.protocolo ?? null,
      dataAutorizacao: parsed?.protocoloAutorizacao?.dataRecebimento
        ? new Date(parsed.protocoloAutorizacao.dataRecebimento)
        : null,
      cnpjEmitente: parsed?.emitente.cnpj ?? null,
      cnpjDestinatario: parsed?.destinatario.cnpj ?? null,
      numeroNF: parsed?.dadosGerais.numero ?? null,
      serie: parsed?.dadosGerais.serie ?? null,
      valorTotal: parsed?.valores.valorTotalPrestacao ?? null,
      statusAtual: parsed?.protocoloAutorizacao?.motivo ?? null,
    });

    // --- passo 4: timeline de eventos via CteConsultaProtocolo (per-UF) ---
    const { eventos, consultaProtocoloStatus } = await this.construirTimeline(
      doc.id,
      chave,
      parsed?.protocoloAutorizacao ?? null,
      ambienteCfg.ambienteAtivo === 'PRODUCAO' ? 'PRODUCAO' : 'HOMOLOGACAO',
    );

    const avisoXmlIndisponivel = parsed
      ? null
      : 'O XML completo deste CT-e nao foi encontrado nem na plataforma (cte_documento via distNSU) nem no Protheus (SZR010/SPED156). O serviço nacional CTeDistribuicaoDFe só permite download por NSU — não por chave. Mostrando apenas status e eventos retornados pelo CteConsultaProtocolo da SEFAZ. Para obter o XML: aguarde a sincronização NSU (scheduler @cron 15min), peça ao emitente, ou use o monitor CT-e do Protheus.';

    return {
      chave,
      filial,
      origem,
      documentoConsultaId: doc.id,
      parsed,
      xml: xmlString,
      xmlDisponivel: parsed !== null,
      protheusStatus,
      eventos,
      consultaProtocoloStatus,
      avisoXmlIndisponivel,
      alertaProtheus,
    };
  }

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
   * Timeline de eventos CT-e — análoga à versão NF-e.
   * Consulta CteConsultaProtocolo (per UF) para obter status e eventos
   * (cancelamento, CC-e, desacordo, prestação em desacordo, etc.),
   * persiste em fiscal.documento_evento e retorna lista cronológica.
   * Tolerante a falhas — serviço per-UF pode estar indisponível.
   */
  private async construirTimeline(
    documentoId: string,
    chave: string,
    protocoloAutorizacao: CteParsed['protocoloAutorizacao'],
    ambiente: 'PRODUCAO' | 'HOMOLOGACAO',
  ): Promise<{
    eventos: TimelineEvento[];
    consultaProtocoloStatus: CteConsultaResult['consultaProtocoloStatus'];
  }> {
    const eventosParaPersistir: EventoInput[] = [];

    // 1) Autorização (vem do XML parseado, se disponível)
    if (protocoloAutorizacao?.protocolo && protocoloAutorizacao.dataRecebimento) {
      eventosParaPersistir.push({
        tipoEvento: TIPO_EVENTO_AUTORIZACAO,
        descricao: protocoloAutorizacao.motivo || 'Autorizado o uso do CT-e',
        dataEvento: new Date(protocoloAutorizacao.dataRecebimento),
        protocoloEvento: protocoloAutorizacao.protocolo,
        cStat: protocoloAutorizacao.cStat,
        xMotivo: protocoloAutorizacao.motivo,
      });
    }

    // 2) Eventos SEFAZ via CteConsultaProtocolo (per-UF)
    let consultaProtocoloStatus: CteConsultaResult['consultaProtocoloStatus'] = {
      executado: false,
      sucesso: false,
      erro: null,
    };

    try {
      const statusResp = await this.sefazConsulta.consultar(chave, ambiente);
      consultaProtocoloStatus = { executado: true, sucesso: true, erro: null };

      // Se não tínhamos autorização do XML (cenário sem Protheus), usar a do SEFAZ
      if (
        !protocoloAutorizacao?.protocolo &&
        statusResp.protocolo &&
        statusResp.dataRecebimento
      ) {
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
        });
      }

      await this.documentoConsulta.marcarStatusSefazAtualizado(
        documentoId,
        `${statusResp.cStat} — ${statusResp.xMotivo}`,
      );
    } catch (err) {
      const msg =
        err instanceof CteConsultaProtocoloError
          ? err.message
          : (err as Error).message;
      this.logger.warn(
        `CteConsultaProtocolo falhou (tolerante) para ${chave.slice(0, 6)}…: ${msg}`,
      );
      consultaProtocoloStatus = { executado: true, sucesso: false, erro: msg };
    }

    // 3) Persiste (idempotente)
    await this.documentoEvento.upsertMany(documentoId, eventosParaPersistir);

    // 4) Lista cronológica do banco (autorização + eventos do SEFAZ per-UF)
    const persistidos = await this.documentoEvento.listarPorDocumento(documentoId);

    // 5) Eventos ricos da distribuição (fiscal.cte_evento) — chegam via
    //    CTeDistribuicaoDFe/distNSU com o XML completo (procEventoCTe), o que
    //    permite abrir o detalhe e imprimir. Fonte canônica dos eventos de
    //    CT-e nesta plataforma (cancelamento, CC-e, desacordo, MDF-e vinculado).
    const eventosCte = await this.carregarEventosCte(chave);

    // 6) Merge + dedup. cte_evento é a fonte com detalhe; quando o mesmo tpEvento
    //    já veio pela distribuição, descartamos o resumo do SEFAZ (sem XML) para
    //    não duplicar a linha. A autorização (sem tpEvento numérico) sempre fica.
    const tiposComDetalhe = new Set(eventosCte.map((e) => e.tipoEvento));
    const eventosPersistidos: TimelineEvento[] = persistidos
      .filter(
        (e) =>
          e.tipoEvento === TIPO_EVENTO_AUTORIZACAO ||
          !tiposComDetalhe.has(e.tipoEvento),
      )
      .map((e) => ({
        id: null,
        possuiDetalhe: false,
        tipoEvento: e.tipoEvento,
        tipoEventoLabel: TIPO_EVENTO_LABEL[e.tipoEvento] ?? `Evento ${e.tipoEvento}`,
        descricao: e.descricao,
        dataEvento: e.dataEvento.toISOString(),
        protocolo: e.protocoloEvento,
        cStat: e.cStat,
        xMotivo: e.xMotivo,
      }));

    const eventos: TimelineEvento[] = [...eventosPersistidos, ...eventosCte].sort(
      (a, b) => a.dataEvento.localeCompare(b.dataEvento),
    );

    return { eventos, consultaProtocoloStatus };
  }

  /**
   * Carrega os eventos de um CT-e da tabela fiscal.cte_evento (populada pela
   * ingestão de distribuição distNSU) e converte para TimelineEvento. Cada
   * evento traz `id` (idEvento) e `possuiDetalhe=true`, habilitando o clique
   * para abrir o detalhe/impressão no frontend. Sem chamadas SEFAZ.
   */
  private async carregarEventosCte(chave: string): Promise<TimelineEvento[]> {
    const eventos = await this.prisma.client.cteEvento.findMany({
      where: { chave },
      orderBy: { dhEvento: 'asc' },
    });
    return eventos.map((e) => {
      const tipo = String(e.tpEventoNum);
      const label = TIPO_EVENTO_LABEL[tipo] ?? `Evento ${tipo}`;
      return {
        id: e.idEvento,
        possuiDetalhe: !!e.xml,
        tipoEvento: tipo,
        tipoEventoLabel: label,
        descricao: label,
        dataEvento: e.dhEvento.toISOString(),
        protocolo: e.protocolo,
        cStat: e.cStat,
        xMotivo: e.xMotivo,
      };
    });
  }

  /**
   * Detalhe completo de um evento de CT-e — parseia o XML procEventoCTe
   * armazenado em fiscal.cte_evento. Alimenta o modal de detalhe / impressão
   * do frontend (tela "AUTOR DO EVENTO" + "Observação" do portal SEFAZ).
   * Não dispara nenhuma chamada SEFAZ — apenas lê o XML já persistido.
   */
  async obterEventoDetalhe(chave: string, idEvento: string) {
    this.validateChave(chave);
    const evento = await this.prisma.client.cteEvento.findUnique({
      where: { idEvento },
    });
    if (!evento || evento.chave !== chave) {
      throw new NotFoundException(
        `Evento ${idEvento} não encontrado para o CT-e ${chave}.`,
      );
    }
    const detalhe = this.parser.parseEventoCteXml(evento.xml);
    // Complementa autorização com o que está persistido (caso o retEventoCTe
    // não tenha vindo completo no XML).
    if (!detalhe.autorizacaoCStat && evento.cStat) {
      detalhe.autorizacaoCStat = evento.cStat;
      detalhe.autorizacaoMensagem =
        evento.cStat === '135'
          ? '135 - Evento registrado e vinculado a CT-e'
          : evento.cStat;
    }
    if (!detalhe.autorizacaoMotivo && evento.xMotivo) {
      detalhe.autorizacaoMotivo = evento.xMotivo;
    }
    if (!detalhe.autorizacaoProtocolo && evento.protocolo) {
      detalhe.autorizacaoProtocolo = evento.protocolo;
    }
    if (!detalhe.autorizacaoDataHora) {
      detalhe.autorizacaoDataHora = evento.dhEvento.toISOString();
    }
    return {
      id: evento.idEvento,
      tipoEvento: String(evento.tpEventoNum),
      descricao: detalhe.descricaoEvento ?? detalhe.tipoEventoDescricao,
      dataEvento: evento.dhEvento.toISOString(),
      protocolo: evento.protocolo,
      cStat: evento.cStat,
      xMotivo: evento.xMotivo,
      detalhe,
    };
  }

  private validateChave(chave: string): void {
    // assertModelo cobre formato + modelo 57/67 (CT-e / CT-e OS)
    assertModelo(chave, '57', '67');
  }

  private validateFilial(filial: string): void {
    if (!/^\d{2}$/.test(filial)) {
      throw new BadRequestException(`Filial inválida: ${filial}`);
    }
  }
}
