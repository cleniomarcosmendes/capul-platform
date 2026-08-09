# Logística — fluxo de KM e rota simultânea na ENTREGA

*Análise de 08/08/2026, a partir de relato dos usuários em teste: **com o login do
ENTREGADOR o sistema deixa iniciar as entregas sem registrar o KM inicial**.*

**Nada foi alterado.** Este documento é o levantamento para a próxima sessão
implementar. Todos os pontos foram verificados no código, não presumidos.

---

## O que foi confirmado

### 1. KM inicial é OPCIONAL no despacho
`logistica/backend/src/viagem/viagem.service.ts`, `despachar()`:

```ts
if (dto.kmInicial != null && dto.kmInicial < veiculo.kmAtual) { ... }
```

Só valida **se vier**. Não vindo, a viagem é despachada sem KM. É o relato dos
usuários.

### 2. O KM de saída é um ato SEPARADO, e também opcional
`iniciar()` grava `kmInicial` numa viagem que **já está EM_CURSO** — o registro
acontece *depois* de a rota começar, e nada obriga a fazê-lo.

### 3. KM final é opcional ao concluir
`concluir()`: `if (kmFinal != null && v.kmInicial != null && ...)` — mesma
construção. Dá para encerrar a rota sem informar o KM final.

### 4. NÃO existe trava de rota simultânea
Não há nenhuma verificação de outra viagem ativa para o mesmo **veículo** ou
**motorista**. O mesmo carro pode estar em duas rotas ao mesmo tempo.

---

## Verificado em 09/08 — o APP já resolve parte disso (e isso muda o plano)

### 5. O app trava a baixa sem KM — mas só no cliente, e só a baixa
`logistica/app/src/screens/ViagemDetalheScreen.tsx:340,416` — com `kmInicial == null`
o botão de baixa vira `🔒 Registre o KM de saída` e o toque não chama `onBaixar`. A
tela ainda avisa: *"Registre o KM de saída para liberar as baixas desta rota"*. O app
também valida KM de retorno < KM de saída (`:108`) e enfileira o KM offline (`:151`).

**O app está à FRENTE do backend, não atrás.** Duas consequências para o plano:

- **A regra é client-side.** O servidor não exige nada; qualquer caminho que não passe
  por essa tela (desktop, versão antiga do app, chamada direta) atravessa. É a família
  de defeito nº 3 do inventário — *a correção existe, mas o caminho usado não passa por
  ela*. O trabalho não é "criar a regra no app": é **mover a regra para o servidor**.
- **A trava é só na BAIXA, não no INÍCIO da rota.** É exatamente isto que o usuário
  relatou: o despacho põe a viagem EM_CURSO sem KM, o entregador vê as paradas, abre o
  mapa e navega — e só encontra o cadeado na hora de dar baixa. O relato dele está
  correto, e o app também: a regra só não existe onde precisava estar.

### 6. 🕳️ Encerrar a rota marca entrega pendente como ENTREGUE **sem comprovante**
`ViagemDetalheScreen.tsx:291-296`, na própria tela:

> *"Encerrar agora marca N entregas pendentes como ENTREGUE, sem comprovante."*

