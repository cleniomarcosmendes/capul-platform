import type { ContextoCiclo, DadosColaborador, ValorCriterio } from './resolver.types.js';
import { anosEntre } from './resolver.types.js';
import { resolverDataUltimaFuncao } from '../../sincronizacao/data-ultima-funcao.js';

/**
 * TEMPO NA FUNÇÃO — anos entre a última TROCA de função e a `dataBase` do ciclo.
 *
 * A regra difícil (dissídio anual não é troca de função) e o porquê dela moram
 * em `sincronizacao/data-ultima-funcao.ts`. Aqui é o recorte e a subtração.
 *
 * ⭐ RECORTE PELA DATA-BASE. Fato posterior ao ciclo não pode influenciar a nota
 * daquele ciclo — senão reapurar um ciclo antigo dá resultado diferente conforme
 * o tempo passa, que é o `current_date` de volta com outra roupa. Medido no
 * Protheus: o ciclo de 2025, reapurado hoje, enxerga lançamentos de 2026 e chega
 * a produzir tempo NEGATIVO.
 *
 * Dois caminhos, nessa ordem:
 *
 *   1. **Com `historicoFuncao`** (o certo): recalcula a data ignorando tudo que
 *      é posterior à `dataBase`. Vale para qualquer ciclo, apurado quando for.
 *
 *   2. **Só com `dataUltimaFuncao`** (valor corrente gravado pelo sync): serve
 *      enquanto a data for anterior à `dataBase`. Se for POSTERIOR, a data
 *      descreve um fato que o ciclo não pode conhecer, e o histórico não está
 *      aqui para dizer qual era a anterior — então devolve `semDado`, o critério
 *      sai da conta e o RH recebe alerta. Inventar um número (a admissão, por
 *      exemplo) seria pior: exageraria o tempo de função em silêncio.
 */
export function tempoFuncao(colaborador: DadosColaborador, ciclo: ContextoCiclo): ValorCriterio {
  const desde = colaborador.historicoFuncao
    ? resolverDataUltimaFuncao(colaborador.historicoFuncao, colaborador.dataAdmissao, {
        ate: ciclo.dataBase,
      }).data
    : colaborador.dataUltimaFuncao;

  if (!desde) {
    throw new Error(
      'TEMPO_FUNCAO: colaborador sem dataUltimaFuncao — o sync deveria ter usado a admissão (C9).',
    );
  }

  if (desde > ciclo.dataBase) {
    // Sem histórico e com data posterior ao ciclo: não há resposta honesta.
    return { valorNumerico: null, valorTexto: null, semDado: true };
  }

  return { valorNumerico: anosEntre(desde, ciclo.dataBase), valorTexto: null, semDado: false };
}
