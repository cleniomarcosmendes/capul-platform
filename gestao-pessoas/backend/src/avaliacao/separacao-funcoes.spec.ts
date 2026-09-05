import {
  MOTIVO_ACESSO_RESTRITO,
  assertNaoEhProprioAvaliado,
  conflitoDeInstrumento,
  ehProprioAvaliado,
  marcarRestricoes,
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
