import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PapelDetectorService } from './papel-detector.service.js';
import { ProtheusGravacaoHelper } from '../../protheus/protheus-gravacao.helper.js';
import { AmbienteService } from '../../ambiente/ambiente.service.js';
import type { CteDocumento, PapelCapul } from '@prisma/client';

export interface ResultadoEnriquecimento {
  varridos: number;
  enriquecidos: number;
  semPapel: number;
  comAnomalia: number;
  erros: number;
  /** Tentativas de gravação no Protheus que retornaram GRAVADO */
  protheusGravados: number;
  /** Tentativas de gravação que retornaram JA_EXISTIA (race condition — OK) */
  protheusJaExistia: number;
  /** Tentativas de gravação com FALHA_TECNICA — mantém em pendência pra retry */
  protheusFalhas: number;
  /** Pulos por flag desligada ou doc já gravado anteriormente */
  protheusPulados: number;
  duracaoMs: number;
}

const BATCH_SIZE = 100;

/**
 * Limite de tentativas de gravação Protheus por documento. Após N falhas,
 * status vira `PROTHEUS_DESISTIU` (terminal — sai da fila de retry).
 * Operador reseta via endpoint admin se quiser nova tentativa após
 * resolver causa raiz (ex: corrigir XML inválido, religar Protheus).
 */
const MAX_TENTATIVAS_PROTHEUS = 5;

/**
 * Cron de enriquecimento de `cte_documento`. Faz 2 coisas em sequência:
 *
 *   1. **Enriquecer** — varre `processado_em IS NULL`, aplica
 *      `PapelDetectorService` no XML e popula `papel_capul` + `processado_em`.
 *
 *   2. **Gravar no Protheus** (se flag `cte_protheus_grava_ativo` em
 *      `ambiente_config` estiver ATIVA) — após enriquecer, chama
 *      `ProtheusGravacaoHelper.tentarGravar` pra escrever em SZR010+SZQ010
 *      via grvXML. Best-effort: falha não trava o cron, marca
 *      `protheus_status = FALHA_TECNICA` pra retry depois.
 *
 * Idempotente: registros já enriquecidos OU já gravados no Protheus são
 * pulados na próxima execução (re-enriquecer não regrava).
 *
 * Schemas tratados:
 *   - procCTe / procCTeSimp → enriquecimento + (se flag ativa) gravação Protheus
 *   - resCTe                → papel=TERCEIRO; **NÃO grava no Protheus** (Capul
 *                             só referenciada, sem carga real)
 *   - DESCONHECIDO          → papel=null; também não grava
 *
 * Eventos (procEventoCTe/resEventoCTe) vão pra `cte_evento` direto e não
 * passam por aqui.
 */
@Injectable()
export class CteEnriquecimentoService {
  private readonly logger = new Logger(CteEnriquecimentoService.name);
  private readonly parser: XMLParser;

