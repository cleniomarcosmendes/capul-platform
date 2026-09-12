/**
 * ⭐⭐ INVARIANTE — toda `acao` de auditoria CABE na coluna.
 *
 * ── POR QUE ISTO EXISTE ─────────────────────────────────────────────────────
 *
 * `AuditoriaService.registrar` **engole o erro de propósito** — e a decisão é
 * certa: recusar uma leitura legítima porque o insert da trilha falhou trocaria
 * um problema de observabilidade por um de disponibilidade.
 *
 * ⚠️ O preço é que **estourar o tamanho da coluna some sem sintoma**. Em 13/09,
 * `ACESSO_NEGADO_PROPRIO_AVALIADO:devolutiva` (41) não coube em `VarChar(40)`:
 * o 403 saiu normal, o spec de unidade passou — porque mocka a auditoria e
 * confere que ela foi **chamada**, não que a linha **pousou** — e o registro que
 * a §8 da especificação EXIGE simplesmente não existiu. Quem achou foi olhar a
 * TABELA depois do exercício.
 *
 * ⭐ Alargar a coluna sozinho só move o abismo: a ação é **composta por
 * convenção** (`PREFIXO:${verbo}`), então ela cresce quando alguém escreve um
 * verbo novo — em outro arquivo, sem passar por aqui. Este teste é a conta que
 * a alargada não substitui.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const RAIZ = path.join(__dirname, '..');
const MIGRATIONS = path.join(__dirname, '..', '..', 'prisma', 'migrations');

function arquivosTs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return arquivosTs(p);
    return e.isFile() && p.endsWith('.ts') && !p.endsWith('.spec.ts') ? [p] : [];
  });
}

/**
 * ⭐ O limite sai do ARQUIVO DA MIGRATION, não de um número repetido aqui —
 * mesma disciplina da `regua-em-sql.invariante`. Um número copiado envelhece
 * sozinho, e o teste passaria a medir contra um teto que o banco não tem mais.
 */
function limiteDaColuna(): number {
  const arquivos = fs
    .readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(MIGRATIONS, e.name, 'migration.sql'))
    .filter((f) => fs.existsSync(f))
    .sort();

  let limite: number | null = null;
  for (const f of arquivos) {
    const sql = fs.readFileSync(f, 'utf8');
    // A criação original: `"acao" VARCHAR(40) NOT NULL`
    for (const m of sql.matchAll(/"acao"\s+VARCHAR\((\d+)\)/gi)) limite = Number(m[1]);
    // E qualquer ALTER posterior — a ÚLTIMA no tempo é a que vale.
    for (const m of sql.matchAll(/ALTER\s+COLUMN\s+"acao"\s+TYPE\s+VARCHAR\((\d+)\)/gi)) {
      limite = Number(m[1]);
    }
  }
  if (limite === null) throw new Error('Não achei o tamanho de rh.auditoria.acao nas migrations.');
  return limite;
}

const fontes = arquivosTs(RAIZ).map((f) => ({
  relativo: path.relative(RAIZ, f).split(path.sep).join('/'),
  conteudo: fs.readFileSync(f, 'utf8'),
}));

/** `acao: 'X'` — o valor inteiro é conhecido. */
function acoesLiterais(): { onde: string; valor: string }[] {
  const achados: { onde: string; valor: string }[] = [];
  for (const f of fontes) {
    for (const m of f.conteudo.matchAll(/acao:\s*'([^']+)'/g)) {
      achados.push({ onde: f.relativo, valor: m[1] });
    }
  }
  return achados;
}

/**
 * ``acao: `PREFIXO:${verbo}` `` — o prefixo é conhecido, o verbo não.
 * ⚠️ O que se mede aqui é o PREFIXO + a maior palavra que o código passa como
 * verbo. Não é exato por construção; é o teto conhecido.
 */
function prefixosDinamicos(): { onde: string; prefixo: string }[] {
  const achados: { onde: string; prefixo: string }[] = [];
  for (const f of fontes) {
    for (const m of f.conteudo.matchAll(/acao:\s*`([^`$]*)\$\{/g)) {
      achados.push({ onde: f.relativo, prefixo: m[1] });
    }
  }
  return achados;
}

/** Os verbos que o módulo passa para `carregarParaAcao(..., 'x')`. */
function verbos(): string[] {
  const vs = new Set<string>();
  for (const f of fontes) {
    for (const m of f.conteudo.matchAll(/carregarParaAcao\([^)]*'([a-zA-Z_]+)'\s*\)/g)) vs.add(m[1]);
  }
  return [...vs];
}

describe('invariante: a ação da auditoria cabe na coluna', () => {
  const LIMITE = limiteDaColuna();

  it('⚠️ a varredura leu o módulo e ainda reconhece as duas formas', () => {
    expect(fontes.length).toBeGreaterThan(30);
    // (a) o limite veio do arquivo, e é um número plausível
    expect(LIMITE).toBeGreaterThanOrEqual(40);
    // (b) ainda reconhece literal e template, em texto sintético
    expect(/acao:\s*'([^']+)'/.exec("acao: 'ABRIR',")?.[1]).toBe('ABRIR');
    expect(/acao:\s*`([^`$]*)\$\{/.exec('acao: `PREFIXO:${x}`,')?.[1]).toBe('PREFIXO:');
    // (c) e achou gente de verdade — zero seria verde por não ter lido nada
    expect(acoesLiterais().length).toBeGreaterThan(10);
    expect(prefixosDinamicos().length).toBeGreaterThan(0);
    expect(verbos().length).toBeGreaterThan(2);
  });

  it('⭐ nenhuma ação LITERAL estoura', () => {
    const estouram = acoesLiterais()
      .filter((a) => a.valor.length > LIMITE)
      .map((a) => `${a.onde} → "${a.valor}" tem ${a.valor.length}, o limite é ${LIMITE}`);
    expect(estouram).toEqual([]);
  });

  it('⭐⭐ nenhum PREFIXO + o maior verbo estoura — a forma que quebrou em 13/09', () => {
    const maiorVerbo = verbos().sort((a, b) => b.length - a.length)[0] ?? '';
    const estouram = prefixosDinamicos()
      .map((p) => ({ ...p, total: p.prefixo.length + maiorVerbo.length }))
      .filter((p) => p.total > LIMITE)
      .map((p) => `${p.onde} → "${p.prefixo}\${${maiorVerbo}}" daria ${p.total}, o limite é ${LIMITE}`);
    expect(estouram).toEqual([]);
  });

  it('⚠️ e sobra folga para o próximo verbo — o teto não pode ser "cabe hoje"', () => {
    /**
     * Em `VarChar(40)`, `contestar` e `responder` davam **exatamente 40**. Cabia,
     * e o próximo verbo com uma letra a mais apagaria a trilha sem sintoma.
     * "Cabe hoje" não é margem: esta checagem exige espaço para crescer.
     */
    const maiorPrefixo = prefixosDinamicos()
      .map((p) => p.prefixo.length)
      .sort((a, b) => b - a)[0];
    const maiorVerbo = verbos().sort((a, b) => b.length - a.length)[0].length;
    const folga = LIMITE - (maiorPrefixo + maiorVerbo);
    expect(folga).toBeGreaterThanOrEqual(20);
  });
});
