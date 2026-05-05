import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CteDistribuicaoClient, type CteDocZip } from '../../sefaz/cte-distribuicao.client.js';
import { SefazConsultaError } from '../../sefaz/nfe-distribuicao.client.js';
import { LimiteDiarioService } from '../../limite-diario/limite-diario.service.js';
import { LimiteDiarioAtingidoException } from '../../limite-diario/limite-diario.exception.js';
import { AmbienteService } from '../../ambiente/ambiente.service.js';
import { NsuControleService } from './nsu-controle.service.js';
import { CteDocumentoService } from './cte-documento.service.js';
import { CteLoteConsultaService, type OrigemLote } from './cte-lote-consulta.service.js';

/**
 * Hard cap de iterações por chamada de `consultarFilial` — evita loop
 * infinito em caso de bug. Capul tem ~402 NSUs em HOM (PoC 05/05/2026):
 * com SEFAZ entregando 50 NSUs por bloco, 9 iterações cobrem o histórico
 * todo. Cap em 50 dá margem 5× pra emissores muito ativos sem deixar
 * runaway possível.
 */
const MAX_ITERACOES = 50;

/**
 * cUFAutor da Capul (matriz CNPJ 25834847000100, MG = código IBGE 31).
 * Hardcoded por ora — quando entrar Fase 2 (multi-filial), passar a
 * resolver via `core.filiais.uf` por CNPJ.
 */
const C_UF_AUTOR_DEFAULT = '31';

export interface ResultadoConsultaFilial {
  cnpj: string;
  ambiente: 'PRODUCAO' | 'HOMOLOGACAO';
  iteracoes: number;
  ultNSUInicial: string;
  ultNSUFinal: string;
  maxNSU: string;
  docsRecebidos: number;
  /** Documentos novos persistidos em cte_documento (não conta dedup) */
  docsPersistidos: number;
  /** Documentos que já existiam por (cnpj, ambiente, nsu) — dedup natural */
  docsDuplicados: number;
  /** ID do lote em cte_lote_consulta (auditoria histórica) */
  loteId: number;
  status: 'OK' | 'BLOQUEADO' | 'LIMITE_ATINGIDO' | 'ERRO_SEFAZ' | 'CIRCUIT_BREAK';
  cStatUltimo?: string;
  xMotivoUltimo?: string;
  motivoStop?: string;
  /** Sumário leve pra log/auditoria — sem incluir XMLs completos pra não inflar resposta */
  documentosResumo: Array<Pick<CteDocZip, 'nsu' | 'schema'> & { tamanhoXml: number; novo: boolean }>;
  /** Modo dry-run: docZips são logados mas não persistidos */
  dryRun: boolean;
  duracaoMs: number;
}

/**
 * Orquestrador da consulta `cteDistDFeInteresse` modo `distNSU` para uma
 * filial Capul. Loop:
 *   1. Pega cursor do `cte_controle_nsu` (cnpj, ambiente)
 *   2. Verifica bloqueio ativo (cStat 656 anterior)
 *   3. Loop até MAX_ITERACOES ou ultNSU == maxNSU:
 *      a. checkAndIncrement no LimiteDiario (bloqueia se 100% atingido)
 *      b. client.consultarPorNsu(...)
 *      c. Persiste cursor; em Fase 2 persiste docZips em `cte_documento`
 *   4. Trata SefazConsultaError (656 = bloqueia 1h; outros = aborta)
 *
 * Persistência de XML/eventos é responsabilidade da Fase 2. Por enquanto
 * apenas registra cursor e devolve sumário pra caller (endpoint admin).
 */
@Injectable()
export class DistribuicaoNsuService {
  private readonly logger = new Logger(DistribuicaoNsuService.name);

  constructor(
    private readonly client: CteDistribuicaoClient,
    private readonly nsuControle: NsuControleService,
    private readonly limiteDiario: LimiteDiarioService,
    private readonly ambiente: AmbienteService,
    private readonly config: ConfigService,
    private readonly documento: CteDocumentoService,
    private readonly lote: CteLoteConsultaService,
  ) {}

