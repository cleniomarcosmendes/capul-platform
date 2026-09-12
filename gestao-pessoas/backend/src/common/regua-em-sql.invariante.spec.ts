/**
 * ⭐⭐ INVARIANTE — a régua em SQL não pode divergir da régua em código.
 *
 * `rh.v_colaborador_elegivel` existe porque nem toda conferência passa por
 * script: num deploy, quem abre o `psql` precisa da régua ali. Mas **uma
 * segunda escrita da mesma regra envelhece errada** — é a família
 * [[feedback_regra_duplicada_envelhece_errada]], e desta vez a segunda cópia
 * está num arquivo `.sql` que nenhum compilador lê.
 *
 * Este teste lê **o arquivo da migration** e exige que a lista literal dentro do
 * `CREATE VIEW` seja **exatamente** a de `SITUACOES_ELEGIVEIS`. Mudar uma sem a
 * outra quebra a suíte — que é a única coisa que impede a view de virar o
 * segundo dono da verdade.
 *
 * ⚠️ Ele lê o ARQUIVO, não o banco: a suíte não tem banco, e o arquivo é o que
 * será aplicado em HLG e PROD. Se alguém alterar a view por SQL direto no
 * servidor, isto não pega — e é mais uma razão para não fazer isso.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SITUACOES_ELEGIVEIS } from './elegibilidade.js';

const MIGRATION = path.join(
  __dirname,
  '..',
  '..',
  'prisma',
  'migrations',
  '20260912200000_view_colaborador_elegivel',
  'migration.sql',
);

describe('⭐⭐ invariante — a view espelha SITUACOES_ELEGIVEIS', () => {
  const sql = fs.readFileSync(MIGRATION, 'utf8');

  /**
   * ⚠️ CANÁRIO — requisito de todo teste que varre arquivo (§3.1.97). Sem ele,
   * o dia em que o `CREATE VIEW` mudar de forma a lista vem vazia e o teste
   * fica verde por não ter lido nada.
   */
  it('⚠️ canário — o arquivo existe e a forma ainda é reconhecida', () => {
    expect(sql).toMatch(/CREATE OR REPLACE VIEW rh\.v_colaborador_elegivel/);
    expect(extrair(sql)).not.toHaveLength(0);
    // ...e o extrator reconhece a forma num texto sintético
    expect(extrair("WHERE c.situacao IN ('A', 'B');")).toEqual(['A', 'B']);
  });

  it('a lista da view é EXATAMENTE a da constante', () => {
    expect(extrair(sql)).toEqual([...SITUACOES_ELEGIVEIS]);
  });

  /**
   * ⚠️ E o comentário da view aponta para a constante. Sem isso, quem encontra
   * a view no `psql` não sabe que ela é cópia — e a trata como a regra.
   */
  it('a view diz de onde ela vem', () => {
    expect(sql).toMatch(/COMMENT ON VIEW rh\.v_colaborador_elegivel/);
    expect(sql).toMatch(/SITUACOES_ELEGIVEIS/);
    expect(sql).toMatch(/elegibilidade\.ts/);
  });
});

/** A lista literal do `IN (...)` do `WHERE`, na ordem em que está escrita. */
function extrair(sql: string): string[] {
  const m = /situacao\s+IN\s*\(([^)]*)\)/i.exec(sql);
  if (!m) return [];
  return m[1]
    .split(',')
    .map((x) => x.trim().replace(/^'|'$/g, ''))
    .filter(Boolean);
}
