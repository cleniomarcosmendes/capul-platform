import {
  efeitoDeApagarQuestao,
  efeitoDeDesativarQuestao,
  efeitoDeEditarTexto,
  efeitoDeReclassificar,
  type ContextoQuestao,
} from './efeito-de-questionar.js';

const base: ContextoQuestao = {
  codigo: '004',
  enunciado: 'Assiduidade',
  classificacaoNome: 'Assiduidade e Pontualidade',
  ativa: true,
  respostas: 0,
  arranjos: 0,
  arranjosPublicados: 0,
};

describe('⭐⭐ as duas recusas duras têm causas DIFERENTES', () => {
  /**
   * Resposta gravada trava o TEXTO. A nota não muda (`Resposta.valor` está
   * gravado); o REGISTRO é que passaria a dizer outra coisa.
   */
  it('resposta gravada recusa editar o texto, e oferece a saída', () => {
    const e = efeitoDeEditarTexto({ ...base, respostas: 12 });
    expect(e.acao).toBe('RECUSAR');
    expect(e.frase).toMatch(/12 respostas gravadas/);
    expect(e.frase).toMatch(/a nota delas não muda/);
    expect(e.frase).toMatch(/crie uma questão nova/);
  });

  /** ...mas resposta gravada NÃO impede trocar de classificação sozinha. */
  it('resposta gravada, sem arranjo, não impede reclassificar', () => {
    expect(efeitoDeReclassificar({ ...base, respostas: 12 }).acao).toBe('PERMITIR');
  });

  /**
   * Estar em arranjo trava a CLASSIFICAÇÃO: o peso é derivado, então mover a
   * questão muda o peso de DUAS classificações em cada perfil que a usa.
   */
  it('em arranjo recusa reclassificar, e diz que mexe em peso', () => {
    const e = efeitoDeReclassificar({ ...base, arranjos: 3, arranjosPublicados: 2 });
    expect(e.acao).toBe('RECUSAR');
    expect(e.frase).toMatch(/peso de duas classificações/);
    expect(e.frase).toMatch(/2 estão publicados/);
  });

  /** ...mas estar em arranjo NÃO impede corrigir o texto, se ninguém respondeu. */
  it('em arranjo, sem resposta, permite editar o texto', () => {
    const e = efeitoDeEditarTexto({ ...base, arranjos: 3, arranjosPublicados: 2 });
    expect(e.acao).toBe('PERMITIR');
    expect(e.frase).toMatch(/nenhum peso e nenhuma nota mudam/);
  });
});

describe('desativar e apagar', () => {
  it('desativar permite sempre, e garante que os perfis não mudam', () => {
    const e = efeitoDeDesativarQuestao({ ...base, arranjos: 4, arranjosPublicados: 4 });
    expect(e.acao).toBe('PERMITIR');
    expect(e.frase).toMatch(/deixa de ser oferecida ao montar um perfil/);
    expect(e.frase).toMatch(/nenhuma nota se altera/);
  });

  it('apagar com resposta recusa e manda DESATIVAR — a saída que preserva o histórico', () => {
    const e = efeitoDeApagarQuestao({ ...base, respostas: 5 });
    expect(e.acao).toBe('RECUSAR');
    expect(e.frase).toMatch(/desative/);
    expect(e.frase).toMatch(/histórico fica de pé/);
  });

  it('apagar em arranjo recusa, e diz que sair do perfil REDISTRIBUI peso', () => {
    const e = efeitoDeApagarQuestao({ ...base, arranjos: 2 });
    expect(e.acao).toBe('RECUSAR');
    expect(e.frase).toMatch(/redistribui o peso/);
  });

  it('questão solta: apaga, avisando que não desfaz', () => {
    const e = efeitoDeApagarQuestao(base);
    expect(e.acao).toBe('PERMITIR');
    expect(e.frase).toMatch(/Não desfaz/);
  });
});
