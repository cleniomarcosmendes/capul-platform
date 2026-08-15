# Roteiro de Fechamento — 14–15/08/2026

**Sessão**: onda de correções no módulo Logística (balcão + app do entregador)
**Alvo**: `639eceb9` · **28 commits** (24 pushados em 15/08 + 4 de segurança)
**Base**: `4daf094` (o que roda em PROD) → o delta desta sessão soma ao que já
estava represado desde 12/08 (`bdb510a0`)

---

## 1. Estado final

| Gate | Resultado |
|---|---|
| `logistica/backend` — `tsc --noEmit` | ✅ limpo |
| `logistica/backend` — Jest | ✅ **363 testes** |
| `logistica/frontend` — `tsc -b` | ✅ limpo |
| `logistica/frontend` — ESLint | ✅ 0/0 |
| `logistica/app` — ESLint | ✅ 0/0 *(instalado nesta sessão)* |
| `logistica/app` — `tsc --noEmit` | ✅ limpo |
| `logistica/app` — Jest | ✅ **71 testes** (era 62) |
| `auth-gateway` — tsc + Jest | ✅ **30 testes** (era 20) |
| `gestao-ti/backend` — tsc + Jest | ✅ **109 testes** |
| `fiscal/backend` — tsc + Jest | ✅ **54 testes** |
| `inventario/backend` — pytest | ✅ **121 testes** (era 119) |
| `tsc -b` nos 5 frontends | ✅ limpos |
| `check-migrations-all.sh` | ✅ 4 backends consistentes |
| Containers | ✅ 19/19 no ar |
| Erros nos backends (level 50) | ✅ nenhum |
| `git status` | ✅ limpo |

> ⚠️ `tsc -b` nos frontends, **nunca** `--noEmit`: o tsconfig deles é
> arquivo-solução (`files: []`) e o `--noEmit` checa ZERO arquivo saindo 0.

---

## 2. O que foi entregue

### 2.1 Balcão — registrar entrega (`62549039`)

Três pontos relatados, todos no `EntregaNovaPage.tsx`:

1. **Valor perdia centavos EM SILÊNCIO.** A criação usava `parseFloat` sobre a
   string mascarada em pt‑BR; a edição já usava `parseMoeda`. `"1.234,56"` virava
   `1.234` (3 casas → o servidor recusava, era a mensagem relatada) e `"123,45"`
   virava `123` — **sem erro nenhum**, gravando R$ 123,00. O erro visível era o
   caso de sorte; abaixo de R$ 1.000 gravava errado calado.
   🔎 **Vale conferir entregas recentes com centavos zerados.**
2. **Matrícula errada mantinha o cliente ANTERIOR** na tela — a busca só
   preenchia `if (nome)`. Dizia "não encontrada" e mostrava os dados de outra
   pessoa, sem impedir o registro no nome errado.
3. **Nota e valor obrigatórios, com saída explícita**: sem número, a nota entra
   como **`S/NF`** e o motivo passa a ser obrigatório em Observações. A regra
   aparece na tela (aviso âmbar + rótulo + placeholder). Vale só na **criação**.

### 2.2 App do entregador — desempenho e toque

| Commit | O que |
|---|---|
| `a49ac455` | Confirmar a baixa deixou de ser espera muda: etapa em texto + **barra com % real de bytes**; quadro de assinatura parou de nascer em toda baixa |
| `9cf2d419` | **Carimbo da prova saiu do event loop** (worker): pausa da API **2422ms → 7ms** |
| `98dc4c7d` | **Foto reduzida a 1080px no aparelho**: 937 KB → 224 KB e carimbo 1612ms → 512ms |
| `3d9dace3` | A foto original é apagada após reduzir (cada baixa deixava duas no cache) |
| `81bd1236`, `0625d696` | **Nenhum `Alert` perto de `navigation`** — diálogo nativo em cima da transição deixava a tela viva e surda; confirmação virou faixa na tela |
| `e94e8601`, `93290ee9` | **Nenhum `await` antes de navegar** — leitura de disco no toque (e 3× por foco) |
| `ebe87810` | `keyboardShouldPersistTaps` — o teclado comia o 1º toque |
| `97cf2c85` | **`removeClippedSubviews={false}`** — no Android o item some da hierarquia nativa, segue visível e **para de receber toque** |
| `39a8856c`, `9a85a855` | Ambiente: o app segue o **host do Metro** (não `__DEV__`) e a tela de login **mostra o servidor** |
| `87251aba` | **ESLint no app** (0/0), com `react-hooks/rules-of-hooks` |

---

## 3. ⛔ O que continua ABERTO

**O travamento da tela da rota não está confirmado como resolvido.**

O que ficou **provado** (não é suposição):
- **não é o servidor** — cada baixa responde em ~500ms, e há minutos de silêncio
  de rede durante o travamento;
- **não é o modo de desenvolvimento** — travou igual em bundle de produção;
- **a thread de JS trava** (pior caso medido: **4,7s**), mas **não é ela** que
  segura a tela — houve um minuto inteiro travado sem nenhuma trava nova;
