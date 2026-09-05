import type { ContextoCiclo, DadosColaborador, ValorCriterio } from './resolver.types.js';
import { recuarMeses } from './resolver.types.js';

/**
 * QUANTIDADE DE TREINAMENTOS — conta os concluídos na janela do ciclo.
 *
 * Janela: de `dataBase - janelaTreinamentoMeses` até `dataBase`, **inclusive nas
 * duas pontas**, comparada como data (AAAAMMDD ordena como calendário).
 *
 * ⚠️ **Zero é valor legítimo, não ausência** — por isso nunca devolve `semDado`.
 * Quem não fez curso fica na faixa mínima, e é essa a intenção do critério.
 *
 * ⚠️ Contexto de 05/09/2026: o registro de treinamento no Protheus PAROU (896
 * pessoas em 2023, 817 em 2024, 34 em 2025, nada após 14/11/2025 — queda geral,
 * em todas as filiais). Com a janela de 12 meses, 6 pessoas de 1.036 pontuariam.
 * Enquanto isso não se esclarece com o RH, os grupos deste critério estão com
 * **peso 0** no seed: zero por falta de registro não é o mesmo que zero por
 * falta de curso, e o modelo não distingue os dois. Ver
 * docs/DECISAO_RH_ESCOLARIDADE.md §4.
 *
 * Treinamento sem `dataFim` (em andamento) não conta: o critério é sobre
 * concluídos.
 */
export function qtdeTreinamento(colaborador: DadosColaborador, ciclo: ContextoCiclo): ValorCriterio {
  const inicio = recuarMeses(ciclo.dataBase, ciclo.janelaTreinamentoMeses);
  const quantidade = colaborador.treinamentosConcluidos.filter(
    (fim) => !!fim && fim >= inicio && fim <= ciclo.dataBase,
  ).length;
  return { valorNumerico: quantidade, valorTexto: null, semDado: false };
}
