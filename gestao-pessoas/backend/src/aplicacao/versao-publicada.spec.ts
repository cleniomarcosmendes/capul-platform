/**
 * ⭐⭐ Aplicação só sobre versão PUBLICADA.
 *
 * A tela já filtrava (`.filter((v) => v.publicadoEm)`) e a API aceitava
 * qualquer versão — a direção permissiva da §3.1.77, que é a silenciosa.
 * Inofensiva enquanto não existe rascunho nenhum; a Etapa 2 cria o primeiro.
 */
import { validarAplicacao, problemasParaAbrir } from '../ciclo/abertura.validator.js';

const base = {
  nome: 'Administrativo',
  pessoasNoPublico: 10,
  pesoAvaliacao: 60,
  criterios: [],
  modeloFinalidade: 'PRODUCAO' as const,
};

describe('versão em rascunho não sustenta aplicação', () => {
  it('recusa ao CRIAR, e a frase diz por quê', () => {
    const p = validarAplicacao({ ...base, versaoPublicada: false });
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/RASCUNHO/);
    expect(p[0]).toMatch(/muda debaixo de quem responde/);
  });

  it('recusa também ao ABRIR o ciclo — mesma função, dois momentos', () => {
    const p = problemasParaAbrir([{ ...base, versaoPublicada: false }], [
      { descricao: 'Único', limiteInferior: 0, limiteSuperior: 100 },
    ]);
    expect(p.some((x) => /RASCUNHO/.test(x))).toBe(true);
  });

  it('versão publicada passa', () => {
    expect(validarAplicacao({ ...base, versaoPublicada: true })).toEqual([]);
  });

  /**
   * ⚠️ `undefined` é "não informado", não "rascunho". Tratar ausência como
   * problema faria a guarda acusar erro em chamador que nunca soube dela — e o
   * que cobra os chamadores é o teste de invariante, não este.
   */
  it('não informado não inventa problema', () => {
    expect(validarAplicacao(base)).toEqual([]);
  });
});
