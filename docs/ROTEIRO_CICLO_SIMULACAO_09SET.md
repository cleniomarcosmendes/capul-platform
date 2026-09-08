# Roteiro — ciclo SIMULACAO 09/09, montado PELA TELA

**Alvo:** DEV · `https://localhost/gestao-pessoas/` · **parar em RASCUNHO**, não abrir.
**Escopo:** 54 pessoas, 2 aplicações, 6 avaliadores com conta, 2 afastados, 3 sem avaliador.

> ⚠️ **Não tocar** no Piloto 15/09/2026, no Avaliação Geral 2026, no ZZ CONFERE 09/09 nem no
> cadastro de avaliadores (as 1.384 linhas). Nada aqui altera `rh.designacao_padrao`.

---

## 0. Antes de começar — por que a ORDEM importa

O cadastro cobre **as 54 pessoas do recorte**: se você rodar *Copiar do cadastro* com o público
inteiro montado, **ninguém fica sem avaliador** e o caso de borda que queremos ver desaparece.

⭐ Por isso a CONTROLADORIA entra no público **depois** da cópia. Não é truque: é o fluxo real de
quem monta um público, roda o lote e só então lembra de um setor. E de quebra exercita a prévia do
público (`entram no público` × `geram avaliação`).

Ordem: **montar → copiar → corrigir à mão → adicionar o que faltou → prévia da abertura.**

---

## 1. Criar o ciclo — `Ciclos` → `Novo ciclo`

| Campo | Valor |
|---|---|
| Nome | `SIMULACAO 09/09` |
| Período | `01/09/2026` a `30/09/2026` |
| Data-base | `15/09/2026` |
| Incluir afastados | **NÃO** ← é o que faz a régua barrar os 2 |

✅ **Checkpoint:** ciclo em **RASCUNHO**, faixa dizendo o que falta para abrir.

---

## 2. Aplicação A — `Aplicações` → `Nova aplicação`

| Campo | Valor |
|---|---|
| Nome | `A — Administrativo` |
| Modelo | **Administrativo** v1 (11 perguntas, 4 grupos) |
| Peso da avaliação | `100` (sem critérios cadastrais — o questionário vale tudo) |
| Critérios | nenhum |

**Público** (atalho por centro de custo, um de cada vez):

| Filial | CC | Descrição | Pessoas |
|---|---|---|---|
| 01 | `11010202` | FISCAL | 8 |
| 01 | `11010205` | RECURSOS HUMANOS | 6 |
| 01 | `11010206` | SEGURANCA E MEDICINA | 3 |
| 18 | `11010206` | SEGURANCA E MEDICINA | 2 |
| 01 | `11010210` | AUDITORIA INTERNA | 3 |

✅ **Checkpoint na prévia do FISCAL:** `8 pessoas entram no público`, **`7 geram avaliação`**, e o
bloco âmbar nomeando **MARIA APARECIDA BURIL (001297)** como barrada pela régua.
✅ **Público de A ao final: 22.**

---

## 3. Aplicação B — `Aplicações` → `Nova aplicação`

| Campo | Valor |
|---|---|
| Nome | `B — Produção e Indústria` |
| Modelo | **Produção e Indústria** v1 (14 perguntas, 7 grupos) |
| Peso da avaliação | `100` |
| Critérios | nenhum |

**Público — SEM a Controladoria** (ela entra no passo 6):

| Filial | CC | Descrição | Pessoas |
|---|---|---|---|
| 01 | `11010201` | CONTABILIDADE | 7 |
| 01 | `11010219` | DEPARTAMENTO CADASTRO | 7 |
| 01 | `11010207` | FINANCEIRO | 15 |

✅ **Checkpoint na prévia do FINANCEIRO:** `15 entram`, **`14 geram avaliação`**, barrada
**KELIDA MARIANA PINA V TRINDADE (005272)**.
✅ **Público de B neste ponto: 29.** Total no ciclo: **51**.

---

## 4. Copiar do cadastro — `Designação` → `Designar pelo cadastro`

Rodar **a prévia primeiro** (o botão calcula sem gravar).

✅ **Checkpoint da prévia do lote:**
- **49 a criar** (51 no público − 2 barrados pela régua)
- `0 já iguais`, `0 a atualizar`
- Por aplicação: A = `22 ativos no público`, B = `29 ativos no público`
- ⚠️ Conferir que o rótulo diz **"ativos no público"**, não "no público" — foi corrigido em 08/09

Aplicar. ✅ **49 designados.**

⚠️ **O lote designa quem o cadastro manda — e 24 caem em gente SEM CONTA:**

