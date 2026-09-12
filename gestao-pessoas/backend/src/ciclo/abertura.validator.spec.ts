import {
  CicloNaoAbrivelError,
  assertCicloAbrivel,
  avisosParaAbrir,
  conceitoDaNota,
  problemasParaAbrir,
  validarAplicacao,
  validarConceitos,
  type AplicacaoParaValidar,
  type FaixaConceito,
} from './abertura.validator.js';

const CONCEITOS: FaixaConceito[] = [
  { descricao: 'Insuficiente', limiteInferior: 0, limiteSuperior: 25 },
  { descricao: 'Abaixo do esperado', limiteInferior: 25, limiteSuperior: 50 },
  { descricao: 'Atende', limiteInferior: 50, limiteSuperior: 75 },
  { descricao: 'Supera', limiteInferior: 75, limiteSuperior: 90 },
  { descricao: 'Excelente', limiteInferior: 90, limiteSuperior: 100 },
];

const criterioOk = (codigo = 'ESCOLARIDADE') => ({
  codigo,
  nome: codigo,
  origem: 'CALCULADO' as const,
  codigoCalculo: codigo,
  ativo: true,
});

const aplicacao = (over: Partial<AplicacaoParaValidar> = {}): AplicacaoParaValidar => ({
  nome: 'Operação de Loja',
  // Padrão com gente: quem testa "público vazio impede abrir" passa 0 de propósito.
  pessoasNoPublico: 87,
  pesoAvaliacao: 60,
  criterios: [{ peso: 10, criterio: criterioOk() }],
  ...over,
});

describe('validarAplicacao', () => {
  it('aprova uma aplicação coerente', () => {
    expect(validarAplicacao(aplicacao())).toEqual([]);
  });

  describe('⭐ pesoAvaliacao > 0 — a guarda que dispensa o caso especial', () => {
    it('recusa peso zero', () => {
      // Com pesoAvaliacao > 0, "todos os critérios sem dado -> nota final = nota
      // da avaliação" cai da própria fórmula: o denominador nunca zera.
      expect(validarAplicacao(aplicacao({ pesoAvaliacao: 0 }))[0]).toContain('maior que zero');
    });

    it('recusa peso negativo', () => {
      expect(validarAplicacao(aplicacao({ pesoAvaliacao: -1 }))).toHaveLength(1);
    });

    it('aceita aplicação SEM critério algum, desde que o questionário tenha peso', () => {
      // Perfil que só usa o questionário é legítimo — e a nota final vira a
      // própria nota da avaliação, sem nenhum tratamento especial.
      expect(validarAplicacao(aplicacao({ criterios: [] }))).toEqual([]);
    });
  });

  describe('critérios da aplicação', () => {
    it('recusa peso zero em critério — para excluir, remova da aplicação', () => {
      const problemas = validarAplicacao(
        aplicacao({ criterios: [{ peso: 0, criterio: criterioOk() }] }),
      );
      expect(problemas[0]).toContain('remova-o da');
    });

    it('recusa critério inativo', () => {
      const problemas = validarAplicacao(
        aplicacao({ criterios: [{ peso: 10, criterio: { ...criterioOk(), ativo: false } }] }),
      );
      expect(problemas.some((p) => p.includes('INATIVO'))).toBe(true);
    });

    it('recusa codigoCalculo sem resolver — mesma função do catálogo', () => {
      const problemas = validarAplicacao(
        aplicacao({
          criterios: [{ peso: 10, criterio: { ...criterioOk(), codigoCalculo: 'NAO_EXISTE' } }],
        }),
      );
      expect(problemas.some((p) => p.includes('não existe no sistema'))).toBe(true);
    });

    it('recusa o mesmo critério duas vezes', () => {
      const problemas = validarAplicacao(
        aplicacao({
          criterios: [
            { peso: 10, criterio: criterioOk() },
            { peso: 5, criterio: criterioOk() },
          ],
        }),
      );
      expect(problemas.some((p) => p.includes('mais de uma vez'))).toBe(true);
    });
  });

  it('recusa modelo de DEMONSTRACAO em ciclo válido', () => {
    expect(validarAplicacao(aplicacao({ modeloFinalidade: 'DEMONSTRACAO' }))[0]).toContain(
      'DEMONSTRAÇÃO',
    );
  });
});

