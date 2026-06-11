# CAPUL Entregas — App do Entregador (Fase 1b)

App **Android** (Expo / React Native) do entregador.
- **PR 1b.5**: login por device-session + lista "minhas viagens" + detalhe com
  navegação (Waze/Maps) e ligação.
- **PR 1b.6**: baixa com prova — foto obrigatória (ENTREGUE), motivo (NÃO
  ENTREGUE), GPS por evento (best-effort, 6s), **fila offline** (sem sinal a
  baixa fica no aparelho e reenvia sozinha; `idempotencyKey` fixa = reenvio não
  duplica) + banner "N baixas aguardando sinal".

## Stack
- Expo SDK 52 (managed) + React Native 0.76 + TypeScript
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
