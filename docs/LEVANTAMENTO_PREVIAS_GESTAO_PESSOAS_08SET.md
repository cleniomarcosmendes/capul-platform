# Levantamento — as CINCO prévias do Gestão de Pessoas

**08/09/2026** · pedido no item 7 da conferência de tela · **levantamento, nada foi unificado**

> O pedido: *"Não estime nem unifique antes disso. Me devolva o levantamento e eu decido."*
> Este documento responde (a) os cinco payloads lado a lado, (b) se `EXIGE_CONFIRMACAO` é função
> pura, (c) se `copiar-do-cadastro` compartilha o classificador, (d) em quantos módulos elas moram.
> Duas correções ao enunciado e **dois achados novos** estão marcados com ⚠️.

---

## (d) Onde moram — QUATRO módulos, confirmado

| # | Endpoint | Módulo | Serviço |
|---|---|---|---|
| 1 | `POST /designacao/ciclo/:id/copiar-do-cadastro` (`aplicar:false`) | `designacao` | `DesignacaoService.copiarDoCadastro` |
| 2 | `POST /designacao/aplicacao/:id/designar/previa` | `designacao` | `DesignacaoService.previaDaDesignacao` |
| 3 | `POST /aplicacoes/:id/publico/previa` | `aplicacao` | `AplicacaoService.previaDoPublico` |
| 4 | `POST /designacao-padrao/importacao/previa` | `designacao-padrao` | `DesignacaoPadraoService.previaDaImportacao` |
| 5 | `GET /painel/ciclo/:id/previa-da-abertura` | `painel` | `PainelService.previaDaAbertura` |

Os prefixos diziam quatro e são quatro. **1 e 2 são o mesmo módulo e o mesmo serviço** — e são,
apesar disso, as duas que mais divergem de vocabulário. Não é distância de código; é ausência de
decisão sobre a palavra.

---

## (a) Os cinco payloads, campo a campo

### 1. `copiar-do-cadastro` — `RelatorioDaCopia`
`cicloId` · `aplicado` (false = prévia) · `substituirManuais` ·
**`criar`** · **`atualizar`** · **`jaIguais`** · `deDivisaoNaoRevisada` ·
`naoAplicadas[]` {colaboradorId, nome, matricula, centroCusto, **`motivo`**, detalhe} ·
`porMotivo` {motivo → n} ·
`porAplicacao[]` {aplicacaoId, nome, **`publico`**, criar, atualizar, jaIguais, semAvaliador, naoAplicadas} ·
`avisos[]` · `duracaoMs?`

`motivo` ∈ `SEM_AVALIADOR_NO_CADASTRO` · `SEM_CADASTRO_JA_DESIGNADA` · `AJUSTE_MANUAL_DO_CICLO` ·
**`JA_RESPONDIDA`** · `TROCA_DE_APLICACAO`

### 2. `designar/previa`
`avaliadorNome` · **`total`** ·
**`criar`** · **`substituir`** · **`nadaAFazer`** · `recusar` · **`exigeConfirmacao`** *(acrescentado hoje)* ·
`avisoDeRespondidas` ·
`linhas[]` {colaboradorId, nome, matricula, **`acao`**, avaliadorAtual, estadoAtual, frase}

`acao` ∈ `CRIAR` · `SUBSTITUIR` · `NADA_A_FAZER` · **`EXIGE_CONFIRMACAO`** · `RECUSAR`

### 3. `publico/previa`
`aplicacaoId` · `aplicacaoNome` ·
**`encontradas`** · **`adicionar`** · **`jaNesta`** ·
`emOutraAplicacao[]` {colaboradorId, nome, matricula, aplicacao} ·
**`geramAvaliacao`** · `barradosPelaRegua[]` {colaboradorId, nome, matricula, justificativa} ·
`amostra[]` {nome, matricula, area}

### 4. `designacao-padrao/importacao/previa` — `Previa & { conferencia }`
`linhasNoArquivo` · `linhasSemAvaliador` ·
`centrosCusto[]` {chave, descricao, pessoas, divisao[], porDivisaoAutomatica} ·
`pares` {**`total`**, **`novos`**, **`inalterados`**, **`substituira`**, porDivisaoAutomatica} ·
`conflitosComAjusteManual[]` · `recusas[]` · `avisos[]` · `conferencia`

