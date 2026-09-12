/**
 * ⭐⭐ A DEVOLUTIVA — as contas da tela do avaliador.
 *
 * ⚠️ **NADA AQUI RECALCULA NOTA.** Tudo vem pronto do backend: `notaAvaliacao`,
 * `notaFinal`, `porGrupo`, `porQuestao` e `criterios`. O que estas funções fazem
 * é **repartir para exibir** e **conferir que o exibido fecha** — que são coisas
 * de tela, não de motor.
 *
 * A regra que justifica a separação já custou caro quatro vezes:
 *
 *   - `repartirPesos` nasceu porque dois critérios de peso 13,33 exibiam
 *     **22,22% e 22,21%** e a coluna somava 100,01;
 *   - repartir em 2 casas e exibir 1 fazia três de 33,33% virarem 33,3% e a
 *     coluna somar **99,9%**;
 *   - arredondar por item fez a pontuação máxima sair **72,03** em vez de 72;
 *   - e o acervo dividiu `peso ÷ n` à mão em vez de usar `pesosDerivados`,
 *     exibindo **59,97** onde o grupo declarava 60.
 *
 * ⭐ Por isso a `conferirComposicao` existe: a tela **mostra a conta e a
 * confere**. Conta que não bate detecta furo melhor que revisão.
 */
import { repartirPesos, type FatiaDaNota } from './composicao-da-nota';

export interface CriterioDaMemoria {
  nome: string;
  valorBruto: number | null;
  valorTexto: string | null;
  faixaRotulo: string | null;
  pontuacao: number | null;
  peso: number;
  semDado: boolean;
}

export interface GrupoDaMemoria {
  grupoId: string;
  titulo: string;
  nota: number;
  peso: number;
}

export interface AncoraDaQuestao {
  descricao: string;
  valor: number;
  escolhida: boolean;
}

export interface QuestaoDaMemoria {
  perguntaId: string;
  codigo: string;
  enunciado: string;
  classificacaoId: string;
  peso: number;
  maiorValor: number;
  valor: number | null;
  respostaEscolhida: string | null;
  ancoras: AncoraDaQuestao[];
}

export interface MemoriaParaDevolutiva {
  notaAvaliacao: number;
  pesoAvaliacao: number;
  notaFinal: number;
  criterios: CriterioDaMemoria[];
  porGrupo: GrupoDaMemoria[];
  porQuestao: QuestaoDaMemoria[];
}

/**
 * ⭐ O PRÓXIMO NÍVEL — o que dá objeto à conversa.
 *
 * *"Você ficou em 'atrasa às vezes'; o próximo nível é 'raramente atrasa'"* diz
 * o que fazer. *"Sua nota em Pontualidade foi 25"* não diz nada.
 *
 * As âncoras vêm ordenadas por valor crescente e com a escolhida marcada, então
 * o próximo é o vizinho de cima. **`null` no topo** — e é informação: quem já
 * está no melhor nível merece ouvir isso, não um espaço em branco.
 */
export function proximoNivel(ancoras: readonly AncoraDaQuestao[]): AncoraDaQuestao | null {
  const i = ancoras.findIndex((a) => a.escolhida);
  if (i < 0) return null; // sem resposta — não há de onde subir
  return ancoras[i + 1] ?? null;
}

/** A âncora que o avaliador escolheu, ou `null` quando a questão ficou sem resposta. */
export function ancoraEscolhida(ancoras: readonly AncoraDaQuestao[]): AncoraDaQuestao | null {
  return ancoras.find((a) => a.escolhida) ?? null;
}

export interface Composicao {
  /** Questionário + cada critério COM dado, já com o % que fecha em 100. */
  fatias: FatiaDaNota[];
  /** A soma dos pesos — o "de 90" que a tela mostra. */
  pesoTotal: number;
  /** Critérios que não entraram (sem dado) — mostrados, nunca escondidos. */
  semDado: CriterioDaMemoria[];
}

