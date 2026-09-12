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

**auth-gateway — `bloquear`** (`/api/v1/core/varredura-matricula/config`).
É a rotina que **desativa quem saiu da empresa**. Medido no DEV em 13/09:
enviar `{"bloquear":"false"}` deixou o modo em **`BLOQUEIO`** — a string
"false" **liga** o bloqueio. *(Sonda revertida em seguida; o DEV voltou a
`RELATORIO` e ficou conferido.)*

**logística — `confirmarPendentes`** (`PATCH /supervisor/viagens/:id/concluir`).
É o "sim, pode encerrar assim" quando há visita ainda PLANEJADA — e ele
transforma as pendentes em **PULADA**. Medido no DEV em 13/09 contra um id
inexistente (sem escrever nada): `"false"` e `"talvez"` **passam a validação** e
chegam ao serviço; se o campo fosse estrito, parariam antes com 400.

Os demais campos são de menor alcance, mas da mesma família: `autenticaPortal`,
`ativo`, `sac` no auth-gateway; `semNota`, `requerAprovacao`, `reiniciarCiclo`,
`noLocal` na logística.

## De onde veio

Não é descuido de ninguém: é **padrão copiado**. O `auth-gateway` e o
`gestão de TI` nasceram no mesmo commit em **23/02/2026**, um com a conversão
implícita e o outro sem. Todos os backends criados depois copiaram o do
auth-gateway — fiscal (17/04), logística (31/05), gestão de pessoas (05/09).

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
