import {
  validarFaixasDoCriterio,
  assertFaixasValidas,
  FaixasInvalidasError,
  type FaixaValidavel,
} from './faixa.validator.js';

const num = (
  inf: number | null,
  sup: number | null,
  ordem: number,
  o: Partial<FaixaValidavel> = {},
): FaixaValidavel => ({
  tipo: 'NUMERICA',
  limiteInferior: inf,
  limiteSuperior: sup,
  inclusivoInf: false,
  inclusivoSup: true,
  valorDominio: null,
  pontuacao: 50,
  rotulo: null,
  ordem,
  ...o,
});

const dom = (valor: string | null, ordem: number, o: Partial<FaixaValidavel> = {}): FaixaValidavel => ({
  tipo: 'DOMINIO',
  limiteInferior: null,
  limiteSuperior: null,
  inclusivoInf: false,
  inclusivoSup: true,
  valorDominio: valor,
  pontuacao: 25,
  rotulo: null,
  ordem,
  ...o,
});

describe('⭐⭐ os critérios que rodam HOJE continuam válidos', () => {
  /**
   * Se este bloco quebrar, a validação está reprovando o instrumento em
   * produção — e o erro é dela, não do cadastro. É a diferença entre esta regra
   * e a dos CONCEITOS (0–100 fechado), que reprovaria os dois.
   */
  it('TEMPO_EMPRESA — ponta aberta e faixa de ponto único', () => {
    const faixas = [
      num(0, 0, 0, { inclusivoInf: true, pontuacao: 0, rotulo: 'Menos de 1 ano' }),
      num(0, 3, 1, { pontuacao: 25, rotulo: 'Até 3 anos' }),
      num(3, 5, 2, { pontuacao: 50, rotulo: 'De 3 a 5 anos' }),
      num(5, 7, 3, { pontuacao: 75, rotulo: 'De 5 a 7 anos' }),
      num(7, null, 4, { pontuacao: 100, rotulo: 'Mais de 7 anos' }),
    ];
    expect(validarFaixasDoCriterio('NUMERICO', faixas)).toEqual([]);
  });

  it('ESCOLARIDADE — 13 códigos de domínio distintos', () => {
    const codigos = ['10', '20', '25', '30', '35', '40', '45', '50', '55', '65', '75', '85', '95'];
    const faixas = codigos.map((c, i) => dom(c, i));
    expect(validarFaixasDoCriterio('DOMINIO', faixas)).toEqual([]);
  });

  it('critério ainda sem faixa nenhuma não é erro de cadastro', () => {
    expect(validarFaixasDoCriterio('NUMERICO', [])).toEqual([]);
  });
});

describe('faixas numéricas', () => {
  it('acusa BURACO entre duas faixas', () => {
    const p = validarFaixasDoCriterio('NUMERICO', [num(0, 3, 0), num(5, 7, 1)]);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/buraco/i);
    expect(p[0]).toMatch(/sem acusar erro/);
  });

  it('acusa SOBREPOSIÇÃO de intervalo', () => {
    const p = validarFaixasDoCriterio('NUMERICO', [num(0, 5, 0), num(3, 7, 1)]);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/sobreposição/i);
    expect(p[0]).toMatch(/ordem de cadastro/);
  });

  /**
   * ⭐ O caso que ninguém vê: os intervalos se encostam certinho, mas o valor da
   * fronteira pertence às duas — ou a nenhuma. Nenhum dos dois aparece olhando
   * a lista de limites.
   */
  it('acusa a FRONTEIRA incluída nas DUAS', () => {
    const p = validarFaixasDoCriterio('NUMERICO', [
      num(0, 3, 0, { inclusivoSup: true }),
      num(3, 5, 1, { inclusivoInf: true }),
    ]);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/cai em .* e em .* ao mesmo tempo/);
  });

  it('acusa a FRONTEIRA em NENHUMA das duas', () => {
    const p = validarFaixasDoCriterio('NUMERICO', [
      num(0, 3, 0, { inclusivoSup: false }),
      num(3, 5, 1, { inclusivoInf: false }),
    ]);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/não cai em .* nem em/);
  });

  it('só a última pode ser aberta em cima', () => {
    const p = validarFaixasDoCriterio('NUMERICO', [num(0, null, 0), num(3, null, 1)]);
    expect(p.some((x) => /sem limite superior/.test(x))).toBe(true);
  });

  it('faixa de ponto único sem fechar as duas pontas é vazia', () => {
    const p = validarFaixasDoCriterio('NUMERICO', [num(5, 5, 0, { inclusivoInf: false })]);
    expect(p[0]).toMatch(/nenhum valor cabe dentro dela/);
  });

  it('a ordem DIGITADA não esconde buraco — a checagem ordena pelo limite', () => {
    // Mesmas faixas do teste do buraco, com `ordem` invertida.
    const p = validarFaixasDoCriterio('NUMERICO', [num(5, 7, 0), num(0, 3, 1)]);
    expect(p[0]).toMatch(/buraco/i);
  });
});

describe('faixas de domínio', () => {
  it('acusa código repetido', () => {
    const p = validarFaixasDoCriterio('DOMINIO', [dom('45', 0), dom('45', 1)]);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/está em duas faixas/);
  });

  it('acusa faixa sem valor — nunca casaria com nada', () => {
    const p = validarFaixasDoCriterio('DOMINIO', [dom('  ', 0)]);
    expect(p[0]).toMatch(/sem valor/);
  });
});

describe('coerência com o tipo do critério', () => {
  it('recusa faixa NUMERICA em critério de DOMINIO', () => {
    const p = validarFaixasDoCriterio('DOMINIO', [num(0, 3, 0)]);
    expect(p[0]).toMatch(/tipo errado/);
  });

  it('recusa faixa DOMINIO em critério NUMERICO', () => {
    const p = validarFaixasDoCriterio('NUMERICO', [dom('45', 0)]);
    expect(p[0]).toMatch(/tipo errado/);
  });

  it('para na divergência de tipo, sem cascatear mensagens', () => {
    const p = validarFaixasDoCriterio('NUMERICO', [dom('45', 0), dom('45', 1)]);
    expect(p).toHaveLength(1);
  });
});

describe('pontuação', () => {
  it.each([-1, 101, 250])('recusa pontuação %s (fora de 0 a 100)', (p) => {
    expect(validarFaixasDoCriterio('NUMERICO', [num(0, null, 0, { pontuacao: p })])[0]).toMatch(
      /fora de 0 a 100/,
    );
  });

  it('aceita 0 e 100', () => {
    expect(
      validarFaixasDoCriterio('NUMERICO', [
        num(0, 5, 0, { inclusivoInf: true, pontuacao: 0 }),
        num(5, null, 1, { pontuacao: 100 }),
      ]),
    ).toEqual([]);
  });
});

describe('assertFaixasValidas', () => {
  it('lança com todos os problemas juntos', () => {
    expect(() => assertFaixasValidas('NUMERICO', [num(0, 3, 0), num(5, 7, 1)])).toThrow(
      FaixasInvalidasError,
    );
  });

  it('não lança quando está tudo certo', () => {
    expect(() => assertFaixasValidas('NUMERICO', [num(0, null, 0, { inclusivoInf: true })])).not.toThrow();
  });
});
