# 4 · Acerto pelo desktop com login PADRÃO (5a)

**Valida:** commit `7f2d3b55`.
**Tela:** `https://localhost/entregas/` → **Registro de Viagem** → abrir uma viagem.
**Tempo:** ~15 min.

> ### 🔴 Este roteiro exige uma credencial REAL do portal RH
> O gate de identificação valida **matrícula + senha no Protheus de produção**. Não
> há como simular: sem a senha de um colaborador de verdade, o cenário 4.2 não roda.
> Combine com alguém que possa digitar a própria senha, ou pule para os cenários 4.1
> e 4.4, que não dependem dela.

> **O relato era** "a opção de acerto só existe para perfil INDIVIDUAL". A causa não
> era o perfil: a identificação do condutor exigia a viagem **EM_CURSO**, e o acerto
> acontece **depois** de entregar o veículo — viagem já CONCLUÍDA. Quem usa login de
> caixa não conseguia sequer se identificar para prestar contas.

---

## Preparação

- [ ] Como `condutor_ind` (ou qualquer INDIVIDUAL), registrar uma viagem **com
      veículo** e depois **registrar o retorno** — ela precisa ficar **CONCLUÍDA**
      com o **acerto ainda aberto**.
- [ ] Anotar o **número da viagem** e a **matrícula do condutor** que ficou gravada.

## 4.1 O gate aparece para quem usa conta compartilhada

**Usuário:** `condutor_col` (**PADRAO**, senha `123456`).

- [ ] Abrir a viagem preparada acima. Aparece o aviso âmbar:
      *"Login compartilhado: para lançar o acerto, o **condutor** desta viagem precisa
      se identificar."*, com os campos **Matrícula** e **Senha** e o botão
      **Identificar**.
- [ ] Entrando como `condutor_ind` (**INDIVIDUAL**) na mesma viagem, **o gate não
      aparece** — a conta já é da pessoa.

## 4.2 🔴 Identificação (precisa da senha real)

- [ ] Digitar a matrícula do condutor da viagem + **senha real** → **Identificar**.
- [ ] Aparece a faixa verde **"✓ Identificado como *Fulano* — lançamentos deste
      acerto ficam no nome dele."**
- [ ] **Senha errada** → mensagem *"Matrícula ou senha inválidas."* e **a sessão
      continua** (não pode cair para a tela de login — 401 aqui derrubaria o usuário).
- [ ] **Matrícula de outra pessoa** → *"Esta matrícula não é a do condutor desta
      viagem."* O token é preso à dupla {viagem, condutor}.

## 4.3 O que a identificação libera

Ainda como `condutor_col`, já identificado — **tudo na própria tela da viagem**:

- [ ] **Lançar** uma despesa na viagem → grava (nasce PENDENTE).
- [ ] Na lista **"Despesas lançadas"**, usar **editar** para corrigir o valor → grava.
- [ ] Usar **excluir** na mesma linha → confirma e some.
- [ ] **Editar o adiantamento** da viagem → grava.

> Antes, nada disso era possível pelo desktop com conta de caixa: a autoridade vinha
> da **conta**, e a conta é compartilhada. Agora vem da **pessoa** que digitou a senha.
>
> ⚠️ **Editar e excluir só ganharam tela em 09/08** (`d0...`), depois que esta execução
> mostrou o buraco: o backend já aceitava, mas a lista de despesas da viagem **não tinha
> ação nenhuma** — a única edição existia em *Custos da Frota*, que é de gestor. O
> condutor identificado só conseguia **incluir**, e era metade do que o 5a pedia
> ("incluir/editar/excluir despesa e adiantamento").

## 4.4 A conta de caixa, sozinha, não basta

- [ ] Recarregar a página (o token do condutor se perde) e tentar **lançar despesa**
      sem se identificar → recusa com *"Identifique o condutor desta viagem
      (matrícula + senha) para continuar."*
- [ ] ⭐ Tentar **editar o adiantamento** sem se identificar → recusa com
      *"Identifique o condutor desta viagem (matrícula + senha) para alterar o acerto."*

> **Este segundo item nasceu de um gap achado aqui em 09/08** (`9f...`): a despesa era
> recusada, mas o **adiantamento passava**. Como a saída foi registrada pela conta de
> caixa, ela contava como "dono" da viagem — a autoridade vinha da CONTA, não da PESSOA,
> que é exatamente o que o 5a existe para impedir. Corrigido: no login PADRÃO, ser quem
> registrou a saída **não basta**.
>
> No login **INDIVIDUAL** nada muda: quem registrou a saída continua ajustando a própria
> viagem sem token — ali a conta **é** a pessoa.

## 4.5 Encerrar o acerto fecha para todos

- [ ] Como `supdept01` ou `gfrota01`, na mesma viagem → **🔒 Encerrar acerto**.
- [ ] Voltar como `condutor_col` e tentar se identificar → recusa:
      *"Acerto encerrado — reabra o acerto para lançar."*
- [ ] **Reabrir acerto** devolve o caminho.

> O que trava o financeiro é o **acerto encerrado**, não a conclusão da viagem — que
> era justamente a confusão que impedia o PADRÃO de prestar contas.

---

## Desfazer

- [ ] Excluir as despesas de teste e cancelar/ignorar a viagem preparada.
