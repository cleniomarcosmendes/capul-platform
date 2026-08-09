# 7 · Travessia — as fases juntas, num caminho só

**Valida:** a **interação** entre multi-role, 5b e ponto 3 — o que a divisão por fase
não cobre. Cada fase passa isolada e a cadeia ainda pode quebrar na junção.
**Tempo:** ~20 min. **Pré-requisito:** ter rodado os roteiros 1 e 3 pelo menos uma vez.
**Usuários:** `supdeptb`/`123456` · `condutor_ind`/`123456` · `supdept01`/`123456` ·
`gfrota01`/`123456` · `lidyanerocha`/`Temp@123` · `admin`/`admin123`.

> **Por que existe.** As fases mexem na mesma cadeia: *quem responde pela despesa*. O
> multi-role decide quais papéis a pessoa tem; o 5b, de qual departamento é a despesa;
> o ponto 3, se há veículo. Um roteiro por fase não exercita as três decisões no mesmo
> registro.

> **Adaptado em 09/08:** a versão anterior usava `supunai` (caixa) e `renataborges` —
> as duas contas devolvem 401 com as senhas que temos. O caminho abaixo usa só
> credenciais que funcionam. O trecho de **login PADRÃO (5a)** fica de fora: ele exige
> uma conta compartilhada **e** senha real do portal RH — está coberto pelo roteiro 4.

---

## O caminho

Uma viagem **sem veículo**, de alguém que **acumula papéis**, com despesa aprovada por
quem **responde pelo departamento dela** — e por mais ninguém.

### Passo 1 — Acúmulo de papéis (multi-role)

- [ ] `admin` → Configurador → `supdeptb` → adicionar 2º perfil de Logística:
      **Supervisor de Departamento** no departamento **Supermercado**.
- [ ] Entrar como `supdeptb`: o rótulo mostra **os dois papéis** e o menu traz Entregas
      **e** frota.

> Se ele **perder** o acesso que já tinha, o multi-role regrediu — pare e registre.

### Passo 2 — Viagem SEM veículo (ponto 3 + 5b)

- [ ] Entrar como `condutor_ind` → **Registro de Viagem**.
- [ ] Escolher **"— Sem veículo da empresa (outro transporte) —"**.
- [ ] O campo **"Departamento que responde pelas despesas"** mostra **Tecnologia da
      Informacao** e **"Aprovado por Supervisor de Depto 01 (TESTE)"**, **sem** o aviso
      de "veio do login" (ele tem matrícula).
- [ ] Informar **adiantamento** e registrar.

> Duas fases se cruzam: a viagem não tem veículo (ponto 3) e mesmo assim tem
> departamento aprovador (5b). Antes, sem veículo não havia como saber de quem era a conta.

### Passo 3 — Despesa de INDIVÍDUO

- [ ] Ainda como `condutor_ind`, lançar na viagem uma despesa de categoria
      **INDIVÍDUO** (a única cadastrada é **Alimentação**) → nasce **PENDENTE**.
- [ ] Uma despesa de categoria **VEÍCULO** deve ser **recusada** — não há veículo.

### Passo 4 — Só quem responde pelo departamento aprova (5b)

- [ ] `supdept01` (SUPERVISOR_FROTA do **T.I.**) → **Custos da Frota / Despesas**,
      filtro PENDENTE → **vê** a despesa e **aprova**.
- [ ] `lidyanerocha` (SUPERVISOR_FROTA de **Vendas/FBR**, filial 18) → **não** vê a
      despesa.
- [ ] `gfrota01` (GESTOR_FROTA) → numa despesa ainda pendente, **contesta**; ao tentar
      **aprovar**, recebe a recusa explicando que aprovar o acerto é do supervisor do
      departamento do condutor.

> ⭐ Este passo só é alcançável desde `c774210e`: antes, a listagem usava uma fonte
> diferente da aprovação e o `supdept01` **aprovava o que não conseguia ver**.

### Passo 5 — O retrato não se move (5b)

- [ ] `admin` → Configurador → trocar o **departamento** de `condutor_ind`.
- [ ] A despesa/viagem do passo 2 **mantém** o departamento aprovador anterior.
- [ ] Uma viagem **nova** de `condutor_ind` já nasce com o departamento novo.

---

## O que este roteiro procura, e os por fase não

| Risco de junção | Onde apareceria |
|---|---|
| Viagem sem veículo ficar **sem departamento** aprovador | Passo 2 — campo viria vazio |
| Despesa de indivíduo **só o gestor** poder gerir | Passo 4 — `supdept01` não a veria |
| Listagem e aprovação usarem **fontes diferentes** | Passo 4 — vê mas não aprova, ou o contrário |
| O 2º papel **apagar** o 1º | Passo 1 — o menu perderia itens |
| A autoridade **migrar** ao mudar o cadastro | Passo 5 — a despesa trocaria de dono |

---

## Desfazer

- [ ] Remover o 2º perfil de `supdeptb` (**obrigatório** — senão contamina o roteiro 2).
- [ ] Devolver o departamento de `condutor_ind`.
- [ ] Cancelar a viagem e excluir as despesas de teste.
