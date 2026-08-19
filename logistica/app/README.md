# CAPUL Entregas — App do Entregador (Fase 1b)

App **Android** (Expo / React Native) do entregador.
- **PR 1b.5**: login por device-session + lista "minhas viagens" + detalhe com
  navegação (Waze/Maps) e ligação.
- **PR 1b.6**: baixa com prova — foto obrigatória (ENTREGUE), motivo (NÃO
  ENTREGUE), GPS por evento (best-effort, 6s), **fila offline** (sem sinal a
  baixa fica no aparelho e reenvia sozinha; `idempotencyKey` fixa = reenvio não
  duplica) + banner "N baixas aguardando sinal".

## Offline — como o app se comporta sem sinal

Regra do app: **a rede ATUALIZA a tela; ela não é condição para a tela existir.**
O entregador de Unaí roda zona rural, e sem sinal é modo normal de trabalho, não
uma exceção. São três mecanismos, e vale saber qual é qual ao mexer aqui:

| Mecanismo | Onde | O que faz |
|---|---|---|
| **Filas de escrita** (`offline/fila*.ts`) | baixa, despesa, KM, frota, RDV, contagem | guardam o que o usuário PRODUZ e reenviam sozinhas |
| **Cache de leitura** (`offline/cacheLeitura.ts`) | todas as telas | guarda o que ele precisa LER: rotas, paradas, veículos, cadastros |
| **Sessão** (`auth/AuthContext.tsx`) | boot e interceptor | sem rede a sessão CONTINUA; só rejeição do auth-gateway desloga |

Os três decidem pela mesma pergunta, em `lib/erroRede.ts`: **faltou rede** (sem
resposta HTTP) ou **o servidor respondeu e recusou**? Sem rede a fila segura, o
cache serve o disco e a sessão continua. Com recusa do servidor, o erro sobe — a
tela não pode esconder um 403 atrás de dado velho e mostrar uma rota que já não é
daquele motorista.

O que o usuário vê quando está no cache: a faixa cinza
`📴 Sem sinal — dados do aparelho, de HH:MM` (`components/FaixaOffline.tsx`).
Trabalhar offline não pode ser mudo: sem ela, dado velho e dado ao vivo têm a
mesma cara.

**O que já foi feito no aparelho tem de APARECER na tela.** O status vem do
servidor, que offline não recebeu nada — então cada tela cruza o que veio de lá
com a própria fila: `baixasNaFilaPorEntrega` (entrega), `paradasNaFilaFrota` e
`retornosNaFilaFrota` (frota), `visitasNaFilaSupervisor` (RDV). Sem esse
cruzamento a ação parece não ter pegado, e o usuário a repete.

**A única coisa que ainda exige rede é a SAÍDA de veículo**, de propósito: no
login PADRÃO ela valida a senha do condutor no Protheus em tempo real, e é ela
que RESERVA o veículo — dois condutores offline poderiam sair com o mesmo carro
e só descobrir na sincronização. O RETORNO vai para a fila, carimbado com a hora
real da chegada.

Os cadastros de apoio (tipos de despesa, fornecedores, locais, atividades) são
puxados no lançador (`offline/aquecerCache.ts`), ainda no pátio: o cache só se
enche com rede, e quem abre a tela de despesa pela primeira vez costuma ser
quem já está no posto, sem sinal.

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
   Architecture (ninja/CMake) estoura o `MAX_PATH` no caminho longo deste repo,
   porque o ninja 1.10.2 que a AGP usa por padrão (CMake 3.22.1) não é
   `longPathAware` — no módulo `app` como `Filename longer than 260 characters`
   e nos módulos autolinkados (react-native-screens etc.) como
   `manifest 'build.ninja' still dirty after 100 tries`. **Isso já está
   resolvido no repo** pelo config plugin `plugins/withWindowsCmakeVersion.js`,
   que — só no Windows — injeta um `subprojects {}` no `build.gradle` raiz
   fixando `cmake.version "4.1.2"` em **todos** os módulos nativos (app +
   autolinkados); o ninja 1.12.1 desse CMake ignora o 260 (prefixa `\\?\`). Não
   precisa de `subst`, `LongPathsEnabled` nem de mover o repo. **Único
   pré-requisito**: ter o **CMake 4.1.2** instalado (Android Studio → SDK
   Manager → SDK Tools → CMake; a AGP também o instala sozinha no 1º build se
   ausente). Em Linux/macOS/EAS o plugin não faz nada (lá não há MAX_PATH e o
   CMake padrão funciona). Validado em debug (`run:android`) e release
   (`assembleRelease`, todas as ABIs).

## Notas
- `deviceId` é gerado uma vez e guardado no SecureStore; o backend amarra a
  sessão a ele (revogação "sair deste aparelho").
- Sessão **30 dias deslizante**: o entregador ativo nunca reloga; o access de
  15m é renovado em background pelo interceptor (refresh single-flight).
- Navegação é por **endereço em texto** (deep-link), sem geocodificação — bairro
  é o sinal (decisão Fase 1b); mapa/OSRM fica pra Fase 1c.
- `android/` e `ios/` não são versionados (managed workflow; `expo prebuild`/EAS gera).
