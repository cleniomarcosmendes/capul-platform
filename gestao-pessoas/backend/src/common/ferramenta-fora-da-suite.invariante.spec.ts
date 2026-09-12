/**
 * ⭐⭐ INVARIANTE — ferramenta de medição que ninguém roda quebra em SILÊNCIO.
 *
 * ── O CASO ──────────────────────────────────────────────────────────────────
 *
 * Em 12/09 o `nota-avaliacao.ts` passou a importar `../common/erro-de-dominio.js`
 * (a base dos erros de domínio). A suíte inteira ficou verde. O
 * `scripts/regressao-protheus.ts` — **o baseline contra o Protheus, o número que
 * decide se o cálculo do módulo está certo** — parou de rodar, porque o
 * `ts-node` em CJS não resolve o sufixo `.js` para o `.ts`.
 *
 * Descobri **na hora em que precisei dele**, que é sempre quando se descobre.
 *
 * ⚠️ E `tsc --noEmit` NÃO teria pego: o compilador resolve `.js` → `.ts` sem
 * reclamar. O que pega é **executar**. Verificação que não percorre o mesmo
 * caminho do uso não verifica o uso.
 *
 * ── O QUE ESTE TESTE COBRA, E O QUE NÃO COBRA ───────────────────────────────
 *
 * Cobra que **todo executável fora da suíte tenha guarda `require.main`** — sem
 * ela, um teste não consegue nem CARREGAR o arquivo para ver se os imports
 * resolvem, porque importar já executa (e `seed.ts` grava no banco).
 *
 * A guarda é o que torna a ferramenta *verificável*. Com ela, o segundo teste
 * abaixo carrega cada uma e falha se algum import quebrou — que é exatamente o
 * defeito que passou.
 *
 * ⚠️ NÃO cobra que o script faça a coisa certa. Cobra que ele ainda CARREGA.
 * É o `GUARDA: ok` do job de migration: a linha que separa "rodou" de "existe".
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const RAIZ = path.join(__dirname, '..', '..');

/**
 * As ferramentas que rodam à mão. ⚠️ Lista explícita de propósito: varrer por
 * "arquivo .ts fora de src/" pegaria configuração e tipos, e a exceção viraria
 * a regra.
 */
const FERRAMENTAS = [
  { arquivo: 'prisma/seed.ts', oQueMede: 'o instrumento herdado — os 4 perfis e as 15 questões' },
  { arquivo: 'prisma/popular-dev-ciclo-piloto.ts', oQueMede: 'o ciclo de piloto do DEV' },
  { arquivo: 'prisma/popular-dev-designacao.ts', oQueMede: 'as designações do DEV' },
  { arquivo: 'prisma/popular-dev-fila-do-avaliador.ts', oQueMede: 'a fila do avaliador no DEV' },
];

describe('⭐⭐ invariante — ferramenta fora da suíte não pode quebrar calada', () => {
  it('⚠️ canário — os arquivos existem e a lista não está vazia', () => {
    expect(FERRAMENTAS.length).toBeGreaterThan(3);
    const sumidos = FERRAMENTAS.filter((f) => !fs.existsSync(path.join(RAIZ, f.arquivo)));
    expect(sumidos.map((f) => f.arquivo)).toEqual([]);
  });

  /**
   * ⚠️ Sem `require.main === module`, importar o arquivo EXECUTA — e `seed.ts`
   * grava no banco. A guarda é o que permite carregar sem rodar, e é a
   * condição para qualquer verificação automática existir.
   */
  it('toda ferramenta tem guarda `require.main === module`', () => {
    const sem = FERRAMENTAS.filter((f) => {
      const fonte = fs.readFileSync(path.join(RAIZ, f.arquivo), 'utf8');
      return !/require\.main === module/.test(fonte);
    }).map((f) => `${f.arquivo} — mede ${f.oQueMede}`);
    expect(sem).toEqual([]);
  });

  /**
   * ⭐ O TESTE QUE TERIA PEGO. Carrega cada ferramenta: se um import quebrou,
   * o `require` explode aqui, na suíte, e não daqui a três semanas na hora de
   * medir. Com a guarda acima, carregar não executa nada.
   */
  it('toda ferramenta CARREGA — os imports dela ainda resolvem', () => {
    const quebradas: string[] = [];
    for (const f of FERRAMENTAS) {
      try {
        require(path.join(RAIZ, f.arquivo));
      } catch (e) {
        quebradas.push(`${f.arquivo}: ${(e as Error).message.split('\n')[0]}`);
      }
    }
    expect(quebradas).toEqual([]);
  });
});

/**
 * ⭐⭐ A REGRESSÃO CONTRA O PROTHEUS, DENTRO DA SUÍTE.
 *
 * ⚠️ Ela NÃO entra na lista acima, e a razão é a divisão certa: ela é
 * **somente leitura** e tem a amostra **commitada** (`_regressao-amostra.csv`),
 * então dá para rodar de verdade. As outras quatro gravam no banco — para
 * essas, o máximo verificável é "ainda carrega".
 *
 * ⭐ **Rodar é o único jeito de pegar o defeito de 12/09.** `tsc --noEmit`
 * resolve `.js` → `.ts` sem reclamar; quem não resolve é o `ts-node` em CJS, em
 * tempo de execução. Verificação que não percorre o mesmo caminho do uso não
 * verifica o uso.
 */
describe('⭐⭐ regressão contra o Protheus — 108/108, na suíte', () => {
  const { execFileSync } = require('node:child_process') as typeof import('node:child_process');

  it('roda de ponta a ponta e a nota do questionário continua batendo', () => {
    const saida = execFileSync(
      'npx',
      [
        'ts-node',
        '--project', 'tsconfig.seed.json',
        'scripts/regressao-protheus.ts',
        'scripts/_regressao-amostra.csv',
      ],
      { cwd: RAIZ, encoding: 'utf8', timeout: 120_000 },
    );
    expect(saida).toMatch(/AMOSTRA: 108 pessoas/);
    // ⚠️ O número que importa: se este cair, o cálculo do módulo mudou.
    expect(saida).toMatch(/idênticas: 108\/108 \| divergentes: 0/);
  }, 150_000);
});
