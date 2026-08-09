# Logística — pauta levantada pelo Clenio (08/08/2026)

Cinco pontos vindos dos **testes dos usuários**. O corpo do documento é o relato e o
raciocínio do Clenio, preservados como foram ditados em 08/08.

> **Estado (09/08):** os pontos **3, 4 e 5 estão DECIDIDOS** — ver
> [Decisões de 09/08](#decisões-de-0908--pontos-3-4-e-5) no fim do documento.
> Nada implementado ainda. Pontos 1 e 2 seguem em aberto.

⚠️ Os pontos **1, 3, 4 e 5 se cruzam**: todos tocam quem responde pelo veículo,
pela viagem e pelas despesas. Vale desenhar os quatro juntos antes de mexer em
qualquer um — mudar um isolado provavelmente contradiz outro.

---

## 1. KM inicial e final na Entrega + amarrar com a viagem do veículo

Ajustar o apontamento de KM inicial e final, **e amarrar as entregas à viagem do
veículo, para o controle de frota**.

➡️ O levantamento técnico já está feito em **`docs/ANALISE_ROTA_KM_ENTREGA.md`**
(KM opcional nas duas pontas, sem trava de rota simultânea, e a causa: o KM
"de verdade" nasceu na Frota e a Entrega ganhou campos próprios como opcionais).

**Novo aqui:** a amarração Entrega ↔ viagem de frota não estava naquele
levantamento. É o que fecha o KM para o custo de frota.

---

## 2. Data de entrega no lançamento

Há locais de entrega atendidos em **dias específicos** — a rota daquela região só
passa em certos dias.

- Campo **data de entrega** no lançamento, **preenchido com o dia atual** por padrão.
- Na **montagem da rota**, ordenar por data de entrega.
- Se o usuário selecionar uma entrega **fora do dia atual**, o sistema **alerta**
  (avisa, não bloqueia — o relato é de alerta).

---

## 3. "Saída de Veículo" pode não ter veículo

Os usuários fazem o **ACERTO DA VIAGEM** de viagens realizadas **sem o veículo da
empresa** — outro meio de transporte. Nesse caso o registro é só **prestação de
contas** (adiantamento e despesas).

**Sugestão do Clenio:** renomear **"Saída de Veículo" → "Registro de Viagem"**, e
nesse registro o **veículo passa a ser opcional**.

⚠️ Verificar o efeito no **custo de frota**: viagem sem veículo não pode entrar no
rateio por veículo. Há precedente — no RDV, `veiculoId = null` significa
INDIVÍDUO ([[project_despesa_rdv_vs_custos_frota]]).

---

## 4. 🐞 "Gestor de Entrega" como Supervisor Responsável não aprova despesa

**Relato:** usuário com papel **GESTOR_ENTREGA** estava como **"Supervisor
Responsável"** no cadastro do veículo — e **não conseguia acompanhar nem aprovar
as despesas** daquele veículo.

**Contorno que ele fez:** criou outro usuário com papel **SUPERVISOR_FROTA**
("Supervisor de Departamento"), pôs esse como Supervisor Responsável do veículo,
e então funcionou.

Ou seja: o campo aceita um usuário que **não tem o papel necessário** para exercer
a função — e não avisa. Ver [[project_supervisor_departamento_frota]].

---

## 5. Perfil PADRÃO sem acesso ao acerto — e QUEM aprova a despesa

### 5a. O acesso
Usuário com perfil **PADRÃO** usa o app e se identifica com **matrícula e senha**
do colaborador a cada viagem — isso está correto e é o desenho atual
([[feedback_entrega_registrador_padrao_tipo]]).

O problema: esse mesmo usuário **pode precisar fazer o acerto pelo DESKTOP**, em
"Saída de Veículo" → **ACERTO**, onde se registram despesas e adiantamento. Hoje
essa opção só existe para perfil **INDIVIDUAL**.

**Sugestão do Clenio:** liberar o acerto para o perfil PADRÃO **mediante matrícula
e senha**, com a trava de que **só quem digitou a matrícula/senha e o supervisor
do departamento** possam incluir/editar/excluir despesa e adiantamento — cabendo
ao supervisor aprovar.

### 5b. ⭐ A questão de fundo: o aprovador vem do VEÍCULO, não da pessoa

Observação dele, e é a mais importante da pauta:

> *"se o usuário sair com um veículo cujo chefe imediato não está como
> 'supervisor' no cadastro do veículo, será outro gerente — que não tem nenhuma
> relação com ele — que vai aprovar as despesas, simplesmente porque ele usou
> aquele veículo."*

O aprovador é derivado do **cadastro do veículo** (`veiculo.supervisorId`). Mas a
despesa é **da pessoa**, não do carro. Pegar um veículo de outro departamento
manda a aprovação para alguém sem relação hierárquica com quem gastou.

⚠️ **Já houve decisão análoga no RDV**: o responsável do departamento saiu do
cadastro do veículo para um **cadastro específico de aprovação**. O Clenio lembrou
disso sozinho ao escrever o ponto — vale recuperar como aquilo foi resolvido lá e
avaliar o mesmo caminho aqui.

---

## Como atacar (sugestão de ordem, a validar)

1. **Desenhar juntos os pontos 3, 4 e 5** — são o mesmo assunto: quem responde
   pela viagem e pela despesa. O 5b é a decisão-mãe; os outros dois dependem dela.
2. **Ponto 1** (KM) — levantamento pronto, mas a amarração com a viagem de frota
   depende do que sair do item anterior.
3. **Ponto 2** (data de entrega) — é o mais independente e o de menor risco.
   Pode sair antes, se quiser entrega rápida.

---
---

# Decisões de 09/08 — pontos 3, 4 e 5

Fechadas em conversa com o Clenio. Cada afirmação técnica abaixo foi **verificada
no código ou no banco**, com a referência ao lado. Nada implementado ainda.

## A decisão-mãe (5b): o aprovador sai da PERMISSÃO, não do veículo

> **Aprovador da despesa = quem tem `SUPERVISOR_FROTA` na permissão de Logística
> do departamento da PESSOA que gastou** — gravado na viagem no ato da saída.

**Sem tabela nova, e sem encostar no RDV.** O cadastro que o Clenio descreveu
("marco o ROLE de supervisor de departamento e ele responde por quem está no mesmo
departamento") **já existe**: `core.permissoes_modulo` é (usuário × módulo ×
**departamento** × role), e para a Logística o `departamento_id` da permissão já é
o departamento do próprio usuário — conferido, **23 de 23 linhas iguais**.

Isso respeita o aviso escrito no schema (`logistica/backend/prisma/schema.prisma:848`):
*"A frota continua usando `veiculo.supervisorId` (lá o significado é o correto) —
não unificar as duas de novo"*. A fonte usada aqui é uma **terceira** (o cadastro do
usuário), como o Clenio pediu — o RDV segue com a `supervisor_departamento` dele.