### 5. `painel/previa-da-abertura`
`problemas[]` · `totalAplicacoes` · **`noPublico`** · **`designados`** · **`semAvaliador`** ·
**`barradosPelaRegua`** · `aplicacoesProvisorias`

---

## O MESMO FATO, com nomes diferentes

| Fato do domínio | 1 copiar | 2 designar | 4 importação | 3 público | 5 abertura |
|---|---|---|---|---|---|
| não havia → vai criar | `criar` | `criar` | `pares.novos` | — | — |
| havia, outro avaliador → troca | **`atualizar`** | **`substituir`** | **`substituira`** | — | — |
| já é assim → nada muda | **`jaIguais`** | **`nadaAFazer`** | **`inalterados`** | `jaNesta` | — |
| não entra, e o porquê | `naoAplicadas`+`porMotivo` | `recusar` | `recusas` | `barradosPelaRegua` | `barradosPelaRegua` |
| **já respondida, trocaria avaliador** | **`JA_RESPONDIDA` → RECUSA** | **`EXIGE_CONFIRMACAO` → PERMITE** | — | — | — |
| o universo da conta | `porAplicacao.publico` | `total` | `linhasNoArquivo` | `encontradas` | `noPublico` |

**Três palavras para "nada muda". Três para "troca".** E uma linha em que não é só a palavra que
muda: é a **decisão**.

### ⚠️ Correção ao enunciado: o `criar` NÃO colide

