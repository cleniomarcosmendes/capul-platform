import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AmbienteService } from '../../ambiente/ambiente.service.js';
import { NsuControleService } from './nsu-controle.service.js';
import { DistribuicaoNsuService } from './distribuicao-nsu.service.js';
import { CteEnriquecimentoService } from './cte-enriquecimento.service.js';
import { SincronizacaoFiliaisService } from './sincronizacao-filiais.service.js';

/**
 * Scheduler do CT-e Distribuição — varre filiais ativas a cada 15min e
 * dispara `consultarFilial` pra aquelas com `proximaConsulta` vencida.
 *
 * **Adaptive backoff** (aprendizado da Fase 1): SEFAZ retorna cStat=656 se
 * cliente re-consulta logo após `ultNSU == maxNSU`. O orquestrador
 * (`DistribuicaoNsuService`) já calcula `proximaConsulta`:
 *   - Synced (ultNSU == maxNSU)  → +60min
 *   - Com trabalho restante       → +15min
 * Aqui só obedecemos esse cursor — `listarElegiveisParaConsulta` filtra.
 *
 * **Defesas em camada:**
 *   1. Cron tick a cada 15min (não controlamos isso direto)
 *   2. `proximaConsulta` na DB filtra quem realmente roda
 *   3. `bloqueadoAte` filtra CNPJ em CIRCUIT_BREAK (cStat 656 anterior)
 *   4. `feature flag FISCAL_CTE_DISTRIBUICAO_ENABLED` bloqueia em PROD se false
 *   5. Pause global do AmbienteService (`pause_sync`) bloqueia tudo
 *
 * Não dispara em paralelo: filiais elegíveis processadas sequencialmente
 * (Promise.all se vier muita filial → racing limit SEFAZ). Espaçamento
 * de 2s entre filiais.
 */
@Injectable()
export class CteSchedulerService {
  private readonly logger = new Logger(CteSchedulerService.name);

  constructor(
    private readonly ambiente: AmbienteService,
    private readonly nsuControle: NsuControleService,
    private readonly distribuicao: DistribuicaoNsuService,
    private readonly enriquecimento: CteEnriquecimentoService,
    private readonly sincronizacao: SincronizacaoFiliaisService,
  ) {}

  @Cron('0 */15 * * * *', { name: 'fiscal:cte-distribuicao' })
  async tick(): Promise<void> {
    // Sincronização de filiais Capul roda SEMPRE (mesmo com flag off ou
    // pause_sync) — não consome SEFAZ, só DB. Garante que cadastro de
    // filial nova é detectado em ≤15min sem ação manual.
    try {
      await this.sincronizacao.sincronizar();
    } catch (err) {
      this.logger.error(`[CTeScheduler] sync filiais falhou: ${(err as Error).message}`);
    }

    const cfgCte = await this.ambiente.getCteDistribuicaoConfig();
    if (!cfgCte.ativo) {
      // Silencioso — operador desativou na aba CT-e Distribuição do
      // Controle Operacional (ou nunca ativou — default false).
      return;
    }

    const cfgAmb = await this.ambiente.getStatus();
    if (cfgAmb.pauseSync) {
      this.logger.log(`[CTeScheduler] tick suprimido — ambiente_config.pause_sync=true (freio de mão global)`);
      return;
    }
    // Ambiente do CT-e é INDEPENDENTE do global (NF-e/Cadastro).
    const ambienteInt: 1 | 2 = cfgCte.ambiente === 'PRODUCAO' ? 1 : 2;

    const elegiveis = await this.nsuControle.listarElegiveisParaConsulta(ambienteInt);
    if (elegiveis.length === 0) {
      this.logger.debug(`[CTeScheduler] tick — nenhuma filial elegível em ${cfgAmb.ambienteAtivo}`);
      return;
    }

    this.logger.log(
      `[CTeScheduler] tick — ${elegiveis.length} filial(is) elegíveis em ${cfgAmb.ambienteAtivo}`,
    );

    for (const ctrl of elegiveis) {
      try {
        const resultado = await this.distribuicao.consultarFilial(ctrl.cnpj, {
          origem: 'cron',
        });
        this.logger.log(
          `[CTeScheduler] cnpj=${ctrl.cnpj} status=${resultado.status} iter=${resultado.iteracoes} docs+=${resultado.docsPersistidos} (${resultado.docsDuplicados} dedup) ${resultado.duracaoMs}ms`,
        );
      } catch (err) {
        this.logger.error(
          `[CTeScheduler] falha cnpj=${ctrl.cnpj}: ${(err as Error).message}`,
        );
      }
      // Espaçamento mínimo entre filiais — defesa contra burst SEFAZ
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  /**
   * Cron de enriquecimento — varre `cte_documento` com `processado_em IS NULL`
   * e popula `papel_capul` via PapelDetector.
   *
   * Roda a cada hora no minuto 30 — offset proposital do scheduler de varredura
   * SEFAZ (que roda nos minutos 0/15/30/45) pra evitar carga simultânea.
   *
   * Idempotente: registros já processados não são revisitados. Roda mesmo
   * sem feature flag — não toca SEFAZ, só processa o que já está no banco.
   */
  @Cron('0 30 * * * *', { name: 'fiscal:cte-enriquecimento' })
  async tickEnriquecimento(): Promise<void> {
    try {
      const r = await this.enriquecimento.processarPendentes();
      if (r.varridos > 0) {
        this.logger.log(
          `[CTeEnriquec] tick varridos=${r.varridos} enriq=${r.enriquecidos} anomalias=${r.comAnomalia} erros=${r.erros}`,
        );
      }
    } catch (err) {
      this.logger.error(`[CTeEnriquec] tick falhou: ${(err as Error).message}`);
    }
  }
}
