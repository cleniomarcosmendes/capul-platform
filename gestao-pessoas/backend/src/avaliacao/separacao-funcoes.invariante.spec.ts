/**
 * ⭐⭐ INVARIANTE ESTRUTURAL — todo acesso a `avaliacao` passa pela porta.
 *
 * A separação de funções vale para abrir, editar, reabrir, recalcular e
 * responder — caminhos diferentes, escritos em momentos diferentes, por pessoas
 * diferentes. Revisão caso a caso falha sempre na rota que ninguém revisou: no
 * RDV da Logística o mesmo furo reapareceu QUATRO vezes antes de virar teste.
 *
 * Este teste varre o FONTE e cobra: arquivo que toca `prisma.avaliacao` tem de
 * usar o `AvaliacaoAcessoService`. Exceção só na lista abaixo, COM MOTIVO —
 * quem dispensar precisa dizer por quê.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const RAIZ = path.join(__dirname, '..');

/** Arquivo -> por que não precisa passar pela porta. */
const DISPENSADOS: Record<string, string> = {
  'avaliacao/avaliacao-acesso.service.ts': 'é a própria porta',
  'common/testing/prisma-mock.ts': 'mock de teste, não acessa banco',
};

function arquivosTs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return arquivosTs(completo);
    return e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') ? [completo] : [];
  });
}

describe('invariante: acesso a avaliação passa pelo AvaliacaoAcessoService', () => {
  const suspeitos = arquivosTs(RAIZ)
    .map((completo) => ({
      relativo: path.relative(RAIZ, completo).split(path.sep).join('/'),
      fonte: fs.readFileSync(completo, 'utf8'),
    }))
    .filter(({ fonte }) => /prisma\.avaliacao\./.test(fonte));

  it('nenhum arquivo toca prisma.avaliacao sem usar a porta', () => {
    const violacoes = suspeitos
      .filter(({ relativo }) => !DISPENSADOS[relativo])
      .filter(({ fonte }) => !/AvaliacaoAcessoService/.test(fonte))
      .map(({ relativo }) => relativo);

    expect(violacoes).toEqual([]);
  });

  it('a lista de dispensados não tem entrada morta', () => {
    // Dispensa que sobrou de um arquivo apagado esconde a próxima violação.
    const existentes = new Set(suspeitos.map((s) => s.relativo));
    const mortas = Object.keys(DISPENSADOS).filter(
      (d) => !existentes.has(d) && !fs.existsSync(path.join(RAIZ, d)),
    );
    expect(mortas).toEqual([]);
  });
});
