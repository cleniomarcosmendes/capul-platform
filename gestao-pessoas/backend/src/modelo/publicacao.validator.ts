/**
 * ⭐⭐ VALIDAÇÃO DE PUBLICAÇÃO DO ARRANJO — Etapa 4 do editor.
 *
 * Publicar é o ponto sem volta: a versão publicada é imutável, dela saem notas
 * com consequência de mérito, e a `pontuacaoMaxima` gravada aqui vira o
 * denominador de todo mundo daquele perfil. Tudo que puder ser conferido é
 * conferido neste ponto, e a mensagem diz **qual** classificação, **qual**
 * questão e o que fazer — quem lê é o RH.
 *
 * ── O QUE ESTE ARQUIVO ERA, E POR QUE MUDOU (12/09/2026) ────────────────────
 *
 * Ele foi escrito em 05/09 sobre `GrupoParaPublicacao { titulo, perguntas:
 * [{ peso, alternativas }] }` — **forma que a migration do acervo (11/09)
 * acabou**. Ficou seis dias com spec verde e **sem chamador nenhum**, e por isso
 * ninguém percebeu que ele descrevia um modelo que não existe mais:
 * `rh.pergunta` não tem coluna `peso` desde 11/09. É o caso que virou a regra da
 * §3.1.82 — *peça sem chamador não é peça pronta, é peça não verificada contra
 * a forma atual*. A adaptação estava orçada em ~4h e é esta.
 *
 * O que inverteu: **o peso mora na CLASSIFICAÇÃO** (`ArranjoGrupo.peso`) e o da
 * questão é derivado por divisão. Logo, a validação de "peso da pergunta > 0"
 * deixa de existir (não há tal campo) e entra a que faltava — e que é a que
 * pega dinheiro:
 *
 *   ⭐⭐ **classificação com peso e SEM questão.**
 *
 * `pesosDerivados` ignora esse grupo, de propósito: arranjo pela metade não
 * impede ninguém de responder. Mas o peso dele **some da conta** — a soma
 * DECLARADA fica 60 e a soma DERIVADA 50, e a pontuação máxima é calculada
 * sobre a derivada. Ninguém vê, porque os dois números continuam parecendo
 * certos cada um por si. Na montagem é aviso; **na publicação é erro.**
 */
import { pesosDerivados, pontuacaoMaximaDoArranjo, type PesoDaQuestao } from '../calculo/peso-derivado.js';
import { percentuaisQueFecham } from '../common/percentual.js';

export interface GrupoDoArranjo {
  classificacaoId: string;
  /** Nome da classificação — é o que a mensagem cita. */
  titulo: string;
  peso: number;
  ordem: number;
}

export interface QuestaoDoArranjo {
  perguntaId: string;
  codigo: string;
  enunciado: string;
  ativa: boolean;
  classificacaoId: string;
  ordem: number;
  alternativas: readonly { valor: number }[];
}

export interface ArranjoParaPublicacao {
  grupos: readonly GrupoDoArranjo[];
  questoes: readonly QuestaoDoArranjo[];
}

export class ModeloNaoPublicavelError extends Error {
  constructor(readonly problemas: string[]) {
    super(`Versão não pode ser publicada:\n- ${problemas.join('\n- ')}`);
    this.name = 'ModeloNaoPublicavelError';
  }
}

const maiorValor = (q: QuestaoDoArranjo) =>
  q.alternativas.length === 0 ? 0 : Math.max(...q.alternativas.map((a) => a.valor));

/** A soma dos pesos DECLARADOS — o que o RH digitou. */
export function somaDeclarada(grupos: readonly GrupoDoArranjo[]): number {
  return Math.round(grupos.reduce((s, g) => s + g.peso, 0) * 10_000) / 10_000;
}

/**
 * A soma dos pesos DERIVADOS — o que a nota vai de fato usar.
 *
 * ⭐⭐ **É a conta da §3.1.86**, e é o motivo de esta função existir separada da
 * de cima: dois números que deveriam ser iguais, calculados por caminhos
 * diferentes. Divergiram três vezes em quatro dias (72,03 · assertSalvavel ·
 * 59,97), e nenhuma das três apareceu em teste — apareceram na soma.
 */
export function somaDerivada(arranjo: ArranjoParaPublicacao): number {
  const centavos = derivar(arranjo).reduce((s, p) => s + Math.round(p.peso * 100), 0);
  return Math.round((centavos / 100) * 10_000) / 10_000;
}

function derivar(arranjo: ArranjoParaPublicacao): PesoDaQuestao[] {
  try {
    return pesosDerivados(
      arranjo.questoes.map((q) => ({
        perguntaId: q.perguntaId,
        classificacaoId: q.classificacaoId,
        ordem: q.ordem,
      })),
      arranjo.grupos.map((g) => ({ classificacaoId: g.classificacaoId, peso: g.peso })),
    );
  } catch {
    // Questão numa classificação sem peso — apontada como problema próprio
    // abaixo, com o nome da questão. Aqui só não pode explodir.
    return [];
  }
}

/** A pontuação máxima que a publicação vai GRAVAR. Calculada, nunca constante. */
export function pontuacaoMaximaDoArranjoCompleto(arranjo: ArranjoParaPublicacao): number {
  const maiores = new Map(arranjo.questoes.map((q) => [q.perguntaId, maiorValor(q)]));
  try {
    return pontuacaoMaximaDoArranjo(derivar(arranjo), maiores);
  } catch {
    return 0;
  }
}

