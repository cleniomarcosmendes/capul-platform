const { withProjectBuildGradle } = require('expo/config-plugins');

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
 * nativos (app + autolinkados), então injetamos um `subprojects {}` no
 * build.gradle raiz em vez de mexer só no módulo app.
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

  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error(
        'withWindowsCmakeVersion: esperado build.gradle raiz em Groovy (Kotlin DSL não suportado).'
      );
    }

    // Idempotente: não injeta de novo.
    if (config.modResults.contents.includes(MARKER)) {
      return config;
    }

    const block = [
      '',
      MARKER,
      '// Rerroteia TODOS os módulos nativos (app + autolinkados) para o CMake ' +
        CMAKE_VERSION + ' (ninja',
      '// 1.12.1, longPathAware), evitando o estouro de MAX_PATH (260) na compilação C++ da',
      '// New Architecture no Windows. Ver plugins/withWindowsCmakeVersion.js.',
      'subprojects { subproject ->',
      '  afterEvaluate {',
      '    if (subproject.plugins.hasPlugin("com.android.library") || subproject.plugins.hasPlugin("com.android.application")) {',
      '      subproject.android {',
      '        externalNativeBuild {',
      '          cmake {',
      '            version "' + CMAKE_VERSION + '"',
      '          }',
      '        }',
      '      }',
      '    }',
      '  }',
      '}',
      '',
    ].join('\n');

    config.modResults.contents = config.modResults.contents + '\n' + block;
    return config;
  });
}

module.exports = withWindowsCmakeVersion;