/**
 * ⚠️ Critério **sem dado** fica FORA da repartição: o motor renormaliza, e
 * incluí-lo faria a fração mentir para todos os outros. Mas ele **volta na
 * lista** `semDado`, porque sumir em silêncio faria o avaliador procurar um
 * critério que o cadastro não tinha.
 */
export function composicao(m: MemoriaParaDevolutiva): Composicao {
  const validos = m.criterios.filter((c) => !c.semDado);
  const itens = [
    { nome: 'Questionário', peso: m.pesoAvaliacao },
    ...validos.map((c) => ({ nome: c.nome, peso: c.peso })),
  ];
  return {
    fatias: repartirPesos(itens),
    pesoTotal: itens.reduce((s, i) => s + i.peso, 0),
    semDado: m.criterios.filter((c) => c.semDado),
  };
}

export interface Conferencia {
  /** Os percentuais somam exatamente 100? */
  percentuaisFecham: boolean;
  /** A nota final refeita na mão bate com a exibida? */
  finalBate: boolean;
  /** Σ(nota do grupo × peso) ÷ Σpesos bate com a nota do questionário? */
  gruposBatem: boolean;
  /** Σ dos pesos dos grupos é o peso do questionário? */
  pesoDosGruposBate: boolean;
  /** Todas as quatro. É o que a tela usa para decidir se pode se afirmar. */
  tudoFecha: boolean;
  /** Para a mensagem, quando não fecha. */
  detalhe: { finalRefeita: number; questionarioPelosGrupos: number; somaDosGrupos: number };
}

/** Duas casas — a mesma precisão de `Decimal(6,2)` no banco. */
const duasCasas = (v: number) => Math.round(v * 100) / 100;
const bate = (a: number, b: number) => Math.abs(a - b) < 0.005;

/**
 * ⭐⭐ A TELA CONFERE A PRÓPRIA CONTA.
 *
 * Não é paranoia: é o portão desta etapa, e as quatro somas já morderam o
 * módulo. Se alguma não fechar, a tela **diz** em vez de exibir um número que
 * não se sustenta na frente do avaliado — que é o pior lugar possível para
 * descobrir que a conta está errada.
 *
 * ⚠️ Confere sobre os números que o BACKEND mandou. Não substitui o motor; é a
 * conferência de que o que está na tela é consistente com o que foi calculado.
 */
export function conferirComposicao(m: MemoriaParaDevolutiva): Conferencia {
  const c = composicao(m);
  const validos = m.criterios.filter((cr) => !cr.semDado);

  const somaPct = duasCasas(c.fatias.reduce((s, f) => s + f.pct, 0));

  const numerador =
    m.notaAvaliacao * m.pesoAvaliacao +
    validos.reduce((s, cr) => s + (cr.pontuacao ?? 0) * cr.peso, 0);
  const finalRefeita = c.pesoTotal > 0 ? duasCasas(numerador / c.pesoTotal) : 0;

  const somaDosGrupos = duasCasas(m.porGrupo.reduce((s, g) => s + g.peso, 0));
  const numeradorGrupos = m.porGrupo.reduce((s, g) => s + g.nota * g.peso, 0);
  const questionarioPelosGrupos = somaDosGrupos > 0 ? duasCasas(numeradorGrupos / somaDosGrupos) : 0;

  const percentuaisFecham = c.fatias.length === 0 || somaPct === 100;
  const finalBate = bate(finalRefeita, m.notaFinal);
  const gruposBatem = m.porGrupo.length === 0 || bate(questionarioPelosGrupos, m.notaAvaliacao);
  const pesoDosGruposBate = m.porGrupo.length === 0 || bate(somaDosGrupos, m.pesoAvaliacao);

  return {
    percentuaisFecham,
    finalBate,
    gruposBatem,
    pesoDosGruposBate,
    tudoFecha: percentuaisFecham && finalBate && gruposBatem && pesoDosGruposBate,
    detalhe: { finalRefeita, questionarioPelosGrupos, somaDosGrupos },
  };
}