describe('⭐ faixas de conceito — contíguas por construção', () => {
  it('aprova as faixas padrão', () => {
    expect(validarConceitos(CONCEITOS)).toEqual([]);
  });

  it('recusa o buraco que existia antes (0–24, 25–49, …)', () => {
    // Era o caso real do seed anterior: nota 24,5 não caía em faixa nenhuma e
    // o conceito saía vazio, sem erro.
    const comBuraco = [
      { descricao: 'Insuficiente', limiteInferior: 0, limiteSuperior: 24 },
      { descricao: 'Abaixo', limiteInferior: 25, limiteSuperior: 100 },
    ];
    expect(validarConceitos(comBuraco)[0]).toContain('buraco');
  });

  it('recusa sobreposição', () => {
    const sobreposto = [
      { descricao: 'A', limiteInferior: 0, limiteSuperior: 60 },
      { descricao: 'B', limiteInferior: 50, limiteSuperior: 100 },
    ];
    expect(validarConceitos(sobreposto)[0]).toContain('sobreposição');
  });

  it('exige começar em 0 e terminar em 100', () => {
    expect(validarConceitos([{ descricao: 'A', limiteInferior: 10, limiteSuperior: 100 }])[0]).toContain(
      'precisa começar em 0',
    );
    expect(validarConceitos([{ descricao: 'A', limiteInferior: 0, limiteSuperior: 90 }])[0]).toContain(
      'precisa terminar em 100',
    );
  });

  it('recusa faixa vazia', () => {
    const vazia = [
      { descricao: 'A', limiteInferior: 0, limiteSuperior: 0 },
      { descricao: 'B', limiteInferior: 0, limiteSuperior: 100 },
    ];
    expect(vazia && validarConceitos(vazia).some((p) => p.includes('não sobra'))).toBe(true);
  });

  it('recusa ciclo sem conceito nenhum', () => {
    expect(validarConceitos([])[0]).toContain('não tem faixas');
  });

  it('não depende da ordem em que as faixas chegam', () => {
    expect(validarConceitos([...CONCEITOS].reverse())).toEqual([]);
  });
});

describe('conceitoDaNota — inferior inclusivo, superior exclusivo', () => {
  it.each([
    [0, 'Insuficiente'],
    [24.5, 'Insuficiente'],
    [24.99, 'Insuficiente'],
    [25, 'Abaixo do esperado'],
    [49.99, 'Abaixo do esperado'],
    [50, 'Atende'],
    [74.99, 'Atende'],
    [75, 'Supera'],
    [89.99, 'Supera'],
    [90, 'Excelente'],
  ])('nota %s -> %s', (nota, esperado) => {
    expect(conceitoDaNota(CONCEITOS, nota as number)?.descricao).toBe(esperado);
  });

  it('a última faixa INCLUI o 100 — nota máxima tem conceito', () => {
    expect(conceitoDaNota(CONCEITOS, 100)?.descricao).toBe('Excelente');
  });

  it('⭐ 24,5 tem conceito — era o buraco das faixas antigas', () => {
    expect(conceitoDaNota(CONCEITOS, 24.5)).not.toBeNull();
  });

  it('nota fora de 0–100 não inventa conceito', () => {
    expect(conceitoDaNota(CONCEITOS, -1)).toBeNull();
    expect(conceitoDaNota(CONCEITOS, 100.01)).toBeNull();
  });
});

describe('assertCicloAbrivel', () => {
  it('passa com aplicação e conceitos coerentes', () => {
    expect(() => assertCicloAbrivel([aplicacao()], CONCEITOS)).not.toThrow();
  });

  it('recusa ciclo sem aplicação', () => {
    expect(() => assertCicloAbrivel([], CONCEITOS)).toThrow(CicloNaoAbrivelError);
  });

  it('junta os problemas de aplicação E de conceito numa recusa só', () => {
    try {
      assertCicloAbrivel([aplicacao({ pesoAvaliacao: 0 })], [
        { descricao: 'A', limiteInferior: 0, limiteSuperior: 90 },
      ]);
      throw new Error('deveria ter lançado');
    } catch (e) {
      expect((e as CicloNaoAbrivelError).problemas).toHaveLength(2);
    }
  });
});


/**
 * ⭐⭐ PÚBLICO VAZIO IMPEDE ABRIR — achado do roteiro de tela de 08/09.
 *
 * A faixa do rascunho dizia "Nada — a validação da abertura passa" com público
 * vazio, enquanto o "→ Próximo", DUAS LINHAS ACIMA, dizia "sem público, o ciclo
 * não alcança ninguém". Duas frases contraditórias no mesmo bloco — e a que
 * autorizava era a de baixo, porque a validação real não olhava o público.
 *
 * ⚠️ A checagem vive em `problemasParaAbrir`, NÃO em `validarAplicacao`: esta
 * roda também na CRIAÇÃO da aplicação, onde o público é zero por construção.
 */
