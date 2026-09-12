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
import * as os from 'node:os';
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


/**
 * ⭐⭐ O CANÁRIO — requisito de todo teste que varre fonte, não detalhe.
 *
 * O `expect(fontes.length).toBeGreaterThan(30)` acima prova que a varredura LEU
 * arquivos. Não prova que ela ainda RECONHECE o que procura: se o padrão parar
 * de casar (uma refatoração, um acento, uma aspa trocada), a lista de
 * infratores vem vazia e o teste fica **verde por ausência de leitura** — a
 * mesma classe do `npm test` que rodava "52 suítes, 0 testes" e do
 * `tsc --noEmit` que checa zero arquivo.
 *
 * A prova é alimentar o próprio matcher com a forma ERRADA e exigir que ele a
 * reconheça. Padrão herdado do `avaliacoes-que-contam.invariante.spec.ts`.
 */
  it('⚠️ o varredor reconhece a cópia quando ela existe', () => {
    /**
     * ⚠️ O arquivo do canário nasce FORA da árvore varrida. Escrevê-lo dentro
     * de `src/` (a primeira tentativa) fez as outras suítes que varrem o mesmo
     * diretório lerem um arquivo que sumia no meio da execução — `ENOENT` em
     * teste que não tem nada a ver com este. Canário que interfere no que ele
     * observa não é canário.
     */
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'canario-'));
    const comCopia = path.join(pasta, 'copia.ts');
    try {
      fs.writeFileSync(comCopia, "const x = 'GESTAO_PESSOAS';\n", 'utf8');
      expect(infratores([comCopia], /'GESTAO_PESSOAS'/, 'common/roles-rh.ts')).toHaveLength(1);
      // ...e o comentário continua dispensado, senão o varredor acusaria toda
      // documentação que cita o valor.
      fs.writeFileSync(comCopia, "// cita 'GESTAO_PESSOAS' de propósito\n", 'utf8');
      expect(infratores([comCopia], /'GESTAO_PESSOAS'/, 'common/roles-rh.ts')).toEqual([]);
    } finally {
      fs.rmSync(pasta, { recursive: true, force: true });
    }
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
