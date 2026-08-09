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

## 3.2 ⭐ Quando o departamento vem do LOGIN, a tela avisa

Este é o elo frágil: o login PADRÃO é do **posto** (caixa/portaria), não da pessoa.

**Usuário:** `agrounai` (PADRAO, REGISTRADOR_FROTA, departamento **Agroveterinaria**).

- [ ] Abrir **Registro de Viagem** sem informar matrícula ainda.
- [ ] O campo resolve para **Agroveterinaria** (o departamento do login) e aparece o
      aviso **"veio do departamento do login, não do colaborador — confira"**.
- [ ] Como **Agroveterinaria não tem ninguém** com Supervisor de Departamento,
      aparece também:
      *"⚠ … não tem ninguém com o papel de Supervisor de Departamento — as despesas
      ficariam pendentes sem quem aprovasse."*
- [ ] **Corrigir na tela**: escolher **Tecnologia da Informacao** no seletor. O aviso
      some e passa a mostrar o nome do aprovador.

> ⚠️ **O seletor fica desabilitado até o condutor ser validado** — e `agrounai` é login
> PADRÃO, que exige **matrícula + senha reais** do portal RH. Sem credencial real dá
> para **ver** o aviso (é o que importa aqui), mas não para **corrigir**. Para exercitar
> a correção sem senha, use um login INDIVIDUAL (`condutor_ind`) e troque o
> departamento no seletor.

> É a diferença entre o desenho antigo e o novo: antes, a despesa simplesmente ia
> para o supervisor do veículo e ninguém ficava sabendo. Agora quem registra vê e
> corrige **no instante em que tem a informação na mão**.

### O contraste que fecha o caso: mesmo fallback, com aprovador

**Usuário:** `raydeborges` (INDIVIDUAL, Supermercado, filial 02, senha `Temp@123`).
Ela **não tem matrícula** em `core.usuarios`, então o departamento também vem do
**login** — mas o Supermercado **tem** aprovadora.

- [ ] O campo resolve para **Supermercado** e mostra **"Aprovado por *Renata
      Borges*"**, sem o alerta vermelho.
- [ ] Compare com o `agrounai` acima: mesma origem (LOGIN), desfechos opostos. O que
      muda não é o caminho, é o **cadastro** — e a tela deixa isso visível.

> Isto também é o argumento a favor de **exigir matrícula no cadastro do usuário**
> (item de integridade ainda pendente): com matrícula, `raydeborges` cairia no
> departamento da pessoa e o fallback nem seria exercitado.

## 3.3 A aprovação respeita o departamento gravado

> ✅ **Desbloqueado em 09/08** (`b8a9f0c`): a listagem passou a usar a mesma
> fonte da aprovação. Antes o supervisor aprovava o que não conseguia ver.

Com uma despesa lançada na viagem do cenário 3.1 (departamento **T.I.**):

- [ ] Entrar como **`supdept01`** (SUPERVISOR_FROTA do **T.I.**) → **Custos da
      Frota / Despesas** → a despesa PENDENTE aparece e **é possível aprovar**.
- [ ] Entrar como **`lidyanerocha`** (SUPERVISOR_FROTA de **Vendas/FBR**, filial 18)
      → a mesma despesa **não** deve ser aprovável por ela.
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
