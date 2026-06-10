# CAPUL Entregas — App do Entregador (Fase 1b)

App **Android** (Expo / React Native) do entregador. PR **1b.5**: login por
device-session + lista "minhas viagens" + detalhe com navegação (Waze/Maps) e
ligação. A captura de prova/baixa (foto/assinatura/GPS + fila offline) é o
**PR 1b.6** (próximo).

## Stack
- Expo SDK 52 (managed) + React Native 0.76 + TypeScript
- React Navigation (native stack)
- `expo-secure-store` (tokens no keystore), `axios` (refresh silencioso), `expo-linking`

## Backend que consome
- `POST /api/v1/auth/login` (com `deviceId` → access 15m + refresh 30d deslizante)
- `POST /api/v1/auth/refresh` (renova silenciosamente; o interceptor trata 401)
- `GET /api/v1/logistica/viagens/minhas` (viagens EM_CURSO do motorista)
- `GET /api/v1/logistica/viagens/:id` (paradas + entregas)

Role necessária: **ENTREGADOR** (módulo LOGISTICA). Conta de teste em DEV:
`entregador_teste` / `Entrega123`.

## Rodar (DEV)
1. `cd logistica/app && npm install`
2. Reconciliar libs nativas do Expo: `npx expo install --fix`
3. **Apontar a API**: o celular NÃO alcança `localhost`. Use o IP da LAN da
   máquina que roda o nginx:
   - `EXPO_PUBLIC_API_URL=https://192.168.x.x npx expo start`
   - ou edite `app.json` → `expo.extra.apiUrl`.
   - O certificado é self-signed: em DEV, o jeito limpo é apontar pro **HOM/PROD**
     (cert válido) ou usar um túnel. (Android não confia em self-signed por padrão.)
4. Abrir no **Expo Go** (Android) lendo o QR, ou gerar APK: `npm run build:apk` (EAS).

## Notas
- `deviceId` é gerado uma vez e guardado no SecureStore; o backend amarra a
  sessão a ele (revogação "sair deste aparelho").
- Sessão **30 dias deslizante**: o entregador ativo nunca reloga; o access de
  15m é renovado em background pelo interceptor (refresh single-flight).
- Navegação é por **endereço em texto** (deep-link), sem geocodificação — bairro
  é o sinal (decisão Fase 1b); mapa/OSRM fica pra Fase 1c.
- `android/` e `ios/` não são versionados (managed workflow; `expo prebuild`/EAS gera).
