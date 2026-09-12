import {
  pesosDerivados,
  pontuacaoMaximaDoArranjo,
  ClassificacaoSemPesoError,
  type QuestaoDoArranjo,
} from './peso-derivado.js';

const q = (perguntaId: string, classificacaoId: string, ordem: number): QuestaoDoArranjo => ({
  perguntaId,
  classificacaoId,
  ordem,
});

describe('pesosDerivados', () => {
  it('divide igualmente quando a divisão é exata', () => {
    const r = pesosDerivados([q('a', 'G', 0), q('b', 'G', 1), q('c', 'G', 2)], [
      { classificacaoId: 'G', peso: 9 },
    ]);
    expect(r.map((x) => x.peso)).toEqual([3, 3, 3]);
  });

  it('dá o centavo do resto às PRIMEIRAS por ordem, e a soma fecha exata', () => {
    const r = pesosDerivados([q('a', 'G', 0), q('b', 'G', 1), q('c', 'G', 2)], [
      { classificacaoId: 'G', peso: 16 },
    ]);
    expect(r.map((x) => x.peso)).toEqual([5.34, 5.33, 5.33]);
    expect(r.reduce((s, x) => s + x.peso, 0)).toBeCloseTo(16, 10);
  });

  it('a ordem das questões na ENTRADA não muda o resultado', () => {
    const ordenado = pesosDerivados([q('a', 'G', 0), q('b', 'G', 1), q('c', 'G', 2)], [
      { classificacaoId: 'G', peso: 16 },
    ]);
    const embaralhado = pesosDerivados([q('c', 'G', 2), q('a', 'G', 0), q('b', 'G', 1)], [
      { classificacaoId: 'G', peso: 16 },
    ]);
    // Mesmo peso para a MESMA questão — senão a nota mudaria entre duas
    // leituras do mesmo arranjo, sem ninguém ter mexido em nada.
    const porId = (xs: ReturnType<typeof pesosDerivados>) =>
      Object.fromEntries(xs.map((x) => [x.perguntaId, x.peso]));
    expect(porId(embaralhado)).toEqual(porId(ordenado));
  });

  it('questão única leva o peso inteiro da classificação', () => {
    const r = pesosDerivados([q('a', 'G', 0)], [{ classificacaoId: 'G', peso: 13 }]);
    expect(r).toEqual([{ perguntaId: 'a', classificacaoId: 'G', peso: 13, pesoExato: 13 }]);
  });

  it('classificação com peso e SEM questão é ignorada (arranjo pela metade)', () => {
    const r = pesosDerivados([q('a', 'G', 0)], [
      { classificacaoId: 'G', peso: 10 },
      { classificacaoId: 'VAZIA', peso: 5 },
    ]);
    expect(r).toHaveLength(1);
  });

  it('⭐ questão com classificação SEM peso falha alto — valeria zero em silêncio', () => {
    expect(() => pesosDerivados([q('a', 'ORFA', 0)], [{ classificacaoId: 'G', peso: 10 }])).toThrow(
      ClassificacaoSemPesoError,
    );
  });

  it('distribui o resto de 10 ÷ 3 = 3,34 / 3,33 / 3,33', () => {
    const r = pesosDerivados([q('a', 'G', 0), q('b', 'G', 1), q('c', 'G', 2)], [
      { classificacaoId: 'G', peso: 10 },
    ]);
    expect(r.map((x) => x.peso)).toEqual([3.34, 3.33, 3.33]);
  });
});

