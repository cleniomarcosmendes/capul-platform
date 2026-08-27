# Plano de atualização da PRODUÇÃO

*27/08/2026. Não é roteiro de execução — é a decisão de **em quantas vezes** e **em que
ordem** tirar a produção de onde ela está.*

> ### ✅ DECIDIDO (27/08, Clenio + Douglas + Marco): **subida ÚNICA**
> A HLG será **recriada idêntica à PRODUÇÃO** e o deploy passa a ser um só —
> `4daf094` → `fba71ad8`, pelo
> **`C:\Arquivos-de-projeto\PlatformCapul_20260827_Roteiro_Deploy_UNIFICADO.md`**.
>
> Isto responde à objeção que este plano levantava contra juntar tudo. A ressalva era
> que 17 migrations subiriam **sem nunca terem rodado juntas sobre dados reais**;
> recriar a homologação a partir da produção elimina exatamente isso — o ensaio passa a
> ser fiel, e a bateria de testes valida o conjunto, não os pedaços. As duas ondas
> descritas abaixo viram **conteúdo** do roteiro único, não subidas separadas.

---

## 1. Onde a produção está

| | |
|---|---|
| **PROD roda** | **`4daf094`** |
| Último roteiro aplicado | `C:\Arquivos-de-projeto\bkp\PlatformCapul_20260803_Roteiro_Deploy.md` (era `...20260801...`, renomeado) — 382 commits sobre `475298b`, 31 migrations |
| Desde então | **24 dias** e **196 commits** parados |

A homologação, no mesmo período, foi atualizada **quatro vezes** e hoje está em
`38fc8053`. Ou seja: o que separa PROD de HLG não é código não testado — é código
testado que nunca subiu.

---

## 2. Onda ≠ roteiro — o mapa

**"Onda" é recorte de PRODUÇÃO; os roteiros que geramos são de HOMOLOGAÇÃO.** Os dois não
são a mesma coisa, e confundir isso é o que faria alguém entregar um roteiro de HLG ao
Douglas.

| Roteiro gerado | Intervalo | Commits | Migrations | Ambiente | Situação |
|---|---|---|---|---|---|
| `...20260811_Roteiro_Deploy.md` | `4daf094` → `b7f8bf2f` | 139 | 13 | **PROD** (e HLG) | ✅ HLG · 📋 **PROD pendente** |
| `...20260819_..._HLG_Incremental.md` | `b7f8bf2f` → `e101ec74` | 12 | 0 | HLG | ✅ aplicado |
| `...20260824_..._HLG_Incremental.md` | `e101ec74` → `95fd5a49` | 21 | 1 | HLG | ✅ aplicado |
| `...20260824b_..._HLG_Incremental.md` | `95fd5a49` → `38fc8053` | 4 | 0 | HLG | ✅ aplicado (§0–§8) |
| `...20260826_..._HLG_Incremental.md` | `38fc8053` → `fba71ad8` | 20 | 3 | HLG | 📋 **pendente** |

Lendo a tabela:

- **Onda 1 de PROD = exatamente um roteiro** — o de 11/08. Ele nasceu como roteiro de
  produção (destinatário: Douglas) e foi usado também para levar a HLG até `b7f8bf2f`.
  Está pronto, é só executar.
- **Onda 2 de PROD = a SOMA dos quatro roteiros de HLG** (19/08 + 24/08 + 24b + 26/08),
  que juntos levam de `b7f8bf2f` a `fba71ad8`: 12 + 21 + 4 + 20 = **57 commits** e
  0 + 1 + 0 + 3 = **4 migrations**.

⚠️ **Os quatro roteiros de HLG NÃO servem para produção**, por três motivos concretos:
cada um parte de uma base diferente (encadeados, e o §0 de cada um confere um HEAD que
PROD não tem); tratam do app por **OTA no canal `homolog`**; e trazem verificações
escritas para a HLG. Por isso o passo 6 da sequência é **escrever um roteiro de PROD para
a Onda 2** — um documento novo, consolidando os quatro num só delta `b7f8bf2f`→alvo, com
a ordem de migrations e o smoke pensados para produção.

---

## 3. As duas ondas

### Onda 1 — `4daf094` → `b7f8bf2f` · **pronta há 16 dias** *(= roteiro de 11/08)*

| | |
|---|---|
| Commits | **139** |
| Migrations | **4 Prisma** (logística ×3, fiscal ×1) + **8 SQL do Inventário** (`014`–`021`) |
| Roteiro | `C:\Arquivos-de-projeto\PlatformCapul_20260811_Roteiro_Deploy.md` — completo, com conferência pós-migration |
| `/security-review` | ✅ **executado em 15/08** no escopo `4daf094`→alvo + verificação de ESTADO; 5 achados, todos corrigidos |
| Validado em HLG | ✅ sim — a HLG passou por este ponto em 17/08 |
| App | 🔴 **APK novo** (módulo nativo de 14/08) |