⚠️ **Ler UMA fonte só: a `permissoes_modulo`.** O `departamento_id` da permissão é um
*retrato do momento da concessão* — se o departamento do usuário mudar depois, a linha
da permissão fica com o antigo (hoje 0 divergências, mas nada impede). Lendo role e
departamento da mesma linha, os dois não podem discordar entre si.

### Como se resolve o departamento da pessoa, na saída

1. **matrícula → `core.usuarios.matricula` → `departamento_id`** — cobre todo usuário.
2. **fallback: departamento do login** — para o colaborador que registra pela
   matrícula e **não é usuário** da plataforma (caso real: todo condutor é
   funcionário, nem todo funcionário é usuário).
3. **o campo é MOSTRADO e CORRIGÍVEL na tela de saída**, e gravado na viagem.

O passo 3 é o que fecha o buraco do fallback: o departamento do **login** é o do
*posto*, não o da pessoa — `portaria01` está em "Tecnologia da Informacao", então um
colaborador da Agroveterinária que sai pela portaria teria a despesa aprovada pelo
supervisor errado. É o mesmo defeito do 5b (aprovador vindo de onde a pessoa
*passou*), só deslocado do veículo para o caixa. Quem registra tem a informação na
mão naquele instante — então corrige ali.

### ❌ Descartado: mapa centro de custo → departamento