  /**
   * Feature flag estrutural — controla se o serviço CT-e Distribuição pode
   * efetivamente disparar consultas SEFAZ em ambiente PRODUCAO.
   *
   * Default `false` por defesa: enquanto o módulo está em desenvolvimento
   * (Fase 1+2 do PLANO_CTE_DISTRIBUICAO_v2.md), nenhuma chamada em PROD
   * acontece sem ativação explícita do operador. Configurar via
   * `FISCAL_CTE_DISTRIBUICAO_ENABLED=true` no `.env` quando alinhado com
   * o setor fiscal e os scheduler/ingestão estiverem prontos.
   *
   * Em HOMOLOGACAO esta flag é IGNORADA — HOM sempre permite (ambiente
   * de teste por design).
   *
   * Fase 2 promove esta flag para tela no Configurador (memory
   * `feedback_funcionalidade_visivel_no_configurador.md`) — env var fica
   * como fallback de bootstrap.
   */
  private isHabilitadoEmProd(): boolean {
    return this.config.get<string>('FISCAL_CTE_DISTRIBUICAO_ENABLED') === 'true';
  }

  /**
   * Resolve ambiente efetivo da consulta com possibilidade de override.
   *
   * - Sem `ambienteOverride`: usa `ambienteAtivo` do AmbienteConfig global
   *   (comportamento normal — produção e scheduler).
   * - Com `ambienteOverride='HOMOLOGACAO'`: força HOM mesmo se global=PROD.
   *   ⚠️ TEMPORÁRIO — só usado pelo endpoint admin manual durante a Fase 1
   *   de desenvolvimento (smoke test contra HOM SEFAZ enquanto o sistema
   *   local está apontando pra PROD por estar sendo usado pelo setor fiscal
   *   pra consultas reais). Remover quando ativação for normalizada e
   *   serviço entrar em rotina.
   */
  async consultarFilial(
    cnpjRaw: string,
    opts: {
      dryRun?: boolean;
      cUFAutor?: string;
      ambienteOverride?: 'PRODUCAO' | 'HOMOLOGACAO';
      origem?: OrigemLote;
    } = {},
  ): Promise<ResultadoConsultaFilial> {
    const cnpj = cnpjRaw.replace(/\D/g, '');
    if (!/^\d{14}$/.test(cnpj)) {
      throw new BadRequestException(`CNPJ inválido: ${cnpjRaw}`);
    }
    const cUFAutor = opts.cUFAutor ?? C_UF_AUTOR_DEFAULT;
    const dryRun = opts.dryRun ?? false;
    const inicio = Date.now();

    // Resolve ambiente: override (admin manual) > global (cron + chamada normal)
    const cfgAmb = await this.ambiente.getStatus();
    const ambienteStr: 'PRODUCAO' | 'HOMOLOGACAO' = opts.ambienteOverride ?? cfgAmb.ambienteAtivo;
    const ambienteInt: 1 | 2 = ambienteStr === 'PRODUCAO' ? 1 : 2;

    // Defesa: bloqueia execução em PROD enquanto FISCAL_CTE_DISTRIBUICAO_ENABLED!=true.
    // HOM sempre passa.
    if (ambienteStr === 'PRODUCAO' && !this.isHabilitadoEmProd()) {
      this.logger.warn(
        `[CTeDist] BLOQUEADO POR FEATURE FLAG cnpj=${cnpj} ambiente=PRODUCAO. ` +
        `Defina FISCAL_CTE_DISTRIBUICAO_ENABLED=true no .env quando autorizar ativação em PROD.`,
      );
      throw new ForbiddenException(
        'Serviço CT-e Distribuição não ativado em PRODUÇÃO. Configurar FISCAL_CTE_DISTRIBUICAO_ENABLED=true ou usar ambienteOverride=HOMOLOGACAO no endpoint admin.',
      );
    }

    if (opts.ambienteOverride) {
      this.logger.warn(
        `[CTeDist] ⚠️ AMBIENTE OVERRIDE em uso: forçado ${opts.ambienteOverride} (global=${cfgAmb.ambienteAtivo}). Mecanismo TEMPORÁRIO — só smoke test admin Fase 1.`,
      );
    }

    this.logger.log(
      `[CTeDist] consultarFilial cnpj=${cnpj} cUFAutor=${cUFAutor} ambiente=${ambienteStr} dryRun=${dryRun}`,
    );

    // 1. Cursor + bloqueio
    let controle = await this.nsuControle.obterOuCriar(cnpj, ambienteInt);
    const bloqueioMs = this.nsuControle.bloqueioAtivo(controle);
    if (bloqueioMs !== null) {
      const minutosRestantes = Math.ceil(bloqueioMs / 60000);
      this.logger.warn(
        `[CTeDist] BLOQUEADO cnpj=${cnpj} restam ${minutosRestantes}min motivo="${controle.motivoBloqueio}"`,
      );
      // Lote registra mesmo em curto-circuito pra debug histórico
      const loteBloq = await this.lote.abrir({
        cnpjConsulente: cnpj,
        ambiente: ambienteInt,
        ultNsuInicial: controle.ultimoNsuProcessado,
        origem: opts.origem ?? 'manual',
        dryRun,
      });
      await this.lote.fechar({
        loteId: loteBloq.id,
        iteracoes: 0,
        ultNsuFinal: controle.ultimoNsuProcessado,
        maxNsuFinal: controle.maxNsuConhecido,
        docsPersistidos: 0,
        docsDuplicados: 0,
        status: 'BLOQUEADO',
        motivoStop: `Bloqueado até ${controle.bloqueadoAte?.toISOString()} — ${controle.motivoBloqueio}`,
        duracaoMs: Date.now() - inicio,
      });
      return {
        cnpj,
        ambiente: ambienteStr,
        iteracoes: 0,
        ultNSUInicial: controle.ultimoNsuProcessado,
        ultNSUFinal: controle.ultimoNsuProcessado,
        maxNSU: controle.maxNsuConhecido,
        docsRecebidos: 0,
        docsPersistidos: 0,
        docsDuplicados: 0,
        loteId: loteBloq.id,
        status: 'BLOQUEADO',
        motivoStop: `Bloqueado até ${controle.bloqueadoAte?.toISOString()} — ${controle.motivoBloqueio}`,
        documentosResumo: [],
        dryRun,
        duracaoMs: Date.now() - inicio,
      };
    }

    const ultNSUInicial = controle.ultimoNsuProcessado;
    let ultNSU = ultNSUInicial;
    let maxNSU = controle.maxNsuConhecido;
    let docsAcum: ResultadoConsultaFilial['documentosResumo'] = [];
    let docsPersistidos = 0;
    let docsDuplicados = 0;
    let cStatUltimo: string | undefined;
    let xMotivoUltimo: string | undefined;
    let motivoStop: string | undefined;
    let status: ResultadoConsultaFilial['status'] = 'OK';
    let i = 0;

    // Abre lote pra auditoria histórica
    const loteAtual = await this.lote.abrir({
      cnpjConsulente: cnpj,
      ambiente: ambienteInt,
      ultNsuInicial: ultNSUInicial,
      origem: opts.origem ?? 'manual',
      dryRun,
    });

    // 2. Loop principal
    for (i = 0; i < MAX_ITERACOES; i++) {
      try {
        await this.limiteDiario.checkAndIncrement();
      } catch (err) {
        if (err instanceof LimiteDiarioAtingidoException) {
          status = 'LIMITE_ATINGIDO';
          motivoStop = `Limite diário SEFAZ atingido na iteração ${i}`;
          this.logger.warn(`[CTeDist] ${motivoStop}`);
          break;
        }
        throw err;
      }

      let resp;
      try {
        resp = await this.client.consultarPorNsu({
          cnpj,
          cUFAutor,
          ultNSU,
          ambiente: ambienteStr,
        });
      } catch (err) {
        if (err instanceof SefazConsultaError) {
          cStatUltimo = err.cStat;
          xMotivoUltimo = err.xMotivo;
          this.logger.error(
            `[CTeDist] SEFAZ erro cStat=${err.cStat} xMotivo="${err.xMotivo}" iter=${i}`,
          );

          // 656 = consumo indevido → bloqueia 1h
          if (err.cStat === '656') {
            await this.nsuControle.bloquearPor1Hora({
              cnpj,
              ambiente: ambienteInt,
              motivo: `cStat 656: ${err.xMotivo}`,
            });
            status = 'CIRCUIT_BREAK';
            motivoStop = `cStat 656 — CNPJ bloqueado por 1h`;
          } else {
            status = 'ERRO_SEFAZ';
            motivoStop = `cStat ${err.cStat}: ${err.xMotivo}`;
          }
          break;
        }
        throw err;
      }

      cStatUltimo = resp.cStat;
      xMotivoUltimo = resp.xMotivo;
      ultNSU = resp.ultNSU;
      maxNSU = resp.maxNSU;

      this.logger.log(
        `[CTeDist] iter=${i} cStat=${resp.cStat} ultNSU=${resp.ultNSU} maxNSU=${resp.maxNSU} docs=${resp.docZips.length}`,
      );

      // Persistência: dryRun apenas loga; modo normal grava em cte_documento.
      for (const dz of resp.docZips) {
        let novo = false;
        if (dryRun) {
          this.logger.debug(
            `[CTeDist] dry-run: docZip NSU=${dz.nsu} schema=${dz.schema} bytes=${dz.xml.length} preview="${dz.xml.substring(0, 200).replace(/\s+/g, ' ')}..."`,
          );
        } else {
          try {
            const r = await this.documento.persistir({
              cnpjConsulente: cnpj,
              ambiente: ambienteInt,
              docZip: dz,
            });
            novo = r.novo;
            if (r.novo) docsPersistidos++; else docsDuplicados++;
          } catch (err) {
            this.logger.error(
              `[CTeDist] falha persistir doc nsu=${dz.nsu}: ${(err as Error).message}`,
            );
            // Não aborta o loop — segue capturando os outros docs do bloco.
          }
        }
        docsAcum.push({ nsu: dz.nsu, schema: dz.schema, tamanhoXml: dz.xml.length, novo });
      }

      // cStat 137 = sem docs no bloco; cursor segue mas geralmente é fim
      // (SEFAZ retorna ultNSU avançado). Continua iterando até atingir maxNSU.
      // cStat 138 = veio doc(s); avança cursor.

      // Critério de parada: cursor alcançou max (incluso) ou SEFAZ não avançou
      if (resp.ultNSU === resp.maxNSU || resp.ultNSU === ultNSUInicial && i > 0) {
        motivoStop = `ultNSU(${resp.ultNSU}) == maxNSU(${resp.maxNSU})`;
        break;
      }
    }

    if (i === MAX_ITERACOES) {
      motivoStop = `MAX_ITERACOES (${MAX_ITERACOES}) atingido — possivel runaway`;
      this.logger.warn(`[CTeDist] ${motivoStop} cnpj=${cnpj}`);
    }

    // 3. Atualizar cursor mesmo em erro parcial (preserva progresso) e calcular
    //    proxima_consulta com adaptive backoff (Aprendizado Fase 1: SEFAZ retorna
    //    cStat=656 se chamada logo após `ultNSU == maxNSU`).
    //    - Synced (ultNSU == maxNSU)  → 60min
    //    - Com trabalho restante       → 15min
    if (status === 'OK' || status === 'LIMITE_ATINGIDO') {
      try {
        const synced = ultNSU === maxNSU;
        const proximaConsulta = new Date(Date.now() + (synced ? 60 : 15) * 60_000);
        await this.nsuControle.atualizarCursor({
          cnpj,
          ambiente: ambienteInt,
          ultNSU,
          maxNSU,
          proximaConsulta,
        });
        this.logger.log(
          `[CTeDist] cursor atualizado cnpj=${cnpj} ultNSU=${ultNSU} maxNSU=${maxNSU} synced=${synced} proxima=${proximaConsulta.toISOString()}`,
        );
      } catch (err) {
        this.logger.error(
          `[CTeDist] falha ao atualizar cursor cnpj=${cnpj}: ${(err as Error).message}`,
        );
      }
    }

    // Fecha lote (auditoria)
    const duracaoMs = Date.now() - inicio;
    try {
      await this.lote.fechar({
        loteId: loteAtual.id,
        iteracoes: i,
        ultNsuFinal: ultNSU,
        maxNsuFinal: maxNSU,
        docsPersistidos,
        docsDuplicados,
        status,
        cStatUltimo,
        xMotivoUltimo,
        motivoStop,
        duracaoMs,
      });
    } catch (err) {
      this.logger.error(`[CTeDist] falha fechar lote ${loteAtual.id}: ${(err as Error).message}`);
    }

    return {
      cnpj,
      ambiente: ambienteStr,
      iteracoes: i,
      ultNSUInicial,
      ultNSUFinal: ultNSU,
      maxNSU,
      docsRecebidos: docsAcum.length,
      docsPersistidos,
      docsDuplicados,
      loteId: loteAtual.id,
      status,
      cStatUltimo,
      xMotivoUltimo,
      motivoStop,
      documentosResumo: docsAcum,
      dryRun,
      duracaoMs,
    };
  }
}
