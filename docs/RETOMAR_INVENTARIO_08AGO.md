# Retomar o Inventário — 08/08/2026

*Substitui a versão anterior deste arquivo, de 07/08.*

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

---

## Achados do teste de Chrome (08/08, Clenio)

Seções 1 a 3 executadas. Duas correções já feitas (`fb7883e8`) e **dois itens em
aberto**, mais um esclarecimento de regra.

### ✅ Corrigido durante o teste
- **Validade do lote não aparecia** — os 5 ramos de mapeamento da resposta para
  `LotRow` descartavam `expiry_date`. O campo existia no tipo e o render lia;
  faltava o meio. Diagnosticado comparando tela × API.
- **Roteiro pedia o impossível**: supervisor abrindo o modal de lote na lista de
  outro. Ninguém conta pela lista alheia, nem ADMIN — regra de auditoria
  correta. O cenário passou a criar a "Lista clenio".

### 🟡 EM ABERTO 1 — "Erro inesperado" que na verdade deu certo
Adicionar ~6.200 produtos de uma vez: ~10s, tela mostrou **"Erro inesperado ao
adicionar produtos"**, mas os itens **foram adicionados**. Mensagem mente sobre o
resultado, e o supervisor pode repetir a operação achando que falhou.

Não reproduzido depois, porque no estado atual um guard anterior responde antes
(409 "existe lista de contagem já liberada"). **Para reproduzir**: inventário
novo, nenhuma lista liberada, e adicionar alguns milhares de produtos.
Suspeita: o payload de resposta (arrays `duplicates`/`errors` por item) fica
grande e algo estoura no meio — o `add-products` monta a resposta item a item.

### 🟡 EM ABERTO 2 — toast não aparece ao liberar ciclo sem contador
Backend recusa certo (400, `detail` como **string**: "Lista não tem contador
atribuído para o ciclo 2"). A tela não mostra nada.

⚠️ Investigado e **não explicado**: `handleLiberarConfirmed`
(`InventarioDetalhePage.tsx:959`) tem `catch` com `toast.error(detail || ...)`,
o interceptor do axios só intercepta 401, e o ToastContext mostra erro por 4s.
É o **único** ponto do código que chama `liberar()`. Falta um dado: ver no
DevTools se o 400 realmente chega ao `catch` (breakpoint) ou se o clique nem
alcança essa função naquele estado de lista.

### ℹ️ Não é defeito — teto de 3.000
O teto é **por LISTA DE CONTAGEM**, não por inventário, e existe por causa do
aplicativo. Bloqueia o **checkout no app** (`LISTA_ACIMA_DO_TETO`); no desktop é
**só aviso, de propósito** — está no código: *"a operação não pode ficar travada
por uma regra que existe por causa do celular"*.

O aviso existe e está no lugar certo: `AtribuirProdutosModal` (ao montar a lista)
e o selo "acima do teto" em `InventarioDetalhePage`. Adicionar produtos ao
INVENTÁRIO não tem teto — o roteiro é que apontava para o lugar errado, já
corrigido.

---

## Estado ao fim de 08/08 (tarde) — depois dos testes de tela

Seções 1 a 4 do roteiro de Chrome executadas pelo Clenio. **5 correções** saíram
do teste; 3 itens seguem em aberto.

### ✅ Corrigido a partir do que o teste achou
| Achado | Commit |
|---|---|
| Validade do lote não chegava na tela (5 ramos de mapeamento descartavam) | `fb7883e8` |
| Produto sem lote no recorte ficava **sem saída** no desktop | `5bab54b5` |
| **Crash** `toFixed` de undefined na tela de contagem do OPERATOR | `3d3aa2c9` |
| "Acesso negado" contraditório para quem já entregou a própria lista | `3d3aa2c9` |
| App: sincronizou e não dava para saber + devolução parcial invisível | `4dbc0929` |

### ✅ Confirmado em tela pelo Clenio
RBAC do operador (menu, abas, URL direta) · modal de lote nas duas visões ·
"informar outro lote" no **desktop** · fluxo do supervisor inteiro (devolver
parcial, avançar ciclo, encerrar) · 5 divergências no `SMOKE_09AGO` ·
produto com lote no **app** (identificação e digitação) · situação do
sincronismo no app.

### 🟡 EM ABERTO
1. **"Erro inesperado" que na verdade deu certo** (add-products em massa) — o
   mais sério: a mensagem mente sobre o resultado. Repro: inventário novo, sem
   lista liberada, alguns milhares de produtos.
2. **Toast ausente** ao liberar ciclo sem contador — código correto de ponta a
   ponta; falta breakpoint no `catch` (`InventarioDetalhePage.tsx:959`).
3. **`system_qty` deveria ser opcional no tipo** — a correção durável do crash.
   O TS aponta 20+ pontos, quase todos em telas só-de-supervisor. Onda própria.

### ⏳ Não testado no APP
"Informar outro lote" (use o **`00010093`**) · ciclo com **modo avião** ·
badge **REVISAR** da devolução parcial (feito hoje, nunca visto em tela) ·
"Liberar para supervisor" abortando com pendência.

---

## Sessão de 08/08 — encerramento (fim da tarde)

Mais **6 correções** depois do bloco anterior, quase todas vindas do Clenio
testando no aparelho e na tela.

| Achado (quem viu) | Commit |
|---|---|
| Devolução parcial mostrava a lista TODA e deixava editar o aprovado | `9caa22fb` |
| Teclado aberto deixava **uma linha** de lista — digitar no escuro | `db8f1a2f` |
| Tela do inventário levava **19s** (N+1 no `/items`) → 2s | `3b40ffc6` |
| Não dava para apagar o último dígito da contagem | `b32e6ada` |
| **Marca de REVISÃO do ciclo 1 atravessava para o ciclo 2** | `9f80f7da` |
| Usuário logado na Home + teclado na tela de lote | `fc5de0de` |

⚠️ **`9f80f7da` vale para o DESKTOP também** — é correção de backend, e o
desktop usa a mesma lógica de `partialReviewMode`. Ele mostrava o mesmo erro.

⚠️ Os resíduos de flag nas listas que **já** tinham avançado foram limpos à mão
(2 itens em 5 listas). A correção não retroage.

### O padrão que apareceu DUAS vezes hoje
**A correção existia, mas o caminho usado não passava por ela.** O handler de
lote duplicado (`inventory_lots.py` sombreado) e o `sync_cycle_between_tables`
(corrigido em 09/05, nunca alcançado pelo `finalize-cycle`). Nos dois, o sintoma
reapareceu meses depois. É o argumento mais forte a favor do smoke de ciclo —
que percorre o caminho real.
➡️ **Pendência**: o smoke passa pelo `finalize-cycle` 2× e **não pegou** a flag.
Acrescentar essa verificação (o teste unitário cobre o SQL, não prova que o
endpoint o executa).

### ⏳ Não testado no APP
- **"Informar outro lote"** — usar o `00010093`. ⚠️ A linha vive no
  `ListFooterComponent` e re-renderiza a cada tecla: **se o foco pular fora a
  cada dígito, é ali**.
- **Modo avião** (o ciclo que dá sentido a tudo) · **liberar abortando com
  pendência** · **devolução total** (a parcial já foi) · **teclado** (`db8f1a2f`
  e `fc5de0de`, nenhum validado em tela).

### 🟡 Seguem em aberto (web)
1. "Erro inesperado" que na verdade deu certo (add-products em massa).
2. Toast ausente ao liberar ciclo sem contador.
3. `system_qty` opcional no tipo — a correção durável do crash (20+ pontos).
