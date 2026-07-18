# Roteiro de ESTRESSE — Saída de Veículo (Frota) & RDV (Supervisores)

**Gerado em:** 17/07/2026 · **Objetivo:** estressar o **processo real do dia-a-dia** dos dois fluxos centrais da Logística — ponta a ponta, com variações, matriz RBAC e casos de borda. **Não** é focado nos commits recentes; é o ciclo completo do usuário.
**Ambiente:** `https://localhost/entregas/` (Logística) e `https://localhost/configurador/`.
**Como rodar:** Chrome (skill), logar com a persona indicada, seguir os passos, conferir o "Esperado". Cenários de **API direta** (marcados 🔧) exercem a regra do backend por trás da tela — úteis para pegar divergência UI×RBAC; se a skill não fizer requisição direta, marcar como "backend-only, não testável via UI".

---

## Personas de teste (papéis Logística no DEV)

| Papel | Logins | Tipo login | Senha |
|---|---|---|---|
| ADMIN | `admin` | INDIVIDUAL | (padrão) |
| GESTOR_FROTA | `gfrota01`, `marcelo` | INDIVIDUAL | seed = `123456` (CONFIRMADO 18/07) |
| GESTOR_ENTREGA | `renataborges`, `supdept02` | INDIVIDUAL | `123456` / ref. |
| OPERADOR_ENTREGA | `condutor_col` (**PADRÃO**), `condutor_ind` | PADRAO / IND | `123456` |
| PORTARIA | `portaria01` | **PADRÃO** | `123456` |
| ENTREGADOR | `wandersonnascimento` | INDIVIDUAL | ref. |
| COORDENADOR | `fabricioneiva`, `coord01..04` | INDIVIDUAL | ref. / `123456` |
| SUPERVISOR (área) | `kelvereduardo`, `supven01` | INDIVIDUAL | ref. / `123456` |
| SUPERVISOR_FROTA (Sup. Depto) | `lidyanerocha`, `supdept01` | INDIVIDUAL | ref. / `123456` |

> Senhas: personas de **nome real** (`lidyanerocha`, `fabricioneiva`, `kelvereduardo`, `renataborges`, `wandersonnascimento`) → memória `reference_test_users_logistica`. Personas de **seed** (`coord0x`, `gfrota01`, `condutor_col`, `condutor_ind`, `portaria01`, `supdept0x`, `supven01`) → provavelmente `123456` (validar no 1º login). **A senha é digitada por você**, não pela skill.

## Fixtures (filial `d764` — Unaí/FBR)

- **Veículos DISPONÍVEL:** `KELVER` (km 400+), `LIDYANE` (km 400+) — ambos depto **Vendas Internas e Externas (FBR)**, supervisor = Lidyane.
- **Equipe (RDV):** `Kelver` (SUPERVISOR, depto FBR, vínculo com coordenador) · `Fabricio` (COORDENADOR, depto FBR, sem coordenador acima).
- **RDV:** há planejamentos do Kelver em vários estados (RASCUNHO/APROVADO/EM_EXECUCAO/CONCLUIDO) + #5/#8 em 08/2026 (14 visitas) para relatórios.
- **Hierarquia seed (outra filial):** `coord01..04` → `supven01..08` — útil para testar escopo de coordenação cruzada.

---

# PARTE 1 — RDV / SUPERVISORES (prestação de contas)

**Máquina de estados do planejamento** (`statusPlanejamento`): `RASCUNHO → ENVIADO → {APROVADO | AJUSTADO | REJEITADO} → EM_EXECUCAO → CONCLUIDO`. Eixo paralelo `situacao`: `EM_CURSO ↔ CONCLUIDA` (vira CONCLUIDA só no *Concluir*; volta a EM_CURSO no *Reabrir*).

