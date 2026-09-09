/**
 * ⭐⭐ INVARIANTE — texto do BACKEND não flexiona com número.
 *
 * O frontend tem `flexao`/`contagem` (`lib/formato.ts`); o backend NÃO tem, e
 * não deve ter: seriam duas implementações da mesma regra de texto, que é a
 * classe de defeito que 09/09/2026 inteiro passou consertando. E "migrar as
 * frases para a tela" também não resolve — mensagem de recusa da API tem de
 * existir mesmo quando ninguém está olhando uma tela.
 *
 * A saída é de FORMA: escrever de um jeito em que o número não force
 * concordância. *"Designe as 1 pessoa(s)"* quebra; *"Sem avaliador neste ciclo:
 * 1"* não quebra com número nenhum.
 *
 * ⚠️ **A receita curta não basta, e isso foi medido.** "Ponha o número num
 * rótulo" conserta o número e deixa o RESTO da frase flexionando: depois de
 * deployar as dez primeiras, três ainda quebravam com 1 — *"para não ficarem de
 * fora"* (infinitivo pessoal), *"dividiu essas linhas"*, *"Seguem com o
 * avaliador que têm"*. A regra é: **tire a contagem de qualquer palavra que
 * concorde com ela — verbo e pronome inclusive.**
 *
 * ── O QUE ESTE TESTE NÃO PEGA ────────────────────────────────────────────────
 * A checagem 1 é exata (a forma parentética). A checagem 2 é uma REDE COM
 * BURACOS: só enxerga a palavra COLADA ao `${…}`. Concordância a três orações
 * de distância — *"…encerre com pendência, e **elas ficam** registradas"* — passa
 * batido, e foi exatamente assim que três frases minhas escaparam no mesmo dia.
 * Um verde aqui NÃO é prova de que a frase está certa com 1; é prova de que as
 * duas formas conhecidas não estão nela. Ao escrever texto com contagem, leia a
 * frase inteira **com o número 1**.
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
 * O texto que está DENTRO de aspas ou crases na linha — para `conta(s)` (chamada
 * de função) não ser confundido com `pessoa(s)` (texto). Máquina de estados
 * pequena de propósito: literal de template em várias linhas não é o caso aqui,
 * e um analisador de verdade seria mais frágil que o problema.
 */
function trechosEmTexto(linha: string): string[] {
  const achados: string[] = [];
  let aspa: string | null = null;
  let atual = '';
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspa) {
      if (c === '\\') { i++; continue; }
      if (c === aspa) { achados.push(atual); atual = ''; aspa = null; continue; }
      atual += c;
    } else if (c === "'" || c === '"' || c === '`') {
      aspa = c;
    } else if (c === '/' && linha[i + 1] === '/') {
      break; // comentário de linha fora de string
    }
  }
  return achados;
}

const EH_COMENTARIO = /^\s*(\*|\/\/|\/\*)/;

/** Palavras que concordam com o número — as que aparecem colada a um `${…}`. */
const CONCORDAM = [
  'pessoas', 'avaliações', 'respostas', 'perguntas', 'designações', 'colunas',
  'alternativas', 'linhas', 'aplicações', 'resultados', 'critérios', 'faixas',
  'têm', 'são', 'estão', 'ficam', 'foram', 'serão', 'vêm', 'faltam', 'entram',
  'elas', 'eles',
];

function varrer(cb: (texto: string) => string | null): string[] {
  const infratores: string[] = [];
  for (const f of arquivosTs(RAIZ)) {
    const relativo = path.relative(RAIZ, f).replace(/\\/g, '/');
    fs.readFileSync(f, 'utf8').split('\n').forEach((linha, i) => {
      if (EH_COMENTARIO.test(linha)) return;
      for (const texto of trechosEmTexto(linha)) {
        const achado = cb(texto);
        if (achado) infratores.push(`${relativo}:${i + 1} → ${achado}`);
      }
    });
  }
  return infratores;
}

describe('texto do backend não flexiona com número', () => {
  it('encontra os arquivos do módulo (senão o teste passa por não varrer nada)', () => {
    expect(arquivosTs(RAIZ).length).toBeGreaterThan(30);
  });

  it('1 — nenhuma frase usa a forma parentética "(s)" / "(ões)"', () => {
    const infratores = varrer((texto) => {
      const m = /\w+\((?:s|es|as|ões|ãos)\)/.exec(texto);
      return m ? m[0] : null;
    });
    expect(infratores).toEqual([]);
  });

  it('2 — nenhum `${…}` vem colado a uma palavra que concorda com ele', () => {
    const padrao = new RegExp(`\\$\\{[^}]+\\}\\s+(${CONCORDAM.join('|')})\\b`, 'i');
    const infratores = varrer((texto) => {
      const m = padrao.exec(texto);
      return m ? m[0] : null;
    });
    expect(infratores).toEqual([]);
  });
});
