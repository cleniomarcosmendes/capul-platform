# Auditoria — ADMIN e GESTOR no módulo Workspace

*25/08/2026. Motivo: ao corrigir o texto do papel no Configurador, o Clenio pediu para
conferir se ADMIN e GESTOR **se comportam** como o texto promete.*

**Resposta curta:** ADMIN é global **em parte** do módulo, não no módulo inteiro; GESTOR
é por departamento na LEITURA, mas escapa o departamento em algumas ESCRITAS; e há um
problema maior por baixo — **o Workspace só conhece UMA role por usuário**, mesmo quando
o usuário tem papéis diferentes em departamentos diferentes.

---

## 1. O escape do ADMIN não é uniforme (esperado — está documentado)

| Área | Quem escapa o filtro de departamento |
|---|---|
| Chamado, Projeto, Dashboard, Indicadores | **role ADMIN** (decisão D36) |
| Software, Licença, **Contrato**, **NF**, Ativo, Parada | **capability `OVERSIGHT_PLATAFORMA`** — D36 foi **revogado** aqui (decisão E1, 24/05) |

Em DEV, `OVERSIGHT_PLATAFORMA` está ativa **só para o usuário `admin`**. Ou seja: alguém
com papel ADMIN em um departamento **não** vê contrato/NF/ativo de outro — e isso é o
desenho pretendido, nascido do incidente Juliana.

➡️ Efeito prático: o texto do papel precisa dizer as duas metades. Foi o que a migration
`20260825140000` corrigiu — a versão anterior dizia só "enxerga TODOS os departamentos",
verdade pela metade.

---

## 2. 🔴 A role é UMA SÓ para o módulo inteiro — a do primeiro registro

`common/guards/gestao-ti.guard.ts:21`:

```ts
request.gestaoTiRole = modulo.role;   // role DENORMALIZADA
```

E `modulo.role` é montada assim (`auth-gateway/src/auth/helpers/build-modulos-payload.ts`):

> *"Role denormalizada — igual à role do primeiro depto em `departamentos[]`. MANTIDA por
> retrocompatibilidade (Sub-fase 1.4). Consumidores antigos (guards) leem este campo;
> serão migrados pra iterar `departamentos[]` na Sub-fase 1.5/1.6."*

O `findMany` que a alimenta **não tem `ORDER BY`** — "primeiro" é a ordem que o Postgres
devolver.

**Caso real na base de DEV:** `thiagopereira` = **Fiscal → ADMIN** + **T.I. → SUPORTE**.
A role denormalizada hoje resolve para **ADMIN**, e é ela que responde por:

- todo `@Roles(...)` do módulo (`roles.guard.ts:25`);
- todo `if (role === 'ADMIN' ...)` espalhado pelos serviços;
- o escape de departamento em chamado/projeto/dashboard/indicadores.

Ou seja, ele opera como **ADMIN dentro do T.I.**, onde a permissão dele é SUPORTE — e
enxerga chamados de departamentos onde não tem permissão nenhuma. Se a ordem virar (nada
garante que não vire), ele passa a ser **SUPORTE dentro do Fiscal**, onde é ADMIN, e
perde acesso sem que ninguém tenha mexido em permissão.

Os 6 cadastros operacionais **não sofrem disso**: eles usam `getDeptosOndeStaff(user)`,
que lê `departamentos[].role` — a role **do departamento**. É a direção certa, e foi ela
que resolveu o incidente Juliana.

**Recomendação:** terminar a migração prevista (Sub-fase 1.5/1.6) — decidir por
departamento, não pela role denormalizada. Enquanto isso não acontece, tratar
"multi-perfil com roles diferentes" como configuração **não suportada**: hoje ela concede
o papel mais forte a todos os departamentos.


### 2b. O caso concreto da CAPUL: Fiscal × T.I. (pergunta do Clenio, 25/08)

A base **já está** nesse cenário — 8 usuários com papéis diferentes por departamento:

| Usuário | Perfis |
|---|---|
| danielaelvira, fabioavelar, mariaoliveira, vanessasilva | Fiscal=**SUPORTE** + T.I.=USUARIO_FINAL |
| valdirenemendes | Fiscal=**SUPORTE** + T.I.=USUARIO_CHAVE |
| vanialucia | Fiscal=**GESTOR** + T.I.=USUARIO_FINAL |
| tatianeoliveira | Fiscal=**GESTOR** + T.I.=USUARIO_CHAVE |
| thiagopereira | Fiscal=**ADMIN** + T.I.=SUPORTE |

**O que já respeita o departamento** (e foi feito justamente para isso):

- **Listagem de chamados** — a visão "vejo o departamento inteiro" só vale nos deptos
  onde a pessoa é staff (`getDeptosOndeStaff`). Quem é SUPORTE no Fiscal vê o Fiscal
  inteiro e, no T.I., **só os próprios chamados**. Nasceu do incidente Juliana.
- **Assumir automático** ao abrir e ao reabrir — usa `getRoleNoDepto(user,
  departamentoId)`, o papel **naquele** departamento.
- **Equipe carrega o departamento**: transferir um chamado para equipe de outro depto
  **re-deriva** `departamentoId` (C2.7). O chamado muda de dono junto com a equipe —
  não fica metade em cada.
