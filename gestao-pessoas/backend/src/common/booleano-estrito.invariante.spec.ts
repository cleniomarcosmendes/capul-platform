/**
 * ⭐⭐ INVARIANTE — nenhum DTO usa `@IsBoolean()` cru.
 *
 * Com `enableImplicitConversion: true`, `@IsBoolean()` sozinho aceita a string
 * `"false"` e a entrega como `true`: a conversão roda ANTES da validação, e o
 * validador só vê o booleano já fabricado. Ver `booleano-estrito.ts`.
 *
 * ⚠️ Esta é a forma que a TELA nunca exercita — nosso frontend manda booleano
 * de verdade. Quem descobriria é quem chama a API direto, e o campo mais caro é
 * `confirmarPendentes`, que autoriza CANCELAR as avaliações não enviadas.
 * Revisão caso a caso não serve: o furo aparece no DTO que ninguém revisou.
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
 * O único lugar onde `IsBoolean` pode aparecer: dentro do próprio decorator,
 * que é quem o compõe.
 */
const DONO = 'common/booleano-estrito.ts';

describe('invariante: booleano de DTO é estrito', () => {
  const fontes = arquivosTs(RAIZ).map((f) => ({
    relativo: path.relative(RAIZ, f).split(path.sep).join('/'),
    conteudo: fs.readFileSync(f, 'utf8'),
  }));

  it('⚠️ a varredura leu o módulo e ainda reconhece a forma que procura', () => {
    // (a) leu arquivos
    expect(fontes.length).toBeGreaterThan(30);
    // (b) ainda reconhece a forma, num texto sintético
    expect(/@IsBoolean\s*\(/.test('  @IsOptional() @IsBoolean() ativo?: boolean;')).toBe(true);
    expect(/@IsBoolean\s*\(/.test('  @IsOptional() @BooleanoEstrito() ativo?: boolean;')).toBe(false);
    // (c) e o decorator estrito está de fato EM USO — zero usos significaria que
    //     alguém o removeu e este teste passou por não haver o que conferir.
    const comEstrito = fontes.filter((f) => /@BooleanoEstrito\s*\(/.test(f.conteudo));
    expect(comEstrito.length).toBeGreaterThanOrEqual(4);
  });

  it('⭐ nenhum DTO decora com @IsBoolean() cru', () => {
    const infratores = fontes
      .filter((f) => f.relativo !== DONO)
      .flatMap((f) =>
        f.conteudo
          .split('\n')
          .map((linha, i) => ({ linha: linha.trim(), n: i + 1 }))
          // Comentário citando o decorator é documentação, não uso.
          .filter(({ linha }) => !/^(\*|\/\/|\/\*)/.test(linha))
          .filter(({ linha }) => /@IsBoolean\s*\(/.test(linha))
          .map(({ linha, n }) => `${f.relativo}:${n} → ${linha}`),
      );
    expect(infratores).toEqual([]);
  });

  it('⭐ as três flags de CONFIRMAÇÃO estão entre as protegidas', () => {
    /**
     * Nomeadas, não contadas: são as que autorizam um ato que a API tinha
     * recusado. `confirmarPendentes` cancela avaliação de gente.
     */
    for (const flag of ['confirmarPendentes', 'confirmarSemFaixas', 'confirmarTrocaDeAvaliador']) {
      const declaracao = fontes
        .flatMap((f) => f.conteudo.split('\n'))
        .find((l) => l.includes(`${flag}?:`) || l.includes(`${flag}!:`));
      // Jest não aceita mensagem no expect — o nome da flag entra na asserção.
      expect(`${flag}: ${declaracao ?? 'NÃO ENCONTRADA EM DTO NENHUM'}`).toContain('@BooleanoEstrito(');
    }
  });
});
