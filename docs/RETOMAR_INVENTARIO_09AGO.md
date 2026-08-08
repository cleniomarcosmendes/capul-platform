# Retomar o Inventário — 09/08/2026

Ponto de parada de 08/08. **10 commits locais nesta onda, 32 não pushados no
total.** Árvore limpa, suítes verdes: **inventário 109 · app 46**.

O que falta é **teste**: nada de hoje rodou em navegador nem em aparelho.

---

## 1. Subir e conferir

```bash
docker compose up -d
# migrations do inventário sobem sozinhas (job inventario-migrate)
# esperado: 43 aplicadas, terminando na 021

cd inventario/backend && ./run-tests.sh     # 109 passed
cd logistica/app && npx jest                # 46 passed
```

⚠️ O **OSRM não sobe** com `up -d` (é profile) — só importa se for mexer em rota
da Logística.

---

## 2. Antes de tudo: o Expo Go

O projeto é **SDK 56** e a Play Store já serve **57** — um 57 recusa o projeto
com *"Project is incompatible with this version of Expo Go"*.

1. Desinstalar o Expo Go atual (não convivem dois).
2. Instalar o APK **56.0.4**: `https://expo.dev/go?sdkVersion=56&platform=android&device=true`
3. Play Store → ficha do Expo Go → ⋮ → **desmarcar "atualização automática"**,
   senão ele volta pro 57 sozinho.

Metro pelo **PowerShell do Windows** (não WSL):

```
cd C:\meus_projetos\capul-platform\logistica\app
npx expo start
```

Não precisa de `EXPO_PUBLIC_API_URL`: em DEV o app pega o host do Metro e aponta
pro `:8085`, que agora proxia o inventário.

---

## 3. O roteiro de teste

### 3.1 Desktop — montar o cenário
Ainda **não existe nenhum inventário** (`inventory_lists = 0`). Criar:

1. **Novo inventário** no armazém **06** (ou 02).
2. **Adicionar produtos** — inclua de propósito **pelo menos um com controle de
   lote** (`b1_rastro = 'L'`; são 2.495 dos 32.820). Sem isso metade do que foi
   feito hoje não é exercitada.
3. **Criar lista de contagem** e atribuir a **jordana** ou **juliocesar**
   (OPERATOR, filial 01). Os dois já aparecem em "usuários disponíveis".
4. **Liberar** a lista.

### 3.2 Desktop — o que mudou hoje
- Abrir o **modal de lote** como **admin** (staff): deve mostrar "Saldo Sistema",
  "Sistema" e as diferenças.
- Abrir o **mesmo modal como OPERATOR**: **não pode** mostrar saldo nem diferença
  — e **não pode quebrar**. Era o que aconteceria antes de `a9b410cb`.
- **"+ Informar outro lote"**: acrescenta linha com número na mão, marcada
  "fora da lista". Salvar sem número deve ficar bloqueado.
- **Salvar** só habilita com **todos** os lotes preenchidos (0 vale).
- A **validade** aparece ao lado do lote do fornecedor.

### 3.3 App — o ciclo que importa
> baixar a lista → **modo avião** → contar → voltar o sinal → sincronizar

- **Três estados por item**: não contado (—) · pendente (âmbar) · sincronizado
  (verde ✓). ⭐ Depois de sincronizar o número **tem que continuar na tela** e o
  progresso **não pode voltar** — era o defeito original.
- **Produto com lote** abre a tela de lotes (não aceita quantidade única).
  Conferir: total é a soma, campo vazio bloqueia, "informar outro lote" funciona.
- **Cabeçalho**: armazém e ciclo.
- **Localização** ao lado do código.
- **Liberar para supervisor**: confirmar que diz quantos itens virarão zero, e
  que depois a lista aparece como **AGUARDANDO_REVISAO** no desktop.
- **Sair** (antes "Encerrar"): a lista **continua** em contagem.

### 3.4 Os casos de conflito
- Baixar no app e tentar contar a MESMA lista no desktop → deve avisar.
- Supervisor clica "liberar" no selo da lista → o app recusa a sincronização.
- Tentar liberar com contagem pendente no aparelho → **deve abortar** (o handoff
  zeraria os itens e o trabalho se perderia).

---

## 4. O que NÃO foi testado e pode falhar

- Tudo do item 3 — nenhuma linha rodou fora dos testes automatizados.
- O **snapshot com validade** (migration 021) só vale para inventário criado a
  partir de agora. Como não há nenhum, não há o que remediar.
- **Produto rastreado cujos lotes estão todos vencidos** agora **bloqueia** a
  contagem (`PRODUTO_SEM_LOTE_VALIDO`) — a saída é o "informar outro lote".
  Difícil de reproduzir com os dados atuais (só 21 lotes vencidos).

---

## 5. Backlog do módulo (não tocado hoje, e importante)

1. **`POST /inventory/process-discrepancies`** relê o saldo **ao vivo** do
   SB2010/SB8010 e **sobrescreve** o `expected_quantity` congelado — destrói o
   snapshot. A tela não chama, mas o endpoint responde a qualquer token ADMIN. E
   consulta o SB2010 **sem filtro de filial/armazém** (`.first()`), podendo pegar
   o saldo do armazém errado.
2. **`InventoryService.update_inventory_items_quantities`** — `UPDATE ... SET
   expected_quantity = sb2.b2_qatu` para o inventário inteiro. Código morto e
   hoje inerte (junta com `inventario.products`, vazia), mas pronto para ser
   ligado por engano.
3. Credencial do Protheus no histórico do git — rotação depende do Marco.

O Clenio já sinalizou que (1) e (2) precisam ser resolvidos antes de o módulo
valer dinheiro de verdade.

---

## 6. Deploy

Segue pendente e agora carrega **duas migrations novas** (020 e 021) além das de
07/08. HLG/PROD provavelmente têm as três tabelas de identidade vazias
(`stores`/`users`/`user_stores`) — a **020** resolve, aplicada pelo job
`inventario-migrate` no startup.

⚠️ HLG/PROD precisam de `PROTHEUS_API_AUTH` e `PROTHEUS_INVENTARIO_AUTH` no
`.env` **antes** de subir — o compose aborta sem elas, de propósito.