- Os 6 cadastros operacionais e a tela de Equipes (`findAllParaConfig`).

**Onde ainda mistura** — o `@Roles` do controller lê a role **denormalizada**, uma só
para o módulo inteiro:

```
POST /chamados/:id/assumir   @Roles('ADMIN','GESTOR','SUPORTE')
async assumir(id, user)      // <- o serviço NÃO olha departamento
```

Quem é SUPORTE no Fiscal passa nesse filtro **também num chamado do T.I.**, onde é
USUARIO_FINAL. Mesmo desenho em `transferirEquipe`, `transferirTecnico` e `resolver`.
O que hoje segura na prática é a **visibilidade** (ela não enxerga o chamado de T.I. de
outra pessoa para pegar o id) — mas o próprio chamado dela em T.I. está ao alcance.

**Correção natural:** onde o `@Roles` decide sobre um chamado, a role tem de ser a
`getRoleNoDepto(user, chamado.departamentoId)` — o mecanismo já existe e já é usado no
assumir automático. Não é regra nova; é aplicar a que já foi escrita.

---

## 3. ✅ CORRIGIDO (25/08, `b53b5bcc`+) — Sub-recursos de Contrato e NF ignoravam o departamento

`contrato-core.service.ts:35`:

```ts
async ensureContratoPermission(equipeId, usuarioId, role) {
  if (role === 'ADMIN' || role === 'GESTOR') return;   // <- sem olhar departamento
```

Combinado com `findOne(id)`, que busca o contrato **sem filtro de departamento**, isso
vale para: **rateio** (template e parcelas), **anexo**, **parcela**, **vincular/desvincular
licença** — e o equivalente em NF (`ensureNFPermission`).

`create`/`update` do contrato **estão protegidos** (`assertDepartamentoDoUser`,
linhas 169 e 222). A brecha é só nos sub-recursos.

Efeito: um **GESTOR de qualquer departamento** (ou um ADMIN sem OVERSIGHT) pode alterar o
rateio de um contrato de outro departamento, **desde que conheça o id**. Não há caminho de
UI que entregue esse id — a listagem é filtrada —, então o risco prático é baixo; mas a
regra que o resto do módulo aplica não está aplicada aqui, e é escrita em **dinheiro**
(rateio define para qual centro de custo a parcela vai).

`POST /contratos/:id/rateio-template/simular` não tem nem a checagem de permissão — só
`@Roles`. Devolve cálculo sobre o `valorTotal` do contrato para qualquer staff que tenha
o id.

**Corrigido assim:** `ensureContratoPermission` e `ensureNFPermission` passaram a receber
o **registro** (que traz `departamentoId`) e o `user`, e decidem por
`ehGestorNoDepto(..., { adminGlobal: false })` + bypass por `OVERSIGHT_PLATAFORMA` —
ou seja, aplicam **E1**, não D36. A checagem de equipe segue depois, e como a equipe é
a *do contrato*, ser membro dela já implica o departamento certo. Sem `user` (chamador
antigo/interno), cai na role denormalizada: o comportamento anterior.

A varredura de invariante (`contrato-guard-invariante.spec.ts`) achou **4 escritas que
ninguém tinha citado**: anexar e excluir anexo **de contrato** e **de NF** não checavam
nada — com o id, dava para pendurar ou apagar arquivo em registro de qualquer
departamento. Mesmo padrão do anexo de chamado. Também entraram:
`simularRateioTemplate` (devolvia cálculo sobre o `valorTotal` sem checagem alguma) e
`findEquipesParaCompras`, que listava as equipes da empresa inteira para quem fosse
ADMIN/GESTOR pela role denormalizada — agora lista as dos departamentos onde a pessoa
de fato manda.

---

## 4. ⚠️ `role: string = 'ADMIN'` como valor padrão — 38 ocorrências

Métodos de serviço do Workspace declaram `role` com **default ADMIN**. Hoje os controllers
sempre passam a role real, então não há falha ativa. Mas o padrão é **fail-open**: o
próximo chamador que esquecer o argumento ganha privilégio máximo, e nada acusa. O default
seguro seria o papel mais fraco (ou parâmetro obrigatório).

---

## 5. O que está correto e não precisa mexer

- **Listagem** de chamado, projeto, conhecimento, OS: filtram por `getDeptoIdsDoUser`, com
  o escape do ADMIN — conforme D36.
- **Os 6 cadastros operacionais**: filtram por departamento **onde o usuário é staff**, com
  bypass só por capability. É o modelo mais robusto do módulo.
- **`create`/`update`** de contrato, NF, equipe, chamado externo, licença-compra: todos
  chamam `assertDepartamentoDoUser`.
- **Equipes**: a tela de configuração (`findAllParaConfig`) já é escopada por staff. O
  `findAll` global segue aberto **de propósito**, para dropdowns — decisão registrada no
  próprio código (S15.4).

---

## Ordem sugerida

1. **§2** — é a raiz: enquanto a role for uma só para o módulo, qualquer regra por
   departamento fica sujeita a ela.
2. **§3** — pequeno, localizado e mexe em dinheiro.
3. **§4** — higiene; cabe junto de §3.
