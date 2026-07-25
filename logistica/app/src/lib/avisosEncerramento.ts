/**
 * Avisos exibidos ANTES de encerrar uma rota de entrega.
 *
 * Encerrar é terminal e o backend marca toda entrega ainda EM_VIAGEM como
 * ENTREGUE (viagem.service.ts) — fabrica entrega sem prova. Antes isso
 * acontecia calado e virava o atalho para fechar a rota sem baixar ninguém.
 *
 * Função PURA (o runner de testes do app só cobre estas) — a tela só decide se
 * mostra o diálogo a partir do que vem daqui.
 */
export interface EstadoEncerramento {
  /** Entregas ainda EM_VIAGEM: viram ENTREGUE sem comprovante. */
  pendentes: number;
  /** KM de saída da rota; null = nunca registrado. */
  kmInicial: number | null;
}

export function avisosEncerramento({ pendentes, kmInicial }: EstadoEncerramento): string[] {
  const avisos: string[] = [];
  if (pendentes > 0) {
    const p = pendentes === 1;
    avisos.push(
      `${pendentes} entrega${p ? '' : 's'} ainda pendente${p ? '' : 's'} ` +
      `${p ? 'será marcada' : 'serão marcadas'} como ENTREGUE sem comprovante.`,
    );
  }
  // Aviso, NÃO bloqueio: no fim da rota o painel já mostra o KM de chegada, então
  // exigir a saída agora só produziria número inventado — pior que a lacuna, que
  // o gestor enxerga na tela de Pendências de KM.
  if (kmInicial == null) {
    avisos.push('Esta rota não teve KM de saída registrado — o KM rodado não será calculado.');
  }
  return avisos;
}
