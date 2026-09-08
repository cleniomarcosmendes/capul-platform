/**
 * ⭐⭐ O DENOMINADOR DO CICLO — cancelada NÃO conta, e num lugar só.
 *
 * Achado do ciclo de simulação (09/09): **três telas, três números** para a
 * mesma pergunta. O cabeçalho e o card da lista diziam `0 de 52 enviadas`; o
 * cartão da aplicação separava *"29 não iniciadas / 2 canceladas"*; a prévia da
 * abertura dizia `50`. Nenhum estava mentindo sozinho — cada um tinha o seu
 * `where`, e dois deles esqueceram a cancelada.
 *
 * ⚠️ **O certo é 50**, e não é preferência: o próprio diálogo de exclusão
 * promete que a cancelada *"deixa de travar o encerramento do ciclo"*, o
 * encerramento de fato a ignora, e `filaPorAvaliador` já a tirava da conta com
 * a razão escrita (*"não é trabalho de ninguém, e somá-la faria a fila de quem
 * não deve nada parecer cheia"*). Contá-la no denominador quebrava a promessa
 * de um jeito que só aparece no fim: **o ciclo nunca chega a 100%**, e quem
 * olha o painel vê pendência onde não há.
 *
 * ⚠️ Por que uma constante e não `status: { not: 'CANCELADA' }` escrito em cada
 * `where`: era exatamente assim que estava — cinco lugares certos, dois
 * esquecidos, e nada que apontasse os dois. Regra repetida N vezes envelhece
 * errada na cópia que ninguém está olhando. A oitava consulta que alguém
 * escrever usa isto e nasce certa.
 *
 * ⚠️ É `not: CANCELADA`, e não uma lista de status vivos, **de propósito**: um
 * status novo no enum deve entrar na conta por padrão. Uma allowlist o deixaria
 * de fora em silêncio, que é o defeito de novo, só que ao contrário.
 */
import { Prisma } from '@prisma/client';

/** Fragmento de `where` para o Prisma: `{ ...ONDE_A_AVALIACAO_CONTA }`. */
export const ONDE_A_AVALIACAO_CONTA = {
  status: { not: 'CANCELADA' },
} satisfies Pick<Prisma.AvaliacaoWhereInput, 'status'>;

/**
 * A mesma regra para contagem EM MEMÓRIA — quando as linhas já vieram do banco
 * agrupadas por status e filtrar de novo custaria uma consulta.
 */
export function avaliacaoConta(status: string): boolean {
  return status !== 'CANCELADA';
}

/** Soma `_count._all` das linhas que contam, a partir de um `groupBy` por status. */
export function somarQueContam(
  linhas: readonly { status: string; _count: { _all: number } }[],
): number {
  return linhas.filter((l) => avaliacaoConta(l.status)).reduce((t, l) => t + l._count._all, 0);
}
