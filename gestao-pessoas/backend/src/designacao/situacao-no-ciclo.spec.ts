import { decidirSituacao, pedeAcao, type EntradaDaSituacao } from './situacao-no-ciclo.js';

const AVALIADOR = 'colab-chefe';
const OUTRO = 'colab-outro-chefe';

const base: EntradaDaSituacao = {
  avaliadorVinculadoId: AVALIADOR,
  avaliacao: null,
  noPublico: true,
  decisaoDoRh: null,
  regua: { elegivel: true, justificativa: null },
};

const avaliacao = (over: Partial<NonNullable<EntradaDaSituacao['avaliacao']>> = {}) => ({
  avaliadorId: OUTRO,
  status: 'PENDENTE',
  respostas: 0,
  origemDesignacao: 'CENTRO_CUSTO',
  ...over,
});

describe('decidirSituacao — o que muda no ciclo aberto ao definir o vínculo', () => {
  it('sem avaliação, no público e elegível: falta rodar o lote', () => {
    expect(decidirSituacao(base)).toBe('SEM_AVALIACAO');
  });

  /**
   * ⭐ A ordem é o que este teste protege: "já reflete" vem antes de tudo.
   * Dizer "já tem avaliação com Fulano" logo depois de vincular o Fulano é
   * absurdo — e se ela já foi respondida, é o processo andando, não um aviso.
   */
  describe('quando a avaliação JÁ é com quem se acabou de vincular', () => {
    it('pendente → já reflete', () => {
      expect(decidirSituacao({ ...base, avaliacao: avaliacao({ avaliadorId: AVALIADOR }) })).toBe('JA_REFLETE');
    });

    it('RESPONDIDA → já reflete, e não "já respondida"', () => {
      expect(
        decidirSituacao({
          ...base,
          avaliacao: avaliacao({ avaliadorId: AVALIADOR, status: 'ENVIADA', respostas: 14 }),
        }),
      ).toBe('JA_REFLETE');
    });

    it('designada à mão no ciclo → já reflete, e não "ajuste manual"', () => {
      expect(
        decidirSituacao({
          ...base,
          avaliacao: avaliacao({ avaliadorId: AVALIADOR, origemDesignacao: 'MANUAL' }),
        }),
      ).toBe('JA_REFLETE');
    });
  });

  describe('avaliação com OUTRO avaliador', () => {
    it('pendente → o lote atualiza', () => {
      expect(decidirSituacao({ ...base, avaliacao: avaliacao() })).toBe('OUTRO_AVALIADOR');
    });

    it('designada à mão no ciclo → o lote só substitui se mandarem', () => {
      expect(decidirSituacao({ ...base, avaliacao: avaliacao({ origemDesignacao: 'MANUAL' }) })).toBe(
        'OUTRO_AVALIADOR_MANUAL',
      );
    });

    it('⭐ com resposta → JA_RESPONDIDA, que é o estado que o aviso genérico esconderia', () => {
      expect(decidirSituacao({ ...base, avaliacao: avaliacao({ respostas: 3 }) })).toBe('JA_RESPONDIDA');
      expect(decidirSituacao({ ...base, avaliacao: avaliacao({ status: 'ENVIADA' }) })).toBe('JA_RESPONDIDA');
    });

    it('respondida vence "manual": a razão que se lê é a do julgamento já feito', () => {
      expect(
        decidirSituacao({ ...base, avaliacao: avaliacao({ respostas: 1, origemDesignacao: 'MANUAL' }) }),
      ).toBe('JA_RESPONDIDA');
    });
  });

  describe('sem avaliação — por que ela não vai nascer', () => {
    it('fora do público: o lote nem alcança a pessoa', () => {
      expect(decidirSituacao({ ...base, noPublico: false })).toBe('FORA_DO_PUBLICO');
    });

    it('régua do ciclo exclui (demitido/afastado na data-base)', () => {
      expect(
        decidirSituacao({ ...base, regua: { elegivel: false, justificativa: 'Afastado na data-base.' } }),
      ).toBe('FORA_PELA_REGUA');
    });

    /**
     * ⚠️ Régua e decisão do RH são coisas DIFERENTES, e o aviso tem de dizer
     * qual é: a segunda tem autor e justificativa registrados, e quem lê o aviso
     * pode ser exatamente quem decidiu.
     */
    it('decisão do RH exclui — e vence a régua, que sozinha até incluiria', () => {
      expect(
        decidirSituacao({
          ...base,
          decisaoDoRh: { decisao: 'EXCLUIR', justificativa: 'Sai da empresa em outubro.' },
        }),
      ).toBe('FORA_POR_DECISAO_RH');
    });

    it('decisão do RH de INCLUIR sobrepõe a régua', () => {
      expect(
        decidirSituacao({
          ...base,
          regua: { elegivel: false, justificativa: 'Afastado na data-base.' },
          decisaoDoRh: { decisao: 'INCLUIR', justificativa: 'Volta em setembro.' },
        }),
      ).toBe('SEM_AVALIACAO');
    });

    it('EXCLUIR do RH aparece mesmo quando a pessoa está fora do público', () => {
      // A decisão é o motivo mais forte e o único com justificativa para mostrar.
      expect(
        decidirSituacao({
          ...base,
          noPublico: false,
          decisaoDoRh: { decisao: 'EXCLUIR', justificativa: 'Não avaliar este ano.' },
        }),
      ).toBe('FORA_POR_DECISAO_RH');
    });
  });

  it('pedeAcao separa o que exige alguém fazer algo do que é só informação', () => {
    expect(pedeAcao('SEM_AVALIACAO')).toBe(true);
    expect(pedeAcao('OUTRO_AVALIADOR')).toBe(true);
    expect(pedeAcao('JA_REFLETE')).toBe(false);
    // ⚠️ JA_RESPONDIDA não pede ação de propósito: não há o que fazer no ciclo —
    // o lote recusa a troca. É informação, e das importantes.
    expect(pedeAcao('JA_RESPONDIDA')).toBe(false);
  });
});
