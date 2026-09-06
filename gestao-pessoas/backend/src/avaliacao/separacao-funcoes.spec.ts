import {
  EXIGENCIA_POR_ACAO,
  MOTIVO_ACESSO_RESTRITO,
  type AcaoAvaliacao,
  assertEscopoReapuracaoValido,
  assertNaoEhProprioAvaliado,
  assertPodeAgirSobreAvaliacaoDeOutro,
  conflitoDeInstrumento,
  ehAvaliadorDesignado,
  ehProprioAvaliado,
  marcarRestricoes,
  motivoParaRecusarDeTerceiro,
} from './separacao-funcoes.js';

describe('ehProprioAvaliado', () => {
  it('compara ID, não matrícula nem nome', () => {
    expect(ehProprioAvaliado('colab-1', 'colab-1')).toBe(true);
    expect(ehProprioAvaliado('colab-1', 'colab-2')).toBe(false);
  });

  it('id ausente não afirma "não é o próprio" por engano — quem barra é o guard', () => {
    // Sem identidade resolvida a requisição nem chega aqui (falha fechada no
    // IdentidadeGuard). Se chegar, não inventa uma resposta permissiva com base
    // em nada: devolve false e o chamador segue para as demais checagens.
    expect(ehProprioAvaliado(null, 'colab-1')).toBe(false);
    expect(ehProprioAvaliado('colab-1', null)).toBe(false);
    expect(ehProprioAvaliado(undefined, undefined)).toBe(false);
    expect(ehProprioAvaliado('', '')).toBe(false);
  });
});

describe('assertNaoEhProprioAvaliado', () => {
  it('passa quando é avaliação de terceiro', () => {
    expect(() => assertNaoEhProprioAvaliado('colab-1', 'colab-2')).not.toThrow();
  });

  it('nomeia a ação recusada na mensagem', () => {
    expect(() => assertNaoEhProprioAvaliado('c1', 'c1', 'recalcular')).toThrow(/recalcular/);
    expect(() => assertNaoEhProprioAvaliado('c1', 'c1', 'reabrir')).toThrow(/reabrir/);
  });
});

describe('marcarRestricoes — marca, nunca filtra', () => {
  const linhas = [{ avaliadoId: 'c1' }, { avaliadoId: 'c2' }, { avaliadoId: 'c3' }];

  it('preserva a quantidade de linhas', () => {
    expect(marcarRestricoes(linhas, 'c2')).toHaveLength(3);
  });

  it('marca só a do próprio, com o mesmo texto que a auditoria usa', () => {
    const [a, b, c] = marcarRestricoes(linhas, 'c2');
    expect(a.restrita).toBe(false);
    expect(b).toMatchObject({ restrita: true, motivoRestricao: MOTIVO_ACESSO_RESTRITO });
    expect(c.restrita).toBe(false);
  });

  it('preserva os campos originais da linha', () => {
    const comDados = [{ avaliadoId: 'c1', nome: 'Fulano', nota: 88 }];
    expect(marcarRestricoes(comDados, 'c1')[0]).toMatchObject({ nome: 'Fulano', nota: 88 });
  });

  it('sem identidade resolvida, não marca nada', () => {
    expect(marcarRestricoes(linhas, null).every((l) => !l.restrita)).toBe(true);
  });
});

describe('conflitoDeInstrumento', () => {
  it('acusa quando o avaliado é um dos autores do modelo', () => {
    expect(conflitoDeInstrumento('c1', ['c1', 'c9'])).toBe(true);
  });

  it('não acusa quando o avaliado não montou o modelo', () => {
    expect(conflitoDeInstrumento('c2', ['c1', 'c9'])).toBe(false);
    expect(conflitoDeInstrumento('c2', [])).toBe(false);
  });

  it('é propriedade da AVALIAÇÃO — não depende de quem está olhando', () => {
    // Por isso a função não recebe o usuário logado: o conflito é o mesmo para o
    // avaliador, para o RH e no relatório.
    expect(conflitoDeInstrumento.length).toBe(2);
  });
});

