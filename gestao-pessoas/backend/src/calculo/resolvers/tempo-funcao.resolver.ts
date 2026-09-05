import type { ContextoCiclo, DadosColaborador, ValorCriterio } from './resolver.types.js';
import { anosEntre } from './resolver.types.js';

/**
 * TEMPO NA FUNÇÃO — anos entre `dataUltimaFuncao` e a `dataBase` do ciclo.
 *
 * A data vem pronta do sync, calculada por `sincronizacao/data-ultima-funcao.ts`
 * — que é onde mora a regra difícil (dissídio anual não é troca de função) e o
 * porquê dela. Aqui é só a subtração.
 *
 * Como o sync garante a decisão C9 (sem histórico → data de admissão), a data
 * nunca é nula. Nula aqui é defeito de sincronização, e falha alto pelo mesmo
 * motivo do TEMPO_EMPRESA.
 */
export function tempoFuncao(colaborador: DadosColaborador, ciclo: ContextoCiclo): ValorCriterio {
  const desde = colaborador.dataUltimaFuncao;
  if (!desde) {
    throw new Error(
      'TEMPO_FUNCAO: colaborador sem dataUltimaFuncao — o sync deveria ter usado a admissão (C9).',
    );
  }
  return { valorNumerico: anosEntre(desde, ciclo.dataBase), valorTexto: null, semDado: false };
}
