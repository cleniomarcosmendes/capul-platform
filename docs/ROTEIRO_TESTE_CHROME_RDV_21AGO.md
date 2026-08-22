# Roteiro de teste no Chrome — RDV / Prestação de Contas (21/08/2026)

**Por que este roteiro existe.** Numa demonstração de 21/08 apareceram dois pontos no
módulo **Supervisores (RDV)**: o `fabricioneiva` **encerrou o próprio mês** (regra que
já tínhamos tratado em 01/08 para despesa e adiantamento) e a **aprovação do
planejamento do `kelvereduardo` deu erro**. O primeiro foi reproduzido por API,
corrigido e coberto por teste (commit `4f3ce3e0`). O segundo nunca reproduziu.

> **✅ Executado no Chrome em 21/08 — 16 passaram, 2 falharam, 1 parcial, 7 observações
> de tela.** As duas falhas novas (**F1** despesa aprovada mantinha a aprovação quando
> quem lançou editava o valor; **F2** criar planejamento furava o mês encerrado) e as
> observações **O1–O6** foram corrigidas na sequência. O texto abaixo já incorpora as
> correções que a execução pediu — em especial **separar CRIAR de ENVIAR no caso 3** e
> especificar direito o item de valor no caso 4, que era o que escondia a F1.

**Tempo:** ~35 min. **Tela:** `https://localhost/entregas/` → **Supervisores**.

---

## 0 · Antes de abrir o Chrome

### 0.1 O ambiente precisa ter o código do fix

O backend da logística **já foi rebuildado e subido** nesta máquina em 21/08. Se você
tiver feito `docker compose down` depois disso, refaça:

```bash
cd /mnt/c/meus_projetos/capul-platform
docker compose build logistica-backend
docker compose up -d logistica-backend
docker compose exec nginx nginx -s reload    # IP novo do container → senão 502
```

Conferir que o fix está no ar (deve responder **403**, não 201):

```bash
# troque <TOKEN> pelo accessToken do fabricioneiva
curl -sk -X POST https://localhost/api/v1/logistica/supervisor/rdv-mensal/fechar \
  -H "Authorization: Bearer <TOKEN>" -H 'Content-Type: application/json' \
  -d '{"supervisorId":"c6b91940-8758-4be4-a8a3-4b8e6b76ffc6","mesReferencia":202608}'
# esperado: "O encerramento do mês é de quem aprova a sua prestação de contas…"
```

> **O frontend NÃO mudou** neste fix — não precisa rebuildar `logistica-frontend`.

### 0.2 As personas (DEV, filial `d764d838…`)

| usuário | senha | papel na Logística | posição no RDV |
|---|---|---|---|
| `lidyanerocha` | `Temp@123` | `SUPERVISOR_FROTA` | **Supervisora de Departamento** (Vendas) — é quem aprova o **Fabricio** |
| `fabricioneiva` | `Temp@123` | `COORDENADOR` | **coordenador do Kelver** *e* representante com **RDV próprio** |
| `kelvereduardo` | `Temp@123` | `SUPERVISOR` | representante do Fabricio |

⚠️ **O Fabricio é o caso interessante justamente por acumular as duas pontas**: sobre o
Kelver ele é autoridade; sobre si mesmo, **não** — o cadastro dele não tem coordenador,
roteia pelo **departamento**, e quem decide o RDV dele é a **Lidyane**.

### 0.3 Quando der erro, anote isto (é o que falta para o caso 2)

- **A mensagem exata** do toast (print).
- **A tela e o botão** clicados.
- **A hora** — para cruzar com o log:
  `docker logs capul-logistica-api --since 10m | grep -v '"statusCode":200'`
- **O console do Chrome** (F12 → Console e Network): se o toast for genérico
  ("Falha ao decidir o planejamento"), a resposta HTTP tem a razão real.

---

## 1 · Encerramento do mês — quem pode e quem não pode ⭐ (o fix de 21/08)