describe('⭐ escopo da reapuração em massa', () => {
  it('aceita ciclo inteiro', () => {
    expect(() => assertEscopoReapuracaoValido({ tipo: 'CICLO', cicloId: 'c1' })).not.toThrow();
  });

  it('aceita uma aplicação', () => {
    expect(() => assertEscopoReapuracaoValido({ tipo: 'APLICACAO', aplicacaoId: 'a1' })).not.toThrow();
  });

  it('recusa escopo sem alvo — seria "reapurar o quê?"', () => {
    expect(() => assertEscopoReapuracaoValido({ tipo: 'CICLO', cicloId: '' })).toThrow(/ciclo inteiro/);
    expect(() => assertEscopoReapuracaoValido({ tipo: 'APLICACAO', aplicacaoId: '' })).toThrow();
  });

  it('a mensagem diz por que não existe recorte por colaborador', () => {
    // A porta dos fundos: escolher o filtro que isola a própria linha
    // contornaria a separação de funções por um caminho legítimo.
    expect(() => assertEscopoReapuracaoValido({ tipo: 'CICLO', cicloId: '' })).toThrow(
      /separação de funções/,
    );
  });
});

/**
 * ⭐⭐ DESIGNAÇÃO — "esta avaliação é MINHA PARA FAZER?".
 *
 * Pergunta diferente da separação de funções ("é SOBRE MIM?"), e é por isso que
 * são funções diferentes. Trocar uma pela outra é o erro que se repete.
 */
describe('designação — quem escreve é o avaliador designado', () => {
  it('reconhece o avaliador designado, e só ele', () => {
    expect(ehAvaliadorDesignado('c1', 'c1')).toBe(true);
    expect(ehAvaliadorDesignado('c1', 'c2')).toBe(false);
  });

  it('sem id resolvido não afirma que é o designado', () => {
    expect(ehAvaliadorDesignado(null, 'c1')).toBe(false);
    expect(ehAvaliadorDesignado('c1', undefined)).toBe(false);
  });

  it.each(['responder', 'editar'] as const)(
    'recusa %s de terceiro mesmo com o papel de leitura do RH',
    (acao) => {
      expect(motivoParaRecusarDeTerceiro(acao, true)).toMatch(/Só o avaliador designado/);
      expect(motivoParaRecusarDeTerceiro(acao, false)).toMatch(/Só o avaliador designado/);
    },
  );

  it('abrir de terceiro: passa para o RH, recusa para os demais', () => {
    expect(motivoParaRecusarDeTerceiro('abrir', true)).toBeNull();
    expect(motivoParaRecusarDeTerceiro('abrir', false)).toMatch(/designada a outra pessoa/);
  });

  it.each(['reabrir', 'recalcular'] as const)(
    '%s é ato DO RH sobre avaliação alheia — a designação não se aplica',
    (acao) => {
      expect(motivoParaRecusarDeTerceiro(acao, true)).toBeNull();
      expect(motivoParaRecusarDeTerceiro(acao, false)).toBeNull();
    },
  );

  /**
   * ⚠️ INVARIANTE: toda ação da união tem exigência declarada. O `Record` já
   * quebra a COMPILAÇÃO se faltar uma — este teste cobre o caso de alguém
   * "resolver" o erro de tipo com um valor qualquer.
   */
  it('nenhuma ação fica sem exigência declarada', () => {
    const acoes: AcaoAvaliacao[] = ['abrir', 'editar', 'reabrir', 'recalcular', 'responder'];
    for (const acao of acoes) {
      expect(EXIGENCIA_POR_ACAO[acao]).toMatch(/^(DESIGNADO|DESIGNADO_OU_LEITOR_RH|ATO_DO_RH)$/);
    }
    expect(Object.keys(EXIGENCIA_POR_ACAO).sort()).toEqual([...acoes].sort());
  });

  it('a mensagem da escrita diz que nem o RH responde no lugar do avaliador', () => {
    expect(() => assertPodeAgirSobreAvaliacaoDeOutro('editar', true)).toThrow(/nem o RH responde/);
  });

  it('ação desconhecida falha FECHADO — recusa, não passa por omissão', () => {
    // Não é hipótese: `responder` e `editar` existiram sem exigência nenhuma até
    // 06/09. O default de quem não sabe tem de ser recusar.
    expect(() => assertPodeAgirSobreAvaliacaoDeOutro('acao-nova' as never, true)).toThrow();
  });
});
