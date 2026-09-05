import {
  AvaliacaoIncompletaError,
  calcularNotaAvaliacao,
  notaPorGrupo,
  type ItemRespondido,
} from './nota-avaliacao.js';

/** As 4 alternativas âncora do instrumento real: 0,3 / 0,6 / 0,9 / 1,2. */
const item = (over: Partial<ItemRespondido> = {}): ItemRespondido => ({
  perguntaId: 'p1',
  peso: 1,
  maiorValor: 1.2,
  valorRespondido: 1.2,
  ...over,
});

describe('notaAvaliacao', () => {
  it('tudo na melhor alternativa dá 100', () => {
    const itens = [item(), item({ perguntaId: 'p2' }), item({ perguntaId: 'p3' })];
    expect(calcularNotaAvaliacao(itens).nota).toBe(100);
  });

  it('tudo na pior alternativa dá 25 — a escala do Protheus começa em 0,3, não em zero', () => {
    // 0,3 / 1,2 = 25%. Quem responde tudo no pior degrau não tira zero, e é
    // assim que o instrumento sempre funcionou.
    const itens = [item({ valorRespondido: 0.3 }), item({ perguntaId: 'p2', valorRespondido: 0.3 })];
    expect(calcularNotaAvaliacao(itens).nota).toBe(25);
  });

  it('⭐ o PESO da pergunta muda a nota', () => {
    // Duas perguntas, uma no topo e outra no fundo. Com pesos iguais, 62,5.
    const iguais = [
      item({ valorRespondido: 1.2, peso: 1 }),
      item({ perguntaId: 'p2', valorRespondido: 0.3, peso: 1 }),
    ];
    expect(calcularNotaAvaliacao(iguais).nota).toBe(62.5);

    // Com a boa pesando 3x, a nota sobe.
    const ponderadas = [
      item({ valorRespondido: 1.2, peso: 3 }),
      item({ perguntaId: 'p2', valorRespondido: 0.3, peso: 1 }),
    ];
    // (1,2×3 + 0,3×1) / (1,2×3 + 1,2×1) = 3,9 / 4,8 = 81,25
    expect(calcularNotaAvaliacao(ponderadas).nota).toBe(81.25);
  });

  it('⭐ o denominador é CALCULADO: acrescentar pergunta não estoura os 100', () => {
    // O modelo antigo dividia por 18 fixo — a 16ª pergunta levava a nota acima
    // de 100 sem acusar erro.
    const dezesseis = Array.from({ length: 16 }, (_, i) => item({ perguntaId: `p${i}` }));
    expect(calcularNotaAvaliacao(dezesseis).nota).toBe(100);
    expect(calcularNotaAvaliacao(dezesseis).denominador).toBeCloseTo(19.2, 4);
  });

  it('respeita a escala PRÓPRIA de cada questão', () => {
    // A escala é por questão (não há tabela de escala global): uma pergunta com
    // teto 2,0 e outra com 1,2 convivem.
    const mistas = [
      item({ maiorValor: 2, valorRespondido: 1, peso: 1 }),
      item({ perguntaId: 'p2', maiorValor: 1.2, valorRespondido: 1.2, peso: 1 }),
    ];
    // (1 + 1,2) / (2 + 1,2) = 2,2 / 3,2 = 68,75
    expect(calcularNotaAvaliacao(mistas).nota).toBe(68.75);
  });

  it('arredonda em duas casas, como o Decimal(6,2) do banco', () => {
    const itens = [item({ valorRespondido: 0.9 }), item({ perguntaId: 'p2', valorRespondido: 0.6 })];
    // 1,5 / 2,4 = 62,5
    expect(calcularNotaAvaliacao(itens).nota).toBe(62.5);
  });

  describe('recusas', () => {
    it('⭐ recusa envio com pergunta sem resposta', () => {
      // Calcular sobre questionário pela metade daria nota mais baixa, e ela
      // pareceria desempenho em vez de formulário incompleto.
      expect(() => calcularNotaAvaliacao([item()], 3)).toThrow(AvaliacaoIncompletaError);
      expect(() => calcularNotaAvaliacao([item()], 3)).toThrow(/3 pergunta\(s\) sem resposta/);
    });

    it('recusa questionário vazio', () => {
      expect(() => calcularNotaAvaliacao([])).toThrow(/sem perguntas/);
    });

    it('recusa denominador zero em vez de dividir por zero', () => {
      expect(() => calcularNotaAvaliacao([item({ maiorValor: 0 })])).toThrow(/pontuação máxima/);
    });
  });
});

describe('notaPorGrupo — calculada na leitura, não materializada (ADR-RH-02)', () => {
  // Grupo forte e grupo fraco, de propósito: se os dois dessem a mesma nota, o
  // teste passaria sem provar que o agrupamento funciona.
  const itens = [
    item({ perguntaId: 'a1', grupoId: 'g1', valorRespondido: 1.2, peso: 4.5 }),
    item({ perguntaId: 'a2', grupoId: 'g1', valorRespondido: 1.2, peso: 4.5 }),
    item({ perguntaId: 'b1', grupoId: 'g2', valorRespondido: 0.3, peso: 13 }),
  ];

  it('agrupa por grupoId e devolve a nota de cada grupo', () => {
    // g1: (1,2+1,2)/(1,2+1,2) = 100   |   g2: 0,3/1,2 = 25
    expect(notaPorGrupo(itens)).toEqual([
      { grupoId: 'g1', nota: 100, peso: 9 },
      { grupoId: 'g2', nota: 25, peso: 13 },
    ]);
  });

  it('a nota do grupo não é a nota geral — o grupo pesado puxa o conjunto', () => {
    // Geral: 14,7 / 26,4 = 55,68. Fica entre os 100 do g1 e os 25 do g2, mais
    // perto do g2 porque as perguntas dele pesam mais.
    expect(calcularNotaAvaliacao(itens).nota).toBe(55.68);
    const porGrupo = notaPorGrupo(itens);
    expect(porGrupo.map((g) => g.nota)).not.toContain(55.68);
  });
});
