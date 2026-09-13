import { describe, expect, it } from 'vitest';
import {
  ancoraEscolhida,
  composicao,
  conferirComposicao,
  proximoNivel,
  type MemoriaParaDevolutiva,
} from './devolutiva';

/** O caso REAL medido em 13/09 na API — ALEXANDRE, final 69,90. */
const REAL: MemoriaParaDevolutiva = {
  notaAvaliacao: 63.19,
  pesoAvaliacao: 60,
  notaFinal: 69.9,
  criterios: [
    { nome: 'Escolaridade', valorBruto: 55, valorTexto: null, faixaRotulo: 'SUPERIOR COMPLETO', pontuacao: 75, peso: 10, semDado: false },
    { nome: 'Tempo de Empresa', valorBruto: 9.6263, valorTexto: null, faixaRotulo: 'Mais de 7 anos', pontuacao: 100, peso: 10, semDado: false },
    { nome: 'Tempo na Função', valorBruto: 4.0849, valorTexto: null, faixaRotulo: 'De 4 a 6 anos', pontuacao: 75, peso: 10, semDado: false },
  ],
  porGrupo: [
    { grupoId: 'g1', titulo: 'Assiduidade e Pontualidade', nota: 25, peso: 9 },
    { grupoId: 'g2', titulo: 'Relacionamento e Conduta', nota: 66.67, peso: 10 },
    { grupoId: 'g3', titulo: 'Iniciativa e Adaptabilidade', nota: 75, peso: 9 },
    { grupoId: 'g4', titulo: 'Qualidade e Organização', nota: 75, peso: 9 },
    { grupoId: 'g5', titulo: 'Atendimento ao Cliente', nota: 71.15, peso: 13 },
    { grupoId: 'g6', titulo: 'Metas e Trabalho sob Pressão', nota: 50, peso: 5 },
    { grupoId: 'g7', titulo: 'Apresentação Pessoal', nota: 75, peso: 5 },
  ],
  porQuestao: [],
};

const ancoras = (escolhida: number) =>
  [0.3, 0.6, 0.9, 1.2].map((valor, i) => ({
    valor,
    descricao: ['Atrasa com frequência', 'Atrasa às vezes', 'Raramente atrasa', 'Não há atrasos'][i],
    escolhida: i === escolhida,
  }));

describe('o próximo nível — o que dá objeto à conversa', () => {
  it('devolve a âncora imediatamente acima da escolhida', () => {
    expect(proximoNivel(ancoras(1))?.descricao).toBe('Raramente atrasa');
  });

  it('⭐ no TOPO devolve null — e isso é informação, não vazio', () => {
    // Quem já está no melhor nível merece ouvir isso, não um espaço em branco.
    expect(proximoNivel(ancoras(3))).toBeNull();
  });

  it('sem resposta não há de onde subir', () => {
    expect(proximoNivel(ancoras(-1))).toBeNull();
    expect(ancoraEscolhida(ancoras(-1))).toBeNull();
  });

  it('a escolhida é a que veio marcada, não a de maior valor', () => {
    expect(ancoraEscolhida(ancoras(0))?.descricao).toBe('Atrasa com frequência');
  });
});

describe('⛳ O PORTÃO — as quatro somas fecham no caso real', () => {
  it('1. os percentuais somam exatamente 100', () => {
    const { fatias } = composicao(REAL);
    expect(fatias.map((f) => f.pct)).toEqual([66.7, 11.1, 11.1, 11.1]);
    /**
     * ⚠️ SOMADO EM INTEIROS, e não com `+` sobre floats — a primeira versão
     * deste teste somava direto e dava **99.99999999999999** com a repartição
     * CERTA. É a mesma disciplina do `repartirExato`, que distribui o resto em
     * inteiros justamente porque float não fecha: um teste que soma em float
     * reprova o acerto e não distingue o erro.
     */
    expect(fatias.reduce((s, f) => s + Math.round(f.pct * 10), 0)).toBe(1000);
  });

  it('2. a soma dos pesos é o declarado — 60 + 10 + 10 + 10 = 90', () => {
    expect(composicao(REAL).pesoTotal).toBe(90);
  });

  it('3. a nota final refeita na mão bate com a exibida', () => {
    const c = conferirComposicao(REAL);
    expect(c.detalhe.finalRefeita).toBe(69.9);
    expect(c.finalBate).toBe(true);
  });

  it('4. Σ(nota do grupo × peso) ÷ soma bate com a nota do questionário', () => {
    const c = conferirComposicao(REAL);
    expect(c.detalhe.questionarioPelosGrupos).toBe(63.19);
    expect(c.detalhe.somaDosGrupos).toBe(60);
    expect(c.gruposBatem).toBe(true);
    expect(c.pesoDosGruposBate).toBe(true);
  });

  it('⛳ e o veredito único é verdadeiro', () => {
    expect(conferirComposicao(REAL).tudoFecha).toBe(true);
  });
});

