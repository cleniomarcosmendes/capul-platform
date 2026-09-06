/**
 * Testes da regra de `dataUltimaFuncao` — a peça mais frágil do sync.
 *
 * As fixtures NÃO são inventadas: são histórico real lido de capulmig em
 * 05/09/2026, com matrícula e datas preservadas. Cada uma existe porque um
 * jeito plausível de escrever a regra erra justamente nela.
 *
 * A implementação foi conferida contra um cálculo independente (função de
 * janela em SQL, no Oracle) para as **1.036 pessoas ativas: 1.036/1.036
 * iguais**, com a distribuição 791 TROCA_DE_FUNCAO · 193 ADMISSAO_SEM_TROCA ·
 * 52 ADMISSAO_SEM_HISTORICO.
 */
import { resolverDataUltimaFuncao, type MovimentoFuncional } from './data-ultima-funcao.js';

/** Açúcar para escrever fixture legível: data, sequência e código de função. */
const mov = (data: string, funcaoCodigo: string, sequencia = '1'): MovimentoFuncional => ({
  data,
  sequencia,
  funcaoCodigo,
});

describe('resolverDataUltimaFuncao', () => {
  describe('borda (a) — tem histórico, mas a função nunca mudou', () => {
    // Matrícula 001069, filial 02, admitida em 01/03/1986. Real: 23 lançamentos
    // em 40 anos (dissídios e méritos), sempre a função 00044.
    const semTroca = [
      mov('19860301', '00044'), mov('20101101', '00044'), mov('20111101', '00044'),
      mov('20120101', '00044'), mov('20121101', '00044'), mov('20131101', '00044'),
      mov('20141101', '00044'), mov('20151101', '00044'), mov('20160101', '00044'),
      mov('20161201', '00044'), mov('20180201', '00044'), mov('20181101', '00044'),
      mov('20191101', '00044'), mov('20201101', '00044'), mov('20211101', '00044'),
      mov('20221101', '00044'), mov('20230126', '00044'), mov('20230520', '00044'),
      mov('20231102', '00044'), mov('20240123', '00044'), mov('20241101', '00044'),
      mov('20250101', '00044'), mov('20251101', '00044'),
    ];

    it('usa a data de ADMISSÃO, não a do último lançamento', () => {
      expect(resolverDataUltimaFuncao(semTroca, '19860301')).toEqual({
        data: '19860301',
        origem: 'ADMISSAO_SEM_TROCA',
        trocas: 0,
      });
    });

    it('a regra ingênua daria 8 meses de função a quem tem 40 anos nela', () => {
      // Guarda explícita contra a regressão: 20251101 é o último lançamento e
      // NÃO pode ser a resposta. 193 pessoas caem neste caso hoje.
      const { data } = resolverDataUltimaFuncao(semTroca, '19860301');
      expect(data).not.toBe('20251101');
    });
  });

  describe('borda (b) — nenhum registro no SR7010', () => {
    it('usa a data de admissão', () => {
      // 52 pessoas hoje. Não é dado ausente: a pessoa não mudou de função.
      expect(resolverDataUltimaFuncao([], '20240115')).toEqual({
        data: '20240115',
        origem: 'ADMISSAO_SEM_HISTORICO',
        trocas: 0,
      });
    });

    it('exige a data de admissão — sem ela não há resposta possível', () => {
      expect(() => resolverDataUltimaFuncao([], '')).toThrow(/dataAdmissao/);
    });
  });

  describe('borda (c) — transferência de filial', () => {
    // Matrícula 004540, transferida da filial 18 para a 01. As duas cópias do
    // histórico DIVERGEM depois da transferência: a 01 registra a função nova
    // (00542) em 20241101 e a 18 segue carimbando a antiga (02556) até 20251101.
    const filialAtual01 = [
      mov('20210908', '00120'), mov('20211101', '00120'), mov('20221101', '00120'),
      mov('20231101', '02556'), mov('20231102', '02556'),
      mov('20241101', '00542'), mov('20250321', '00542'), mov('20260226', '00542'),
    ];
    const filialAntiga18 = [
      mov('20210908', '00120'), mov('20211101', '00120'), mov('20221101', '00120'),
      mov('20231101', '02556'), mov('20231102', '02556'),
      mov('20241101', '02556'), mov('20251101', '02556'),
    ];

    it('lendo só a filial atual, acha a promoção verdadeira', () => {
      expect(resolverDataUltimaFuncao(filialAtual01, '20210908')).toMatchObject({
        data: '20241101',
        origem: 'TROCA_DE_FUNCAO',
      });
    });

    it('a transferência não zera o tempo: o histórico da filial atual vem completo', () => {
      // Começa na admissão (20210908), como nas 982 pessoas com histórico.
      expect(filialAtual01[0].data).toBe('20210908');
    });

    it('réplica IDÊNTICA da mesma filial não vira troca (dedup)', () => {
      const duplicado = [...filialAtual01, ...filialAtual01];
      expect(resolverDataUltimaFuncao(duplicado, '20210908')).toMatchObject({
        data: '20241101',
        trocas: resolverDataUltimaFuncao(filialAtual01, '20210908').trocas,
      });
    });

    it('DOCUMENTA o limite: misturar a filial antiga inventa uma promoção', () => {
      // Não é comportamento desejado — é a prova de que o contrato ("só a filial
      // atual") precisa ser respeitado pelo chamador. A cópia antiga contradiz a
      // nova, e nenhuma regra sobre o SR7010 resolve isso: quem diz qual filial
      // vale é o SRA010. Se alguém "consertar" o sync para ler todas as filiais,
      // este teste falha e explica por quê.
      const misturado = resolverDataUltimaFuncao([...filialAtual01, ...filialAntiga18], '20210908');
      expect(misturado.data).toBe('20260226');
      expect(misturado.data).not.toBe('20241101');
    });
  });

  describe('o que a regra ignora de propósito', () => {
    it('dissídio anual não é troca de função', () => {
      // Matrícula 001741, filial 01: virou PEDREIRO 3C (03153) em 20231101 e
      // depois só levou dissídio. O select antigo excluía a data fixa 20241101 —
      // e envelheceu, porque 20251101 chegou.
      const r = resolverDataUltimaFuncao(
        [
          mov('20060801', '00100'), mov('20091101', '00100'), mov('20101101', '00100'),
          mov('20111001', '00100'), mov('20111101', '00100'), mov('20121101', '00100'),
          mov('20130219', '00423'), mov('20131101', '00423'), mov('20141101', '00423'),
          mov('20151101', '00423'), mov('20161201', '00423'), mov('20180201', '00423'),
          mov('20181101', '00423'), mov('20191101', '00423'), mov('20201101', '00423'),
          mov('20210726', '00423'), mov('20211101', '00423'), mov('20221101', '00423'),
          mov('20231101', '02501'), mov('20231102', '02501'),
          mov('20241101', '02501'), mov('20251101', '02501'),
        ],
        '20060801',
      );
      expect(r).toMatchObject({ data: '20231101', origem: 'TROCA_DE_FUNCAO', trocas: 2 });
    });

    it('promoção que não muda a função também não conta', () => {
      // Matrícula 001174: lançamento tipo 005 em 20260226 mantendo a função
      // 03153. É por isso que a chave é a troca de R7_FUNCAO, e não R7_TIPO.
      const r = resolverDataUltimaFuncao(
        [
          mov('20220830', '03156'), mov('20221101', '03156'),
          mov('20231101', '03153'), mov('20251101', '03153'), mov('20260226', '03153'),
        ],
        '20000522',
      );
      expect(r.data).toBe('20231101');
    });

    it('a descrição da função muda sem a função mudar — por isso usamos o CÓDIGO', () => {
      // Matrícula 001174: 00093 aparece como "MOTORISTA II" em 2009 e
      // "MOTORISTA" em 2010. Mesma função, texto reescrito.
      const r = resolverDataUltimaFuncao(
        [mov('20091001', '00093'), mov('20091101', '00093'), mov('20101101', '00093')],
        '20000522',
      );
      expect(r.origem).toBe('ADMISSAO_SEM_TROCA');
    });
  });

  describe('robustez da entrada', () => {
    it('ordena o histórico que chegar fora de ordem', () => {
      const foraDeOrdem = [mov('20231101', '03153'), mov('20060801', '00317'), mov('20130219', '01088')];
      expect(resolverDataUltimaFuncao(foraDeOrdem, '20060801').data).toBe('20231101');
    });

    it('desempata dois lançamentos do mesmo dia pela sequência', () => {
      const mesmoDia = [mov('20240101', '00002', '2'), mov('20240101', '00001', '1'), mov('20230101', '00001')];
      // Ordem correta: 00001(2023) → 00001(seq 1) → 00002(seq 2) = uma troca só.
      expect(resolverDataUltimaFuncao(mesmoDia, '20230101')).toMatchObject({
        data: '20240101',
        trocas: 1,
      });
    });

    it('descarta linha sem data ou sem função em vez de tratá-la como troca', () => {
      const sujo = [
        mov('20200101', '00010'),
        { data: '', sequencia: '1', funcaoCodigo: '00099' },
        { data: '20210101', sequencia: '1', funcaoCodigo: '' },
      ];
      expect(resolverDataUltimaFuncao(sujo, '20200101')).toMatchObject({
        origem: 'ADMISSAO_SEM_TROCA',
        trocas: 0,
      });
    });
  });
});