### R1. Criar planejamento — as 3 vias
- **R1a — Auto-serviço do SUPERVISOR** (`kelvereduardo`): aba **Planejamentos → Novo planejamento** → deve mostrar chip "👤 será criado no seu nome (login)", **sem** matrícula/senha → escolher mês → **Criar**. **Esperado:** nasce `#N` RASCUNHO, condutor = Kelver.
- **R1b — Auto-serviço do COORDENADOR** (`fabricioneiva`): idem (o RDV do coordenador é aprovado pelo Sup. Depto por departamento). **Esperado:** cria RASCUNHO no nome dele.
- **R1c — Sup. Depto por SELEÇÃO** (`lidyanerocha`): Novo planejamento → campo **"Supervisor ou Coordenador"** é um **seletor por nome** (sem senha) → escolher Kelver → mês → Criar. **Esperado:** cria no nome do Kelver, sem senha.
- **R1d — Erro: usuário sem matrícula** (persona sem chapa no cadastro): **Esperado** 400 "Seu usuário não tem matrícula cadastrada…".
- **R1e — Erro: cadastro não montado** (persona SUPERVISOR sem registro na Equipe): **Esperado** 400 "Cadastro não encontrado na equipe desta filial. Peça ao Supervisor de Departamento para te cadastrar…".
- **R1f — Erro: cadastro órfão** (registro sem coordenador nem departamento): **Esperado** 400 "Seu cadastro não tem coordenador nem departamento vinculado…".
- **R1g — Erro: mês inválido** 🔧 (mês `AAAA13`): **Esperado** 400 "Mês de referência inválido — use AAAAMM…".

### R2. Equipe / montar o time (só ADMIN e SUPERVISOR_FROTA)
- **R2a** (`lidyanerocha`): aba **Equipe → Novo cadastro** → seletor "Supervisor de área ou Coordenador" lista SUPERVISOR **e** COORDENADOR; escolher um SUPERVISOR → depto → vincular **Coordenador** → **Cadastrar**.
- **R2b** — cadastrar um **COORDENADOR** (Fabricio): ao escolhê-lo, o campo "Coordenador" some (roteia por departamento). **Esperado:** cadastro criado sem coordenador acima.
- **R2c — Matrícula duplicada:** recadastrar a mesma matrícula → 400 "Já existe um supervisor com essa matrícula nesta filial.".
- **R2d — SUPERVISOR não pode montar time:** logar como `kelvereduardo` → a aba **Equipe não aparece**; 🔧 `POST /supervisor/supervisores` → 403.
- **R2e — Depto fora do escopo** 🔧 (`lidyanerocha` cadastrando em depto que não é dela): **Esperado** "Departamento fora do seu escopo.".
- **R2f — Desvincular** (`PATCH` com `departamentoId:''`): edita e remove o vínculo.

### R3. Visitas (montar roteiro × apontar em campo)
- **R3a — Planejar visita (RASCUNHO/APROVADO):** abrir um planejamento **não iniciado** → form "Nova visita" mostra **"Incluir no planejamento"** (título "Incluir cliente no planejamento" + dica 📋) → adicionar 2-3 clientes. **Esperado:** visitas nascem **PLANEJADA**. *(Confirma a regra: APROVADO ainda é planejamento.)*
- **R3b — Liberar para execução:** botão **"Liberar para execução"** (topo) → toast "Viagem liberada para execução." → status **Em execução**.
- **R3c — Apontar REALIZADA:** na linha da visita PLANEJADA → **Realizar** → status Realizada (captura geo no app).
- **R3d — Apontar PULADA + motivo:** **Pular** → (app: modal exige motivo; desktop: sem campo de motivo) → status Pulada com motivo no relatório.
- **R3e — Visita FORA do plano (em execução):** form "Nova visita" agora mostra **"Registrar visita fora do plano"** + dica "entra como Realizada" → adicionar → nasce **REALIZADA**.
- **R3f — Editar/remover visita:** editar metadados; remover; em planejamento CONCLUÍDO → bloqueio "Viagem concluída — reabra para…".
- **R3g — Pular sem motivo** 🔧 `PATCH .../apontar {status:'PULADA'}` sem motivo: **backend aceita e grava motivo null** (o app é que exige). Registrar essa divergência UI×API.

### R4. Despesas do RDV
- **R4a — Lançar despesa (nasce PENDENTE):** no detalhe → **Nova despesa** (tipo + valor + data + comprovante). **Esperado:** situação **PENDENTE**.
- **R4b — INDIVÍDUO × VEÍCULO:** lançar tipo **Alimentação** (INDIVÍDUO → sem veículo) e **Combustível** (VEÍCULO → herda o veículo da viagem).
- **R4c — Data fora do mês:** lançar com data de outro mês → 400 "Data da despesa (MM/AAAA) fora do mês do planejamento (MM/AAAA)…" (front dá só aviso amarelo; o bloqueio é do backend).
- **R4d — Aprovar/Contestar** (coordenador do rep OU Sup. Depto): na aba **Coordenação → Revisar e decidir** → **Aprovar** (ou **Contestar** com motivo; sem motivo → 400 "Informe o motivo da rejeição da despesa.").
- **R4e — Não decidir o próprio** 🔧: dono tentando decidir a própria despesa → 403 (owner-check).
- **R4f — GESTOR não decide (UI×API):** o front pode mostrar "Aprovar" para GESTOR_* (`ehGestor`), mas 🔧 `PATCH .../decidir` como GESTOR_FROTA/GESTOR_ENTREGA → **403** (só COORDENADOR/SUPERVISOR_FROTA/ADMIN).
- **R4g — Editar despesa gateada** 🔧: `PATCH .../despesas/:id` exige **SUPERVISOR_FROTA**; SUPERVISOR/COORDENADOR editando pela API → 403 (mesmo com botão "Editar" no app). Divergência a estressar.
- **R4h — Máx. 5 comprovantes:** 6º anexo → 400 "Máximo de 5 comprovantes por despesa.".
- **R4i — Só APROVADA entra na RDV:** contestar uma despesa e conferir que ela **sai** do total/saldo do relatório.

