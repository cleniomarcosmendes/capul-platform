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

## 2.2 Quando não há ninguém, a tela diz o que fazer

- [ ] Trocar a filial do veículo para uma **sem** Supervisor de Departamento
      cadastrado. Em vez de um seletor vazio e mudo, aparece:
      *"Nenhum usuário desta filial tem papel de frota. Cadastre um Supervisor de
      Departamento em Configurador → Usuários → Permissões (módulo Logística)."*

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
