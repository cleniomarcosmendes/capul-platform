# 5 · "Registro de Viagem" — viagem sem veículo (ponto 3)

**Valida:** commit `0345b974`.
**Tela:** `https://localhost/entregas/` → **Registro de Viagem**.
**Tempo:** ~10 min.

> **O caso.** Há viagens feitas **sem veículo da empresa** — outro meio de transporte
> — em que o registro serve só à **prestação de contas**: adiantamento e despesas.
> Antes o formulário exigia veículo e hodômetro, e não havia onde registrar isso.

---

## 5.1 O nome mudou

- [ ] O item de menu agora é **"Registro de Viagem"** (era "Saída de Veículos").
- [ ] O título da tela acompanha.
- [ ] Dentro de uma viagem, o link de volta diz **"Voltar para Registro de Viagem"**.

## 5.2 Veículo virou opcional

**Usuário:** `condutor_ind` (INDIVIDUAL, senha `123456`) — dispensa senha do RH.

- [ ] No passo **Veículo e saída**, o rótulo mostra **"Veículo (opcional)"**.
- [ ] A primeira opção do seletor é **"— Sem veículo da empresa (outro transporte) —"**.
- [ ] Escolhendo essa opção, o campo de **KM some da obrigação**: o botão de
      registrar **habilita sem KM** (com veículo, ele continua exigindo).
- [ ] Aparece a explicação: *"Sem veículo da empresa: o registro serve só à prestação
      de contas (adiantamento e despesas). Não há hodômetro, e as despesas entram como
      indivíduo — fora do custo por veículo."*

> Esse aviso é deliberado: sem ele, "a despesa sumiu do custo da frota" viraria
> surpresa no fechamento do mês.

## 5.3 A viagem sem veículo funciona como prestação de contas

- [ ] Registrar com **adiantamento** preenchido e finalidade (ex.: "viagem de ônibus").
- [ ] A viagem é criada; ao abri-la, **não há placa** nem KM.
- [ ] **Nenhum veículo** ficou marcado como EM_USO por causa dela (conferir em
      **Veículos**: os disponíveis continuam disponíveis).
- [ ] Lançar uma despesa nela → aceita despesas de categoria **INDIVÍDUO**
      (alimentação etc.). Despesa de categoria VEÍCULO deve recusar — não há veículo.

## 5.4 O supervisor do departamento consegue conferir a conta

> ✅ **Desbloqueado em 09/08** (`c774210e`): a listagem passou a usar a mesma
> fonte da aprovação. Antes o supervisor aprovava o que não conseguia ver.

Este é o encaixe com o 5b — sem ele, o registro nasceria inútil.

- [ ] Entrar como o **Supervisor de Departamento** do departamento que ficou gravado
      na viagem (para `condutor_ind`, é `supdept01`).
- [ ] Ele **vê** e consegue **aprovar/contestar** a despesa de indivíduo.

> Antes, despesa sem veículo só o Gestor de Frota podia gerir — o supervisor não
> conseguiria nem conferir a conta de quem se reporta a ele.

## 5.5 A portaria continua exigindo veículo

- [ ] Entrar como `portaria01` (**PADRAO**, senha `123456`) → **Registro de Viagem**.
- [ ] No fluxo de portaria, o veículo **continua obrigatório** e o seletor **não**
      oferece a opção "sem veículo".

> A portaria registra veículo passando pelo **portão**. Uma viagem de ônibus não tem
> evento de portaria — deixar opcional ali seria um caminho sem sentido operacional.

## 5.6 O custo da frota não é contaminado

- [ ] Abrir **Custos da Frota / Análise** e conferir que a despesa da viagem sem
      veículo **não** aparece atribuída a nenhum veículo (ela é de indivíduo).
- [ ] O **Monitor da Frota** continua carregando normalmente.

---

## Desfazer

- [ ] Cancelar a viagem de teste (Registro de Viagem → viagem → **Cancelar**).
