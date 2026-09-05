/**
 * VALIDAÇÃO DO CRITÉRIO CALCULADO — uma função, chamada em TRÊS momentos.
 *
 * O vínculo entre a linha que o RH administra (`rh.criterio`) e o código que
 * calcula (`calculo/resolvers/registry.ts`) é uma STRING, `codigoCalculo`. String
 * errada não quebra nada: o critério devolve vazio, em silêncio, para todos os
 * avaliados. O critério sai da apuração pela renormalização e a nota final de
 * todo mundo muda sem um erro sequer.
 *
 * ── Onde validar: nos três, e o mais cedo possível ──────────────────────────
 *   1. **ao salvar o critério no catálogo** — o mais barato, e o único que fala
 *      com quem cometeu o erro, na hora em que cometeu;
 *   2. **ao montar a Aplicação** — o critério pode ter sido salvo antes de o
 *      resolver existir, ou o resolver pode ter sido removido num deploy;
 *   3. **na abertura do ciclo** — última porta antes de gerar nota.
 *
 * Validar só no fim significaria o RH cadastrar, achar que está certo e
 * descobrir semanas depois sem entender por quê. Os três chamam esta mesma
 * função — regra duplicada envelhece errada.
 */
import { codigosRegistrados, resolverRegistrado } from '../calculo/resolvers/registry.js';

export type OrigemValorCriterio = 'CALCULADO' | 'INFORMADO';

/** O recorte de `rh.criterio` que a validação enxerga. */
export interface CriterioValidavel {
  codigo: string;
  nome: string;
  origem: OrigemValorCriterio;
  codigoCalculo?: string | null;
  ativo: boolean;
}

export class CriterioInvalidoError extends Error {
  constructor(readonly problemas: string[]) {
    super(problemas.join('\n- '));
    this.name = 'CriterioInvalidoError';
  }
}

/**
 * Problemas do critério — lista vazia quando está coerente.
 * `exigirAtivo` só é ligado nos momentos 2 e 3: no catálogo, salvar um critério
 * desativado é legítimo (é justamente como se guarda um critério fora de uso).
 */
export function validarCriterio(
  criterio: CriterioValidavel,
  opcoes: { exigirAtivo?: boolean; onde?: string } = {},
): string[] {
  const problemas: string[] = [];
  const onde = opcoes.onde ? `${opcoes.onde}: ` : '';
  const rotulo = `${onde}critério "${criterio.nome}" (${criterio.codigo})`;
  const disponiveis = codigosRegistrados().join(', ');

  if (opcoes.exigirAtivo && !criterio.ativo) {
    problemas.push(`${rotulo} está INATIVO no catálogo e não pode ser usado.`);
  }

  if (criterio.origem === 'CALCULADO') {
    const codigo = (criterio.codigoCalculo ?? '').trim();
    if (!codigo) {
      problemas.push(
        `${rotulo} é CALCULADO e está sem código de cálculo. Códigos disponíveis: ${disponiveis}.`,
      );
    } else if (!resolverRegistrado(codigo)) {
      problemas.push(
        `${rotulo} aponta para o código de cálculo "${codigo}", que não existe no sistema. ` +
          `Sem isso o critério ficaria em branco para todos os avaliados, sem acusar erro. ` +
          `Códigos disponíveis: ${disponiveis}.`,
      );
    }
  } else if ((criterio.codigoCalculo ?? '').trim()) {
    // INFORMADO com codigoCalculo preenchido: sobra de quem trocou a origem
    // depois de cadastrar. O valor viria da importação e o código seria
    // ignorado — melhor recusar do que fingir que os dois valem.
    problemas.push(
      `${rotulo} é INFORMADO (valor importado ou digitado) mas tem código de cálculo ` +
        `"${criterio.codigoCalculo}". Limpe o código de cálculo ou mude a origem para CALCULADO.`,
    );
  }

  return problemas;
}

/** Momento 1 — ao salvar no catálogo. Fala com quem acabou de errar. */
export function assertCriterioSalvavel(criterio: CriterioValidavel): void {
  const problemas = validarCriterio(criterio, { onde: 'Cadastro do critério' });
  if (problemas.length) throw new CriterioInvalidoError(problemas);
}

/** Momentos 2 e 3 — montagem da Aplicação e abertura do ciclo. Exige ativo. */
export function validarCriterioEmUso(criterio: CriterioValidavel, onde: string): string[] {
  return validarCriterio(criterio, { exigirAtivo: true, onde });
}
