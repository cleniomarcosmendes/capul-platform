import { describe, it, expect } from 'vitest';
import { MOTIVO_MINIMO, MOTIVO_MINIMO_EM_MASSA, faltamCaracteres } from './motivo';

/**
 * ⭐⭐ Gêmeo de `backend/common/motivo.ts`. Esta cópia já divergiu: até 09/09 a
 * `CiclosPage` chamava de `MOTIVO_MINIMO` o valor **15**, o mesmo nome que no
 * backend vale **3**. Nome igual com valor diferente é pior que número solto —
 * quem confere um lado contra o outro lê "iguais" e segue.
 */
describe('os dois mínimos', () => {
  it('⚠️ os VALORES, travados — é o que a divergência de 09/09 custou', () => {
    expect(MOTIVO_MINIMO).toBe(3);
    expect(MOTIVO_MINIMO_EM_MASSA).toBe(15);
  });

  /** ⭐ O mínimo acompanha o ALCANCE do ato, nunca o nome dele. */
  it('o de massa é maior que o de uma linha', () => {
    expect(MOTIVO_MINIMO_EM_MASSA).toBeGreaterThan(MOTIVO_MINIMO);
  });
});

describe('faltamCaracteres', () => {
  it('conta o que falta, não o que tem', () => {
    expect(faltamCaracteres('ab', 15)).toBe('Escreva pelo menos 15 caracteres — faltam 13.');
  });

  /** ⚠️ O `trim` importa: espaço não é motivo. */
  it('espaço em branco não conta', () => {
    expect(faltamCaracteres('   ', 3)).toContain('faltam 3');
    expect(faltamCaracteres('  ab  ', 3)).toContain('faltam 1');
  });

  /**
   * ⚠️ O CASO QUE FALHA: com o motivo já suficiente, "faltam 0" (ou negativo)
   * é frase que não deveria aparecer. Ela existe no retorno, mas o chamador só
   * a mostra enquanto falta — o teste registra o contrato para quem for mexer.
   */
  it('com o mínimo atingido a frase perde sentido — quem chama não deve mostrá-la', () => {
    expect(faltamCaracteres('abc', 3)).toContain('faltam 0');
    expect(faltamCaracteres('abcdef', 3)).toContain('faltam -3');
  });
});