describe('público vazio', () => {
  it('não reprova a CRIAÇÃO da aplicação — lá o público é zero por construção', () => {
    expect(validarAplicacao(aplicacao({ pessoasNoPublico: 0 }))).toEqual([]);
  });

  it('IMPEDE a abertura, dizendo qual aplicação e o que fazer', () => {
    const problemas = problemasParaAbrir([aplicacao({ pessoasNoPublico: 0 })], CONCEITOS);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatch(/nenhuma pessoa no público/);
    expect(problemas[0]).toMatch(/Operação de Loja/);
    expect(problemas[0]).toMatch(/monte o público/i);
  });

  it('com gente no público, não reclama', () => {
    expect(problemasParaAbrir([aplicacao({ pessoasNoPublico: 1 })], CONCEITOS)).toEqual([]);
  });

  it('aponta CADA aplicação vazia, não só a primeira', () => {
    const problemas = problemasParaAbrir(
      [
        aplicacao({ nome: 'Aprendizes', pessoasNoPublico: 0 }),
        aplicacao({ nome: 'Loja', pessoasNoPublico: 31 }),
        aplicacao({ nome: 'Indústria', pessoasNoPublico: 0 }),
      ],
      CONCEITOS,
    );
    expect(problemas).toHaveLength(2);
    expect(problemas.join(' ')).toMatch(/Aprendizes/);
    expect(problemas.join(' ')).toMatch(/Indústria/);
    expect(problemas.join(' ')).not.toMatch(/"Loja"/);
  });
});

describe('⭐ avisosParaAbrir — o que não impede abrir, mas precisa ser sabido', () => {
  const informado = (codigo: string, valores: number) => ({
    peso: 10,
    valoresInformadosNoCiclo: valores,
    criterio: { codigo, nome: `Critério ${codigo}`, origem: 'INFORMADO' as const, ativo: true },
  });
  const calculado = {
    peso: 10,
    criterio: {
      codigo: 'TEMPO_EMPRESA',
      nome: 'Tempo de Empresa',
      origem: 'CALCULADO' as const,
      codigoCalculo: 'TEMPO_EMPRESA',
      ativo: true,
    },
  };
  const app = (nome: string, criterios: unknown[]) => ({
    nome,
    pessoasNoPublico: 10,
    pesoAvaliacao: 60,
    modeloFinalidade: 'PRODUCAO' as const,
    criterios: criterios as never,
  });

  /**
   * ⭐ O caso que motivou: a conferência do painel roda sobre avaliações
   * ENVIADA, então com zero enviadas ela diz "nada a conferir ainda" — a
   * checagem existia e era inalcançável exatamente quando serviria. Este aviso
   * é a mesma informação no único momento em que ela ainda muda algo.
   */
  it('avisa quando um critério INFORMADO não tem nenhum valor no ciclo', () => {
    const a = avisosParaAbrir([app('Administrativo', [informado('META', 0)])]);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatch(/ainda não tem nenhum valor neste ciclo/);
    expect(a[0]).toMatch(/sem erro em lugar nenhum/);
  });

  it('não avisa quando já há valores', () => {
    expect(avisosParaAbrir([app('Administrativo', [informado('META', 3)])])).toEqual([]);
  });

  /** CALCULADO lê do cadastro — não há o que importar, e avisar seria ruído. */
  it('não avisa sobre critério CALCULADO', () => {
    expect(avisosParaAbrir([app('Administrativo', [calculado])])).toEqual([]);
  });

  /** Um aviso por CRITÉRIO, não por aplicação: o ato de importar é um só. */
  it('agrupa por critério e diz em quantas aplicações ele está', () => {
    const a = avisosParaAbrir([
      app('Administrativo', [informado('META', 0)]),
      app('Loja', [informado('META', 0)]),
    ]);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatch(/Aplicações que o usam: 2\./);
  });

  it('não impede abrir — é lista separada de `problemasParaAbrir`', () => {
    const aplicacoes = [app('Administrativo', [informado('META', 0)])];
    expect(avisosParaAbrir(aplicacoes)).toHaveLength(1);
    expect(problemasParaAbrir(aplicacoes, CONCEITOS)).toEqual([]);
  });
});
