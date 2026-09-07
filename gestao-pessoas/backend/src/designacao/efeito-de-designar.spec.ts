import {
  avisoDeTrocaEmRespondidas,
  efeitoDeDesignar,
  type AvaliacaoAtual,
} from './efeito-de-designar.js';

const APP = 'app-1';
const ctx = {
  nomeDoAvaliado: 'CLEIA',
  novoAvaliadorId: 'novo',
  novoAvaliadorNome: 'MARIA',
  aplicacaoId: APP,
};
const atual = (o: Partial<AvaliacaoAtual> = {}): AvaliacaoAtual => ({
  status: 'PENDENTE', respostas: 0, avaliadorId: 'antigo',
  avaliadorNome: 'JOÃO', aplicacaoId: APP, ...o,
});

describe('o efeito de designar, antes de designar', () => {
  it('sem avaliação: cria, e não há o que avisar', () => {
    expect(efeitoDeDesignar(null, ctx)).toEqual({
      acao: 'CRIAR', frase: null, avaliadorAtual: null, estadoAtual: null,
    });
  });

  it('mesmo avaliador, mesma aplicação: nada a fazer', () => {
    const e = efeitoDeDesignar(atual({ avaliadorId: 'novo' }), ctx);
    expect(e.acao).toBe('NADA_A_FAZER');
    expect(e.frase).toMatch(/nada muda/);
  });

  /**
   * ⭐⭐ O CASO DA CLEIA (roteiro de 08/09): o lote trocou o avaliador dela em
   * silêncio. Substituir continua permitido — é como se corrige quem errou —,
   * mas a tela tem de DIZER, e com o nome de quem sai.
   */
  describe('substituir', () => {
    it('avisa, com o nome de quem avalia hoje e de quem entra', () => {
      const e = efeitoDeDesignar(atual(), ctx);
      expect(e.acao).toBe('SUBSTITUIR');
      expect(e.avaliadorAtual).toBe('JOÃO');
      expect(e.frase).toContain('JOÃO');
      expect(e.frase).toContain('MARIA');
      expect(e.frase).toMatch(/SUBSTITUI/);
    });

    it('sem resposta nenhuma, diz isso — é o que torna a troca barata', () => {
      expect(efeitoDeDesignar(atual(), ctx).frase).toMatch(/nenhuma resposta foi dada/);
    });
  });

  /**
   * ⭐⭐ O BURACO QUE NINGUÉM ACIONOU. `designar()` é um upsert e trocava o
   * avaliador de uma avaliação JÁ RESPONDIDA sem checar nada — o mesmo
   * `JA_RESPONDIDA` que o lote do cadastro recusava desde sempre. Medido em
   * 08/09 na auditoria do DEV: 368 trocas de avaliador, ZERO sobre respondida.
   */
  /**
   * ⭐⭐ NÃO É RECUSA — É CONFIRMAÇÃO, e a diferença tem motivo escrito.
   *
   * Havia decisão anterior (`troca-de-aplicacao.spec.ts`) de que trocar só o
   * avaliador, na mesma aplicação, NÃO é bloqueado nem com nota enviada: nenhuma
   * resposta muda de instrumento, e corrigir "designei o supervisor errado" é um
   * ato de uma linha para o RH. Ela está certa sobre a INTEGRIDADE do dado; o
   * que faltava era a ATRIBUIÇÃO. As duas se conciliam: continua permitido,
   * deixa de ser silencioso.
   */
  describe('já respondida: exige confirmação, não recusa', () => {
    it('ENVIADA exige confirmação', () => {
      const e = efeitoDeDesignar(atual({ status: 'ENVIADA' }), ctx);
      expect(e.acao).toBe('EXIGE_CONFIRMACAO');
      expect(e.frase).toMatch(/já foi ENVIADA/);
    });

    it('EM_ANDAMENTO com respostas idem, DIZENDO quantas', () => {
      const e = efeitoDeDesignar(atual({ status: 'EM_ANDAMENTO', respostas: 7 }), ctx);
      expect(e.acao).toBe('EXIGE_CONFIRMACAO');
      expect(e.frase).toContain('7 resposta');
    });

    it('e o aviso diz o que ACONTECE, e quando NÃO usar isto', () => {
      const f = efeitoDeDesignar(atual({ status: 'ENVIADA' }), ctx).frase!;
      expect(f).toMatch(/põe o nome de MARIA sobre o julgamento de JOÃO/);
      expect(f).toMatch(/as respostas continuam sendo as de JOÃO/);
      expect(f).toMatch(/reabra a avaliação|reabra|reabrir a avaliação/i);
      expect(f).toMatch(/RH_ADMIN/);
    });

    /**
     * ⚠️ Redesignar o MESMO avaliador de uma respondida não é troca — e não
     * pode ser recusado, senão o lote do cadastro passaria a falhar em quem já
     * estava certo.
     */
    it('mas o MESMO avaliador sobre respondida não é troca: passa', () => {
      const e = efeitoDeDesignar(atual({ status: 'ENVIADA', avaliadorId: 'novo' }), ctx);
      expect(e.acao).toBe('NADA_A_FAZER');
    });
  });

  /**
   * ⭐ O ESTADO EM UMA LINHA — para o lote listar QUEM são as N sem repetir a
   * explicação por pessoa. Com 50 selecionadas, a frase inteira 50 vezes é
   * ilegível: a explicação vai uma vez, no cabeçalho.
   */
  describe('o resumo de uma linha, para a lista do lote', () => {
    it('ENVIADA diz o estado e quem avalia', () => {
      expect(efeitoDeDesignar(atual({ status: 'ENVIADA' }), ctx).estadoAtual).toBe('ENVIADA por JOÃO');
    });

    it('em andamento diz QUANTAS respostas', () => {
      expect(efeitoDeDesignar(atual({ status: 'EM_ANDAMENTO', respostas: 7 }), ctx).estadoAtual).toBe(
        '7 resposta(s), por JOÃO',
      );
    });

    it('sem resposta, só quem avalia', () => {
      expect(efeitoDeDesignar(atual(), ctx).estadoAtual).toBe('por JOÃO');
    });
  });

  describe('o aviso do LOTE, escrito uma vez', () => {
    it('sem respondidas, não há aviso', () => {
      expect(avisoDeTrocaEmRespondidas(0)).toBeNull();
    });

    it('com respondidas, traz o número e o que fazer em vez disso', () => {
      const a = avisoDeTrocaEmRespondidas(3)!;
      expect(a).toContain('3 destas');
      expect(a).toMatch(/avaliado por/);
      expect(a).toMatch(/reabra a avaliação/);
      expect(a).toMatch(/RH_ADMIN/);
    });
  });

  /** Cancelada não se redesigna: o upsert a reviveria CANCELADA com avaliador novo. */
  it('avaliação CANCELADA recusa, e admite que não há caminho de volta', () => {
    const e = efeitoDeDesignar(atual({ status: 'CANCELADA' }), ctx);
    expect(e.acao).toBe('RECUSAR');
    expect(e.frase).toMatch(/CANCELADA/);
    expect(e.frase).toMatch(/não há caminho para descancelar/);
  });
});
