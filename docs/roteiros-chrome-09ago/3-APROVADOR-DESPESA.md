# 3 · Quem aprova a despesa (5b — a decisão-mãe)

**Valida:** commits `1db1ce0c` (backend) e `41388562` (tela).
**Tela:** `https://localhost/entregas/` → **Registro de Viagem**.
**Tempo:** ~20 min. **Pré-requisito:** backend rebuildado (migration nova).

> **A questão de fundo, nas suas palavras.** *"Se o usuário sair com um veículo cujo
> chefe imediato não está como supervisor no cadastro do veículo, será outro gerente
> — que não tem nenhuma relação com ele — que vai aprovar as despesas, simplesmente
> porque ele usou aquele veículo."*
>
> A despesa é da **pessoa**, não do carro. O aprovador passou a sair da **permissão**
> (papel + departamento) e o departamento é **congelado na viagem** no ato da saída.

---

## 3.1 A saída mostra quem vai aprovar — resolvido pela PESSOA

**Usuário:** `condutor_ind` (INDIVIDUAL, matrícula E01047, senha `123456`).
*Login INDIVIDUAL dispensa a senha do portal RH — por isso ele abre este roteiro.*

- [ ] **Registro de Viagem** → o formulário tem o campo **"Departamento que responde
      pelas despesas"**, abaixo do "Departamento solicitante".
- [ ] Ele vem **preenchido sozinho** com o departamento do colaborador (T.I.), e
      abaixo aparece **"Aprovado por *Supervisor de Depto 01*"** — o nome de quem vai
      aprovar, antes de a viagem existir.
- [ ] Escolher veículo + KM e **registrar**. A viagem nasce com esse departamento
      gravado.

> ⚠️ **Só há 1 veículo DISPONÍVEL na filial 01.** Ao registrar, ele vai para EM_USO e
> some da lista até o retorno. **Registre o retorno ao terminar** — senão o roteiro 4,
> que precisa de uma viagem com veículo, fica sem carro para usar.

## 3.2 As três origens do departamento — medidas por API antes de te entregar

O campo diz de ONDE veio o departamento. É isso que permite ao operador desconfiar.

**a) Sem matrícula no cadastro → cai no LOGIN.** Usuário: `admin` (não tem matrícula).
- [ ] Abrir **Registro de Viagem**. O campo resolve para **Tecnologia da Informacao**,
      mostra **"Aprovado por Supervisor de Depto 01 (TESTE)"** e o aviso
      **"veio do departamento do login, não do colaborador — confira"**.

**b) Departamento sem ninguém com o papel → alerta.** Ainda como `admin`:
- [ ] No seletor, escolher **Agroveterinaria**. Aparece:
      *"⚠ Agroveterinaria não tem ninguém com o papel de Supervisor de Departamento —
      as despesas ficariam pendentes sem quem aprovasse."*
- [ ] Voltar para **Tecnologia da Informacao** → o alerta some e o aprovador reaparece.

**c) Com matrícula → resolve pela PESSOA.** Usuário: `condutor_ind` (matrícula E01047):
- [ ] O campo mostra **Tecnologia da Informacao** **sem** o aviso de "veio do login" —
      porque veio do colaborador.

> **Corrigido em 09/08, medindo:** a prévia usava só a matrícula **digitada**, e login
> INDIVIDUAL não digita nenhuma — então ela dizia "veio do login" enquanto a saída
> gravava o departamento do colaborador. A tela avisava o **contrário** do que ia
> acontecer. Agora a prévia resolve a matrícula do cadastro, como a saída faz.

## 3.3 A aprovação respeita o departamento gravado

> ✅ **Desbloqueado em 09/08** (`c774210e`): a listagem passou a usar a mesma
> fonte da aprovação. Antes o supervisor aprovava o que não conseguia ver.

Com uma despesa lançada na viagem do cenário 3.1 (departamento **T.I.**):

- [ ] Entrar como **`supdept01`** (SUPERVISOR_FROTA do **T.I.**) → **Custos da
      Frota / Despesas** → a despesa PENDENTE aparece e **é possível aprovar**.
- [ ] **O negativo que vale** — um SUPERVISOR_FROTA da **mesma filial** e de **outro
      departamento**. Não existe um na base, então crie: `admin` → Configurador →
      `condutor_ind` → adicionar perfil **Logística / Supervisor de Departamento /
      Administrativo**. Entrar como `condutor_ind` (`123456`):
      - a despesa da viagem deste roteiro (departamento **T.I.**) **não aparece** na
        lista dele;
      - ele **vê** as despesas do veículo `TST0A01`, que é lotado no **Administrativo** —
        é o departamento dele, então está certo;
      - tentando aprovar a despesa de T.I. por URL/API, recebe *"Apenas o supervisor de
        departamento do condutor aprova o acerto."*
      - **remover o perfil** ao terminar.

> ⚠️ **Não use `lidyanerocha` para este negativo** (era o que este roteiro pedia antes).
> Ela é da **filial 18** e a despesa é da **01**: a recusa viria do filtro de FILIAL
> (`despesa.service.ts:654`), que dispara **antes** de qualquer regra de departamento.
> O teste passaria mesmo com o 5b quebrado — prova a coisa errada.
- [ ] Entrar como **`gfrota01`** (GESTOR_FROTA) → consegue **contestar** (controle de
      frota), mas **não aprovar** o acerto: a mensagem explica que aprovar é do
      supervisor do departamento do condutor.

## 3.4 O retrato não se move depois

- [ ] No Configurador, **trocar o departamento** de `condutor_ind` para outro.
- [ ] Voltar à viagem já registrada em 3.1: o departamento aprovador **continua o
      mesmo**, e quem aprova continua sendo o de antes.
- [ ] Uma viagem **nova** já nasce com o departamento novo.

> É a regra 3 do RDV aplicada aqui: *a decisão vale para o valor decidido*. Sem o
> congelamento, mexer no cadastro de alguém moveria, calado, a autoridade sobre
> dinheiro que já estava em curso.

---

## Desfazer

- [ ] Devolver o departamento original de `condutor_ind` no Configurador.
- [ ] Cancelar as viagens de teste (Registro de Viagem → viagem → **Cancelar**).