- **o toque chega ao React e morre antes do botão**: `raiz=18 · exec=2`.

`removeClippedSubviews={false}` é a explicação que casa com a medição e com todo
o histórico — **mas precisa ser confirmada no APK**.

---

## 4. Próximo passo: validar em HOMOLOGAÇÃO

### 4.1 ⚠️ Exige APK NOVO — não dá para mandar por OTA

O app ganhou **`expo-image-manipulator`**, que é **módulo nativo**. O
`runtimeVersion` é fixo em `1.0.0`: publicar OTA sobre o APK atual **derruba o
app instalado**. O build é do Marco/Douglas (não sai desta máquina).

```
npm run build:homolog     # expo run:android --variant homologacaoRelease
```

### 4.2 O que pedir a quem testar

Rota com **3 ou mais entregas**, feitas em sequência, sem sair da rota:
1. o "Dar baixa" abre **no primeiro toque**?
2. depois de confirmar, a lista volta com a **faixa verde** e o próximo botão
   responde de primeira?
3. digitar o KM e, **com o teclado aberto**, tocar direto no botão — vale de
   primeira?

### 4.3 Se o travamento voltar

O diagnóstico está no código, desligado por **uma linha cada**:
- `logistica/app/src/screens/ViagemDetalheScreen.tsx` → `MOSTRAR_DIAGNOSTICO = true`
- `logistica/app/src/lib/detectorTravamento.ts` → `LIGADO = true`

A faixa mostra `raiz` (toque chegou ao React) × `exec` (handler rodou) ×
`travas` (thread de JS parada). Os três são excludentes e cada um leva a um
conserto diferente. **Não usar `console.log` para isso**: em bundle de produção
o encaminhamento para o Metro não existe.

---

## 4.4 🔒 `/security-review` — EXECUTADO, 5 achados corrigidos

Rodado no escopo correto (**todo o delta de produção**, `4daf094`→alvo, não só a
sessão) + **verificação de estado** das rotas sem autenticação × `nginx.conf`.
Método: 2 revisões independentes → 6 achados → 4 verificadores adversariais →
**5 confirmados**, 1 descartado. Todos corrigidos.

| # | Achado | Sev. | Novo? | Correção |
|---|---|---|---|---|
| 1 | Condutor reescrevia/apagava despesa **já APROVADA** | High | **SIM** | `11e5752a` — trava do valor decidido |
| 2 | OPERATOR lia o **saldo do sistema** em 6 rotas | High | não | `639eceb9` — 5 projetadas + 1 bloqueada |
| 3 | **Credencial PROD do Protheus** legível por qualquer autenticado | High | não | `43a366cf` — guard de ADMIN |
| 4 | **TLS sem validação** nos clientes Protheus | High | não | `10e8c8f5` — validação ligada |
| 5 | SSRF cego no testador de conexão | Medium | não | `43a366cf` — só host cadastrado |

**Descartado na verificação:** CRUD de usuários do Inventário sem autenticação —
real, mas o nginx não expõe (`/api/v1/users` fora da lista branca), a porta não é
publicada e sob `UNIFIED_AUTH` a linha é inerte (o papel vem do JWT). Fica como
defesa em profundidade, não bloqueia.

**Duas descobertas que mudaram a correção:**
- A configuração `show_previous_counts` governa **contagens anteriores**, não o
  saldo — e o código avisa para **não bloquear** as rotas de contagem ("o OPERATOR
  PRECISA chamá-las"). Por isso projeção, não 403.
- O Protheus usa **CA pública** (Sectigo): a validação de TLS foi ligada **sem
  precisar de arquivo de CA**, verificado dentro do container.

---

## 5. Antes do deploy (gates da casa)

1. `docs/ROTEIRO_FINALIZACAO.md` — ETAPA 2 completa ✅ (feito acima)
2. `./scripts/check-migrations-all.sh` — ✅ executado, 4 backends consistentes;
   **esta sessão não criou migration**
3. `/security-review` — ✅ **executado** (§4.4), 5 achados corrigidos
4. `PlatformCapul_20260811_Roteiro_Deploy.md` — ✅ atualizado **no lugar**: alvo
   **`639eceb9`**, 138 commits, com o bloco 🔒 do `/security-review` e as
   mudanças de comportamento a comunicar (Configurador, Inventário, TLS)

---

## 6. Ações humanas pendentes

| # | O quê | Quem |
|---|---|---|
| 1 | `git push` do delta local | **Clenio** (push é só dele) |
| 2 | Build do **APK de homologação** (módulo nativo novo) | Marco/Douglas |
| 3 | Conferir entregas com **centavos zerados** (defeito 2.1.1) | Clenio |
| 4 | 🔴 **Rotacionar a credencial do Protheus** — foi legível por qualquer conta autenticada enquanto o achado nº 3 esteve aberto (§4.4); + as 4 senhas no histórico do git | Clenio |
| 5 | Regra de firewall `CAPUL API dev (8085)` — **criada à toa**, pode remover | Clenio |

---

*Gerado em 15/08/2026 · `docs/ROTEIRO_FINALIZACAO.md` v1.6, ETAPA 0+1+2*
