/**
 * ⭐ O CLASSIFICADOR das operações de CLASSIFICAÇÃO (Etapa 5 do editor).
 *
 * Mesma forma dos outros: função pura → `{ acao, frase }`, lida pela tela para
 * desabilitar com o motivo e pelo serviço para recusar.
 *
 * ⚠️ **`ativa` não filtrava NADA até 12/09** — era coluna decorativa, lida só
 * pela tela do acervo. É a mesma família do `status` do módulo no Hub, que o
 * comentário do compose afirmava filtrar e não filtrava (05/09). Aqui ela ganha
 * um significado, e ele é ESTREITO de propósito:
 *
 *   **`ativa = false` → a classificação não é OFERECIDA ao criar ou mover uma
 *   questão. Nada mais.**
 *
 * Em particular ela **não** sai dos arranjos que já a usam, e **não** tira as
 * questões que já estão nela. Se desativar mexesse em arranjo publicado, a nota
 * de gente real mudaria por um clique de cadastro.
 */
export type Acao = 'PERMITIR' | 'RECUSAR';

export interface Efeito {
  acao: Acao;
  frase: string;
}

export interface ContextoClassificacao {
  nome: string;
  ativa: boolean;
  /** Questões do acervo que apontam para esta classificação. */
  questoes: number;
  /** Arranjos (versões de perfil) que declaram peso para ela. */
  arranjos: number;
  /** Desses arranjos, quantos são de versões PUBLICADAS. */
  arranjosPublicados: number;
}

export function efeitoDeApagar(c: ContextoClassificacao): Efeito {
  if (c.questoes > 0) {
    return {
      acao: 'RECUSAR',
      frase:
        `"${c.nome}" tem ${c.questoes} ${c.questoes === 1 ? 'questão' : 'questões'} no acervo. ` +
        'Toda questão pertence a uma classificação — apagá-la deixaria essas questões sem ' +
        'nenhuma. Mova-as para outra classificação primeiro.',
    };
  }
  if (c.arranjos > 0) {
    return {
      acao: 'RECUSAR',
      frase:
        `"${c.nome}" tem peso declarado em ${c.arranjos} ` +
        `${c.arranjos === 1 ? 'perfil' : 'perfis'}. Tire-a desses arranjos antes de apagar.`,
    };
  }
  return {
    acao: 'PERMITIR',
    frase: `Apaga a classificação "${c.nome}". Não é usada por nenhuma questão nem por nenhum perfil.`,
  };
}

export function efeitoDeDesativar(c: ContextoClassificacao): Efeito {
  if (!c.ativa) {
    return { acao: 'RECUSAR', frase: `"${c.nome}" já está inativa.` };
  }
  /**
   * ⚠️ PERMITE sempre — e a frase carrega o que NÃO acontece. Desativar é ato
   * de cadastro; o que ele muda é o que aparece na hora de classificar uma
   * questão nova. Um ato de correção que diz meia verdade custa o dobro.
   */
  const usada =
    c.questoes > 0 || c.arranjos > 0
      ? ` As ${c.questoes} ${c.questoes === 1 ? 'questão' : 'questões'} que já estão nela ` +
        `continuam lá, e os ${c.arranjos} ${c.arranjos === 1 ? 'perfil' : 'perfis'} que a usam ` +
        `não mudam` +
        (c.arranjosPublicados > 0
          ? ` — ${c.arranjosPublicados} ${c.arranjosPublicados === 1 ? 'está publicado' : 'estão publicados'}, e nenhuma nota se altera.`
          : '.')
      : '';
  return {
    acao: 'PERMITIR',
    frase:
      `"${c.nome}" deixa de ser oferecida ao criar ou mover uma questão.${usada}`.trim(),
  };
}

export function efeitoDeReativar(c: ContextoClassificacao): Efeito {
  if (c.ativa) return { acao: 'RECUSAR', frase: `"${c.nome}" já está ativa.` };
  return {
    acao: 'PERMITIR',
    frase: `"${c.nome}" volta a ser oferecida ao criar ou mover uma questão.`,
  };
}
