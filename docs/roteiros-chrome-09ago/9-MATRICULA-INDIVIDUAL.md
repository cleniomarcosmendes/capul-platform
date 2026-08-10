# 9 · Matrícula obrigatória no usuário INDIVIDUAL

**Valida:** commit `29ef71ef`. **Tela:** `https://localhost/configurador/` → Usuários.
**Tempo:** ~10 min. **Usuário:** `admin`/`admin123`.
**Pré-voo:** `auth-gateway` e `configurador` rebuildados + **Ctrl+Shift+R**.

> **Por que.** A matrícula é o que liga o login à **pessoa** no Protheus — e é dela que a
> Logística tira o **departamento que responde pelas despesas** (5b). Sem ela o sistema
> cai no departamento do **login**, que é o do POSTO (caixa/portaria), não o de quem
> gastou. Até 09/08 só era exigida quando "autentica pelo portal RH" estava ligado:
> **120 dos 127** usuários INDIVIDUAL estão sem matrícula.

---

## 9.1 O campo passou a ser obrigatório — e a tela diz por quê

- [ ] **Usuários → Novo**. Com **Tipo = Individual**, o rótulo mostra **"Matrícula *"**.
- [ ] Com o campo vazio, aparece o aviso: *"É a matrícula que liga este login à pessoa no
      Protheus. Sem ela, a Logística não sabe de quem é a despesa e cai no departamento
      do login."*
- [ ] Tentar **salvar** sem matrícula → barra, com a mensagem mandando usar a busca por
      nome.

## 9.2 A busca do Protheus preenche em dois cliques

Sem isto a exigência seria um fardo — quem cadastra sabe o nome, não a chapa.

- [ ] No campo **"ou busque o funcionário pelo nome (Protheus)"**, digitar um nome e
      escolher da lista.
- [ ] A **matrícula é preenchida sozinha**, e o aviso some.

## 9.3 PADRÃO continua sem exigir — e está certo

- [ ] **Tipo = Padrão (compartilhado)**: o asterisco **some** e o formulário salva sem
      matrícula.

> O login PADRÃO é de um **posto** (caixa, portaria), não de uma pessoa. Exigir matrícula
> ali seria pedir a chapa de quem não existe — a pessoa se identifica a cada uso.

## 9.4 ⭐ Chapa duplicada é barrada, dizendo de quem é

A chapa normaliza pelos **5 últimos dígitos**: `1047`, `001047` e `E01047` são a mesma.

- [ ] Criar um INDIVIDUAL com matrícula **`1047`** → recusado:
      *"A matrícula 1047 resulta na mesma chapa (E01047) de Clenio M. Mendes (TESTE
      INDIVIDUAL) (condutor_ind)…"*
- [ ] Trocar para uma matrícula não usada → salva.

> **Isto veio de um defeito real.** Em 09/08 `condutor_ind` (`E01047`) e `supdept01`
> (`001047`) colidiam, e o departamento aprovador de um era lido da ficha do outro —
> trocar o departamento no cadastro não mudava nada. Barrar na entrada é onde o conserto
> é barato.

## 9.5 A regra vale no SERVIDOR, não só na tela

Foi a lição do dia: validação de tela não é regra.

- [ ] Pelo DevTools, enviar direto (o formulário nem deixaria chegar aqui):

```js
await fetch('/api/v1/core/usuarios', { method: 'POST',
  headers: { 'Content-Type': 'application/json',
             Authorization: 'Bearer ' + localStorage.getItem('accessToken') },
  body: JSON.stringify({ username: 'zz_teste', nome: 'Teste', senha: 'Teste@123',
    tipo: 'INDIVIDUAL', departamentoId: '<id de um depto>', filialPrincipalId: '<id da filial 01>' })
}).then(r => r.json())
```

- [ ] Recusado com a mesma mensagem da tela.
- [ ] Repetir com `matricula: '1047'` → recusado pela colisão de chapa.

## 9.6 Editar um usuário antigo sem matrícula

- [ ] Abrir um dos 120 INDIVIDUAL sem matrícula e mudar **qualquer** campo (ex.: e-mail).
- [ ] O save **exige a matrícula** antes de concluir.

> **É o efeito conhecido e desejado**: o cadastro se corrige à medida que os usuários são
> editados. Se isso atrapalhar a operação, é decisão do Clenio afrouxar para "obrigatória
> só na criação" — mas aí os 120 permanecem sem, e o 5b segue caindo no login para eles.

---

## Desfazer

- [ ] Excluir/ignorar os usuários de teste criados (`zz_teste` e afins).
- [ ] Nenhum cadastro existente precisa ser revertido — matrícula preenchida é ganho.
