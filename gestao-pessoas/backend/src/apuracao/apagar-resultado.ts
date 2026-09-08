/**
 * ⭐⭐ APAGAR O RESULTADO DE UMA AVALIAÇÃO — num lugar só.
 *
 * `ResultadoCriterio` **não tem `onDelete: Cascade`**: apagar o resultado sem
 * apagar a memória de cálculo antes deixa linha órfã, e apagar na ordem errada
 * quebra a FK. A sequência certa é uma e é curta — e por isso mesmo é o tipo de
 * coisa que a segunda cópia escreve ao contrário.
 *
 * Dois chamadores, com intenções diferentes:
 *   - **reapuração** — apaga para gravar de novo, na mesma transação;
 *   - **reabertura da avaliação** — apaga porque o resultado deixou de valer: a
 *     nota é do ENVIO, e o envio foi desfeito.
 *
 * ⚠️ Devolve **o que foi apagado**, não `void`. Quem reabre precisa disso para
 * a auditoria: resultado apagado sem a nota registrada some sem rastro, e a
 * pergunta "por que a média mudou" fica sem resposta.
 */

/** O mínimo do Prisma que esta função usa — para caber em `tx` e em `prisma`. */
interface ClienteResultado {
  resultadoAvaliacao: {
    findUnique(args: {
      where: { avaliacaoId: string };
      select: Record<string, boolean>;
    }): Promise<Record<string, unknown> | null>;
    delete(args: { where: { id: string } }): Promise<unknown>;
  };
  resultadoCriterio: {
    deleteMany(args: { where: { resultadoId: string } }): Promise<unknown>;
  };
}

export interface ResultadoApagado {
  id: string;
  notaFinal: string;
  conceitoDescricao: string | null;
  /** `calculadoEm` do registro — a data em que aquela nota foi apurada. */
  calculadoEm: Date | null;
}

/**
 * Apaga o resultado da avaliação, com a memória de cálculo, e devolve o que
 * havia. `null` quando não havia resultado — que é o caso normal de quem reabre
 * antes de qualquer apuração.
 */
export async function apagarResultadoDe(
  tx: ClienteResultado,
  avaliacaoId: string,
): Promise<ResultadoApagado | null> {
  const anterior = (await tx.resultadoAvaliacao.findUnique({
    where: { avaliacaoId },
    select: { id: true, notaFinal: true, conceitoDescricao: true, calculadoEm: true },
  })) as { id: string; notaFinal: unknown; conceitoDescricao: string | null; calculadoEm: Date | null } | null;
  if (!anterior) return null;

  // A ORDEM importa: a memória de cálculo sai primeiro, senão a FK barra.
  await tx.resultadoCriterio.deleteMany({ where: { resultadoId: anterior.id } });
  await tx.resultadoAvaliacao.delete({ where: { id: anterior.id } });

  return {
    id: anterior.id,
    notaFinal: String(anterior.notaFinal),
    conceitoDescricao: anterior.conceitoDescricao,
    calculadoEm: anterior.calculadoEm,
  };
}