**Regra:** encerrar/reabrir o mês é o **aceite da prestação de contas**. É ato de quem
**aprova** aquele representante — nunca do dono da conta.

### 1.1 O Fabricio NÃO encerra o próprio mês

- [ ] Entrar como **`fabricioneiva`** → **Supervisores** → aba **Fechamento**.
- [ ] No seletor **Representante**, conferir que aparece **só o Kelver** — o próprio
      Fabricio **não** deve estar na lista.
- [ ] 🔴 **Se o nome dele aparecer aí, PARE e me avise**: é um segundo furo, na tela
      (o backend agora recusa, mas a tela estaria oferecendo o que a API nega).

### 1.2 O Fabricio encerra o mês do Kelver (caminho legítimo)

- [ ] Ainda como `fabricioneiva`: **Fechamento** → Representante **Kelver**, mês
      **08/2026** → **Encerrar mês**.
- [ ] Aparece **"Mês encerrado — despesas/adiantamentos travados"** e o painel mostra
      o cadeado **🔒 Mês encerrado**.
- [ ] **Reabrir mês** → volta a liberar. *(Deixe reaberto ao final.)*

### 1.3 O mês do Fabricio quem encerra é a Lidyane

- [ ] Entrar como **`lidyanerocha`** → **Fechamento** → Representante **Fabricio**,
      mês **08/2026** → **Encerrar mês** → deve funcionar.
- [ ] **Reabrir** em seguida (deixe reaberto).

### 1.4 O Kelver não encerra nada

- [ ] Entrar como **`kelvereduardo`** → **Fechamento**: a tela mostra **"Você — Kelver…"**
      fixo, os adiantamentos dele e **não oferece** botão de encerrar.

---

## 2 · Aprovar o planejamento do Kelver 🔎 (o ponto ainda não reproduzido)

**Pela API o caminho funciona** — testei em 21/08: Kelver cria → envia → Fabricio
aprova (HTTP 200). Então o erro que você viu veio de **outro estado** ou da **tela**.
Este caso passa pelos estados um a um; **pare no que falhar** e anote (0.3).

### 2.1 O caminho feliz

- [ ] **`kelvereduardo`** → **Supervisores** → aba **Viagens** → **Novo planejamento**
      (mês **08/2026**).
- [ ] Incluir **2 visitas** (buscar cliente por matrícula, ex. `A00086`).
- [ ] **Enviar para aprovação** → status vira **Enviado**.
- [ ] **`fabricioneiva`** → aba **Coordenação** → o planejamento aparece com
      **"Revisar e decidir"** → abrir → **Aprovar**.
- [ ] Esperado: **"Planejamento aprovado."** e status **Aprovado**.

### 2.2 Os estados que a tela pode oferecer e a API recusa

*(É a família de defeito mais comum aqui: "a tela oferece o que a API nega".)*

- [ ] **Já decidido:** com o planejamento **Aprovado**, dar **F5** e conferir que os
      botões **Aprovar/Ajustar/Rejeitar sumiram** (só devem existir em **Enviado**).
- [ ] **Duas abas:** abrir o mesmo planejamento em **duas abas** como Fabricio, aprovar
      na aba A e **clicar Aprovar na aba B**. Esperado: erro claro
      *"Só decide planejamento que foi ENVIADO para aprovação"*. **É este o erro que
      você viu?**
- [ ] **Puxado de volta:** Kelver **envia**, e antes de o Fabricio decidir ele clica
      **"Puxar de volta"**. Na tela do Fabricio (já aberta), **Aprovar** deve dar o
      mesmo erro de estado.
- [ ] **Mês encerrado:** Fabricio **encerra o mês do Kelver** (caso 1.2) e **depois**
      tenta aprovar um planejamento **Enviado** daquele mês. Esperado **agora**:
      *"RDV do mês encerrado — reabra o mês…"* (antes de 21/08 isto **aprovava
      calado**, e aí a visita/despesa seguinte é que estourava — **forte candidato ao
      erro da demonstração**).

### 2.3 O aprovador mexendo no roteiro

