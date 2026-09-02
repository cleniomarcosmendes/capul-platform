// @ts-check
/**
 * Config do ESLint (flat config — exigida pelo ESLint 9). Este módulo estava SEM
 * config nenhuma: `npm run lint` falhava na inicialização, então o backend do
 * Fiscal nunca passou por lint. Criada em 01/09/2026.
 *
 * Deliberadamente MÍNIMA, e diferente da do `gestao-ti/backend`:
 *
 *  - **Sem Prettier.** Formatação não pega defeito, e ligá-la agora reescreveria
 *    em massa arquivos de um módulo em produção — o diff esconderia o que importa.
 *  - **Sem `recommendedTypeChecked` inteiro.** Em código nunca lintado ele produz
 *    centenas de avisos de uma vez, e aviso demais ensina a ignorar aviso.
 *  - **Só usa o que já estava instalado** (`@typescript-eslint/parser` e
 *    `eslint-plugin`): nenhuma dependência nova, nenhum mexer em node_modules.
 *
 * O que ficou vale o custo — todas exigem informação de tipo, então o `tsc`
 * sozinho não as pega:
 *
 *  - `no-floating-promises`: `prisma.x.update()` sem `await` COMPILA, passa no
 *    typecheck e a escrita simplesmente não acontece. Falha silenciosa, a família
 *    de defeito que mais custou caro neste repositório.
 *  - `no-misused-promises`: `async` passado onde se espera função síncrona (guard,
 *    filter, handler) — o retorno vira Promise truthy e a condição sempre passa.
 *  - `await-thenable`: `await` em valor que não é Promise, sinal de refactor pela metade.
 *  - `no-unused-vars`: import/variável que sobrou (prefixo `_` dispensa).
 *
 * ⚠️ O script `lint` do package.json tem `--fix`. Para só INSPECIONAR, rode
 * `npx eslint "src/**\/*.ts"` sem o script.
 */
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'prisma/**', 'eslint.config.mjs'] },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
