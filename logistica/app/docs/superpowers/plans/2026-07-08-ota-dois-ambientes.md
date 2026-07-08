# OTA + Dois Ambientes (App Entregador) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rodar o app entregador em **produção** e **homologação** lado a lado no mesmo aparelho, cada um preso ao seu ambiente, com atualização **OTA (`expo-updates`)** por canal e disciplina de "promover HLG → produção".

**Architecture:** Uma única fonte (`app.json` + config plugins) gera o projeto `android/` via prebuild. Um config plugin injeta **dois product flavors** (`producao` / `homologacao`) com `applicationIdSuffix` distinto (side-by-side) e grava o **canal de update por flavor** no `AndroidManifest` via `manifestPlaceholders`. A URL da API é resolvida **em runtime** por `Updates.channel`. O bundle testado em `homolog` é **promovido** byte-idêntico para `production` (mesmo fingerprint → promoção segura). APK é buildado **localmente** (gradle no Windows); OTA publica pela nuvem (`eas update`, plano free).

**Tech Stack:** Expo SDK 56, React Native 0.85.3, React 19.2.3, `expo-updates ~56.0.20`, `expo-constants`, Android-only, Gradle local (Windows), EAS Update (plano free).

## Global Constraints

- **Android-only.** Expo SDK **56**, RN **0.85.3**, React **19.2.3**, `expo-updates ~56.0.20`.
- **APK é buildado LOCALMENTE via Gradle no Windows.** `eas build` **NÃO** é usado (cota do plano free). Manter o plugin `plugins/withWindowsCmakeVersion.js` (fix de MAX_PATH) intacto.
- **`android/` está no `.gitignore`** (workflow managed/prebuild). **NUNCA** editar `android/` gerado à mão — toda mudança nativa via **config plugin** aplicado no prebuild.
- **`runtimeVersion.policy = "fingerprint"`.** Os dois flavors saem do MESMO projeto gerado → **fingerprint idêntico** → runtimes iguais → promoção HLG→prod é válida.
- **Dois canais:** `production` e `homolog`. **Dois apps:** `br.com.capul.entregas` (prod) e `br.com.capul.entregas.hlg` (hlg).
- **Nada chega em produção sem passar por HLG e ser promovido.** `eas update --branch production` só p/ hotfix crítico.
- **Nunca** forçar `reloadAsync` automático no meio de uma entrega — quem escolhe o momento é o entregador.
- Todo comentário/código-copy em **pt-BR com acentuação correta**.
- Cada task = 1 commit pequeno. `git` roda a partir de `logistica/app` (working dir do app) salvo indicação.
- Fora de escopo (follow-ups — **não** implementar): ícone HLG distinto; rota `GET /api/v1/logistica/app/versao-minima` + bloqueio por versão mínima; banner híbrido que só recarrega sem fila/rota pendente.

---

## File Structure

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `logistica/app/plugins/withEntregasFlavors.js` | Config plugin: injeta flavors no `build.gradle`, canal por flavor no manifest, label por flavor via source set | **Criar** |
| `logistica/app/app.json` | Registrar o novo plugin; dedup de permissões; remover `extra.apiUrl` | **Modificar** |
| `logistica/app/eas.json` | Profiles refletindo canais `production` / `homolog` | **Modificar** |
| `logistica/app/src/api/urlPorCanal.ts` | Função **pura** canal→URL (unit-testável, sem imports) | **Criar** |
| `logistica/app/src/api/config.ts` | Resolver `API_URL` por `Updates.channel`; remover fallback prod chumbado e leitura de `extra.apiUrl` | **Modificar** |
| `logistica/app/src/updates/shouldCheckForUpdate.ts` | Função **pura** de throttle (unit-testável) | **Criar** |
| `logistica/app/src/updates/useAppUpdate.ts` | Hook: checa update (cold start + foreground, throttle), expõe estado do banner | **Criar** |
| `logistica/app/src/updates/UpdateBanner.tsx` | UI "Nova versão disponível" → [Atualizar agora] / [Adiar] | **Criar** |
| `logistica/app/src/api/__tests__/urlPorCanal.test.ts` | Teste unit da função pura | **Criar** |
| `logistica/app/src/updates/__tests__/shouldCheckForUpdate.test.ts` | Teste unit do throttle | **Criar** |
| `logistica/app/jest.config.js` + `package.json` | Runner de teste (babel-jest) p/ as funções puras | **Criar/Modificar** |
| `logistica/app/App.tsx` (ou raiz de navegação) | Montar `<UpdateBanner/>` no topo | **Modificar** |
| `logistica/app/package.json` (`scripts`) | Comandos do fluxo: build local por variante + publicar/promover OTA | **Modificar** |

