# 2 · Supervisor responsável do veículo (ponto 4)

**Valida:** commit `396aefd9`.
**Tela:** `https://localhost/entregas/` → **Veículos** → novo/editar.
**Tempo:** ~10 min. **Pré-requisito:** nenhum (o roteiro 1 ajuda no cenário 2.4).

> **O relato.** Um usuário com papel **GESTOR_ENTREGA** foi posto como "Supervisor
> Responsável" no cadastro do veículo — e não conseguia acompanhar nem aprovar as
> despesas daquele veículo. O campo aceitava quem **não tinha o papel** para exercer
> a função, e não avisava. A saída foi criar um segundo usuário.
>
> Ser `supervisorId` **é** a concessão de gerir o veículo; o cadastro só checava se o
> usuário **existia**.

---

## 2.1 O campo só oferece quem pode exercer

**Usuário:** `gfrota01` (GESTOR_FROTA, senha `123456`) → **Veículos → Novo**.

- [ ] Abrir o seletor **Supervisor responsável**. A lista traz **poucos nomes**, e
      cada um vem com o **papel ao lado** (Supervisor de Departamento / Gestor de
      Frota / Administrador).
- [ ] **`supdeptb`, `condutor_ind`, `raydeborges` e afins NÃO aparecem** — não têm
      papel de frota. Antes o campo listava a **filial inteira**, e era exatamente
      daí que vinha o erro.
- [ ] Escolhendo a filial **01**, aparecem `supdept01` (Supervisor de Departamento),
      `gfrota01` e `admin`. Gestor de Frota e Admin aparecem em **qualquer** filial
      (a frota é da empresa toda); Supervisor de Departamento só na filial dele.

> ⚠️ **Se `supdeptb` aparecer**, provavelmente o "Desfazer" do roteiro 1 não foi feito
> e ele ficou com SUPERVISOR_FROTA na filial 02 — nesse caso a tela está **certa** e o
> que está errado é o estado do cadastro. Confira no Configurador antes de reprovar.

## 2.2 Filial sem supervisor próprio → sobram só os cross-filial

> **Correção de 09/08:** este item pedia antes para provocar o aviso *"Nenhum usuário
> desta filial tem papel de frota"*. **Não é reproduzível neste cadastro**: `ADMIN` e
> `GESTOR_FROTA` valem em **qualquer** filial (a frota é da empresa toda), então a
> lista nunca fica vazia enquanto existir um deles. O aviso é defesa para um estado
> que a plataforma não tem. No lugar, vale conferir a regra que **é** observável:

- [ ] Trocar a filial do veículo para a **05**, que não tem Supervisor de
      Departamento próprio.
- [ ] A lista mostra **só** `ADMIN` e `GESTOR_FROTA` (Administrador, Clenio Mendes,
      Gestor de Frota 01, Marcelo) — **nenhum** Supervisor de Departamento.
- [ ] Voltar para a filial **01**: `supdept01` **reaparece**. Confirma que o filtro do
      Supervisor de Departamento é **por filial**, e o dos gestores não é.

## 2.3 O backend recusa, mesmo se o campo for burlado

O seletor previne; a regra tem de existir no servidor também.

- [ ] Salvar um veículo com supervisor válido → **grava**.
- [ ] *(Opcional, via DevTools/API)* enviar `supervisorId` de um usuário sem papel de
      frota → recusa com **"precisa ter o papel Supervisor de Departamento (ou Gestor
      de Frota) ativo na Logística"**.
- [ ] Enviar alguém com SUPERVISOR_FROTA de **outra filial** → recusa com mensagem
      **diferente**: *"tem o papel …, mas em outra filial"*. Os dois motivos pedem
      providências distintas — um se resolve no Configurador, o outro escolhendo
      outra pessoa.

## 2.4 ⭐ O supervisor que "sumiu" da lista não é apagado em silêncio

Cenário: alguém já gravado no campo perde o papel ou muda de filial.

- [ ] Editar um veículo cujo supervisor **não** esteja mais na lista de elegíveis
      (dá para provocar removendo, no Configurador, o papel de frota de quem está no
      campo — e depois devolvendo).
- [ ] O campo **não** aparece vazio: mostra
      **"⚠ supervisor atual — sem papel de frota nesta filial"**.
- [ ] Sem isso, o cadastro pareceria "sem supervisor" e salvar por cima o apagaria
      sem ninguém perceber.

---

## Desfazer

- [ ] Devolver, no Configurador, qualquer papel removido no cenário 2.4.
- [ ] Excluir/ignorar o veículo de teste criado em 2.1, se tiver salvado.
