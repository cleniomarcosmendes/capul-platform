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
import type { OrigemConsulta } from '@prisma/client';
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

    let leitura: ProtheusLeituraStatus = 'NAO_CONSULTADO';
    let leituraMensagem: string | null = null;
    let leituraErro: string | null = null;
    const gravacao: ProtheusGravacaoStatus = 'NAO_APLICAVEL';
    const gravacaoMensagem =
      'Gravação CT-e não é realizada por este módulo — o Protheus grava via monitor CT-e.';
    const gravacaoErro: string | null = null;

    // --- passo 1: cache check Protheus (tolerante) ---
    let existeNoProtheus = false;
    try {
      const existe = await this.protheusXml.exists(chave);
      existeNoProtheus = existe.existe;
      leitura = existeNoProtheus ? 'CACHE_HIT' : 'CACHE_MISS';
      leituraMensagem = existeNoProtheus
        ? 'XML encontrado no cache do Protheus (SZR010).'
        : 'XML não encontrado no Protheus — consultando apenas status na SEFAZ.';
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.warn(`xmlFiscal.exists CT-e falhou: ${msg}`);
      leitura = 'FALHA_TECNICA';
      leituraMensagem = 'Não foi possível verificar o cache no Protheus. Seguindo apenas com status SEFAZ.';
      leituraErro = msg;
    }

    // --- passo 2: se existe no Protheus, baixa XML e parseia ---
    if (existeNoProtheus) {
      try {
        const protResp = await this.protheusXml.get(chave);
        xmlString = protResp.xml;
        origem = 'PROTHEUS_CACHE';
        parsed = this.parser.parse(xmlString);
      } catch (err) {
        const msg = (err as Error).message;
        this.logger.warn(`xmlFiscal.get CT-e falhou: ${msg} — caindo apenas para status SEFAZ.`);
        leitura = 'FALHA_TECNICA';
        leituraMensagem = 'Cache Protheus estava disponível mas o download falhou. Seguindo apenas com status.';
        leituraErro = msg;
        xmlString = null;
        parsed = null;
      }
    }

    const protheusStatus: ProtheusStatus = {
      leitura,
      leituraMensagem,
      leituraErro,
      gravacao,
      gravacaoMensagem,
      gravacaoErro,
      permiteReexecucao: leitura === 'FALHA_TECNICA',
      modoMock: this.protheusXml.isMockAtivo(),
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
      : 'O XML completo deste CT-e não está no Protheus (SZR010). O serviço nacional CTeDistribuicaoDFe só permite download por NSU — não por chave. Mostrando apenas status e eventos retornados pelo CteConsultaProtocolo da SEFAZ. Para obter o XML: aguarde a sincronização NSU, peça ao emitente, ou use o monitor CT-e do Protheus.';

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

    // 4) Retorna lista cronológica do banco
    const persistidos = await this.documentoEvento.listarPorDocumento(documentoId);
    const eventos: TimelineEvento[] = persistidos.map((e) => ({
      tipoEvento: e.tipoEvento,
      tipoEventoLabel: TIPO_EVENTO_LABEL[e.tipoEvento] ?? `Evento ${e.tipoEvento}`,
      descricao: e.descricao,
      dataEvento: e.dataEvento.toISOString(),
      protocolo: e.protocoloEvento,
      cStat: e.cStat,
      xMotivo: e.xMotivo,
    }));

    return { eventos, consultaProtocoloStatus };
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
