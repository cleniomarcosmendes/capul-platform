/**
 * ⭐⭐ O CLASSIFICADOR DA QUESTÃO — Etapa 6 do editor.
 *
 * Quatro atos sobre uma questão do acervo, cada um com o seu efeito: EDITAR o
 * texto, TROCAR a classificação, DESATIVAR e APAGAR. Criar não entra: criar uma
 * questão não toca em nada (ela nasce fora de todo perfil), e o que a tela
 * precisa dizer sobre isso é um aviso, não uma recusa.
 *
 * ⚠️ **As duas recusas duras têm causas diferentes, e confundir as duas é o
 * erro fácil:**
 *
 *   - **resposta gravada** → o TEXTO não se mexe. Alguém já respondeu "Raramente
 *     falta no trabalho"; reescrever a frase muda o que aquela pessoa disse,
 *     retroativamente. A nota não muda (`Resposta.valor` está gravado), o
 *     REGISTRO é que passa a mentir.
 *   - **está em arranjo** → a CLASSIFICAÇÃO não se troca. O peso da questão é
 *     derivado (`peso_da_classificação ÷ questões dela naquele perfil`), então
 *     mover uma questão de classificação **muda o peso de duas classificações
 *     em todos os perfis que a usam** — inclusive os publicados.
 */
export type Acao = 'PERMITIR' | 'RECUSAR';

export interface Efeito {
  acao: Acao;
  frase: string;
}

export interface ContextoQuestao {
  codigo: string;
  enunciado: string;
  classificacaoNome: string;
  ativa: boolean;
  /** Respostas gravadas sobre esta questão, em qualquer ciclo. */
  respostas: number;
  /** Perfis (versões) cujo arranjo a inclui. */
  arranjos: number;
  /** Desses, quantos são versões publicadas. */
  arranjosPublicados: number;
}

const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;

/** Editar enunciado e/ou os textos das âncoras. */
export function efeitoDeEditarTexto(q: ContextoQuestao): Efeito {
  if (q.respostas > 0) {
    return {
      acao: 'RECUSAR',
      frase:
        `A questão ${q.codigo} já tem ${plural(q.respostas, 'resposta gravada', 'respostas gravadas')}. ` +
        'Mudar o enunciado ou o texto de uma alternativa reescreveria o que essas pessoas ' +
        'responderam — a nota delas não muda, mas o registro passa a dizer outra coisa. ' +
        'Para mudar a redação daqui para a frente, crie uma questão nova e troque no perfil.',
    };
  }
  if (q.arranjos === 0) {
    return {
      acao: 'PERMITIR',
      frase: `Nenhuma resposta e nenhum perfil usam a ${q.codigo}. A mudança não alcança ninguém.`,
    };
  }
  return {
    acao: 'PERMITIR',
    frase:
      `A ${q.codigo} está em ${plural(q.arranjos, 'perfil', 'perfis')}` +
      (q.arranjosPublicados > 0
        ? ` (${plural(q.arranjosPublicados, 'publicado', 'publicados')})`
        : ' (nenhum publicado)') +
      ', e ainda não tem resposta nenhuma. O texto novo é o que quem responder vai ler; ' +
      'nenhum peso e nenhuma nota mudam.',
  };
}

/** Trocar a classificação — o ato que mexe em PESO sem parecer que mexe. */
export function efeitoDeReclassificar(q: ContextoQuestao): Efeito {
  if (q.arranjos > 0) {
    return {
      acao: 'RECUSAR',
      frase:
        `A ${q.codigo} está em ${plural(q.arranjos, 'perfil', 'perfis')}` +
        (q.arranjosPublicados > 0
          ? ` — ${plural(q.arranjosPublicados, 'está publicado', 'estão publicados')}` +
            ' — '
          : ', ') +
        `e o peso dela é DERIVADO da classificação "${q.classificacaoNome}". Trocar a ` +
        'classificação mudaria o peso de duas classificações em cada um desses perfis, e com ' +
        'isso a nota de quem já foi avaliado neles. Tire a questão dos perfis primeiro.',
    };
  }
  return {
    acao: 'PERMITIR',
    frase: `A ${q.codigo} não está em nenhum perfil — trocar a classificação não muda peso nenhum.`,
  };
}

/**
 * Desativar.
 *
 * ⚠️ `pergunta.ativa` **não filtrava nada** até 12/09, como `classificacao.ativa`
 * (§3.1.87). Ganha aqui o mesmo significado estreito: **não é oferecida ao
 * montar um arranjo**. Não sai dos perfis que já a usam — se saísse, a soma dos
 * pesos daquele perfil mudaria por um clique de cadastro.
 */
export function efeitoDeDesativarQuestao(q: ContextoQuestao): Efeito {
  if (!q.ativa) return { acao: 'RECUSAR', frase: `A questão ${q.codigo} já está inativa.` };
  return {
    acao: 'PERMITIR',
    frase:
      `A ${q.codigo} deixa de ser oferecida ao montar um perfil.` +
      (q.arranjos > 0
        ? ` Os ${plural(q.arranjos, 'perfil que a usa', 'perfis que a usam')} não mudam` +
          (q.arranjosPublicados > 0 ? ', e nenhuma nota se altera.' : '.')
        : ''),
  };
}

export function efeitoDeReativarQuestao(q: ContextoQuestao): Efeito {
  if (q.ativa) return { acao: 'RECUSAR', frase: `A questão ${q.codigo} já está ativa.` };
  return {
    acao: 'PERMITIR',
    frase: `A ${q.codigo} volta a ser oferecida ao montar um perfil.`,
  };
}

export function efeitoDeApagarQuestao(q: ContextoQuestao): Efeito {
  if (q.respostas > 0) {
    return {
      acao: 'RECUSAR',
      frase:
        `A ${q.codigo} tem ${plural(q.respostas, 'resposta gravada', 'respostas gravadas')}. ` +
        'Apagá-la deixaria essas avaliações sem a pergunta que foi respondida. ' +
        'Para tirá-la de circulação, desative — ela sai da montagem e o histórico fica de pé.',
    };
  }
  if (q.arranjos > 0) {
    return {
      acao: 'RECUSAR',
      frase:
        `A ${q.codigo} está em ${plural(q.arranjos, 'perfil', 'perfis')}. Tire-a desses perfis ` +
        'antes de apagar — sair de um perfil redistribui o peso da classificação entre as ' +
        'questões que sobram, e isso tem de ser um ato consciente.',
    };
  }
  return {
    acao: 'PERMITIR',
    frase:
      `Apaga a questão ${q.codigo} e as alternativas dela. Não está em perfil nenhum e nunca ` +
      'foi respondida. ⚠️ Não desfaz.',
  };
}
