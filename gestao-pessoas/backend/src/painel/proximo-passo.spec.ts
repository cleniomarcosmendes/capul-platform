import { proximoPasso, type EstadoDoCiclo } from './proximo-passo.js';

const base: EstadoDoCiclo = {
  status: 'RASCUNHO',
  aplicacoes: 0,
  noPublico: 0,
  designados: 0,
  semDesignacao: 0,
  enviadas: 0,
  aFazer: 0,
  apuradas: 0,
};

const rascunho = (o: Partial<EstadoDoCiclo> = {}) => ({ ...base, ...o });
const aberto = (o: Partial<EstadoDoCiclo> = {}) => ({ ...base, status: 'ABERTO', ...o });

describe('o próximo passo do ciclo', () => {
  describe('RASCUNHO — a montagem, na ordem em que ela acontece', () => {
    it('sem aplicação: montar a primeira', () => {
      expect(proximoPasso(rascunho())).toMatchObject({ codigo: 'MONTAR_APLICACAO', aba: 'aplicacoes' });
    });

    it('com aplicação e sem público: montar o público', () => {
      expect(proximoPasso(rascunho({ aplicacoes: 2 }))).toMatchObject({ codigo: 'MONTAR_PUBLICO' });
    });

    it('com público e gente sem avaliador: designar — e o rótulo traz o NÚMERO', () => {
      const p = proximoPasso(rascunho({ aplicacoes: 2, noPublico: 894, semDesignacao: 95 }));
      expect(p).toMatchObject({ codigo: 'DESIGNAR', aba: 'designacao' });
      expect(p?.rotulo).toContain('95');
      // ⚠️ O universo NOMEADO: 95 é deste ciclo, e o cabeçalho é onde o número
      // é lido primeiro — é onde a ambiguidade custa mais (§3.12).
      expect(p?.rotulo).toMatch(/neste ciclo/);
    });

    it('tudo designado: abrir', () => {
      expect(proximoPasso(rascunho({ aplicacoes: 2, noPublico: 894, designados: 894 }))).toMatchObject({
        codigo: 'ABRIR',
        aba: null,
      });
    });
  });

  describe('ABERTO', () => {
    it('ainda há gente sem avaliador: designar continua sendo o passo', () => {
      expect(proximoPasso(aberto({ aplicacoes: 4, noPublico: 1036, designados: 894, semDesignacao: 95 })))
        .toMatchObject({ codigo: 'DESIGNAR' });
    });

    /**
     * ⭐⭐ A FASE MAIS LONGA — e ela ficava sem nada na tela (08/09).
     *
     * O `null` aqui estava MEIO certo: a bola é dos avaliadores, e sugerir
     * "apurar" empurraria apuração parcial, "encerrar" bateria na recusa. Mas
     * "a bola não é sua" e "não há nada a fazer" são coisas diferentes, e o
     * `null` dizia a segunda. Entre abrir e apurar podem passar semanas.
     */
    it('tudo designado e ninguém respondendo: diz DE QUEM É A VEZ', () => {
      const p = proximoPasso(aberto({ aplicacoes: 4, noPublico: 894, designados: 894, aFazer: 894 }));
      expect(p).toMatchObject({ codigo: 'ACOMPANHAR', aba: 'painel' });
      expect(p?.rotulo).toContain('894');
    });

    /** ⚠️ NÃO pode sugerir apurar (parcial) nem encerrar (bate na recusa). */
    it('e NÃO manda apurar nem encerrar', () => {
      const p = proximoPasso(aberto({ aplicacoes: 4, designados: 894, enviadas: 3, aFazer: 891, apuradas: 3 }));
      expect(p?.codigo).toBe('ACOMPANHAR');
      expect(p?.rotulo).not.toMatch(/apur/i);
      expect(p?.rotulo).not.toMatch(/encerr/i);
    });

    /**
     * ⭐ SEM ATRIBUIR INTENÇÃO. Quem não respondeu pode ter mil motivos, e esta
     * é a frase lida imediatamente antes de a gestora cobrar alguém: o Painel
     * mostra uma CONTAGEM por pessoa, não um veredito sobre ela.
     */
    it('a frase descreve a contagem, não julga quem não respondeu', () => {
      const p = proximoPasso(aberto({ aplicacoes: 4, designados: 894, enviadas: 3, aFazer: 891 }));
      expect(p?.rotulo).toMatch(/Agora é com os avaliadores/);
      expect(p?.rotulo).toMatch(/quantas faltam por avaliador/);
      expect(p?.rotulo).not.toMatch(/segurando|atras[a-z]*|parad[ao]/i);
    });

    /** ⚠️ E não é imperativo: não há ato do RH nesta fase. */
    it('não manda fazer nada — não há ato do RH aqui', () => {
      const p = proximoPasso(aberto({ aplicacoes: 4, designados: 894, aFazer: 894 }));
      expect(p?.rotulo).not.toMatch(/^(Monte|Designe|Apure|Encerre|Abra|Acompanhe)/);
    });

    it('todas enviadas e nada apurado: apurar', () => {
      const p = proximoPasso(aberto({ aplicacoes: 1, designados: 9, enviadas: 9, aFazer: 0, apuradas: 0 }));
      expect(p).toMatchObject({ codigo: 'APURAR', aba: 'painel' });
      expect(p?.rotulo).toContain('9');
    });

    it('tudo enviado e apurado: encerrar', () => {
      expect(
        proximoPasso(aberto({ aplicacoes: 1, designados: 9, enviadas: 9, aFazer: 0, apuradas: 9 })),
      ).toMatchObject({ codigo: 'ENCERRAR', aba: null });
    });

    it('ciclo aberto e vazio: não inventa "designe" para quem não está no público', () => {
      expect(proximoPasso(aberto({ aplicacoes: 1 }))).toBeNull();
    });
  });

  it('ENCERRADO não tem próximo passo — reabrir é exceção, não caminho', () => {
    expect(
      proximoPasso({ ...base, status: 'ENCERRADO', aplicacoes: 1, designados: 9, enviadas: 9, apuradas: 9 }),
    ).toBeNull();
  });
});
