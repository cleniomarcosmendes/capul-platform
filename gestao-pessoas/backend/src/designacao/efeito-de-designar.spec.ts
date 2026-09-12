import {
  avisoDeTrocaEmRespondidas,
  efeitoDeDesignar,
  type AvaliacaoAtual,
} from './efeito-de-designar.js';

const APP = 'app-1';
const ctx = {
  // ⭐ Entrou em 08/09 junto com a guarda da autoavaliação, que passou a morar
  // no classificador para a prévia rodar as MESMAS guardas que o ato.
  avaliadoId: 'cleia',
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
      // ⚠️ O FATO — diz que há respostas e diz QUANTAS —, não a redação. A frase
      // foi reescrita em 09/09 para o número não forçar concordância, e um
      // `toContain('7 resposta')` teria quebrado sem nada estar errado.
      expect(e.frase).toMatch(/respostas gravadas/);
      expect(e.frase).toContain('7');
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
      const estado = efeitoDeDesignar(atual({ status: 'EM_ANDAMENTO', respostas: 7 }), ctx).estadoAtual!;
      expect(estado).toContain('7');
      expect(estado).toContain('JOÃO');
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

  /**
   * Cancelada não se redesigna: o upsert a reviveria CANCELADA com avaliador novo.
   *
   * ⚠️ Este teste exigia a frase *"não há caminho para descancelar; fale com a
   * T.I."* — verdade até 11/09, e mentira a partir dela. **A recusa continua; o
   * que mudou é a saída que ela ensina.** Texto que NEGA capacidade envelhece
   * tão errado quanto o que promete, e este teste é o que garante que a recusa
   * nunca volte a ser um beco.
   */
  it('avaliação CANCELADA recusa — e a recusa ensina o caminho de volta', () => {
    const e = efeitoDeDesignar(atual({ status: 'CANCELADA' }), ctx);
    expect(e.acao).toBe('RECUSAR');
    expect(e.frase).toMatch(/CANCELADA/);
    // os dois caminhos, porque são as duas origens possíveis do cancelamento
    expect(e.frase).toMatch(/Incluir/);
    expect(e.frase).toMatch(/em massa|tela do ciclo/);
    expect(e.frase).not.toMatch(/fale com a T\.I\./i);
  });

  /**
   * ⭐⭐ AS DUAS GUARDAS QUE SÓ O ATO RODAVA — 08/09.
   *
   * Estavam em `designar()`: a autoavaliação inline, antes do classificador; a
   * troca de aplicação em `assertPodeTrocarDeAplicacao`, depois dele. A prévia
   * não chamava nenhuma das duas e por isso **prometia gravar o que o ato
   * recusa** — medido no Piloto: prévia `SUBSTITUIR`, ato *"Ninguém pode ser o
   * avaliador da própria avaliação."*
   *
   * Vindo para cá, não há como uma saber o que a outra não sabe. É o que estes
   * testes protegem: não a mensagem, mas o fato de a DECISÃO estar num lugar só.
   */
  describe('as guardas que a prévia não rodava', () => {
    describe('autoavaliação', () => {
      const paraSiMesmo = { ...ctx, novoAvaliadorId: ctx.avaliadoId };

      it('recusa mesmo quando NÃO existe avaliação — o caso do CRIAR', () => {
        const e = efeitoDeDesignar(null, paraSiMesmo);
        expect(e.acao).toBe('RECUSAR');
        expect(e.frase).toMatch(/própria avaliação/);
      });

      it('⭐ recusa onde a prévia dizia SUBSTITUIR — o defeito medido', () => {
        expect(efeitoDeDesignar(atual(), ctx).acao).toBe('SUBSTITUIR');
        expect(efeitoDeDesignar(atual(), paraSiMesmo).acao).toBe('RECUSAR');
      });

      it('vem ANTES de tudo: nem a cancelada muda a resposta', () => {
        expect(efeitoDeDesignar(atual({ status: 'CANCELADA' }), paraSiMesmo).frase).toMatch(
          /própria avaliação/,
        );
      });
    });

    describe('troca de aplicação', () => {
      const deOutraApp = (o = {}) =>
        atual({ aplicacaoId: 'app-origem', aplicacaoNome: 'Aprendizes', ...o });

      it('ENVIADA recusa, e a frase diz de ONDE ela sairia', () => {
        const e = efeitoDeDesignar(deOutraApp({ status: 'ENVIADA' }), ctx);
        expect(e.acao).toBe('RECUSAR');
        expect(e.frase).toMatch(/Aprendizes/);
      });

      it('com respostas recusa DIZENDO QUANTAS', () => {
        const e = efeitoDeDesignar(deOutraApp({ respostas: 7 }), ctx);
        expect(e.acao).toBe('RECUSAR');
        expect(e.frase).toMatch(/respostas gravadas/);
        expect(e.frase).toContain('7');
      });

      it('sem nada gravado, a troca passa', () => {
        expect(efeitoDeDesignar(deOutraApp(), ctx).acao).toBe('SUBSTITUIR');
      });

      /**
       * ⚠️ A ORDEM IMPORTA, e mudou de propósito. Recusa de troca de aplicação
       * é DURA (confirmação nenhuma a levanta); a de avaliador é CONFIRMÁVEL.
       * Antes, um ato que fosse as duas coisas pedia confirmação primeiro e só
       * recusava depois de confirmado — fazia a pessoa autorizar o que seria
       * negado de qualquer jeito.
       */
      it('⭐ sendo as DUAS coisas, recusa vence a confirmação', () => {
        const e = efeitoDeDesignar(deOutraApp({ status: 'ENVIADA' }), ctx);
        expect(e.acao).toBe('RECUSAR');
        expect(e.acao).not.toBe('EXIGE_CONFIRMACAO');
      });

      it('a MESMA aplicação não passa pela guarda — só o avaliador muda', () => {
        expect(efeitoDeDesignar(atual({ status: 'ENVIADA' }), ctx).acao).toBe('EXIGE_CONFIRMACAO');
      });

      it('sem o nome da aplicação, a frase cai para "outra aplicação"', () => {
        const e = efeitoDeDesignar(
          atual({ aplicacaoId: 'app-origem', status: 'ENVIADA' }),
          ctx,
        );
        expect(e.frase).toMatch(/outra aplicação/);
      });
    });
  });
});

