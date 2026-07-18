# Roteiro de Testes — Logística (skill do Chrome)

**Gerado em:** 17/07/2026 · **Escopo:** validar as features entregues na jornada de 15–17/07/2026 (já na `main`/`origin`) **+ o ajuste de 17/07 do retorno de frota** (INDIVIDUAL fecha sem matrícula/senha — cenários **A10** e **B8**, ainda pendentes de commit/deploy; já no DEV).
**Ambiente:** `https://localhost/entregas/` (Logística) e `https://localhost/configurador/` (Configurador).
**Como rodar:** abrir no Chrome (skill), logar com o usuário indicado em cada cenário, seguir os passos e conferir o "Esperado".

> **Credenciais de teste:** usuários abaixo por **nome/perfil**; as **senhas** estão na memória local `reference_test_users_logistica` (não versionadas no git). Fornecidas pela Lidyane em 17/07/2026 (temporárias).

| Usuário | Perfil (Logística) |
|---|---|
| `lidyaneaparecida` | Supervisor de Departamento (SUPERVISOR_FROTA) — depto Vendas (FBR) |
| `fabricioneiva` | Coordenador (COORDENADOR) |
| `kelvereduardo` | Supervisor de Área (SUPERVISOR) |
| `admin` (Gestão TI/Configurador) | ADMIN — usar p/ o Configurador |

> **Nota:** não há registro em memória de "usuários de skill anteriores"; os testes de **Entregas** (seletor de motorista) precisam de um usuário `GESTOR_ENTREGA`/`OPERADOR_ENTREGA` — pedir credenciais à Lidyane se for validar essa parte.

---

## Pré-requisitos de setup (fazer 1x antes)

