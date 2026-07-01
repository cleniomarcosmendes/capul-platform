const { withSettingsGradle } = require('expo/config-plugins');

/**
 * Windows — limite de 260 caracteres (MAX_PATH).
 *
 * A compilação C++ da New Architecture estoura o MAX_PATH do Windows porque o
 * nome do objeto (.o) embute o caminho-fonte absoluto. Com o ninja 1.10.2 que a
 * AGP usa por padrão (bundled no CMake 3.22.1) o build falha — no módulo `app`
 * com `ninja: Filename longer than 260 characters`, e nos módulos autolinkados
 * (react-native-screens etc.) com `ninja: manifest 'build.ninja' still dirty
 * after 100 tries` (mesma raiz, sintoma diferente).
 *
 * O ninja 1.12.1 (bundled no CMake 4.1.2) resolve — prefixa `\\?\` internamente
 * e ignora o 260, sem precisar de `LongPathsEnabled` no registro. Como a AGP não
 * expõe variável de ambiente para a versão de CMake (`CMAKE_VERSION` só vale ao
 * compilar o ReactAndroid do fonte), o único knob é
 * `externalNativeBuild.cmake.version`. Precisa valer para TODOS os módulos
 * nativos (app + autolinkados).
 *
 * IMPORTANTE — por que no `settings.gradle` e não no `build.gradle` raiz:
 * a abordagem anterior injetava `subprojects { afterEvaluate { ... } }` no
 * `build.gradle` raiz. Isso quebra quando o build roda com `--configure-on-demand`
 * (flag que o `expo run:android` injeta) combinado com `org.gradle.parallel=true`:
 * a ordem de avaliação dos projetos é reordenada e, quando o bloco `subprojects {}`
 * do raiz executa, o `:app` já pode ter sido avaliado — aí o `afterEvaluate` nele
 * estoura com `Cannot run Project.afterEvaluate(Closure) when the project is
 * already evaluated`. O `settings.gradle` roda por INTEIRO antes de qualquer
 * projeto ser avaliado, então registrar `gradle.beforeProject` ali é imune à
 * reordenação. Usamos `plugins.withId` (reage no momento em que o plugin Android
 * é aplicado) para dispensar `afterEvaluate` de vez.
 *
 * Aplicado SÓ no Windows: em Linux/macOS (inclusive nos builds do EAS) não há
 * MAX_PATH, o CMake padrão funciona, e o 4.1.2 pode nem estar instalado.
 *
 * Requer o CMake 4.1.2 instalado (Android Studio → SDK Manager → SDK Tools →
 * CMake). Se ausente, a AGP o instala via sdkmanager no primeiro build.
 */
const CMAKE_VERSION = '4.1.2';
const MARKER = '// withWindowsCmakeVersion: CMake pinning (Windows MAX_PATH)';

function withWindowsCmakeVersion(config) {
  if (process.platform !== 'win32') {
    return config;
  }

  return withSettingsGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error(
        'withWindowsCmakeVersion: esperado settings.gradle em Groovy (Kotlin DSL não suportado).'
      );
    }

    // Idempotente: não injeta de novo.
    if (config.modResults.contents.includes(MARKER)) {
      return config;
    }

    const block = [
      '',
      MARKER,
      '// Fixa o CMake ' + CMAKE_VERSION + ' (ninja 1.12.1, longPathAware) em TODOS os módulos',
      '// nativos (app + autolinkados), evitando o estouro de MAX_PATH (260) na compilação C++',
      '// da New Architecture no Windows. Registrado no settings.gradle (roda antes de qualquer',
      '// projeto ser avaliado) para ser imune a --configure-on-demand + parallel. Ver',
      '// plugins/withWindowsCmakeVersion.js.',
      'gradle.beforeProject { project ->',
      '  def pinCmake = {',
      '    project.android.externalNativeBuild.cmake.version = "' + CMAKE_VERSION + '"',
      '  }',
      '  project.plugins.withId("com.android.application", pinCmake)',
      '  project.plugins.withId("com.android.library", pinCmake)',
      '}',
      '',
    ].join('\n');

    config.modResults.contents = config.modResults.contents + '\n' + block;
    return config;
  });
}

module.exports = withWindowsCmakeVersion;
