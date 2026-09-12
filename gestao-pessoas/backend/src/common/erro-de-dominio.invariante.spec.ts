/**
 * ⭐⭐ INVARIANTE — erro de domínio estende `ErroDeDominio`, e por isso chega à tela.
 *
 * ── O DEFEITO ───────────────────────────────────────────────────────────────
 * `ModeloNaoPublicavelError` carrega `problemas: string[]` — a lista do que
 * falta para publicar, o produto inteiro do validador. Estendendo `Error` puro,
 * caía no ramo do 500 genérico e **a lista sumia**: a tela recebia
 * *"Erro interno do servidor"*.
 *
 * ⚠️ A spec do validador era **verde**: ela exercita a FUNÇÃO. O que estava
 * quebrado era a ponte entre a função e a resposta HTTP, e nenhum teste de
 * unidade olha para lá. E `CicloNaoAbrivelError` já fazia certo três arquivos
 * adiante, e não foi copiado — §3.1.88, *o grep acha onde a regra foi escrita,
 * não onde ela deveria estar*.
 *
 * ── O QUE ESTE TESTE COBRA ──────────────────────────────────────────────────
 * Que **nenhuma** classe `…Error` do módulo estenda `Error` diretamente. A
 * herança é o que faz o filtro global reconhecê-la; sem ela o erro é mudo, e o
 * sintoma aparece só em produção, na hora em que alguém precisava da mensagem.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const RAIZ = path.join(__dirname, '..');

/** ⚠️ A própria base estende `Error` — é o único caso legítimo. */
const A_BASE = 'common/erro-de-dominio.ts';

function arquivosTs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return arquivosTs(p);
    return e.isFile() && p.endsWith('.ts') && !p.endsWith('.spec.ts') ? [p] : [];
  });
}

/**
 * ⚠️ Casa QUALQUER `class X extends Y` e filtra depois, em vez de exigir o
 * sufixo `Error` no padrão: a própria base se chama `ErroDeDominio` e o nome em
 * português é o normal do módulo. Padrão que só reconhece um jeito de nomear
 * deixa passar exatamente a classe escrita do outro jeito.
 */
const CLASSE = /export\s+(?:abstract\s+)?class\s+(\w+)\s+extends\s+(\w+)/g;
const EH_ERRO = (nome: string, base: string) =>
  /Error$/.test(nome) || /^Erro/.test(nome) || base === 'Error' || base === 'ErroDeDominio';

interface Achado {
  arquivo: string;
  classe: string;
  base: string;
  /** Tem campo próprio além da mensagem? Então tem payload a perder. */
  comPayload: boolean;
}

function erros(): Achado[] {
  const achados: Achado[] = [];
  for (const f of arquivosTs(RAIZ)) {
    const relativo = path.relative(RAIZ, f).replace(/\\/g, '/');
    const fonte = fs.readFileSync(f, 'utf8');
    for (const m of fonte.matchAll(CLASSE)) {
      if (!EH_ERRO(m[1], m[2])) continue;
      const corpo = fonte.slice(m.index ?? 0, (m.index ?? 0) + 900);
      achados.push({
        arquivo: relativo,
        classe: m[1],
        base: m[2],
        comPayload: /readonly\s+\w+/.test(corpo),
      });
    }
  }
  return achados;
}

describe('⭐⭐ invariante — todo erro de domínio chega à tela', () => {
  const achados = erros();

  /**
   * ⭐⭐ CANÁRIO, NOS DOIS NÍVEIS. Requisito de todo teste que varre fonte
   * (§3.1.97), e o segundo nível é o que importa: sem ele, o dia em que a
   * grafia mudar (`export class X extends`… com quebra de linha, por exemplo)
   * a lista vem vazia e o teste fica **verde por não ter lido nada**.
   */
  it('⚠️ canário — a varredura leu o módulo E ainda reconhece a forma', () => {
    // (a) leu arquivos
    expect(arquivosTs(RAIZ).length).toBeGreaterThan(30);
    // (b) ainda reconhece a forma, num texto sintético — as duas variantes
    const certo = 'export class FooError extends ErroDeDominio {';
    const errado = 'export class BarError extends Error {';
    const base = 'export abstract class ErroDeDominio extends Error {';
    expect([...certo.matchAll(CLASSE)].map((m) => m[2])).toEqual(['ErroDeDominio']);
    expect([...errado.matchAll(CLASSE)].map((m) => m[2])).toEqual(['Error']);
    // ...inclusive a base, cujo nome não termina em `Error`.
    expect([...base.matchAll(CLASSE)].map((m) => m[1])).toEqual(['ErroDeDominio']);
    // ...e a classe que não é erro nenhum fica de fora.
    expect(EH_ERRO('AcervoService', 'BaseService')).toBe(false);
    // (c) e encontrou erros de verdade
    expect(achados.length).toBeGreaterThan(4);
  });

  it('nenhum erro do módulo estende `Error` direto — só a própria base', () => {
    const soltos = achados
      .filter((a) => a.base === 'Error' && a.arquivo !== A_BASE)
      .map((a) => `${a.arquivo} → ${a.classe}`);
    expect(soltos).toEqual([]);
  });

  /**
   * ⚠️ A base tem de continuar sendo a base. Se alguém a fizer estender outra
   * coisa (uma `HttpException`, por exemplo), o filtro deixa de reconhecê-la e
   * os oito voltam a ser mudos de uma vez só.
   */
  it('a base existe e estende Error', () => {
    const base = achados.find((a) => a.arquivo === A_BASE);
    expect(base).toMatchObject({ classe: 'ErroDeDominio', base: 'Error' });
  });

  /** Todo erro com payload declara o que devolver — senão o payload não sai. */
  it('erro com payload próprio sobrescreve `corpo()`', () => {
    const sem: string[] = [];
    for (const a of achados) {
      if (a.arquivo === A_BASE || !a.comPayload) continue;
      const fonte = fs.readFileSync(path.join(RAIZ, a.arquivo), 'utf8');
      if (!/override corpo\(\)/.test(fonte)) sem.push(`${a.arquivo} → ${a.classe}`);
    }
    expect(sem).toEqual([]);
  });

  /**
   * ⚠️ E o filtro global tem de continuar traduzindo. Sem esta linha o teste
   * acima garante a herança de uma ponte que ninguém atravessa.
   */
  it('o filtro global reconhece `ErroDeDominio` antes do ramo do 500', () => {
    const filtro = fs.readFileSync(
      path.join(RAIZ, 'common/filters/all-exceptions.filter.ts'),
      'utf8',
    );
    expect(filtro).toMatch(/instanceof ErroDeDominio/);
    // ...e ANTES do HttpException, senão a ordem do `if` decide errado.
    expect(filtro.indexOf('instanceof ErroDeDominio')).toBeLessThan(
      filtro.indexOf('instanceof HttpException'),
    );
  });
});
