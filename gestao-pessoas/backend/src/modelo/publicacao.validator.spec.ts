import {
  ModeloNaoPublicavelError,
  assertModeloPublicavel,
  pontuacaoMaxima,
  somatorioPorGrupo,
  validarModeloParaPublicacao,
  type GrupoParaPublicacao,
} from './publicacao.validator.js';

/** As 4 alternativas âncora do instrumento real (RD8010). */
const ALTERNATIVAS = [{ valor: 0.3 }, { valor: 0.6 }, { valor: 0.9 }, { valor: 1.2 }];
const pergunta = (enunciado: string, peso = 1) => ({ enunciado, peso, alternativas: ALTERNATIVAS });

const modeloOk: GrupoParaPublicacao[] = [
  { titulo: 'Assiduidade e Pontualidade', perguntas: [pergunta('Assiduidade', 4.5), pergunta('Pontualidade', 4.5)] },
  { titulo: 'Atendimento ao Cliente', perguntas: [pergunta('Atendimento', 13)] },
];

describe('pontuacaoMaxima — calculada, nunca constante', () => {
  it('é Σ(maior valor da pergunta × peso da pergunta)', () => {
    // (1,2 × 4,5) + (1,2 × 4,5) + (1,2 × 13) = 5,4 + 5,4 + 15,6 = 26,4
    expect(pontuacaoMaxima(modeloOk)).toBeCloseTo(26.4, 4);
  });

  it('⭐ CHECKSUM do Protheus: com todos os pesos iguais a 1, 15 questões dão 18,0', () => {
    // É o mesmo /18 do select antigo, e o que prova que as questões continuam
    // sendo as do RD8010. A conta ponderada nova não pode perder esse ancoradouro.
    const quinzeQuestoes: GrupoParaPublicacao[] = [
      {
        titulo: 'Todas',
        perguntas: Array.from({ length: 15 }, (_, i) => pergunta(`Q${i + 1}`, 1)),
      },
    ];
    expect(pontuacaoMaxima(quinzeQuestoes)).toBeCloseTo(18, 4);
  });

  it('acrescentar pergunta muda o denominador — não fica preso a 18', () => {
    const comUmaAMais = [
      { titulo: 'Todas', perguntas: Array.from({ length: 16 }, (_, i) => pergunta(`Q${i + 1}`, 1)) },
    ];
    expect(pontuacaoMaxima(comUmaAMais)).toBeCloseTo(19.2, 4);
  });
});

describe('somatorioPorGrupo — o balanço que a tela de montagem exibe', () => {
  it('soma os pesos das perguntas de cada grupo', () => {
    const resumo = somatorioPorGrupo(modeloOk);
    expect(resumo).toEqual([
      { titulo: 'Assiduidade e Pontualidade', pesoTotal: 9, percentual: expect.closeTo(40.9, 1) },
      { titulo: 'Atendimento ao Cliente', pesoTotal: 13, percentual: expect.closeTo(59.1, 1) },
    ]);
  });

  it('os percentuais somam 100', () => {
    const total = somatorioPorGrupo(modeloOk).reduce((s, g) => s + g.percentual, 0);
    expect(total).toBeCloseTo(100, 6);
  });
});

describe('validação de publicação — só o questionário', () => {
  it('aprova um modelo coerente', () => {
    expect(validarModeloParaPublicacao(modeloOk)).toEqual([]);
    expect(() => assertModeloPublicavel(modeloOk)).not.toThrow();
  });

  it('recusa modelo sem grupo', () => {
    expect(validarModeloParaPublicacao([])[0]).toContain('nenhum grupo');
  });

  it('recusa grupo sem pergunta', () => {
    expect(validarModeloParaPublicacao([{ titulo: 'Vazio', perguntas: [] }])[0]).toContain(
      'nenhuma pergunta',
    );
  });

  it('recusa pergunta com menos de duas alternativas', () => {
    const ruim = [{ titulo: 'G', perguntas: [{ enunciado: 'Q', peso: 1, alternativas: [{ valor: 1 }] }] }];
    expect(validarModeloParaPublicacao(ruim)[0]).toContain('não mede nada');
  });

  it('recusa peso zero ou negativo — pergunta obrigatória que não conta', () => {
    expect(validarModeloParaPublicacao([{ titulo: 'G', perguntas: [pergunta('Q', 0)] }])[0]).toContain(
      'trabalhar à toa',
    );
    expect(validarModeloParaPublicacao([{ titulo: 'G', perguntas: [pergunta('Q', -2)] }])[0]).toContain(
      'trabalhar à toa',
    );
  });

  it('recusa pergunta cujas alternativas valem todas zero', () => {
    const ruim = [
      { titulo: 'G', perguntas: [{ enunciado: 'Q', peso: 1, alternativas: [{ valor: 0 }, { valor: 0 }] }] },
    ];
    expect(validarModeloParaPublicacao(ruim).some((p) => p.includes('valem zero'))).toBe(true);
  });

  it('junta TODOS os problemas em vez de parar no primeiro', () => {
    const problemas = validarModeloParaPublicacao([
      { titulo: 'A', perguntas: [] },
      { titulo: 'B', perguntas: [pergunta('Q', 0)] },
    ]);
    expect(problemas).toHaveLength(2);
    expect(problemas[0]).toContain('Grupo "A"');
    expect(problemas[1]).toContain('Grupo "B"');
  });

  it('nomeia o grupo E a pergunta — quem lê é o RH', () => {
    const [problema] = validarModeloParaPublicacao([
      { titulo: 'Assiduidade', perguntas: [pergunta('Pontualidade', 0)] },
    ]);
    expect(problema).toContain('Assiduidade');
    expect(problema).toContain('Pontualidade');
  });

  it('assertModeloPublicavel lança com a lista anexa', () => {
    try {
      assertModeloPublicavel([{ titulo: 'A', perguntas: [] }]);
      throw new Error('deveria ter lançado');
    } catch (e) {
      expect(e).toBeInstanceOf(ModeloNaoPublicavelError);
      expect((e as ModeloNaoPublicavelError).problemas).toHaveLength(1);
    }
  });
});