describe('⭐⭐ INELEGÍVEL não se designa — a guarda que faltava na API (12/09)', () => {
  const ctx = (over: Record<string, unknown> = {}) => ({
    avaliadoId: 'p1',
    nomeDoAvaliado: 'FULANO DE TAL',
    novoAvaliadorId: 'chefe',
    novoAvaliadorNome: 'A CHEFE',
    aplicacaoId: 'app1',
    ...over,
  });

  /**
   * A TELA já impedia — checkbox `disabled={!linha.elegivel}` e o botão
   * "Definir avaliador" só dentro de `{linha.elegivel && …}`. A API não
   * checava, e criava avaliação para quem a régua do ciclo excluiu: pessoa
   * marcada "fora do ciclo" com avaliação viva na fila de alguém.
   */
  it('recusa quem a régua do ciclo excluiu, e diz o motivo dela', () => {
    const e = efeitoDeDesignar(
      null,
      ctx({
        elegibilidadeDoAvaliado: {
          elegivel: false,
          justificativa: 'Afastado na data-base do ciclo, e este ciclo está configurado para não incluir afastados.',
        },
      }),
    );
    expect(e.acao).toBe('RECUSAR');
    expect(e.frase).toMatch(/está FORA deste ciclo/);
    expect(e.frase).toMatch(/Afastado na data-base/);
  });

  /** A recusa aponta o caminho: incluir por decisão registrada, e designar depois. */
  it('a frase diz COMO avaliar essa pessoa mesmo assim', () => {
    const e = efeitoDeDesignar(null, ctx({ elegibilidadeDoAvaliado: { elegivel: false } }));
    expect(e.frase).toMatch(/inclua-a no ciclo pela Designação/);
    expect(e.frase).toMatch(/justificativa/);
  });

  it('elegível segue passando', () => {
    expect(efeitoDeDesignar(null, ctx({ elegibilidadeDoAvaliado: { elegivel: true } })).acao).toBe('CRIAR');
  });

  /**
   * ⚠️ `undefined` = quem chamou não resolveu a elegibilidade. A guarda recusa
   * o que SABE estar fora, nunca o que não conferiu — senão um chamador novo
   * que esquecesse o campo passaria a barrar todo mundo.
   */
  it('sem a elegibilidade resolvida, não opina', () => {
    expect(efeitoDeDesignar(null, ctx()).acao).toBe('CRIAR');
  });

  /**
   * ⭐ A ordem importa: "esta pessoa não está no ciclo" é anterior a "quem
   * avalia quem". Designar um inelegível para si mesmo é duas coisas erradas, e
   * a que se diz primeiro é a que se resolve primeiro.
   */
  it('inelegível vence a autoavaliação na ordem das recusas', () => {
    const e = efeitoDeDesignar(
      null,
      ctx({ novoAvaliadorId: 'p1', elegibilidadeDoAvaliado: { elegivel: false } }),
    );
    expect(e.acao).toBe('RECUSAR');
    expect(e.frase).toMatch(/FORA deste ciclo/);
  });

  it('recusa também quando já existe avaliação (o upsert não revive inelegível)', () => {
    const e = efeitoDeDesignar(
      { status: 'PENDENTE', respostas: 0, avaliadorId: 'outro', avaliadorNome: 'OUTRO', aplicacaoId: 'app1' },
      ctx({ elegibilidadeDoAvaliado: { elegivel: false } }),
    );
    expect(e.acao).toBe('RECUSAR');
    expect(e.avaliadorAtual).toBe('OUTRO');
  });
});