Seria o caminho para achar o departamento do não-usuário via Protheus (o
`infoFuncionario` **já devolve o `cc`** e o `buscarNome` o descarta —
`logistica/backend/src/protheus/protheus-condutor.service.ts:74` × `:99`, a família de
defeito "cliente descarta campo que o backend manda"). Descartado por dois motivos:

- **Não há chave de tradução.** `core.departamentos.codigo` está **vazio em todas as
  linhas** — e o formulário de departamento do Configurador **nem tem esse campo**
  (`configurador/src/pages/departamentos/DepartamentosPage.tsx` só exibe código de
  *filial*). Os códigos Protheus estão em `core.centros_custo` (60 linhas), e os nomes
  não batem sozinhos ("INFORMATICA" × "Tecnologia da Informacao").
- **Centro de custo é do Workspace, não da Logística** (confirmado pelo Clenio e no
  banco): as únicas FKs para `core.centros_custo` são `gestao_ti.nota_fiscal_itens`,
  `parcela_rateio_itens` e `rateio_template_itens`; a Logística não tem **nenhuma**
  referência. Construir o mapa arrastaria um conceito de outro módulo para cá.

Com o passo 3 corrigível na tela, ele deixa de ser necessário — não é adiamento.

## Os três silêncios da derivação, e o que fazer com cada um

Autoridade **derivada** falha calada — foi por isso que o RDV saiu da derivação. Como
aqui a derivação foi mantida (por decisão), cada silêncio tem tratamento:

| Silêncio | Tratamento |
|---|---|
| Departamento sem ninguém com `SUPERVISOR_FROTA` → despesa fica PENDENTE para sempre | **Alerta na saída**, nomeando o aprovador ("as despesas serão aprovadas por: Fulano — Agroveterinária") e avisando quando não houver ninguém |
| Trocar o departamento do usuário transfere autoridade sobre dinheiro alheio | **Gravar o departamento aprovador na viagem** (snapshot). Vale a regra 3 do RDV: *a decisão vale para o valor decidido*. Troca de departamento afeta só viagens novas |
| Dois usuários com `SUPERVISOR_FROTA` no mesmo departamento | **É desejado** (decisão do Clenio: departamento pode delegar a mais de um). Já permitido pelo modelo |

**❌ Descartado: impedir a troca de departamento enquanto houver acerto pendente**
(ideia inicial do Clenio, substituída pelo snapshot). Exigiria o Configurador
(auth-gateway) consultar a Logística sobre acerto aberto — atravessa o isolamento
entre módulos (`core` é read-only para a logística) — e a trava cairia sobre a pessoa
errada: o RH move alguém de setor e o cadastro trava por causa de despesa de terceiro.
O snapshot resolve com uma coluna, sem acoplamento.

## Ponto 4 — é bug de validação, e o molde da correção já existe

`logistica/backend/src/veiculo/veiculo.service.ts:95` chama
`core.validarUsuario(dto.supervisorId, 'Supervisor')`, que só checa **se o usuário
existe** — não olha papel. Por isso o campo aceitou um `GESTOR_ENTREGA` e não avisou.

O molde está no mesmo arquivo de lookup: `core.assertEntregador()`
(`src/core/core-lookup.service.ts:163`) valida papel + filial + status ativo e recusa
com mensagem clara. Foi criado exatamente porque *"a validação de existência não
pegava isso"*. É replicar para o campo Supervisor.

## Ponto 3 — "Registro de Viagem", veículo opcional

`Viagem.veiculoId` **já é nullable** (`schema.prisma:609`) e despesa sem veículo já
tem semântica: **INDIVÍDUO**. O que exige veículo é o fluxo da saída (`criarSaida`
busca o veículo, exige DISPONÍVEL→EM_USO e valida KM).

Sem veículo: não mexe na situação do veículo, não pede KM, e as despesas nascem como
INDIVÍDUO — **fora do rateio por veículo**, como no RDV.

⚠️ **Colide com o ponto 5a:** hoje despesa de INDIVÍDUO só o GESTOR_FROTA/ADMIN gere
(`src/despesa/despesa.service.ts:265-269`). Como o 5a quer o acerto na mão de quem
digitou matrícula+senha e do supervisor do departamento, essa regra precisa passar a
usar o **departamento gravado na viagem** — que é justamente o que a decisão-mãe cria.