describe('⭐ recorte pela data-base — fato posterior ao ciclo não conta', () => {
  // Matrícula 001174, real: virou 03153 em 20231101 e levou um lançamento em
  // 20260226. Apurando o ciclo de 2025, o de 2026 não pode existir.
  const historico = [
    mov('20220830', '03156'), mov('20221101', '03156'),
    mov('20231101', '03153'), mov('20251101', '03153'), mov('20260226', '03153'),
  ];

  it('ignora lançamento posterior à data-base', () => {
    const semRecorte = resolverDataUltimaFuncao(historico, '20000522');
    const comRecorte = resolverDataUltimaFuncao(historico, '20000522', { ate: '20251130' });
    expect(semRecorte.data).toBe('20231101');
    expect(comRecorte.data).toBe('20231101');
  });

  it('⭐ a TROCA posterior ao ciclo não antecipa a promoção', () => {
    // Promovido em 2026: apurando o ciclo de 2025, ainda está na função antiga.
    const comPromocao2026 = [...historico, mov('20260301', '09999')];
    expect(resolverDataUltimaFuncao(comPromocao2026, '20000522').data).toBe('20260301');
    expect(
      resolverDataUltimaFuncao(comPromocao2026, '20000522', { ate: '20251130' }).data,
    ).toBe('20231101');
  });

  it('reapurar o mesmo ciclo em datas diferentes dá o MESMO resultado', () => {
    // É a razão de existir do recorte: sem ele, o resultado de um ciclo fechado
    // muda conforme o tempo passa — o current_date de volta com outra roupa.
    const emDezembro2025 = resolverDataUltimaFuncao(historico, '20000522', { ate: '20251130' });
    const hoje = resolverDataUltimaFuncao([...historico, mov('20260901', '03153')], '20000522', {
      ate: '20251130',
    });
    expect(hoje).toEqual(emDezembro2025);
  });

  it('recorte anterior a TODO o histórico cai na admissão', () => {
    expect(resolverDataUltimaFuncao(historico, '20000522', { ate: '20100101' })).toMatchObject({
      origem: 'ADMISSAO_SEM_HISTORICO',
    });
  });

  it('sem recorte, continua considerando tudo (é o que o sync faz)', () => {
    const comPromocao2026 = [...historico, mov('20260301', '09999')];
    expect(resolverDataUltimaFuncao(comPromocao2026, '20000522').data).toBe('20260301');
  });
});

