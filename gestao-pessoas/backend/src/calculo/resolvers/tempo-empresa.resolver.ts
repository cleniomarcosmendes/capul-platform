import type { ContextoCiclo, DadosColaborador, ValorCriterio } from './resolver.types.js';
import { anosEntre } from './resolver.types.js';

/**
 * TEMPO DE EMPRESA — anos entre a admissão e a `dataBase` do ciclo.
 *
 * **Nunca produz `semDado`** (§4.2). Admissão ausente não é lacuna cadastral: é
 * erro de sincronização, e o sync recusa a linha antes de chegar aqui. Se
 * chegar assim mesmo, falha alto — devolver zero calado colocaria a pessoa na
 * pior faixa por um defeito nosso.
 *
 * A transferência entre filiais preserva `RA_ADMISSA` (conferido no Protheus:
 * as sete linhas da matrícula 001174 têm a mesma admissão de 2000), então quem
 * mudou de unidade não perde tempo de casa.
 */
export function tempoEmpresa(colaborador: DadosColaborador, ciclo: ContextoCiclo): ValorCriterio {
  if (!colaborador.dataAdmissao) {
    throw new Error('TEMPO_EMPRESA: colaborador sem data de admissão — erro de sincronização.');
  }
  return {
    valorNumerico: anosEntre(colaborador.dataAdmissao, ciclo.dataBase),
    valorTexto: null,
    semDado: false,
  };
}
