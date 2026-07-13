const { withAppBuildGradle, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Dois ambientes side-by-side (produção/homologação) para o app entregador.
 *
 * `android/` é gitignored (workflow managed): tudo é injetado no prebuild, nunca
 * editado à mão. O runtimeVersion é FIXO ("1.0.0" no app.json, não mais policy
 * "fingerprint"): os dois flavors/canais compartilham o mesmo runtime, então a
 * promoção do bundle (HLG → produção) é válida e o OTA independe de qual máquina
 * publica. Ver docs/OTA_DOIS_AMBIENTES.md p/ o histórico e a REGRA DO BUMP: mexeu em
 * nativo (lib/permissão/plugin/SDK) → bumpar runtimeVersion + versionCode e rebuildar
 * o APK, senão um OTA que exige o nativo novo crasha num APK que não o tem.
 *
 * O que este plugin faz:
 *  1. build.gradle: 2 product flavors (`producao` / `homologacao`) na dimensão "env".
 *     Homolog usa applicationIdSuffix ".hlg" → convive com produção no mesmo aparelho.
 *     Cada flavor grava o canal de update num manifestPlaceholder (updatesChannel).
 *  2. AndroidManifest: a meta-data do expo-updates
 *     (expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY) passa a valer
 *     {"expo-channel-name":"${updatesChannel}"} — o Gradle substitui o token por flavor.
 *  3. Label por flavor via source set (res/values/strings.xml de cada flavor sobrepõe
 *     o app_name do main, sem conflito de recurso duplicado).
 *  4. Ícone de homologação (âmbar + selo "HLG") pelo mesmo mecanismo: assets/android-res-homolog
 *     é copiado para src/homologacao/res e sobrepõe os mipmaps/iconBackground que o Expo
 *     gerou no main a partir do app.json. Regerar com scripts/gerar-icones.mjs.
 */
const MARKER = '// withEntregasFlavors: product flavors produção/homologação';

const FLAVORS_BLOCK = `
    ${MARKER}
    flavorDimensions "env"
    productFlavors {
        producao {
            dimension "env"
            manifestPlaceholders = [updatesChannel: "production"]
        }
        homologacao {
            dimension "env"
            applicationIdSuffix ".hlg"
            manifestPlaceholders = [updatesChannel: "homolog"]
        }
    }
`;

const CHANNEL_META_VALUE = '{"expo-channel-name":"${updatesChannel}"}';
const UPDATES_HEADERS_KEY = 'expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY';

// ---- 1. flavors no build.gradle -------------------------------------------
function withFlavors(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('withEntregasFlavors: esperado app/build.gradle em Groovy.');
    }
    if (config.modResults.contents.includes(MARKER)) {
      return config; // idempotente
    }
    // Insere o bloco logo após a abertura de `android {`.
    config.modResults.contents = config.modResults.contents.replace(
      /android\s*\{/,
      (m) => `${m}\n${FLAVORS_BLOCK}`
    );
    if (!config.modResults.contents.includes(MARKER)) {
      throw new Error(
        'withEntregasFlavors: não encontrei "android {" no app/build.gradle para inserir os product flavors — o prebuild não pode continuar sem as variantes produção/homologação.'
      );
    }
    return config;
  });
}

// ---- 2. canal na meta-data do expo-updates --------------------------------
function withChannelMeta(config) {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application?.[0];
    if (!app) throw new Error('withEntregasFlavors: <application> não encontrado no manifest.');
    app['meta-data'] = app['meta-data'] || [];
    const existing = app['meta-data'].find(
      (m) => m.$?.['android:name'] === UPDATES_HEADERS_KEY
    );
    if (existing) {
      existing.$['android:value'] = CHANNEL_META_VALUE;
    } else {
      app['meta-data'].push({
        $: { 'android:name': UPDATES_HEADERS_KEY, 'android:value': CHANNEL_META_VALUE },
      });
    }
    return config;
  });
}

// ---- 3. label por flavor via source set -----------------------------------
function withFlavorLabels(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const appDir = path.join(config.modRequest.platformProjectRoot, 'app');
      const write = (flavor, label) => {
        const dir = path.join(appDir, 'src', flavor, 'res', 'values');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
          path.join(dir, 'strings.xml'),
          `<resources>\n  <string name="app_name">${label}</string>\n</resources>\n`,
          'utf8'
        );
      };
      write('producao', 'CAPUL Entregas');
      write('homologacao', 'CAPUL Entregas HLG');
      return config;
    },
  ]);
}

// ---- 4. ícone próprio do flavor de homologação ----------------------------
/**
 * Copia assets/android-res-homolog/** para src/homologacao/res/**.
 *
 * O merger de recursos do Gradle faz o source set do flavor vencer o main quando
 * o nome do recurso é o mesmo — então basta reusar os nomes que o Expo gera
 * (ic_launcher / ic_launcher_round / ic_launcher_foreground / ic_launcher_monochrome
 * e a cor iconBackground). Produção continua saindo do app.json, sem override.
 */
function withHomologIcon(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const origem = path.join(config.modRequest.projectRoot, 'assets', 'android-res-homolog');
      if (!fs.existsSync(origem)) {
        throw new Error(
          'withEntregasFlavors: assets/android-res-homolog não existe — o APK de homologação sairia com o ícone de produção e ninguém saberia qual app é qual. Rode scripts/gerar-icones.mjs.'
        );
      }
      const destino = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'homologacao', 'res');
      fs.cpSync(origem, destino, { recursive: true });
      return config;
    },
  ]);
}

module.exports = function withEntregasFlavors(config) {
  config = withFlavors(config);
  config = withChannelMeta(config);
  config = withFlavorLabels(config);
  config = withHomologIcon(config);
  return config;
};
