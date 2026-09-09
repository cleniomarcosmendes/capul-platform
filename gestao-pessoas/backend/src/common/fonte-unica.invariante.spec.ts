/**
 * ⭐⭐ INVARIANTE — o valor de uma constante não se reescreve fora dela.
 *
 * A varredura de 09/09/2026 achou seis casos da MESMA classe, e a causa comum
 * não é distração: **a fonte única foi criada DEPOIS dos chamadores e o commit
 * que a criou não varreu**. Cada literal que ficou para trás é uma cópia que
 * envelhece sozinha — e envelhece sem erro nenhum, porque hoje as duas dizem a
 * mesma coisa. O dia em que a constante mudar, o chamador esquecido continua
 * compilando e passa a responder outra pergunta.
 *
 * Os dois que este teste cobra são os que doem mais:
 *
 *   - `STATUS_VIVOS` — `encerrarCiclo` contava as pendentes com uma cópia e
 *     cancelava com outra: as **duas metades do mesmo ato** escritas à mão. Se
 *     divergirem, a recusa fala de um conjunto e o encerramento cancela outro,
 *     em silêncio e sobre avaliação de gente.
 *   - `MODULO` — escrito à mão dentro de SQL cru, onde nada avisa. A consulta
 *     não quebra: passa a contar zero permissão, e todo avaliador vira "sem
 *     acesso" numa tela que existe para dizer quem consegue entrar.
 *
 * ⚠️ Ele varre o FONTE, e não a lista de quem eu lembrei de olhar — que é a
 * razão de existir: o `grep` do dia acha onde a regra FOI escrita, não onde ela
 * DEVERIA estar.
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

/** Comentário citando o literal é documentação, não cópia. */
const EH_COMENTARIO = /^\s*(\*|\/\/|\/\*)/;

function infratores(fontes: string[], padrao: RegExp, donoDoValor: string): string[] {
  const achados: string[] = [];
  for (const f of fontes) {
    const relativo = path.relative(RAIZ, f).replace(/\\/g, '/');
    if (relativo === donoDoValor) continue;
    fs.readFileSync(f, 'utf8')
      .split('\n')
      .forEach((linha, i) => {
        if (EH_COMENTARIO.test(linha)) return;
        if (padrao.test(linha)) achados.push(`${relativo}:${i + 1} → ${linha.trim()}`);
      });
  }
  return achados;
}

describe('fonte única — o literal mora com a constante', () => {
  const fontes = arquivosTs(RAIZ);

  it('encontra os arquivos do módulo (senão o teste passa por não varrer nada)', () => {
    expect(fontes.length).toBeGreaterThan(30);
  });

  it('ninguém reescreve o conjunto de STATUS_VIVOS', () => {
    expect(
      infratores(fontes, /'PENDENTE'\s*,\s*'EM_ANDAMENTO'/, 'avaliacao/cancelamento.ts'),
    ).toEqual([]);
  });

  it('ninguém reescreve o código do módulo — nem dentro de SQL cru', () => {
    expect(infratores(fontes, /'GESTAO_PESSOAS'/, 'common/roles-rh.ts')).toEqual([]);
  });

  it('ninguém reescreve a frase da autoavaliação', () => {
    expect(
      infratores(fontes, /Ninguém pode ser o avaliador da própria avaliação/, 'common/autoavaliacao.ts'),
    ).toEqual([]);
  });
});
