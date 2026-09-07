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
     * ⭐⭐ O CASO QUE DEFINE A REGRA. Tudo designado e ninguém respondendo: a
     * bola é dos AVALIADORES, não do RH. Não há passo a sugerir — e sugerir
     * "apurar" empurraria uma apuração parcial, "encerrar" bateria na recusa.
     */
    it('tudo designado e ninguém respondendo: NÃO INVENTA passo', () => {
      expect(proximoPasso(aberto({ aplicacoes: 4, noPublico: 894, designados: 894, aFazer: 894 }))).toBeNull();
    });

    it('idem com envio parcial — apurar cedo é escolha, não dever', () => {
      expect(
        proximoPasso(aberto({ aplicacoes: 4, designados: 894, enviadas: 3, aFazer: 891, apuradas: 3 })),
      ).toBeNull();
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
