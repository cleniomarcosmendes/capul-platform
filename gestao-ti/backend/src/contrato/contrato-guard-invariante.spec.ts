import * as fs from 'fs';
import * as path from 'path';

/**
 * ⭐⭐ INVARIANTE — toda escrita em contrato/NF passa por checagem de permissão.
 *
 * Mesma lição do RDV e do chamado: guard que precisa estar em N métodos não se garante
 * por revisão. A auditoria de 25/08 (§3) achou a brecha nos FILHOS do contrato (rateio,
 * parcela, anexo, vínculo de licença) porque `create`/`update` estavam protegidos e
 * ninguém tinha olhado o resto. Este teste varre o fonte e cobra.
 */
describe('Contrato/NF — INVARIANTE: escrita passa por checagem de permissão', () => {
  const GUARDS = [
    'ensureContratoPermission',
    'ensureNFPermission',
    'assertDepartamentoDoUser',
  ];
  const ESCRITA =
    /this\.prisma\.\w+\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/;

  // Dispensados, com o motivo. Mexer aqui é decisão de negócio, não limpeza.
  const DISPENSADOS: Record<string, string> = {
    ensureContratoPermission: 'é o próprio guard',
    ensureNFPermission: 'é o próprio guard',
    criarHistorico: 'helper de trilha — quem chama já checou',
    registrarHistorico: 'helper de trilha — quem chama já checou',
    computeRateio: 'cálculo puro',
    gerarParcelasAuto:
      'helper interno de create/update/renovar — os três já checam',
  };

  const ARQUIVOS = [
    'contrato/services/contrato-core.service.ts',
    'contrato/services/contrato-parcela.service.ts',
    'contrato/services/contrato-rateio.service.ts',
    'contrato/services/contrato-anexo.service.ts',
    'compra/services/compra-nota-fiscal.service.ts',
  ];

  it('nenhum método que escreve fica sem guard', () => {
    const raiz = path.join(__dirname, '..');
    const semGuard: string[] = [];

    for (const arquivo of ARQUIVOS) {
      const src = fs.readFileSync(path.join(raiz, arquivo), 'utf8').split('\n');
      const inicios: { linha: number; nome: string }[] = [];
      src.forEach((l, i) => {
        const m =
          /^ {2}(?:async |private async |private )?([a-zA-Z][a-zA-Z0-9_]*)\(/.exec(
            l,
          );
        if (m) inicios.push({ linha: i, nome: m[1] });
      });
      inicios.push({ linha: src.length, nome: '__fim__' });

      const corpos = new Map<string, string>();
      for (let i = 0; i < inicios.length - 1; i++) {
        corpos.set(
          inicios[i].nome,
          src.slice(inicios[i].linha, inicios[i + 1].linha).join('\n'),
        );
      }

      for (const [nome, corpo] of corpos) {
        if (nome in DISPENSADOS) continue;
        if (!ESCRITA.test(corpo)) continue;
        const direto = GUARDS.some((g) => corpo.includes(g));
        // Guard uma chamada abaixo também vale (ex.: `reprocessar` → `configurar`).
        const viaChamada = [...corpos.entries()].some(
          ([outro, corpoOutro]) =>
            outro !== nome &&
            new RegExp(`this\\.${outro}\\(`).test(corpo) &&
            GUARDS.some((g) => corpoOutro.includes(g)),
        );
        if (!direto && !viaChamada)
          semGuard.push(`${path.basename(arquivo)}#${nome}`);
      }
    }

    expect(semGuard.sort()).toEqual([]);
  });
});