O item 7 supunha que `criar` significasse coisas diferentes em 1 e 2 ("criar designação a partir
do cadastro" × "ganhar avaliador"). **Não significa.** Nos dois, `criar` é exatamente *"não existia
`Avaliacao` no ciclo → uma será criada"* — mesmo fato, mesmo objeto, mesma cardinalidade
(`designacao.service.ts:878` e o `conta('CRIAR')` da prévia). É a única palavra dos dois payloads
que já concorda.

**A colisão real está em outro par**, e é a que o item 7 identificou corretamente como
"1036 × 989 outra vez": `publico/previa` conta **duas coisas encadeadas** —
`adicionar` (entra no PÚBLICO) e `geramAvaliacao` (vira AVALIAÇÃO). Quem ler `adicionar` como
"quantas avaliações saem daqui" erra em `barradosPelaRegua`. Os dois objetos — **público** e
**avaliação** — é que precisam de palavras separadas; e é o mesmo eixo do cabeçalho do ciclo
(montado × alcançado) consertado hoje no item 5.

### ⚠️ Uma segunda colisão, não listada: `barradosPelaRegua` diz o que não é

Em `publico/previa` (3), `barradosPelaRegua` é literal — quem `avaliarElegibilidade` barra.
Em `previa-da-abertura` (5), o **mesmo nome** conta `linhas.filter(l => !l.elegivel)`, e `elegivel`
sai de `designacao.listar`, onde **"a decisão manual SOBREPÕE a régua, nos dois sentidos"**
(`designacao.service.ts:243`). Ou seja: em (5) o campo inclui **quem o RH tirou à mão**, que não é
régua nenhuma.

Medido hoje no Piloto: **47 fora do ciclo, `REGRA_CICLO` 47, manual 0**. Os dois sentidos
concordam **por acaso** — ninguém excluiu à mão ainda. Na primeira exclusão manual, o número da
tela de abertura passa a dizer "régua" sobre uma decisão de pessoa. Foi por isso que o campo novo
do resumo do ciclo (item 5) se chama **`foraDoCiclo`**, e não `barradosPelaRegua`.

---

## (b) `EXIGE_CONFIRMACAO` é função PURA — mas a prévia não roda a decisão inteira

`efeitoDeDesignar(atual: AvaliacaoAtual | null, ctx) → EfeitoDaDesignacao` não tem `async`, nem
`await`, nem `prisma` (`designacao/efeito-de-designar.ts`, varrido). **Quem busca o estado é o
chamador**, e são dois: `designar()` (o ato, linha 564) e `previaDaDesignacao()` (linha 1025).
Prévia e ato compartilham o classificador — que era o ponto do desenho, e ele se sustenta.

**⚠️ ACHADO — a classificação não é a decisão toda.** `designar()` roda **mais duas guardas** que
o classificador não conhece e que a prévia **não executa**:

| Guarda | Onde, em `designar()` | A prévia roda? |
|---|---|---|
| autoavaliação (`avaliadoId === avaliadorId`) | linha 544, **antes** do classificador | ❌ não |
| troca de aplicação (`assertPodeTrocarDeAplicacao`) | linha 586, **depois** do classificador | ❌ não |

Verificado hoje contra o Piloto, chamando os dois com o mesmo par:

```
PRÉVIA de autoavaliação → acao: SUBSTITUIR   {substituir: 1, recusar: 0, total: 1}
ATO   (designar)        → RECUSOU: "Ninguém pode ser o avaliador da própria avaliação."
```

**A prévia promete gravar o que o ato recusa** — a mesma família dos itens 1 e 2, agora entre a
prévia e o ato em vez de entre a tela e o servidor. Hoje o estrago é contido: a tela avisa em
texto ("se a pessoa escolhida estiver na seleção, a linha dela é recusada") e `aplicar()` tolera
falha por linha. Mas o **número** que o resumo imprime continua contando uma linha que não vai
existir — que é, literalmente, o defeito do item 1 em outra superfície.

⚠️ **Consequência para quem for unificar:** se o classificador virar a fonte única, ele precisa
**absorver essas duas guardas**, senão a prévia unificada continua divergindo do ato — só que com
uma fachada de rigor. `assertPodeTrocarDeAplicacao` faz I/O (conta `resposta`, busca o nome da
aplicação), então ou o classificador deixa de ser puro, ou o chamador passa esses dois fatos junto
com o resto do estado. **A segunda opção preserva o desenho atual** e é a que eu recomendaria.

---

## (c) `copiar-do-cadastro` REIMPLEMENTA — confirmado

`efeitoDeDesignar` é chamada em **dois** lugares do fonte (`designar` e `previaDaDesignacao`).
`copiarDoCadastro` **não está entre eles**: classifica com `if`s próprios
(`designacao.service.ts:822-874`) e vocabulário próprio (`MotivoNaoAplicada`, 5 valores).

O que os dois **de fato** compartilham é uma peça só: `decidirTrocaDeAplicacao`, com o comentário
no lugar — *"MESMA função do designar(). O que muda é o que se faz com a recusa: aqui ela conta e
o lote segue."*

⚠️ **E a divergência não é de palavra, é de política.** Para o mesmo fato — *trocar o avaliador de
uma avaliação já respondida* — o lote **recusa** (`JA_RESPONDIDA`) e a designação individual
**permite com confirmação** (`EXIGE_CONFIRMACAO`). Há razão escrita para a segunda
(`efeito-de-designar.ts`, cabeçalho: recusar de vez tiraria do RH uma correção legítima); **não há
nada escrito** dizendo que o lote deve seguir recusando. Pode estar certo — em lote ninguém lê 50
avisos, e recusar é o padrão seguro — mas isso é uma **decisão a registrar**, não um detalhe de
implementação.

> **Portanto: unificar aqui é reescrever DOIS, não mover UM** — como o item 7 suspeitava. E antes
> de reescrever é preciso responder: *o lote continua recusando o que o ato individual permite?*

---

## Desfecho (08/09, no mesmo dia)

O Clenio decidiu na ordem abaixo: **1 e 2 feitos**, **3 parado** até a pergunta de política ser
respondida. Ver §3.1.32 e §3.1.33 do `ESTADO-DO-PROJETO.md`; as duas perguntas estão na lista (A).

⚠️ **Este documento fica como está** — ele descreve o estado em que o levantamento foi feito, e é
o que dá sentido às duas seções novas. Os nomes que ele cita (`adicionar`, `barradosPelaRegua` na
abertura) **já não existem no código**; foi essa a decisão 1.

## O que eu levaria à decisão

Três coisas, em ordem de custo:

1. **Barato e independente** — nomear as duas colisões achadas aqui: `barradosPelaRegua` de (5),
   que não é só régua, e o par `adicionar`/`geramAvaliacao` de (3). Nenhuma das duas exige tocar
   em classificador.
2. **Médio, e é conserto, não unificação** — a prévia de (2) rodar as duas guardas que o ato roda.
   Fecha o furo medido acima e **não depende** de decidir vocabulário nenhum.
3. **Caro, e bloqueado por uma pergunta de produto** — unificar (1) e (2). Antes: *o lote continua
   recusando `JA_RESPONDIDA`?* Sem essa resposta, a unificação escolhe a política por omissão —
   que é exatamente como o buraco do `exigeConfirmacao` nasceu.
