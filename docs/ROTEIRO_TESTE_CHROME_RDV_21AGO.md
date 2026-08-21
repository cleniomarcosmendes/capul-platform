# Roteiro de teste no Chrome — RDV / Prestação de Contas (21/08/2026)

**Por que este roteiro existe.** Numa demonstração de 21/08 apareceram dois pontos no
módulo **Supervisores (RDV)**: o `fabricioneiva` **encerrou o próprio mês** (regra que
já tínhamos tratado em 01/08 para despesa e adiantamento) e a **aprovação do
planejamento do `kelvereduardo` deu erro**. O primeiro foi reproduzido por API,
corrigido e coberto por teste (commit `4f3ce3e0`). O segundo **ainda não reproduzi** —
o caso 2 aqui existe para capturar a mensagem exata.

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

- [ ] Como **Fabricio**: encerrar o mês do **Kelver**.
- [ ] Como **Kelver**: tentar **criar/enviar** planejamento de 08/2026 → deve recusar
      com *"RDV do mês encerrado"*. (Antes, **enviar** passava.)
- [ ] Como **Kelver**: tentar lançar **despesa** ou **visita** → mesma recusa.
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
- [ ] **A decisão vale para o valor** — Kelver edita o **valor** de uma despesa já
      aprovada → ela volta para **PENDENTE**.
- [ ] **Adiantamento é de quem aprova** — como **Kelver**, a aba Fechamento mostra
      *"O adiantamento é lançado pelo seu coordenador"* e **não** tem formulário.
      Como **Fabricio**, tentar lançar adiantamento **para si** não deve existir na
      tela (ele não se seleciona) — e pela API é **403**.

---

## 5 · Estado do DEV depois dos meus testes de hoje

- Não sobrou nenhum mês encerrado (`logistica.fechamento_rdv` está **vazia**).
- O planejamento **nº 55** do Kelver foi criado por mim para reproduzir e está
  **CANCELADO** com o motivo *"planejamento de TESTE da revisão técnica 21/08"* —
  pode ignorar.
- A viagem **nº 48** do Fabricio foi reaberta e **reconcluída** no teste do
  `reabrirViagem`; voltou ao estado original (**Concluída**).
