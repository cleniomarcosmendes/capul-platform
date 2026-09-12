# Aviso — validação de booleano nos backends NestJS

**Para:** Marco · **De:** T.I. (Clenio) · **Data:** 13/09/2026
**O que é:** um buraco **latente** de validação, para você decidir **janela de
deploy**. Não é incidente.

---

## Em uma frase

Nos backends que usam `enableImplicitConversion` no `ValidationPipe`, um campo
booleano de API **aceita texto e converte** — e a string `"false"` chega ao
código como **`true`**.

## ⚠️ Latente, não incidente — leia isto antes do resto

- **Nenhum cliente nosso manda texto num campo booleano.** O frontend é
  TypeScript e serializa booleano de verdade; o app também.
- **É a forma que a tela nunca exercita.** Quem cairia nela é uma integração
  externa, um `curl`, um script — ou um cliente novo escrito por outra pessoa.
- **Não há indício de que tenha acontecido.** Não estamos corrigindo um
  estrago; estamos fechando uma porta antes de alguém passar por ela.

Isso é para você **escolher a janela**, não para tratar como urgência.

## Onde está

| Backend | Afetado? | Campos booleanos | |
|---|---|---|---|
| **auth-gateway** | **sim** | **8** | 🔴 pior caso abaixo |
| **logística** | **sim** | **20** | 🔴 pior caso abaixo |
| **fiscal** | sim (configuração) | **0** | 🟡 exposto, **nada a explorar hoje** |
| **gestão de pessoas** | era | 15 | ✅ **já corrigido** (não está em produção ainda) |
| **gestão de TI** | **não** | 36 | ✅ imune — nunca teve conversão implícita |

## O pior caso de cada um — medido, não suposto

### auth-gateway — `bloquear`, a rotina que desativa quem saiu da empresa

A rota **ecoa de volta o estado gravado**, então não há o que interpretar.
Transcrição do que rodei no DEV em 13/09:

```
══ ANTES:
    modo=RELATORIO tetoPct=20

══ PATCH {"bloquear":"false"} →
{"modo":"BLOQUEIO","tetoPct":20,"ultimaExecucao":{ ... }}   [HTTP 200]

══ DEPOIS (o que ficou gravado):
    modo=BLOQUEIO tetoPct=20

══ RESTAURANDO ao estado exato (a linha não existia antes):
    DELETE 1
    linhas varredura% agora: 0

══ CONFERIDO:
    modo=RELATORIO tetoPct=20
```

⭐ **Leia a terceira linha:** mandei a string `"false"` e o serviço gravou
**`BLOQUEIO`**. Não é "aceitou um valor estranho" — é **ligou o modo que
desativa usuário**, dizendo a palavra oposta.

*(A sonda foi revertida no mesmo comando: a linha `varredura_matricula_bloquear`
não existia antes e foi apagada; o status voltou a `RELATORIO` e ficou
conferido. O cron da varredura é `0 4 * * *` e nenhuma execução ocorreu.)*

### logística — `confirmarPendentes`, que vira visita em PULADA

É o "sim, pode encerrar assim" quando há visita ainda PLANEJADA. Aqui **não dava
para sondar escrevendo**, então usei um **id inexistente** — o que não altera
nada e ainda assim responde:

```
PATCH /api/v1/logistica/supervisor/viagens/00000000-.../concluir

  {"confirmarPendentes":true}      → 404 "Planejamento não encontrado."
  {"confirmarPendentes":"false"}   → 404 "Planejamento não encontrado."
  {"confirmarPendentes":"talvez"}  → 404 "Planejamento não encontrado."
  {"confirmarPendentes":0}         → 404 "Planejamento não encontrado."
```

⭐ **O 404 é a prova.** Ele vem do SERVIÇO, que só é chamado depois da validação
passar. Se o campo fosse estrito, `"false"` teria parado antes com **400** e
nunca teria chegado ao banco. As quatro formas passaram.

Os demais campos são de menor alcance, mas da mesma família: `autenticaPortal`,
`ativo`, `sac` no auth-gateway; `semNota`, `requerAprovacao`, `reiniciarCiclo`,
`noLocal` na logística.

## De onde veio

Não é descuido de ninguém: é **padrão copiado**. O `auth-gateway` e o
`gestão de TI` nasceram **no mesmo commit**, em **23/02/2026** — um com a
conversão implícita e o outro sem. Os três backends criados depois copiaram do
auth-gateway: fiscal (17/04), logística (31/05), gestão de pessoas (05/09).

> ⭐ **"Copio do último que fiz" propaga o defeito tanto quanto o acerto.** Havia
> uma versão certa no repositório desde o primeiro dia, e ela é justamente a que
> ninguém copiou.

## O conserto

Um decorador próprio que devolve o valor **cru** antes de validar, trocado nos
campos booleanos, mais um teste que varre o fonte e impede que um campo novo
nasça frouxo. **Já está feito e verde no gestão de pessoas** — é copiar.

| | Custo |
|---|---|
| auth-gateway (8 campos) | **~2h** + regressão |
| logística (20 campos) | **~2h** + regressão |
| fiscal | ~30min (preventivo, não há campo) |

⚠️ **Roteiro próprio, não pegar carona.** Mudança em validação global toca todas
as rotas do serviço — merece a sua janela e o seu teste de fumaça, não um
"aproveita que vai subir".

⚠️ **O que NÃO recomendamos:** simplesmente desligar `enableImplicitConversion`.
Consertaria a classe inteira de uma vez e **quebraria todo parâmetro de query
que hoje depende dela para virar número**. Trocaria risco conhecido por risco
não medido.

## O que precisamos de você

Só a **janela**. O código é nosso e o teste também.
