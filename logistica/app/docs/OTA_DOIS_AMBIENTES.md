# OTA e dois ambientes — App Entregador (CAPUL Entregas)

> Desenho acordado para operar o app entregador em **produção** e **homologação**
> lado a lado, com **OTA (`expo-updates`)** por ambiente. Fruto da sessão de
> grilling de 08/07/2026. Este documento é o desenho; a implementação vem depois.

## Contexto

- App: `logistica/app` — Expo SDK 56 (RN 0.85, React 19.2), Android-only, build
  **local (gradle no Windows)** com plugin de MAX_PATH (`withWindowsCmakeVersion.js`).
- A plataforma tem **duas versões expostas**:
  - Produção → `https://platform.capul.com.br`
  - Homologação → `https://platformhlg.capul.com.br`
- Distribuição do APK: **manual pelo TI** (sideload, sem Play Store).

## Decisões (árvore de design resolvida)

| # | Decisão | Escolha |
|---|---------|---------|
| 1 | Os dois apps convivem no mesmo aparelho? | **Sim, side-by-side** (packages distintos) |
| 2 | Projetos EAS | **1 projeto, 2 canais** (mantém `projectId 0d458eb9…`) |
| 3 | Distribuição de produção | **APK interno / sideload** (sem loja) |
| 4 | De onde vem a URL da API | **Do canal, em runtime** (`Updates.channel`) |
| 5 | Disciplina de publicação | **Promover** o bundle testado (republish); publicar direto só p/ hotfix |
| 6 | Aplicação do update no aparelho | **Banner "Nova versão disponível"** → [Atualizar agora] / [Adiar] |
| 7 | Cadência de checagem | **Cold start + foreground** (throttle ~30min) |
| 8 | APK novo (mudança nativa) | **TI instala manualmente**; aviso in-app de versão mínima = follow-up |
| 9 | Ícone distinto p/ HLG | **Follow-up** (ainda não há arte) |
| 10 | Build do APK | **Local (gradle)**; OTA via nuvem (`eas update`, plano free cobre) |
| 11 | Como materializar as variantes | **Product flavors do Android + `runtimeVersion` FIXO (`"1.0.0"`)** |

## Modelo de identidade

- **1 projeto EAS** (`projectId 0d458eb9-9907-43b7-92ca-ab1d431482b0`), `updates.url` atual.
- **2 canais / branches de update**: `production` e `homolog` *(a criar)*.
- **2 variantes side-by-side** via **product flavors** do Android — uma única pasta
  `android/` (fonte idêntica; os dois flavors compartilham o **mesmo `runtimeVersion`**
  → promoção byte-idêntica funciona):

| | Produção | Homologação |
|---|---|---|
| `applicationId` | `br.com.capul.entregas` | `br.com.capul.entregas.hlg` |
| Label (nome) | `CAPUL Entregas` | `CAPUL Entregas HLG` |
| `scheme` (deep link) | `capulentregas` | `capulentregas-hlg` |
| Canal (embutido no build) | `production` | `homolog` |
| API (runtime, por canal) | `https://platform.capul.com.br` | `https://platformhlg.capul.com.br` |
| Ícone | marca CAPUL, fundo **verde** `#047942` | mesma marca, fundo **âmbar** `#b45309` + selo **HLG** |

### Ícone do app

A marca sai do arquivo oficial (`Logos Capul/CAPUL - LOGO VERTICAL - SemFundoBranco.png`):
só o símbolo (folhas + chama), no estilo do avatar da empresa — traço branco, folhas
vazadas, chama amarela. Regerar tudo com `scripts/gerar-icones.mjs` (lê o PSD/PNG oficial,
escreve `assets/`).

- **Produção**: `app.json` → `icon` + `android.adaptiveIcon` (foreground, monochrome,
  `backgroundColor`). O prebuild do Expo gera os mipmaps.
- **Homologação**: `assets/android-res-homolog/` é copiado pelo `withEntregasFlavors`
  para `src/homologacao/res/`, sobrepondo os mesmos nomes de recurso (`ic_launcher*`,
  `iconBackground`) — o merger do Gradle faz o flavor vencer o main.

