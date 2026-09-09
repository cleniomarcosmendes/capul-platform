/**
 * VALIDAÇÃO DE PUBLICAÇÃO DO MODELO (§4.6).
 *
 * Publicar é o ponto sem volta: a versão publicada é imutável, e dela saem notas
 * com consequência de mérito. Tudo que puder ser conferido é conferido aqui, e a
 * mensagem tem de dizer QUAL grupo, QUAL pergunta e o que fazer — quem lê é o
 * RH, não quem escreveu o código.
 *
 * ⚠️ Desde a reestruturação de 05/09/2026 o modelo é **só o questionário**:
 *   • **Grupo não tem peso** — é organização visual (título + ordem). Todo o
 *     peso está em `Pergunta.peso`. Peso em dois níveis tornava impossível
 *     prever o efeito de mudar um número.
 *   • **Critérios cadastrais não estão aqui.** Escolaridade, tempo de casa e
 *     cursos vivem na APLICAÇÃO (`AplicacaoCriterio`), e quem os valida é
 *     `ciclo/abertura.validator.ts`. Por isso este arquivo não fala em critério.
 *
 * A tela de montagem deve mostrar o **somatório de pesos por grupo**, para o RH
 * enxergar o balanço sem calcular na mão — `somatorioPorGrupo()` abaixo serve
 * a tela e o teste com o mesmo código.
 */

export interface AlternativaParaPublicacao {
  valor: number;
}

export interface PerguntaParaPublicacao {
  enunciado: string;
  peso: number;
  alternativas: readonly AlternativaParaPublicacao[];
}

export interface GrupoParaPublicacao {
  titulo: string;
  perguntas: readonly PerguntaParaPublicacao[];
}

export class ModeloNaoPublicavelError extends Error {
  constructor(readonly problemas: string[]) {
    super(`Modelo não pode ser publicado:\n- ${problemas.join('\n- ')}`);
    this.name = 'ModeloNaoPublicavelError';
  }
}

/**
 * Denominador da nota do questionário:
 *   Σ (maior valor de alternativa da pergunta × peso da pergunta)
 *
 * É o que grava `ModeloVersao.pontuacaoMaxima` na publicação — **calculado,
 * nunca constante**. O modelo antigo dividia por 18 fixo: acrescentar uma
 * pergunta fazia a nota passar de 100 sem acusar erro.
 */
export function pontuacaoMaxima(grupos: readonly GrupoParaPublicacao[]): number {
  return grupos
    .flatMap((g) => g.perguntas)
    .reduce((total, p) => total + maiorValor(p) * p.peso, 0);
}

/** Somatório de pesos por grupo — o balanço que a tela de montagem exibe. */
export function somatorioPorGrupo(
  grupos: readonly GrupoParaPublicacao[],
): { titulo: string; pesoTotal: number; percentual: number }[] {
  const geral = grupos.flatMap((g) => g.perguntas).reduce((s, p) => s + p.peso, 0);
  return grupos.map((g) => {
    const pesoTotal = g.perguntas.reduce((s, p) => s + p.peso, 0);
    return {
      titulo: g.titulo,
      pesoTotal,
      percentual: geral > 0 ? (pesoTotal / geral) * 100 : 0,
    };
  });
}

function maiorValor(p: PerguntaParaPublicacao): number {
  return p.alternativas.length ? Math.max(...p.alternativas.map((a) => a.valor)) : 0;
}

/**
 * Devolve a lista de problemas — vazia quando o modelo pode ser publicado.
 * Junta TODOS em vez de parar no primeiro: quem está cadastrando corrige de uma
 * vez, em vez de descobrir um erro por tentativa.
 */
export function validarModeloParaPublicacao(grupos: readonly GrupoParaPublicacao[]): string[] {
  const problemas: string[] = [];

  if (grupos.length === 0) problemas.push('O modelo não tem nenhum grupo.');

  for (const grupo of grupos) {
    const onde = `Grupo "${grupo.titulo}"`;
    if (grupo.perguntas.length === 0) {
      problemas.push(`${onde}: não tem nenhuma pergunta. Remova o grupo ou acrescente perguntas.`);
      continue;
    }

    for (const pergunta of grupo.perguntas) {
      const qual = `${onde}, pergunta "${pergunta.enunciado}"`;

      if (pergunta.alternativas.length < 2) {
        problemas.push(
          `${qual} — alternativas: ${pergunta.alternativas.length}. ` +
            'Uma pergunta com menos de duas não mede nada.',
        );
      }
      if (!(pergunta.peso > 0)) {
        // Peso 0 numa pergunta obrigatória é o pior dos dois mundos: o avaliador
        // é obrigado a responder e a resposta não conta para nada.
        problemas.push(
          `${qual}: peso ${pergunta.peso}. Toda pergunta é obrigatória de responder, ` +
            'então peso zero ou negativo faria o avaliador trabalhar à toa.',
        );
      }
      if (pergunta.alternativas.length > 0 && !(maiorValor(pergunta) > 0)) {
        problemas.push(
          `${qual}: todas as alternativas valem zero — não há como pontuar esta pergunta.`,
        );
      }
    }
  }

  // Guarda final contra divisão por zero na nota do questionário — só quando
  // nada mais foi apontado. Um grupo vazio já zera a pontuação máxima, e
  // acrescentar "a pontuação máxima é zero" ao lado de "o grupo não tem
  // pergunta" só empilha ruído sobre a causa real, para quem lê consertar.
  if (problemas.length === 0 && grupos.length > 0 && !(pontuacaoMaxima(grupos) > 0)) {
    problemas.push(
      'A pontuação máxima do modelo é zero — com este modelo nenhuma nota poderia ser calculada.',
    );
  }

  return problemas;
}

/** Mesma validação, em forma de guarda. Use na publicação. */
export function assertModeloPublicavel(grupos: readonly GrupoParaPublicacao[]): void {
  const problemas = validarModeloParaPublicacao(grupos);
  if (problemas.length > 0) throw new ModeloNaoPublicavelError(problemas);
}
