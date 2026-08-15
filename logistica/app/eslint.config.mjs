import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';

/**
 * ESLint do app Expo — instalado em 14/08/2026, depois de uma regressão minha
 * que quebrou a tela da rota com "Rendered more hooks than during the previous
 * render": dois `useCallback` ficaram DEPOIS de um `return` condicional. Como
 * função comum aquilo era válido; como hook, não. `tsc --noEmit`, a única
 * validação que rodava aqui, não pega isso — é sintaticamente correto.
 * `react-hooks/rules-of-hooks` pega, e é a razão de existir deste arquivo.
 *
 * Mesma calibragem do `logistica/frontend` (ver o comentário de lá): regras
 * CLÁSSICAS de hooks, sem as da era React Compiler — o projeto não o adotou e
 * aqueles padrões são usados de propósito em todos os módulos.
 *
 * `.mjs` porque o package.json do app não é ESM (`type` ausente).
 */
export default defineConfig([
  globalIgnores(['node_modules', 'dist', 'android', '.expo', 'babel.config.js', 'jest.config.js']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // ⭐ O motivo do arquivo existir.
      'react-hooks/rules-of-hooks': 'error',
      // Severidade padrão do próprio React: avisa sem barrar.
      'react-hooks/exhaustive-deps': 'warn',
      // Quem checa identificador não declarado é o TypeScript; aqui só geraria
      // falso positivo com os globais do React Native (__DEV__, fetch, jest…).
      'no-undef': 'off',
      // Honra o prefixo `_` e o rest-omit `const { x, ...resto } = obj`.
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  },
]);