describe('duplicidade na origem — ruído HOJE, não invariante', () => {
  // O SR7010 da Capul tem 312 chaves (filial, matrícula, data, sequência)
  // repetidas; 68 com FUNÇÕES DIFERENTES, 9 delas em pessoas ativas.
  //
  // Medido nas 1.036 ativas (função de janela em SQL, ordenando por recno
  // crescente e decrescente): **em nenhuma a data resolvida muda**. Nos dados de
  // hoje é ruído de cadastro, não critério de nota.
  //
  // ⚠️ Mas NÃO é invariante — e este teste existe para dizer isso. A ordem passa
  // a importar quando um lançamento POSTERIOR repete a função de uma das
  // duplicatas: aí uma das ordens vê uma troca a mais, mais tarde. Se um dia a
  // conferência em SQL acusar algum caso, é preciso regra explícita de desempate
  // (o candidato natural é o maior recno = lançamento mais recente).
  const comDuplicata = (ordem: 'ab' | 'ba', posterior: string) => {
    const a = mov('20101101', '00400');
    const b = mov('20101101', '00190');
    return [
      mov('20090101', '00100'),
      ...(ordem === 'ab' ? [a, b] : [b, a]),
      mov('20151101', posterior),
    ];
  };

  it('quando nada posterior repete a função duplicada, a ordem é indiferente', () => {
    // É a situação de todas as 1.036 pessoas ativas hoje.
    expect(resolverDataUltimaFuncao(comDuplicata('ab', '09999'), '20050101').data).toBe(
      resolverDataUltimaFuncao(comDuplicata('ba', '09999'), '20050101').data,
    );
  });

  it('⚠️ DOCUMENTA o limite: com um posterior igual a uma das duplicatas, a ordem MUDA a data', () => {
    // 'ab': 00100 → 00400 → 00190 → 00190 (sem troca) → última troca em 20101101
    // 'ba': 00100 → 00190 → 00400 → 00190 (TROCA)    → última troca em 20151101
    expect(resolverDataUltimaFuncao(comDuplicata('ab', '00190'), '20050101').data).toBe('20101101');
    expect(resolverDataUltimaFuncao(comDuplicata('ba', '00190'), '20050101').data).toBe('20151101');
  });
});