> **O ícone é recurso NATIVO: OTA não troca ícone.** Mexeu em `assets/` → só entra no
> aparelho com **APK novo** (não precisa bumpar `runtimeVersion`, porque não muda a
> compatibilidade JS↔nativo — mas precisa de um `versionCode` novo se o APK anterior
> já foi distribuído).

## Resolução da API por canal (runtime)

`src/api/config.ts` passa a decidir a URL pela `Updates.channel`, **mantendo o ramo
`__DEV__`/`devApiUrl()` intacto na frente** (dev continua batendo no Metro/backend local):

```
API_URL =
  EXPO_PUBLIC_API_URL            // override explícito (inalterado)
  ?? (__DEV__ ? devApiUrl())     // dev = mesmo host do Metro:8085 (inalterado)
  ?? urlPorCanal(Updates.channel) // production → prod, homolog → hlg   ← NOVO
  ?? fallback
```

- Remove o `apiUrl` chumbado em `expo.extra` e o fallback de produção hardcoded.
- **Por que runtime e não "assado" no build:** o mesmo bundle JS roda nos dois apps;
  quem decide a URL é o canal gravado no binário nativo. Isso é o que torna a
  **promoção do bundle exato** (HLG → produção) segura.

## Fluxo OTA — "como trabalhar"

1. **Publica só em HLG:** `eas update --branch homolog --environment production -m "…"`
   → app HLG recebe. Atalho: `npm run ota:homolog -- -m "…"`.

   > O flag `--environment` é **obrigatório no SDK ≥ 55** (senão o CLI abre um picker
   > `development/preview/production`). Ele só escolhe qual conjunto de **variáveis de
   > ambiente do EAS** injetar — **não** é o canal (o canal já vem de `--branch`).
   > Fixamos `production` nos scripts: hoje não há nenhuma env var definida, então o
   > bundle sai idêntico qualquer que seja a escolha, mas assim fica determinístico e
   > coerente com o que a produção usaria (promoção byte-idêntica preservada).
2. **Valida** em campo / TI no app HLG.
3. **Promove o update exato** para produção (byte-idêntico, nada é re-gerado):
   `eas update:republish --branch homolog --destination-branch production -m "…"`
   (`--branch` = origem, `--destination-branch` = destino; abre picker do grupo
   se não passar `--group`). Ou botão *promote* no dashboard.
   Atalho: `npm run ota:promote -- -m "…"`.
4. **Escape hatch** (só hotfix crítico): `eas update --branch production` direto.

> Regra: **nada chega em produção sem passar por HLG e ser promovido.**

## Comportamento no aparelho

- Checagem no **cold start** + no **foreground-resume** (`AppState → active`),
  com **throttle** (máx. ~1×/30min) para poupar bateria/dados.
- Ao detectar update **baixado e pronto**, banner **"Nova versão disponível"**:
  - **[Atualizar agora]** → `Updates.reloadAsync()` (aplica na hora).
    `reloadAsync` **preserva `AsyncStorage`/`SecureStore`** → fila offline
    (`filaBaixas`/`filaFrota`) e sessão sobrevivem ao reload.
  - **[Adiar]** → silencia a sessão atual; a versão entra sozinha no próximo cold
    start (comportamento padrão do `expo-updates`).
- **Nunca** força reload automático no meio de uma entrega — quem escolhe o momento
  é o entregador.

## Builds e cota EAS

- **APK: build local (gradle no Windows)**, plugin MAX_PATH mantido. Os flavors
  gravam o canal (`expo-channel-name`) no manifest de cada variante.
- **OTA: nuvem (`eas update`)** — separado de `eas build`; o **plano free** cobre
  publicação/promoção de updates com folga. `eas build` (APK na nuvem) **não** é
  usado (cota apertada no free e desnecessário, já que o APK é local).
- **TI instala/atualiza o APK manualmente** por ambiente.

## ⚠️ runtimeVersion FIXO — e quando bumpar (regra manual)