### R5. Adiantamentos (3 perfis)
- **R5a — SUPERVISOR (auto-serviço) → PENDENTE:** `kelvereduardo` na aba **Adiantamentos / RDV** lança o SEU adiantamento → nasce **PENDENTE** (aguarda decisão).
- **R5b — COORDENADOR / SUPERVISOR_FROTA → APROVADO:** `fabricioneiva`/`lidyanerocha` lançam adiantamento para um rep → nasce **APROVADO** direto (com `decididoPor`).
- **R5c — Aprovar/Rejeitar PENDENTE:** no detalhe do planejamento, painel "Adiantamentos do mês" → **Aprovar**/**Rejeitar** (rejeitar sem motivo → 400 "Informe o motivo da rejeição."); já decidido → 400 "Este adiantamento já foi decidido.".
- **R5d — Só APROVADO no saldo:** conferir que o PENDENTE aparece como "Aguardando aprovação" e **não** entra no saldo da RDV; após aprovar, entra.
- **R5e — Auto-serviço em cadastro alheio** 🔧: SUPERVISOR lançando adiantamento em `supervisorId` de outra matrícula → 403; no SEU (tolera `E01047`/`1047`) → passa.

### R6. Workflow de aprovação (transições + escopo)
- **R6a — Fluxo feliz completo:** RASCUNHO → **Enviar** (aba Planejamentos) → ENVIADO → coordenador/Sup.Depto **Aprovar** (Coordenação) → APROVADO → **Liberar para execução** → EM_EXECUCAO → apontar visitas → **Concluir** → CONCLUIDO.
- **R6b — Ajustar/Rejeitar:** decidir como **Ajustar** (ou Rejeitar) exige comentário → sem comentário → 400 "Informe o comentário do ajuste/rejeição."; volta para o supervisor reenviar.
- **R6c — Enviar planejamento órfão:** sem coordenador/depto → 400 "…não há para quem enviar…".
- **R6d — Escopo do coordenador:** `fabricioneiva` só vê na Coordenação os planejamentos dos **seus** supervisores; 🔧 decidir um de outro coordenador → 403 "Representante fora da sua coordenação.".
- **R6e — Escopo do Sup. Depto:** `lidyanerocha` vê por **departamento**; fora do depto → 403 "Planejamento fora do seu departamento.".
- **R6f — Estados errados** 🔧: `iniciar` num RASCUNHO → 400 "Só inicia execução de planejamento aprovado/ajustado."; `decidir` num não-ENVIADO → 400 "Só decide planejamento que foi ENVIADO…"; `enviar` num APROVADO → 400 "Só envia planejamento em rascunho, ajustado ou rejeitado.".
- **R6g — Não decidir o próprio** 🔧: o dono tentando `decidir` o próprio planejamento → 403 "Apenas o coordenador do representante (ou o Supervisor de Departamento) pode decidir.".

### R7. Fechamento / RDV / Relatórios
- **R7a — RDV mensal + Visitas (impressão):** `lidyanerocha` → **Adiantamentos / RDV** do `kelvereduardo`, mês **08/2026** → **Imprimir RDV** ("2 planejamento(s): #5, #8" + municípios dedupe; grade sem coluna de municípios) e **Imprimir Visitas** (14 visitas, 12 Realizadas + 2 Puladas com motivo).
- **R7b — Saldo:** conferir `saldo = adiantamentos APROVADOS − despesas APROVADAS` (>0 devolve à CAPUL; <0 reembolsa).
- **R7c — Encerrar mês** (COORDENADOR/Sup.Depto): **Encerrar** → tentar lançar/apontar/editar despesa/adiantamento/visita → 400 "RDV do mês encerrado — reabra o mês…". **Reabrir** → volta a permitir.
- **R7d — SUPERVISOR não encerra:** `kelvereduardo` na aba Adiantamentos/RDV **não** tem botão Encerrar (só vê o seu, sem seletor).
- **R7e — Brecha: remover em mês encerrado** 🔧: com o mês encerrado mas viagem EM_CURSO, **remover** despesa/visita **não** chama a trava (só checa CONCLUÍDA) → passa. Reportar.

### R8. Casos de borda extras (RDV)
- **R8a — Concluir sem executar** 🔧: `PATCH .../concluir` num RASCUNHO → vira CONCLUIDO/CONCLUIDA sem validar status (brecha de fluxo).
- **R8b — Reabrir volta a EM_EXECUCAO** 🔧: reabrir um que era RASCUNHO ao concluir → volta como EM_EXECUCAO (permite apontar visitas nunca aprovadas).
- **R8c — Idempotência offline (app):** reenviar despesa/visita com a mesma `idempotencyKey` não duplica.
- **R8d — Filial cruzada** 🔧: `:id`/`supervisorId` de outra filial → Forbidden/NotFound ("de outra filial"/"não encontrado").

---

# PARTE 2 — SAÍDA DE VEÍCULO (FROTA)

**Máquina de estados:** `Viagem(FROTA)`: `EM_CURSO → CONCLUIDA` (retorno/portaria/ajuste-concluir) ou `EM_CURSO → CANCELADA` (cancelar). Veículo: `DISPONIVEL → EM_USO` (saída) → `DISPONIVEL` (retorno/cancelamento). `acertoEncerradoEm` é **ortogonal** ao status (pode encerrar acerto de viagem já concluída; o veículo já foi liberado). Parada: `PLANEJADA → REALIZADA|PULADA`; ad-hoc nasce REALIZADA. Despesa: `PENDENTE` (tipo requer aprovação) ou `APROVADA` (tipo `requerAprovacao=false`, ex.: Abastecimento) → `APROVADA|CONTESTADA`.

### S1. Registrar SAÍDA — as 3 formas
- **S1a — PADRÃO (matrícula + senha Protheus)** (`condutor_col`, GESTOR_FROTA `gfrota01`, ou GESTOR_ENTREGA): Frota → **"Registrar saída"** → modo "Condutor (matrícula + senha)" → digitar matrícula → Enter (busca nome) → senha → **Validar** → veículo DISPONÍVEL (KELVER/LIDYANE) + **KM inicial** (≥ km atual) + finalidade → registrar. **Esperado:** viagem EM_CURSO, veículo → EM_USO.
- **S1b — INDIVIDUAL (sem senha)** (`kelvereduardo`/`lidyanerocha`, INDIVIDUAL): "Registrar saída" → modo **"Eu (condutor)"** → só veículo + KM → registrar. **Esperado:** condutor = próprio login, sem senha; backend resolve matrícula do cadastro.
- **S1c — PORTARIA (por nome, sem senha do motorista)** (`portaria01` PADRÃO, ou `gfrota01`): "Registrar saída" → modo **"Pela portaria (por nome)"** → buscar condutor por **nome** (≥3 letras) → escolher → **matrícula+senha do PORTEIRO** → veículo + KM → registrar. **Esperado:** toast "Saída registrada pela portaria (sob sua responsabilidade)."; `registradaPortaria=true`.
- **S1d — Erros de saída** 🔧: KM inicial < km atual → "KM inicial (X) menor que o KM atual do veículo (M)."; veículo indisponível → "Veículo indisponível (situação: EM_USO)."; INDIVIDUAL sem matrícula no cadastro → "Seu usuário não tem matrícula cadastrada…"; busca portaria <3 letras → "Informe ao menos 3 letras do nome.".
- **S1e — Adiantamento na saída:** informar **"Adiantamento (R$)"** já no formulário (vale nos 3 fluxos) → conferir que aparece no acerto e é editável depois.
- **S1f — Frota compartilhada:** o seletor de veículo lista DISPONÍVEL de **todas as filiais**; a viagem nasce na filial do login.

### S2. Gate do condutor + token (login PADRÃO)
- **S2a** (login PADRÃO `condutor_col` no **app**): abrir a viagem EM_CURSO → tela **"Identifique o condutor"** → matrícula+senha → **"Identificar e liberar"** → token 6h; ações (parada/despesa/retorno) passam a funcionar.
- **S2b — matrícula ≠ condutor da viagem** 🔧: gate com outra matrícula → 200 `{valida:false, NAO_E_O_CONDUTOR}` → "Esta matrícula não é a do condutor que iniciou a viagem." (não desloga).
- **S2c — sem token / token expirado (>6h) / de outra viagem** 🔧: ação PADRÃO sem gate → **403** "Identifique o condutor…" / "Sessão do condutor expirou…" / "Identificação de condutor inválida para esta viagem." (**nunca 401**). INDIVIDUAL não precisa de gate.

### S3. Paradas (o "caderno" da rota)
- **S3a — Planejar (antecipado):** no detalhe → **"Planejar visitas (antecipado)"** → informar locais → **"Planejar N paradas"** (vazio → "Informe ao menos um local.").
- **S3b — Registrar parada agora (ad-hoc):** **"Registrar parada agora"** (GPS automático) → nasce REALIZADA.
- **S3c — Check-in / Pular:** numa PLANEJADA → **"Cheguei"** (→ REALIZADA) / **"Pular"** (→ PULADA). Parada inexistente → "Parada não encontrada nesta viagem.".
- **S3d — Remover** (lixeira). Após CONCLUÍDA/CANCELADA → tudo read-only: "A rota não está em curso — não é possível alterar paradas.".

### S4. Despesa na viagem
- **S4a — Lançar (nasce PENDENTE):** aba **💸 Despesa** / **"Lançar despesa"** → tipo que exige aprovação (Combustível/Manutenção) + valor + nº doc + foto do cupom. **Esperado:** PENDENTE; toast "Entrou como pendente de validação do supervisor.".
- **S4b — Auto-aprovada:** tipo **Abastecimento** (`requerAprovacao=false`) → nasce **APROVADA** direto (sem passar por supervisor). Conferir que entra no saldo do acerto.
- **S4c — INDIVÍDUO × VEÍCULO:** Alimentação (INDIVÍDUO → `veiculoId=null`, some da Análise por veículo, vai à RDV) vs Combustível (VEÍCULO). VEÍCULO sem veículo na viagem → "Viagem sem veículo.".
- **S4d — Dedup por documento** 🔧: relançar a mesma nota no mesmo veículo+tipo → "A nota N já foi lançada para este veículo no tipo \"X\"."; marcar **sem nota** ignora a checagem.
- **S4e — Aprovar/Contestar (acerto):** ver S7/A7/A13 — **quem aprova é o Supervisor de Departamento** (`lidyanerocha`); GESTOR_FROTA só **Contesta**.

### S5. RETORNO — as 4 formas
- **S5a — Normal (condutor):** **"Registrar retorno"** → (PADRÃO usa o token do gate; INDIVIDUAL fecha sem senha) → **KM final** (≥ KM saída). Aviso não-bloqueante se há paradas planejadas sem baixa. **Esperado:** CONCLUIDA, veículo → DISPONÍVEL, kmAtual=kmFinal.
- **S5b — INDIVIDUAL sem senha:** logado INDIVIDUAL que iniciou → o form de retorno **não** pede matrícula/senha (só KM). *(ajuste 17/07)*
- **S5c — PORTARIA:** link **"Retorno pela portaria (sem senha do motorista)"** → KM final + **matrícula+senha do porteiro** ("✓ Porteiro confere") → **"Encerrar pela portaria"**. Toast "Rota encerrada pela portaria…".
- **S5d — AJUSTE do gestor / forçar fecho** (`gfrota01`, ou `lidyanerocha` p/ veículo do depto dela): link **"Ajuste da rota — corrigir KM / forçar fecho"** → marcar **"Fechar a rota (concluir)"** + KM → **Salvar**. **Esperado:** fecha mesmo sem o condutor. *(É o caminho do supervisor/gestor para corrigir; ver A13 parte 2.)*
- **S5e — Erros** 🔧: KM final < KM saída → "KM final (X) menor que o KM de saída (Y)."; condutor errado (matrícula ≠ quem iniciou) → "Só o condutor que iniciou pode fechar a viagem…"; ajuste concluir sem KM → "Informe o KM final para concluir.".

### S6. Cancelar saída (GESTOR_FROTA/GESTOR_ENTREGA/ADMIN)
- **S6a** (`gfrota01`): no detalhe EM_CURSO → **"Cancelar saída"** → **Motivo** → **"Confirmar cancelamento"**. **Esperado:** CANCELADA, veículo liberado, obs "❌ CANCELADA por {quem}: {motivo}".
- **S6b — Erros** 🔧: motivo vazio → "Informe o motivo do cancelamento."; **com despesa** → "Há N despesa(s) nesta saída — remova-as antes de cancelar."; viagem não-EM_CURSO → "Só é possível cancelar uma saída em curso.".

### S7. Adiantamento + Acerto
- **S7a — Editar adiantamento no detalhe:** link **"editar"** ao lado de "Adiantamento:" (só com acerto aberto).
- **S7b — Encerrar acerto** (dono/supervisor/gestor): viagem CONCLUÍDA → **"🔒 Encerrar acerto"** → trava despesa/adiantamento (badge "🔒 Acerto encerrado"). **Reabrir** → **"🔓 Reabrir acerto"**.
- **S7c — Travas** 🔧: lançar despesa com acerto encerrado → "Acerto encerrado — reabra o acerto para lançar despesa."; alterar adiantamento → "Acerto encerrado — reabra o acerto para alterar o adiantamento." (KM/obs passam); encerrar acerto de viagem CANCELADA → "Viagem cancelada — não há acerto a encerrar.".
- **S7d — Folha de acerto (impressão):** `GET /frota/viagens/:id/acerto` → despesas APROVADAS × adiantamento → **saldo = adiantamento − despesas aprovadas**.

### S8. RBAC de frota (validar UI × API)
- **S8a — GESTOR_FROTA cross-filial:** `gfrota01` retorna/ajusta/vê custos de viagem de **outra filial**; supervisor de outra filial → 403 "Viagem de outra filial." / leitura → 404 "Viagem de frota não encontrada." (não vaza).
- **S8b — GESTOR_FROTA só contesta:** em Custos da Frota, para GESTOR_FROTA aparece só **"Contestar"** (sem "Aprovar"); 🔧 `PATCH /despesas/:id/aprovar` como GESTOR_FROTA → 403 "Apenas o supervisor de departamento do condutor aprova o acerto…".
- **S8c — SUPERVISOR_FROTA por departamento:** `lidyanerocha` só vê/opera veículos/viagens do depto FBR; aprova despesa (incl. INDIVÍDUO) do depto; encerra retorno alheio do depto (A13).
- **S8d — PORTARIA:** só saída/retorno pela portaria + leitura; 🔧 saída PADRÃO/individual como PORTARIA → 403.
- **S8e — Aprovar/contestar despesa não-PENDENTE** 🔧: → "A despesa não está pendente de validação.".

### S9. Casos de borda extras (Frota)
- **S9a — Corrida de saída** 🔧: dois logins tentando a saída do MESMO veículo → o 2º falha "Veículo indisponível…".
- **S9b — Manutenção com custo** (`gfrota01`): registrar manutenção com `custo>0` → cria DespesaVeiculo "Manutenção" **APROVADA** (⚠️ custos sobem); supervisor de outro veículo → "Apenas gestor de frota ou o supervisor do veículo podem registrar manutenção.".
- **S9c — Idempotência offline (app):** reenviar parada/despesa com mesma `idempotencyKey` não duplica.
- **S9d — Rateio de despesa:** tipo repetido no rateio → "Cada tipo de despesa só pode aparecer uma vez no rateio.".

---

## Registro de resultados

| # | Cenário | Status | Observação |
|---|---|---|---|
| R1a–R1g | Criar planejamento (3 vias + erros) | ⬜ | |
| R2a–R2f | Equipe / montar time | ⬜ | |
| R3a–R3g | Visitas | ⬜ | |
| R4a–R4i | Despesas | ⬜ | |
| R5a–R5e | Adiantamentos (3 perfis) | ⬜ | |
| R6a–R6g | Workflow de aprovação | ⬜ | |
| R7a–R7e | Fechamento / RDV / relatórios | ⬜ | |
| R8a–R8d | Casos de borda RDV | ⬜ | |
| S1a–S1f | Saída (PADRÃO / INDIVIDUAL / PORTARIA + erros) | ⬜ | |
| S2a–S2c | Gate do condutor + token (PADRÃO) | ⬜ | |
| S3a–S3d | Paradas | ⬜ | |
| S4a–S4e | Despesa na viagem | ⬜ | |
| S5a–S5e | Retorno (4 formas + erros) | ⬜ | |
| S6a–S6b | Cancelar saída | ⬜ | |
| S7a–S7d | Adiantamento + Acerto | ⬜ | |
| S8a–S8e | RBAC de frota (UI × API) | ⬜ | |
| S9a–S9d | Casos de borda Frota | ⬜ | |