describe('⚠️ a conferência REPROVA quando não fecha — senão é decoração', () => {
  it('nota final adulterada é pega', () => {
    const c = conferirComposicao({ ...REAL, notaFinal: 70 });
    expect(c.finalBate).toBe(false);
    expect(c.tudoFecha).toBe(false);
  });

  it('peso de grupo adulterado é pego pela média ponderada', () => {
    const porGrupo = REAL.porGrupo.map((g, i) => (i === 0 ? { ...g, peso: 8 } : g));
    const c = conferirComposicao({ ...REAL, porGrupo });
    expect(c.gruposBatem).toBe(false);
  });

  /**
   * ⭐⭐ A CHECAGEM DOS PESOS COMPARA GRUPOS × QUESTÕES — nunca `pesoAvaliacao`.
   *
   * ⚠️ Até 13/09 ela comparava com `pesoAvaliacao`, e as duas coincidiam em 3
   * das 4 aplicações **por acidente**. Em `Aprendizes` (peso 100, instrumento
   * 60) a tela gritou "a conta não está fechando" sobre **14 devolutivas
   * corretas**. Falso VERMELHO destrói a ferramenta.
   */
  it('⭐ peso do questionário 100 com instrumento de 60 é CORRETO — não é furo', () => {
    const aprendiz = {
      ...REAL,
      pesoAvaliacao: 100,
      criterios: [],
      notaFinal: 64.17,
      notaAvaliacao: 64.17,
      porGrupo: [{ grupoId: 'g1', titulo: 'Único', nota: 64.17, peso: 60 }],
      porQuestao: [
        { perguntaId: 'p1', codigo: '1', enunciado: 'x', classificacaoId: 'g1', peso: 60,
          maiorValor: 1.2, valor: 0.9, respostaEscolhida: 'x', ancoras: [] },
      ],
    };
    const c = conferirComposicao(aprendiz);
    expect(c.pesoDosGruposBate).toBe(true);
    expect(c.tudoFecha).toBe(true);
  });

  it('⭐ mas peso derivado que NÃO soma o declarado continua sendo pego — o 59,97', () => {
    const furado = {
      ...REAL,
      porQuestao: [
        { perguntaId: 'p1', codigo: '1', enunciado: 'x', classificacaoId: 'g1', peso: 59.97,
          maiorValor: 1.2, valor: 0.9, respostaEscolhida: 'x', ancoras: [] },
      ],
    };
    expect(conferirComposicao(furado).pesoDosGruposBate).toBe(false);
  });

  it('⭐ nota de grupo adulterada é pega mesmo com os pesos certos', () => {
    // A checagem 4 é a única que olha a NOTA de cada grupo. Sem ela, um grupo
    // errado passaria com a soma dos pesos intacta.
    const porGrupo = REAL.porGrupo.map((g, i) => (i === 0 ? { ...g, nota: 30 } : g));
    const c = conferirComposicao({ ...REAL, porGrupo });
    expect(c.pesoDosGruposBate).toBe(true);
    expect(c.gruposBatem).toBe(false);
  });
});

describe('critério SEM DADO', () => {
  const semDado: MemoriaParaDevolutiva = {
    ...REAL,
    notaAvaliacao: 63.19,
    /**
     * (63,19×60 + 75×10 + 100×10) ÷ 80 = **69,27**.
     * ⚠️ Eu escrevi **67,72** aqui na primeira versão — conta errada minha — e
     * quem pegou foi a `conferirComposicao`, que é exatamente para isso. Fica
     * registrado: o número do fixture também precisa ser conferido.
     */
    notaFinal: 69.27,
    criterios: [
      ...REAL.criterios.slice(0, 2),
      { ...REAL.criterios[2], pontuacao: null, semDado: true },
    ],
  };

  it('fica FORA da repartição — incluí-lo faria a fração mentir para os outros', () => {
    const c = composicao(semDado);
    expect(c.pesoTotal).toBe(80);
    expect(c.fatias).toHaveLength(3);
    expect(c.fatias.reduce((s, f) => s + f.pct, 0)).toBe(100);
  });

  it('⭐ mas VOLTA na lista — sumir faria o avaliador procurar o que não existe', () => {
    expect(composicao(semDado).semDado.map((c) => c.nome)).toEqual(['Tempo na Função']);
  });

  it('e a conta continua fechando sobre o peso reduzido', () => {
    expect(conferirComposicao(semDado).finalBate).toBe(true);
  });
});