- [ ] Com o planejamento do Kelver em **Enviado**, o Fabricio deve conseguir
      **incluir, editar e remover visita** (é ele que está avaliando).
- [ ] O **Kelver**, no mesmo estado, **não** deve conseguir — o formulário fica travado
      com o aviso de "aguardando aprovação".

---

## 3 · Mês encerrado trava o ciclo inteiro (novo em 21/08)

> ⭐ **Este caso é o que mais rendeu: três execuções, três furos no mesmo guard**
> (`criar` em 21/08; `iniciar`, `concluir`, `veículo` e `reabrir` em 22/08). Hoje existe
> um **teste de invariante** que varre o serviço inteiro atrás de método de escrita sem
> a checagem — então um furo novo quebra a suíte antes de chegar aqui. Continue rodando
> os itens mesmo assim: o teste garante que a checagem EXISTE, não que a **tela** parou
> de oferecer o botão.

> ⚠️ **Separe CRIAR de ENVIAR.** Na 1ª execução (21/08) o roteiro juntava os dois num
> passo só e por isso quase perdeu a falha **F2**: `enviar` recusava e **`criar`
> passava**. Cada ação abaixo é um item próprio de propósito.

- [ ] Como **Fabricio**: encerrar o mês do **Kelver**.
- [ ] Como **Kelver**: **criar** planejamento de 08/2026 → deve recusar com
      *"RDV do mês encerrado — não dá para criar planejamento."* **(era a F2)**
- [ ] Como **Kelver**, num planejamento que já existia: **enviar para aprovação** →
      *"…não dá para enviar para aprovação."*
- [ ] Como **Kelver**: **lançar despesa** e **incluir visita** → mesma recusa, cada uma
      citando a própria ação.
- [ ] Como **Fabricio**: **aprovar** um planejamento ENVIADO daquele mês →
      *"…não dá para decidir o planejamento."*
- [ ] **Executar também é mexer no mês** *(era a 3ª falha, achada em 22/08)*: num
      planejamento **Aprovado**, **Liberar para execução** → *"…não dá para liberar para
      execução."*; num **Em execução**, **Concluir** → *"…não dá para concluir o
      planejamento."*
- [ ] **Trocar o veículo** do planejamento → *"…não dá para trocar o veículo"* (é dele
      que a despesa herda o custo da frota).
- [ ] Como **Fabricio**, num planejamento **Concluído**: **Reabrir para corrigir** →
      *"…não dá para reabrir o planejamento"* — o caminho é reabrir o **mês** primeiro.
- [ ] Na tela do planejamento, conferir a **tarja amarela "🔒 RDV do mês encerrado"** e
      que os botões de ação **sumiram** (não é para descobrir no clique).
- [ ] Como **Fabricio**: **reabrir** o mês → tudo volta a funcionar.

---

## 4 · Regressão rápida das 4 regras de integridade (01/08)

Cinco minutos, porque a suspeita era de regressão geral.

- [ ] **Planejar ≠ executar** — como **Fabricio**, no planejamento **do Kelver**:
      **Enviar**, **Liberar para execução**, **Apontar visita** e **Concluir** **não**
      devem estar disponíveis para ele (são do dono). Incluir/editar visita, sim.
- [ ] **Quem decide é quem NÃO lançou** — Fabricio lança uma despesa **no RDV do
      Kelver**: ela nasce **PENDENTE** e **quem aprova é o Kelver**. O botão "Aprovar"
      dessa despesa **não** aparece para o Fabricio.
- [ ] **Quem lançou corrige** (regra de autoria, que vem ANTES da regra de valor):
      Kelver tentar editar o valor de uma despesa lançada pelo **Fabricio** →
      *"Esta despesa foi lançada por outra pessoa — você não altera o valor dela.
      Se não reconhece o lançamento, conteste: quem lançou corrige."* O **lápis nem
      deve aparecer** para ele (corrigido em 21/08 — antes o formulário abria e só
      quebrava no Salvar).
