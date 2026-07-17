# Roteiro de Testes — Logística (skill do Chrome)

**Gerado em:** 17/07/2026 · **Escopo:** validar as features entregues na jornada de 15–17/07/2026 (já na `main`/`origin`).
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

1. **RDV do coordenador (cenário 6):** logar como **lidyaneaparecida** → aba **Equipe (supervisores)** → "montar o time" → cadastrar **fabricioneiva** como representante **no departamento da Lidyane (Vendas/FBR)**, **sem coordenador acima**. Sem isso o RDV do coordenador não roteia para a Lidyane.
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
- **Usuários:** fabricioneiva (cria) + lidyaneaparecida (aprova). Depende do setup #1.
- **Passos:**
  1. **fabricioneiva:** Supervisores → aba **Planejamentos** → **Novo planejamento** (deve aparecer "👤 será criado no seu nome (login)", sem matrícula/senha) → escolher mês → criar → incluir 1–2 visitas → **Enviar**.
  2. **lidyaneaparecida:** aba **Coordenação (aprovar)** → o planejamento do Fabricio deve aparecer → **Aprovar**. Lançar/rever uma despesa do planejamento e **Aprovar** também.
- **Esperado:** o RDV do coordenador roteia para a **Lidyane** (por departamento) e ela aprova planejamento **e** despesas.

### A7. Acerto de frota por DEPARTAMENTO do condutor + gestor de frota só contesta
- **Usuário:** lidyaneaparecida · **Tela:** **Custos da Frota** → despesas PENDENTES.
- **Passos:** ver as despesas de saídas cujos **condutores** são do departamento dela (inclui as **de indivíduo**, sem veículo) → **Aprovar**.
- **Esperado:** ela aprova as do departamento dela (inclusive indivíduo). Se logar como **GESTOR_FROTA**: só aparece **Contestar** (sem "Aprovar"); ao tentar aprovar via API → bloqueio.

### A8. Editar/remover + Data na despesa (desktop)
- **Usuário:** kelvereduardo (ou lidyane) · **Tela:** um planejamento com despesa.
- **Passos:** lançar despesa com **Data**; **Editar** (mudar valor/data dentro do mês); **Remover**.
- **Esperado:** edição/remoção funcionam; aviso "Fora do mês" se a data sair do mês.

### A9. Fluxo clássico: Supervisor de área → Coordenador
- **Usuários:** kelvereduardo (cria/envia) + fabricioneiva (aprova).
- **Esperado:** kelver cria/envia planejamento; **fabricio** vê na Coordenação e aprova (fluxo que já existia — regressão).

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
