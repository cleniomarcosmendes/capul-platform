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

### Onde mexer
- `logistica/backend/src/viagem/viagem.service.ts` — `despachar`, `iniciar`, `concluir`
- `logistica/backend/src/viagem/dto.ts` — tornar `kmInicial`/`kmFinal` obrigatórios
- App: `logistica/app/src/screens/ViagemDetalheScreen.tsx` (fluxo do entregador)
- Suíte da logística: **264 testes** (`cd logistica/backend && npx jest`)

⚠️ Mexe com KM de veículo, que alimenta **custo de frota** — mudança aqui tem
efeito financeiro. Ver [[project_logistica_linha_km_pendencias]].
