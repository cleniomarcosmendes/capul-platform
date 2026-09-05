import type { DadosColaborador, ValorCriterio } from './resolver.types.js';

/**
 * ESCOLARIDADE — faixa de DOMÍNIO sobre `RA_GRINRAI` (SX5 tabela 26).
 *
 * O valor bruto é o CÓDIGO, não a descrição: o texto do SX5 é reescrito sem o
 * código mudar. As 13 chaves do domínio e a pontuação de cada uma são cadastro
 * (`rh.criterio_faixa`), não código — ver docs/DECISAO_RH_ESCOLARIDADE.md.
 *
 * Ausência de código = `semDado` → o grupo sai da conta e a nota é
 * renormalizada (§4.3). Hoje não há ninguém nessa situação (0 de 1.036), mas a
 * tela de pendências cadastrais (§5.4) existe para quando houver.
 */
export function escolaridade(colaborador: DadosColaborador): ValorCriterio {
  const codigo = (colaborador.grauInstrucaoCodigo ?? '').trim();
  return codigo
    ? { valorNumerico: null, valorTexto: codigo, semDado: false }
    : { valorNumerico: null, valorTexto: null, semDado: true };
}
