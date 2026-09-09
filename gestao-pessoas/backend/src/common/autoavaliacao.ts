/**
 * ⭐ NINGUÉM É O AVALIADOR DA PRÓPRIA AVALIAÇÃO — a regra, escrita uma vez.
 *
 * Dois caminhos chegam a esta pergunta e são caminhos diferentes: a designação
 * DO CICLO (`designacao/efeito-de-designar.ts`, o classificador que a prévia e o
 * ato compartilham) e a designação PADRÃO (`designacao-padrao`, o avaliador
 * default de cada colaborador, que a importação e o `designar()` manual
 * escrevem). Cada um recusava com a sua cópia da frase, e o classificador do
 * ciclo até avisava em comentário — *"por isso não se re-implementa esta
 * checagem"* — enquanto a segunda cópia, em outro módulo, era exatamente a
 * re-implementação. Extrair é barato; descobrir por que uma tela recusa com uma
 * frase e a outra com outra, não.
 *
 * ⚠️ Não é a mesma pergunta que `avaliacao/separacao-funcoes.ts`. Lá se compara
 * **quem está logado** com o avaliado (separação de funções, ato de leitura ou
 * escrita já designado); aqui se comparam **dois terceiros** — quem vai avaliar
 * e quem vai ser avaliado —, e quem pergunta é o RH montando o ciclo. Mesma
 * forma, perguntas distintas: não unifique as duas em uma função só.
 *
 * ⚠️ Também não é o filtro de `designacao-padrao/distribuicao.ts` ("o
 * responsável não entra na própria lista"): lá se tira N responsáveis de M
 * alvos, antes de existir par nenhum. Mesma intenção, outra operação.
 */

/** Texto único: prévia, ato do ciclo e designação padrão dizem a MESMA coisa. */
export const FRASE_AUTOAVALIACAO = 'Ninguém pode ser o avaliador da própria avaliação.';

/**
 * `true` só quando os dois ids existem e são o mesmo.
 *
 * ⚠️ Ids ausentes devolvem `false` — de propósito, pelo mesmo motivo de
 * `ehProprioAvaliado`: `undefined === undefined` é `true` e faria a recusa
 * disparar sobre um par que nem foi resolvido, com uma frase que acusa o RH de
 * algo que ele não fez. Requisição sem id é recusada antes, por "colaborador
 * não encontrado", que é a mensagem verdadeira.
 */
export function ehAutoavaliacao(
  avaliadoId: string | null | undefined,
  avaliadorId: string | null | undefined,
): boolean {
  if (!avaliadoId || !avaliadorId) return false;
  return avaliadoId === avaliadorId;
}
