/**
 * ⭐⭐ PESO DERIVADO — quanto cada questão vale dentro de um arranjo.
 *
 * O peso mora na CLASSIFICAÇÃO (`ArranjoGrupo.peso`), não na questão. O peso da
 * questão é calculado aqui, na leitura, e **nunca é gravado** — pelo mesmo
 * motivo da nota por grupo (ADR-RH-02): gravar criaria uma segunda verdade para
 * manter em sincronia, e ela envelheceria errada na primeira vez que alguém
 * acrescentasse uma questão ao arranjo.
 *
 * ── A REGRA, E DE ONDE ELA VEIO ─────────────────────────────────────────────
 *
 *   peso(questão) = floor(peso_da_classificação / n, 2 casas)
 *                 + 0,01 para as `resto` primeiras, por ordem
 *
 * Não foi inventada: foi **lida do instrumento herdado**. Os pesos que estavam
 * gravados em `pergunta.peso` seguiam exatamente isto —
 *
 *   Qualidade e Organização · Administrativo → 5,34 + 5,33 + 5,33 = 16
 *   Relacionamento e Conduta · Op. de Loja   → 3,34 + 3,33 + 3,33 = 10
 *
 * — e a regra reproduz **44 de 44** (39 de produção + 5 do DEMO). O `5,34` era
 * o resto de 16 ÷ 3 indo para a primeira questão, não uma decisão pedagógica.
 *
 * ⚠️ **A soma tem de fechar exata.** É por isso que o resto é distribuído em
 * centavos e não simplesmente arredondado: com `round()` ingênuo, 16 ÷ 3 daria
 * 5,33 × 3 = 15,99, e o questionário passaria a valer 59,99 em vez de 60 — erro
 * pequeno o bastante para ninguém ver e grande o bastante para a pontuação
 * máxima gravada (72) deixar de bater com a calculada.
 *
 * ⚠️ A repartição em si é `modelo/distribuirPeso`, que já existia e fazia
 * exatamente isto para o seed — em centavos, com o resto nas primeiras (método
 * do maior resto). **Não reimplementar aqui**: duas cópias da mesma regra
 * envelhecem diferente, e esta em particular decide a nota de todo mundo.
 *
 * Aliás, é a melhor evidência de que o peso sempre foi do grupo: o seed nasceu
 * com os pesos POR GRUPO e os repartia na gravação. A tabela `pergunta.peso` é
 * que era a camada com perda.
 */
import { distribuirPeso } from '../modelo/distribuir-peso.js';
import { ErroDeDominio } from '../common/erro-de-dominio.js';

/** Uma questão do arranjo, na ordem em que aparece. */
export interface QuestaoDoArranjo {
  perguntaId: string;
  classificacaoId: string;
  /** Ordem dentro do arranjo (a da tela). Define quem recebe o centavo do resto. */
  ordem: number;
}

/** O peso de uma classificação NESTE arranjo. */
export interface PesoDaClassificacao {
  classificacaoId: string;
  peso: number;
}

export interface PesoDaQuestao {
  perguntaId: string;
  classificacaoId: string;
  peso: number;
}

export class ClassificacaoSemPesoError extends ErroDeDominio {
  /**
   * ⚠️ 500 seria o certo se isto fosse só defeito nosso — mas desde a Etapa 3
   * o RH monta arranjo, e um rascunho a meio caminho chega aqui pela leitura do
   * catálogo. 409: o estado do arranjo é que está incompleto, não o pedido.
   */
  override readonly status = 409;
  override corpo() {
    return { message: this.message, classificacaoId: this.classificacaoId };
  }


  constructor(readonly classificacaoId: string) {
    super(
      `Arranjo inválido: a classificação ${classificacaoId} tem questão mas não tem peso. ` +
        'A questão entraria no questionário valendo zero, em silêncio.',
    );
  }
}

/**
 * @param questoes  as questões do arranjo (a classificação vem da própria questão).
 * @param pesos     o peso de cada classificação neste arranjo.
 *
 * Classificação com peso e sem questão é ignorada — é arranjo pela metade, que
 * a tela de montagem mostra, e não impede ninguém de responder. O contrário
 * **falha alto**: questão sem peso valeria zero sem avisar, e a nota sairia
 * menor sem que nada acusasse erro.
 */
export function pesosDerivados(
  questoes: readonly QuestaoDoArranjo[],
  pesos: readonly PesoDaClassificacao[],
): PesoDaQuestao[] {
  const pesoPorClassificacao = new Map(pesos.map((p) => [p.classificacaoId, p.peso]));
  const porClassificacao = new Map<string, QuestaoDoArranjo[]>();

  for (const q of questoes) {
    if (!pesoPorClassificacao.has(q.classificacaoId)) {
      throw new ClassificacaoSemPesoError(q.classificacaoId);
    }
    porClassificacao.set(q.classificacaoId, [...(porClassificacao.get(q.classificacaoId) ?? []), q]);
  }

  const resultado: PesoDaQuestao[] = [];
  for (const [classificacaoId, doGrupo] of porClassificacao) {
    // Por ORDEM: quem recebe o centavo do resto não pode depender da ordem em
    // que o banco devolveu as linhas, senão o mesmo arranjo daria pesos
    // diferentes entre duas leituras — e a nota mudaria sem ninguém ter mexido
    // em nada.
    const ordenadas = [...doGrupo].sort((a, b) => a.ordem - b.ordem);
    const pesos = distribuirPeso(pesoPorClassificacao.get(classificacaoId) as number, ordenadas.length);
    ordenadas.forEach((q, i) => {
      resultado.push({ perguntaId: q.perguntaId, classificacaoId, peso: pesos[i] });
    });
  }

  return resultado;
}

/**
 * Pontuação máxima do questionário: `Σ(maior alternativa × peso)`.
 *
 * ⚠️ Calculada, nunca constante — é o conserto do `/18` fixo do select antigo,
 * onde acrescentar uma pergunta levava a nota acima de 100 sem acusar erro.
 */
export function pontuacaoMaximaDoArranjo(
  pesosPorQuestao: readonly PesoDaQuestao[],
  maiorValorPorPergunta: ReadonlyMap<string, number>,
): number {
  // ⚠️ ARREDONDAR UMA VEZ SÓ, no fim. Arredondar por questão parece inofensivo
  // e não é: 5,34 × 1,2 = 6,408 vira 6,41, e três questões de um grupo de 16
  // somam 19,21 em vez de 19,2. No Administrativo isso levava a pontuação
  // máxima a 72,03 — número que não bate com o gravado e faz toda nota do
  // perfil sair 0,04% menor, sem nada acusar erro. Pego pela spec que compara
  // com o instrumento herdado.
  const centavos = pesosPorQuestao.reduce((soma, p) => {
    const maior = maiorValorPorPergunta.get(p.perguntaId);
    if (maior === undefined) {
      throw new Error(`Questão ${p.perguntaId} sem alternativas — arranjo inválido.`);
    }
    // `peso` é exato em centavos (veio de `pesosDerivados`); multiplicar o
    // INTEIRO evita o 0,1 + 0,2 do ponto flutuante no acumulador.
    return soma + Math.round(p.peso * 100) * maior;
  }, 0);
  // 4 casas = a precisão de `modelo_versao.pontuacao_maxima` no banco.
  return Math.round((centavos / 100) * 10_000) / 10_000;
}
