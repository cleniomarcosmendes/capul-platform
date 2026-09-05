import { localizarFaixa, type Faixa } from './faixa.js';

const numerica = (
  inf: number | null, sup: number | null, pontuacao: number, ordem: number,
  incInf = false, incSup = true,
): Faixa => ({
  id: `f${ordem}`, tipo: 'NUMERICA', limiteInferior: inf, limiteSuperior: sup,
  inclusivoInf: incInf, inclusivoSup: incSup, valorDominio: null, pontuacao, rotulo: null, ordem,
});

/** As faixas reais de TEMPO_EMPRESA, do select antigo. */
const TEMPO_EMPRESA: Faixa[] = [
  numerica(0, 0, 0, 0, true, true),
  numerica(0, 3, 25, 1),
  numerica(3, 5, 50, 2),
  numerica(5, 7, 75, 3),
  numerica(7, null, 100, 4),
];

const dominio = (valor: string, pontuacao: number, ordem: number): Faixa => ({
  id: `d${ordem}`, tipo: 'DOMINIO', limiteInferior: null, limiteSuperior: null,
  inclusivoInf: false, inclusivoSup: true, valorDominio: valor, pontuacao, rotulo: null, ordem,
});

const ESCOLARIDADE: Faixa[] = [dominio('45', 25, 0), dominio('50', 50, 1), dominio('55', 75, 2)];

const num = (v: number) => ({ valorNumerico: v, valorTexto: null, semDado: false });
const txt = (v: string) => ({ valorNumerico: null, valorTexto: v, semDado: false });

describe('localizarFaixa — numérica', () => {
  it.each([
    [0, 0], [0.5, 25], [3, 25], [3.01, 50], [5, 50], [6, 75], [7, 75], [7.01, 100], [40, 100],
  ])('%s anos -> %s pontos', (valor, pontuacao) => {
    expect(localizarFaixa(TEMPO_EMPRESA, num(valor as number))?.pontuacao).toBe(pontuacao);
  });

  it('respeita inclusivo/exclusivo nas bordas — nenhuma sobreposição', () => {
    // 3 anos exatos cai em "até 3 anos" (superior inclusivo) e não em "de 3 a 5"
    // (inferior exclusivo). Sem isso, duas faixas conteriam o mesmo valor e a
    // resposta dependeria da ordem.
    expect(localizarFaixa(TEMPO_EMPRESA, num(3))?.id).toBe('f1');
  });

  it('limite superior nulo é faixa aberta', () => {
    expect(localizarFaixa(TEMPO_EMPRESA, num(99))?.pontuacao).toBe(100);
  });

  it('não depende da ordem em que as faixas chegam', () => {
    expect(localizarFaixa([...TEMPO_EMPRESA].reverse(), num(4))?.pontuacao).toBe(50);
  });

  it('⭐ valor fora de todas as faixas devolve null, NUNCA zero', () => {
    // Não existe faixa "else 0" (C9): pontuar zero puniria a pessoa por um
    // critério mal cadastrado. Quem chama trata como semDado e alerta o RH.
    expect(localizarFaixa(TEMPO_EMPRESA, num(-1))).toBeNull();
  });
});

describe('localizarFaixa — domínio', () => {
  it('casa pelo código exato', () => {
    expect(localizarFaixa(ESCOLARIDADE, txt('50'))?.pontuacao).toBe(50);
  });

  it('código não mapeado devolve null (lacuna de cadastro, não nota zero)', () => {
    // Código novo no SX5 que ninguém cadastrou. A pessoa não pode levar zero
    // por isso.
    expect(localizarFaixa(ESCOLARIDADE, txt('99'))).toBeNull();
  });

  it('não confunde código com número', () => {
    expect(localizarFaixa(ESCOLARIDADE, num(50))).toBeNull();
  });
});

describe('localizarFaixa — sem dado', () => {
  it('nem procura quando o valor está ausente', () => {
    expect(localizarFaixa(TEMPO_EMPRESA, { valorNumerico: null, valorTexto: null, semDado: true })).toBeNull();
  });
});
