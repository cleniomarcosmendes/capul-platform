/**
 * O que IMPEDE encerrar uma rota de entrega.
 *
 * Antes isto se chamava `avisosEncerramento` e era só conversa: o encerramento
 * marcava toda entrega ainda EM_VIAGEM como ENTREGUE, a tela avisava
 * ("sem comprovante") e **deixava passar**. Desde 09/08 o servidor recusa
 * (`viagem.service.ts` — `concluir`): encerrar exige KM de saída, KM de retorno
 * e TODAS as paradas resolvidas (baixadas ou recusadas).
 *
 * Então o que a tela precisa saber não é "o que avisar antes de deixar", é
 * **por que ainda não dá** — e é a mesma lista que desabilita o botão e explica
 * o motivo. Uma fonte só para as duas coisas: enquanto isto devolver algo, o
 * botão de encerrar fica travado.
 *
 * Função PURA (o runner de testes do app só cobre estas) — a tela não decide
 * nada por conta própria.
 */
export interface EstadoEncerramento {
  /** Entregas ainda EM_VIAGEM: cada uma precisa de baixa ou recusa. */
  pendentes: number;
  /** KM de saída da rota; null = nunca registrado. */
  kmInicial: number | null;
}

export function impedimentosEncerramento({ pendentes, kmInicial }: EstadoEncerramento): string[] {
  const impedimentos: string[] = [];

  // O KM de saída vem primeiro porque é o começo da rota: sem ele nem baixa há,
  // então listá-lo depois das pendências inverteria a ordem do trabalho.
  if (kmInicial == null) {
    impedimentos.push('Registre o KM de saída desta rota antes de encerrar.');
  }
  if (pendentes > 0) {
    const p = pendentes === 1;
    impedimentos.push(
      `Falta${p ? '' : 'm'} ${pendentes} entrega${p ? '' : 's'} — ` +
      `dê baixa ou recuse cada uma para encerrar a rota.`,
    );
  }
  return impedimentos;
}
