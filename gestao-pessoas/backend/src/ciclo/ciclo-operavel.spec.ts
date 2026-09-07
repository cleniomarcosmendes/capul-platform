import { BadRequestException } from '@nestjs/common';
import {
  assertCicloAceitaReaberturaDeAvaliacao,
  assertCicloOperavel,
} from './ciclo-operavel.js';

const ENCERRADO = { status: 'ENCERRADO', encerradoEm: new Date('2026-10-15T12:00:00Z') };

describe('ciclo encerrado não muda — e a recusa ensina o que fazer', () => {
  it.each(['RASCUNHO', 'ABERTO'])('%s passa, sem cerimônia', (status) => {
    expect(() => assertCicloOperavel({ status }, 'designação')).not.toThrow();
  });

  it('ENCERRADO recusa, com a ação que se tentou no texto', () => {
    expect(() => assertCicloOperavel(ENCERRADO, 'apuração')).toThrow(BadRequestException);
    expect(() => assertCicloOperavel(ENCERRADO, 'apuração')).toThrow(/não aceita apuração/);
  });

  /**
   * ⭐ "Este ciclo está encerrado" sem alternativa é da mesma família do
   * "Excluir" ser o único botão da linha: o sistema diz não e a pessoa vai
   * procurar sozinha um caminho — e o que ela acha é criar outro ciclo.
   */
  it('a recusa DIZ O QUE FAZER: reabrir, quem reabre, e que fica registrado', () => {
    try {
      assertCicloOperavel(ENCERRADO, 'designação');
      throw new Error('devia ter recusado');
    } catch (e) {
      const m = (e as Error).message;
      expect(m).toMatch(/reabra o ciclo/i);
      expect(m).toMatch(/RH_ADMIN/);
      expect(m).toMatch(/motivo/);
      expect(m).toMatch(/registrado/);
    }
  });

  it('e diz o que CONTINUA valendo — encerrado ainda se lê', () => {
    expect(() => assertCicloOperavel(ENCERRADO, 'designação')).toThrow(
      /resultados, memória de cálculo/,
    );
  });

  it('a data do encerramento entra na frase quando existe', () => {
    expect(() => assertCicloOperavel(ENCERRADO, 'designação')).toThrow(/15\/10\/2026/);
    // Sem a data, a frase continua correta — não vira "encerrado em undefined".
    expect(() => assertCicloOperavel({ status: 'ENCERRADO' }, 'designação')).toThrow(
      /encerrado e não aceita/,
    );
  });

  /**
   * ⭐⭐ O BECO. Reabrir avaliação em ciclo encerrado dava certo e não servia
   * para nada: a avaliação ficava EM_ANDAMENTO e ninguém podia responder,
   * porque responder exige ciclo ABERTO. A recusa tem de ensinar a ORDEM.
   */
  describe('reabrir avaliação num ciclo encerrado', () => {
    it('recusa e ensina a ordem: o CICLO primeiro', () => {
      expect(() => assertCicloAceitaReaberturaDeAvaliacao(ENCERRADO)).toThrow(
        /Reabra o CICLO primeiro/,
      );
    });

    it('e diz POR QUE a ordem importa, não só que é a ordem', () => {
      expect(() => assertCicloAceitaReaberturaDeAvaliacao(ENCERRADO)).toThrow(
        /sem que ninguém pudesse responder/,
      );
    });

    it('com o ciclo aberto, não atrapalha', () => {
      expect(() => assertCicloAceitaReaberturaDeAvaliacao({ status: 'ABERTO' })).not.toThrow();
    });
  });
});
