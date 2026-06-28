import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Config calibrada para o toolchain real do projeto (sem React Compiler).
// Usamos as regras CLÁSSICAS de hooks que a plataforma de fato segue:
//   - react-hooks/rules-of-hooks  (erro)  → segurança real dos hooks
//   - react-hooks/exhaustive-deps (warn)  → severidade padrão do próprio React
// As regras novas da era React Compiler (static-components, set-state-in-effect,
// immutability, purity, preserve-manual-memoization, refs) NÃO são habilitadas:
// o projeto não adotou o React Compiler e esses padrões são usados de propósito
// em todos os módulos. Recomendação: alinhar os demais frontends a esta config.
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Honra o prefixo `_` e o rest-omit `const { x, ...resto } = obj` (idioma
      // usado para descartar um campo sem listá-lo manualmente).
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  },
])
