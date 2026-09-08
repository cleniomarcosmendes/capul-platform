import { chapasEquivalentes, normalizarChapa } from './chapa.js';

describe('a chapa do Protheus × a da nossa base', () => {
  it('E + 5 dígitos vira 0 + os mesmos dígitos', () => {
    expect(normalizarChapa('E01981')).toBe('001981');
    expect(normalizarChapa('E03942')).toBe('003942');
  });

  it('a forma que já é a nossa passa intacta', () => {
    expect(normalizarChapa('001047')).toBe('001047');
  });

  it('apara e sobe para maiúsculas — o Protheus manda campo fixo', () => {
    expect(normalizarChapa('  e01981 ')).toBe('001981');
  });

  it.each([null, undefined, '', '   '])('vazio (%s) não vira chapa', (v) => {
    expect(normalizarChapa(v)).toBe('');
    expect(chapasEquivalentes(v)).toEqual([]);
  });

  /**
   * ⚠️ REGRA ESTREITA DE PROPÓSITO. Nada de "tira letras e compara dígitos":
   * `SUPVEN01` é login de posto, não é chapa de ninguém, e tem de continuar não
   * achando nada. Prefixo diferente deve falhar visivelmente, não ser adivinhado.
   */
  it.each(['SUPVEN01', 'E0194', 'E019811', 'X01981', 'ABC', '999888'])(
    '%s não é convertida — o que não casa o formato passa cru',
    (v) => {
      expect(normalizarChapa(v)).toBe(v.toUpperCase());
    },
  );

  describe('candidatos de busca', () => {
    /** ⭐ Busca pelas DUAS: se um dia o rh tiver a forma `E…`, continua achando. */
    it('E01981 procura pelas duas formas, com a nossa primeiro', () => {
      expect(chapasEquivalentes('E01981')).toEqual(['001981', 'E01981']);
    });

    it('001981 procura só por ela — não inventa a forma do Protheus', () => {
      expect(chapasEquivalentes('001981')).toEqual(['001981']);
    });
  });
});