/** O balanço por classificação, para a tela de montagem. */
export function somatorioPorGrupo(arranjo: ArranjoParaPublicacao) {
  const porClassificacao = new Map<string, number>();
  for (const q of arranjo.questoes) {
    porClassificacao.set(q.classificacaoId, (porClassificacao.get(q.classificacaoId) ?? 0) + 1);
  }
  const ordenados = [...arranjo.grupos].sort((a, b) => a.ordem - b.ordem);
  // ⚠️ `percentuaisQueFecham`, não `(peso / total) × 100`: 16/10/34 sobre 60
  // arredondado por item soma 100,01, e a coluna que o RH lê não fecha.
  const percentuais = percentuaisQueFecham(ordenados.map((g) => g.peso));
  return ordenados.map((g, i) => ({
    classificacaoId: g.classificacaoId,
    titulo: g.titulo,
    peso: g.peso,
    questoes: porClassificacao.get(g.classificacaoId) ?? 0,
    percentual: percentuais[i],
  }));
}

export function validarArranjoParaPublicacao(arranjo: ArranjoParaPublicacao): string[] {
  const problemas: string[] = [];
  const { grupos, questoes } = arranjo;

  if (grupos.length === 0) {
    problemas.push('A versão não tem nenhuma classificação com peso — não há questionário.');
  }
  if (questoes.length === 0) {
    problemas.push('A versão não tem nenhuma questão. Um questionário vazio não avalia nada.');
  }

  const comPeso = new Set<string>();
  for (const g of grupos) {
    if (comPeso.has(g.classificacaoId)) {
      problemas.push(`A classificação "${g.titulo}" aparece duas vezes no arranjo.`);
    }
    comPeso.add(g.classificacaoId);
    if (!(g.peso > 0)) {
      problemas.push(
        `Classificação "${g.titulo}": peso ${g.peso}. Para deixá-la de fora, remova-a do ` +
          'arranjo em vez de zerar — peso zero faz o avaliador responder à toa.',
      );
    }
  }

  const questoesPorClassificacao = new Map<string, number>();
  for (const q of questoes) {
    questoesPorClassificacao.set(
      q.classificacaoId,
      (questoesPorClassificacao.get(q.classificacaoId) ?? 0) + 1,
    );
  }

  /**
   * ⭐⭐ A que faltava, e a que pega dinheiro. Ver o cabeçalho: o peso do grupo
   * vazio some da conta, e a declarada deixa de bater com a derivada.
   */
  for (const g of grupos) {
    if ((questoesPorClassificacao.get(g.classificacaoId) ?? 0) === 0) {
      problemas.push(
        `Classificação "${g.titulo}": peso ${g.peso} e nenhuma questão. O peso dela não iria ` +
          'para lugar nenhum — a soma cairia para ' +
          `${somaDeclarada(grupos) - g.peso} sem nada acusar. Acrescente questões ou tire a ` +
          'classificação do arranjo.',
      );
    }
  }

  const vistas = new Set<string>();
  for (const q of questoes) {
    const qual = `Questão ${q.codigo} ("${q.enunciado}")`;
    if (vistas.has(q.perguntaId)) problemas.push(`${qual} aparece duas vezes no arranjo.`);
    vistas.add(q.perguntaId);

    if (!comPeso.has(q.classificacaoId)) {
      problemas.push(
        `${qual}: a classificação dela não tem peso neste perfil. Ela entraria no questionário ` +
          'valendo zero, em silêncio.',
      );
    }
    if (q.alternativas.length < 2) {
      problemas.push(
        `${qual} — alternativas: ${q.alternativas.length}. Com menos de duas não mede nada.`,
      );
    }
    if (q.alternativas.length > 0 && !(maiorValor(q) > 0)) {
      problemas.push(`${qual}: todas as alternativas valem zero — não há como pontuar.`);
    }
    if (!q.ativa) {
      problemas.push(
        `${qual} está INATIVA no acervo. Publicar um perfil com ela contradiz o cadastro — ` +
          'reative a questão ou tire-a deste perfil.',
      );
    }
  }

  /**
   * ⭐⭐ A CONTA. Só quando nada mais foi apontado: um grupo vazio já faz as
   * duas somas divergirem, e empilhar "as somas não batem" em cima de "a
   * classificação X não tem questão" enterra a causa debaixo do sintoma.
   */
  if (problemas.length === 0) {
    const declarada = somaDeclarada(grupos);
    const derivada = somaDerivada(arranjo);
    if (Math.abs(declarada - derivada) > 0.0001) {
      problemas.push(
        `A soma dos pesos não fecha: declarada ${declarada}, distribuída ${derivada}. ` +
          'A nota sairia sobre um denominador diferente do que a tela mostra. ' +
          'Isto é defeito do sistema, não do cadastro — avise a T.I.',
      );
    }
    if (!(pontuacaoMaximaDoArranjoCompleto(arranjo) > 0)) {
      problemas.push(
        'A pontuação máxima desta versão é zero — nenhuma nota poderia ser calculada com ela.',
      );
    }
  }

  return problemas;
}

/** Mesma validação, em forma de guarda. */
export function assertArranjoPublicavel(arranjo: ArranjoParaPublicacao): void {
  const problemas = validarArranjoParaPublicacao(arranjo);
  if (problemas.length > 0) throw new ModeloNaoPublicavelError(problemas);
}
