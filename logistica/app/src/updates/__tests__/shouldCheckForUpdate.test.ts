import { shouldCheckForUpdate, THROTTLE_MS } from '../shouldCheckForUpdate';

describe('shouldCheckForUpdate', () => {
  it('permite a primeira checagem (nunca checou)', () => {
    expect(shouldCheckForUpdate(null, 1_000_000)).toBe(true);
  });
  it('bloqueia dentro da janela de throttle', () => {
    const now = 1_000_000;
    expect(shouldCheckForUpdate(now - (THROTTLE_MS - 1), now)).toBe(false);
  });
  it('permite depois da janela de throttle', () => {
    const now = 1_000_000;
    expect(shouldCheckForUpdate(now - THROTTLE_MS, now)).toBe(true);
  });
});