## ⭐ O "ROLE único da Logística" — a causa é uma linha, e não é da plataforma

A preocupação do Clenio ("na Logística só cabe um ROLE, diferente do Workspace") é
real na prática, mas o limite **não é da plataforma**:

- `core.permissoes_modulo` tem UNIQUE em **(usuario_id, modulo_id, departamento_id)** —
  a plataforma modela **uma role por departamento, por módulo**.
- O JWT já carrega `modulos[].departamentos[]`, cada um com role e funcionalidades
  próprias (`auth-gateway/src/auth/helpers/build-modulos-payload.ts:96-113`). O campo
  `role` no nível do módulo está documentado ali como *"role denormalizada = a do
  primeiro depto, MANTIDA por retrocompatibilidade; consumidores antigos leem este
  campo; serão migrados pra iterar `departamentos[]`"*.
- **A causa mecânica:** `configurador/src/pages/usuarios/UsuarioFormPage.tsx:43` —
  `const MODULOS_COM_DEPARTAMENTO = ['WORKSPACE']`. Para os demais módulos a coluna
  Departamento é escondida e o save **atribui o departamento do próprio usuário**
  (linha 313). Como o UNIQUE inclui o departamento e a Logística grava sempre o mesmo,
  a segunda permissão **colide**. O Workspace não tem nada de especial — só está nessa
  lista.

### 🔴 Bug latente (dormindo hoje)

A Logística nunca migrou: resolve papel pelo campo legado em **4 pontos** —
`src/common/guards/roles.guard.ts:23-26` (o guard por onde passam todas as rotas),
`src/despesa/despesa.controller.ts:23` e `src/frota/frota.controller.ts:8` (helpers
`roleLogistica()`), e no front `logistica/frontend/src/contexts/AuthContext.tsx:78`.

Se alguém der a um usuário de Logística uma **segunda** permissão noutro departamento,
o módulo inteiro passa a usar **calado** a role do primeiro departamento da lista.
Hoje todos têm exatamente 1 permissão → está dormindo. Mesma assinatura dos achados do
inventário desta semana: *a regra existe num caminho e o outro passa ao largo*.

### Avaliação de risco da migração multi-role (pedida pelo Clenio)

**Superfície menor do que parecia:** 4 pontos de resolução (3 backend + 1 frontend).
Os services recebem `role` como parâmetro — não re-derivam. *(Estimativa anterior de
"9 pontos + RBAC de tudo" estava errada: os 9 eram chamadas dos mesmos 2 helpers.)*

**Risco: baixo no código, médio no comportamento** — o guard atende todas as rotas do
módulo. Dois lugares semânticos merecem atenção:

- `mod.role === 'ADMIN' || required.includes(mod.role)` vira "qualquer um dos meus
  papéis satisfaz" — simples, mas **alarga acesso**. É onde a suíte (264 testes) fala.
- Escopo: `if (role === 'SUPERVISOR_FROTA')` + filtro por departamento vira "em
  **qual** departamento eu sou SUPERVISOR_FROTA" — que é o que `departamentos[]`
  responde. **Simplifica** o `deptosDoSupervisor()`, que hoje consulta a tabela do RDV.

**Ordem recomendada:** multi-role **primeiro**, em commit próprio. Não é pré-requisito
da decisão-mãe, mas **sem ele o ponto 4 não tem correção honesta** — sobra o contorno
de criar um segundo usuário. E a mudança de aprovação vai ler o mesmo array.
Gates: suíte + `/security-review` antes de deploy.

## Item de integridade (Configurador)

**Matrícula obrigatória para usuário `tipo = INDIVIDUAL`.** Hoje
`configurador/src/pages/usuarios/UsuarioFormPage.tsx:352` só exige matrícula quando
`autenticaPortal` está ligado. Decisão do Clenio: a base atual é de teste, e a
inconsistência não deve guiar o desenho — corrigir o cadastro antes de produção.
Isso ainda mata paliativos já registrados (frota e RDV pedindo matrícula porque o
usuário não tem).
