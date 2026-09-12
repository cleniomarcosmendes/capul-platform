/**
 * ⭐⭐ O MESMO NÚMERO, DUAS LEITURAS OPOSTAS.
 *
 * Quem está fora de TODAS as aplicações é **buraco** num ciclo da empresa
 * inteira e **alcance declarado** num piloto. A diferença não está no dado —
 * está na intenção de quem montou o ciclo.
 *
 * ⚠️ É por isso que a intenção é uma COLUNA (`ciclo.ehRecorte`) e não uma
 * inferência: derivar "é recorte" do tamanho do público (< X% dos elegíveis)
 * obriga a inventar um limiar, e **limiar arbitrário erra calado** — o ciclo de
 * 49% vira recorte e o de 51% vira ciclo da empresa, sem ninguém ter decidido.
 *
 * ⚠️ Sem isso o painel do `ENSAIO PILOTO` mostrava em VERMELHO, com "monte o
 * público que falta", a decisão de recortar 16 centros de custo. Aviso que pede
 * para desfazer uma decisão treina quem lê a ignorar — e junto com ele some o
 * vermelho que era de verdade.
 *
 * Função pura, no idioma do módulo: a tela lê para pintar, o spec lê para
 * cobrar. Uma fonte só para as duas frases.
 */
export interface LeituraDoAlcance {
  /** `pendencia` pinta de vermelho e pede ação; `informacao` é neutro. */
  tom: 'pendencia' | 'informacao';
  titulo: string;
  explicacao: string;
  /** Rótulo do botão que declara o alcance — sempre o ato OPOSTO ao atual. */
  rotuloDoBotao: string;
}

export function leituraDoAlcance(entrada: {
  total: number;
  ehRecorte: boolean;
  /** Ciclo encerrado muda o que se PODE fazer, nunca se o número é pendência. */
  cicloFechado: boolean;
  /** Já flexionado por quem chama — "3 pessoas" / "1 pessoa". */
  contagem: string;
}): LeituraDoAlcance {
  const { ehRecorte, cicloFechado, contagem } = entrada;

  if (ehRecorte) {
    return {
      tom: 'informacao',
      titulo: `${contagem} fora do recorte.`,
      explicacao:
        'Este ciclo alcança só parte da empresa, por decisão de quem o montou — estas pessoas ' +
        'não são pendência dele.',
      rotuloDoBotao: 'Este ciclo deveria alcançar a empresa inteira',
    };
  }

  return {
    tom: 'pendencia',
    titulo: `${contagem} fora de TODAS as aplicações deste ciclo.`,
    explicacao:
      'Elegíveis que não entraram em público nenhum — não aparecem sequer como "sem avaliador", ' +
      'porque essa conta é por aplicação. ' +
      /**
       * ⚠️ Instrução que não cabe no estado: num ciclo encerrado, "monte o
       * público" manda a pessoa a uma tela onde o botão está desabilitado. O
       * número continua verdadeiro e útil — o que muda é o que se pode fazer.
       */
      (cicloFechado
        ? 'O ciclo está encerrado — para incluí-las, reabra o ciclo primeiro.'
        : 'Monte o público que falta, em Aplicações.'),
    rotuloDoBotao: 'Este ciclo alcança só parte da empresa',
  };
}
