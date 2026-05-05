import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PapelDetectorService } from './papel-detector.service.js';
import type { CteDocumento } from '@prisma/client';

export interface ResultadoEnriquecimento {
  varridos: number;
  enriquecidos: number;
  semPapel: number;
  comAnomalia: number;
  erros: number;
  duracaoMs: number;
}

const BATCH_SIZE = 100;

/**
 * Cron de enriquecimento de `cte_documento` — varre registros com
 * `processado_em IS NULL`, aplica `PapelDetectorService` no XML e popula
 * `papel_capul` + marca `processado_em`.
 *
 * Idempotente: registros já processados não são reaberta. Pra re-processar
 * (ex: após melhoria do detector), zerar `processado_em` via SQL e rodar
 * de novo.
 *
 * Lida com schemas:
 *   - procCTe / procCTeSimp → busca ator papel via PapelDetector em <infCte>
 *   - resCTe                → papel = TERCEIRO (Capul aparece referenciada
 *                             mas não é ator direto — definição da NT)
 *   - DESCONHECIDO          → papel = null (mantém erro_parse pra triagem)
 *
 * Eventos (procEventoCTe/resEventoCTe) já vão pra `cte_evento` direto e
 * não passam por aqui.
 */
@Injectable()
export class CteEnriquecimentoService {
  private readonly logger = new Logger(CteEnriquecimentoService.name);
  private readonly parser: XMLParser;

  constructor(
    private readonly prisma: PrismaService,
    private readonly papelDetector: PapelDetectorService,
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
   * Processa todos os registros pendentes em batches de 100. Retorna sumário.
   * Pode ser chamado pelo cron OU pelo endpoint admin (debug/manutenção).
   */
  async processarPendentes(): Promise<ResultadoEnriquecimento> {
    const inicio = Date.now();
    const resultado: ResultadoEnriquecimento = {
      varridos: 0,
      enriquecidos: 0,
      semPapel: 0,
      comAnomalia: 0,
      erros: 0,
      duracaoMs: 0,
    };

    // Processa em loops de batch — evita carregar 50k+ XMLs em memória de uma vez
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

      // Sai do loop se foi um lote parcial (não há mais)
      if (lote.length < BATCH_SIZE) break;
    }

    resultado.duracaoMs = Date.now() - inicio;
    if (resultado.varridos > 0) {
      this.logger.log(
        `Enriquecimento: varridos=${resultado.varridos} enriquecidos=${resultado.enriquecidos} semPapel=${resultado.semPapel} anomalias=${resultado.comAnomalia} erros=${resultado.erros} ${resultado.duracaoMs}ms`,
      );
    }
    return resultado;
  }

  private async enriquecerUm(
    doc: CteDocumento,
    acc: ResultadoEnriquecimento,
  ): Promise<void> {
    let papel: ResultadoEnriquecimentoUm['papel'] = null;
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
        // Se tiver anomalia nova e erro_parse vazio, registra
        ...(anomalia && !doc.erroParse ? { erroParse: anomalia } : {}),
      },
    });

    if (papel) acc.enriquecidos++;
    else acc.semPapel++;
    if (anomalia) acc.comAnomalia++;
  }
}

interface ResultadoEnriquecimentoUm {
  papel: import('@prisma/client').PapelCapul | null;
}
