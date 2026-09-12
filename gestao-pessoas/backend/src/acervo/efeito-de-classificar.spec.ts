import {
  efeitoDeApagar,
  efeitoDeDesativar,
  efeitoDeReativar,
  type ContextoClassificacao,
} from './efeito-de-classificar.js';

const base: ContextoClassificacao = {
  nome: 'Assiduidade e Pontualidade',
  ativa: true,
  questoes: 0,
  arranjos: 0,
  arranjosPublicados: 0,
};

describe('apagar classificação', () => {
  it('recusa com questão — a questão ficaria sem classificação nenhuma', () => {
    const e = efeitoDeApagar({ ...base, questoes: 2 });
    expect(e.acao).toBe('RECUSAR');
    expect(e.frase).toMatch(/2 questões/);
    expect(e.frase).toMatch(/Mova-as/);
  });

  it('recusa com peso declarado em perfil', () => {
    const e = efeitoDeApagar({ ...base, arranjos: 1 });
    expect(e.acao).toBe('RECUSAR');
    expect(e.frase).toMatch(/1 perfil\b/);
  });

  it('permite a que não é usada por ninguém', () => {
    expect(efeitoDeApagar(base).acao).toBe('PERMITIR');
  });
});

describe('⭐⭐ desativar — o que ela NÃO faz é a metade que importa', () => {
  /**
   * `ativa` não filtrava nada até 12/09. Ao ganhar significado, ele é estreito
   * de propósito: se desativar mexesse em arranjo publicado, a nota de gente
   * real mudaria por um clique de cadastro.
   */
  it('permite mesmo em uso, e a frase garante que nada muda no que já existe', () => {
    const e = efeitoDeDesativar({ ...base, questoes: 3, arranjos: 4, arranjosPublicados: 4 });
    expect(e.acao).toBe('PERMITIR');
    expect(e.frase).toMatch(/deixa de ser oferecida/);
    expect(e.frase).toMatch(/continuam lá/);
    expect(e.frase).toMatch(/nenhuma nota se altera/);
  });

  it('sem uso, a frase não promete nada sobre questões que não existem', () => {
    const e = efeitoDeDesativar(base);
    expect(e.acao).toBe('PERMITIR');
    expect(e.frase).not.toMatch(/continuam lá/);
  });

  it('recusa desativar a já inativa, e reativar a já ativa', () => {
    expect(efeitoDeDesativar({ ...base, ativa: false }).acao).toBe('RECUSAR');
    expect(efeitoDeReativar(base).acao).toBe('RECUSAR');
    expect(efeitoDeReativar({ ...base, ativa: false }).acao).toBe('PERMITIR');
  });
});