**Ordem por dependência:** Task 1 (limpezas isoladas) → Task 2 (test runner) → Task 3 (config plugin flavors+canal) → Task 4 (`urlPorCanal` + `config.ts`) → Task 5 (throttle puro) → Task 6 (hook + banner) → Task 7 (setup EAS + publicar + promover) → Task 8 (scripts npm do fluxo).

---

### Task 1: Limpezas isoladas (permissões e eas.json)

Mudanças seguras e independentes, feitas primeiro para não poluir os diffs seguintes. **Não** mexe em `extra.apiUrl` aqui (isso vai junto com `config.ts` na Task 4, p/ o commit não quebrar a resolução da URL no meio).

**Files:**
- Modify: `logistica/app/app.json` (bloco `expo.android.permissions`)
- Modify: `logistica/app/eas.json`

**Interfaces:**
- Consumes: nada.
- Produces: `eas.json` com profile `homolog` (canal `homolog`) e profile `production` (canal `production`); `app.json` com lista de permissões deduplicada.

- [ ] **Step 1: Deduplicar permissões no `app.json`**

O diff atual dobrou a lista e mistura nomes curtos com `android.permission.*`. Substituir todo o array `expo.android.permissions` por esta lista única (nomes curtos, que o Expo prefixa sozinho):

```json
      "permissions": [
        "INTERNET",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION",
        "CAMERA",
        "RECEIVE_BOOT_COMPLETED"
      ]
```

- [ ] **Step 2: Ajustar `eas.json` para refletir os dois canais**

Substituir o conteúdo de `eas.json` por (profile `homolog` no canal `homolog`, `production` no canal `production`; ambos APK local via `internal`):

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "homolog": {
      "android": {
        "buildType": "apk"
      },
      "distribution": "internal",
      "channel": "homolog"
    },
    "production": {
      "android": {
        "buildType": "apk"
      },
      "distribution": "internal",
      "channel": "production"
    }
  }
}
```

> Nota: como o APK é buildado por Gradle local (flavors), esses profiles do `eas.json` só valem se algum dia usarmos `eas build`; hoje servem de documentação do mapeamento profile→canal. Mantidos por consistência.

- [ ] **Step 3: Validar o JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('app.json','utf8')); JSON.parse(require('fs').readFileSync('eas.json','utf8')); console.log('OK')"`
Expected: imprime `OK` (sem exceção de parse).

- [ ] **Step 4: Commit**

```bash
git add app.json eas.json
git commit -m "chore(app): dedup de permissões e eas.json com canais production/homolog"
```

---

### Task 2: Test runner para funções puras (babel-jest)

As peças críticas de lógica (mapa canal→URL e throttle) são funções **puras sem imports nativos** — dá para testá-las com Jest usando só `babel-jest` + o `babel-preset-expo` já presente, sem `jest-expo`/jsdom/mocks de RN (evita fricção com RN 0.85/React 19).

**Files:**
- Create: `logistica/app/babel.config.js` (se ainda não existir)
- Create: `logistica/app/jest.config.js`
- Modify: `logistica/app/package.json` (devDeps + script `test`)

**Interfaces:**
- Consumes: nada.
- Produces: comando `npm test` roda Jest; transform via `babel-jest`.

- [ ] **Step 1: Garantir `babel.config.js`**

Se `logistica/app/babel.config.js` não existir, criar com o preset do Expo:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
```

- [ ] **Step 2: Criar `jest.config.js`**

```js
// Runner mínimo só p/ funções PURAS (canal→URL, throttle). Sem preset RN:
// essas funções não importam nada de expo/react-native, então basta transpilar TS via babel.
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },
  testMatch: ['**/__tests__/**/*.test.(ts|tsx)'],
};
```

- [ ] **Step 3: Instalar devDeps e adicionar script**

```bash
npm install -D jest babel-jest
```

Adicionar em `package.json` → `scripts`:

```json
    "test": "jest"
