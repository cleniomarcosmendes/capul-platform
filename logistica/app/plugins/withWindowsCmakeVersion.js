const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Windows — limite de 260 caracteres (MAX_PATH).
 *
 * A compilação C++ da New Architecture (codegen Fabric de react-native-screens,
 * react-native-safe-area-context etc.) estoura o MAX_PATH do Windows porque o
 * nome do objeto (.o) embute o caminho-fonte absoluto. Com o ninja 1.10.2 que a
 * AGP usa por padrão (bundled no CMake 3.22.1) o build falha com
 * `ninja: Filename longer than 260 characters`.
 *
 * O ninja 1.12.1 (bundled no CMake 4.1.2) resolve isso sozinho — prefixa `\\?\`
 * internamente e ignora o limite, sem precisar de `LongPathsEnabled` no registro.
 * A AGP não expõe variável de ambiente para trocar a versão de CMake do módulo
 * `app` (`CMAKE_VERSION` só vale ao compilar o ReactAndroid do fonte), então o
 * único knob oficial é `externalNativeBuild.cmake.version` no build.gradle — que
 * este plugin injeta.
 *
 * Aplicado SÓ no Windows: em Linux/macOS (inclusive nos builds do EAS) não há
 * MAX_PATH, o CMake padrão funciona, e o 4.1.2 pode nem estar instalado — por
 * isso o guard por `process.platform`.
 *
 * Requer o CMake 4.1.2 instalado (Android Studio → SDK Manager → SDK Tools →
 * CMake). Se ausente, a AGP o instala via sdkmanager no primeiro build.
 */
const CMAKE_VERSION = '4.1.2';

function withWindowsCmakeVersion(config) {
  if (process.platform !== 'win32') {
    return config;
  }

  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error(
        'withWindowsCmakeVersion: esperado build.gradle em Groovy (Kotlin DSL não suportado).'
      );
    }

    const contents = config.modResults.contents;

    // Idempotente: não injeta de novo se já houver a versão pinada.
    if (contents.includes(`version "${CMAKE_VERSION}"`)) {
      return config;
    }

    const block =
      '    externalNativeBuild {\n' +
      '        cmake {\n' +
      `            version "${CMAKE_VERSION}"\n` +
      '        }\n' +
      '    }\n';

    // Insere logo após a abertura do bloco `android {` do módulo app.
    const androidBlock = /\nandroid\s*\{\n/;
    if (!androidBlock.test(contents)) {
      throw new Error('withWindowsCmakeVersion: bloco `android {` não encontrado no build.gradle.');
    }

    config.modResults.contents = contents.replace(androidBlock, `\nandroid {\n${block}`);
    return config;
  });
}

module.exports = withWindowsCmakeVersion;
