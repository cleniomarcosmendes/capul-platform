/**
 * ⭐⭐ INVARIANTE — nenhum motivo declara o mínimo com um LITERAL.
 *
 * O erro de 09/09 não foi um número trocado, foi a FORMA: os quatro DTOs
 * escreviam `@MinLength(3)` na mão, e `MOTIVO_MINIMO` não era importado em
 * lugar nenhum — a regra tinha sido extraída para `common/motivo.ts` e as
 * chamadas ficaram para trás. Com literal, o ato NOVO copia o vizinho e herda o
 * número errado sem ninguém notar; foi assim que `reabrir` o ciclo, que é ato
 * em massa, nasceu com o mínimo de uma linha.
 *
 * ⚠️ Este teste não sabe qual é o número certo — essa é decisão de quem escreve
 * o ato, e depende de quantos registros ele atinge. Ele cobra só que a escolha
 * seja EXPLÍCITA, feita entre as duas constantes nomeadas.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const RAIZ = path.join(__dirname, '..');

function arquivosTs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return arquivosTs(p);
    return e.isFile() && p.endsWith('.ts') && !p.endsWith('.spec.ts') ? [p] : [];
  });
}

/**
 * Campos que são MOTIVO. `conteudo` da designação-padrão não é: é o texto de um
 * cadastro, não a justificativa de um ato irreversível.
 */
const CAMPOS_DE_MOTIVO = /(motivo|justificativa)\s*[!?]?\s*:/i;

describe('mínimo de motivo — sempre pela constante', () => {
  const fontes = arquivosTs(RAIZ);

  it('encontra os arquivos do módulo (senão o teste passa por não varrer nada)', () => {
    expect(fontes.length).toBeGreaterThan(30);
  });

  it('nenhum campo de motivo usa @MinLength com número literal', () => {
    const infratores: string[] = [];
    for (const f of fontes) {
      const linhas = fs.readFileSync(f, 'utf8').split('\n');
      linhas.forEach((linha, i) => {
        const m = /@MinLength\((\d+)\)/.exec(linha);
        if (m && CAMPOS_DE_MOTIVO.test(linha)) {
          infratores.push(`${path.relative(RAIZ, f)}:${i + 1} → @MinLength(${m[1]})`);
        }
      });
    }
    expect(infratores).toEqual([]);
  });

  it('as duas constantes são de fato importadas por quem declara motivo', () => {
    const declaram = fontes.filter((f) => {
      const src = fs.readFileSync(f, 'utf8');
      return /@MinLength\(MOTIVO_MINIMO/.test(src);
    });
    // Se ninguém importa, ou a varredura quebrou, ou a regra sumiu do módulo.
    expect(declaram.length).toBeGreaterThanOrEqual(3);
    for (const f of declaram) {
      expect(fs.readFileSync(f, 'utf8')).toMatch(/from '.*common\/motivo\.js'/);
    }
  });
});
