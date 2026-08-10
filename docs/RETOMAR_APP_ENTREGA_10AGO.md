# Retomar em 10/08 — ajustes do APP-MOBILE na Entrega

Ponto de partida do próximo dia. O trabalho de 09/08 (pauta da Logística) está
**fechado e validado**: ver `docs/roteiros-chrome-09ago/README.md`.

⚠️ **39 commits locais, NADA PUSHADO.**

---

## O que mudou no app em 09/08

Uma coisa só, e pequena — `logistica/app/src/screens/ViagemDetalheScreen.tsx`:

- O botão **"🏁 Encerrar entrega (KM)"** fica **desabilitado** enquanto houver entrega
  sem baixa, com o texto *"Faltam N entregas — dê baixa ou recuse cada uma para
  encerrar a rota."*
- Antes ele avisava *"marca N entregas pendentes como ENTREGUE, sem comprovante"* — e
  **deixava**. O servidor agora recusa; deixar tocar só para receber erro é pior do que
  não deixar tocar.

## 🔴 O que NÃO foi verificado

**O app não foi executado.** Só passou por `tsc --noEmit`. Nada foi visto no Expo Go —
nem a mudança acima, nem o efeito das regras novas do servidor.

Isto é o primeiro item de amanhã: abrir no **Expo Go** (não propor OTA; o APK não é
buildado nesta máquina) e percorrer a rota do entregador.

## O que o servidor passou a exigir, e que o app vai encontrar

Todas as regras do ponto 1 (`d52d34c4`, `c21397fe`) valem para qualquer cliente:

| ação | regra nova | mensagem do servidor |
|---|---|---|
| dar baixa | exige KM de saída da rota | *"Registre o KM de saída da rota #N antes de dar baixa nas entregas."* |
| recusar entrega | idem (senão bastaria recusar tudo) | idem |
| encerrar | exige KM final | validação do campo |
| encerrar | exige TODAS as paradas resolvidas | *"N entrega(s) ainda sem baixa…"* |

O app **já travava a baixa** sem KM na própria tela (`:340,416`) — a mudança foi levar a
regra ao servidor, não criá-la no app. O comportamento visível deve ser o mesmo.

## O que já está coberto (não mexer sem motivo)

- **Ordem da fila offline:** `reenviarPendencias` processa **baixas antes** do KM
  (*"prova antes do encerrar"*). Sem isso, um "encerrar" enfileirado sincronizaria antes
  das baixas e seria recusado.
- **Rejeição de negócio na fila:** 4xx (fora 401/408/429) **descarta** o item e mostra o
  motivo do servidor (*"Rejeitado pelo servidor: • rótulo: motivo"*). Não some calado.

## ❓ Perguntar ao Clenio antes de mexer

Em 08/08 ele pediu *"revisão do processo do app, está com buracos"*. Ao detalhar em
09/08, ficou claro que **o buraco era o KM** (ponto 1) — que foi implementado. Antes de
inventar escopo:

> **Quais buracos você vê hoje, com o app na mão?** A lista dele é a verdade de campo;
> varrer o código acha inconsistência, não acha o que travou na mão do entregador.

## Também pendente (fora do app)

- **Decisão:** os **120 usuários INDIVIDUAL sem matrícula** passam a exigi-la no próximo
  save (inclusive para editar e-mail). Afrouxar para "só na criação" é possível, ao custo
  de seguirem caindo no departamento do LOGIN no 5b.
- **Push** — 39 commits sobre `35e1246f`. É do Clenio.
