# 7 · Travessia — as fases juntas, num caminho só

**Valida:** a **interação** entre multi-role, 5b, 5a e ponto 3 — que é justamente o
que a divisão por fase não cobre. Cada uma passa isolada e ainda assim a cadeia pode
quebrar na junção.
**Tempo:** ~20 min. **Pré-requisito:** rodar antes os roteiros 1 e 3 pelo menos uma vez.

> **Por que existe.** As quatro fases mexem na mesma cadeia: *quem responde pela
> despesa*. O multi-role decide quais papéis a pessoa tem; o 5b decide de qual
> departamento é a despesa; o 5a decide quem pode mexer nela; o ponto 3 decide se há
> veículo. Um roteiro por fase não exercita as quatro decisões no mesmo registro.

---

## O caminho

Uma viagem **sem veículo**, registrada por **conta compartilhada**, com despesa
lançada pela **pessoa identificada**, aprovada por quem **responde pelo departamento
dela** — e por mais ninguém.

### Passo 1 — Preparar o acúmulo de papéis (multi-role)

- [ ] `admin` → Configurador → `renataborges` já é **SUPERVISOR_FROTA @ Supermercado**.
      Adicionar a ela um **segundo** perfil de Logística: **GESTOR_ENTREGA** noutro
      departamento da filial 02.
- [ ] Entrar como `renataborges` (`Temp@123`): o rótulo do perfil mostra **os dois
      papéis**, e o menu tem tanto Entregas quanto a frota.

> Se aqui ela **perder** o acesso que tinha antes, o multi-role regrediu — pare e
> registre.

### Passo 2 — Registrar viagem SEM veículo, por conta compartilhada (ponto 3 + 5b)

- [ ] Entrar como `supunai` (**PADRAO**, filial 02, senha `123456`) → **Registro de
      Viagem**.

> 🔴 **Login PADRÃO exige matrícula + senha reais** para o formulário liberar o
> registro. Sem credencial real, faça este passo com `raydeborges` (INDIVIDUAL,
> `Temp@123`) — o departamento também cai no fallback do login (Supermercado), então a
> cadeia do 5b continua a mesma.
- [ ] Escolher **"— Sem veículo da empresa (outro transporte) —"**.
- [ ] Conferir o campo **"Departamento que responde pelas despesas"**: resolve para
      **Supermercado** (departamento do login) e mostra **"Aprovado por *Renata
      Borges*"**.
- [ ] Informar **adiantamento** e registrar.

> Duas fases se cruzam aqui: a viagem não tem veículo (ponto 3) e mesmo assim tem
> departamento aprovador (5b). Antes, sem veículo não havia como saber de quem era a
> conta.

### Passo 3 — A pessoa se identifica e lança a despesa (5a)

- [ ] Ainda como `supunai`, abrir a viagem. Aparece o **gate de identificação**.
- [ ] 🔴 Identificar com **matrícula + senha reais** do colaborador que conduziu.
      *(Sem credencial real, pule para o passo 4 usando um login INDIVIDUAL para
      lançar a despesa — a cadeia do 5b continua verificável.)*
- [ ] Lançar uma despesa de categoria **INDIVÍDUO** → nasce **PENDENTE**.

### Passo 4 — Só quem responde pelo departamento aprova (5b)

> ✅ **Desbloqueado em 09/08** (`c774210e`): a listagem passou a usar a mesma
> fonte da aprovação. Antes o supervisor aprovava o que não conseguia ver.

- [ ] `renataborges` (SUPERVISOR_FROTA do **Supermercado**) → vê a despesa e
      **aprova**.
- [ ] `supdept01` (SUPERVISOR_FROTA do **T.I.**) → **não** consegue aprovar a mesma
      despesa.
- [ ] `gfrota01` (GESTOR_FROTA) → consegue **contestar**, **não** aprovar.

### Passo 5 — O retrato não se move (5b)

- [ ] No Configurador, mudar o departamento de quem lançou.
- [ ] A despesa **já aprovada** continua atribuída ao mesmo departamento, e uma
      viagem nova nasce com o departamento novo.

---

## O que este roteiro procura, e os roteiros por fase não

| Risco de junção | Onde apareceria |
|---|---|
| Viagem sem veículo ficar **sem departamento** aprovador | Passo 2 — o campo viria vazio |
| Despesa de indivíduo **só o gestor** poder gerir | Passo 4 — `renataborges` não veria a despesa |
| O 2º papel **apagar** o 1º | Passo 1 — o menu perderia itens |
| O token do condutor **não valer** em viagem sem veículo | Passo 3 — recusaria o lançamento |
| A autoridade **migrar** ao mudar o cadastro | Passo 5 — a despesa trocaria de dono |

---

## Desfazer

- [ ] Remover o 2º perfil de `renataborges`.
- [ ] Devolver o departamento alterado no passo 5.
- [ ] Cancelar a viagem e as despesas de teste.