O EAS **só entrega um OTA cujo `runtimeVersion` seja idêntico ao embutido no APK
instalado**. Se não casar, o app recebe "nenhum update disponível" **em silêncio** e o
banner nunca aparece.

Hoje o `runtimeVersion` é **fixo** (`"1.0.0"` no `app.json`). Antes usávamos
`policy: "fingerprint"` e **isso deu errado**: `android/` é gitignored e regenerado pelo
prebuild em cada máquina, então o fingerprint virava assinatura da **máquina**, não do
código — o **mesmo commit** saía com runtime diferente conforme quem publicava
(`cff4a22` numa máquina, `e44b0e97` na outra) e um dev **quebrava o canal OTA do outro**.
Com runtime fixo, qualquer dev publica de qualquer máquina e todos os aparelhos recebem.

**O trade-off:** perdemos a proteção automática. Agora é **manual**:

> **Mexeu em NATIVO — nova lib nativa, permissão no `app.json`, config plugin, upgrade de
> SDK/deps? → bumpe o `runtimeVersion` (`"1.0.1"`, …), bumpe o `versionCode` e
> REBUILDE + redistribua o APK.**
> **Enquanto for só JS/TSX (telas, lógica), NÃO toque no `runtimeVersion`** — os OTAs
> fluem sozinhos pros aparelhos que já estão em campo.

Se esquecer de bumpar ao mexer no nativo, um OTA que depende do nativo novo cai num APK
que **não o tem** → **crash** no aparelho do usuário. É esse o risco que o fingerprint
cobria de graça e que agora depende de disciplina.

**Depurar quando o banner não aparece:**

```bash
# runtimeVersion que o app.json declara (é o que vai no APK e no OTA):
node -e "console.log(require('./app.json').expo.runtimeVersion)"
# runtimeVersion dos OTAs publicados no branch:
eas update:list --branch homolog
```
Os dois têm que bater com o do APK instalado. Se o APK for anterior ao último bump →
rebuildar (`npm run build:homolog`) e reinstalar.

## Segurança de runtime

- `runtimeVersion` **fixo** (`"1.0.0"`). Os dois flavors compartilham o mesmo runtime →
  promoção HLG → produção funciona, e o OTA independe de qual máquina publica.
- Mudança **nativa** (dep nativa, permissão, config plugin, SDK) **não** bumpa nada
  sozinha: é o dev que tem que **bumpar o `runtimeVersion` + o `versionCode`** e
  redistribuir o **APK novo** (instalação manual pelo TI). Sem esse bump, o OTA cai num
  APK sem o nativo novo → **crash**. Ver a seção "runtimeVersion FIXO" acima.

## Limpezas de passagem (na implementação)

- Corrigir a **duplicação da lista de permissões** no `app.json` (o diff atual
  dobrou as entradas).
- Ajustar o `eas.json`: hoje os profiles `preview` e `production` apontam ambos para
  o canal `production`; devem refletir `production` / `homolog`.

## Follow-ups (fora deste escopo)

- [ ] **Ícone distinto** para HLG (quando houver arte) — aplicar variante quando `APP_ENV=homologacao`.
- [ ] **Aviso in-app de versão mínima / "reinstale"**: rota no backend
  (`GET /api/v1/logistica/app/versao-minima` → `{ minRuntimeVersion, apkUrl }`) e
  bloqueio suave quando `Updates.runtimeVersion` local < mínimo. Fecha o buraco do
  "preso na versão velha" que o OTA sozinho não resolve.
- [ ] **Banner híbrido**: só recarregar quando **não** houver rota/fila pendente.

## A confirmar na doc do Expo antes de codar (não altera o desenho)

- Forma exata de gravar o `expo-channel-name` **por flavor** num build **local**
  (via `meta-data` no `AndroidManifest` / manifest placeholders do flavor), e a
  leitura correspondente de `Updates.channel` em runtime.

> **Confirmado (eas-cli 20.5.1, 08/07/2026):** promoção via
> `eas update:republish --branch <origem> --destination-branch <destino> -m "…"`
> (origem também por `--channel`/`--group`; destino por `--destination-branch`/
> `--destination-channel`). Republica o grupo existente byte-idêntico.