A tela **avisa**, mas **deixa**. Isso não é validação faltando — é código ativo fazendo
o **oposto** da definição de "finalizar" do Clenio (*"entregar ou recusar as
entregas"*), e anula a prova de entrega da Fase 1b (o cofre) justamente nas paradas que
ficaram sem baixa. Precisa ser **removido**, não só protegido por uma validação nova.

---

## A amarração com o controle de frota (o item NOVO da pauta)

Este ponto não estava no levantamento original. Verificado agora — e o buraco é real.

A rota de ENTREGA **mexe no odômetro do veículo**: ao concluir,
`src/viagem/viagem.service.ts:327` grava `kmAtual: kmFinal` e devolve o veículo para
DISPONIVEL — igual à viagem de frota.

Mas o **Monitor da Frota não a enxerga**: o KM rodado do mês
(`src/frota/frota.service.ts:818`) e o ranking por departamento (`:830`) filtram
`tipo: TipoViagem.FROTA`. As viagens de ENTREGA ficam de fora.

O resultado são duas distorções em direções opostas:

1. **O odômetro anda sem viagem que o explique.** `kmAtual` avança pela entrega, mas o
   "KM rodado" do mês não conta aquele trecho → custo por km fica **superestimado**
   (mesmo custo dividido por menos km), e a Linha do KM tem um degrau sem origem.
2. **Se a rota concluir SEM `kmFinal`** (hoje é opcional — confirmado acima), o
   odômetro **nem avança**: o KM rodado na entrega simplesmente **desaparece** do
   veículo. A manutenção preventiva, que é disparada por `kmAtual`
   (`frota.service.ts:812`), atrasa em silêncio.

⚠️ A distorção nº 2 é a mais grave: ela some com quilometragem real de um veículo que
roda **todo dia** fazendo entrega.

---

## Por que ficou assim

O `kmInicial` "de verdade" nasceu no módulo **FROTA** (saída de veículo), onde é
**obrigatório** e validado contra o `kmAtual` (`frota.service.ts:208`). A viagem
de ENTREGA ganhou campos próprios de KM depois, como **opcionais**, e os dois
fluxos nunca foram amarrados.

⚠️ É a mesma assinatura dos achados do Inventário nesta semana: **a regra existe
num caminho e o outro passa ao largo**. Ver
[[project_inventario_contagem_lote_08ago]], família de defeito nº 3.

---

## O que o Clenio pediu

> "ajustar o fluxo para [não] permitir o usuário realizar registros errados (...)
> ver se é possível apontar mais uma rota para o VEÍCULO/MOTORISTA; se sim, não
> deixar ele iniciar uma ROTA sem finalizar a outra — e **finalizar significa
> informar o KM final, e entregar ou recusar as entregas**."

## Proposta (a validar com ele)

1. **KM obrigatório nas duas pontas** — sem KM inicial não despacha; sem KM final
   não conclui.
2. **Concluir exige as paradas RESOLVIDAS** (entregue ou recusada) — é a
   definição dele de "finalizar".
3. **Uma rota por vez**, por veículo **e** por motorista: barrar novo despacho se
   houver viagem em `DESPACHADA`/`EM_CURSO`, dizendo **qual** rota está aberta.

### ✅ Decidido (09/08) — viagens antigas sem KM
**Não há tratamento a fazer.** Decisão do Clenio: *"aqui é uma base de testes, não
está em produção ainda, não precisa se preocupar"*. Ou seja: **KM obrigatório para
todas**, sem exigir só nas novas, sem tela de acerto das antigas e sem migration de
dado. Se alguma viagem de teste travar, é aceitável.

⚠️ A janela para isso é o deploy: **quando a Logística entrar em produção com dados
reais, essa liberdade acaba** — a regra passa a valer sobre viagem de gente.

### Proposta — itens acrescentados em 09/08

4. **A regra vive no SERVIDOR.** O app mantém a trava (é boa UX: avisa antes do toque),
   mas quem recusa é o backend. Sem isso, só o app obedece.
5. **Encerrar NÃO entrega sozinho.** Remover a conversão automática de parada pendente
   em ENTREGUE; encerrar exige cada parada baixada ou recusada — que é a definição de
   "finalizar" do Clenio, e preserva o comprovante.
6. **A entrega entra no controle de frota.** O KM rodado, a Linha do KM e o custo por km
   passam a considerar `tipo = ENTREGA` junto com `FROTA` — as duas movem o mesmo
   odômetro. Com KM obrigatório nas duas pontas (item 1), o trecho deixa de sumir.

### Onde mexer
- `logistica/backend/src/viagem/viagem.service.ts` — `despachar`, `iniciar`, `concluir`
  (a regra de KM; e `concluir` para de auto-entregar as pendentes)
- `logistica/backend/src/viagem/dto.ts` — tornar `kmInicial`/`kmFinal` obrigatórios
- `logistica/backend/src/frota/frota.service.ts:818,830` — Monitor/KM rodado passam a
  incluir as viagens de ENTREGA (hoje filtram só `FROTA`)
- App: `logistica/app/src/screens/ViagemDetalheScreen.tsx` — a trava da baixa já existe
  (`:340,416`); ajustar é o **encerramento** (`:291-296`), que hoje entrega sozinho
- Suíte da logística: **264 testes** (`cd logistica/backend && npx jest`)

⚠️ Mexe com KM de veículo, que alimenta **custo de frota** — mudança aqui tem
efeito financeiro. Ver [[project_logistica_linha_km_pendencias]].
