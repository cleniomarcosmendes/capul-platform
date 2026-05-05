import { Injectable, Logger } from '@nestjs/common';
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
    if (protheusAtivo) {
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
            // Exclui status terminal (caso já tenha desistido)
            NOT: { protheusStatus: 'PROTHEUS_DESISTIU' },
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
    const r = await this.protheusGravacao.tentarGravar({
      chave: doc.chave,
      tipoDocumento: 'CTE',
      filial: filial.codigo,
      xml: doc.xml,
      usuarioEmail: 'sistema:cte-enriquecimento',
    });

    const sucesso = r.gravacao === 'GRAVADO' || r.gravacao === 'JA_EXISTIA';
    const novasTentativas = doc.protheusTentativas + 1;
    const desistir = !sucesso && novasTentativas >= MAX_TENTATIVAS_PROTHEUS;

    // Persiste resultado + contador. Se atingiu MAX, marca status terminal
    // PROTHEUS_DESISTIU pra sair da fila de retry e exigir intervenção do
    // operador (que reseta via endpoint admin).
    await this.prisma.client.cteDocumento.update({
      where: { id: doc.id },
      data: {
        protheusGravadoEm: sucesso ? new Date() : null,
        protheusStatus: desistir ? 'PROTHEUS_DESISTIU' : r.gravacao,
        protheusErro: desistir
          ? `Desistido após ${novasTentativas} tentativas. Última: ${r.gravacaoErro ?? '(sem detalhe)'}`
          : r.gravacaoErro,
        protheusTentativas: novasTentativas,
      },
    });

    if (r.gravacao === 'GRAVADO') acc.protheusGravados++;
    else if (r.gravacao === 'JA_EXISTIA') acc.protheusJaExistia++;
    else acc.protheusFalhas++;

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
