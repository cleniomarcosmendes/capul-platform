const { execSync } = require('node:child_process');

/**
 * Identidade do BUNDLE, decidida na hora em que ele é empacotado (build do APK
 * ou `eas update`) e gravada em `extra.build` — o app lê de volta em
 * `src/lib/versao.ts` e mostra na tela "Sobre".
 *
 * POR QUE: `version` (1.0.0) e `versionCode` são fixos por meses; dois APKs
 * diferentes se apresentavam com o MESMO rótulo, e não havia como saber, com o
 * aparelho na mão, se o que está instalado tem a correção que se quer testar.
 *
 * O commit vem, nesta ordem:
 *   1. `EAS_BUILD_GIT_COMMIT_HASH` — build na nuvem (EAS), onde não há .git;
 *   2. `git rev-parse` — build/publicação a partir do checkout local;
 *   3. 'desconhecido' — nunca um palpite. Rótulo errado encerra a investigação
 *      com a resposta trocada, que é pior do que não ter rótulo.
 */
function commitDoBundle() {
  const daNuvem = process.env.EAS_BUILD_GIT_COMMIT_HASH;
  if (daNuvem) return daNuvem.slice(0, 7);
  try {
    const hash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    // Árvore suja = o bundle NÃO é o commit. Dizer isso é o ponto do rótulo.
    const sujo = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim().length > 0;
    return sujo ? `${hash}-sujo` : hash;
  } catch {
    return 'desconhecido';
  }
}

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    build: {
      commit: commitDoBundle(),
      em: new Date().toISOString(),
    },
  },
});
