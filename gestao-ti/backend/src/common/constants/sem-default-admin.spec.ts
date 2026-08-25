import * as fs from 'fs';
import * as path from 'path';

/**
 * ⭐ INVARIANTE — nenhum parâmetro de papel nasce valendo ADMIN.
 *
 * O módulo tinha 38 métodos declarados como `role: string = 'ADMIN'`. Nenhum chamador
 * dependia disso (a mudança para obrigatório não quebrou uma linha sequer), mas o
 * padrão é **fail-open**: quem esquecesse o argumento ganhava privilégio máximo, e nada
 * acusaria — nem compilador, nem teste, nem log. Auditoria de 25/08, §4.
 *
 * Vale para `= 'ADMIN'` e para `= 'GESTOR'`: o default seguro é não existir.
 */
describe('Workspace — INVARIANTE: papel não tem default privilegiado', () => {
  function arquivosTs(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return arquivosTs(p);
      return e.isFile() && p.endsWith('.ts') && !p.endsWith('.spec.ts') ? [p] : [];
    });
  }

  it('nenhum `role: string = ADMIN|GESTOR` no fonte', () => {
    const raiz = path.join(__dirname, '..', '..');
    const suspeitos: string[] = [];
    for (const arquivo of arquivosTs(raiz)) {
      const src = fs.readFileSync(arquivo, 'utf8');
      const m = src.match(/role\s*:\s*string\s*=\s*'(ADMIN|GESTOR)'/g);
      if (m) suspeitos.push(`${path.relative(raiz, arquivo)} (${m.length}x)`);
    }
    expect(suspeitos.sort()).toEqual([]);
  });
});