  constructor(
    private readonly prisma: PrismaService,
    private readonly papelDetector: PapelDetectorService,
    private readonly protheusGravacao: ProtheusGravacaoHelper,
    private readonly ambiente: AmbienteService,
  ) {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: false,
      parseTagValue: false,
      trimValues: true,
      removeNSPrefix: true,
    });
  }

  /**
   * Processa em 2 fases:
   *   Fase 1: enriquece pendentes (papel_capul)
   *   Fase 2: grava no Protheus (se flag ativa + papel preenchido + ainda não gravado)
   */
  async processarPendentes(): Promise<ResultadoEnriquecimento> {
    const inicio = Date.now();
    const resultado: ResultadoEnriquecimento = {
      varridos: 0,
      enriquecidos: 0,
      semPapel: 0,
      comAnomalia: 0,
      erros: 0,
      protheusGravados: 0,
      protheusJaExistia: 0,
      protheusFalhas: 0,
      protheusPulados: 0,
      duracaoMs: 0,
    };

    // Fase 1 — enriquecimento (papel_capul)
    while (true) {
      const lote = await this.prisma.client.cteDocumento.findMany({
        where: { processadoEm: null },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
      });
      if (lote.length === 0) break;

      for (const doc of lote) {
        resultado.varridos++;
        try {
          await this.enriquecerUm(doc, resultado);
        } catch (err) {
          resultado.erros++;
          this.logger.error(
            `Falha enriquecer doc id=${doc.id}: ${(err as Error).message}`,
          );
        }
      }

      if (lote.length < BATCH_SIZE) break;
    }

    // Fase 2 — gravação Protheus (apenas se flag ativa)
    const protheusAtivo = await this.ambiente.getCteProtheusGravaAtivo();
    if (!protheusAtivo) {
      this.logger.warn(
        `[processarPendentes] Fase 2 (gravação Protheus) PULADA — ` +
          `flag cte_protheus_grava_ativo=false. Habilite em ` +
          `/operacao/controle/cte-distribuicao pra processar gravações.`,
      );
    }
    if (protheusAtivo) {
      // Resolve whitelist de filiais ANTES do loop (consistencia com Fase 1
      // do scheduler — bug detectado 07/05/2026 19:30: cron enriquecimento
      // ignorava whitelist e processava docs da matriz mesmo com whitelist={08}).
      const cfgCte = await this.ambiente.getCteDistribuicaoConfig();
      let cnpjsWhitelist: string[] | null = null;
      if (cfgCte.filiaisWhitelist && cfgCte.filiaisWhitelist.length > 0) {
        const filiais = await this.prisma.client.filialCore.findMany({
          where: { codigo: { in: cfgCte.filiaisWhitelist }, status: 'ATIVO', cnpj: { not: null } },
          select: { cnpj: true },
        });
        cnpjsWhitelist = filiais
          .map((f) => (f.cnpj ?? '').replace(/\D/g, ''))
          .filter((c) => c.length === 14);
        // Whitelist preenchida mas sem matchs reais → nao processa nada
        // (defensivo contra codigos invalidos)
        if (cnpjsWhitelist.length === 0) cnpjsWhitelist = ['__NUNCA_BATE__'];
      }

      while (true) {
        // Candidatos: já enriquecidos (papel_capul preenchido), schema documento
        // (não evento), ainda não gravados no Protheus, tentativas abaixo do limite
        // (PROTHEUS_DESISTIU é terminal e fica fora da fila).
        const lote = await this.prisma.client.cteDocumento.findMany({
          where: {
            processadoEm: { not: null },
            papelCapul: { not: null },
            protheusGravadoEm: null,
            schema: { in: ['procCTe', 'procCTeSimp'] },
            protheusTentativas: { lt: MAX_TENTATIVAS_PROTHEUS },
            // Exclui status terminal (caso já tenha desistido). Cobertura
            // explícita do NULL — Prisma `NOT` em campo nullable usa SQL
            // three-valued logic e descartaria linhas com status=NULL.
            OR: [
              { protheusStatus: null },
              { protheusStatus: { not: 'PROTHEUS_DESISTIU' } },
            ],
            // Whitelist de filiais (vazio = todas; preenchido = só essas)
            ...(cnpjsWhitelist ? { cnpjConsulente: { in: cnpjsWhitelist } } : {}),
          },
          orderBy: { id: 'asc' },
          take: BATCH_SIZE,
        });
        if (lote.length === 0) break;

        for (const doc of lote) {
          try {
            await this.gravarProtheusUm(doc, resultado);
          } catch (err) {
            resultado.protheusFalhas++;
            this.logger.error(
              `Falha gravar doc id=${doc.id} no Protheus: ${(err as Error).message}`,
            );
          }
        }

        if (lote.length < BATCH_SIZE) break;
      }
    }

    resultado.duracaoMs = Date.now() - inicio;
    if (resultado.varridos > 0 || resultado.protheusGravados > 0 || resultado.protheusFalhas > 0) {
      this.logger.log(
        `Enriquecimento: varridos=${resultado.varridos} enriq=${resultado.enriquecidos} semPapel=${resultado.semPapel} anomalias=${resultado.comAnomalia} erros=${resultado.erros} | Protheus: gravados=${resultado.protheusGravados} jaExistia=${resultado.protheusJaExistia} falhas=${resultado.protheusFalhas} pulados=${resultado.protheusPulados} ${resultado.duracaoMs}ms`,
      );
    }
    return resultado;
  }

  /**
   * Re-tenta gravacao Protheus em UM documento especifico (por id).
   * Usado pelo botao "Re-tentar gravacao" no modal /fiscal/cte quando o
   * documento esta com status FALHA_TECNICA ou PROTHEUS_DESISTIU.
   *
   * NAO consome SEFAZ — pega XML direto do cte_documento e chama grvXML
   * com pre-check + pos-validacao (Pedidos B + D).
   *
   * Reseta protheus_tentativas=0 antes da chamada — re-abre o ciclo de
   * retry caso esteja em PROTHEUS_DESISTIU (>=5 tentativas).
   */
  async regravarUmDoc(id: number): Promise<{
    ok: boolean;
    chave: string | null;
    statusAnterior: string | null;
    statusNovo: string | null;
    mensagem: string | null;
  }> {
    const doc = await this.prisma.client.cteDocumento.findUnique({ where: { id } });
    if (!doc) {
      return { ok: false, chave: null, statusAnterior: null, statusNovo: null, mensagem: 'Documento nao encontrado' };
    }
    if (doc.schema !== 'procCTe' && doc.schema !== 'procCTeSimp') {
      return {
        ok: false,
        chave: doc.chave,
        statusAnterior: doc.protheusStatus,
        statusNovo: doc.protheusStatus,
        mensagem: `Schema ${doc.schema} nao e gravavel (so procCTe e procCTeSimp).`,
      };
    }
    if (!doc.papelCapul) {
      return {
        ok: false,
        chave: doc.chave,
        statusAnterior: doc.protheusStatus,
        statusNovo: doc.protheusStatus,
        mensagem: 'Documento sem papel_capul — execute "Forcar enriquecimento" antes.',
      };
    }

    const statusAnterior = doc.protheusStatus;

    // Reset tentativas pra reabrir ciclo (caso PROTHEUS_DESISTIU)
    await this.prisma.client.cteDocumento.update({
      where: { id },
      data: { protheusStatus: null, protheusTentativas: 0, protheusGravadoEm: null },
    });
    const docResetado = await this.prisma.client.cteDocumento.findUnique({ where: { id } });
    if (!docResetado) {
      return { ok: false, chave: doc.chave, statusAnterior, statusNovo: null, mensagem: 'Documento sumiu durante reset.' };
    }

    const acc: ResultadoEnriquecimento = {
      varridos: 0, enriquecidos: 0, semPapel: 0, comAnomalia: 0, erros: 0,
      protheusGravados: 0, protheusJaExistia: 0, protheusFalhas: 0, protheusPulados: 0, duracaoMs: 0,
    };
    await this.gravarProtheusUm(docResetado, acc);

    const docFinal = await this.prisma.client.cteDocumento.findUnique({ where: { id } });
    return {
      ok:
        docFinal?.protheusStatus === 'GRAVADO' ||
        docFinal?.protheusStatus === 'JA_EXISTIA' ||
        docFinal?.protheusStatus === 'GRAVADO_PRENOTA_FALHOU',
      chave: doc.chave,
      statusAnterior,
      statusNovo: docFinal?.protheusStatus ?? null,
      mensagem: docFinal?.protheusErro ?? docFinal?.protheusStatus ?? null,
    };
  }

  /**
   * Reseta status PROTHEUS_DESISTIU/FALHA_TECNICA pra null e dispara
   * processarPendentes — re-tenta em batch documentos que falharam.
   *
   * **Janela de data obrigatoria** (07/05/2026): exige `dataInicio` e
   * `dataFim` (filtra `dhEmi`). Sem isso, retorna BadRequest. Razao: evitar
   * reprocessar docs antigos sem necessidade conforme sistema cresce ao
   * longo do tempo.
   *
   * Aceita filtros adicionais alinhados com a tela /fiscal/cte:
   *   - protheusStatus: array (default ['FALHA_TECNICA','PROTHEUS_DESISTIU'])
   *   - papel: filtra papelCapul
   *   - cnpjConsulente: filtra cnpjConsulente
   *
   * Tambem respeita whitelist em ambiente_config.cte_distribuicao_filiais_whitelist.
   * Se whitelist preenchida E cnpjConsulente nao bate → retorna 0.
   *
   * Nao consome SEFAZ — apenas re-chama grvXML pros XMLs ja persistidos.
   */
  async regravarFalhasBatch(filtros: {
    dataInicio: Date;
    dataFim: Date;
    protheusStatus?: string[];
    papel?: string;
    cnpjConsulente?: string;
  }): Promise<{
    docsResetados: number;
    enriquecimento: ResultadoEnriquecimento;
  }> {
    // Pre-check (08/05/2026): bloquear retry batch se flag global desligada,
    // pra nao deixar docs em limbo (status=NULL, sem retry, sem gravação).
    // Antes desse fix: docs eram resetados de FALHA_TECNICA pra NULL e
    // ficavam sem processamento porque processarPendentes pulava Fase 2.
    const protheusAtivo = await this.ambiente.getCteProtheusGravaAtivo();
    if (!protheusAtivo) {
      throw new BadRequestException(
        'Gravação Protheus está desligada (cte_protheus_grava_ativo=false). ' +
          'Habilite em /operacao/controle/cte-distribuicao antes de usar retry em batch — ' +
          'caso contrário, os documentos resetariam pra NULL sem ser processados.',
      );
    }

    const cfg = await this.ambiente.getCteDistribuicaoConfig();
    const whitelist = cfg.filiaisWhitelist ?? [];

    // Resolve whitelist de codigos pra CNPJs (igual NsuControleService)
    let cnpjsWhitelist: string[] | null = null;
    if (whitelist.length > 0) {
      const filiais = await this.prisma.client.filialCore.findMany({
        where: { codigo: { in: whitelist }, status: 'ATIVO', cnpj: { not: null } },
        select: { cnpj: true },
      });
      cnpjsWhitelist = filiais.map((f) => (f.cnpj ?? '').replace(/\D/g, '')).filter((c) => c.length === 14);
    }

    const statusFiltro = filtros.protheusStatus && filtros.protheusStatus.length > 0
      ? filtros.protheusStatus
      : ['FALHA_TECNICA', 'PROTHEUS_DESISTIU'];

    const where: any = {
      protheusStatus: { in: statusFiltro },
      dhEmi: { gte: filtros.dataInicio, lte: filtros.dataFim },
    };
    if (cnpjsWhitelist) where.cnpjConsulente = { in: cnpjsWhitelist };
    if (filtros.papel) where.papelCapul = filtros.papel;
    if (filtros.cnpjConsulente) where.cnpjConsulente = filtros.cnpjConsulente.replace(/\D/g, '');

    const resetResult = await this.prisma.client.cteDocumento.updateMany({
      where,
      data: { protheusStatus: null, protheusTentativas: 0, protheusGravadoEm: null },
    });

    this.logger.log(
      `[regravarFalhasBatch] resetados=${resetResult.count} docs ` +
        `dhEmi=[${filtros.dataInicio.toISOString()}..${filtros.dataFim.toISOString()}] ` +
        `status=${statusFiltro.join(',')} ` +
        `papel=${filtros.papel ?? '*'} cnpj=${filtros.cnpjConsulente ?? '*'} ` +
        `whitelist=${whitelist.length > 0 ? whitelist.join(',') : 'todas'}. Disparando enriquecimento.`,
    );

    // Dispara processamento — vai pegar os resetados + qualquer pendente normal
    const enriquecimento = await this.processarPendentes();

    return { docsResetados: resetResult.count, enriquecimento };
  }

  private async enriquecerUm(
    doc: CteDocumento,
    acc: ResultadoEnriquecimento,
  ): Promise<void> {
    let papel: PapelCapul | null = null;
    let anomalia: string | null = null;

    if (doc.schema === 'resCTe') {
      // resCTe sempre = TERCEIRO por definição da NT (resumo de quando
      // Capul é só referenciada, não ator).
      papel = 'TERCEIRO';
    } else if (doc.schema === 'procCTe' || doc.schema === 'procCTeSimp') {
      try {
        const parsed = this.parser.parse(doc.xml);
        const infCte = parsed?.cteProc?.CTe?.infCte ?? parsed?.CTe?.infCte;
        if (infCte) {
          const r = this.papelDetector.detectar(infCte);
          papel = r.papel;
          anomalia = r.anomalia;
        } else {
          anomalia = 'Estrutura procCTe sem <infCte>';
        }
      } catch (err) {
        anomalia = `Falha parse XML: ${(err as Error).message}`;
      }
    }
    // DESCONHECIDO: deixa papel=null e processadoEm=now mesmo assim,
    // pra não revarrer indefinidamente. erro_parse já está preenchido.

    await this.prisma.client.cteDocumento.update({
      where: { id: doc.id },
      data: {
        papelCapul: papel,
        processadoEm: new Date(),
        ...(anomalia && !doc.erroParse ? { erroParse: anomalia } : {}),
      },
    });

    if (papel) acc.enriquecidos++;
    else acc.semPapel++;
    if (anomalia) acc.comAnomalia++;
  }

  /**
   * Tenta gravar 1 documento no Protheus (SZR010+SZQ010) via grvXML.
   * Resolve o código de filial Protheus a partir do CNPJ Capul detectado
   * pelo PapelDetector — re-aplica o detector pra obter cnpjCapul (não
   * persistido na cte_documento; apenas papelCapul).
   */
  private async gravarProtheusUm(
    doc: CteDocumento,
    acc: ResultadoEnriquecimento,
  ): Promise<void> {
    if (!doc.chave || !doc.papelCapul) {
      acc.protheusPulados++;
      return;
    }

    // Re-aplica detector pra obter cnpjCapul (a coluna armazena só papel,
    // não o CNPJ específico — economiza espaço, recálculo é trivial).
    let cnpjCapulDetectado: string | null = null;
    try {
      const parsed = this.parser.parse(doc.xml);
      const infCte = parsed?.cteProc?.CTe?.infCte ?? parsed?.CTe?.infCte;
      if (infCte) {
        const r = this.papelDetector.detectar(infCte);
        cnpjCapulDetectado = r.cnpjCapul;
      }
    } catch {
      // Se parse falhou, não dá pra continuar. Pula.
      acc.protheusPulados++;
      return;
    }

    if (!cnpjCapulDetectado) {
      acc.protheusPulados++;
      return;
    }

    // Resolve código de filial Protheus (2 dígitos) por CNPJ.
    // core.filiais.codigo é o que o Protheus espera no body do grvXML.
    // Comparação tolerante a máscara: core.filiais grava CNPJ formatado
    // ("25.834.847/0001-00") enquanto detector retorna CNPJ limpo
    // ("25834847000100"). Limpa em memória (35 filiais — custo O(n) trivial).
    const filiaisAtivas = await this.prisma.client.filialCore.findMany({
      where: { status: 'ATIVO', cnpj: { not: null } },
      select: { codigo: true, cnpj: true },
    });
    const filial = filiaisAtivas.find(
      (f) => (f.cnpj ?? '').replace(/\D/g, '') === cnpjCapulDetectado,
    );
    if (!filial?.codigo) {
      this.logger.warn(
        `Doc id=${doc.id} chave=${doc.chave.slice(0, 8)}… CNPJ Capul ${cnpjCapulDetectado} sem filial em core.filiais (ATIVO) — pulando gravação Protheus`,
      );
      acc.protheusPulados++;
      // Marca status pra evitar retentativa indefinida; admin precisa
      // cadastrar a filial em core.filiais ou ignorar manualmente.
      await this.prisma.client.cteDocumento.update({
        where: { id: doc.id },
        data: {
          protheusStatus: 'FALHA_TECNICA',
          protheusErro: `CNPJ ${cnpjCapulDetectado} sem filial cadastrada em core.filiais (ATIVO)`,
        },
      });
      return;
    }

    // Tenta gravar — best-effort (não lança).
    // Helper extrai tpAmb do XML automaticamente e aplica gating ambiente
    // cruzado (XML HOM × Protheus PROD).
    const r = await this.protheusGravacao.tentarGravar({
      chave: doc.chave,
      tipoDocumento: 'CTE',
      filial: filial.codigo,
      xml: doc.xml,
      usuarioEmail: 'sistema:cte-enriquecimento',
    });

    // GRAVADO_PRENOTA_FALHOU eh terminal — XML gravado em SZR010/SZQ010 OK,
    // pre-nota precisa intervencao manual no Protheus. Retry nao ajuda
    // (root cause e validacao no ERP). Tratado como sucesso pra nao subir
    // tentativas e nao virar PROTHEUS_DESISTIU.
    const sucesso =
      r.gravacao === 'GRAVADO' ||
      r.gravacao === 'JA_EXISTIA' ||
      r.gravacao === 'GRAVADO_PRENOTA_FALHOU';
    const novasTentativas = doc.protheusTentativas + 1;
    const desistir = !sucesso && novasTentativas >= MAX_TENTATIVAS_PROTHEUS;

    // Persiste resultado + contador. Se atingiu MAX, marca status terminal
    // PROTHEUS_DESISTIU pra sair da fila de retry e exigir intervenção do
    // operador (que reseta via endpoint admin).
    // protheusGrvRequest atualizado a cada tentativa — pra setor fiscal
    // autoatender debug com equipe Protheus (botão "Copiar JSON" no modal).
    await this.prisma.client.cteDocumento.update({
      where: { id: doc.id },
      data: {
        protheusGravadoEm: sucesso ? new Date() : null,
        protheusStatus: desistir ? 'PROTHEUS_DESISTIU' : r.gravacao,
        protheusErro: desistir
          ? `Desistido após ${novasTentativas} tentativas. Última: ${r.gravacaoErro ?? '(sem detalhe)'}`
          : r.gravacaoErro,
        protheusTentativas: novasTentativas,
        protheusGrvRequest: r.requestBody,
      },
    });

    if (r.gravacao === 'GRAVADO' || r.gravacao === 'GRAVADO_PRENOTA_FALHOU') {
      acc.protheusGravados++;
    } else if (r.gravacao === 'JA_EXISTIA') {
      acc.protheusJaExistia++;
    } else {
      acc.protheusFalhas++;
    }

    if (desistir) {
      this.logger.warn(
        `Doc id=${doc.id} chave=${doc.chave.slice(0, 8)}… atingiu MAX_TENTATIVAS_PROTHEUS (${MAX_TENTATIVAS_PROTHEUS}) — marcado PROTHEUS_DESISTIU. Reset via endpoint admin pra retentar após resolver causa raiz.`,
      );
    }
  }

  /**
   * Reseta contador de tentativas + status pra forçar nova tentativa
   * de gravação no Protheus. Usado quando operador resolveu causa raiz
   * (ex: religou Protheus, corrigiu XML inválido) e quer reprocessar
   * documentos PROTHEUS_DESISTIU.
   *
   * Modo `apenasDesistidos=true` (default): só reseta os que estão em
   * status PROTHEUS_DESISTIU. False: reseta tudo com FALHA_TECNICA também.
   */
  async resetarTentativasProtheus(opts: { apenasDesistidos?: boolean } = {}): Promise<{ resetados: number }> {
    const apenasDesistidos = opts.apenasDesistidos ?? true;
    const r = await this.prisma.client.cteDocumento.updateMany({
      where: {
        protheusGravadoEm: null,
        protheusStatus: apenasDesistidos
          ? 'PROTHEUS_DESISTIU'
          : { in: ['PROTHEUS_DESISTIU', 'FALHA_TECNICA'] },
      },
      data: {
        protheusTentativas: 0,
        protheusStatus: null,
        protheusErro: null,
      },
    });
    this.logger.log(
      `Reset Protheus: ${r.count} documentos voltaram pra fila de retry (apenasDesistidos=${apenasDesistidos})`,
    );
    return { resetados: r.count };
  }
}
