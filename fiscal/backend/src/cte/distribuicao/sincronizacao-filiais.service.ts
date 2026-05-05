import { Injectable, Logger } from '@nestjs/common';
import { AmbienteService } from '../../ambiente/ambiente.service.js';
import { PapelDetectorService } from './papel-detector.service.js';
import { NsuControleService } from './nsu-controle.service.js';

export interface ResultadoSincronizacao {
  ambiente: 'PRODUCAO' | 'HOMOLOGACAO';
  cnpjsCacheados: number;
  cursoresCriados: number;
  cursoresReativados: number;
  cursoresInativados: number;
  duracaoMs: number;
}

/**
 * Mantém o módulo CT-e Distribuição em sincronia com `core.filiais`:
 *
 *   1. Recarrega cache de CNPJs Capul no `PapelDetectorService`
 *      (usado pelo enriquecimento pra detectar papel)
 *   2. Sincroniza cursores em `fiscal.cte_controle_nsu`:
 *      - Filial nova ativa  → cria cursor (será varrida pelo scheduler)
 *      - Filial reativada    → re-ativa cursor existente
 *      - Filial inativada    → desativa cursor (scheduler para de varrer)
 *
 * Roda em 3 momentos:
 *   - Tick do `CteSchedulerService` (cada 15min) — sync passivo
 *   - Endpoint admin `POST /cte/distribuicao/recarregar-cnpjs-capul` — sync
 *     imediato pós cadastro de filial
 *   - Boot do backend — implícito via `OnApplicationBootstrap` do PapelDetector
 *     (cache populado, mas sync de cursor só no primeiro tick — aceitável)
 *
 * Não consome SEFAZ (só DB), por isso roda mesmo com `FISCAL_CTE_DISTRIBUICAO_ENABLED=false`
 * ou `pause_sync=true`. É higiene de cadastro, não consulta.
 */
@Injectable()
export class SincronizacaoFiliaisService {
  private readonly logger = new Logger(SincronizacaoFiliaisService.name);

  constructor(
    private readonly papelDetector: PapelDetectorService,
    private readonly nsuControle: NsuControleService,
    private readonly ambiente: AmbienteService,
  ) {}

  async sincronizar(): Promise<ResultadoSincronizacao> {
    const inicio = Date.now();
    // Usa o ambiente do CT-e (independente do global) — sincroniza cursores
    // só pro ambiente onde o serviço está apontando.
    const cfgCte = await this.ambiente.getCteDistribuicaoConfig();
    const ambienteStr: 'PRODUCAO' | 'HOMOLOGACAO' = cfgCte.ambiente;
    const ambienteInt: 1 | 2 = ambienteStr === 'PRODUCAO' ? 1 : 2;

    // 1. Cache CNPJs Capul (usado pelo PapelDetector durante enriquecimento)
    const { total: cnpjsCacheados, cnpjs } = await this.papelDetector.atualizarCacheCnpjs();

    // 2. Cursores em cte_controle_nsu (criação/reativação/inativação)
    const resultado = await this.nsuControle.sincronizarComFiliais(cnpjs, ambienteInt);

    const duracaoMs = Date.now() - inicio;

    // Log estruturado só quando alguma coisa mudou — evita poluir log com 0+0+0 a cada 15min
    if (resultado.criados > 0 || resultado.reativados > 0 || resultado.inativados > 0) {
      this.logger.log(
        `Sincronização filiais: ambiente=${ambienteStr} cache=${cnpjsCacheados} criados=${resultado.criados} reativados=${resultado.reativados} inativados=${resultado.inativados} ${duracaoMs}ms`,
      );
    }

    return {
      ambiente: ambienteStr,
      cnpjsCacheados,
      cursoresCriados: resultado.criados,
      cursoresReativados: resultado.reativados,
      cursoresInativados: resultado.inativados,
      duracaoMs,
    };
  }
}