```

- [ ] **Step 4: Smoke test do runner**

Criar arquivo temporário `logistica/app/src/__tests__/smoke.test.ts`:

```ts
test('runner funciona', () => {
  expect(1 + 1).toBe(2);
});
```

Run: `npm test`
Expected: PASS (1 teste). Depois **apagar** `src/__tests__/smoke.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json jest.config.js babel.config.js
git commit -m "test(app): runner Jest (babel-jest) p/ funções puras"
```

---

### Task 3: Config plugin — flavors + canal por flavor + label

Injeta no projeto gerado, durante o prebuild: **dois product flavors** (side-by-side via `applicationIdSuffix`), o **canal de update por flavor** (meta-data com `manifestPlaceholders`) e o **label por flavor** (source set). Espelha o estilo de `withWindowsCmakeVersion.js` (idempotente, com marker).

**Files:**
- Create: `logistica/app/plugins/withEntregasFlavors.js`
- Modify: `logistica/app/app.json` (array `expo.plugins`)

**Interfaces:**
- Consumes: nada.
- Produces: build gera variantes `producaoRelease` (canal `production`, package `br.com.capul.entregas`, label "CAPUL Entregas") e `homologacaoRelease` (canal `homolog`, package `br.com.capul.entregas.hlg`, label "CAPUL Entregas HLG"). `Updates.channel` em runtime devolve `"production"` ou `"homolog"` conforme a variante instalada.

- [ ] **Step 1: Criar `plugins/withEntregasFlavors.js`**

```js
const { withAppBuildGradle, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Dois ambientes side-by-side (produção/homologação) para o app entregador.
 *
 * `android/` é gitignored (workflow managed): tudo é injetado no prebuild, nunca
 * editado à mão. Fonte única → prebuild determinístico → MESMO fingerprint p/ os
 * dois flavors → a promoção do bundle (HLG → produção) é byte-idêntica e válida.
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

module.exports = function withEntregasFlavors(config) {
  config = withFlavors(config);
  config = withChannelMeta(config);
  config = withFlavorLabels(config);
  return config;
};
```

- [ ] **Step 2: Registrar o plugin no `app.json`**

Adicionar `"./plugins/withEntregasFlavors.js"` ao array `expo.plugins` (após `./plugins/withWindowsCmakeVersion.js`):

```json
    "plugins": [
      "expo-asset",
      [
        "expo-location",
        {
          "isAndroidBackgroundLocationEnabled": true,
          "isAndroidForegroundServiceEnabled": true,
          "locationAlwaysAndWhenInUsePermission": "O CAPUL Entregas usa sua localização durante a viagem (inclusive em segundo plano) para o monitoramento da rota pela gestão."
        }
      ],
      "expo-secure-store",
      "expo-status-bar",
      "./plugins/withWindowsCmakeVersion.js",
      "./plugins/withEntregasFlavors.js"
    ],
```

- [ ] **Step 3: Prebuild e inspecionar o projeto gerado**

Run: `npx expo prebuild -p android --clean`
Depois inspecionar (o executor deve ABRIR e conferir, não presumir):

1. `android/app/build.gradle` contém o bloco `productFlavors { producao {...} homologacao {...} }` com o marker.
2. `android/app/src/main/AndroidManifest.xml` contém a meta-data:
   `android:name="expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY"` com value `{"expo-channel-name":"${updatesChannel}"}`.
3. Existem `android/app/src/producao/res/values/strings.xml` e `android/app/src/homologacao/res/values/strings.xml` com o `app_name` correto.

Expected: os 3 itens presentes. Se a meta-data do expo-updates não existir no manifest gerado, o `withChannelMeta` a cria (conferir que foi criada).

- [ ] **Step 4: Confirmar o merge do manifest por variante (canal correto)**

Run: `cd android && ./gradlew :app:processHomologacaoReleaseManifest && cd ..`
Depois abrir `android/app/build/intermediates/merged_manifests/homologacaoRelease/AndroidManifest.xml` (o caminho exato pode variar por AGP; localizar o manifest merged de `homologacaoRelease`) e confirmar que a meta-data virou:
`android:value="{&quot;expo-channel-name&quot;:&quot;homolog&quot;}"` (token substituído por `homolog`).

Expected: token `${updatesChannel}` resolvido para `homolog` na variante homolog (e para `production` na variante produção — repetir com `:app:processProducaoReleaseManifest` se quiser dupla checagem).

> Se a substituição do `${updatesChannel}` NÃO ocorrer (manifest ainda com o token literal), a alternativa é gravar a meta-data via source set por flavor (arquivo `AndroidManifest.xml` em `src/producao/` e `src/homologacao/`) em vez de placeholder — ajustar o plugin para escrever esses manifests no `withDangerousMod` (mesmo padrão do label). Confirmar antes qual das duas o AGP 8.x aplica.

- [ ] **Step 5: Build local das duas variantes e validar side-by-side**

Run (variante homolog): `npx expo run:android --variant homologacaoRelease`
Run (variante produção): `npx expo run:android --variant producaoRelease`

Expected: os DOIS apps instalam e coexistem no aparelho — ícones/labels "CAPUL Entregas" e "CAPUL Entregas HLG"; packages `br.com.capul.entregas` e `br.com.capul.entregas.hlg`.
Confirmar packages: `adb shell pm list packages | grep capul` → mostra as duas linhas.

- [ ] **Step 6: Commit**

```bash
git add plugins/withEntregasFlavors.js app.json
git commit -m "feat(app): config plugin com flavors produção/homologação + canal por flavor"
```

---

### Task 4: Resolução da API por canal (`urlPorCanal` + `config.ts`)

Extrai o mapa canal→URL numa função **pura testável** e faz `config.ts` decidir por `Updates.channel`, mantendo `__DEV__`/`devApiUrl()` intactos. Remove `extra.apiUrl` e o fallback de produção chumbado.

**Files:**
- Create: `logistica/app/src/api/urlPorCanal.ts`
- Create: `logistica/app/src/api/__tests__/urlPorCanal.test.ts`
- Modify: `logistica/app/src/api/config.ts`
- Modify: `logistica/app/app.json` (remover `extra.apiUrl`)

**Interfaces:**
- Consumes: `Updates.channel` (`string | null`) de `expo-updates`.
- Produces: `export function urlPorCanal(channel: string | null | undefined): string | undefined`. Mapa: `"production" → "https://platform.capul.com.br"`, `"homolog" → "https://platformhlg.capul.com.br"`, qualquer outro/`null`/`undefined` → `undefined`. `config.ts` exporta `API_URL`, `AUTH_BASE`, `LOGISTICA_BASE` (assinaturas inalteradas).

- [ ] **Step 1: Escrever o teste que falha (`urlPorCanal.test.ts`)**

```ts
import { urlPorCanal } from '../urlPorCanal';

describe('urlPorCanal', () => {
  it('mapeia o canal production p/ a URL de produção', () => {
    expect(urlPorCanal('production')).toBe('https://platform.capul.com.br');
  });
  it('mapeia o canal homolog p/ a URL de homologação', () => {
    expect(urlPorCanal('homolog')).toBe('https://platformhlg.capul.com.br');
  });
  it('devolve undefined p/ canal nulo (dev build / Expo Go)', () => {
    expect(urlPorCanal(null)).toBeUndefined();
    expect(urlPorCanal(undefined)).toBeUndefined();
  });
  it('devolve undefined p/ canal desconhecido (não cai em produção por engano)', () => {
    expect(urlPorCanal('qualquer-coisa')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- urlPorCanal`
Expected: FAIL — `Cannot find module '../urlPorCanal'`.

- [ ] **Step 3: Implementar `urlPorCanal.ts`**

```ts
/**
 * Mapa canal → URL da API, decidido em RUNTIME por `Updates.channel`.
 * Função pura (sem imports) p/ ser unit-testável e p/ não acoplar a resolução
 * da URL ao expo-updates. Canal desconhecido/nulo → undefined (o chamador decide
 * o fallback; NUNCA cair em produção por engano a partir de um build não-identificado).
 */
const URL_POR_CANAL: Record<string, string> = {
  production: 'https://platform.capul.com.br',
  homolog: 'https://platformhlg.capul.com.br',
};

export function urlPorCanal(channel: string | null | undefined): string | undefined {
  if (!channel) return undefined;
  return URL_POR_CANAL[channel];
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm test -- urlPorCanal`
Expected: PASS (4 testes).

- [ ] **Step 5: Reescrever `config.ts` para resolver por canal**

```ts
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { urlPorCanal } from './urlPorCanal';

/**
 * URL base da API (nginx da plataforma). Ordem de resolução:
 *  1. EXPO_PUBLIC_API_URL (env do build) — override explícito.
 *  2. DEV: mesmo host do Metro, via HTTP (auto-sincronia com o backend local).
 *  3. RUNTIME por canal: Updates.channel → production/homolog (o binário nativo
 *     grava o canal por flavor; é isso que torna a promoção do bundle exato segura).
 *  4. Fallback: homologação (mais seguro que produção p/ um build não-identificado).
 */
const DEV_API_PORT = 8085;
function devApiUrl(): string | undefined {
  const hostUri = Constants.expoConfig?.hostUri; // ex.: "172.16.0.159:8081"
  const host = hostUri?.split(':')[0];
  return host ? `http://${host}:${DEV_API_PORT}` : undefined;
}

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ??
  (__DEV__ ? devApiUrl() : undefined) ??
  urlPorCanal(Updates.channel) ??
  'https://platformhlg.capul.com.br'
).replace(/\/$/, '');

export const AUTH_BASE = `${API_URL}/api/v1/auth`;
export const LOGISTICA_BASE = `${API_URL}/api/v1/logistica`;
```

- [ ] **Step 6: Remover `extra.apiUrl` do `app.json`**

Remover do bloco `expo.extra` a linha `"apiUrl": "https://platformhlg.capul.com.br"` e o comentário `"//"` acima dela, deixando `extra` só com `eas.projectId`:

```json
    "extra": {
      "eas": {
        "projectId": "0d458eb9-9907-43b7-92ca-ab1d431482b0"
      }
    },
```

- [ ] **Step 7: Typecheck e teste**

Run: `npm run typecheck && npm test`
Expected: `tsc` sem erros; todos os testes PASS.

- [ ] **Step 8: Commit**

```bash
git add src/api/urlPorCanal.ts src/api/__tests__/urlPorCanal.test.ts src/api/config.ts app.json
git commit -m "feat(app): resolve URL da API por canal (Updates.channel); remove apiUrl chumbado"
```

---

### Task 5: Throttle de checagem (função pura)

Isola a decisão "posso checar update agora?" numa função pura testável, usada pelo hook da Task 6.

**Files:**
- Create: `logistica/app/src/updates/shouldCheckForUpdate.ts`
- Create: `logistica/app/src/updates/__tests__/shouldCheckForUpdate.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `export const THROTTLE_MS = 30 * 60 * 1000;` e `export function shouldCheckForUpdate(lastCheckMs: number | null, nowMs: number, throttleMs?: number): boolean`. Retorna `true` se `lastCheckMs` é `null` (nunca checou) ou se passou `throttleMs` desde a última checagem.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { shouldCheckForUpdate, THROTTLE_MS } from '../shouldCheckForUpdate';

describe('shouldCheckForUpdate', () => {
  it('permite a primeira checagem (nunca checou)', () => {
    expect(shouldCheckForUpdate(null, 1_000_000)).toBe(true);
  });
  it('bloqueia dentro da janela de throttle', () => {
    const now = 1_000_000;
    expect(shouldCheckForUpdate(now - (THROTTLE_MS - 1), now)).toBe(false);
  });
  it('permite depois da janela de throttle', () => {
    const now = 1_000_000;
    expect(shouldCheckForUpdate(now - THROTTLE_MS, now)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- shouldCheckForUpdate`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

```ts
/** Máx. 1 checagem de update a cada 30 min (poupa bateria/dados). */
export const THROTTLE_MS = 30 * 60 * 1000;

/**
 * Decide se pode checar update agora. Puro p/ ser testável — o hook injeta
 * `Date.now()` como `nowMs` e o timestamp persistido como `lastCheckMs`.
 */
export function shouldCheckForUpdate(
  lastCheckMs: number | null,
  nowMs: number,
  throttleMs: number = THROTTLE_MS,
): boolean {
  if (lastCheckMs === null) return true;
  return nowMs - lastCheckMs >= throttleMs;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- shouldCheckForUpdate`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/updates/shouldCheckForUpdate.ts src/updates/__tests__/shouldCheckForUpdate.test.ts
git commit -m "feat(app): throttle puro de checagem de update (30min)"
```

---

### Task 6: Hook + Banner de update

Hook que checa update no cold start e no foreground-resume (com o throttle da Task 5), baixa se houver, e expõe estado p/ o banner "Nova versão disponível". O banner só aparece com update **baixado e pronto**; [Atualizar agora] chama `Updates.reloadAsync()` (preserva `AsyncStorage`/`SecureStore` → fila offline e sessão sobrevivem); [Adiar] silencia a sessão. **Nunca** recarrega sozinho.

**Files:**
- Create: `logistica/app/src/updates/useAppUpdate.ts`
- Create: `logistica/app/src/updates/UpdateBanner.tsx`
- Modify: `logistica/app/App.tsx` (montar o banner no topo da árvore)

**Interfaces:**
- Consumes: `shouldCheckForUpdate`, `THROTTLE_MS` (Task 5); `expo-updates` (`Updates.isEnabled`, `checkForUpdateAsync`, `fetchUpdateAsync`, `reloadAsync`).
- Produces: `export function useAppUpdate(): { updateReady: boolean; aplicar: () => void; adiar: () => void }`; `export function UpdateBanner(): JSX.Element | null`.

- [ ] **Step 1: Implementar `useAppUpdate.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';
import { shouldCheckForUpdate } from './shouldCheckForUpdate';

/**
 * Checa OTA no cold start e a cada foreground-resume (com throttle de 30min).
 * Só sinaliza `updateReady` quando o update foi BAIXADO e está pronto p/ aplicar.
 * Reload é sempre acionado pelo usuário (banner) — nunca automático no meio da entrega.
 */
export function useAppUpdate() {
  const [updateReady, setUpdateReady] = useState(false);
  const [dispensado, setDispensado] = useState(false);
  const lastCheck = useRef<number | null>(null);

  const checar = useCallback(async () => {
    if (!Updates.isEnabled) return; // dev/Expo Go: OTA desligado
    const agora = Date.now();
    if (!shouldCheckForUpdate(lastCheck.current, agora)) return;
    lastCheck.current = agora;
    try {
      const res = await Updates.checkForUpdateAsync();
      if (res.isAvailable) {
        await Updates.fetchUpdateAsync();
        setUpdateReady(true);
      }
    } catch {
      // rede/servidor indisponível: silencioso, tenta de novo no próximo ciclo
    }
  }, []);

  useEffect(() => {
    void checar(); // cold start
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void checar();
    });
    return () => sub.remove();
  }, [checar]);

  const aplicar = useCallback(() => {
    void Updates.reloadAsync();
  }, []);

  const adiar = useCallback(() => setDispensado(true), []);

  return { updateReady: updateReady && !dispensado, aplicar, adiar };
}
```

- [ ] **Step 2: Implementar `UpdateBanner.tsx`**

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useAppUpdate } from './useAppUpdate';

/** Banner "Nova versão disponível" — [Atualizar agora] / [Adiar]. */
export function UpdateBanner() {
  const { updateReady, aplicar, adiar } = useAppUpdate();
  if (!updateReady) return null;
  return (
    <View style={styles.container}>
      <Text style={styles.texto}>Nova versão disponível</Text>
      <View style={styles.acoes}>
        <Pressable onPress={aplicar} style={[styles.botao, styles.primario]}>
          <Text style={styles.botaoTextoPrimario}>Atualizar agora</Text>
        </Pressable>
        <Pressable onPress={adiar} style={styles.botao}>
          <Text style={styles.botaoTexto}>Adiar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e3a5f',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  texto: { color: '#fff', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  acoes: { flexDirection: 'row', gap: 8 },
  botao: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  primario: { backgroundColor: '#4caf50' },
  botaoTexto: { color: '#cfe0f0', fontSize: 13 },
  botaoTextoPrimario: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
```

- [ ] **Step 3: Montar o banner no topo da árvore (`App.tsx`)**

Abrir `logistica/app/App.tsx`, importar `UpdateBanner` e renderizá-lo acima do conteúdo (ex.: dentro do container raiz, antes do `NavigationContainer`/navegador), respeitando a safe area já usada no app. Exemplo do trecho a inserir:

```tsx
import { UpdateBanner } from './src/updates/UpdateBanner';
// ...dentro do render, no topo do container raiz:
//   <UpdateBanner />
//   <NavigationContainer> ... </NavigationContainer>
```

> Ajustar ao layout real de `App.tsx` (localizar o container/`SafeAreaView` raiz e inserir `<UpdateBanner />` como primeiro filho visível). Se a raiz de navegação estiver noutro arquivo, montar lá.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 5: Validar em runtime (build homolog)**

Como `Updates.isEnabled` é `false` em dev, a checagem real exige um build de release já publicado. Validação completa acontece na Task 7 (após o primeiro `eas update --branch homolog`). Aqui, confirmar apenas que:
- o app sobe normalmente na variante `homologacaoRelease` (banner ausente quando não há update);
- nenhum reload automático ocorre.

Run: `npx expo run:android --variant homologacaoRelease`
Expected: app abre normal, sem banner (ainda não há update publicado), sem reload espontâneo.

- [ ] **Step 6: Commit**

```bash
git add src/updates/useAppUpdate.ts src/updates/UpdateBanner.tsx App.tsx
git commit -m "feat(app): hook + banner de update OTA (cold start/foreground, reload pelo usuário)"
```

---

### Task 7: Setup EAS — canais, publicar em HLG e promover

Cria os canais/branches no EAS, publica o primeiro OTA em `homolog`, valida no app HLG e **promove** o mesmo update para `production`. Comandos executados pelo **usuário** (credenciais EAS na conta dele; plano free). **NÃO** usar `eas build`.

**Files:** nenhum arquivo do repo; muda estado no serviço EAS.

**Interfaces:**
- Consumes: `projectId 0d458eb9-9907-43b7-92ca-ab1d431482b0`; APKs release das duas variantes (Task 3) instalados.
- Produces: canais `production` e `homolog` ligados a branches homônimas; um update-group publicado em `homolog` e promovido a `production`.

- [ ] **Step 1: Autenticar no EAS**

Sugerir ao usuário rodar (login interativo): `! eas login`
Confirmar projeto: `eas whoami` e `eas project:info` → deve refletir o `projectId` do `app.json`.

- [ ] **Step 2: Criar canais e branches**

```bash
eas channel:create homolog
eas channel:create production
```

(Se o comando já criar a branch homônima, seguir; senão `eas branch:create homolog` / `production`.) Vincular canal↔branch se necessário:

```bash
eas channel:edit homolog --branch homolog
eas channel:edit production --branch production
```

Verificar: `eas channel:list` → mostra `homolog` e `production`.

- [ ] **Step 3: Publicar o primeiro OTA só em homolog**

```bash
eas update --branch homolog -m "Primeiro OTA de homologação"
```

Expected: sai um `update group id` (anotar) e a mensagem de sucesso; `eas update:list --branch homolog` mostra o grupo.

- [ ] **Step 4: Validar no app HLG (runtime)**

No aparelho com a variante `homologacaoRelease` instalada (Task 3), abrir/reabrir o app.
Expected: dentro do ciclo cold-start/foreground (throttle 30min) o hook baixa o update e o banner **"Nova versão disponível"** aparece; [Atualizar agora] recarrega e o app volta com a fila offline e a sessão preservadas; a URL da API resolvida é a de **homologação** (`https://platformhlg.capul.com.br`).
Confirmar canal em runtime, se instrumentado: `Updates.channel === "homolog"`.

- [ ] **Step 5: Conferir a sintaxe de promoção no CLI instalado**

Run: `npx eas update:republish --help`
Sintaxe **confirmada no eas-cli 20.5.1** (08/07/2026): seleção de origem por `--branch`/`--channel`/`--group`; destino cross-branch por `--destination-branch`/`--destination-channel`; mensagem por `-m`. Reconfirmar se a versão do CLI mudou.

- [ ] **Step 6: Promover o update de homolog → production**

Promover o **mesmo** bundle (byte-idêntico) de `homolog` para `production`. Selecionando o grupo pela branch de origem (picker interativo):

```bash
eas update:republish --branch homolog --destination-branch production -m "Promoção HLG -> produção"
```

(Alternativa não-interativa: `--group <update-group-id> --destination-branch production`, usando o id do Step 3. Ou o botão **Promote** no dashboard do EAS.)

Expected: `eas update:list --branch production` mostra o MESMO conteúdo/commit do grupo de homolog.

- [ ] **Step 7: Validar no app de produção (runtime)**

No aparelho com a variante `producaoRelease` instalada, reabrir o app.
Expected: banner aparece, [Atualizar agora] aplica; a URL resolvida é a de **produção** (`https://platform.capul.com.br`); `Updates.channel === "production"`.

- [ ] **Step 8: Registrar o procedimento**

Atualizar `logistica/app/docs/OTA_DOIS_AMBIENTES.md` (seção "Fluxo OTA") com os comandos exatos confirmados nos Steps 5–6 (a sintaxe real de promoção do CLI instalado), substituindo o "(a confirmar)".

```bash
git add docs/OTA_DOIS_AMBIENTES.md
git commit -m "docs(app): fluxo OTA com sintaxe de promoção confirmada"
```

---

### Task 8: Scripts de npm para o fluxo OTA/build

Encapsula no `package.json` os comandos do fluxo (build local por variante + publicar/promover OTA), para o TI não digitar comandos longos e o fluxo ficar auto-documentado. Vem por último porque os scripts referenciam os flavors (Task 3) e os canais (Task 7). **Remove** o `build:apk` atual, que usa `eas build` — proibido pelas Global Constraints (cota do free; APK é gradle local).

**Files:**
- Modify: `logistica/app/package.json` (bloco `scripts`)

**Interfaces:**
- Consumes: variantes `homologacaoRelease`/`producaoRelease` (Task 3); canais `homolog`/`production` (Task 7); `eas-cli >= 20.5.1` (sintaxe de `update:republish` confirmada).
- Produces: scripts `build:homolog`, `build:production`, `ota:homolog`, `ota:promote`, `ota:hotfix`.

- [ ] **Step 1: Substituir o bloco `scripts` do `package.json`**

Trocar o `scripts` atual (que tem `build:apk` com `eas build`) por:

```json
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "build:homolog": "expo run:android --variant homologacaoRelease",
    "build:production": "expo run:android --variant producaoRelease",
    "ota:homolog": "eas update --branch homolog",
    "ota:promote": "eas update:republish --branch homolog --destination-branch production",
    "ota:hotfix": "eas update --branch production"
  },
```

Semântica de cada script (fluxo do plano):
- `build:homolog` / `build:production` — buildam o APK **local** (gradle) da variante; TI instala manualmente.
- `ota:homolog` — publica OTA **só em homologação** (`eas update --branch homolog`). Passar a mensagem com `npm run ota:homolog -- -m "descrição"` (sem `-m`, o EAS pergunta interativamente).
- `ota:promote` — **promove** o bundle testado de `homolog` → `production` (byte-idêntico; picker interativo do grupo). Este é o caminho normal para produção.
- `ota:hotfix` — **escape hatch**: publica direto em `production` (`eas update --branch production`). Usar **só** em hotfix crítico — fura a regra "nada chega em produção sem passar por HLG".

> `test` aqui pressupõe o runner da Task 2 já instalado; se executar as tasks fora de ordem, incluir o `jest` antes.

- [ ] **Step 2: Validar o JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('OK')"`
Expected: imprime `OK`.

- [ ] **Step 3: Conferir que os scripts foram registrados**

Run: `npm run`
Expected: lista inclui `build:homolog`, `build:production`, `ota:homolog`, `ota:promote`, `ota:hotfix` (e não mais `build:apk`).

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore(app): scripts npm p/ build local por variante e fluxo OTA (homolog/promote/hotfix)"
```

---

## Self-Review

**1. Spec coverage** (contra `OTA_DOIS_AMBIENTES.md` e o handoff):
- Decisão 1 (side-by-side) → Task 3 (`applicationIdSuffix .hlg`). ✓
- Decisão 2 (1 projeto, 2 canais) → Task 7 (`projectId` mantido, canais `homolog`/`production`). ✓
- Decisão 3 (APK interno/sideload) → Task 3 build local; Task 1 `eas.json` `internal`. ✓
- Decisão 4 (URL por canal em runtime) → Task 4. ✓
- Decisão 5 (promover; direto só hotfix) → Task 7 Steps 5–6; hotfix documentado nas Global Constraints. ✓
- Decisão 6 (banner [Atualizar agora]/[Adiar]) → Task 6. ✓
- Decisão 7 (cold start + foreground, throttle 30min) → Task 5 + Task 6. ✓
- Decisão 8 (APK novo manual; aviso versão mínima = follow-up) → build local Task 3; follow-up fora de escopo. ✓
- Decisão 9 (ícone HLG) → follow-up fora de escopo. ✓
- Decisão 10 (build local; OTA nuvem, sem `eas build`) → Global Constraints + Task 7. ✓
- Decisão 11 (flavors + fingerprint) → Task 3; fingerprint único nas Global Constraints. ✓
- Limpezas (dedup permissões, eas.json canais) → Task 1. Remoção de `extra.apiUrl` → Task 4. ✓
- Scripts npm do fluxo (build local por variante, `ota:homolog`/`ota:promote`/`ota:hotfix`; remove `build:apk`/`eas build`) → Task 8. ✓
- 3 pontos técnicos do handoff: canal por flavor (Task 3 Steps 3–4), `eas update:republish` (Task 7 Step 5), `app.config` dinâmico × android/ (resolvido: sem config dinâmico, plugin no prebuild — Global Constraints + Task 3). ✓

**2. Placeholder scan:** sem "TBD/TODO/implement later". Os pontos onde a saída exata do AGP/CLI precisa ser vista (merge do manifest, flags do republish) são **passos de verificação concretos com comando + expected + fallback**, não placeholders.

**3. Type consistency:** `urlPorCanal(channel: string|null|undefined): string|undefined` idêntico entre Task 4 (produz) e Task 6 (o hook usa `Updates.channel`, não a função — coerente). `shouldCheckForUpdate(lastCheckMs, nowMs, throttleMs?)` e `THROTTLE_MS` idênticos entre Task 5 (produz) e Task 6 (consome). `useAppUpdate(): { updateReady, aplicar, adiar }` consistente entre Steps de Task 6. `API_URL/AUTH_BASE/LOGISTICA_BASE` preservados (Task 4). ✓
