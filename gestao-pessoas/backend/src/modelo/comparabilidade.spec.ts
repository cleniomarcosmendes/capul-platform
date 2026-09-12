import { avisosDeComparabilidade, type PerfilComparavel } from './comparabilidade.js';

const perfil = (
  nome: string,
  grupos: { classificacaoId: string; titulo: string; peso: number }[],
  contagens: Record<string, number>,
  publicado = true,
): PerfilComparavel => ({
  versaoId: `v-${nome}`,
  modeloNome: nome,
  versao: 1,
  publicado,
  grupos,
  questoes: Object.entries(contagens).flatMap(([c, n]) =>
    Array.from({ length: n }, (_, i) => ({ perguntaId: `${nome}-${c}-${i}`, classificacaoId: c })),
  ),
});

const REL = { classificacaoId: 'c1', titulo: 'Relacionamento', peso: 16 };

describe('⭐⭐ o gatilho é o PESO POR QUESTÃO, não a contagem', () => {
  /**
   * O caso que o aviso existe para pegar: mesmo peso, contagens diferentes.
   * 16 ÷ 3 = 5,33 aqui; 16 ÷ 2 = 8,00 lá. Uma resposta vale 50% a mais num
   * perfil, e os dois questionários continuam somando 60.
   */
  it('mesma classificação, mesmo peso, contagens diferentes: AVISA com os números', () => {
    const a = avisosDeComparabilidade(perfil('Administrativo', [REL], { c1: 3 }), [
      perfil('Loja', [REL], { c1: 2 }),
    ]);
    expect(a).toHaveLength(1);
    expect(a[0].aqui).toEqual({ peso: 16, questoes: 3, porQuestao: 5.33 });
    expect(a[0].outros[0]).toMatchObject({ modeloNome: 'Loja', questoes: 2, porQuestao: 8 });
    expect(a[0].frase).toMatch(/5,33 por questão aqui/);
    expect(a[0].frase).toMatch(/Loja v1: 2 questões, 8 cada/);
  });

  /**
   * ⚠️ Contagem diferente com peso PROPORCIONAL não avisa: 16 em 3 e 32 em 6
   * dão o mesmo 5,33. Avisar por contagem encheria a tela de linhas em que nada
   * muda — e aviso que aparece sempre deixa de ser lido.
   */
  it('contagem diferente com peso proporcional NÃO avisa', () => {
    const a = avisosDeComparabilidade(perfil('Administrativo', [REL], { c1: 3 }), [
      perfil('Loja', [{ ...REL, peso: 32 }], { c1: 6 }),
    ]);
    expect(a).toEqual([]);
  });

  it('classificação que o outro perfil não usa não entra na comparação', () => {
    const a = avisosDeComparabilidade(perfil('Administrativo', [REL], { c1: 3 }), [
      perfil('Loja', [{ classificacaoId: 'c9', titulo: 'Outra', peso: 10 }], { c9: 2 }),
    ]);
    expect(a).toEqual([]);
  });

  it('classificação sem questão AQUI não gera aviso — é problema próprio, não comparação', () => {
    const a = avisosDeComparabilidade(perfil('Administrativo', [REL], {}), [
      perfil('Loja', [REL], { c1: 2 }),
    ]);
    expect(a).toEqual([]);
  });

  it('sem outros perfis, não há com o que comparar', () => {
    expect(avisosDeComparabilidade(perfil('Administrativo', [REL], { c1: 3 }), [])).toEqual([]);
  });

  it('cita TODOS os perfis divergentes, não só o primeiro', () => {
    const a = avisosDeComparabilidade(perfil('Administrativo', [REL], { c1: 3 }), [
      perfil('Loja', [REL], { c1: 2 }),
      perfil('Indústria', [REL], { c1: 4 }),
    ]);
    expect(a[0].outros).toHaveLength(2);
    expect(a[0].frase).toMatch(/Loja v1/);
    expect(a[0].frase).toMatch(/Indústria v1/);
  });

  /** ⚠️ A frase DESCREVE. Quem decide se a diferença é intencional é o RH. */
  it('a frase não manda igualar — oferece as duas saídas e admite a intenção', () => {
    const a = avisosDeComparabilidade(perfil('Administrativo', [REL], { c1: 3 }), [
      perfil('Loja', [REL], { c1: 2 }),
    ]);
    expect(a[0].frase).toMatch(/Pode ser intencional/);
    expect(a[0].frase).toMatch(/ajuste o peso ou o número de questões/);
  });
});

describe('⭐⭐ diferença NOVA × herdada — sem isso o aviso nasce inútil', () => {
  /**
   * Duplicar o Administrativo sem tocar em nada produzia **4 avisos**: o
   * instrumento herdado do RD8010 de fato pesa diferente entre perfis. Aviso
   * que aparece sempre deixa de ser lido, e aí não protege o dia em que a
   * diferença é nova.
   */
  it('cópia intocada da versão publicada: continua avisando, mas como HERDADA', () => {
    const publicada = perfil('Administrativo', [REL], { c1: 3 });
    const rascunho = perfil('Administrativo', [REL], { c1: 3 });
    const a = avisosDeComparabilidade(rascunho, [perfil('Loja', [REL], { c1: 2 })], publicada);
    expect(a).toHaveLength(1);
    expect(a[0].novo).toBe(false);
    expect(a[0].frase).toMatch(/A versão publicada deste perfil já pesava assim/);
  });

  it('tirar uma questão mantendo o peso: a diferença passa a ser NOVA', () => {
    /**
     * ⚠️ A Loja tem peso 10 em 3 (3,33), não 16 em 2: com 16 em 2 ela daria
     * os mesmos 8,00 do rascunho e **não haveria divergência para avisar** —
     * a primeira versão deste teste caiu nisso. O gatilho é o peso POR QUESTÃO.
     */
    const publicada = perfil('Administrativo', [REL], { c1: 3 });
    const rascunho = perfil('Administrativo', [REL], { c1: 2 });
    const loja = perfil('Loja', [{ ...REL, peso: 10 }], { c1: 3 });
    const a = avisosDeComparabilidade(rascunho, [loja], publicada);
    expect(a).toHaveLength(1);
    expect(a[0].novo).toBe(true);
    expect(a[0].aqui.porQuestao).toBe(8);
    expect(a[0].frase).toMatch(/Esta diferença é NOVA/);
  });

  /** Perfil sem versão publicada: não há herança, tudo é decisão de agora. */
  it('perfil novo (sem publicada): tudo é NOVO', () => {
    const a = avisosDeComparabilidade(perfil('Novo', [REL], { c1: 3 }), [
      perfil('Loja', [REL], { c1: 2 }),
    ], null);
    expect(a[0].novo).toBe(true);
  });
});
