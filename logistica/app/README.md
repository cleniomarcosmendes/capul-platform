# CAPUL Entregas — App do Entregador (Fase 1b)

App **Android** (Expo / React Native) do entregador.
- **PR 1b.5**: login por device-session + lista "minhas viagens" + detalhe com
  navegação (Waze/Maps) e ligação.
- **PR 1b.6**: baixa com prova — foto obrigatória (ENTREGUE), motivo (NÃO
  ENTREGUE), GPS por evento (best-effort, 6s), **fila offline** (sem sinal a
  baixa fica no aparelho e reenvia sozinha; `idempotencyKey` fixa = reenvio não
  duplica) + banner "N baixas aguardando sinal".

## Stack
- Expo SDK 56 (managed, New Architecture) + React Native 0.85 + React 19.2 + TypeScript
- React Navigation (native stack)
- `expo-secure-store` (tokens no keystore), `axios` (refresh silencioso), `expo-linking`

## Backend que consome
- `POST /api/v1/auth/login` (com `deviceId` → access 15m + refresh 30d deslizante)
- `POST /api/v1/auth/refresh` (renova silenciosamente; o interceptor trata 401)
- `GET /api/v1/logistica/viagens/minhas` (viagens EM_CURSO do motorista)
- `GET /api/v1/logistica/viagens/:id` (paradas + entregas)
- `POST /api/v1/logistica/entregas/:id/baixar` (multipart `prova` + resultado/
  motivo/geo/`idempotencyKey`; idempotente — entrega terminal = no-op)

Role necessária: **ENTREGADOR** (módulo LOGISTICA). Conta de teste em DEV:
`entregador_teste` / `Entrega123`.

## Rodar (DEV)
1. `cd logistica/app && npm install`
2. Reconciliar libs nativas do Expo: `npx expo install --fix`
3. **Apontar a API**: o celular NÃO alcança `localhost`. Em DEV use o listener
   **HTTP :8085** (o Android rejeita o cert self-signed do 443; o 8085 é um
   server nginx só-DEV com auth+logistica — `nginx/dev/app-http-dev.conf`,
   montado pelo docker-compose.override.yml local):
   - `EXPO_PUBLIC_API_URL=http://<IP-da-LAN>:8085 npx expo start`
   - Em HOM/PROD (cert válido) use HTTPS normal: `EXPO_PUBLIC_API_URL=https://...`
4. **Windows/WSL**: rode o Metro pelo **PowerShell do Windows** (não pelo WSL —
   o `/mnt/c` trava o Metro e a rede NAT do WSL esconde a 8081 do celular).
   `node_modules` instalado pelo Windows (`npm ci`); não rodar npm pelo WSL aqui.
5. Gerar/instalar o **dev build nativo**: `npm run android` (`expo run:android`,
   requer JDK 17 + Android SDK). Sob New Architecture o app usa config nativa
   (background location + foreground service) que o **Expo Go não fornece** — o
   dev build é obrigatório. Depois, o Metro sobe com `npx expo start` e o dev
   client conecta pelo QR. APK de distribuição: `npm run build:apk` (EAS).
6. **Windows — limite de 260 caracteres (MAX_PATH)**: a compilação C++ da New
   Architecture (ninja/CMake) estoura o `MAX_PATH` no caminho longo deste repo
   (`ninja: Filename longer than 260 characters`), porque o ninja 1.10.2 que a
   AGP usa por padrão (CMake 3.22.1) não é `longPathAware`. **Isso já está
   resolvido no repo** pelo config plugin `plugins/withWindowsCmakeVersion.js`,
   que — só no Windows — fixa `cmake.version "4.1.2"` no build do app; o ninja
   1.12.1 desse CMake ignora o 260 (prefixa `\\?\`). Não precisa de `subst`,
   `LongPathsEnabled` nem de mover o repo. **Único pré-requisito**: ter o
   **CMake 4.1.2** instalado (Android Studio → SDK Manager → SDK Tools → CMake;
   a AGP também o instala sozinha no 1º build se ausente). Em Linux/macOS/EAS o
   plugin não faz nada (lá não há MAX_PATH e o CMake padrão funciona).

## Notas
- `deviceId` é gerado uma vez e guardado no SecureStore; o backend amarra a
  sessão a ele (revogação "sair deste aparelho").
- Sessão **30 dias deslizante**: o entregador ativo nunca reloga; o access de
  15m é renovado em background pelo interceptor (refresh single-flight).
- Navegação é por **endereço em texto** (deep-link), sem geocodificação — bairro
  é o sinal (decisão Fase 1b); mapa/OSRM fica pra Fase 1c.
- `android/` e `ios/` não são versionados (managed workflow; `expo prebuild`/EAS gera).
