import { efeitoDeDesfazer } from './desfazer-designacao.js';

const av = (over: Partial<{ status: string; respostas: number; avaliadorNome: string | null }> = {}) => ({
  status: 'PENDENTE',
  respostas: 0,
  avaliadorNome: 'A CHEFE',
  ...over,
});

describe('⭐⭐ desfazer designação — tira o avaliador, mantém a pessoa no ciclo', () => {
  it('desfaz o caso comum: PENDENTE, sem resposta', () => {
    const e = efeitoDeDesfazer(av());
    expect(e.acao).toBe('DESFAZER');
    expect(e.frase).toMatch(/tira a avaliação da fila de A CHEFE/);
  });

  /**
   * ⭐ A frase precisa dizer o que NÃO muda — é a diferença entre isto e o
   * EXCLUIR, e é exatamente o que se confunde.
   */
  it('a frase diz que a pessoa CONTINUA no ciclo', () => {
    expect(efeitoDeDesfazer(av()).frase).toMatch(/CONTINUA no ciclo/);
    expect(efeitoDeDesfazer(av()).frase).toMatch(/sem avaliador/);
  });

  it('sem designação, não há o que fazer', () => {
    expect(efeitoDeDesfazer(null)).toEqual({ acao: 'NADA_A_FAZER', frase: null });
  });

  /** Resposta é julgamento de alguém — apagar em silêncio é destruir trabalho. */
  it('recusa quando já começaram a responder, e oferece TROCAR em vez de desfazer', () => {
    const e = efeitoDeDesfazer(av({ respostas: 7 }));
    expect(e.acao).toBe('RECUSAR');
    expect(e.frase).toMatch(/troque o avaliador/);
    expect(e.frase).toMatch(/Respostas já dadas: 7\./);
  });

  it('recusa ENVIADA, e manda reabrir primeiro', () => {
    const e = efeitoDeDesfazer(av({ status: 'ENVIADA' }));
    expect(e.acao).toBe('RECUSAR');
    expect(e.frase).toMatch(/reabrir a avaliação/);
  });

  /** Cancelada é registro de decisão do RH — apagá-la sumiria com o motivo. */
  it('recusa CANCELADA, e manda usar o Incluir', () => {
    const e = efeitoDeDesfazer(av({ status: 'CANCELADA' }));
    expect(e.acao).toBe('RECUSAR');
    expect(e.frase).toMatch(/use o Incluir/);
  });

  it('sem nome do avaliador, a frase não fica quebrada', () => {
    expect(efeitoDeDesfazer(av({ avaliadorNome: null })).frase).toMatch(/o avaliador designado/);
  });
});