O que ela leva, em uma frase por assunto: app do entregador com prova de entrega, rota
em ciclo, aprendizado de endereço por GPS, RDV com as 6 regras de integridade, âncora de
identidade do Inventário (a regressão de 5 meses), e o **freio do 656 do Fiscal** — que
hoje **não está em produção**, e é proteção contra bloqueio do CNPJ da CAPUL no SEFAZ.

> ⚠️ Duas migrations desta onda **mexem em dado existente** e têm conferência própria no
> roteiro: a `020` do Inventário (âncora de identidade) e a `20260811190000` da Logística
> (backfill de coordenadas).

### Onda 2 — `b7f8bf2f` → `fba71ad8` · **ainda não validada** *(= os 4 roteiros de HLG somados)*

| | |
|---|---|
| Commits | **57** |
| Migrations | **4** (`20260820120000` NF/centro de custo · `20260825120000` e `...140000` textos de papel · `20260826120000` `chamado_referencias`) |
| Roteiro | Os 4 de HLG cobrem o conteúdo; **o de PROD ainda não foi escrito** (passo 6) |
| `/security-review` | ✅ da parte final (27/08); ⚠️ o escopo completo `b7f8bf2f`→alvo ainda não |
| Validado em HLG | ❌ **não** — a HLG está em `38fc8053` |

Leva o app offline, a identidade de build, a onda do Workspace (papel por departamento) e
os ajustes de chamado/entregas desta semana.

---

## 4. A recomendação: **duas subidas, nesta ordem**

**Primeiro a Onda 1, sozinha.** Ela está pronta, validada e com o gate de segurança
feito; o único motivo de não estar em produção é fila. Adiar de novo não a torna mais
segura — torna a Onda 2 mais cara.

**Depois a Onda 2**, e só quando estas três coisas acontecerem:
1. a HLG aplicar o roteiro de 26/08 e validar (inclusive os itens que precisam de **duas
   contas**, no §7 de lá);
2. rodar `/security-review` no escopo `b7f8bf2f`→alvo — o de 27/08 cobriu a ponta final,
   não a onda inteira;
3. **decidir quem recebe `OVERSIGHT_PLATAFORMA`** — depois desta onda, quem é do T.I.
   deixa de ter alcance automático sobre outros departamentos.

### Por que não juntar tudo numa subida só

É tentador: 196 commits, uma janela, um só domingo. Mas seriam **16 migrations**, quatro
delas mexendo em dado, em quatro schemas diferentes. Se algo sair errado, a pergunta "o
que causou?" não tem resposta possível dentro da janela — e o rollback de uma onda com
backfill não é `git checkout`. As duas ondas já existem separadas, cada uma com o seu
roteiro e o seu gate; juntá-las joga fora esse trabalho.

### O risco de continuar adiando

A fila cresceu de 139 para **196 commits** enquanto a Onda 1 esperava. Cada semana torna
a decisão de "juntar tudo" mais atraente e mais perigosa — que é exatamente o caminho que
este plano recomenda não seguir. **Se há algo travando o deploy do lado da infra, é isso
que precisa ser destravado primeiro**, antes de qualquer código novo.

---

## 5. Sequência sugerida

| # | Passo | Quem | Pré-requisito |
|---|---|---|---|
| 1 | **PROD ← Onda 1** (roteiro de 11/08) | Douglas | nenhum — está pronto |
| 2 | HLG ← onda atual (roteiro de 26/08) | Douglas/Clenio | push feito ✅ |
| 3 | Validar em HLG (§7, duas contas) | Clenio | passo 2 |
| 4 | `/security-review` escopo `b7f8bf2f`→alvo | — | passo 3 |
| 5 | Decidir `OVERSIGHT_PLATAFORMA` | Clenio | passo 3 |
| 6 | **Escrever o roteiro de PROD da Onda 2** (consolida os 4 de HLG num delta só) | — | passos 3–5 |
| 7 | **PROD ← Onda 2** | Douglas | passo 6 |

Os passos 1 e 2 são **independentes** e podem correr no mesmo dia: um mexe em produção
com código de 11/08, o outro em homologação com código de 27/08.

---

## 6. O que este plano NÃO resolve

- **`M scripts/build-com-versao.sh` na HLG** — alteração feita direto no servidor, ainda
  sem `git diff`. Enquanto não voltar ao repositório, a HLG seguirá marcada `-sujo`.
- **Rotação da credencial do Protheus** e das 4 senhas do histórico do git — pendência de
  segurança que atravessa as duas ondas.
- **Verificação de ESTADO** (rotas anônimas × `location` do nginx) para a Onda 2.
