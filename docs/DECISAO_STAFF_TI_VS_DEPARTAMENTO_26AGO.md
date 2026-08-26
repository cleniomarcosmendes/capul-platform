# Decisão: "staff de T.I." ou "staff do departamento do registro"?

> ### ✅ DECIDIDO E APLICADO em 26/08 — commit `cf55d4d6`
> O Clenio optou por **migrar os 18** e fechar a inconsistência do privado. Conhecimento
> (3) ficou como estava, e o helper virou `ehStaffDeTI`. O alcance transversal passou a
> ser a capability `OVERSIGHT_PLATAFORMA`, que **ganhou tela no Configurador** — antes
> só existia no backend, e conceder seria SQL na mão.
> Deploy: §12 do roteiro `PlatformCapul_20260824b_...`.

*26/08/2026 — levantamento pedido pelo Clenio. Nada foi alterado; este documento é para
decidir.*

## O que está em jogo, em uma frase

O Workspace tem um segundo conceito de "staff", paralelo ao papel por departamento:
**`hasStaffPerfilEmTI(user)` — "é ADMIN/GESTOR/SUPORTE em algum departamento de T.I."**.
É ele que libera nota interna, chamado privado, edição de projeto e comentário alheio.
Como o módulo nasceu no T.I., isso era o mesmo que "é da equipe". Hoje não é mais.

Ele erra nos dois sentidos:

- quem atende no **Fiscal** não alcança a nota interna, o privado nem o projeto **do
  próprio Fiscal**;
- quem atende no **T.I.** alcança tudo isso **em qualquer departamento**.

## Primeiro, o número certo

O grep dá 40 ocorrências, mas **19 são comentários** citando o helper. **São 21 chamadas
de verdade**, em 8 arquivos.

## Como "é de T.I." é decidido hoje

`build-modulos-payload.ts` marca `isTI` quando **o nome do departamento começa com
"Tecnologia"** — ou o tipo dele. Ou seja: **renomear o departamento muda permissão**.
Hoje "Tecnologia da Informacao" tem os dois (nome e tipo `Tecnologia`), então funciona;
mas o gatilho é textual.

## As 21 chamadas, por grupo

### 1. Chamado — 7 chamadas · `chamado.departamentoId` existe

| Onde | O que controla | Se virar "staff do depto do chamado" |
|---|---|---|
| `:637` | abrir chamado **PRIVADO** (mensagem: *"acesso restrito a equipe de TI"*) | Fiscal passa a abrir o privado **do Fiscal**; T.I. deixa de abrir o privado do Fiscal |
| `:648` | ver **notas internas** no detalhe | idem |
| `:1409` | poder **escrever** nota interna (não-staff sempre grava pública) | Fiscal passa a poder registrar nota interna nos chamados dele |
| `:362` | **busca profunda** varrer histórico interno | Fiscal passa a encontrar o que escreveu; T.I. deixa de varrer o interno do Fiscal |
| `:329` | escopo da lista sem filtro de equipe | Fiscal deixa de cair no escopo reduzido dentro do próprio departamento |
| `:457` | cláusula "vejo o departamento inteiro" | já é combinada com `getDeptosOndeStaff` — muda pouco |
| `:280` | restringir a lista às **filiais** do usuário | efeito colateral pequeno; hoje qualquer staff de T.I. escapa |

> ⚠️ **Inconsistência viva, criada em 25/08.** A *criação* de chamado PRIVADO já passou a
> ser por departamento (onda de ontem), mas a *abertura* (`:637`) continua exigindo T.I.
> Hoje isso significa: alguém do Fiscal cria um privado no Fiscal e **não consegue
> abri-lo depois**. Ninguém está travado ainda porque o Fiscal tem **0 privados** — mas
> é uma armadilha esperando o primeiro.

### 2. Projeto — 10 chamadas · `projeto.departamentoId` existe

| Onde | O que controla | Se virar "staff do depto do projeto" |
|---|---|---|
| `projeto-helpers:182` | **editar qualquer projeto** sem ser membro | T.I. deixa de editar projeto de outro depto sem ser membro; Fiscal passa a editar os do Fiscal |
| `projeto-helpers:219` | **ver qualquer projeto** | idem, para leitura |
| `projeto-core:118`, `atividade:31/451/466/591/610`, `pendencia:115/498` | **notas internas** de tarefa e pendência (ver, contar, escrever, editar) | Fiscal passa a usar nota interna nos projetos dele; T.I. deixa de ver a dos outros |

### 3. Ordem de Serviço — 1 chamada

`ordem-servico:261` — editar **comentário de outra pessoa**. O mesmo arquivo já tem
`assertAlocadoOuGestor`, que **é por departamento**: a inconsistência está dentro do
próprio serviço.

### 4. Conhecimento — 3 chamadas · **recomendo NÃO mexer**

`:91`, `:156`, `:183` tratam de **artigo global** — aquele sem equipe, e portanto sem
departamento. Artigo COM equipe já é resolvido por departamento (`assertStaffEmDepto`).
Aqui "só T.I. edita o global" é uma regra de curadoria, não uma herança acidental.

## O tamanho real do impacto, na base de hoje

| | T.I. | Fiscal |
|---|---|---|
| Perfis no Workspace | 153 | **8** |
| Chamados | 2.036 | 40 |
| Chamados **privados** | 325 | **0** |
| Notas internas | 55 | **0** |
| Projetos | 99 | **0** |

**É por isso que a hora de decidir é agora.** O Fiscal ainda não usa nada do que a
mudança destrava — logo, migrar hoje não tira nada de ninguém e não mexe em 2.036
chamados de T.I. Quando o Fiscal (ou o próximo departamento) começar a usar privado e
nota interna, a mesma mudança passa a ter conteúdo real dos dois lados.

## A pergunta de fundo

Hoje o T.I. é, na prática, **leitor universal do Workspace** — não por decisão escrita,
mas por consequência de o módulo ter nascido lá. Se esse alcance é desejado (o T.I. dá
suporte a todos), ele deve vir de algo **nominal e auditável**:

- a capability **`OVERSIGHT_PLATAFORMA`**, que já existe e já é o bypass dos cadastros
  operacionais (hoje só o usuário `admin` tem); ou
- papel **ADMIN**, que é global por D36.

O que não se sustenta é o privilégio vir do **nome do departamento** — invisível no
Configurador, impossível de auditar e sensível a um rename.

## Recomendação

1. **Migrar** chamado (7), projeto (10) e OS (1) para "staff no departamento do
   registro" — 18 chamadas, todas com o departamento à mão.
2. **Manter** Conhecimento (3) como está, e renomear o helper para algo como
   `ehStaffDeTI` deixando claro que é sobre o **artigo global**.
3. **Conceder `OVERSIGHT_PLATAFORMA`** a quem de fato precisa enxergar tudo — nominal, e
   revisável no Configurador.
4. Fechar a inconsistência do PRIVADO junto (criar × abrir), que é a única com efeito
   prático imediato.

**Esforço:** as 18 chamadas seguem o padrão já instalado em 25/08 (`ehStaffNoDepto`), com
o departamento disponível no registro. Estimo uma sessão, com testes e varredura de
invariante. **Risco:** baixo na base atual (Fiscal com zero conteúdo desse tipo); o que
muda de verdade é o alcance do T.I. sobre o que os outros departamentos vierem a criar.