1. **RDV do coordenador (cenário 6):** logar como **lidyanerocha** → aba **Equipe (supervisores)** → **+ Novo cadastro** → no seletor **"Supervisor de área ou Coordenador"** escolher **fabricioneiva** (aparece com o sufixo *"(coordenador)"*) → **Departamento = Vendas/FBR** → **Cadastrar**. Para coordenador o campo "Coordenador" some (roteia por departamento, **sem coordenador acima**). *(Ajuste 17/07 — antes o seletor só listava papel SUPERVISOR e o coordenador não aparecia.)* **Pré-condição do roteamento:** a Lidyane precisa **supervisionar algum veículo lotado em Vendas/FBR** (o escopo do Supervisor de Departamento deriva de `veiculo.supervisorId` + `departamentoLotacaoId`) — senão o RDV do Fabricio não cai na fila dela.
2. Confirmar que há planejamentos do mês 08/2026 do **kelvereduardo** (viagens #5 e #8) para os relatórios mensais.

---

## PARTE A — Testes WEB (skill do Chrome)

### A1. Configurador — guia de papéis (`?`)
- **Usuário:** admin (Configurador) · **Tela:** Configurador → Usuários → editar um usuário → aba **Perfis**.
- **Passos:** numa linha, escolher módulo **Logística** → clicar no ícone **?** ao lado do seletor de Role.
- **Esperado:** abre modal "Papéis — Logística" listando cada papel com descrição (do backend). Ao escolher um papel, aparece a **dica inline** com o resumo. Repetir com **Workspace** e **Fiscal** (também devem listar).

### A2. Seletor de motorista só ENTREGADOR (Montar rota)
- **Usuário:** GESTOR_ENTREGA/OPERADOR_ENTREGA (pedir cred.) · **Tela:** Entregas → Rotas → **Montar rota**.
- **Passos:** abrir o seletor de **motorista**.
- **Esperado:** lista **somente** usuários com papel **ENTREGADOR** da filial (hoje só **Wanderson Nascimento Costa**). Não devem aparecer gestores/coordenadores/supervisores.

### A3. Aprovar despesa não volta ao topo (preserva rolagem)
- **Usuário:** lidyaneaparecida (ou fabricioneiva) · **Tela:** Supervisores → um planejamento com várias despesas PENDENTES.
- **Passos:** rolar até o fim da lista de despesas → **Aprovar** uma despesa lá embaixo.
- **Esperado:** a página **permanece na mesma posição** (não sobe pro topo). Repetir em outra lista (Custos da Frota).

### A4. Relatórios RDV e Visitas — MENSAIS
- **Usuário:** lidyaneaparecida · **Tela:** Supervisores → **Adiantamentos / RDV** (Fechamento) do **kelvereduardo**, mês **08/2026**.
- **Passos:** **Imprimir RDV** e **Imprimir Visitas**.
- **Esperado:** RDV mostra "2 planejamento(s): #5, #8" + **Municípios visitados no mês** (lista completa, dedupe por caixa). Visitas lista **todas** as visitas do mês (14: 4 do #5 + 10 do #8) com coluna **Planej.** e **Situação** (Realizada/Pulada + motivo). A grade do RDV **não** tem mais coluna de municípios.

### A5. Bloqueio de despesa/adiantamento fora do mês
- **Usuário:** kelvereduardo · **Tela:** Supervisores → um planejamento dele (mês 08/2026).
- **Passos:** lançar despesa com **Data** fora do mês (ex.: 15/07/2026). Idem no adiantamento.
- **Esperado:** **bloqueia** com mensagem "Data da despesa (07/2026) fora do mês do planejamento (08/2026)…". Com data dentro de 08/2026 → grava normal.

### A6. RDV do COORDENADOR aprovado pela Supervisora de Departamento
- **Usuários:** fabricioneiva (cria) + lidyanerocha (aprova). Depende do setup #1 *(cadastro do Fabricio como coordenador na Equipe — desbloqueado pelo ajuste 17/07)*.
- **Passos:**
  1. **fabricioneiva:** Supervisores → aba **Planejamentos** → **Novo planejamento** (deve aparecer "👤 será criado no seu nome (login)", sem matrícula/senha) → escolher mês → criar → incluir 1–2 visitas → **Enviar**. *(Sem o cadastro do setup #1, este passo falha com "Cadastro não encontrado na equipe desta filial".)*
  2. **lidyanerocha:** aba **Coordenação (aprovar)** → o planejamento do Fabricio deve aparecer → **Aprovar**. Lançar/rever uma despesa do planejamento e **Aprovar** também.
- **Esperado:** o RDV do coordenador roteia para a **Lidyane** (por departamento) e ela aprova planejamento **e** despesas.

### A7. Acerto de frota por DEPARTAMENTO do condutor + gestor de frota só contesta
- **Usuário:** lidyanerocha (SUPERVISOR_FROTA) · **Tela:** **Custos da Frota** → despesas PENDENTES.
- **Pré-condição (importante):** o teste precisa de uma despesa de **FROTA lançada numa saída de VEÍCULO** cujo veículo esteja **lotado no departamento dela**. ⚠️ Despesa de **RDV** (lançada num planejamento de supervisor) **NÃO** aparece aqui — é outro livro (ver nota abaixo). E despesa de categoria **INDIVÍDUO (sem veículo)** também **não** aparece para o Sup. de Departamento (é gestor-only — ver Esperado).
- **Passos:** ver as despesas de saídas cujos **veículos** são do departamento dela → **Aprovar** uma.
- **Esperado:** ela aprova as **despesas de veículo** do departamento dela. **Despesa de INDIVÍDUO (sem veículo) é gestor-only** — não aparece nem é aprovável pelo Sup. de Departamento (`despesa.service.ts`: filtro por `veiculoId ∈ deptos` + "só o gestor/admin gere"). Se logar como **GESTOR_FROTA**: só aparece **Contestar** (sem "Aprovar"); ao tentar aprovar via API → bloqueio.
- **Nota (dois livros distintos):** "Custos da Frota" (`/despesas`) é o livro de despesas de **VEÍCULO**. Despesa de **RDV** (viagem `tipo=SUPERVISOR`) vive no fluxo do RDV: detalhe do planejamento → **"Despesas do mês"**, aprovada em **"Coordenação (aprovar)"**, e entra no **"Adiantamentos / RDV"** quando APROVADA. Não confundir os dois ao testar. *(Confirmado no código 17/07 — a despesa de RDV do teste anterior não aparecer em Custos da Frota é o comportamento correto.)*

### A8. Editar/remover + Data na despesa (desktop)
- **Usuário:** kelvereduardo (ou lidyane) · **Tela:** um planejamento com despesa.
- **Passos:** lançar despesa com **Data**; **Editar** (mudar valor/data dentro do mês); **Remover**.
- **Esperado:** edição/remoção funcionam; aviso "Fora do mês" se a data sair do mês.

### A9. Fluxo clássico: Supervisor de área → Coordenador
- **Usuários:** kelvereduardo (cria/envia) + fabricioneiva (aprova).
- **Esperado:** kelver cria/envia planejamento; **fabricio** vê na Coordenação e aprova (fluxo que já existia — regressão).

### A10. Retorno de frota INDIVIDUAL — fecha só com o KM (sem matrícula/senha) *(ajuste 17/07)*
- **Usuário:** kelvereduardo (ou lidyaneaparecida) · **Tela:** Frota (saída + retorno de veículo).
- **Pré-condição:** o usuário precisa estar com **Tipo = Individual** em Configurador → Usuários → editar → campo **Tipo** (× "Padrao (Compartilhado)") **e** ter **matrícula cadastrada** (o backend resolve o condutor pelo cadastro). É o padrão dos usuários de teste; só confirmar.
- **Passos:**
  1. **Saída (individual):** Frota → registrar **saída** de um veículo DISPONÍVEL → deve indicar "condutor = você (login), sem senha" → informar **KM inicial** → sair. (Cria a viagem EM_CURSO com o próprio usuário como condutor.)
  2. **Retorno:** abrir essa viagem EM_CURSO → **Registrar retorno**.
- **Esperado:** o formulário de retorno **não** mostra os campos **Matrícula** nem **Senha do portal RH** — apenas **KM de retorno** (+ observações). A dica diz "Você (nome) fecha a própria rota — informe apenas o KM de retorno". Ao informar o KM (≥ KM de saída) → **conclui sem senha**. KM menor que o de saída → bloqueia.
- **Regressão (fallback/PADRÃO):** para um usuário com **Tipo = Padrao (Compartilhado)**, o retorno **continua** exigindo matrícula + senha (login coletivo). *(Não há usuário PADRAO na lista de teste — validar só se houver credencial; senão, marcar N/A.)*

### A11. Novo planejamento pela Supervisora de Departamento — seleção do time, sem senha *(ajuste 17/07)*
- **Usuário:** lidyanerocha (SUPERVISOR_FROTA) · **Tela:** Supervisores → aba **Planejamentos** → **Novo planejamento**.
- **Pré-condição:** ter representantes cadastrados no time dela (aba Equipe) — ex.: Kelver (supervisor) e Fabricio (coordenador), do setup #1.
- **Passos:** abrir o form → o campo **"Supervisor ou Coordenador"** agora é um **seletor por nome** (não mais matrícula+senha) → escolher um representante do time → escolher o mês → **Criar planejamento**.
- **Esperado:** o planejamento é criado **sem digitar matrícula/senha** (antes exigia a senha do portal do representante). Só aparecem no seletor os representantes **do escopo dela** (departamento). Se o time estiver vazio, mostra o aviso para cadastrar na aba Equipe. *(Auto-serviço do próprio supervisor/coordenador — "criado no seu nome" — segue inalterado.)*

### A12. Rótulos do planejamento — "Incluir no planejamento" (APROVADO) + "Liberar para execução" *(ajuste 17/07)*
- **Usuário:** kelvereduardo (dono) ou fabricioneiva · **Tela:** Supervisores → abrir um planejamento **APROVADO** (ex.: #13) — detalhe da viagem.
- **Passos e Esperado (rótulo da visita):**
  1. Com o planejamento em **Aprovado** (ainda **não** iniciado), olhar o form **"Nova visita"**: o título deve ser **"Incluir cliente no planejamento"**, com a dica "📋 Monte o roteiro…", e o botão deve ser **"Incluir no planejamento"** — **não** "Registrar visita". A visita adicionada entra como **Planejada** (o registro real é a baixa **na linha** da visita, durante a execução).
- **Passos e Esperado ("Liberar para execução"):**
  2. No topo, o botão (antes "Iniciar execução") deve se chamar **"Liberar para execução"**; ao clicar, toast **"Viagem liberada para execução."** e o status vai para **Em execução**.
  3. Agora, em **Em execução**, o form "Nova visita" passa a mostrar o botão **"Registrar visita"** e as visitas planejadas ganham a ação de **apontar (realizada/pulada) na linha**.
- **Regressão:** o **status** continua "Em execução" (não mudou); só o verbo do botão mudou. No **app** (parte B), o mesmo botão/dica devem dizer "Liberar para execução".

---

## PARTE B — Testes MOBILE (app Expo — manual, NÃO via Chrome)

O app roda no celular (Metro), fora do alcance da skill do Chrome. Validar no aparelho:

- **B1. Teclado não sobrepõe campos:** telas de **visita/despesa/adiantamento** (Supervisor) e **parada/checkin/retorno/despesa** (Frota) — ao focar um campo, ele sobe acima do teclado.
- **B2. Editar/Remover despesa** (app supervisor): botões na lista, com confirmação.
- **B3. Visita PULADA exige motivo:** modal ao "Pular"; motivo aparece na lista e no relatório.
- **B4. Data da despesa (mobile):** campo "AAAA-MM-DD (opcional — hoje)" no supervisor e na frota; bloqueio fora do mês (supervisor).
- **B5. Baixa de entrega:** botão "Confirmar" fixo + "Quem recebeu" não fica atrás do teclado.
- **B6. SUPERVISOR_FROTA marca paradas** (lidyane, como condutora): dar baixa/check-in em parada — sem erro 403.
- **B7. Nome do app:** após **novo build do APK**, o app aparece como **"CAPUL Logística"** (config nativa — não muda no reload do Metro).
- **B8. Retorno de frota INDIVIDUAL sem senha** *(ajuste 17/07)*: logado no app com usuário **Tipo = Individual** (ex.: kelver/lidyane) que tenha uma viagem de frota **EM_CURSO** como condutor → abrir a viagem → aba **🏁 Retorno** → deve mostrar **só o KM final** (sem os campos matrícula/senha) → informar KM → **Registrar retorno** fecha sem senha. Confirme também que o **teclado não sobrepõe** o campo KM (B1). *Requer o app com o JS atualizado (Metro/OTA) — o backend do DEV já aceita o fluxo.*
- **B9. "Liberar para execução" no app** *(ajuste 17/07)*: no app do supervisor, abrir um planejamento **Aprovado** → o botão do workflow deve se chamar **"Liberar para execução"** (antes "Iniciar execução"), e a dica deve dizer "Toque em 'Liberar para execução'… para apontar as visitas". Ao tocar → toast "Viagem liberada para execução." e o status vira **Em execução** (só então libera apontar realizada/pulada). *Requer app com JS atualizado (Metro/OTA).*

---

## Registro de resultados (preencher ao rodar)

| # | Cenário | Status | Observação |
|---|---|---|---|
| A1 | Guia de papéis | ⬜ | |
| A2 | Motorista ENTREGADOR | ⬜ | |
| A3 | Scroll preservado | ⬜ | |
| A4 | Relatórios mensais | ⬜ | |
| A5 | Bloqueio fora do mês | ⬜ | |
| A6 | RDV do coordenador | ⬜ | |
| A7 | Acerto por departamento | ⬜ | |
| A8 | Editar/remover + data | ⬜ | |
| A9 | Área → Coordenador | ⬜ | |
| A10 | Retorno frota INDIVIDUAL s/ senha (web) | ⬜ | |
| A11 | Novo planejamento (Sup. Depto) — seleção do time, s/ senha | ⬜ | |
| A12 | Rótulos: "Incluir no planejamento" + "Liberar para execução" | ⬜ | |
| B8 | Retorno frota INDIVIDUAL s/ senha (app) | ⬜ | |