- [ ] **A decisão vale para o valor — sentido do representante:** despesa **do próprio
      Kelver**, aprovada pelo Fabricio; Kelver edita o valor → volta para **PENDENTE**.
- [ ] **A decisão vale para o valor — sentido do coordenador** *(é aqui que estava a
      falha F1)*: **Fabricio lança** no RDV do Kelver (nasce PENDENTE) → **Kelver
      confirma** (APROVADA) → **Fabricio edita o valor**. Esperado **agora**: volta para
      **PENDENTE** e o Kelver reconfere. Antes seguia **APROVADA**, recarimbada pelo
      próprio Fabricio — ele aprovava o próprio lançamento pela porta dos fundos.
- [ ] **A regra de autoria prende NOS DOIS SENTIDOS** *(2ª forma da F1, 22/08)*: numa
      despesa **lançada pelo Kelver e já aprovada**, o **Fabricio** clica no lápis →
      **o lápis não deve existir** para ele; pela API, **403** *"Esta despesa foi lançada
      por outra pessoa…"*. Antes ele mudava o valor e a despesa seguia **Aprovada**.
- [ ] **O caminho da autoridade é CONTESTAR:** na mesma despesa aprovada o Fabricio tem
      **Contestar** → informa o motivo → a despesa fica **Contestada**; o **Kelver**
      corrige o valor e ela volta para **PENDENTE**, para o Fabricio aprovar de novo.
      *(Fornecedor e observação — que não são dinheiro — o Fabricio segue corrigindo.)*
- [ ] **Adiantamento é de quem aprova** — como **Kelver**, a aba Fechamento mostra
      *"O adiantamento é lançado pelo seu coordenador"* e **não** tem formulário.
      Como **Fabricio**, tentar lançar adiantamento **para si** não deve existir na
      tela (ele não se seleciona) — e pela API é **403**.

---

## 4.1 · O que NÃO é defeito (decidido, para não virar achado de novo)

- **O aprovador inclui, edita e remove visita no planejamento APROVADO.** É a decisão
  de 02/08 (`aceeab87`): o roteiro congela para o DONO a partir do envio, e quem
  responde por ele nos estados **Enviado** e **Aprovado** é quem aprova. Só na
  **execução** (EM_EXECUCAO) a caneta volta para o representante.
- ~~A autoridade que NÃO lançou pode editar o valor~~ — **ERRADO, corrigido em 22/08.**
  Eu tinha documentado isto como intencional (vinha do código de 01/08) e a 3ª execução
  mostrou o que permitia: o coordenador **aprova** a despesa do representante e depois,
  **sozinho**, muda o valor — aprovado, sem reconferência e sem o dono da conta ver. A
  regra do CLAUDE.md sempre foi simétrica: **quem não lançou não altera o valor**.

## 5 · Estado do DEV (atualizado após a 2ª execução, 22/08)

- `logistica.fechamento_rdv` **vazia** — nenhum mês encerrado.
- **#55** e **#60** — CANCELADOS, com o motivo dizendo que são teste. **#60** era o
  órfão da F2.
- **#56** — carrega as duas despesas de teste (`TESTE roteiro 21/08`). A de **R$ 12,34**
  está **PENDENTE** (fix da F1: o Fabricio editou e ela voltou para a conferência do
  Kelver). A de **R$ 77,00** também está **PENDENTE**, agora depois de percorrer o ciclo
  novo inteiro: aprovada → contestada pelo Fabricio → corrigida pelo Kelver. As duas
  esperam decisão do Fabricio.
- **#59** — tem a despesa de **R$ 15,00** que o Fabricio lançou no RDV do Kelver:
  **PENDENTE**, esperando a conferência do **Kelver** (a conta é dele).
- **#57** — Aprovado. **#58** — **Em execução**: a 3ª falha o concluiu com o mês
  encerrado; reabri depois da correção, e ele serve agora para testar o `concluir`.
- Viagem **#48** (do Fabricio) segue **Concluída**, como estava.
