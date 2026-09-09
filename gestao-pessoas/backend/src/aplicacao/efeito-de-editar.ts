/**
 * ⭐⭐ O QUE DÁ PARA MUDAR NUMA APLICAÇÃO — e o que a mudança leva junto.
 *
 * Até 09/09/2026 a Aplicação era **imutável e indestrutível**: `criar` era o
 * único ato. Errar o modelo ou o peso significava criar outra e conviver com a
 * errada aparecendo no painel, no público e na contagem — e o erro acontece no
 * PRIMEIRO USO, antes de qualquer treino, que é exatamente o que o piloto é.
 *
 * ── O QUE MUDA, E QUANDO ────────────────────────────────────────────────────
 *   nome                → sempre (enquanto o ciclo aceitar escrita). É rótulo.
 *   pesoAvaliacao       → só em RASCUNHO. Depois de aberto, muda a NOTA de quem
 *                         já respondeu, sem reabrir avaliação nenhuma.
 *   critérios           → só em RASCUNHO, pelo mesmo motivo.
 *   modeloVersao        → ⛔ NUNCA. Ver abaixo.
 *
 * ── ⛔ POR QUE O MODELO NÃO TROCA, NEM EM RASCUNHO ──────────────────────────
 * Trocar o questionário de uma aplicação **com público montado** é a operação
 * mais perigosa que existiria aqui: as pessoas continuam lá, a tela continua
 * igual, e o que elas vão responder passa a ser outro instrumento — sem que
 * nada na tela mude de aparência. Se já houver avaliação, é pior: as respostas
 * pertencem às perguntas do modelo antigo e ficariam órfãs, com a nota saindo
 * errada sem acusar erro (é o mesmo raciocínio de `troca-de-aplicacao.ts`).
 *
 * ⚠️ E a saída existe e é honesta: **apagar e criar de novo**, enquanto não há
 * avaliação. Por isso a recusa DIZ isso — recusa sem alternativa faz a pessoa
 * procurar sozinha, e o que ela acha é criar uma segunda aplicação e deixar a
 * errada no ciclo.
 */

export interface AplicacaoParaEditar {
  cicloStatus: string;
  /**
   * ⭐⭐ DOIS NÚMEROS, e eles respondem perguntas DIFERENTES — o invariante das
   * contagens me obrigou a separá-los, e ele estava certo:
   *
   *   `avaliacoesQueContam` — as que valem (cancelada fora). É "já houve
   *     trabalho de avaliador nesta aplicação?", a pergunta do NEGÓCIO.
   *   `avaliacoesTotais` — TODAS, cancelada inclusive. É "existe linha em
   *     `rh.avaliacao` apontando para cá?", a pergunta do BANCO: a FK bloqueia
   *     o DELETE de qualquer jeito, e apagar em cascata apagaria a trilha de um
   *     cancelamento que tem motivo escrito e responde por que alguém ficou sem
   *     nota.
   *
   * Somar os dois num só esconderia justamente o caso que separa as duas
   * recusas: aplicação com avaliação **só cancelada**.
   */
  avaliacoesQueContam: number;
  avaliacoesTotais: number;
  /** Quantas pessoas estão no público dela. */
  publico: number;
}

export type CampoDaAplicacao = 'nome' | 'pesoAvaliacao' | 'criterios' | 'modeloVersaoId';

/**
 * `null` = pode mudar. Texto = não pode, e o texto diz por quê **e qual é a
 * saída** — é a frase que a tela mostra no `title` do campo desabilitado.
 */
export function motivoParaNaoEditar(
  campo: CampoDaAplicacao,
  aplicacao: AplicacaoParaEditar,
): string | null {
  if (campo === 'modeloVersaoId') {
    return (
      'O questionário de uma aplicação não muda depois de criada: o público já montado passaria ' +
      'a responder outro instrumento sem nada mudar na tela, e as respostas que existissem ' +
      'ficariam órfãs das perguntas antigas. ' +
      (aplicacao.avaliacoesTotais === 0
        ? 'Como esta aplicação ainda não gerou avaliação, apague-a e crie outra com o questionário certo.'
        : 'Esta aplicação já gerou avaliação, então nem apagar resolve — crie outra aplicação e mova o público.')
    );
  }

  if (campo === 'nome') return null;

  // peso e critérios: mudam a NOTA.
  if (aplicacao.cicloStatus !== 'RASCUNHO') {
    return (
      `O peso e os critérios só mudam com o ciclo em RASCUNHO — este está ${aplicacao.cicloStatus}. ` +
      'Mudar agora mudaria a nota de quem já respondeu, sem reabrir avaliação nenhuma e sem ' +
      'ninguém saber que o número mudou de significado.'
    );
  }
  return null;
}

export interface EfeitoDeApagar {
  podeApagar: boolean;
  /** Frase pronta — de confirmação quando dá, de recusa quando não dá. */
  frase: string;
  /** O que vai junto, para a confirmação dizer o NÚMERO e não "os dados". */
  publico: number;
  avaliacoes: number;
}

/**
 * ⭐⭐ O DIÁLOGO DIZ O QUE SE PERDE, com número.
 *
 * "Aplicação sem avaliação" não quer dizer "aplicação vazia": ela pode ter um
 * público de 32 pessoas montado a mão, centro de custo por centro de custo. Uma
 * confirmação que diz só "apagar esta aplicação?" esconde justamente o trabalho
 * que vai embora — e quem clica descobre depois.
 */
export function efeitoDeApagar(aplicacao: AplicacaoParaEditar): EfeitoDeApagar {
  const { publico, avaliacoesQueContam, avaliacoesTotais } = aplicacao;

  if (avaliacoesQueContam > 0) {
    return {
      podeApagar: false,
      publico,
      avaliacoes: avaliacoesQueContam,
      frase:
        `Esta aplicação já gerou avaliação — avaliações: ${avaliacoesQueContam}. Apagar levaria ` +
        'junto o trabalho dos avaliadores, inclusive respostas já dadas. Se ela não deve fazer ' +
        'parte do ciclo, exclua as pessoas na aba Designação: as avaliações ficam CANCELADAS, com ' +
        'motivo registrado, e nada é apagado.',
    };
  }

  /**
   * ⭐ O caso do meio, que só existe porque os dois números são separados:
   * nenhuma avaliação viva, mas há CANCELADA. Não há trabalho a preservar — há
   * TRILHA. O motivo do cancelamento é o que responde, meses depois, por que
   * aquelas pessoas ficaram sem nota; apagar a aplicação levaria isso junto.
   */
  if (avaliacoesTotais > 0) {
    return {
      podeApagar: false,
      publico,
      avaliacoes: avaliacoesTotais,
      frase:
        `Esta aplicação não tem avaliação em aberto, mas tem avaliação CANCELADA registrada — ` +
        `canceladas: ${avaliacoesTotais}. Cada uma guarda o motivo de ter ficado sem nota, e ` +
        'apagar a aplicação apagaria essa resposta. Se ela não deve aparecer no ciclo, deixe-a ' +
        'como está: cancelada não entra em contagem nenhuma do painel.',
    };
  }

  const oQueLeva =
    publico > 0
      ? `Leva junto o público montado — pessoas no público: ${publico}. Elas não são apagadas do ` +
        'cadastro; saem desta aplicação, e o recorte terá de ser montado de novo.'
      : 'Ela não tem público montado nem avaliação: não leva nada junto.';

  return {
    podeApagar: true,
    publico,
    // Chega aqui com os dois zerados — não há avaliação de espécie nenhuma.
    avaliacoes: 0,
    frase: `Apagar a aplicação não tem volta. ${oQueLeva}`,
  };
}
