import { avisosEncerramento } from '../avisosEncerramento';

// ⭐ Reportado pelo Clenio (25/07): dava p/ fechar a rota pelo "Encerrar" sem ter
// baixado ninguém — e o backend marcava todas as pendentes como ENTREGUE em
// silêncio. Estes testes travam o aviso que agora exige um "sim" consciente.

describe('avisosEncerramento', () => {
  it('rota completa e com KM de saída não gera aviso (encerra direto)', () => {
    expect(avisosEncerramento({ pendentes: 0, kmInicial: 12000 })).toEqual([]);
  });

  it('avisa quantas entregas viram ENTREGUE sem comprovante', () => {
    const [a] = avisosEncerramento({ pendentes: 3, kmInicial: 12000 });
    expect(a).toContain('3 entregas ainda pendentes');
    expect(a).toContain('ENTREGUE sem comprovante');
  });

  it('concorda em número no singular', () => {
    const [a] = avisosEncerramento({ pendentes: 1, kmInicial: 12000 });
    expect(a).toContain('1 entrega ainda pendente será marcada');
    expect(a).not.toContain('serão');
  });

  it('avisa (sem bloquear) quando a rota nunca registrou KM de saída', () => {
    const avisos = avisosEncerramento({ pendentes: 0, kmInicial: null });
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('não teve KM de saída');
  });

  it('acumula os dois avisos — pendentes primeiro, KM depois', () => {
    const avisos = avisosEncerramento({ pendentes: 2, kmInicial: null });
    expect(avisos).toHaveLength(2);
    expect(avisos[0]).toContain('ENTREGUE sem comprovante');
    expect(avisos[1]).toContain('KM de saída');
  });

  it('KM de saída ZERO é válido — não é o mesmo que não registrado', () => {
    expect(avisosEncerramento({ pendentes: 0, kmInicial: 0 })).toEqual([]);
  });
});
