# Plano de atualização da PRODUÇÃO

*27/08/2026. Não é roteiro de execução — é a decisão de **em quantas vezes** e **em que
ordem** tirar a produção de onde ela está.*

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

## 2. As duas ondas

### Onda 1 — `4daf094` → `b7f8bf2f` · **pronta há 16 dias**

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

### Onda 2 — `b7f8bf2f` → `fba71ad8` · **ainda não validada**

| | |
|---|---|
| Commits | **57** |
| Migrations | **4** (`20260820120000` NF/centro de custo · `20260825120000` e `...140000` textos de papel · `20260826120000` `chamado_referencias`) |
| Roteiro | Existe só para HLG (`...20260826...`); o de PROD **ainda não foi escrito** |
| `/security-review` | ✅ da parte final (27/08); ⚠️ o escopo completo `b7f8bf2f`→alvo ainda não |
| Validado em HLG | ❌ **não** — a HLG está em `38fc8053` |

Leva o app offline, a identidade de build, a onda do Workspace (papel por departamento) e
os ajustes de chamado/entregas desta semana.

---

## 3. A recomendação: **duas subidas, nesta ordem**

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

## 4. Sequência sugerida

| # | Passo | Quem | Pré-requisito |
|---|---|---|---|
| 1 | **PROD ← Onda 1** (roteiro de 11/08) | Douglas | nenhum — está pronto |
| 2 | HLG ← onda atual (roteiro de 26/08) | Douglas/Clenio | push feito ✅ |
| 3 | Validar em HLG (§7, duas contas) | Clenio | passo 2 |
| 4 | `/security-review` escopo `b7f8bf2f`→alvo | — | passo 3 |
| 5 | Decidir `OVERSIGHT_PLATAFORMA` | Clenio | passo 3 |
| 6 | **Escrever o roteiro de PROD da Onda 2** | — | passos 3–5 |
| 7 | **PROD ← Onda 2** | Douglas | passo 6 |

Os passos 1 e 2 são **independentes** e podem correr no mesmo dia: um mexe em produção
com código de 11/08, o outro em homologação com código de 27/08.

---

## 5. O que este plano NÃO resolve

- **`M scripts/build-com-versao.sh` na HLG** — alteração feita direto no servidor, ainda
  sem `git diff`. Enquanto não voltar ao repositório, a HLG seguirá marcada `-sujo`.
- **Rotação da credencial do Protheus** e das 4 senhas do histórico do git — pendência de
  segurança que atravessa as duas ondas.
- **Verificação de ESTADO** (rotas anônimas × `location` do nginx) para a Onda 2.
