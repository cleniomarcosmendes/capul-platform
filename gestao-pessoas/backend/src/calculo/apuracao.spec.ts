import { apurar, type CriterioApurado } from './apuracao.js';

const criterio = (over: Partial<CriterioApurado> = {}): CriterioApurado => ({
  criterioId: 'c1',
  criterioNome: 'Escolaridade',
  peso: 10,
  valorBruto: null,
  valorTexto: '45',
  faixaId: 'f1',
  pontuacao: 25,
  semDado: false,
  ...over,
});

describe('apuração — questionário + critérios, normalizados', () => {
  it('combina a nota do questionário com os critérios pelos pesos', () => {
    // (80×60 + 100×10 + 50×10) / (60+10+10) = (4800+1000+500)/80 = 78,75
    const r = apurar({
      notaAvaliacao: 80,
      pesoAvaliacao: 60,
      criterios: [
        criterio({ pontuacao: 100 }),
        criterio({ criterioId: 'c2', criterioNome: 'Tempo de Empresa', pontuacao: 50 }),
      ],
    });
    expect(r.notaFinal).toBe(78.75);
    expect(r.notaAvaliacao).toBe(80);
  });

  it('notaCriterios é a média ponderada SÓ dos critérios, para leitura separada', () => {
    const r = apurar({
      notaAvaliacao: 80,
      pesoAvaliacao: 60,
      criterios: [criterio({ pontuacao: 100, peso: 10 }), criterio({ criterioId: 'c2', pontuacao: 50, peso: 10 })],
    });
    expect(r.notaCriterios).toBe(75);
  });

  describe('⭐ renormalização — o conserto do bug mais grave do modelo antigo', () => {
    it('critério sem dado sai do numerador E do denominador', () => {
      // No select antigo o NVL ficava fora da soma e NULL + n = NULL: quem não
      // tinha registro de função saía com média ZERO, parecendo péssimo
      // desempenho quando era falta de cadastro.
      const r = apurar({
        notaAvaliacao: 80,
        pesoAvaliacao: 60,
        criterios: [
          criterio({ pontuacao: 100, peso: 10 }),
          criterio({ criterioId: 'c2', pontuacao: null, semDado: true, peso: 10 }),
        ],
      });
      // (80×60 + 100×10) / (60+10) = 5800/70 = 82,86 — e NÃO 5800/80
      expect(r.notaFinal).toBe(82.86);
      expect(r.houveRenormalizacao).toBe(true);
    });

    it('quem não tem o dado NÃO é punido: a nota não cai por falta de cadastro', () => {
      const comDado = apurar({
        notaAvaliacao: 80,
        pesoAvaliacao: 60,
        criterios: [criterio({ pontuacao: 100 })],
      });
      const semDado = apurar({
        notaAvaliacao: 80,
        pesoAvaliacao: 60,
        criterios: [criterio({ pontuacao: null, semDado: true })],
      });
      // Sem o critério, a nota volta para a do questionário — não vai a zero.
      expect(semDado.notaFinal).toBe(80);
      expect(comDado.notaFinal).toBeGreaterThan(semDado.notaFinal);
    });

    it('não marca renormalização quando todos têm dado', () => {
      const r = apurar({ notaAvaliacao: 80, pesoAvaliacao: 60, criterios: [criterio()] });
      expect(r.houveRenormalizacao).toBe(false);
    });
  });

  describe('⭐ "todos sem dado" cai da fórmula, sem caso especial', () => {
    it('sobrando só o questionário, a nota final É a nota do questionário', () => {
      const r = apurar({
        notaAvaliacao: 73.42,
        pesoAvaliacao: 60,
        criterios: [
          criterio({ pontuacao: null, semDado: true }),
          criterio({ criterioId: 'c2', pontuacao: null, semDado: true }),
        ],
      });
      expect(r.notaFinal).toBe(73.42);
      expect(r.notaCriterios).toBeNull();
    });

    it('nunca dá zero por ausência de critério', () => {
      const r = apurar({
        notaAvaliacao: 91,
        pesoAvaliacao: 1,
        criterios: [criterio({ pontuacao: null, semDado: true })],
      });
      expect(r.notaFinal).toBe(91);
    });

    it('aplicação sem critério nenhum funciona', () => {
      const r = apurar({ notaAvaliacao: 55, pesoAvaliacao: 100, criterios: [] });
      expect(r.notaFinal).toBe(55);
      expect(r.houveRenormalizacao).toBe(false);
    });
  });

  it('o peso é por PERFIL: o mesmo critério pesa diferente em cada aplicação', () => {
    // É o que a AplicacaoCriterio existe para permitir — escolaridade pesa mais
    // no administrativo que na fábrica.
    const fabrica = apurar({
      notaAvaliacao: 80, pesoAvaliacao: 60, criterios: [criterio({ pontuacao: 100, peso: 6 })],
    });
    const administrativo = apurar({
      notaAvaliacao: 80, pesoAvaliacao: 60, criterios: [criterio({ pontuacao: 100, peso: 12 })],
    });
    expect(administrativo.notaFinal).toBeGreaterThan(fabrica.notaFinal);
  });

  it('recusa pesoAvaliacao zero em vez de dividir por zero', () => {
    expect(() =>
      apurar({ notaAvaliacao: 80, pesoAvaliacao: 0, criterios: [] }),
    ).toThrow(/maior que zero/);
  });
});