| Avaliador do cadastro | Tem conta? | Quantos | Onde |
|---|---|---|---|
| ESMERALDA (001277) | ❌ | 13 | FINANCEIRO |
| GILBERTO (001121) | ❌ | 6 | CONTABILIDADE |
| JAICLER (001134) | ❌ | 3 | DEPTO. CADASTRO |
| LAIS (002865) | ❌ | 2 | DEPTO. CADASTRO |
| ARIELLY (002448) | ✅ | 13 | RH + SEG (01 e 18) + AUDITORIA |
| VANIA (001086) | ✅ | 6 | FISCAL |
| CLAUDIMAR (001079) | ✅ | 6 | um de cada CC |

Os 24 da metade de cima **não conseguiriam responder** — é o passo 5.

---

## 5. Corrigir à mão — `Designação`, botão **"Trocar avaliador"** na linha

Usar a **seleção em lote** (checkbox + barra) por bloco. É aqui que RENATA e LIDYANE entram.

| De (sem conta) | Para | Quantos | Filtro sugerido |
|---|---|---|---|
| ESMERALDA | **WANDERSON** (002749) | 13 | aplicação B, buscar `FINANCEIRO` |
| GILBERTO | **RENATA** (001981) | 6 | aplicação B, buscar `CONTABILIDADE` |
| JAICLER + LAIS | **LIDYANE** (002336) | 5 | aplicação B, buscar `CADASTRO` |

✅ **Checkpoint no diálogo:** a prévia deve dizer **`N ganham avaliador · N têm o avaliador
SUBSTITUÍDO`**, com a lista "Estas trocam de avaliador" nomeando quem sai. Nenhuma linha deve
pedir confirmação (ninguém respondeu ainda).
⚠️ **Conferir a concordância:** com 1 selecionada tem de ler *"1 tem o avaliador SUBSTITUÍDO"*, não
*"1 têm"* — foi corrigido em 08/09.

✅ **Filas ao final:** ARIELLY 13 · WANDERSON 13 · VANIA 6 · CLAUDIMAR 6 · RENATA 6 · LIDYANE 5.
**Seis avaliadores, todos com conta, todas as filas entre 5 e 15.**

---

## 6. Adicionar a Controladoria — `Aplicações` → B → `Adicionar ao público`

| Filial | CC | Descrição | Pessoas |
|---|---|---|---|
| 01 | `11010211` | CONTROLADORIA | 3 |

São **JULIANA DA SILVA MARQUES (004848)**, **MARCELINO PEDRO DA ROCHA (005373)** e
**TATIANE RODRIGUES B SILVA (005444)** — as três ATIVAS.

⚠️ **NÃO rodar o copiar do cadastro de novo.** É o que cria a pendência.

✅ **Checkpoint:** `3 entram no público`, `3 geram avaliação`, nenhuma barrada.

---

## 7. A prévia da abertura — `Ciclos` → `SIMULACAO 09/09` → **Abrir** (ler e CANCELAR)

⚠️ **Abrir o diálogo, ler, e fechar sem confirmar.** O Clenio decide se abre.

✅ **O que a prévia tem de dizer:**

| Número | Esperado |
|---|---|
| aplicações | **2** |
| no público | **54** |
| designados (serão liberados) | **49** |
| **sem avaliador** | **3** ← Controladoria |
| **fora do ciclo** | **2** ← os 2 afastados |
| aplicações com recorte provisório | **2** |
| problemas que impedem abrir | **nenhum** |

✅ **A linha de estado do ciclo:**
`2 aplicações · 54 no público · 2 fora do ciclo · 3 sem avaliador · 0 de 49 enviadas · 0 apuradas`

⚠️ **Conferir o texto do bloco "fora do ciclo":** tem de ler **"fora do ciclo — pela régua
(afastados, cargo inelegível) ou por decisão do RH"**. Se disser *"fora pela régua do ciclo"* em
negrito, o bundle está velho.

**PARAR AQUI.**

---

## O que este ciclo põe à prova de propósito

- **ARIELLY é RH_ADMIN e está avaliada nele** (CLAUDIMAR a avalia). Ela não pode abrir, editar nem
  recalcular a própria avaliação — é a pergunta do **segundo RH_ADMIN**, parada na lista (A).
  A apuração por ciclo inteiro passa; o ato individual sobre a linha dela é que recusa.
- **VANIA aparece nos dois papéis**: avalia 6 no FISCAL e é avaliada pelo CLAUDIMAR.
- **Os 2 afastados** ficam na lista de Designação **marcados**, nunca filtrados — o total fecha.
- **O caminho manual** (passo 5) é o que traz RENATA (0 vínculos vigentes no cadastro) e
  LIDYANE (1) para dentro sem tocar no cadastro.
