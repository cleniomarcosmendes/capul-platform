import { consolidar, distanciaM, type Ponto } from './geo.util';

// Pontos próximos de Unaí/MG (~ -16.36, -46.90). ~0.0001° lat ≈ 11 m.
const base: Ponto = { lat: -16.36, lng: -46.9 };

describe('geo.util distanciaM', () => {
  it('0 para o mesmo ponto', () => {
    expect(distanciaM(base, base)).toBe(0);
  });
  it('~110 m para 0.001° de latitude', () => {
    const d = distanciaM(base, { lat: -16.361, lng: -46.9 });
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });
});

describe('geo.util consolidar', () => {
  it('sem pontos → null', () => {
    expect(consolidar([])).toBeNull();
  });

  it('1 ponto → PROVISORIA (n=1, raio 0)', () => {
    const c = consolidar([base]);
    expect(c).not.toBeNull();
    expect(c!.confianca).toBe('PROVISORIA');
    expect(c!.nMarcacoes).toBe(1);
    expect(c!.raioDispersaoM).toBe(0);
  });

  it('2 pontos próximos → PROVISORIA (abaixo do mínimo p/ confirmar)', () => {
    const c = consolidar([base, { lat: -16.3604, lng: -46.9002 }]);
    expect(c!.confianca).toBe('PROVISORIA');
    expect(c!.nMarcacoes).toBe(2);
  });

  it('3 pontos apertados (~50 m) → CONFIRMADA no cluster', () => {
    const c = consolidar([
      { lat: -16.36, lng: -46.9 },
      { lat: -16.3604, lng: -46.9002 },
      { lat: -16.3602, lng: -46.9001 },
    ]);
    expect(c!.confianca).toBe('CONFIRMADA');
    expect(c!.nMarcacoes).toBe(3);
    expect(c!.raioDispersaoM).toBeLessThanOrEqual(100);
  });

  it('descarta outlier (marcado da cidade) — cluster de 3 + 1 longe', () => {
    const c = consolidar([
      { lat: -16.36, lng: -46.9 },
      { lat: -16.3604, lng: -46.9002 },
      { lat: -16.3602, lng: -46.9001 },
      { lat: -16.37, lng: -46.91 }, // ~1.4 km — outlier
    ]);
    expect(c!.nMarcacoes).toBe(3); // o outlier NÃO entra no cluster vencedor
    expect(c!.confianca).toBe('CONFIRMADA');
    // O medóide fica no cluster denso, não no outlier.
    expect(distanciaM({ lat: c!.lat, lng: c!.lng }, base)).toBeLessThan(100);
  });
});
