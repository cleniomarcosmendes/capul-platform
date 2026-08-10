import { impedimentosEncerramento } from '../impedimentosEncerramento';

// ⭐ Reportado pelo Clenio (25/07): dava p/ fechar a rota pelo "Encerrar" sem ter
// baixado ninguém — e o backend marcava todas as pendentes como ENTREGUE em
// silêncio. Em 09/08 o servidor passou a RECUSAR (KM de saída + KM de retorno +
// todas as paradas resolvidas), então o que era "aviso antes de deixar" virou
// **impedimento**: o que estes testes travam é o botão ficar desabilitado com o
// motivo na tela, em vez de deixar tocar só para receber erro do servidor.

describe('impedimentosEncerramento', () => {
  it('rota completa e com KM de saída pode encerrar', () => {
    expect(impedimentosEncerramento({ pendentes: 0, kmInicial: 12000 })).toEqual([]);
  });

  it('entrega sem baixa impede encerrar', () => {
    const [i] = impedimentosEncerramento({ pendentes: 3, kmInicial: 12000 });
    expect(i).toContain('Faltam 3 entregas');
    expect(i).toContain('dê baixa ou recuse');
  });

  it('concorda em número no singular', () => {
    const [i] = impedimentosEncerramento({ pendentes: 1, kmInicial: 12000 });
    expect(i).toContain('Falta 1 entrega');
    expect(i).not.toContain('Faltam');
  });

  // Antes isto era aviso não-bloqueante ("o KM rodado não será calculado") e a
  // rota fechava sem hodômetro — o trecho sumia do custo por km.
  it('rota sem KM de saída não encerra', () => {
    const impedimentos = impedimentosEncerramento({ pendentes: 0, kmInicial: null });
    expect(impedimentos).toHaveLength(1);
    expect(impedimentos[0]).toContain('KM de saída');
  });

  it('acumula os dois — KM de saída primeiro, pendências depois', () => {
    const impedimentos = impedimentosEncerramento({ pendentes: 2, kmInicial: null });
    expect(impedimentos).toHaveLength(2);
    expect(impedimentos[0]).toContain('KM de saída');
    expect(impedimentos[1]).toContain('Faltam 2 entregas');
  });

  it('KM de saída ZERO é válido — não é o mesmo que não registrado', () => {
    expect(impedimentosEncerramento({ pendentes: 0, kmInicial: 0 })).toEqual([]);
  });
});