describe('⭐⭐ reprodução do instrumento herdado — os 44 pesos reais', () => {
  /**
   * Os pesos que estavam gravados em `pergunta.peso` antes da migration do
   * acervo (20260911230000). Se este teste quebrar, a derivação parou de
   * reproduzir o instrumento do Protheus — e a nota de todo mundo mudou.
   */
  const INSTRUMENTO: {
    perfil: string;
    grupos: { nome: string; peso: number; pesosEsperados: number[] }[];
  }[] = [
    {
      perfil: 'Administrativo',
      grupos: [
        { nome: 'Assiduidade e Pontualidade', peso: 12, pesosEsperados: [6, 6] },
        { nome: 'Relacionamento e Conduta', peso: 16, pesosEsperados: [5.34, 5.33, 5.33] },
        { nome: 'Iniciativa e Adaptabilidade', peso: 16, pesosEsperados: [5.34, 5.33, 5.33] },
        { nome: 'Qualidade e Organização', peso: 16, pesosEsperados: [5.34, 5.33, 5.33] },
      ],
    },
    {
      perfil: 'Operação de Loja',
      grupos: [
        { nome: 'Assiduidade e Pontualidade', peso: 9, pesosEsperados: [4.5, 4.5] },
        { nome: 'Relacionamento e Conduta', peso: 10, pesosEsperados: [3.34, 3.33, 3.33] },
        { nome: 'Iniciativa e Adaptabilidade', peso: 9, pesosEsperados: [3, 3, 3] },
        { nome: 'Qualidade e Organização', peso: 9, pesosEsperados: [3, 3, 3] },
        { nome: 'Atendimento ao Cliente', peso: 13, pesosEsperados: [13] },
        { nome: 'Metas e Trabalho sob Pressão', peso: 5, pesosEsperados: [5] },
        { nome: 'Apresentação Pessoal', peso: 5, pesosEsperados: [5] },
      ],
    },
    {
      perfil: 'Produção e Indústria',
      grupos: [
        { nome: 'Assiduidade e Pontualidade', peso: 10, pesosEsperados: [5, 5] },
        { nome: 'Relacionamento e Conduta', peso: 9, pesosEsperados: [3, 3, 3] },
        { nome: 'Iniciativa e Adaptabilidade', peso: 9, pesosEsperados: [3, 3, 3] },
        { nome: 'Qualidade e Organização', peso: 12, pesosEsperados: [4, 4, 4] },
        { nome: 'Conhecimento Técnico', peso: 12, pesosEsperados: [12] },
        { nome: 'Metas e Trabalho sob Pressão', peso: 5, pesosEsperados: [5] },
        { nome: 'Apresentação Pessoal', peso: 3, pesosEsperados: [3] },
      ],
    },
    {
      perfil: '[DEMO] Modelo de Treinamento',
      grupos: [
        { nome: 'Assiduidade e Pontualidade', peso: 25, pesosEsperados: [12.5, 12.5] },
        { nome: 'Relacionamento e Conduta', peso: 25, pesosEsperados: [8.34, 8.33, 8.33] },
      ],
    },
  ];

  it.each(INSTRUMENTO)('$perfil reproduz os pesos gravados', ({ grupos }) => {
    for (const g of grupos) {
      const questoes = g.pesosEsperados.map((_, i) => q(`${g.nome}#${i}`, g.nome, i));
      const derivados = pesosDerivados(questoes, [{ classificacaoId: g.nome, peso: g.peso }]);
      expect(derivados.map((d) => d.peso)).toEqual(g.pesosEsperados);
    }
  });

  it.each(INSTRUMENTO.filter((p) => !p.perfil.startsWith('[DEMO]')))(
    '$perfil soma exatamente 60, e a pontuação máxima é 72',
    ({ grupos }) => {
      const questoes = grupos.flatMap((g) =>
        g.pesosEsperados.map((_, i) => q(`${g.nome}#${i}`, g.nome, i)),
      );
      const pesos = grupos.map((g) => ({ classificacaoId: g.nome, peso: g.peso }));
      const derivados = pesosDerivados(questoes, pesos);

      const soma = derivados.reduce((s, d) => s + Math.round(d.peso * 100), 0) / 100;
      expect(soma).toBe(60);

      // Todas as alternativas do instrumento herdado valem no máximo 1,2.
      const maior = new Map(derivados.map((d) => [d.perguntaId, 1.2]));
      expect(pontuacaoMaximaDoArranjo(derivados, maior)).toBe(72);
    },
  );
});

describe('pontuacaoMaximaDoArranjo', () => {
  it('falha alto quando uma questão do arranjo não tem alternativa', () => {
    expect(() =>
      pontuacaoMaximaDoArranjo([{ perguntaId: 'a', peso: 5 }], new Map()),
    ).toThrow(/sem alternativas/);
  });
});

describe('⭐⭐ pesoExato — a nota não pode depender de quem ficou em primeiro', () => {
  /**
   * Medido na varredura de 12/09: com pesos `3,34 / 3,33 / 3,33` e as MESMAS
   * respostas, a nota do grupo dá **66,68 ou 66,65** conforme qual questão
   * ficou com o centavo do resto. Até 0,08 no grupo e 0,01 na nota final — e
   * quem decide o desvio é a ORDEM no arranjo, escolha de quem monta.
   */
  const arranjo = [
    { perguntaId: 'q1', classificacaoId: 'c1', ordem: 0 },
    { perguntaId: 'q2', classificacaoId: 'c1', ordem: 1 },
    { perguntaId: 'q3', classificacaoId: 'c1', ordem: 2 },
  ];
  const pesos = [{ classificacaoId: 'c1', peso: 10 }];

  it('o EXIBIDO é o arredondado, com o centavo na primeira', () => {
    expect(pesosDerivados(arranjo, pesos).map((p) => p.peso)).toEqual([3.34, 3.33, 3.33]);
  });

  it('o EXATO é igual para todas — é a divisão pura', () => {
    const exatos = pesosDerivados(arranjo, pesos).map((p) => p.pesoExato);
    expect(exatos[0]).toBe(exatos[1]);
    expect(exatos[1]).toBe(exatos[2]);
    expect(exatos[0]).toBeCloseTo(10 / 3, 12);
  });

  /** ⚠️ E os dois somam o peso da classificação: 10, pelos dois caminhos. */
  it('as duas somas fecham em 10', () => {
    const d = pesosDerivados(arranjo, pesos);
    expect(d.reduce((s, p) => s + p.peso, 0)).toBeCloseTo(10, 10);
    expect(d.reduce((s, p) => s + p.pesoExato, 0)).toBeCloseTo(10, 10);
  });

  it('a ordem muda o EXIBIDO e não muda o EXATO', () => {
    const invertido = [
      { perguntaId: 'q3', classificacaoId: 'c1', ordem: 0 },
      { perguntaId: 'q2', classificacaoId: 'c1', ordem: 1 },
      { perguntaId: 'q1', classificacaoId: 'c1', ordem: 2 },
    ];
    const a = new Map(pesosDerivados(arranjo, pesos).map((p) => [p.perguntaId, p]));
    const b = new Map(pesosDerivados(invertido, pesos).map((p) => [p.perguntaId, p]));
    expect(a.get('q1')!.peso).not.toBe(b.get('q1')!.peso); // 3,34 × 3,33
    expect(a.get('q1')!.pesoExato).toBe(b.get('q1')!.pesoExato);
  });
});
