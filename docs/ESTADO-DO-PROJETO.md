# Gestão de Pessoas — estado do projeto

> Ponto de entrada para quem vai mexer no módulo. Diz onde estamos, o que não se
> discute mais e onde ler o resto. Última revisão: **07/09/2026** (fim do dia).
>
> Piloto previsto para **15/09/2026**.

## ✅ PUBLICADO EM 07/09/2026 — `origin/main` = `6f13a210`

O bloco que ficava aqui dizia **não dar push**. Está superado: o Clenio publicou em 07/09,
`6855c918..6f13a210`, **1.079 objetos**. Local e remoto iguais (`git status -sb` sem ahead).

### Onde cada ambiente está (07/09)

| | Commit | Tem o Gestão de Pessoas? |
|---|---|---|
| `origin/main` | **`6f13a210`** | sim |
| **HOMOLOGAÇÃO** | `6855c918` | **não** |
| **PRODUÇÃO** | `6855c918` | **não** |

O Marco aplicou em 07/09, em HLG **e** em PROD, o roteiro de 04/09
(`PlatformCapul_20260904_Roteiro_Deploy.md`, alvo `6855c918`) — que **não continha este
módulo**. ⚠️ Confirmar o rótulo quando for conveniente (`/health` → `versao.commit`): o que
está acima é o declarado, e estado de ambiente é o que mais envelhece nestes registros.

⚠️ **Então o módulo precisa de roteiro PRÓPRIO** — e ele é maior que uma onda comum, porque
sobe um serviço novo em vez de atualizar um existente:

| O que entrou | Detalhe |
|---|---|
| **3 serviços novos** no `docker-compose.yml` | `gestao-pessoas-migrate` (job com build próprio e GUARDA), `gestao-pessoas-backend` (porta **3004**), `gestao-pessoas-frontend` |
| **nginx** | duas `location` novas (`/gestao-pessoas/` e `/api/v1/gestao-pessoas/`) — **reload obrigatório** depois do rebuild |
| **11 migrations** | **2 do `auth-gateway`** (registra o módulo + roles; e a que **ativa o card no Hub**) e **9 do `gestao-pessoas`** |
| **`.env`** | nada novo: o serviço reusa `DB_USER`/`DB_PASSWORD`/`JWT_SECRET`/`CORS_ORIGINS` que já existem |

⚠️ **Ordem que importa:** as migrations do **auth-gateway** registram o módulo e as roles — sem
elas ninguém tem permissão para entrar; a do Hub é a que faz o card aparecer (e é migration de
propósito: à mão, o módulo ficaria ATIVO num ambiente e INATIVO noutro sem nada registrar a
diferença). ⚠️ E o job `*-migrate` **tem build próprio**: rebuildar só o backend deixa o job com
imagem velha e o `migrate deploy` diz "No pending migrations" com razão — foi o que aconteceu
aqui em 07/09, e a **GUARDA** avisou.

🔴 **Ninguém tem permissão no módulo em PROD ainda.** Lá isso é conceder `GESTAO_PESSOAS` no
Configurador, pessoa a pessoa — ver a lista (A): quem recebe é decisão do RH, e o **segundo
`RH_ADMIN`** é exigência do desenho, não conveniência.

## 👤 Quem escreve isto, e para quem

Esta aplicação é implementada por **uma pessoa só — o Clenio —, com apoio do Claude Code**.
Não há equipe, não há revisor, e não há quem lembre o contexto por você.

Por isso o registro é do jeito que é: **ele existe para o próprio autor daqui a algumas
semanas**, quando a decisão tiver sido esquecida e só o código restar. Quem escrever seção
nova aqui **escreve o PORQUÊ, não só o quê** — o "o quê" o código já conta; o "por quê" some
com a memória, e é ele que impede a decisão de ser refeita ao contrário meses depois.

---

## 0. O que trava e o que anda — fechamento de 06/09/2026

Os 🔴 do dia nasceram espalhados por §3.1.1, §3.1.2, §3.1.4, §5 e §11. Aqui estão os
mesmos itens em dois blocos, sem prosa. **Esta lista é um índice: quem decide o quê fica
na seção citada.**

### (A) DEPENDE DE FORA — decisão de quem não é a T.I.

**Só o que a gestora de RH e a diretoria respondem.** Nada aqui anda com trabalho técnico, e
nada aqui é da T.I. — o que é da T.I. está em (B), porque tem dono e data.

| Item | Quem responde | Onde está |
|---|---|---|
| O avaliador é avisado de que o RH lê a `observacaoAvaliador` dele? Ou o rótulo avisa, ou muda o que o campo colhe | Gestora de RH | §5 · §3.1.1 |
| O `RH_ADMIN` pode agir sobre a própria linha (público, designação, revisão, elegibilidade)? Eixo: incluir × excluir | Gestora de RH | §5 · §3.1.4 |
| A ordem da fila do avaliador — indiferente, ou há prioridade? | Gestora de RH | §5 · §3.11 |
| A mesma pessoa em dois ciclos abertos ao mesmo tempo | Gestora de RH | §5 · §3.10 |
| Quem é o avaliador de cada centro de custo (a lista real) — sem ela, 174 pessoas ficam fora | Gestora de RH | §5 · §7 · §11 |
| O público real de cada aplicação — 3 das 4 estão com recorte provisório | Gestora de RH | §5 · §7 · §11 |
| Quem avalia os ~53 avaliadores — 46 caem no Diretor Executivo pela regra provisória | Diretoria + RH | §5 · §11 |
| Quem avalia Presidente e Vice | Diretoria | §5 |
| Régua de escolaridade · aprendizes · afastados · enunciados das perguntas | Gestora de RH | §5 |
| Quem dispara o sync — enquanto não se decide, não existe cron | Gestora de RH | §5 |
| **Quem é o segundo `RH_ADMIN`** (a pessoa) — dar a permissão é da T.I. e está em (B) | Gestora de RH | §5 · §3.1 |
| 🟢 **CONFIRMAÇÃO, não bloqueio:** cancelar avaliação com respostas já dadas — implementado com **as respostas ficando registradas e fora da apuração, nunca apagadas**. Se ela preferir que o sistema recuse e obrigue o avaliador a enviar, a mudança é pequena | Gestora de RH | §5 · §3.1.18 |
| 🟢 **CONFIRMAÇÃO, não bloqueio:** encerrar ciclo com pendência é **RH_ADMIN só**, o mesmo degrau do reabrir. Se ela quiser estender a quem monta o ciclo (`RH_CICLO`), é uma linha no controller | Gestora de RH | §5 · §3.1.18 |

### (B) TRABALHO TÉCNICO PENDENTE — na ordem em que eu faria

⭐ **Os três primeiros são provisionamento, e vão na frente por um motivo só: são os únicos
que mexem no número que decide o piloto.** Hoje, dos **53 avaliadores do ciclo, 5 conseguem
entrar** — e um desses cinco é a conta de TESTE do Claudimar, criada por nós (§6). Os outros
nove itens desta lista não movem esse número em nada.

| # | Item | Onde está |
|---|---|---|
| 1 | **Contas para os avaliadores** — 46 dos 53 não têm conta, e 3 têm conta sem permissão. ⚠️ Quem recebe conta acompanha a lista real do RH, mas **quem já é avaliador no dado de hoje independe dela** | §3.1.3 |
| 2 | **`rodrigoleao`** — é avaliador de 4 pessoas e a permissão GESTAO_PESSOAS **não salvou**. ⚠️ Segunda ocorrência do mesmo sintoma (a 1ª foi o INVENTARIO do `wandersonnascimento`): ver se a tela do Configurador erra ao salvar, porque aí é de todos os módulos | §6 |
| 3 | **Segundo `RH_ADMIN`** — a separação de funções exige dois; com um só, ninguém corrige a avaliação da gestora. A pessoa é escolha do RH (A); a permissão é daqui | §5 · §3.1 |
| 4 | Cadastro de **critérios e faixas**: o painel manda cadastrar uma faixa e a tela não existe | §7 |
| 5 | Tela de **reabertura** de avaliação (a rota existe, o botão não) | §7 · §2 |
| 6 | Tela do **sync** (hoje só por API) | §7 · §2 |
| 7 | `.dockerignore` do **fiscal/frontend** — o do gestao-pessoas foi feito em 06/09 | §6 |
| 8 | **IP na auditoria**: 13 das 14 ações gravam `NULL`, e quando grava é o IP do nginx | §6 |
| 9 | Marca da própria linha no **modal da memória de cálculo** (`GET /resultados/:id` não manda `restrita`) | §3.1.1 |
| 10 | Revisitar a marca de `foraDeTodasAsAplicacoes` **quando alguém fizer o "ver todos"** | §3.1.1 |
| 11 | Comprovar (ou derrubar) no DEV a **hipótese dos dois atos combinados** e registrar o resultado | §3.1.4 |
| 12 | 🔴 **"Designar pelo cadastro" não tem desfazer** — cria N avaliações com um clique (no DEV: 84 de uma vez) e **não há como reverter pela tela**; o único caminho hoje é SQL. A importação de planilha TEM desfazer, e é a mesma natureza de ato em lote. A gestora pode fazer pela tela o que se fez por script em 07/09 e ficar sem saída | §3.1.13 |
| 13 | Tela de **questionários** (`RH_MODELO` está sem nenhum item de menu até ela existir) | §3.1.6 · §2 |
| 14 | ⚠️ **O QUE NUNCA FOI EXERCITADO — lista consolidada** (base do roteiro do Chrome): o botão **"Definir avaliador · N pessoas"** do GRUPO e o **aviso em lote** (nunca apareceram numa tela) · clicar **"Adicionar N ao público"**, **"Apurar N avaliação(ões)"** e **"Abrir o ciclo"** nas confirmações · **designar pela linha até gravar** · os textos do Apurar com **todas enviadas** e com **zero enviadas** · Resultados **com filtro** (*"sobre N em exibição"*) · a faixa no estado **✓ nada falta para abrir** · os outros **"Próximo"** (apurar, encerrar, montar público) · **"Tirar" do público** e **"Excluir/Incluir"** com o ciclo encerrado · o **checkbox de seleção** da Designação desabilitado (só conferido por código) · `RH_MODELO` e `RH_ADMIN` **sem fila** (não há conta) · **celular de verdade** (tudo a 360px foi Chromium) · **dois avaliadores ao mesmo tempo**. ⚠️ Testar com `ariellypereira` NÃO pega os caminhos de avaliador puro — use `wandersonnascimento` e `claudimaroliveira` | §3.1.6 · §5 |
| 15 | 🟡 Do roteiro de tela, ainda **não registrados até 07/09** (falha minha — foram pedidos e não entraram): a **"promessa falsa" do modal** (mesma lacuna do questionário sem tela, item 13) · **regras de público não reproduzíveis** · **provisório sem tela de confirmação em bloco** · **sem sinal de sincronismo** (a tela não diz quando o cadastro veio do Protheus) · e os detalhes do 🟡 14 | roteiro do Chrome |
| 16 | 🟡 **A linha de Resultados não parece clicável** — a memória de cálculo é a melhor peça do módulo (nota, conceito, quebra por grupo, quem avaliou, a observação) e está atrás de um clique que ninguém adivinha | roteiro do Chrome |
| 17 | 🔴 **A FONTE REPÕE O PROBLEMA: demissão não toca avaliação viva.** O `sincronizacao` **não está** entre os oito arquivos que escrevem em `prisma.avaliacao` — quem é demitido vira `situacao='DEMITIDO'`, sai da régua das listas NOVAS, e a avaliação criada antes fica `PENDENTE` para sempre. O cancelamento manual de 08/09 **resolve o caso, não a fonte**: com 894 avaliações abertas, o RH vai fazer isso à mão toda vez. ⚠️ **É pergunta, não conserto** — cancelar automaticamente no sync é o sistema decidindo sozinho tirar alguém do ciclo, e "afastado" não é "demitido". Medido em 08/09: **0 demitidos** com avaliação viva hoje; os 86 não-ATIVOs com avaliação são **FERIAS**, que são elegíveis por definição | §3.1.18 |
| 18 | 🔴 **Fechar a meia rede do §3.1.9**: gerar o cliente a partir do backend **ou** teste de contrato (resposta real × o que a tela consome). ⚠️ Só a segunda pegaria o 1º dos três casos; a varredura periódica não substitui nenhuma das duas | §3.1.9 |

---

## 1. O que o módulo faz

Avaliação de desempenho dos ~1.000 colaboradores da Capul. O RH abre um **ciclo**
(período + data-base + régua de conceitos) e monta dentro dele uma ou mais
**aplicações** — cada uma casa um questionário com um público de centros de custo e
define quanto o questionário vale ao lado dos critérios cadastrais (escolaridade, tempo
de casa, tempo na função). O supervisor responde no celular as avaliações que lhe foram
designadas; a nota do questionário é congelada no envio. Depois, numa etapa separada, o
RH **apura**: combina aquela nota com os critérios pelos pesos da aplicação e grava o
resultado com a memória de cálculo. O cadastro de pessoas vem do Protheus por
sincronização **somente leitura**.

A melhoria que originou o módulo: o sistema antigo aplicava as **mesmas 15 perguntas** do
aprendiz ao supervisor. Daí a Aplicação existir.

---

## 2. Estado

### Pronto e rodando no DEV

| | |
|---|---|
| Backend | NestJS 11 + Prisma 6, schema `rh`, porta 3004, prefixo `/api/v1/gestao-pessoas`. **42 endpoints** em 9 controllers. |
| Frontend | React 19 + Vite 7 + Tailwind v4, base `/gestao-pessoas/`, porta 5178. **8 telas** (8 arquivos em `pages/` — `CicloPage` é a moldura com as abas, não uma tela). |
| Banco | 8 migrations em `rh` (26 tabelas) + 2 no `auth-gateway` (módulo/roles e ativação). |
| Testes | **422 testes, 30 suítes**, verdes. `tsc -b` e ESLint limpos nos dois lados. |
| Módulo no Hub | **ATIVO** desde 06/09 (`20260906030000_ativa_gestao_pessoas_no_hub`). |

**As oito telas:** fila do avaliador · responder questionário · ciclos · aplicações ·
designação · painel (com pendências cadastrais) · resultados (com memória de cálculo) ·
**cadastro de avaliadores** (`/avaliadores` — pendência reversa, lista por avaliador e
importação da planilha).

**Motor de cálculo** completo, com renormalização, e validado por regressão contra o
ciclo 000006 do Protheus — a nota do questionário bate **108/108** (ver
`REGRESSAO_PROTHEUS_GESTAO_PESSOAS.md`).

**Sincronização** rodada de verdade em 06/09: 8.111 linhas lidas → **1.036 colaboradores**
(o resto é demitido ou autônomo), 29.881 → 14.024 lançamentos de histórico funcional,
3.258 → 2.268 treinamentos, **82 pares filial × centro de custo com descrição**.

### Pela metade

- **Ciclo e aplicação quase não têm edição.** Dá para criar, abrir e encerrar o ciclo; criar
  a aplicação. O único `PATCH` que existe é `ciclos/:id/periodo`, **de propósito estreito**:
  período é rótulo e não entra em conta nenhuma, enquanto `dataBase` e a janela de
  treinamento ancoram todo cálculo temporal — mudá-las num ciclo em andamento moveria a nota
  de quem já respondeu, em silêncio. Quem precisa de outra data-base cria outro ciclo, que é
  a decisão que isso realmente é. Ciclo `ENCERRADO` não aceita nem o período. Fora disso não
  há edição: errou, cria outro.
- **Duas capacidades existem SÓ NA API, sem botão em tela nenhuma** — quem precisar delas em
  homologação consegue por `curl`, e é bom saber que dá:
  `POST /avaliacoes/:id/reabrir` (RH_ADMIN, motivo obrigatório) desfaz um envio, e
  `PATCH /ciclos/:id/periodo` (RH_ADMIN) corrige as datas do ciclo. As duas gravam em
  `rh.auditoria` com o valor anterior.
- **Sincronização** existe na API (`POST /sincronizacao`, RH_ADMIN) e **não tem tela nem
  cron**. Hoje se dispara por `curl`, e os três CSVs precisam ser extraídos do Protheus à
  mão e colocados em `RH_CSV_DIR` (padrão `/app/carga`, que não existe no container — é
  preciso criar e copiar). Ver `SYNC_GESTAO_PESSOAS_CSV.md`.
- **Editor de questionário e cadastro de critérios continuam inexistentes** — os dois itens
  da lista "Não existe" abaixo são o que sobra de estrutural.
- **Critério `INFORMADO`** é suportado pelo motor e pelo schema
  (`rh.criterio_valor_informado`), mas não há por onde informar o valor. Os quatro critérios
  do catálogo são todos `CALCULADO`, então isto ainda não dói.

### Não existe

- **Editor de questionário.** `Modelo`, `ModeloVersao`, `Grupo`, `Pergunta` e
  `PerguntaAlternativa` **só nascem pelo seed**. A role `RH_MODELO` não tem nenhuma tela —
  ela existe no RBAC e não leva a lugar nenhum. ⚠️ Isto **não bloqueia o piloto**: o seed já
  publicou três modelos de PRODUÇÃO (Administrativo 11 perguntas, Operação de Loja 14,
  Produção e Indústria 14) e um `[DEMO]` que a validação de abertura recusa de propósito.
- **Cadastro de critérios e faixas.** `Criterio` e `CriterioFaixa` também só vêm do seed. O
  painel diz "cadastre a faixa no critério e reapure" — e não há tela para isso. É a maior
  incoerência do módulo hoje.
- **Relatório e exportação.** Nada de PDF, Excel ou impressão.
- **Devolutiva.** Os campos existem em `rh.avaliacao` (`devolutiva_em`,
  `devolutiva_por_id`); nenhum fluxo os preenche. Por decisão, o colaborador **não** vê a
  nota no sistema.
- **`rh.cargo`** está vazia — o cargo vem denormalizado em `rh.colaborador.cargo_descricao`.
- **Cron de qualquer espécie.** Não há agendamento no módulo. Quando houver, é `@Cron` com
  `timeZone: 'America/Sao_Paulo'`, como nos outros módulos. **Nada de BullMQ.**

---

## 3. Decisões fechadas — não reabrir

A tabela completa está em **`06_especificacao_gestao_pessoas.md` §7**. O que segue é o que
tem consequência no código, com o lugar onde a regra é imposta.

⚠️ **Uma linha daquela §7 está superada:** ela diz "pesos por grupo". Desde 05/09 o **grupo
não tem peso** — ver §3.5 abaixo.

### 3.1. Separação de funções — a regra número um

Ninguém abre, edita, reabre, responde ou recalcula a avaliação em que é o **avaliado**.
Nem `RH_ADMIN`, nem `ADMIN`. A verificação é **por REGISTRO** (`colaboradorId ===
avaliadoId`), nunca por papel.

- Fica em `src/avaliacao/separacao-funcoes.ts` e a porta única de acesso é
  `AvaliacaoAcessoService`.
- Um **teste de invariante varre o fonte** (`separacao-funcoes.invariante.spec.ts`) e
  quebra a suíte se um arquivo novo tocar `prisma.avaliacao` sem passar pela porta. Cada
  dispensa está numa lista, **com o motivo dizendo de qual regra ela está fora**.
- Consequências que não são negociáveis: **`RH_ADMIN` precisa ser dado a duas pessoas** (a
  gestora também é avaliada; com um só, ninguém corrigiria a avaliação dela); e listas
  **mostram a linha marcada, nunca filtram em silêncio** — filtrar faria o total não fechar.
- Ler o **próprio resultado** não é ato sobre ele. A separação barra o que **muda** o
  registro; a linha da pessoa aparece marcada e abre.

### 3.1.1. ⚠️ O que o RH_ADMIN VÊ de uma avaliação — e o que isso custa

A memória de cálculo (`/resultados`, modal) mostra nota, conceito, quebra por grupo, **o nome
de quem avaliou** e **a observação que o avaliador escreveu sobre a pessoa**. Isso não é
agregado: é opinião redigida, legível por qualquer RH_ADMIN.

**Está previsto.** A spec §8 exige `rh.auditoria` em *"acesso a resultado individual por quem
não é o avaliador designado"* — a frase só faz sentido se esse acesso for permitido. E o campo
existe para isso: `observacaoAvaliador` foi desenhado como *"evidência de devolutiva e
contexto da nota"*, ou seja, para alguém ler depois.

#### ✅ RASTRO — resolvido em 06/09

`LER_RESULTADO_INDIVIDUAL` grava quem leu, de quem, se era o próprio e se havia observação.
Quem é o avaliador designado lê sem rastro — é o trabalho dele.

⚠️ **Isto resolve "quem leu" e mais nada.** Os pontos abaixo continuam abertos e não são
endereçados por auditoria nenhuma.

#### 🔴 CONSENTIMENTO — em aberto, e é decisão do RH

**O avaliador não sabe que o RH lê o que ele escreve.** Nenhuma tela avisa. Se ele não sabe, o
campo colhe uma franqueza que ele não consentiu; se souber, o texto muda. É pendência própria
na §5 — **não pode chegar ambíguo à produção**, porque o primeiro ciclo real já colhe texto sob
o entendimento errado.

#### ✅ MARCAR A PRÓPRIA LINHA — corrigido, e o diagnóstico era o inverso

Teste dirigido de 06/09. **`/resultados` SEMPRE marcou** — o service chama `marcarRestricoes`
e a tela mostra a etiqueta "você".

✅ **TESTE DIRIGIDO EXECUTADO — 06/09, noite.** Antes disto a regra estava cumprida e o dado
não a exercitava: a gestora não tinha resultado porque a avaliação do Diretor Executivo sobre
ela nunca fora enviada. O caminho inteiro foi percorrido com as contas reais:

1. conta de DEV para o avaliador designado (`claudimaroliveira`, matrícula 001079 — o
   Diretor Executivo **não tinha conta**, e sem ela ninguém consegue enviar a avaliação dela);
2. as 11 perguntas respondidas e a avaliação **enviada por ele** (nota 72,49), com observação
   escrita — de propósito, para exercitar também o campo do consentimento;
3. **apuração por CICLO** pela própria gestora (é a exceção estrutural 1: lote, nunca recorte
   por pessoa) — 3 avaliações apuradas;
4. `GET /resultados/ciclo/:id` com o token dela: **3 linhas, a dela em primeiro lugar**
   (73,33) com `restrita: true` e o motivo *"Sua própria avaliação — acesso restrito"*;
5. a tela renderizada em Chromium mostra a etiqueta **"você"** ao lado do nome dela, e a
   média das 3 inclui a linha dela — o total fecha, que é a razão de marcar em vez de filtrar.

Também conferido, no mesmo teste: a **memória de cálculo da própria linha ABRE** (§3.1 — ler o
próprio resultado não é ato sobre ele) e a leitura gravou
`LER_RESULTADO_INDIVIDUAL {proprioResultado: true, leuObservacaoDoAvaliador: true}`.

⚠️ O modal da memória **não carrega a marca**: `restrita`/`proprio` não vêm no payload do
`GET /resultados/:id`. Quem abre a própria linha só sabe que é sua pelo nome. Custo baixo, mas
é a mesma família — a lista marca, o registro não.

**Quem não marcava era a DESIGNAÇÃO** — 142 linhas sem o campo, e a linha da própria gestora
aparecendo com *"Avalia: CLAUDIMAR · PENDENTE"*. Corrigido: `listar()` recebe o colaborador e
marca, e a tela mostra "você". Conferido: 142 linhas, 1 marcada.

✅ **Decidido em 06/09 (noite), com cada lista medida com o token da gestora — não deduzida do
código.** Marcam as listas que carregam uma avaliação ou o vínculo que a origina:

| Lista | A linha dela | Marca? |
|---|---|---|
| `/avaliacoes/minhas` | não aparece (ninguém se avalia) | ✅ marca quando aparecer |
| `/resultados/ciclo/:id` | aparece entre 3 | ✅ |
| `/designacao/aplicacao/:id` | aparece entre 142 | ✅ |
| `/aplicacoes/:id/publico` | aparece entre 142 | ✅ **novo** |
| `/designacao-padrao/avaliadores/:avaliadorId` | aparece entre os 45 do Claudimar | ✅ **novo** |
| `/catalogo/colaboradores?busca=` | aparece | ❌ **decidido que não** |
| painel → `foraDeTodasAsAplicacoes` | 0 no Piloto; **896 no Geral, ela é a 35ª** | ❌ **decidido que não, com prazo** |
| `/designacao-padrao/pendencias` | não aparece hoje — ela TEM avaliador no cadastro | ❌ (mesma família do catálogo: é lista de pessoa, não de avaliação) |

⭐ A regra da marca saiu de quatro cópias para **uma** (`marcarRestricoesPor`, em
`separacao-funcoes.ts`). A pergunta é sempre "esta linha sou eu?"; o que muda entre as listas é
o CAMPO que responde — `avaliadoId` numa lista de avaliações, `colaboradorId` num recorte de
pessoas —, então o extrator vem de fora. A versão inline que nasceu na Designação em 06/09 foi
substituída pela função comum no mesmo dia: cópia de regra de visibilidade envelhece errada, e
neste repositório isso já custou um achado de segurança.

**🚫 O catálogo NÃO marca, e o motivo está escrito em `catalogo.service.ts` para ninguém
"corrigir" a ausência depois:** `restrita` quer dizer *"esta AVALIAÇÃO é sua"*, e ali a linha é
uma PESSOA — não há avaliação, avaliador, status nem nota sobre o que a marca falasse. Pior: a
mesma busca serve, na Designação, para **escolher quem avalia**, e a gestora se escolher ali é
legítimo — ela avalia 13. Um "você" naquela linha sinalizaria como suspeito um ato normal.

**🚫 `foraDeTodasAsAplicacoes` NÃO marca — e esta decisão tem prazo de validade.** A linha só
diz "esta pessoa ficaria fora do ciclo", e a marca seria quase invisível: são **896 pessoas no
payload e 6 nomes na tela**; a gestora está na posição 35. 🔴 **Quem implementar o "ver todos"
dessa lista precisa revisitar isto** — o aviso está no código, junto da linha que faria a
marcação.

#### 🔴 Marcar não responde à pergunta cara — e ela virou pendência (§5)

Nas duas listas que passaram a marcar, **a linha dela não é só visível: é OPERÁVEL**. O print
de 06/09 mostra a tensão em uma linha só:

> `ARIELLY APARECIDA JOSE PEREIRA · 002448 · GERENTE DE RH PLENO 4B` **| você | provisória | Tirar**

A tela agora diz "esta é você" **ao lado de um botão que ela pode clicar**. Os três atos são
`PUBLICO_REMOVER`, `ENCERRAR` e `REVISAR` — todos auditados, e **rastro diz quem fez, não
decide se podia** (a mesma frase que vale para o consentimento, acima). Decisão do RH, na §5.

#### ⚠️ Grupo pequeno reaproxima a resposta — em aberto

"Assiduidade e Pontualidade" tem 2 perguntas de 4 alternativas; um percentual de grupo aí
reduz o espaço de combinações a um punhado. Quanto menor o grupo, mais o "agregado" vira
resposta.

### 3.1.2. ✅ Abrir, responder e ENVIAR agora verificam a DESIGNAÇÃO — 06/09

A regra está escrita em `common/roles-rh.ts`: *"AVALIADOR responde as avaliações que lhe foram
designadas, **e só essas**"* (decisão E2, repetida no comentário da fila).

**A fila cumpre. O registro individual não.** `minhasAvaliacoes` filtra por
`avaliadorId = colaborador logado`; `AvaliacaoAcessoService.carregarParaAcao` — por onde passam
`abrir`, `responder` e `enviar` — só barra o **próprio avaliado** e, quando o solicitante não é
o avaliador designado, **grava `ACESSO_TERCEIRO` e deixa passar**.

Medido em 06/09 com conta real: logado como `wandersonnascimento` (AVALIADOR simples),
`GET /avaliacoes/d2a25e36…` — a avaliação da gestora, designada ao Diretor Executivo —
responde **HTTP 200 com o questionário inteiro**. Pelo código, `POST /respostas` e
`POST /enviar` aceitam o mesmo id: a nota é congelada em nome do avaliador designado e nada no
registro diz que foi outra pessoa que respondeu — só a linha de auditoria `ACESSO_TERCEIRO:editar`.

⚠️ É a **mesma família do achado da §8**: regra escrita, cumprida por um caminho e não por
outro. E é invisível justamente porque a fila filtra — nenhuma tela oferece o id de outro
avaliador, então não há sintoma; basta ter o id.

**Ler de terceiro é decisão tomada** (§3.1.1: o RH lê, com rastro, e a spec §8 pressupõe esse
acesso). **Escrever de terceiro não estava decidido em lugar nenhum** — e não é pergunta a
fazer: ninguém responde "sim, o avaliador pode enviar avaliação designada a outro". Era
**ausência de regra**, não permissão frouxa. Corrigido em 06/09 sem esperar o RH.

#### ✅ Como ficou

A porta de acesso passou a fazer **duas perguntas, nesta ordem**, e é por isso que são funções
diferentes — trocar uma pela outra é o erro que se repete:

1. **"é SOBRE MIM?"** → separação de funções, 403 sempre (não mudou);
2. **"é MINHA PARA FAZER?"** → designação.

| Ação | Quem não é o avaliador designado |
|---|---|
| `abrir` (GET do questionário) | **RH lê** (`podeVerResultados` — RH_ADMIN/ADMIN), com `ACESSO_TERCEIRO` na trilha. Os demais: **403** |
| `responder` · `editar` (enviar) | **403 para todos, RH inclusive** — e a tentativa fica gravada como `ACESSO_NEGADO_NAO_DESIGNADO:<ação>` |
| `reabrir` · `recalcular` | passam: são atos **do RH sobre avaliação alheia**, é para isso que existem (o papel já é exigido no controller) |

⭐ A exigência de cada ação está num **`Record<AcaoAvaliacao, …>`**, não numa lista: ação nova
na união **não compila** enquanto ninguém disser o que ela exige. Uma lista aceitaria a omissão
em silêncio — que é exatamente como `responder` e `editar` passaram a existir sem verificação.
E o `default` de ação desconhecida é **recusar**, com teste.

⚠️ `podeLerDeTerceiro` é a **única coisa por papel** que entrou aqui, e ela governa só leitura.
Sai de `podeVerResultados`, a mesma função que decide quem vê resultado alheio — duas
definições de "o RH pode ler" seriam duas para manter em sincronia. Contexto montado sem o
campo **falha fechado**: não saber se pode não é poder.

#### Teste dirigido — o mesmo par que foi medido antes da correção

| Chamada | Antes | Agora |
|---|---|---|
| `wandersonnascimento` **GET** a avaliação designada ao Claudimar | 200 com o questionário | **403** *"Esta avaliação foi designada a outra pessoa…"* |
| `wandersonnascimento` **POST** `/respostas` nela | aceitava | **403** *"Só o avaliador designado responde e envia…"* |
| `wandersonnascimento` **POST** `/enviar` nela | aceitava | **403** |
| `ariellypereira` (RH_ADMIN) **GET** avaliação de terceiro | 200 + `ACESSO_TERCEIRO` | **200 + `ACESSO_TERCEIRO`** (não mudou) |
| `ariellypereira` **POST** `/respostas` em terceiro | aceitava | **403** |
| `claudimaroliveira` (o designado) na dele · `wandersonnascimento` na fila dele | 200 | **200** |

Trilha das mesmas chamadas em `rh.auditoria`: 3 × `ACESSO_NEGADO_NAO_DESIGNADO:{abrir,responder,editar}`
do Wanderson, 1 × `ACESSO_TERCEIRO:abrir` da Arielly e 1 × `ACESSO_NEGADO_NAO_DESIGNADO:responder`
dela. **Leitura grava; escrita recusa.**

#### ✅ Nada disso chegou a acontecer no banco — verificado antes de corrigir

Cruzamento de `rh.auditoria` (ações que não são `DESIGNAR`) com `core.usuarios` → matrícula →
`rh.colaborador`, comparando quem agiu com `avaliacao.avaliador_id`:

- **9 `ENVIAR` por pessoa identificada, todos pelo avaliador designado** (`era_o_designado = t`);
- **1 `ENVIAR` do usuário `smoke-004100`** — id de script de smoke, que nunca existiu em
  `core.usuarios`, sobre uma avaliação que **não existe mais** no banco;
- **1 único `ACESSO_TERCEIRO` na história do módulo**: a sonda de leitura de 06/09, feita para
  medir o furo.

A consulta fica registrada porque é a que se repete se a pergunta voltar:

```sql
SELECT a.acao, u.username, (col.id = av.avaliador_id) AS era_o_designado, a.criado_em
FROM rh.auditoria a
LEFT JOIN core.usuarios u   ON u.id = a.usuario_id
LEFT JOIN rh.colaborador col ON trim(col.matricula) = trim(u.matricula)
LEFT JOIN rh.avaliacao av    ON av.id = a.entidade_id
WHERE a.entidade = 'Avaliacao' AND a.acao <> 'DESIGNAR'
ORDER BY a.criado_em;
```

### 3.1.3. Ser avaliador é fato do DADO — o que a correção alcançou, medido

A correção de 06/09 (RH_ADMIN entra na fila; o item de menu sem condição de papel) nasceu de um
caso: a gestora avalia 13 pessoas e tem só `RH_ADMIN`. **Conferido depois se pegou todo mundo**
— e o recorte é este, no DEV de 06/09:

| | |
|---|---|
| Avaliadores do ciclo Piloto (pelo dado) | **53** |
| …com conta na plataforma (matrícula casada) | **7** |
| …com permissão no módulo GESTAO_PESSOAS | **4** |
| …que de fato abrem a própria fila (HTTP 200) | **4** — 13 · 84 · 6 · 22 avaliações |

Os **46 sem conta** são esperados: o piloto ainda não distribuiu acesso. Os **3 com conta e sem
permissão** não são — `supdept01` (matrícula 001047, **13 avaliações**), `rodrigoleao` (4) e
`lidyanerocha` (1) fazem parte do dado como avaliadores e recebem `403 Sem acesso ao módulo`.

✅ **O degrau que sobrava foi fechado em 06/09.** O menu mostra *"Minhas avaliações"* a quem
tiver **qualquer papel no módulo** (de propósito — ser avaliador é fato do dado), e o controller
exigia `AVALIADOR` ou `RH_ADMIN`: quem tivesse só `RH_MODELO` ou `RH_CICLO` **veria o item e
levaria 403** — o mesmo defeito da gestora, uma role adiante, e sem sintoma porque ninguém tem
essas roles hoje. Agora é `@Roles(...QUALQUER_PAPEL_DO_MODULO)`.

⚠️ **Não é o mesmo que remover o `@Roles`:** sem ele o `RolesGuard` não checa nada e quem não
tem o módulo entra. A exigência continua sendo "tem permissão no módulo"; **quem decide o
acesso ao registro é a designação**.

Conferido ao vivo, com a mesma pessoa e o papel trocado no Configurador:

| Conta `claudimaroliveira` com papel… | `GET /avaliacoes/minhas` | `POST /apuracao` (só RH_ADMIN) |
|---|---|---|
| `RH_CICLO` | **200 · 44 avaliações** — a fila vem do DADO, não do papel | **403**, como deve |
| `AVALIADOR` (restaurado) | 200 · 44 | — |

⚠️ **A identidade é a MATRÍCULA, e ela não pergunta quem é a conta.** `supdept01` é conta de
TESTE da Logística e carrega a matrícula **001047**, que é a de uma pessoa real (Clenio Marcos
Mendes, avaliador de 13). Dar GESTAO_PESSOAS a essa conta é dar a fila dele a quem usar a
conta. Não é defeito do módulo — é consequência de resolver identidade por matrícula, que é o
desenho certo — mas é motivo para não haver conta de teste com matrícula de gente de verdade.

#### ⭐⭐ A REGRA DE MENU que decorre disso — e ela é o OPOSTO da regra da plataforma

> **Item cujo conteúdo vem do DADO, e não do papel, não leva condição de papel no menu.**
> Ele aparece para quem tem acesso ao módulo, e **quem não tem fila cai no estado vazio da
> própria tela**, que já diz o que aquilo significa. O gate de verdade é o backend, que filtra
> por DESIGNAÇÃO.

**Por que isto precisa estar escrito aqui, e não como comentário de um item:** hoje a regra
mora num comentário dentro de `layouts/Layout.tsx`, ao lado do item "Minhas avaliações". A
próxima pessoa que reorganizar o menu — inclusive eu, daqui a três semanas — vai olhar os três
itens, ver que dois têm condição de papel e um não, achar que faltou, e "consertar". O sintoma
de volta é **mudo**: ninguém recebe erro, o item simplesmente deixa de existir.

**Ela contraria o padrão da plataforma de propósito.** Levantado em 07/09 lendo os cinco
módulos com casca própria (Workspace, Inventário, Fiscal, Configurador, Logística): **todos**
filtram o menu por papel antes de renderizar — some, nunca desabilita, nunca deixa levar 403 —
e o comentário da Logística diz o porquê em uma linha: *"item de menu a mais abre tela vazia"*.
A regra deles é boa e continua valendo para **Ciclos** e **Avaliadores**.

**O que a plataforma não previu.** Workspace e Logística resolvem papéis SIMULTÂNEOS, mas os
dois lados da conta ainda são **papéis vindos do JWT** — a mesma pessoa com papéis diferentes em
departamentos diferentes (o Workspace cruza role × funcionalidade no MESMO depto; a Logística
faz a união e expõe `temRole`). Aqui é outra coisa: **`RH_ADMIN` é papel, "ser avaliadora" é
fato do dado** — existe uma linha em `avaliacao` com `avaliadorId` = ela. Não está no token, não
é papel de departamento nenhum, e **nenhum item de menu da plataforma se decide assim**.

**O caso que originou.** A gestora de RH avalia 13 pessoas e tem só `RH_ADMIN` — ela nunca teria
o papel `AVALIADOR`. Enquanto o item exigia esse papel, **as 13 avaliações eram INALCANÇÁVEIS**:
apareciam como pendência dela no painel do ciclo e não havia botão nenhum que as abrisse. Não
há deep link no módulo, então esconder do menu é esconder a tela. Corrigido em 06/09 no menu e
no controller (`QUALQUER_PAPEL_DO_MODULO`, acima).

**Como saber se um item novo cai nesta regra:** pergunte *"o que esta tela mostra depende de o
backend achar linhas com o meu id, ou de eu ter um papel?"*. Se for o primeiro, sem condição de
papel — e a tela precisa ter estado vazio que explique. Se for o segundo, filtre por papel como
o resto da plataforma faz.

#### 🔴 Duas dívidas do menu, para entrarem quando o padrão for aplicado

1. **O menu SOME quando sobra um item só** (`mostrarMenu = itens.length > 1`). Quem só responde
   avaliação — o supervisor de loja, no celular — navega **sem barra nenhuma**. Nenhum outro
   módulo esconde a navegação, e é justamente quem tem menos caminhos que fica sem nenhum.
2. **Não existe "Voltar ao Hub".** Os cinco módulos têm, no rodapé da sidebar. Aqui, quem entra
   por link direto só sai pelo **Sair**, que derruba a sessão da **plataforma inteira**, não a
   deste módulo.

⚠️ **Reorganizar a casca antes de existir a tela de vínculo manual seria decidir o agrupamento
no escuro** (decisão de 07/09) — a peça principal do processo não está na mesa. Ver §3.1.5.

### 3.1.4. ⭐⭐ O VÃO: a separação de funções guarda a AVALIAÇÃO — e há atos ANTES dela

Achado estrutural de 06/09/2026, e não detalhe de duas telas.

`separacao-funcoes.ts` protege o registro `Avaliacao`: ninguém abre, edita, reabre, responde ou
recalcula aquela em que é o avaliado, e o teste de invariante varre o fonte cobrando que todo
acesso a `prisma.avaliacao` passe pela porta. Isso cobre **a vida da avaliação**.

**Só que a avaliação é o FIM de uma cadeia**, e cada elo antes dela também decide o resultado —
sem tocar em `prisma.avaliacao`, e portanto sem passar por guarda nenhuma:

| Elo | Tabela | O que decide | Guardado? |
|---|---|---|---|
| público da aplicação | `aplicacao_publico` | **se a pessoa é avaliada** neste ciclo, e por qual questionário | ❌ |
| cadastro de quem avalia quem | `designacao_padrao` | **quem a avalia** | ❌ |
| revisão da lista arbitrada | `designacao_padrao.origem` | confirmar a escolha acima | ❌ |
| elegibilidade do ciclo | `ciclo_elegibilidade` | incluir/excluir alguém do ciclo por decisão manual | ❌ |
| a avaliação | `avaliacao` | a nota | ✅ separação de funções |

Concretamente: um `RH_ADMIN` que também é avaliado pode **tirar-se do público** (enquanto não
houver avaliação — depois o backend recusa), **encerrar a designação de quem o avalia** e
**confirmar a lista que o inclui**. Nada disso é 403 hoje, e nada disso é bug de tela: é o
alcance da regra, que foi escrita sobre o registro final.

⚠️ **Não conserte isso "por simetria".** Ao contrário da escrita de terceiro (§3.1.2), aqui
**existe pergunta legítima a fazer**: o RH monta o ciclo, e montar inclui a própria linha —
tirar de alguém a capacidade de montar pode ser pior do que o risco que ela cria, ainda mais
com um `RH_ADMIN` só (§5). Por isso virou **pendência do RH**, e não correção nossa.

⭐ O que já ampara, se a resposta demorar: os três atos são auditados (`PUBLICO_REMOVER`,
`ENCERRAR`, `REVISAR` — este com todos os ids no `valorNovo`), a linha agora **aparece marcada**
nas duas listas, e a regra do **segundo `RH_ADMIN`** existe exatamente para haver quem desfaça.

#### A cadeia elo a elo — levantada em 06/09, com a régua das quatro listas

**Quem abre, nos quatro:** ninguém fora do RH. Público e elegibilidade são
`RH_ADMIN + RH_CICLO`; cadastro de avaliadores e revisão, `RH_ADMIN` puro. **Na prática, hoje,
é uma pessoa só** — a gestora é a única `RH_ADMIN` e ninguém tem `RH_CICLO`. É o mesmo motivo
pelo qual o segundo `RH_ADMIN` está na §5: sem ele não existe quem desfaça.

| | **1. Público** (`aplicacao_publico`) | **2. Cadastro de avaliadores** (`designacao_padrao`) | **3. Revisão** (`.origem`) | **4. Elegibilidade** (`ciclo_elegibilidade`) |
|---|---|---|---|---|
| **Tela** | Aplicações | Avaliadores | Avaliadores | Designação |
| **A linha dela aparece?** | sim, entre 142 | sim, entre os 45 do Claudimar | está no lote — **o botão é do bloco, não da linha** | sim |
| **É marcada?** | ✅ desde 06/09 | ✅ desde 06/09 | — (não há linha própria a marcar) | ✅ desde 06/09 |
| **O ato** | decide **se ela é avaliada** e por qual questionário | decide **quem a avalia** | converte "a ordem alfabética decidiu" em "gente decidiu" | sobrepõe a régua, nos dois sentidos |
| **Reversível? Por quem?** | sim, re-adicionando — mas é **DELETE**: a linha original não volta e a `origem` se perde | sim, e **nunca apaga**: encerra `vigenciaFim` e cria outra linha | 🔴 **não pela tela** — só desfazendo a importação inteira | sim, **versionado** (`removidoEm` + quem removeu); a decisão anterior fica |
| **O que impede hoje** | só a trava tardia **"já tem avaliação"**; antes da designação, nada. Sem motivo | só **autoavaliação** (`avaliador ≠ avaliado`, no serviço **e** como CHECK no banco). Sem motivo | nada. Sem motivo | **motivo obrigatório** (`@MinLength(3)` no DTO e no serviço). Nada mais |

**A elegibilidade, nas três perguntas que se fez a ela:**

- **Incluir ≠ excluir?** No código, **não** — mesma função, mesmo guard, mesma auditoria; muda o
  rótulo (`DECIDIR_INCLUIR`/`DECIDIR_EXCLUIR`). No efeito, **muito**: incluir-se gera trabalho
  para outra pessoa e entra nas contagens; **excluir-se tira a avaliação do ciclo e apaga o
  sintoma** — o painel conta "sem avaliador" só entre elegíveis, então a pessoa sai da conta *e*
  do alerta.
- **Motivo obrigatório?** Sim — **é o único dos quatro elos que exige**, como o reabrir.
- **Aparece depois?** Sim, e melhor que os outros três: na tela de Designação a linha fica
  esmaecida com `Fora: <motivo>`, etiqueta **"decisão do RH"** e a justificativa em itálico. Os
  outros três só existem em `rh.auditoria`.

#### ⚠️ HIPÓTESE (leitura de código, NÃO comprovada): dois atos combinados apagam o sintoma

Lendo o fonte em 06/09, a sequência abaixo parece deixar a pessoa invisível em todas as telas —
e cada passo é, sozinho, defensável:

1. **EXCLUIR** com motivo → `copiarDoCadastro` filtra por `elegivel`, então o lote não gera
   avaliação para ela, e o painel a tira de "sem avaliador neste ciclo";
2. sem avaliação, **"Tirar" do público passa a ser permitido** (a trava é justamente "já tem
   avaliação") → ela sai da lista de Designação, que é montada a partir do público, e com ela
   somem a etiqueta "decisão do RH" e a justificativa — o único lugar onde o ato aparecia;
3. `foraDeTodasAsAplicacoes` **não a recupera**, porque filtra quem tem decisão EXCLUIR de
   propósito (*"contar essa pessoa transformaria uma decisão registrada em cobrança eterna"* — o
   comentário está certo, e é o que fecha o círculo).

🔴 **Isto é hipótese fundamentada, não fato verificado.** Foi deduzida de quatro trechos de
código, **não executada**: ninguém rodou a sequência, e nenhum dado foi alterado para comprová-la.
Não a trate como verificada — se for útil confirmar, **faça no DEV e registre o resultado aqui**,
com data, dizendo se ela se sustentou ou caiu.

### 3.1.5. ✅ Criar o vínculo avaliador → avaliado À MÃO — a tela que faltava (07/09)

Levantado em 07/09, depois de a gestora entrar como `ariellypereira` e **não achar onde se
vincula um avaliador a um avaliado**. Ela não achou porque não está lá.

| Caminho | O que faz | Existe? |
|---|---|---|
| `POST /designacao-padrao` (avaliadorId + avaliadoId) | cria o vínculo do CADASTRO, um por vez | ✅ backend · ✅ cliente (`api.ts`, `cadastroAvaliadores.designar`) · ❌ **nenhuma página chama** |
| `/avaliadores` → *O que falta* | lista quem está sem avaliador, agrupado | ✅ — **somente leitura**. O texto diz *"nomear o responsável de um grupo resolve o grupo inteiro"* e **não há controle para nomear** |
| `/avaliadores` → *Por avaliador* | **Tirar** uma linha, **Conferi, está certo** | ✅ — remove e revisa; **não cria** |
| `/avaliadores` → *Importar planilha* | CSV com os pares | ✅ — **é o único caminho que cria vínculo hoje** |
| `/ciclos/:id/designacao` | 1 avaliador → N avaliados **dentro do ciclo** | ✅ — mas cria `avaliacao`, **não** o cadastro; e vive numa aba de 2º nível que o menu não anuncia |

⚠️ **A capacidade existe na API e não tem botão** — é a mesma família do
`foraDeTodasAsAplicacoes` que chegava e era descartado (§3.12): o backend acerta, nada reclama,
e a função simplesmente não existe para quem olha a tela.

**Decisão de 07/09 — a ordem mudou por causa disto:** o menu do módulo diverge do padrão da
plataforma (topo em vez de sidebar, sem seções, sem "Voltar ao Hub", processo em abas de 2º
nível), e a vontade era aplicar o padrão. **Não se reorganiza a casca sem a peça principal na
mesa:** falta a tela de vínculo manual, que é item de menu. Primeiro a tela, depois o menu
inteiro de uma vez — telas que existem, as quatro abas do ciclo e o lugar da tela nova.

#### ✅ Feito em 07/09 — o botão, nos três pontos de entrada

Não virou tela nova, de propósito: um item de menu ao lado de *Quem avalia quem* recriaria as
**duas portas para a mesma pergunta** que acabamos de fechar. O que faltava era o botão que a
tela já deveria ter:

| Onde | Rótulo | Alcance |
|---|---|---|
| *O que falta* → cabeçalho do grupo | **Definir avaliador · N pessoa(s)** | o grupo inteiro (é o que o texto da tela já prometia e não cumpria) |
| *O que falta* → linha da pessoa | **Definir avaliador** | uma pessoa — o caso da gestora em 07/09 |
| *Por avaliador* → dentro do cartão | **Adicionar pessoa** | entra pelo outro lado: "mais alguém para o fulano avaliar" |

#### ⭐⭐ O aviso: o cadastro NÃO toca ciclo já aberto

O cadastro é permanente e o ciclo é uma **cópia** dele. Sem dizer isso na hora, o nome bom da
tela **piora** o problema: a pessoa vincula, sai convencida de que resolveu, e a avaliação não
existe. O aviso é **inline e fica** (toast some antes de ser lido) e **nomeia o ciclo** —
"o ciclo aberto" é ambíguo justamente com dois abertos.

⚠️ **Aviso genérico não serve, e o motivo tem nome: `JA_RESPONDIDA`.** O lote RECUSA trocar o
avaliador de uma avaliação que já tem resposta; com o texto genérico a pessoa rodaria o lote e
não veria nada — o motivo ficaria enterrado no relatório. São **oito estados**, decididos em
`designacao/situacao-no-ciclo.ts` (função pura, com spec):

| Estado | O que a tela diz |
|---|---|
| `JA_REFLETE` | *"o ciclo já reflete este vínculo — nada a fazer"* |
| `SEM_AVALIACAO` | falta rodar **Designar pelo cadastro** (com link) |
| `FORA_DO_PUBLICO` | *"não entra no ciclo: não está no público de nenhuma aplicação"* + link para Aplicações |
| `FORA_PELA_REGUA` | *"está fora pela **régua**: «…»"* |
| `FORA_POR_DECISAO_RH` | *"foi tirado **por decisão do RH**: «…»"* — com a justificativa, porque **quem lê pode ser quem decidiu** |
| `OUTRO_AVALIADOR` | a avaliação é com fulano; o cadastro não troca sozinho |
| `OUTRO_AVALIADOR_MANUAL` | idem, e foi designada à mão no ciclo: o lote só substitui se mandarem |
| `JA_RESPONDIDA` | *"nada muda: fulano já respondeu N pergunta(s). Trocar o avaliador agora atribuiria o julgamento de uma pessoa a outra"* — **a mesma frase da recusa do lote: uma voz só** |

##### ✅ `JA_RESPONDIDA` verificado AO VIVO — 07/09, e rendeu três estados

Par usado: **ANA CLAUDIA GOMES RODRIGUES (005124)**, o rascunho preso de **3/14** no Piloto,
vinculada no cadastro a **CLAUDIMAR** (≠ do avaliador dela). Pelo 3º ponto de entrada
(*Por avaliador* → cartão → **Adicionar pessoa**), a tela mostrou as duas linhas de uma vez:

> ⚠ No ciclo **Avaliação Geral 2026** a avaliação de ANA é com **WANDERSON NASCIMENTO DA COSTA**,
> e foi designada **à mão dentro do ciclo**: o lote só a substitui com "substituir os ajustes
> manuais" marcado, em [Designar pelo cadastro].
>
> ⓘ No ciclo **Piloto 15/09/2026** **nada muda**: **WANDERSON NASCIMENTO DA COSTA** já respondeu
> **3 pergunta(s)**. Trocar o avaliador agora atribuiria o julgamento de uma pessoa a outra.

A ordem funcionou (o ⚠ que pede ação em cima, o ⓘ informativo embaixo) e **a linha do
`JA_RESPONDIDA` não tem link, de propósito**: não há para onde mandar a pessoa, porque não há o
que fazer. E o **desfazer** exercitou o terceiro estado de graça: re-vincular ao Wanderson
devolveu `JA_REFLETE` **nos dois ciclos** — *"o ciclo já reflete este vínculo"* —, que é
exatamente a ordem de checagem que a §3.1.5 defende.

⭐ **A avaliação não foi tocada.** Mesmo `id`, `EM_ANDAMENTO`, **3 respostas**, mesmo avaliador e
o **mesmo `atualizado_em` (06/09 17:12)** — o carimbo intacto é a prova de que nada escreveu nela.

⚠️ **O resíduo que ficou, e é permanente** (previsto e aceito antes de rodar): o vínculo dela
voltou para o Wanderson, **mas a linha agora é `MANUAL` e NÃO provisória**, onde antes era
provisória — então **"linhas provisórias" caiu de 928 para 927**. O resto voltou: **108** sem
avaliador, **928** com avaliador, "não revisadas" em 159. O histórico dela tem 4 linhas (2 da
carga do DEV + 2 do teste) e `rh.auditoria` guarda `DESIGNAR_MANUAL` · `ENCERRAR` ·
`DESIGNAR_MANUAL`. Encerra, nunca apaga.

##### 🟡 PERGUNTA ABERTA — `designar()` grava sempre `provisorio: false`

Não é resíduo do teste: é **comportamento**. Vínculo criado pela tela **nunca nasce provisório**,
nem quando substitui um que era — foi assim que o 928 virou 927 acima.

**Pode estar certo:** ato manual é decisão de gente, e a tarja "provisória" existe para dizer
*"isto foi a T.I. que chutou, não o RH que decidiu"* (§11). Quem clica está decidindo, então a
linha deixa de ser chute. **Mas ninguém decidiu isso explicitamente** — saiu por omissão do
código, e é a mesma família da tarja que virou coluna em 06/09 para não sumir em silêncio.

⚠️ **Não corrigir sem decisão.** As duas saídas são defensáveis e mudam o que o número
"linhas provisórias" significa: (a) fica como está — clicar é decidir, a linha nasce firme; ou
(b) herda o `provisorio` de quem substituiu, e a tarja só cai quando alguém disser que caiu.

⭐ **A ORDEM das checagens é regra:** `JA_REFLETE` vem antes de tudo. Dizer *"já tem avaliação
com Fulano"* logo depois de vincular o Fulano é absurdo — e se ela já foi respondida, é o
processo andando, não um aviso. **`FORA_PELA_REGUA` × `FORA_POR_DECISAO_RH` são estados
distintos** pela mesma razão: a segunda tem autor e justificativa registrados.

⭐ **Uma linha por ciclo aberto, SEMPRE** — inclusive as que dizem "nada a fazer". Com dois
abertos, omitir aquele em que nada muda faz o silêncio ser lido como "não se aplica". O que
**pede ação vem primeiro**, e `pedeAcao` vem do backend: a tela ordena por ele e não re-deriva a
regra. No lote, soma por situação dentro de cada ciclo (o maior grupo tem 61 pessoas — uma linha
por pessoa seria ilegível).

#### ⭐ O teste de invariante pegou a primeira versão — e estava certo

A consulta nasceu dentro do serviço do CADASTRO e tocava `prisma.avaliacao`; o
`separacao-funcoes.invariante.spec` reprovou. A lista de dispensas diz, por escrito, que
**entrada que não couber nas frases existentes é exceção NOVA — e aí o desenho é que precisa de
revisão, não a lista**. Foi o que se fez: a consulta **mudou de dono** para o `DesignacaoService`
(quem sabe quem avalia quem dentro de um ciclo, e que já tem dispensa escrita), e o cadastro
**pergunta** a ele. Nenhuma dispensa nova foi criada.

Conferido ao vivo em 07/09 com a conta da gestora: pelo botão da linha, o aviso trouxe as duas
linhas certas — `FORA_DO_PUBLICO` no *Avaliação Geral 2026* e `SEM_AVALIACAO` no
*Piloto 15/09/2026*. ⚠️ **O vínculo de teste foi DESFEITO em seguida** e o cadastro voltou aos
**108** (o histórico guarda as duas linhas, como manda o desenho: encerra, nunca apaga).

🟡 **Em aberto, para decidir junto com o menu:** o que fazer com as quatro abas de 2º nível
(Aplicações · Designação · Painel · Resultados). Nenhum outro módulo aninha navegação, e é aí
que "Designação" se esconde. As opções levantadas — virar itens de sidebar com seletor de ciclo;
continuar abas mas anunciadas no menu; ou um item "Ciclo em foco" — mudam de peso conforme
**dois ciclos abertos ao mesmo tempo**, que é o caso de hoje (§3.10).

### 3.1.6. ✅ O MENU do módulo — decidido e aplicado em 07/09

A casca era um cabeçalho verde com abas no topo; virou **sidebar**, como nos outros cinco
módulos. O que mudou não foi só a forma:

```
   Minhas avaliações            ← sem seção, primeiro
   ── CADASTROS ──
   Quem avalia quem
   ── CICLO ──
   Ciclos
```

| Item | Rota | Ícone | Papel | A pergunta de quem procura |
|---|---|---|---|---|
| Minhas avaliações | `/` | `ClipboardList` | **nenhum** (§3.1.3) | *"o que eu tenho para responder?"* |
| Quem avalia quem | `/avaliadores` | `UserCheck` | `RH_ADMIN` | *"quem é o avaliador do fulano?"* |
| Ciclos | `/ciclos` | `CalendarRange` | `RH_ADMIN` · `RH_CICLO` | *"como está a avaliação deste ano?"* |

⭐ **O nó era o par de nomes, não a profundidade.** `Quem avalia quem` (cadastro, permanente) e
`Designação` (etapa do ciclo) respondem a mesma pergunta em voz alta. O cadastro leva **a
pergunta como nome** — é a frase que a pessoa tem na cabeça, e ela para ali sem precisar saber
que existe cadastro, ciclo e cópia entre os dois; a **palavra técnica fica com a etapa**, que é
onde quem já segue o processo a procura. Foi por essa ambiguidade que a gestora não achou a
tela em 07/09, não por ela estar funda.

⭐ **As quatro etapas do ciclo continuam DENTRO do ciclo** (Aplicações · Designação · Painel ·
Resultados), como as etapas de um inventário no módulo Inventário (`EtapaStepper`). Descartada a
alternativa de virarem itens de menu com um seletor global de ciclo: **com dois ciclos abertos**
— o caso de hoje — e números plausíveis um no lugar do outro (95 × 84 sem designação), o ciclo
selecionado vira um **MODO que vaza**, e o RH lê o número do ciclo errado sem receber erro
nenhum. O ciclo mora na URL. Bônus: a lista de Ciclos é o único lugar onde os dois aparecem
lado a lado, que é onde a diferença entre eles é legível.

✅ **As duas dívidas do menu foram junto:** a navegação **não some mais** com um item só (a
sidebar sempre existe — antes, quem só responde avaliação navegava sem barra nenhuma) e existe
**"Voltar ao Hub"** no rodapé (antes a única saída era o Sair, que derruba a sessão da
plataforma inteira).

⚠️ **`Sair` continua COM RÓTULO** — divergência deliberada, mantida de 06/09: no padrão é só o
ícone, e ícone mudo encostado no nome de quem está logado é onde um toque errado derruba a
sessão da plataforma. O que mudou foi o lugar, que passou a ser o do padrão (rodapé da sidebar).

🔴 **`RH_MODELO` fica sem NENHUM item, e isso está certo** — a tela de questionários não existe
(o modelo só se monta pela API, §2). Não se inventa item de menu para tela que não existe; antes
ele via "Ciclos" e levava 403, porque a rota é `RH_ADMIN`+`RH_CICLO` (dívida fechada aqui).
**Ele volta ao menu quando a tela de questionários existir** — em `CADASTROS`, com
`RH_ADMIN` + `RH_MODELO`.

Conferido ao vivo em 07/09: RH_ADMIN vê 3 itens e as 2 seções; `wandersonnascimento`
(AVALIADOR) vê 1 item **com a sidebar inteira**; a 360px o hambúrguer abre a gaveta com backdrop.
`--altura-cabecalho` segue MEDIDA — 0px no desktop (não há barra no topo) e 69px no celular —, e
o cabeçalho sticky da fila continua parando no lugar certo nas duas larguras.

### 3.1.7. ⭐ REGRA DE TEXTO: nada de particípio concordado — o cadastro não tem gênero

> **Nenhum texto de tela usa particípio que concorde em gênero com uma pessoa.**
> `rh.colaborador` não guarda gênero, e não há de onde derivar: "ANA CLAUDIA passa a ser
> **avaliado** por FULANO" sai errado em metade dos casos.

**A saída é a voz ATIVA**, que diz o mesmo e não depende de gênero:

| ❌ Não | ✅ Sim |
|---|---|
| "ADELSON passa a ser avaliado por STEFANY" | "**STEFANY passa a avaliar ADELSON**" |
| "Fulana foi designada para…" | "**O RH designou Fulana para…**" |
| "…não está incluído no ciclo" | "**…está fora do ciclo**" / "**o ciclo não inclui…**" |

Vale para os **oito avisos de vínculo** (§3.1.5), para as **recusas do lote**, para o
**relatório da cópia do cadastro** — e para todo texto novo. Quando a voz ativa não couber,
use forma nominal ("**sem avaliador**", "**fora do ciclo**", "**a avaliação de X é com Y**"),
que também não concorda.

⚠️ **Não resolva com "avaliado(a)".** Parêntese de gênero é ruído em tela que alguém lê em pé,
no corredor da loja, e não escala para as frases longas dos avisos. A voz ativa é mais curta,
não só mais correta.

*(Nasceu em 07/09 de uma correção de uma frase só — o resumo do modal de vínculo — e subiu para
regra porque a próxima frase seria escrita pela mesma mão, com o mesmo erro.)*

### 3.1.8. ✅ Apurar com 3 de 894 — a confirmação, a base e a data (07/09)

Achado do roteiro do Chrome: **"Encerrar" tinha guarda e "Apurar" não tinha nada**. Um clique
verde apurava 3 avaliações de 894, sem dizer, e a tela de Resultados exibia
*"3 resultado(s) · média 62,59"* — um número com cara de oficial.

**Não virou trava, virou aviso.** Apurar cedo é legítimo: reapurar substitui o resultado sem
reabrir avaliação nenhuma, e é assim que se confere o cálculo. O que não pode é não saber sobre
quantas pessoas o resultado sai. A confirmação diz o número real:

> **3 de 894** avaliações foram enviadas. Apurar agora produz resultado **só para essas 3**.
> *Reapurar depois substitui o resultado, sem reabrir avaliação nenhuma — apurar cedo para
> conferir o cálculo é legítimo.*
> `[ Cancelar ]` `[ Apurar 3 avaliação(ões) ]`

O botão de confirmar **carrega o número**, e o texto muda com o dado: se todas entraram, diz
"todas entraram — o resultado sai completo"; com **zero** enviadas, diz que não há o que apurar e
o botão fica desabilitado (o backend já recusava esse caso — a tela deixou de descobrir isso
depois do clique).

#### A base fica à vista SEMPRE, não só na hora de apurar

Quem abre a tela uma semana depois não estava na hora do clique. Então o cabeçalho de Resultados
passa a ser:

> **3** de **894** avaliações do ciclo apuradas · média **62,59** sobre essas **3**
> ⚠ *Apuração parcial: 891 avaliação(ões) do ciclo ainda não entraram nesta conta.*
> *Última apuração em 06/09/2026, 18:40.*

Com filtro aplicado, a média diz "sobre N em exibição" — o denominador acompanha o que está na
tela, e o total do ciclo continua ao lado.

#### ⭐ A DATA da apuração existia no dado e não aparecia em lugar nenhum

`calculadoEm` vinha do backend **nas duas respostas** — na linha da lista e na memória de cálculo
— e nenhuma das duas o renderizava. É a terceira ocorrência da mesma família neste módulo
(`foraDeTodasAsAplicacoes` e o `restrita` do modal foram as outras): **o backend manda, o cliente
descarta, e nada reclama**. Agora aparece como *"Última apuração em …"* no cabeçalho e
*"Apurado em …"* dentro da memória de cálculo.

Isso importa porque o resultado é **gravado e pode ser reapurado**: sem a data, ninguém sabe se o
número já inclui as avaliações que entraram depois.

⚠️ **`CicloDetalhado` voltou a carregar `_count`** (o `GET /ciclos/:id` não trazia): a base do
ciclo é o que qualifica todo número lido na tela de Resultados, e ela precisa viajar junto do
ciclo. `avaliacoesPendentes`, que a listagem calcula e o `obter` não, continua fora do tipo — o
tipo diz a verdade sobre o que a rota devolve.

### 3.1.9. ⭐⭐ A CLASSE: o backend manda, o cliente descarta, e nada reclama

Três ocorrências em dois dias fazem padrão, não coincidência:

| Campo | O que era | Como apareceu |
|---|---|---|
| `foraDeTodasAsAplicacoes` | 959 pessoas fora de todo recorte do ciclo | conferência de tela (06/09) |
| `restrita` no modal da memória | "esta linha é você" | conferência de tela (06/09) |
| `calculadoEm` | **quando** o resultado foi apurado | conferência de tela (07/09) |

**Por que some em silêncio:** o backend calcula, serializa e devolve; o cliente não lê o campo.
Não há erro, não há log, o `tsc` não reclama de campo **a mais** na resposta, e nenhum teste
falha — o backend está certo e a tela está "funcionando". O dado simplesmente **não existe para
quem olha**, e o custo é sempre o mesmo: alguém decide sem uma informação que o sistema já tinha.

⚠️ **Nas três vezes quem perguntou foi uma CONFERÊNCIA DE TELA, não um teste.** É a assinatura
da classe: teste de backend passa (o campo está lá), teste de tela passa (a tela renderiza o que
manda renderizar), e só quem abre a tela procurando um dado específico nota a ausência. Enquanto
não existir geração de cliente a partir do contrato — ou um teste que compare a resposta real com
o que a tela consome —, **a varredura periódica é a única rede**.

#### Varredura de 07/09 — o que chega e não aparece

Método (barato, roda em minutos): extrair os campos de cada `interface` de
`services/api.ts` e procurar cada um no fonte das telas. ⚠️ **Ela só acha metade da classe**:
pega o que o contrato DECLARA e a tela ignora; **não pega** o que o backend devolve e o contrato
nem declara — que foi exatamente o caso do `foraDeTodasAsAplicacoes`. Para esse lado só há duas
saídas de verdade: gerar o cliente a partir do backend, ou um teste de contrato que compare a
resposta real com o tipo.

🔴 **A rede é MEIA rede, e fechar isso é pendência técnica** (lista B). Duas saídas, e elas não
são intercambiáveis:

1. **Gerar o cliente a partir do backend** — acaba com a divergência de tipo na origem, mas só
   diz que o campo EXISTE; não diz que a tela o usa.
2. **Teste de contrato** comparando a resposta REAL com o que a tela consome — é a única que
   pegaria o **primeiro** dos três casos (`foraDeTodasAsAplicacoes`), em que o backend devolvia
   um campo que o contrato do cliente nem declarava.

⚠️ **A varredura periódica não substitui nenhuma das duas.** Ela é hábito, não rede: vale rodar
antes de cada conferência de tela (`python3 scripts/varredura-contrato.py`, roda em minutos) —
não como CI, porque o que ela devolve exige julgamento (34 achados, 7 que importam).

**34 campos suspeitos em 20 interfaces**, dos quais estes importam:

| Campo | Onde | Por que importa |
|---|---|---|
| ✅ `LinhaDaLista.observacao` | lista de um avaliador | **CORRIGIDO em 07/09.** É **texto que alguém escreveu** dizendo por que aquela linha é daquele avaliador — no DEV, *"A ALOCAÇÃO DESTA LINHA FOI ARBITRADA: 32 pessoas divididas em ordem alfabética… Ninguém decidiu que esta pessoa é deste avaliador — revisar."*, escrito **logo acima do botão "Conferi, está certo"**. Quem conferia estava confirmando um chute sem ver que era um. Mesma família do motivo da transferência do Workspace |
| `AlertaAgregado.valores` + `criterioNome` | Painel → conferência | `valores` são **os valores que ficaram fora de toda faixa** — é o dado com que se conserta a faixa. A tela mostra o código do critério e engole o nome e os valores |
| `MemoriaDeCalculo.enviadaEm` | memória de cálculo | o par de `calculadoEm`: **enviada quando × apurada quando** é o que diz se a apuração já incluía esta avaliação. Corrigi metade do par ontem e deixei a outra no chão |
| `PreviaDoPublico.amostra` + `aplicacaoNome` | Montar público | a prévia **já traz os nomes** de quem entraria e mostra só números — e a prévia é justamente a tela do 🟠 5, que engana com contagem velha |
| `CicloDetalhado.conceitos` | ciclo | a **régua de conceitos** do ciclo. Escreve-se na criação e **não se lê em lugar nenhum depois** — quem vê "Atende" no resultado não tem como saber por qual faixa |
| `MemoriaDeCalculo.notaCriterios` | memória de cálculo | quanto os **critérios cadastrais** somaram. A memória mostra a nota da avaliação, os pesos e cada critério, e não mostra o subtotal que fecha a conta |
| `PreviaDaImportacao.novos` | importar planilha | quantas linhas são **novas** (vs. substituições) |

Sem consequência prática (registrados para não voltarem à lista): `centroCustoDescricao` nas
três listas de pessoas (a tela mostra `area`, que é o mesmo), `ordem`, `janelaTreinamentoMeses`,
`pontuacaoMaxima`, `tipoValor`/`codigoCalculo`/`faixas` do catálogo, `vigenciaInicio`,
`importacaoId`, `origemReferencia`, `avaliacaoId`. Os tipos de ENTRADA (`NovoCiclo`,
`NovaAplicacao`, `AlvoDoPublico`) aparecem na varredura e não são desta classe — são o que a tela
ENVIA.

### 3.1.10. ⭐⭐ PRÉVIA GRAVA O QUE MOSTROU — nunca recalcula no clique

Achado de 07/09, e é **maior do que o relatório do Chrome apurou**. O relatório dizia
"a prévia não acompanha a seleção: botão vivo com números velhos". O defeito era outro:

> **`Aplicar` montava o alvo com a seleção ATUAL.** A tela conferia um recorte e gravava outro.

Não era só mostrar número velho — era **gravar diferente do que foi conferido**, sem nada avisar.
E a prévia é justamente a peça que existe para dar confiança antes de um ato em lote: **prévia
que não protege é pior que prévia nenhuma, porque produz confiança**.

**A regra, e vale para toda prévia do módulo:**

> Uma prévia é um **retrato com identidade**: ela sabe de qual entrada foi calculada, e o botão
> que aplica **grava exatamente aquilo**. Se a entrada mudou, o botão não aplica — ele diz que a
> prévia envelheceu e manda recalcular. Nunca se recalcula o alvo no momento do clique.

Duas maneiras de cumprir, e as duas servem:
1. **guardar a identidade da entrada** junto da prévia e comparar no clique (foi o que se fez em
   Montar público: a prévia amarela, esconde os nomes e o botão vira "Recalcule antes de
   adicionar"); ou
2. **o backend devolver uma conferência** que o gravar exige de volta — é o que a **importação
   da planilha** já faz (`conferencia`), e é a mais forte, porque protege até de duas abas.

⚠️ **Onde olhar quando aparecer a próxima:** toda tela com "ver o que vai acontecer" + "aplicar".
Hoje são três — Montar público (corrigida), a importação da planilha (já protegida pela
`conferencia`) e "Designar pelo cadastro". ⚠️ **Conferido em 07/09: esta terceira NÃO carrega conferência** —
`copiarDoCadastro(ciclo, {aplicar})` é a MESMA função para prever e para gravar, e o
`aplicar: true` **recalcula tudo do zero no clique**. O risco é menor que o de Montar público
(a entrada não muda debaixo da mão de quem clica — vem do cadastro, não de checkboxes na tela),
mas a classe é a mesma. Não corrigido; fica registrado.

### 3.1.11. 📝 PROPOSTA (a decidir) — a tela ensina a sequência do ciclo

Escrita em 07/09, **antes de qualquer código**, como se fez com o menu. Nada abaixo está
implementado.

#### 1. A sequência, como o RH a vive

| # | Passo | Onde | Estado exigido |
|---|---|---|---|
| **0** | **questionário publicado** + **critérios com faixas** | 🔴 **não há tela** — só API | — |
| 1 | criar o ciclo: período, data-base, régua de conceitos | Ciclos | nasce `RASCUNHO` |
| 2 | montar as **aplicações** (questionário × peso × critérios) | Ciclo → Aplicações | **só `RASCUNHO`** |
| 3 | montar o **público** de cada aplicação | Ciclo → Aplicações | qualquer |
| 4 | ter **quem avalia quem** no cadastro | Quem avalia quem (fora do ciclo) | — |
| 5 | **designar** — gera as avaliações | Ciclo → Designação | qualquer |
| 6 | **abrir** | Ciclos | de `RASCUNHO`, **uma vez** |
| 7 | avaliadores **respondem** | fila | **só `ABERTO`** |
| 8 | acompanhar / conferir critérios | Ciclo → Painel | qualquer |
| 9 | **apurar** (repetível) | Ciclo → Painel | qualquer |
| 10 | **encerrar** | Ciclos | de `ABERTO`, com **0 pendentes** |

⚠️ **As portas que de fato fecham são MUITO menos do que se supõe** — levantado no fonte:

- **Abrir fecha UMA coisa**: criar aplicação e mudar peso (`aplicacao.service`). Mais nada.
- **Não existe volta de `ABERTO` para `RASCUNHO`** — não há rota. É a porta mais definitiva do
  módulo e hoje nada avisa antes.
- **Encerrar quase não fecha nada.** Recusa só o ajuste de período. **Designar, mexer no público
  e apurar continuam funcionando em ciclo ENCERRADO** — nenhum desses serviços olha o status do
  ciclo. Contradiz o que o próprio módulo escreve ("ciclo ENCERRADO não muda: o resultado já foi
  materializado"). 🔴 **Decidir se fecha.**
- **`EM_APURACAO` é estado MORTO**: `encerrar` o aceita e **nada no código o produz**. Ou some do
  enum, ou passa a existir.

#### 2. RASCUNHO visível

Hoje o estado é uma etiqueta e nada mais: não diz o que permite, o que a abertura fecha, nem que
a abertura é sem volta.

- **Faixa no topo do ciclo em RASCUNHO:** *"RASCUNHO — este é o único momento em que dá para
  criar aplicação e mudar peso. Abrir é definitivo: não há volta para rascunho."*
- **"O que falta para abrir", ANTES de tentar.** A validação (`assertCicloAbrivel`) é função pura
  sobre dados que a tela já tem — hoje a lista de problemas só aparece **depois** do clique, como
  erro. Vira lista viva no rascunho: conceitos contíguos ✓, cada aplicação com peso > 0 ✓,
  critérios com resolver ✓, sem modelo de demonstração ✓.
- **Confirmação ao abrir** dizendo o que fecha (e que não volta), no molde da confirmação do
  Apurar (§3.1.8).

#### 3. O que fazer agora — **não é stepper**

O `EtapaStepper` do Inventário funciona lá porque as etapas são de **mão única**. Aqui não são:
volta-se a Aplicações enquanto é rascunho, o público muda depois de designar, designar é
repetível, apurar é repetível. Um "1→2→3→4" **mentiria** sobre o processo.

**Proposta: uma LINHA DE ESTADO no cabeçalho do ciclo** — acima das abas, sempre visível,
derivada do dado, com o **próximo passo em destaque**:

> `RASCUNHO` · 4 aplicações · 894 no público · **95 sem avaliador** · 0 enviadas · 0 apuradas
> → **Próximo: designar as 95 que faltam** (ou "Abrir o ciclo", ou "Encerrar")

É o mesmo material do Painel, que hoje é uma aba: **"o que falta" não é uma seção, é o estado**.
A aba Painel continua, com o detalhe; o cabeçalho passa a dizer onde se está sem exigir um
clique.

#### 4. O ciclo novo

O modal pede nome, período, data-base, janela, flags e conceitos — **e está certo em não pedir
questionário**: o questionário é da APLICAÇÃO, não do ciclo, e é essa separação que permite
questionários diferentes por perfil (a melhoria que originou o módulo). O que falta é **dizer**:

- ao criar, levar direto para **Aplicações** com *"O ciclo nasceu em RASCUNHO e ainda não tem
  questionário nenhum. Monte a primeira aplicação."*;
- e, se **não houver nenhum modelo publicado**, dizer isso **na criação** — hoje só se descobre ao
  montar a aplicação, ou pior, na recusa da abertura.

#### 5. O que custa

| Tela | Mudança |
|---|---|
| `CicloPage` | a linha de estado + próximo passo (peça nova, dado já existente) |
| `CiclosPage` | faixa do RASCUNHO, "o que falta para abrir", confirmação de abrir |
| `AplicacoesPage` | frase do ciclo vazio; aviso de "nenhum modelo publicado" |
| `PainelPage` | nada obrigatório — cede o resumo ao cabeçalho e mantém o detalhe |
| 🔴 **novas** | **questionários** e **critérios/faixas** (passo 0) |

⭐ **Tudo do passo 1 ao 10 pode ser feito sem as telas que faltam.** O passo 0 continua por API —
e a proposta inclui **a tela dizer isso**, em vez de o RH descobrir que a tela não existe: no
rascunho, ao lado de "o que falta para abrir", a linha *"questionário e critérios são cadastrados
pela T.I. (ainda sem tela)"*.

### 3.1.12. ✅ Ciclo ENCERRADO fecha — com porta de volta (07/09)

`encerrar` recusava só o ajuste de período. **Designar, mexer no público e apurar continuavam
funcionando em ciclo encerrado** — nenhum desses serviços olhava o status, e o módulo escrevia
"ciclo ENCERRADO não muda" sem cumprir. O pior dos três é o apurar: muda a **nota** de quem já
recebeu devolutiva.

| Passa a RECUSAR no encerrado | Continua ABRINDO (é leitura) |
|---|---|
| designar (à mão e em lote) · decisão de elegibilidade · público (adicionar/remover) · apurar · **reabrir avaliação** | painel · resultados · memória de cálculo · lista de designação · **as duas prévias** (não gravam) · o cadastro "quem avalia quem" (é da plataforma, não do ciclo) |

⭐ **A recusa ensina.** *"Este ciclo foi encerrado em 07/09/2026 e não aceita apuração. Para mexer
nele, reabra o ciclo — é ato do RH_ADMIN, exige motivo e fica registrado. Encerrado, ele continua
servindo para LER: resultados, memória de cálculo, painel e designação seguem abrindo."*
"Não pode" sem alternativa é da mesma família do "Excluir" ser o único botão da linha.

⭐⭐ **O BECO que a regra fechou:** reabrir uma avaliação em ciclo encerrado **dava certo e não
servia para nada** — a avaliação voltava a `EM_ANDAMENTO` e ninguém podia respondê-la, porque
responder exige `ABERTO`. Agora a recusa ensina a ORDEM: *"Reabra o CICLO primeiro e só depois a
avaliação: com o ciclo encerrado, ela ficaria em andamento sem que ninguém pudesse responder."*

**A porta:** `POST /ciclos/:id/reabrir` — `RH_ADMIN`, **motivo obrigatório**, auditado
(`REABRIR`), com `reabertoEm`/`reabertoPorId`/`motivoReabertura` ao lado do `encerradoEm`, que
**não se apaga**: a história é que foi encerrado e depois reaberto. ⚠️ **Volta para `ABERTO`,
nunca para `RASCUNHO`** — rascunho reabriria criar aplicação e mudar peso, e peso mudado depois
de existir resultado é reapuração silenciosa. Reabrir é para corrigir o que aconteceu DENTRO do
ciclo, não para remontá-lo.

**O enum perdeu dois estados mortos:** `EM_APURACAO` (que `encerrar` até aceitava como origem) e
`CANCELADO`. Nada no código os produzia e nenhuma linha os tinha — conferido antes da migration.
Migration `20260907140000_ciclo_encerrado_fecha_e_reabre`, com o script de reversão escrito
dentro dela.

Verificado ao vivo em 07/09 num **ciclo descartável** (criado, usado e apagado): **as quatro
recusas com a mensagem certa — designar, público, apurar e decisão de elegibilidade** —, as cinco
leituras abrindo, reabrir sem motivo recusando, e reabrir com motivo devolvendo `ABERTO` com
`encerradoEm` preservado.

⚠️ **O que NÃO foi exercitado ao vivo:** que o **apurar volta a funcionar depois de reabrir**. O
ciclo descartável tinha **zero avaliações enviadas**, então a chamada voltou com a recusa
pré-existente *"Nenhuma avaliação enviada neste escopo — nada a apurar"*. Isso **prova que a
guarda soltou** (a mensagem mudou de dona), mas não é o mesmo que ver a apuração rodar. Fica no
padrão do `RH_ADMIN` sem fila e do `RH_MODELO`: **verificado por teste, não ao vivo** — sai
quando houver um ciclo com avaliação enviada que possa ser encerrado e reaberto.

### 3.1.13. ⚠️ INCIDENTE de 07/09 — o roteiro seguiu depois de a API recusar

**Eu** fiz, no papel de cliente, a classe que este módulo passou o dia caçando.

O roteiro de verificação encerrava o ciclo "Avaliação Geral 2026" e **depois** testava as
recusas. O `encerrar` **falhou** (*"5 avaliação(ões) ainda não foram enviadas"*) — e o script
**continuou**, rodando as escritas contra um ciclo que seguia ABERTO. Elas passaram, como deviam
passar num ciclo aberto, e a verificação não verificou nada.

**Estrago:** `Designar pelo cadastro` com `aplicar: true` criou **84 avaliações** no ciclo Geral
(9 → 93), todas `PENDENTE` e sem resposta; o apurar gerou o 4º resultado (de uma avaliação que
estava enviada e nunca fora apurada). Público, respostas e as 4 enviadas: **intactos**.

> **REGRA, e vale para todo roteiro de verificação daqui em diante: passo que falha INTERROMPE o
> roteiro.** `set -e` mais uma checagem explícita do código HTTP esperado a cada passo. Um roteiro
> que segue depois de uma recusa não está testando — está escrevendo.

**Limpeza (registrada porque é DELETE por SQL, sem rastro em `rh.auditoria`):**

- **07/09/2026** — apagadas as **84** avaliações do ciclo `Avaliação Geral 2026`, pelo critério
  `ciclo = Geral AND criado_em > '2026-09-07 14:00' AND status = 'PENDENTE'` sem nenhuma resposta
  e sem resultado. Conferido antes (84) e depois: o ciclo voltou a **9 avaliações**, público
  **98**, e as **4 enviadas com os `enviada_em` originais** de 06/09.
- **08/09/2026** — apagado o ciclo **`ZZ ROTEIRO 08/09`**, que a rodada de tela deixou ABERTO na
  base: 1 aplicação, 5 no público, **4 avaliações órfãs** (3 na fila do ADAO BATISTA, 1 na do
  CLAUDIMAR) e 4 linhas de elegibilidade. **Todas as 4 avaliações estavam `PENDENTE` com ZERO
  respostas** — nenhum trabalho humano se perdeu. Conferido depois: **2 ciclos** (9/98 e
  894/1036), fila do ADAO **zerada**, CLAUDIMAR de volta aos **44** do Piloto, nada órfão.
  ⚠️ **A auditoria foi PRESERVADA** (3 linhas do ciclo) — decisão diferente da limpeza anterior,
  em que apaguei as linhas junto: a trilha de que um teste aconteceu não deve ser limpa com o
  teste. 🔴 **Não existe excluir ciclo no módulo** — é o que obriga a limpeza a ser por SQL.
- **07/09/2026** — apagado o ciclo `ZZ TESTE — regra do encerrado (07/09)` e a aplicação dele
  (0 avaliações, 0 público, 0 resultados), criado só para exercitar a regra acima. Sobraram os
  **dois** ciclos de sempre.

⚠️ **Isto é a mesma classe do UPDATE manual que custou meses no Fiscal** e que motivou a rota de
ajuste de período em vez do SQL: mudança sem rastro. Fazer foi certo — era dado que eu mesmo
criei por erro, em DEV —, **não registrar é que não seria**.

### 3.1.14. ✅ A LINHA DE ESTADO do ciclo — "onde estou e o que falta" (07/09)

Primeira parte da proposta da §3.1.11. A tela do ciclo não dizia em que passo se estava; os
números existiam, espalhados entre as abas. Agora ficam **acima** delas, em toda aba:

> **4** aplicações · **1036** no público · **95** sem avaliador neste ciclo · **3** de 894 enviadas · **3** apuradas
> → **Próximo:** *Designe as 95 pessoa(s) sem avaliador neste ciclo*

⚠️ **Cada número traz o UNIVERSO no rótulo** — "sem avaliador **neste ciclo**", não "sem
avaliador". O cabeçalho é onde o número é lido primeiro, e é onde a ambiguidade custa mais: 95
aqui e 108 no cadastro são contas de coisas diferentes (§3.12).

#### A regra do "Próximo" — e o direito de dizer "não sei"

Mora no **backend** (`painel/proximo-passo.ts`, função pura com spec), junto dos números que a
derivam — mesma razão do `pedeAcao`: regra derivada na tela envelhece separada do dado. E lá há
teste; no frontend não há runner.

| Estado | Condição | Próximo |
|---|---|---|
| RASCUNHO | 0 aplicações | montar a primeira aplicação |
| RASCUNHO | 0 no público | montar o público |
| RASCUNHO / ABERTO | `semDesignacao > 0` | designar as N **deste ciclo** |
| RASCUNHO | tudo designado | abrir o ciclo |
| ABERTO | todas enviadas, nada apurado | apurar as N enviadas |
| ABERTO | tudo enviado e apurado | encerrar |

⭐⭐ **E quando não há passo óbvio, NÃO aparece nada.** O caso que define a regra é o **ciclo
aberto com tudo designado e ninguém respondendo**: a bola é dos **avaliadores**, não do RH.
Sugerir "apurar" empurraria uma apuração parcial; sugerir "encerrar" bateria na recusa. A linha
de estado continua na tela dizendo "3 de 894 enviadas", que é a informação verdadeira. Também
não aparece em ciclo **ENCERRADO** (reabrir é exceção, não caminho) nem em ciclo aberto e vazio.
**Passo chutado manda alguém fazer o que talvez não seja a vez de fazer — e a tela passa a mentir
com ar de ajuda.**

#### Não é stepper, e por quê

O `EtapaStepper` do Inventário funciona lá porque as etapas são de **mão única**. Aqui volta-se a
Aplicações enquanto é rascunho, o público muda depois de designar, designar e apurar são
repetíveis: "1→2→3→4" mentiria. **"O que falta" não é uma seção, é o estado** — a aba Painel
continua com o detalhe.

⚙️ Endpoint próprio (`GET /painel/ciclo/:id/resumo`), **de propósito mais barato que o painel**:
não faz a varredura de quem está fora de todas as aplicações (percorre 1.036 pessoas) nem a fila
por avaliador. O cabeçalho aparece em todas as abas — o que ele custa, custa quatro vezes. ⚠️ Mas
`semDesignacao` sai da **mesma régua** da tela de Designação: `noPublico - designados` seria mais
barato e daria número diferente, porque ignora quem o RH excluiu e quem a régua tirou.

Falhar no resumo **não derruba a tela**: sem ele, some a linha e o ciclo continua abrindo.

### 3.1.15. ✅ A faixa do RASCUNHO, "o que falta para abrir" e a confirmação (07/09)

As outras duas partes da §3.1.11 — e elas só funcionam juntas.

**A faixa**, na tela do ciclo, em toda aba enquanto for rascunho:

> 🔒 **RASCUNHO — é agora que se monta.** Criar aplicação e mudar peso só valem enquanto o ciclo
> é rascunho. **Abrir é definitivo: não há volta para rascunho.**
> **O QUE FALTA PARA ABRIR** — ⚠ *O ciclo não tem nenhuma aplicação.*
> *Questionários e critérios (com as faixas) são cadastrados pela T.I. — ainda não têm tela neste módulo.*

⭐⭐ **A lista do "o que falta" e a validação do abrir são A MESMA FUNÇÃO.** `assertCicloAbrivel`
passou a ser uma casca sobre **`problemasParaAbrir`**, e é essa que a tela lê — pelos MESMOS dados
(`carregarParaAbertura`), com o MESMO mapeamento (extraído para um método só). Se fossem duas
implementações, a tela diria "pode abrir" e a API recusaria: é a classe do dia, e aqui ela foi
evitada por construção, não por cuidado.

**Onde a faixa aparece, e por quê:** na **tela do ciclo**, não só na lista. Quem cria um ciclo
trabalha aqui dentro — aplicações, público, designação —, e aviso que só existe na lista é aviso
lido antes de fazer falta. Na **lista de Ciclos** fica a **confirmação**, que é onde o clique
acontece:

> **Abrir "Piloto 15/09/2026"** — Abrir **libera os avaliadores para responder** — e **não tem
> volta: não existe voltar para rascunho.**
> **A abertura FECHA:** criar aplicação e mudar o peso da avaliação ou dos critérios.
> **CONTINUA valendo:** montar público, designar e apurar; mudar o período — a **data-base**, não.
> `[ Cancelar ]` `[ Abrir o ciclo ]`

Antes, a única barreira era a frase cinza embaixo do botão — que se lê **depois** de clicar. É o
mesmo tratamento que o Apurar recebeu (§3.1.8), pela mesma razão.

⚙️ `GET /painel/ciclo/:id/resumo` passou a trazer `pendenciasParaAbrir` — **só em RASCUNHO**
(`null` nos outros estados: a porta já passou).

Verificado ao vivo em 07/09 num segundo ciclo descartável (criado, usado e **apagado**): a faixa
com a pendência real *"O ciclo não tem nenhuma aplicação"*, o próximo passo apontando para montar
a primeira, e a confirmação com os dois blocos. Sobraram os dois ciclos de sempre.

### 3.1.16. ✅ O botão de REABRIR e a tela sabendo do encerrado (07/09)

Duas dívidas que **eu mesmo criei** ao fazer a regra do §3.1.12 — e as duas são a classe que o
módulo passou o dia caçando:

1. **Rota sem botão.** `POST /ciclos/:id/reabrir` existia e não tinha caminho na tela: um ciclo
   encerrado só se reabria por `curl`. É exatamente a lacuna da §3.1.5 (o vínculo), repetida no
   mesmo dia por quem tinha acabado de registrá-la.
2. **Regra no backend, tela sem saber.** Em ciclo encerrado, designar / público / apurar
   continuavam com **aparência normal** e a pessoa só descobria no **erro, depois do clique** — o
   oposto do que se fez no Apurar e no Abrir.

⭐ **Desabilitado COM O MOTIVO, nunca escondido.** Esconder faria o ciclo encerrado parecer outra
tela e apagaria a informação de que a ação existe; desabilitado mantém a leitura e ensina a
saída. É o padrão que o "Encerrar ciclo" com avaliação pendente e a faixa do rascunho já usavam.
A frase é uma só (`lib/ciclo-encerrado.ts`) e **aponta para o botão de reabrir**, que agora
existe: *"Ciclo encerrado em 07/09/2026. Para voltar a mexer, reabra o ciclo na lista de Ciclos —
é ato do RH_ADMIN, exige motivo e fica registrado."*

**Onde cada coisa fica:**

| Peça | Lugar | Por quê |
|---|---|---|
| **Botão Reabrir** | lista de Ciclos, junto de Abrir/Encerrar | é onde o ciclo de vida do objeto já mora |
| **Faixa do encerrado** | dentro do ciclo, em toda aba | é onde a pessoa está quando esbarra na regra — e leva um **link** para a lista, não um segundo botão: duas portas para o mesmo ato viram duas confirmações para manter |
| **Botões desabilitados + `title`** | Designação, Aplicações, Painel | a leitura da tela continua inteira |

**A confirmação de reabrir** diz o que **volta a ser possível** (designar, público, apurar,
reabrir avaliação), pede o **motivo no próprio diálogo** — o botão fica desabilitado sem ele, em
vez de deixar o backend recusar depois — e avisa que **volta para ABERTO, nunca para rascunho**.

⭐ **A reabertura fica VISÍVEL depois**, na linha de estado, sempre: *"Reaberto 1× · última em
07/09/2026, 12:38 por Arielly Aparecida Jose Pereira — «…»"*.

> 🔒 **A CONTAGEM VEM DE `rh.auditoria`, NÃO da tabela do ciclo — e não simplifique isso.**
> `ciclo.reabertoEm/reabertoPorId/motivoReabertura` guardam **só a ÚLTIMA** reabertura: quem
> contar por ali sempre verá "1×". Quem faz "reaberto duas vezes" ser visível é a auditoria, que
> guarda todas (`entidade: 'Ciclo'`, `acao: 'REABRIR'`).
>
> Trocar a contagem por um campo da tabela parece uma simplificação óbvia — uma consulta a menos —
> e **apaga a informação sem nada acusar**: a tela continua funcionando, o número continua
> aparecendo, e passa a estar errado só nos casos que importam. Se um dia isso incomodar, o
> caminho é uma coluna `reaberturas` incrementada no serviço, **nunca** derivar do `reabertoEm`.

⚠️ **A linha de estado em ciclo ENCERRADO** mostra os números e **não mostra "Próximo"** — está
certo: não há passo seguinte, e reabrir é exceção, não caminho. Quem diz o estado é a faixa.

Verificado ao vivo num terceiro ciclo descartável (criado, usado e **apagado**): a faixa, os dois
botões desabilitados com o motivo no `title`, a confirmação recusando sem motivo e aceitando com
ele, o registro aparecendo na linha de estado com nome e frase, e o Apurar voltando a habilitar
depois da reabertura. Sobraram os dois ciclos de sempre.

### 3.1.17. ✅ Público vazio impede abrir · o seletor decorativo saiu do modal (08/09)

Dois achados do roteiro de tela de 08/09 — **a mesma falha em dois lugares**: a tela contava
gente que não entrava em lugar nenhum.

**🔴 B — o seletor de centros de custo do modal "Nova aplicação" era decorativo.** Contador ao
vivo dizendo *"3 pessoa(s) selecionada(s)"*, e a aplicação nascia com **público vazio**. E não
era descarte: a seleção **era gravada** em `aplicacao_centro_custo` — tabela que, desde a virada
para **público NOMINAL** (06/09), é só **registro do atalho** e não põe ninguém em lugar nenhum.
Contador que promete gente que não entra é pior que campo nenhum.

⚠️ **Saiu do modal, em vez de "passar a gravar"** — e a escolha tem razão: quem grava é o
**"Montar público"** do cartão, que tem **prévia, amostra de nomes e o aviso de quem já está em
outra aplicação do ciclo**. Criar aplicação e adicionar 87 pessoas num clique, sem nada disso,
recriaria aqui o defeito que a prévia acabou de resolver do outro lado (§3.1.10). No lugar, o
modal **diz o que vem depois**: *"A aplicação nasce sem público. Depois de criar, use Montar
público no cartão dela…"* ⚠️ E saiu junto um texto que a virada de 06/09 tinha deixado mentindo:
*"deixar vazio faz a lista de designação trazer todo mundo"* — hoje vazio é **ninguém**.

**🔴 C — a faixa dizia "Nada — a validação da abertura passa" com público vazio**, enquanto o
**"→ Próximo", duas linhas acima**, dizia *"sem público, o ciclo não alcança ninguém"*. Duas
frases contraditórias no mesmo bloco — **e a que autorizava era a de baixo**, porque a validação
real não olhava o público.

Agora **público vazio é bloqueio de abertura**, na mesma função que a tela lê (§3.1.15):

> *Aplicação "Sem público": nenhuma pessoa no público. Ela não geraria avaliação nenhuma — monte
> o público em Aplicações antes de abrir.*

⚠️ A checagem mora em **`problemasParaAbrir`, não em `validarAplicacao`** — esta roda também na
CRIAÇÃO da aplicação, onde o público é zero por construção. Público vazio é problema de **abrir**,
não de **criar**. Quatro specs novos, inclusive o que garante que a criação continua passando e o
que exige que **cada** aplicação vazia seja apontada, não só a primeira.

Verificado ao vivo (ciclo descartável, criado e apagado): a faixa listando a pendência real, o
`POST /ciclos/:id/abrir` recusando com a mesma frase, e o modal sem seletor nem contador.

### 3.1.18. 🔴 O BECO: "Excluir" não cancelava nada, e o ciclo travava para sempre (08/09)

O roteiro de tela de 08/09 achou uma trava que **nenhuma das três peças fecha sozinha**. Por
isso as três saíram no mesmo commit — separadas, cada uma deixa um beco.

#### O que existia, medido antes de mexer

| Peça | O que fazia de fato |
|---|---|
| **"Excluir"** na Designação | escrevia **uma linha** em `ciclo_elegibilidade` e mais nada. Não tocava `avaliacao`, não tocava `aplicacao_publico` |
| A avaliação da pessoa excluída | continuava `PENDENTE` na fila do avaliador (`minhasAvaliacoes` filtrava por `avaliadorId`, e **só**) e continuava contando no `encerrar` |
| **"Tirar do público"** | recusava com *"Cancele a avaliação antes"* — **ato que não existia em lugar nenhum do módulo** |
| **`CANCELADA`** | estava no enum, era **lida em 3 lugares** (`assertPodeEditar`, a contagem do painel, a exclusão da fila do painel) e **escrita em zero**. Terceiro estado morto depois de `EM_APURACAO`/`CANCELADO` — com a diferença de que **este era peça que faltava**, não lixo: o tratamento já estava escrito |
| **`encerrar`** | exigia 100% enviado, sem override |

⚠️ **E havia algo pior que "esconder a pessoa".** Na linha do RH, a etiqueta *"Avalia: Fulano"*
só aparecia se `linha.elegivel`. Depois do Excluir, **a existência da avaliação sumia da tela**
— o RH deixava de ver que ela existia, exatamente enquanto o avaliador continuava com ela na
mão. Excluir não escondia a pessoa (a lista **marca, nunca filtra**, e a linha ficava lá);
escondia **a avaliação**, de quem precisava decidir.

**O tamanho real, medido em 08/09 e dito sem inflar:** os dois ciclos recusam `encerrar` hoje
(Piloto 889+2, Geral 5+0) — mas **por ora só porque ninguém respondeu ainda**, que é legítimo.
Não havia nenhum caso de EXCLUIR com avaliação viva (`ciclo_elegibilidade` estava **vazia**) nem
nenhum demitido com avaliação viva. O que torna a trava **certa e não hipotética** é outra
coisa, e é maior que este conserto — ver o item 17 da lista (B): **a sincronização não escreve
em `prisma.avaliacao`**, então a demissão não toca a avaliação já criada.

#### O que passou a existir

**1 — `EXCLUIR` cancela a avaliação.** `decidir` continua registrando a decisão e agora,
**dentro da mesma transação**, cancela a avaliação viva: `CANCELADA`, com `canceladaEm`,
`canceladaPorId` e `motivoCancelamento` — que **carrega a justificativa da exclusão**, porque são
o mesmo ato e duas frases para ele só criariam dúvida meses depois. Auditoria própria
(`Avaliacao/CANCELAR`), além da da decisão.

⚠️ **`ENVIADA` não se cancela: recusa e ensina a ordem.** Ela já tem nota e pode ter
`ResultadoAvaliacao` — cancelá-la deixaria resultado órfão de avaliação viva, que é uma segunda
verdade sobre a mesma pessoa. A recusa manda **reabrir a avaliação primeiro**, no mesmo desenho
do `assertCicloAceitaReaberturaDeAvaliacao`.

⭐ **Nenhuma resposta é apagada.** Cancelar tira a avaliação da **conta** (fila e encerramento),
não do banco. Quem gastou meia hora respondendo doze perguntas não perde o rastro porque o RH
mudou de ideia. *(Proposta nossa — confirmação pendente da gestora, na lista (A). Se ela
preferir que o sistema recuse e obrigue o envio, a mudança é pequena; esperar travaria o resto.)*

**2 — A confirmação diz o efeito REAL, com o número.** O diálogo do Excluir dizia
*"Excluir a tira deste ciclo"* enquanto no dado a avaliação seguia viva. Agora:

> *Isto cancela a avaliação que está com **ADAO BATISTA**. As **12** resposta(s) já dadas ficam
> registradas e não entram na apuração — nada é apagado. Ela sai da fila dele e deixa de travar
> o encerramento do ciclo.*

⚠️ **A frase vem do BACKEND** (`efeitoDoExcluir`, devolvida por linha na lista de designação) —
é a **mesma função** que o serviço usa para decidir. Frase montada na tela envelheceria separada
da regra, que é exatamente o que aconteceu com o texto do modal de aplicação (§3.1.17). Quando o
efeito é `RECUSAR`, o botão fica **desabilitado com o motivo**, em vez de deixar descobrir no erro.

**3 — A etiqueta "Avalia" deixou de depender de `elegivel`.** Excluído, o RH continua vendo
quem estava com a avaliação — agora como *"Era de: FULANO"* + `cancelada`. Marcar, nunca filtrar,
que é a regra que o próprio módulo já segue em quatro listas.

**4 — "Tirar do público" aponta um caminho que EXISTE.** A recusa deixou de mandar fazer um ato
inexistente e passou a dizer onde se faz: *"use Designação → Excluir: lá a exclusão cancela a
avaliação, com motivo registrado"*. ⚠️ **De propósito não cancela dali**: tirar do público e
cancelar avaliação são atos diferentes, e juntá-los num clique repetiria o defeito do seletor de
CC que saiu do modal no mesmo dia — um ato com efeito que a tela não mostra. E `CANCELADA`
deixou de segurar o público: ela já saiu de toda conta.

**5 — `encerrar` com pendência confirmada.** Precedente idêntico do **RDV na Logística**, que já
roda em produção: *a API recusa e diz quantas; só encerra com `confirmarPendentes`, e as
PLANEJADAS viram PULADA com o motivo escrito*. Aqui as pendentes viram `CANCELADA` com o motivo.

- a recusa agora **diz a saída**, não só o número: recusa sem alternativa manda a pessoa
  procurar sozinha um caminho — e o que ela acha é **criar outro ciclo**, que duplica resultado
  sem ninguém decidir;
- **motivo obrigatório**, gravado no ciclo, na auditoria **e em cada avaliação cancelada** — é o
  que responde, meses depois, por que aquela pessoa ficou sem nota;
- a auditoria distingue: `ENCERRAR_COM_PENDENCIA` ≠ `ENCERRAR`. "Encerrar" e "encerrar
  cancelando 891 avaliações" não podem ter o mesmo nome;
- o custo fica **à vista de quem usa**: o diálogo mostra o número exato antes do clique, e o
  painel já contava `canceladas` por aplicação;
- ⚠️ **RH_ADMIN só**, o mesmo degrau do reabrir *(confirmação pendente na lista (A))*;
- ⚠️ O botão de encerrar **deixou de ser desabilitado** por pendência. Ficar cinza sem saída
  **era** o beco: agora ele abre a conversa.

#### O furo dentro do furo

`filaPorAvaliador` (painel do RH) já excluía `CANCELADA` desde sempre; **`minhasAvaliacoes` não
filtrava status nenhum**. Sem corrigir os dois lados, o cancelamento daria ao RH uma fila limpa
enquanto o avaliador continuaria com a linha — o mesmo beco em outra fantasia. É
`not: CANCELADA` de propósito, e não uma lista de status vivos: **`ENVIADA` continua aparecendo**
(é o histórico do que a pessoa já fez no ciclo); o que a fila não pode mostrar é o que foi tirado
da conta.

#### Verificação

Migration `20260908090000_avaliacao_cancelada_com_motivo` (3 colunas aditivas, com o desfazer
escrito dentro), aplicada com `GUARDA: ok`. **460 testes, 33 suítes** — 30 novos, entre eles: a
recusa da ENVIADA e a ordem que ela ensina; o motivo carregado para dentro de cada avaliação; a
auditoria distinta do override; que nenhuma resposta é apagada; e que a fila do avaliador exclui
canceladas **sem** virar lista de status vivos. 🔴 **Falta a rodada AO VIVO** — o token de
`ariellypereira` expirou (access e refresh) e não há outra conta com `RH_ADMIN` no DEV.

### 3.12. "Sem avaliador" tem DOIS universos, e eles não se contêm

O cadastro (`/avaliadores`) e o painel de cada ciclo contavam ambos "sem avaliador" e nenhum
dizia de quê. Medido em 06/09: **108** no cadastro, **95** no Piloto, **84** no Geral.

⚠️ **E os 95 não são um subconjunto limpo dos 108.** Hoje o recorte é 95 nos dois e 13 só no
cadastro — mas o inverso é possível a qualquer momento (alguém no público do ciclo, sem
designação nele, e *com* avaliador no cadastro). Fechar os 95 **não derruba 95 dos 108**.

Só nomear os números faria alguém supor a subtração. Então o painel **mostra a conta**:

- `95 pessoa(s) sem avaliador neste ciclo` — elegíveis do público deste ciclo que ninguém
  designou;
- **quantas já têm avaliador no cadastro** → resolvem-se com *Designar pelo cadastro*;
- **quantas não têm nem no cadastro** → precisam ser resolvidas antes, em *Avaliadores*;
- e uma linha dizendo que os universos não se contêm.

E `/avaliadores` passa a dizer `sem avaliador no cadastro`, com "elegíveis de TODA a empresa".

**Os três números, lidos ao vivo em 06/09 (noite) — cada um responde uma pergunta diferente:**

| Nº | O que é | Rota | Onde aparece |
|---|---|---|---|
| **108** | elegíveis de **TODA a empresa** (1.036) que **não têm avaliador no CADASTRO** — 928 têm. Não depende de ciclo nenhum | `/designacao-padrao/pendencias` → `semAvaliador.total` | tela **Avaliadores**, em 26 grupos filial × CC, **com os nomes** |
| **95** | pessoas do **público do ciclo Piloto** que ninguém designou **naquele ciclo** (894 designadas) | painel do Piloto → `semDesignacao` | aba **Painel** do Piloto |
| **84** | a mesma conta, no **outro ciclo aberto** (Avaliação Geral 2026, público antigo de 93, 9 designadas) | painel do Geral → `semDesignacao` | aba **Painel** do Geral |

Eles não se conciliam porque **os universos são três**: a empresa inteira, o público de um
ciclo e o público do outro. Hoje 95 + 13 = 108 por coincidência do dado, e o painel diz isso
sem deixar ninguém supor a subtração: `semDesignacaoPorOrigem` do Piloto é
`{jaTemNoCadastro: 0, nemNoCadastro: 95}` — **os 95 também não têm no cadastro** —, enquanto o
do Geral é `{jaTemNoCadastro: 84, nemNoCadastro: 0}`, isto é, **os 84 se resolvem com um clique
em "Designar pelo cadastro"** e os 95 não: exigem antes a lista do RH.

⚠️ **Nenhuma tela mostra os três juntos, e nenhuma deveria:** o 108 mora no cadastro (que não
tem ciclo) e os outros dois no painel, que mostra um ciclo por vez. Quem os viu lado a lado foi
quem abriu três telas — e é aí, fora do sistema, que a subtração parece existir.

⚠️ **Achado de tabela:** `foraDeTodasAsAplicacoes` existia no backend desde 06/09 e **não era
renderizado** — o contrato do cliente não tinha o campo, então a contagem chegava e era
descartada em silêncio. É a falha mais barata de cometer num módulo sem geração de client: o
backend acerta, o `tsc` não reclama de campo a mais, e o número simplesmente não existe para
quem olha. Agora aparece, em vermelho, com os primeiros nomes.

### 3.2. Avaliar ≠ apurar

`Avaliacao.notaAvaliacao` sai no **envio** e é só do questionário. `ResultadoAvaliacao`
combina com os critérios cadastrais na **apuração**. Mudar peso vira **reapuração**, sem
reabrir avaliação nenhuma.

⚠️ A reapuração aceita escopo **CICLO ou APLICAÇÃO — nunca colaborador**
(`assertEscopoReapuracaoValido`). Recorte por pessoa seria o caminho legítimo para alguém
isolar a própria linha e contornar a separação de funções.

O avaliador **não vê** os critérios cadastrais enquanto responde: saber "Tempo de Empresa:
75 pontos" ancora o julgamento.

### 3.3. Os dois ADRs

- **ADR-RH-01** — as tabelas de pessoas moram em `rh`, não em `core`. Vale sob três
  condições, e a terceira é um **gatilho de revisão**: quando um segundo módulo precisar de
  colaborador, o ADR reabre. Hoje nenhum outro módulo consulta `rh.colaborador` direto.
- **ADR-RH-02** — a **nota por grupo é calculada na leitura, nunca materializada**. Grupo
  não entra em conta nenhuma; gravar criaria uma segunda verdade para manter em sincronia.

### 3.4. Uma definição de "ativo"

`src/common/elegibilidade.ts`: `RA_DEMISSA = ' '` **e** `RA_SITFOLH <> 'D'` — o que
**inclui férias (98) e afastados (47)**. Usar `situacao = 'ATIVO'` derrubaria 145 das 1.036
pessoas de todas as listas, calado. Afastado entra ou não no ciclo por opção do ciclo
(`incluirAfastados`), medida na data-base; férias entra sempre.

### 3.5. O peso está na PERGUNTA

O **modelo é só o questionário**. Grupo é organização visual e **não tem peso**. Os
critérios cadastrais saíram do modelo e viraram `AplicacaoCriterio` (critério + peso, por
perfil), com `Aplicacao.pesoAvaliacao` dizendo quanto o questionário vale.

`pesoAvaliacao > 0` é obrigatório — com ele, o caso "todos os critérios sem dado → nota
final = nota da avaliação" cai da fórmula, sem caso especial.

### 3.6. Outras, em uma linha cada

- **Um avaliador por avaliado** (`@@unique([cicloId, avaliadoId])`); autoavaliação não
  existe (as marcas `A2`/`F1` em comentários de código são desta decisão).
- **Toda pergunta é obrigatória**; não existe "não se aplica". O envio recusa incompleto
  **dizendo quantas faltam**, para a tela poder perguntar.
- **Faixas de conceito contíguas** (0-25-50-75-90-100), inferior inclusivo e superior
  exclusivo, a última incluindo 100. A validação checa **continuidade**, não cobertura ponto
  a ponto — some o buraco do 24,5 em qualquer precisão decimal.
- **Não existe faixa "else 0"** (marca `C9` no código): pontuar zero puniria a pessoa por
  uma falta de cadastro. Sem dado, o critério sai da conta e o peso é **renormalizado** —
  e o resultado registra `houveRenormalizacao`.
- **Tempo na função vem da TROCA de `R7_FUNCAO`**, nunca da última linha do SR7010: o
  dissídio de 1º de novembro grava a folha inteira. `src/sincronizacao/data-ultima-funcao.ts`
  é a peça mais frágil do módulo — mexer nela sem ler os testes é pedir regressão.
- **Critério calculado exige resolver registrado**, validado em **três momentos** (ao salvar
  no catálogo, ao montar a aplicação, na abertura do ciclo — mesma função, três chamadas).
  Sem isso o critério devolve vazio, em silêncio, para o ciclo inteiro.
- **Aplicação sem nenhum critério é válida** — é o caso dos aprendizes, no piso de
  escolaridade, tempo de casa e cursos por definição.
- **Escolaridade: os rótulos foram separados da pontuação, e a pontuação NÃO mudou.** A
  decisão sobre a régua é do RH e está pendente — ver `DECISAO_RH_ESCOLARIDADE.md`.
- **O sync é somente leitura, sem exceção.** O DEV aponta para o Protheus de **produção**.
- **`valeParaMerito` nasce `false`.** O piloto valida o sistema, não decide carreira.

---

### 3.7. O que se persiste é uma LISTA NOMINAL

A estrutura de **gestão** não coincide com a **contábil**, e por isso o recorte por centro
de custo não bastava. Medido no cadastro real em 06/09:

| Grupo | Pessoas | Pares filial × CC |
|---|---|---|
| Limpeza | 46 | 19 (o CC "LIMPEZA" tem 14 delas) |
| Transporte | 46 | 18 |
| Segurança | 28 | 9 |
| Manutenção | 16 | 5 |
| **Aprendizes** | **31** | **15**, todos compartilhados com gente efetiva |

Então **duas listas nominais**, e são duas tabelas porque têm tempos de vida diferentes:

- **`rh.designacao_padrao`** — quem avalia quem. Da **plataforma**, perene, é o que cada
  ciclo copia. Índice único **parcial** em `avaliado_id WHERE vigencia_fim IS NULL`: é o
  `@@unique([cicloId, avaliadoId])` da `Avaliacao` uma etapa antes, recusando o conflito no
  cadastro, que fala com quem errou. `vigencia_fim IS NULL` é a **única** definição de
  vigente — não há coluna `ativo`.
- **`rh.aplicacao_publico`** — qual questionário a pessoa responde. Do **ciclo**, morre com
  ele. **Não cabe dentro da `Avaliacao`**: lá o `avaliadorId` é obrigatório, e "está no
  público e ainda sem avaliador" — o `semDesignacao` do painel — não teria onde existir. O
  `ciclo_id` é denormalizado com **FK composta** contra `@@unique([id, cicloId])` da
  Aplicação: divergir é impossível pelo banco, não por disciplina.

**Centro de custo e filial viram atalhos de PREENCHIMENTO** na tela — escolhe, traz as
pessoas, ajusta, salva — e sobrevivem apenas como `origem` + `origemReferencia`. Os dois
atalhos existem: o do público em "Montar público" na tela de Aplicações, e o dos avaliadores
na importação da planilha. ⚠️ A prévia do público vem antes de salvar porque
`@@unique([cicloId, colaboradorId])` recusa quem já está em outra aplicação do ciclo —
sem ela, um recorte que se sobrepõe falharia no INSERT sem dizer de quem se trata. **Não há
precedência entre níveis porque só existe um nível**; "parte da equipe" se resolve
removendo linhas. `DIVISAO_AUTOMATICA` marca a linha que a importação **arbitrou** (um CC
repartido entre N responsáveis em ordem alfabética): ninguém decidiu aquela linha, e
confirmá-la a torna `MANUAL`.

`aplicacao_centro_custo` **não foi apagada**: deixou de decidir o público e ficou como
registro do atalho usado.

### 3.8. Trocar a aplicação de quem já respondeu é recusado

`Resposta` aponta para as perguntas de um modelo; `Avaliacao.aplicacaoId` decide de qual
`ModeloVersao` elas são lidas. Trocar a aplicação deixava as respostas órfãs e fazia a
apuração combinar a `notaAvaliacao` **congelada do questionário antigo** com o
`pesoAvaliacao` e os critérios da aplicação nova — número diferente, sem exceção, sem
alerta e internamente coerente.

`assertPodeTrocarDeAplicacao` impõe uma regra só, **nada de valor se perde numa troca**:
ENVIADA recusa sempre; com N respostas recusa **dizendo N**; sem nada gravado passa, com a
troca na auditoria como `DESIGNAR_TROCA_APLICACAO`. Trocar só o **avaliador**, na mesma
aplicação, não passa pela guarda.

### 3.9. As quatro regras da importação da planilha

82 linhas viram ~1.000 pares. Disso decorre tudo o que segue, e nada aqui é polimento.

1. **A pendência reversa é a tela**, não a segunda aba: quem abre o cadastro vê **quem não
   está na lista de ninguém**, agrupado por filial × centro de custo, maior primeiro. É a
   única pendência que some sozinha — sem avaliador não há `Avaliacao`, não há status e não
   há contagem. A lista por avaliador é a segunda visão.
2. **Pré-visualização obrigatória.** A prévia devolve pares a gravar, já iguais,
   substituições, divisão automática, conflitos com nome e as duas pontas, e recusas linha a
   linha. Gravar exige devolver a **`conferencia`** (SHA-256) que a prévia deu: arquivo
   trocado entre o "veja" e o "pode gravar" é recusado. O hash normaliza CRLF — senão salvar
   no Excel do Windows daria "o arquivo mudou" sem nada ter mudado.
3. **Idempotente e reversível.** Par igual não vira linha nova, e a linha existente fica
   **intacta mesmo que a origem mude** — reescrever uma já revisada como
   `DIVISAO_AUTOMATICA` apagaria em silêncio o trabalho de quem conferiu. Ajuste `MANUAL`
   nunca é sobrescrito sem `substituirAjustesManuais`. Desfazer **encerra a vigência do lote
   inteiro** (`rh.importacao_designacao`) e diz quantas linhas já tinham sido revisadas à
   mão, porque é o trabalho que se perde.
4. **`DIVISAO_AUTOMATICA` É "ninguém olhou ainda"** — sem coluna extra. Confirmar a linha a
   torna `MANUAL`, que é a verdade: agora uma pessoa decidiu. `origemReferencia` continua
   guardando o centro de custo, então nada se perde.

⚠️ Linha com o avaliador **em branco não é erro** — é "ainda não decidi", e sai contada à
parte. O modelo que a gestora recebe tem os 74 centros de custo com a coluna vazia; tratar
como recusa encheria a tela de vermelho e esconderia os erros de verdade.

⚠️ **O menu mudou junto.** Ele exigia ser do RH **e** avaliador, o que bastava enquanto o RH
tinha uma tela só. A gestora, que não avalia ninguém, ficaria com a tela pronta, a rota
funcionando e nenhum caminho até ela — não há deep link aqui. Agora o menu se monta do que a
pessoa pode abrir e aparece com mais de um destino.

### 3.10. Dois ciclos abertos ao mesmo tempo é PREVISTO — e a fila soma os dois

A spec §9 manda abrir a produção **por ondas de unidade**, então mais de um ciclo `ABERTO`
não é acidente. A consequência aparece na tela do avaliador: **a fila não é de um ciclo só**.
No DEV foram 22 na fila com 14 num ciclo e 8 no outro — misturados e sem rótulo, o total não
bate com ciclo nenhum e a pessoa não tem como saber até quando responder cada um. Por isso a
lista é agrupada por ciclo, com **nome e prazo** no cabeçalho do bloco
(`MinhasAvaliacoesPage`), e `minhasAvaliacoes` devolve `ciclo {id, nome, prazo, status}`.

⚠️ **O endpoint sempre soube filtrar** (`?cicloId`); quem não passava filtro era a tela. O
defeito não era filtro faltando — era falta de rótulo, e esconder um dos ciclos teria
consertado o sintoma errado.

⭐ **E o rótulo tem de estar no CARTÃO e dentro da avaliação aberta, não só no cabeçalho do
bloco.** O roteiro de tela de 06/09 mostrou o pior caso: os dois cartões da mesma pessoa são
visualmente idênticos — mesmo nome, cargo, matrícula, "14 perguntas", mesma cor — e o único
distintivo era uma pílula de 12px no topo do bloco, que sai de vista depois de 14 cartões. E
a avaliação aberta não tinha **nenhuma** ocorrência de ciclo ou prazo: o avaliador respondia
as 14 perguntas sem nunca saber qual das duas tinha aberto. Cabeçalho *sticky* ajuda quem
rola e **não substitui** o rótulo onde a pessoa toca.

#### ⚠️ Pergunta aberta: a mesma pessoa em dois ciclos abertos

`@@unique([cicloId, avaliadoId])` impede duplicata **dentro** de um ciclo, não **entre**
ciclos. Nada hoje impede que dois ciclos com períodos **sobrepostos** incluam a mesma
pessoa — e ela sai com **duas notas finais** sobre o mesmo período, sem erro nenhum.

No DEV são **9 pessoas**, todas do Supermercado Unaí, e **já não é hipótese**: duas delas
(Alexandre Rodrigues e Aneuso Brandão) já têm avaliação enviada em um dos ciclos.

⚠️ **Wanderson (002749) é uma das 9 — e é o avaliador do teste.** Isso liga esta pergunta à
pendência da §5 sobre **quem avalia os avaliadores**: quem avalia alguém e é avaliado em dois
ciclos ao mesmo tempo acumula as duas ambiguidades na mesma pessoa.

**Proposta registrada, não implementada: AVISO na abertura do ciclo, nunca bloqueio.** A §9
prevê ondas simultâneas, e ondas por unidade normalmente não se sobrepõem em pessoas — barrar
quebraria o caso legítimo. O aviso listaria quem já está em outro ciclo aberto de período
sobreposto, e o RH decide.

### 3.11. ⚠️ A ORDEM DA FILA DO AVALIADOR não foi decidida por ninguém

`minhasAvaliacoes` ordena por **`Avaliacao.criadoEm asc`** — a ordem em que as designações
foram criadas. E a cópia do cadastro percorre as aplicações por **`Aplicacao.ordem`**, que é
um campo de organização de tela do RH. Resultado medido no DEV: as designações da aplicação
"Aprendizes" nasceram **2 segundos antes** das de "Operação de Loja", e por isso as duas
aprendizes aparecem fixadas antes de todo mundo na fila do Wanderson.

**Ninguém decidiu isso.** Um campo que existe para o RH ordenar cartões numa tela de
configuração está afirmando, para quem avalia, *"avalie os aprendizes antes dos
supervisores"*. Na fila de 95 da gerente do Supermercado Unaí, essa camada acidental decide a
ordem em que 95 pessoas são avaliadas.

#### 🔴 FATO DE HOJE: a ordem da fila NÃO é reproduzível

Não é risco futuro nem depende de alguém mexer em nada. **Já é assim, agora, no DEV e em
qualquer ambiente:**

- A fila ordena por `Avaliacao.criadoEm` — **quando a linha foi criada**, e isso nunca mais
  muda.
- Quem é designado num lote posterior entra no **fim da fila**, seja qual for a aplicação.
  Uma pessoa acrescentada à aplicação dos Aprendizes depois aparece **atrás** de todos os de
  Operação de Loja.
- **Reexecutar a cópia do cadastro não normaliza nada:** o `upsert` dá UPDATE em quem já
  existe e o `criadoEm` fica. Conferido no DEV — "Operação de Loja" tem linhas de `13:22:12`
  e de `15:52:23` convivendo, de duas execuções diferentes.

Consequência: **dois avaliadores do mesmo ciclo podem ter ordens diferentes pelo mesmo
motivo, e não há como pôr a fila numa ordem conhecida.** Nem apagando e refazendo — só
recriando as avaliações do zero, o que apaga respostas.

#### ⚠️ E o acoplamento com `Aplicacao.ordem` é LATENTE

A frase natural — *"a Arielly reordena as aplicações e a fila de todo mundo se reorganiza"* —
**não é verdade hoje**, e foi medida antes de ser escrita: `criadoEm` não muda em reexecução
(acima), e **ninguém consegue reordenar**, porque `Aplicacao.ordem` é gravado na criação e
**não há `PATCH` de aplicação** (§2). O acoplamento existe e está adormecido.

⚠️ **Para quem for construir a edição de aplicação** (já listada como lacuna): mexer em
`ordem` mudará silenciosamente a ordem de trabalho de todo avaliador designado dali em
diante, e ninguém vai relacionar as duas coisas. Se a edição vier antes da resposta do RH
abaixo, ela precisa no mínimo avisar isso na tela.

#### Pergunta aberta para o RH

**A ordem da fila do avaliador é indiferente, ou há prioridade?** Por cargo, por prazo, por
unidade? ⚠️ **Enquanto não houver resposta, não se inventa critério** — qualquer ordenação
escolhida por nós vira uma afirmação sobre prioridade que ninguém fez.

#### O que já foi feito, e é só UX

**"Em andamento (N)" virou seção própria**, acima de "A responder", como "Enviadas" já era.
Antes o que estava começado subia para o topo de "A responder" por ordenação implícita — e a
lista **se reorganizava sob o dedo** a cada avaliação iniciada. A seção entrega o "continue
de onde parou" sem mexer no lugar de ninguém. **Dentro de "A responder" nada mudou.**

#### O que resolve fila grande e NÃO é ordenação

Com 95 cartões nenhuma ordem resolve — a pessoa está procurando **alguém específico**.

✅ **Busca por nome e matrícula** (06/09): local, sem ir ao servidor (a fila já está em
memória, e ir à rede a cada tecla quebraria a busca justamente no corredor da loja, com
sinal ruim), sem acento e sem caixa, e **filtrando antes do agrupamento** — buscar "ana"
devolve a Ana de "Em andamento" **e** a de "A responder", cada uma na sua seção. Lista
achatada esconderia que uma delas já estava começada, que é o que a pessoa precisa saber
antes de abrir. Mostra "6 de 22 avaliações" e, sem resultado, "Nenhum resultado — sua fila
tem 22": sem esse número, a tela filtrada e a fila vazia são visualmente a mesma coisa.

⏸️ **Filtro por aplicação: NÃO feito, de propósito.** "Aplicação" é vocabulário do RH — quem
avalia pensa em cargo, setor, tipo de gente. Filtrar por um conceito que só existe na tela de
configuração é a mesma família do defeito desta seção: estrutura interna vazando para quem
executa. Se o filtro fizer falta, o rótulo certo provavelmente é outro, e ele não se descobre
numa fila de 22 — a de 95 não existe em lugar nenhum para desenhar contra.

## 4. As duas exceções estruturais

São **duas**, e a contagem importa: uma terceira significa que o desenho precisa de
revisão, não que a lista precisa de mais uma linha.

**1. Reapuração em massa.** `ApuracaoService` toca `prisma.avaliacao` sem passar pela porta
de acesso. Existe porque apurar é operação de **lote sobre o ciclo**, não acesso a registro
individual — e o risco que isso abriria (alguém isolar a própria linha) está fechado pelo
`assertEscopoReapuracaoValido`, que só aceita CICLO ou APLICAÇÃO.

**2. `@DispensaVinculoDeColaborador` na sincronização.** Todo acesso ao módulo exige que o
usuário seja um colaborador. Mas **o sync é quem cria os colaboradores** — na primeira
carga não existe nenhum, e exigir vínculo impediria o módulo de sair do zero. A dispensa é
um decorator que **exige um motivo escrito**, e um teste de invariante garante que nenhuma
rota que toca avaliação a use.

⚠️ **O vão da §3.1.4 não é uma terceira exceção** — é o ALCANCE da regra: aqueles atos não
tocam `prisma.avaliacao` porque acontecem antes de a avaliação existir. Não some com esta
contagem.

> Consultas **agregadas** (`count`, `groupBy`) não são exceção: não leem o conteúdo de
> ninguém, e a separação de funções não tem o que proteger num total. `ciclo.service` e
> `painel.service` estão dispensados por essa frase — que é também por que o painel usa
> `groupBy` e não `findMany` para saber quem ainda não foi designado.

---

## 5. Pendências do RH

Nenhuma tem resposta ainda. Todas foram levantadas entre 05 e 06/09.

| Pendência | Quem responde |
|---|---|
| Régua de escolaridade — a atual dá nota mínima a quase todo mundo; três alternativas medidas em `DECISAO_RH_ESCOLARIDADE.md` | Gestora de RH |
| Aprendizes (31 pessoas) entram no ciclo com aplicação própria, sem critérios cadastrais — confirmar | Gestora de RH |
| Afastados (47) entram no ciclo? É opção por ciclo, medida na data-base | Gestora de RH |
| Quem avalia Presidente e Vice | Diretoria |
| 🔴 **O avaliador é avisado de que o RH lê a observação dele?** — **decisão da gestora, não nossa.** `observacaoAvaliador` é texto livre sobre a pessoa avaliada e aparece **inteiro** no modal de Resultados para qualquer `RH_ADMIN`; **nenhuma tela avisa quem escreve**. Verificado ao vivo em 06/09: a observação escrita no envio foi lida no modal pela conta da gestora. **São dois caminhos e ela escolhe um: (A)** o rótulo do campo passa a dizer, na tela de quem escreve, que o texto **será lido pelo RH** — o campo continua o que é e quem escreve sabe; **(B)** muda o entendimento do que o campo colhe (devolutiva ao avaliado, ou observação que o RH não lê) e a tela de Resultados deixa de exibi-lo. **Não pode chegar ambíguo à produção:** o primeiro ciclo real já colhe texto sob o entendimento errado, e texto colhido não se recolhe. ⚠️ O **rastro** desse acesso está RESOLVIDO (§3.1.1); isto aqui é **consentimento**, e continua EM ABERTO — auditoria diz quem leu, não autoriza a leitura. Ver §3.1.1 | Gestora de RH (Arielly) |
| 🔴 **O `RH_ADMIN` pode agir sobre a PRÓPRIA linha?** — **uma pergunta só, quatro exemplos.** Quem monta o ciclo é também avaliada, e quatro atos alcançam a linha dela: **(1)** "Tirar" do público — decide se ela é avaliada neste ciclo; **(2)** "Tirar" na lista de um avaliador — encerra quem a avalia; **(3)** "Conferi, está certo" — confirma a lista que a inclui; **(4)** **Incluir/Excluir** na Designação — sobrepõe a régua. ⭐ **O eixo que pode dividir a resposta é incluir × excluir:** incluir-se é pedir para ser avaliada (gera trabalho para outro e entra nas contagens); **excluir-se sai da avaliação e apaga o sintoma** — a pessoa some da conta e do alerta do painel. Se a resposta vier por esse eixo, ela serve para os quatro atos, porque em todos o que pesa é o lado do "sair". ⚠️ Não decida elo a elo: a cadeia é sequencial e **o último elo aberto basta**. Desde 06/09 a linha aparece **marcada** em (1), (2) e (4) — a tela diz *"esta é você"* ao lado de um botão que ela pode clicar, e **marcar sem decidir isto é pior que antes**. Os atos são auditados (`PUBLICO_REMOVER`, `ENCERRAR`, `REVISAR`, `DECIDIR_INCLUIR`/`DECIDIR_EXCLUIR`), mas **rastro diz quem fez, não decide se podia**. ⚠️ Não é o caso da escrita de terceiro (§3.1.2), corrigida sem perguntar: ali não havia pergunta; aqui há, porque montar o ciclo é o trabalho dela. Ver §3.1.4 | Gestora de RH (Arielly) |
| 🔴 **O que se espera do campo `observacao` da linha de quem avalia quem?** Desde 07/09 ele aparece na tela, embaixo do nome, logo acima do botão "Conferi, está certo" — e no DEV ficou claro o risco: o texto do povoamento se repete **idêntico em todas as linhas** ("DADO PROVISÓRIO DO DEV — eleito por cargo…"), e texto repetido volta a não ser lido, agora ocupando espaço. **Em produção o texto será o que o RH escrever**, e as duas leituras são defensáveis: **(a) justificativa POR LINHA** — por que *esta pessoa* é *deste* avaliador; a tela mostra em todas, e o RH escreve quando a escolha não é óbvia; ou **(b) marca de LOTE** — de onde veio a linha (planilha X, divisão automática, ajuste manual); aí o certo é mostrar uma vez por bloco, não repetida em cada linha. **A resposta muda o desenho da tela**, não só o texto. Ver §3.1.9 | Gestora de RH (Arielly) |
| 🔴 **O VOCABULÁRIO das telas é o que o RH fala?** — pergunta dela, não nossa. As palavras do módulo saíram de quem o construiu, e trocá-las por outras palavras nossas não resolve: quem sabe o que se fala no RH da Capul é a gestora. A lista, com o que cada uma significa aqui: **Ciclo** (o período, com data-base e régua de conceitos) · **Aplicação** (um questionário casado com um público) · **Público** (a lista nominal de quem responde àquele questionário) · **Recorte** (o atalho — centro de custo, filial — usado para trazer gente para o público; o que fica gravado é a lista de pessoas) · **Designar/Designação** (dizer quem avalia quem DENTRO do ciclo; é o que gera a avaliação) · **Quem avalia quem** (a lista permanente, fora do ciclo, que o ciclo copia) · **Apurar/Apuração** (combinar a nota do questionário com os critérios e gravar o resultado) · **Critério** (o item cadastral que entra na nota: escolaridade, tempo de casa, tempo na função) · **Faixa** (converte o valor do critério em pontos) · **Conceito** (converte a nota final em palavra: "Atende") · **Modelo/versão** (o questionário e a versão publicada dele). ⚠️ **E três palavras que soam iguais e são coisas DIFERENTES**, hoje na mesma tela: **"provisória"** (a linha de quem avalia quem foi chutada pela T.I. e o RH ainda não confirmou) · **"não revisada"** (a linha que a divisão alfabética arbitrou entre dois responsáveis do mesmo centro de custo) · **"recorte provisório"** (o público foi montado por atalho e não é decisão do RH). Se as três continuarem parecendo a mesma coisa, a etiqueta deixa de significar qualquer coisa | Gestora de RH (Arielly) |
| 🔴 **A ordem da fila do avaliador** — é indiferente, ou há prioridade (cargo, prazo, unidade)? Hoje é acidental: vem de `Aplicacao.ordem`, um campo de tela do RH, e numa fila de 95 decide a ordem em que 95 pessoas são avaliadas. Ver §3.11 | Gestora de RH |
| 🔴 **A mesma pessoa em dois ciclos abertos** — 9 no DEV, com períodos sobrepostos, duas notas cada. Ondas de unidade (§9) são legítimas; sobreposição de PESSOAS talvez não. Ver §3.10 | Gestora de RH |
| 🔴 **Quem avalia os ~52 AVALIADORES** — hoje 46 deles caem no Diretor Executivo pela regra provisória de hierarquia. ⚠️ A planilha de avaliadores **não tem como responder isto**: ela diz "quem responde pelo centro de custo X", e o responsável está DENTRO do CC que lidera — ele fica de fora da própria lista, porque autoavaliação não existe. É pergunta separada, e é de estrutura | Diretoria + Gestora de RH |
| 🔴 **Quem é o avaliador de cada centro de custo** — o CSV modelo (74 CCs, nº de pessoas, candidatos por cargo como sugestão) está em `MODELO_AVALIADOR_POR_CENTRO_CUSTO.csv` e **continua valendo**. ⚠️ A T.I. preencheu uma lista para destravar o desenvolvimento (§11): ela é **provisória** e **não substitui esta pendência** — quem responde por "quem avalia quem" é o RH | Gestora de RH |
| 🔴 **O público de cada aplicação** — quais centros de custo respondem qual questionário. A T.I. também vai definir um recorte provisório para destravar (§11); ele fica **marcado como provisório na tela** e **não substitui esta pendência** | Gestora de RH |
| Por que o registro de treinamento parou em 14/11/2025 | RH / Protheus |
| Quem dispara o sync: RH ou T.I.? Enquanto não se decide, **não** existe cron | Gestora de RH + T.I. |
| Confirmar os enunciados das perguntas — o export do Protheus trouxe o texto das alternativas, não o enunciado; os títulos do seed foram **derivados** | Gestora de RH |
| Segundo `RH_ADMIN` (a separação de funções exige dois) | Gestora de RH + T.I. |

---

## 6. Armadilhas do ambiente

### Ver a tela em largura de celular, aqui

Há um Chromium do Playwright em `~/.cache/ms-playwright/chromium-1187`. Com
`playwright-core` (só o pacote, o navegador já está lá) dá para renderizar em 360px e tirar
print — foi assim que se pegou o título do módulo virando "Aval…" no cabeçalho.

⚠️ Ponha o token no `localStorage` com `context.addInitScript` **antes** do primeiro
`goto`: sem token o `AuthProvider` redireciona para o Hub e a navegação é interrompida.

### 🔴 `npx` nesta máquina responde por um pacote que NÃO é a ferramenta

Não existe `node_modules` nos frontends aqui (o build é todo em Docker). Rodar
`npx tsc -b` no `gestao-pessoas/frontend` **não roda o TypeScript**: sem `typescript`
instalado local, o `npx` baixa e executa o pacote npm literalmente chamado **`tsc`** —
`tsc@2.0.4`, *"A deprecated release of the TypeScript compiler"*, um esqueleto cujo único
trabalho é imprimir:

> `This is not the tsc command you are looking for`

Ele fica em `~/.npm/_npx/1d6e82a4126006c4/node_modules/tsc`. **Não é o TypeScript do Deno** —
é um pacote decoy do próprio npm, e a distinção importa porque a saída também não é.

⚠️ **A diferença para a armadilha do cache do Docker:** esta **sai com código 1**. Não dá
falso verde — dá falso VERMELHO, que engana de outro jeito: lido rápido, parece "o typecheck
quebrou nesta máquina" ou "falta dependência do projeto", quando o que houve foi rodar outro
programa. O parentesco com o cache é a família, não o modo: **ferramenta que responde sem
fazer o trabalho**. Some a isso a armadilha já registrada de que `tsc --noEmit` checa ZERO
arquivo aqui (o tsconfig é arquivo-solução, `files: []`) e há **duas** maneiras de sair de um
"typecheck" sem ter compilado nada.

**O comando que funciona — é o build da imagem, e não é atalho:**

```bash
docker compose build gestao-pessoas-frontend      # o Dockerfile roda `npm run build`
                                                   # e o script é `tsc -b && vite build`
```

O `&&` é a garantia: erro de tipo derruba o build **antes** do `vite`, com exit code 2. Não
existe caminho em que a imagem saia pronta com erro de tipo dentro.

⭐ **E isso foi verificado por MUTAÇÃO em 08/09, não por leitura do `package.json`** — que é a
mesma regra do teste de invariante do RDV: garantia que ninguém tentou quebrar é garantia
suposta. Injetei `const MUTACAO_DO_TESTE: number = ciclo.nome;` em `CiclosPage.tsx` e o build
parou com

```
src/pages/CiclosPage.tsx(110,9): error TS2322: Type 'string' is not assignable to type 'number'.
ERROR: process "/bin/sh -c npm run build" did not complete successfully: exit code: 2
```

A mutação foi revertida e a imagem reconstruída limpa em seguida. ⚠️ **O `vite build` sozinho
NÃO pegaria isso** — ele transpila e joga os tipos fora; quem checa é o `tsc -b` do `&&`.

⚠️ O mesmo vale para o backend: a suíte roda em container, e com `-m 3g` +
`NODE_OPTIONS=--max-old-space-size=2560`. Com o `mem_limit: 512m` do compose, os workers do
Jest morrem por **SIGKILL/heap** e o relatório sai "11 suítes falharam" sem nenhum teste
falhando de verdade — outra saída que parece defeito do código e é do ambiente.

### 🔴 A armadilha mais perigosa daqui: build de frontend com fonte velho

> **Depois de TODO build de frontend: `grep` de uma string nova no bundle DENTRO do
> container. Data de imagem e `--no-cache` não provam nada.**
>
> ```bash
> docker compose exec -T <mod>-frontend sh -c "grep -c 'string que você acabou de escrever' /usr/share/nginx/html/assets/*.js"
> ```

É a mais perigosa porque **o sintoma é tela certa com código errado, sem erro nenhum** — não
há log, não há 502, não há nada que denuncie. Você olha, conclui que a correção não funcionou,
e vai depurar código que nem está rodando.

⚠️ **Vale também para o backend**, com a mesma checagem no `dist/` do container. No WSL o contexto de build lê o filesystem do Windows e pode entregar fonte
VELHO: em 06/09 uma imagem construída havia 2 minutos servia código de duas edições atrás,
sem erro nenhum. Três rodadas de print mostraram a tela antiga.

O teste que vale é `grep` de uma string nova dentro de
`/usr/share/nginx/html/assets/*.js` **no container** — data de imagem e `--no-cache` não
provam nada. Se divergir, rodar `npm run build` pelo container com bind mount (que **enxerga
o fonte fresco**) e rebuildar: escrever no `dist/` invalida o contexto e o build passa a ver
a versão certa.

⚠️ `gestao-pessoas/frontend` e `fiscal/frontend` estavam **sem `.dockerignore`**, então
`node_modules` e `dist` iam inteiros para o contexto — o que deixa o build lento e torna essa
armadilha mais provável. O do gestao-pessoas foi copiado do hub em 06/09; **o do fiscal
continua faltando**.

### ⚠️ A auditoria grava o autor, mas quase nunca o IP

`rh.auditoria` tem coluna `ip` e **só `ENVIAR` a preenche** (7 de 7). Todas as outras ações
— `ABRIR`, `APURAR`, `DESIGNAR`, `IMPORTAR`, `AJUSTAR_PERIODO`, `REVISAR` — gravam `NULL`,
porque só o `AvaliacaoService` recebe o `ContextoAcesso` com o IP; os demais services
recebem apenas o `usuarioId`. **O autor e o horário estão sempre lá e resolvem para o
username**; o que falta é de onde a pessoa agiu. Numa contestação isso raramente decide
algo, mas é bom não descobrir na hora.

⚠️ **E quando grava, grava o IP errado.** As linhas de 06/09 saíram com
`::ffff:172.19.0.20` — o **container do nginx**, não o cliente. O backend lê `req.ip` sem
`trust proxy` nem `X-Forwarded-For`, então todo mundo tem o mesmo endereço e o campo não
distingue ninguém. Pior que vazio: um IP que parece resposta.


Cada uma destas já custou tempo de alguém.

### O job de migration que mente

Os jobs `*-migrate` têm **build próprio**. Rebuildar só o backend deixa o job com o
`prisma/migrations/` antigo — e o Prisma imprime **`No pending migrations to apply.`** e sai
**0**, que é a mensagem de sucesso. Aconteceu em 05/09 e virou deploy verde com módulo
quebrado.

Desde 06/09 existe guarda (`scripts/migrate-guarda/`), em todos os 6 jobs Prisma: depois do
`migrate deploy` ela confere cada migration contra `_prisma_migrations` e **sai 1** se
faltar alguma. **`No pending migrations` sozinho não é sucesso** — a linha que vale é
`GUARDA: ok — as N migrations ... estao aplicadas`.

- A referência é a **árvore do repositório** (bind mount read-only de `prisma/`), **não** o
  diretório da imagem: imagem velha tem poucas migrations, todas aplicadas, e a conferência
  fecharia justamente no caso que se quer pegar.
- `_prisma_migrations` **não é uma só**: `auth-gateway` usa `core`, os demais `public`, e o
  cofre da Logística tem a dele em outro banco. A guarda deriva isso da connection string.
- Rebuild da imagem do job é **obrigatório**, não opcional. Está no
  `_TEMPLATE_Roteiro_Deploy.md`, PASSO 2 e no checklist final.

### Rebuild do frontend

"A tela não tem o campo" é sintoma de defeito **e** de build velho. Depois de mexer no
frontend: `docker compose build <serviço>-frontend`, `up -d`, **e `nginx -s reload`** — o
container novo pega IP novo e o nginx guarda o antigo, o que dá 502.

E o inverso também morde: **tela nova que chama rota existente ainda depende da imagem do
backend que está rodando.**

### nginx e `depends_on`

O nginx resolve os nomes dos upstreams **no start** e morre com `host not found in
upstream` se algum faltar. O `depends_on` dele precisa listar **todos** — em 06/09 faltavam
`logistica-backend` e `logistica-frontend`, e `docker compose up -d nginx` sozinho quebrava.
Serviço novo com `upstream` no `nginx.conf` **tem** de entrar naquela lista.

### `tsc -b`, nunca `tsc --noEmit`

O `tsconfig.json` do frontend é arquivo-solução (`files: []`). `tsc --noEmit` checa **zero
arquivo** e sai 0 — aprovação falsa. Use `tsc -b` (ou `tsc -b --force` para não confiar no
cache incremental).

### Migrations

**Nunca `prisma migrate dev`** neste repositório — ele reseta o banco. Migration nova se
escreve à mão no diretório e se aplica com `migrate deploy` pelo job.

### Testes

Rodam em container efêmero com **volume anônimo em `node_modules`**, para não criar
symlinks Linux dentro da árvore montada do Windows:

```bash
docker run --rm -t -v $PWD/gestao-pessoas/backend:/app -v /app/node_modules -w /app \
  node:22-alpine sh -c 'npm ci --silent && npx prisma generate && npx jest'
```

### Contas de teste no DEV

Todas com senha `Temp2026`. Login é pelo campo **`login`** (não `username`): 
`POST /api/v1/auth/login {"login":"...","senha":"..."}`.

| Conta | Papel no módulo | Fila | Observação |
|---|---|---|---|
| `ariellypereira` | RH_ADMIN | 13 | a gestora; também é AVALIADA (é o caso da separação de funções) |
| `adrianacaetano` | AVALIADOR | 84 | Gerente Supermercado — a maior fila depois do Diretor |
| `vanialucia` | AVALIADOR | 6 | ⚠️ o username é `vanialucia`, **não** `vaniacosta` |
| `wandersonnascimento` | AVALIADOR | 22 | 14 do Piloto + 8 do Geral — a fila **soma os dois ciclos** (§3.10) |
| `claudimaroliveira` | AVALIADOR | 44 | ⚠️ **conta de TESTE criada por nós no DEV em 06/09/2026** (Claudimar Dias de Oliveira, Diretor Executivo, matrícula 001079, departamento Diretoria). **Por quê:** o Diretor Executivo não tinha conta e é o avaliador designado da gestora — sem ele não havia como enviar a avaliação dela e provar a marcação da §3.1.1. **Mantida de propósito:** ele tem **44 avaliados** e é a única forma de exercitar *"quem avalia os avaliadores"* (§11) e a carga da cauda (§9). O nome traz "(TESTE DEV)" no cadastro. **Não existe em produção e não deve ser criada por script** — quando o RH definir o acesso real, esta some |
| `rodrigoleao` | — | 403 | é avaliador de 4 pessoas no dado, mas **a permissão GESTAO_PESSOAS não foi salva** (em 06/09 só o FISCAL dele mudou). Refazer no Configurador e ver se erra ao salvar — mesmo sintoma já visto com o INVENTARIO do `wandersonnascimento` |

⚠️ **Testar com ADMIN nunca pega defeito de RBAC** — ADMIN tem bypass no `RolesGuard`. Logue
com a role real.

⚠️ Dado de uso real no DEV — **não apagar**: 4 avaliações enviadas e 3 resultados no
"Avaliação Geral 2026"; no "Piloto 15/09/2026", **3 enviadas e 3 resultados** (a terceira é a
da gestora, criada no teste dirigido de 06/09) e 2 em andamento.

---

## 7. Próximo passo (revisado em 06/09, tarde)

⭐ **A pergunta "quanto tempo custa a designação" foi respondida — e a resposta muda o
plano.** Medido no DEV com as 1.036 pessoas em 4 aplicações (§10): o botão "Designar pelo
cadastro" leva **7,3 segundos**. **O gargalo do piloto nunca foi a máquina.**

O que sobra é decisão humana, e é isso que precisa acontecer antes de 15/09:

1. 🔴 **A lista de avaliadores da Arielly.** Sem ela, **174 pessoas ficam de fora** do ciclo
   — as dos 36 pares filial × CC sem nenhuma chefia — e a carga se concentra em quem
   sobrou. O CSV modelo já está com ela.
2. 🔴 **O público real de cada aplicação.** Quais centros de custo respondem qual
   questionário. É **o mesmo grau de bloqueio** que o item 1, e o único item do caminho que
   nunca teve dono: hoje 3 das 4 aplicações do DEV estão com recorte **provisório** por
   prefixo de centro de custo, montado por script para a medição existir. Ninguém do RH
   decidiu esse recorte — a tela de Aplicações o exibe marcado, para não passar por
   decisão nossa.
3. **Revisar as 457 linhas de divisão automática.** ⚠️ São **61 confirmações, não 457**: o
   botão "Conferi, está certo" é por avaliador, e confirma a lista inteira dele.

⚠️ Os itens 1 e 2 seguem sendo do RH — mas **deixaram de travar o desenvolvimento**: a T.I.
preenche os dois provisoriamente e pela tela (§11), e tudo o que entra assim fica marcado.

✅ **Um que não dependia do RH, e por isso não esperou:** `abrir`/`responder`/`enviar` não
verificavam a designação (§3.1.2). Achado e **corrigido em 06/09** — escrever na avaliação de
outro avaliador nunca foi decisão de ninguém, era ausência de regra. Verificado antes de
corrigir que **nenhuma escrita de terceiro havia acontecido** no banco.

Depois disso: os atalhos de preenchimento na tela de Aplicações (hoje ela ainda escolhe
centros de custo), e então o roteiro abaixo.

### O roteiro original, ainda válido

**Montar o ciclo do piloto de ponta a ponta com dado real, e descobrir quanto tempo leva a
designação.**

O caminho está inteiro e nada disso precisa de código novo:

1. ✅ Criar o ciclo do piloto (nasce RASCUNHO, `valeParaMerito = false`) — feito em 06/09,
   ver §8.
2. Montar **três aplicações** — é o que prova a melhoria pedida. A de **Aprendizes** já
   existe (§8); faltam duas, e para elas falta o RH escolher o público — decisão dele, não
   derivável do cadastro.
3. Designar. **É aqui que se descobre se o piloto é viável.** Sem a lista de "quem avalia
   cada centro de custo" (pendência do RH), não há como sair do lugar; com ela, a tela faz
   por lote e são ~74 operações em vez de ~1.000.
4. Abrir o ciclo e conferir o que a validação recusa.

O que esse exercício deve responder: quanto tempo custa a designação de verdade, e se falta
alguma tela que só aparece quando se usa o sistema inteiro de uma vez.

Depois disso, e em ordem de dor: **cadastro de critérios e faixas** (o painel manda
cadastrar uma faixa e não existe tela), **botão de reabertura**, **tela do sync**.

---

## 8. O que está populado no DEV (06/09, tarde) — tudo provisório

Dois scripts, em `prisma/popular-dev-*.ts`. **Não são seed de produção**, e tudo o que
gravam em `designacao_padrao` sai com `provisorio = true`.

**848 linhas** de designação, eleitas pelo **cargo** (Supervisor · Coordenador · Gerente ·
Encarregado no próprio par filial × CC) enquanto a lista real do RH não vem. Dos 82 pares,
**46 com responsável e 36 sem**.

⚠️ **"Coordenador" não elege ninguém** — nenhum cargo da Capul contém a palavra. O critério
é de três termos na prática.

⚠️ A chave **filial + CC** custa 8 pares a mais sem responsável do que a chave só por CC:
em `02|21010109` AGROVETERINARIA as 4 pessoas da filial 02 ficam sem, porque os 7 líderes
estão todos na 01.

Os quatro cenários que o piloto precisava exercitar, conferidos no banco:

| # | Cenário | Como está |
|---|---|---|
| 1 | CC grande com vários avaliadores | Supermercado Unaí: 87 pessoas entre os **11** responsáveis — dez com 8, um com 7, marcados `DIVISAO_AUTOMATICA` |
| 2 | Um avaliador em mais de um CC | Diovane (Gerente Oficina) cobre `08\|21010601`, `602` e `603` — o critério do cargo nunca produz isso sozinho |
| 3 | Quem não está na lista de ninguém | **188 pessoas**, lideradas por `41010145` RACAO SISTEMA DE ENSAQUE (61 pessoas, nenhum cargo de chefia) |
| 4 | Avaliador que também é avaliado | **86 pessoas**. A gestora de RH avalia 3 e é avaliada pelo Diretor Executivo |

**Presidente, Vice e Diretor Executivo ficam sem avaliador de propósito** — é a pendência
aberta da Diretoria, e deixá-la visível vale mais do que inventar uma resposta. Onde há
mais de um gerente, a cascata **não escolhe**: sobe para o Diretor Executivo.

**Ciclo `Piloto 15/09/2026`**, hoje **ABERTO** (aberto em 06/09, 16:12), `valeParaMerito =
false`, ao lado do "Avaliação Geral 2026" também ABERTO — são os **dois ciclos abertos ao mesmo
tempo** da §3.10, e é por isso que a fila do `wandersonnascimento` traz 22 e não 14.
⚠️ As **4 avaliações enviadas de verdade** do ciclo antigo não se tocam; o Piloto tem 3
enviadas (uma delas a da gestora, do teste dirigido de 06/09 — §3.1.1) e 2 em andamento. Aplicação **"Aprendizes"**: 31 pessoas em 15 pares, sem critérios cadastrais,
`pesoAvaliacao = 100`. Era impossível de montar com recorte por centro de custo.

Painel conferido ao vivo: `foraDeTodasAsAplicacoes = 959`, e a conta fecha — 1.036 menos
47 afastados (o ciclo não os inclui) = 989 elegíveis, menos os 30 aprendizes ativos.

⚠️ Esse 959 é de antes das 4 aplicações cobrirem o quadro: relido em 06/09 à noite, o Piloto
está com **894 designados · 95 sem designação · `foraDeTodasAsAplicacoes = 0`**. Ver §3.12 para
o que cada número desses é — e para os 84 do outro ciclo, que **não** são um recorte destes.

---

## 9. A medição de 06/09 — quanto custa montar a designação

Ciclo `Piloto 15/09/2026` com as **1.036 pessoas** em 4 aplicações, cadastro de avaliadores
populado com as 848 linhas provisórias.

| Operação | Resultado |
|---|---|
| Prévia (não grava) | 815 a criar · 174 sem avaliador · 457 de divisão não revisada — **0,2s** |
| Aplicar | **815 designações em 7,3s** (9 ms cada) |
| Reexecutar | 0 gravações · 815 já iguais — **0,2s** |

**A designação em si não é o custo.** Custam as três decisões listadas na §7 — e a maior
delas encolhe muito quando se olha direito: as 457 linhas arbitradas são **61 confirmações**,
porque o botão de revisão é por avaliador.

⚠️ **Três das quatro aplicações têm recorte PROVISÓRIO** por prefixo de centro de custo
(11 administrativo · 21 lojas · 31/41 indústria), criado por script só para a medição existir.
Escolher o público é decisão do RH e se faz na tela.

### Quem fica sobrecarregado se a lista não vier

A distribuição das 815 designações entre os 87 avaliadores: **média 9,4 · mediana 9 ·
maior 58**. A cauda é o problema, e ela é curta o bastante para caber numa conversa:

| Avaliador | Cargo | Avaliados |
|---|---|---|
| **Claudimar Dias de Oliveira** | Diretor Executivo | **58** |
| Telismar da Cunha Silva | Supervisor de Operações | 27 |
| Elias Correia Viana | Supervisor de Produção | 27 |
| Luanderson Natã de J. Pereira | Supervisor Operacional | 18 |
| Adriana Caetano Vasconcelos | Gerente Supermercado | 17 |

**Claudimar sozinho responde por 58 questionários — seis vezes a mediana.** É consequência
direta da regra provisória "onde há mais de um gerente, sobe para o Diretor Executivo", e
some quase inteira quando o RH disser quem avalia quem.

No Supermercado Unaí, onde os 11 responsáveis foram eleitos por cargo, a divisão ficou
entre **6 e 17 avaliados** — e **para 10 dos 11, TODA a lista veio da divisão alfabética**.
A exceção é a gerente, que recebeu os outros 10 líderes pela regra de hierarquia.

⚠️ **457 das 815 designações (56%) vêm de divisão alfabética não revisada.** Se o ciclo
valesse mérito hoje, mais da metade das avaliações teria sido atribuída por ordem de nome.
Não vale (`valeParaMerito = false`), e é por isso que o piloto existe — mas é o número que
explica por que o item 3 da §7 não é opcional.

---

---

## 10. Onde ler mais

| Documento | O que tem lá |
|---|---|
| `06_especificacao_gestao_pessoas.md` | A especificação. Modelo de dados, fórmulas, escopo do piloto, decisões fechadas (§7 — ⚠️ a linha "pesos por grupo" está superada), guardas de qualidade, e duas anomalias abertas no histórico do Protheus (§10). **Comece por aqui.** |
| `ADR-RH-01-colaborador-no-schema-rh.md` | Por que pessoas moram em `rh` e não em `core`, com as três condições e o gatilho que reabre a decisão |
| `ADR-RH-02-memoria-por-grupo-calculada.md` | Por que a nota por grupo nunca é gravada — no formato "o que reabre / o que NÃO reabre" |
| `DECISAO_RH_ESCOLARIDADE.md` | Para a gestora. A distribuição real das 1.036 pessoas por código, três alternativas e o efeito medido de cada uma (média 34,5 → 50,4 na opção B) |
| `OBSERVACAO_RH_APRENDIZES.md` | Os aprendizes e por que a aplicação deles não tem critérios cadastrais |
| `REGRESSAO_PROTHEUS_GESTAO_PESSOAS.md` | A regressão contra o ciclo 000006: o que bateu (questionário, 108/108) e o que não bateu, e por quê |
| `PREENCHER_AVALIADORES_82_PARES.csv` | O da **T.I.** (§11): 82 pares filial × CC ordenados por nº de pessoas, com os candidatos por cargo já na coluna de sugestão e os **36 pares sem nenhuma chefia** marcados `SEM CHEFIA - RESOLVER`. Importa direto pela tela |
| `MODELO_AVALIADOR_POR_CENTRO_CUSTO.csv` | Para a gestora de RH: os 74 centros de custo, filiais, nº de pessoas, coluna de avaliador **em branco** e os candidatos por cargo como sugestão. `;` e UTF-8 com BOM, abre direto no Excel pt-BR |
| `SYNC_GESTAO_PESSOAS_CSV.md` | O SQL de extração dos três CSVs, o formato, os números da carga real e os achados sobre os dados |
| `select-original-protheus.sql` | O select do sistema antigo, versionado como registro histórico. **Não é o select em uso** — o de hoje está no doc do sync |
| `arquitetura-para-modulo-rh.md` | O levantamento da plataforma feito antes de escrever a primeira linha. Leia antes de reexplorar o repositório |
| `_TEMPLATE_Roteiro_Deploy.md` | O roteiro de deploy da plataforma. PASSO 2 cobre a guarda do migrate |
| `/CLAUDE.md`, seção 8 | O resumo do módulo dentro do mapa da plataforma |

**No código**, os comentários que mais poupam tempo estão em
`src/avaliacao/separacao-funcoes.ts`, `src/common/elegibilidade.ts`,
`src/sincronizacao/data-ultima-funcao.ts` e `src/calculo/motor.ts`. As marcas `A2`, `C9`,
`E2` que aparecem em comentários são referências à rodada de decisões que originou a
especificação; o conteúdo de cada uma está na §3 deste documento ou na §7 da spec.

---

## 11. A lista provisória da T.I. — o que ela é e o que ela NÃO é

Decisão de 06/09: **não esperar o RH para destravar o desenvolvimento.** A T.I. preenche a
lista de avaliadores e o público das aplicações com o que sabe da estrutura, para o piloto
poder ser exercitado inteiro.

**O que isso é:** dado de trabalho, para as telas serem usadas de verdade e os defeitos que
só aparecem com uso aparecerem antes de 15/09.

**O que isso NÃO é:** a decisão sobre quem avalia quem. Essa é do RH, tem consequência de
mérito, e continua pendente na §5. As duas linhas de lá **não saem** por causa disto.

### Importada em 06/09 — 48 dos 82 pares

O Clenio preencheu 48 pares (34 em branco, 174 pessoas). Importada pela tela, `provisorio =
true`, com "substituir ajustes manuais" ligado — os únicos `MANUAL` existentes vinham do
script provisório, não de decisão de ninguém.

| | antes (por cargo) | depois (lista do Clenio) |
|---|---|---|
| Sem avaliador no cadastro | 188 | **108** |
| Linhas de divisão automática | 457 | **169** |
| Avaliadores | 87 | **52** |

⚠️ Estes números são do momento da importação. Depois dela, o script
`popular-dev-fila-do-avaliador.ts` reatribuiu 15 pessoas para a conta de teste do AVALIADOR
(§ abaixo), e o estado corrente é **928 linhas vigentes · 108 sem avaliador · 159 não
revisadas · 53 avaliadores**. Confira no banco antes de citar — número de documento
envelhece.
| Média / mediana / maior | 9,4 / 9 / 58 | **17,2 / 11,5 / 95** |

⚠️ **A lista real CONCENTRA em vez de espalhar, e isso é informação para o RH.** O critério
por cargo elegia todo mundo com cargo de chefia e repartia; a lista de quem conhece a
estrutura aponta **um** responsável por centro de custo. O resultado é hierarquicamente mais
limpo e operacionalmente mais pesado: a gerente do Supermercado Unaí ficaria com **95
questionários**, o gerente comercial da Agroveterinária com 83.

⚠️ **Claudimar continua com 45**, todos `MANUAL` da regra provisória de hierarquia ("quem
avalia o responsável"), espalhados por centros de custo que a planilha ainda não cobre. Cai
junto quando os 34 pares restantes forem preenchidos.

### Decisão de 06/09: quem avalia os avaliadores fica com a regra provisória

**46 dos 52 avaliadores são avaliados pelo Diretor Executivo**, pela cascata provisória
("onde há mais de um gerente, sobe"). Preencher os 82 pares da planilha **não muda isso** —
ver a pendência nova na §5.

Três caminhos foram postos, e o escolhido foi **deixar como está para o piloto**: é
provisório, está marcado, e "quem avalia os gerentes" é decisão de estrutura que a T.I. não
tem como tomar por palpite. Deixá-la visível no cadastro vale mais do que resolvê-la errado.

Os outros dois continuam disponíveis quando alguém decidir: ajustar à mão na tela (~46
operações em "Avaliadores → designar"), ou uma segunda planilha no formato "esta pessoa é
avaliada por aquela".

### O DEV valida o PROCESSO, não o organograma (decisão de 06/09)

Ficaram 34 pares sem avaliador e **assim continuam**. A atribuição real é do RH e só vale em
produção; aqui o que precisa ser exercitável é o caminho. Sortear avaliadores para os 34 foi
descartado por duas razões: apagaria o cenário da pendência (abaixo) e produziria dado que
*parece* decisão — a gerente de Buritis avaliando a Segurança Patrimonial de Unaí.

**O bloqueio real não era a lista, era o acesso.** Das 894 avaliações do ciclo, só 27
estavam com alguém que consegue entrar no sistema — e a conta que tem o papel `AVALIADOR`
(`wandersonnascimento`) tinha **zero**.

🔴 **E o acesso continua sendo o gargalo do piloto: só 2 contas têm permissão no módulo.**
`core.permissoes_modulo` para `GESTAO_PESSOAS` tem exatamente duas linhas —
`ariellypereira` (RH_ADMIN) e `wandersonnascimento` (AVALIADOR). Todas as outras contas com
matrícula, inclusive `supdept01` (Clenio, com **13 avaliações designadas**), **não abrem o
módulo**: caem em "Peça ao RH que lhe conceda acesso". Conceder acesso é ato do Configurador,
por pessoa, e não sai de nenhuma migration — em 15/09 isso precisa estar feito para cada
avaliador real, ou a fila existe e ninguém alcança. `prisma/popular-dev-fila-do-avaliador.ts` resolve
isso com o recorte mínimo: 12 do próprio centro de custo dele + 3 aprendizes, tudo
`provisorio = true`. A fila tem gente de **duas aplicações** de propósito — é o que prova a
melhoria que originou o módulo, o mesmo avaliador abrindo um questionário de 14 perguntas
para o repositor e um de 11 para o aprendiz.

**Processo validado de ponta a ponta em 06/09**, no ciclo do piloto (ABERTO):

| Passo | Resultado |
|---|---|
| Fila do avaliador | 14 pendentes — 11 Operação de Loja (14 perguntas) + 3 Aprendizes (11) |
| Enviar incompleto | recusado: *"Faltam 11 pergunta(s)"* |
| Responder + enviar | nota do questionário **58,6**, com a quebra por grupo |
| Apurar | 1 avaliação · nenhum alerta |
| Resultado | nota final **58,6** · conceito **Atende** · sem renormalização |

⭐ O resultado confirma a §3.5 no dado real: aplicação **sem critérios** e `pesoAvaliacao =
100` faz `notaFinal = notaAvaliacao` **pela fórmula**, sem caso especial.

⭐ **As 108 pessoas sem avaliador não são uma falha da carga — são um cenário que vale
manter.** Elas mantêm vivo no DEV o caminho "elegível que ninguém designou", que é a única
pendência do módulo que some sozinha, e que precisa aparecer no painel e na pendência
reversa para ser testada.

Três coisas garantem que ninguém confunda uma com a outra:

1. **`provisorio = true` é o padrão da importação**, no backend e na tela. Desmarcar exige
   um ato — e é uma afirmação de que a lista foi confirmada pelo RH, não um default.
2. **A tela avisa** enquanto houver qualquer linha provisória. ⚠️ `aplicacao_publico` ganhou
   coluna `provisorio` (migration `20260906190000`): a tarja vinha de procurar a palavra
   "PROVISORIO" dentro de `origem_referencia`, o que funcionava enquanto quem escrevia a
   referência era um script nosso e **quebraria em silêncio** no primeiro recorte montado
   pela tela, que escreve só `02|21010101`. Tarja que some sozinha é pior que tarja nenhuma.
3. **O CSV da Arielly continua valendo e não foi substituído.**
   `MODELO_AVALIADOR_POR_CENTRO_CUSTO.csv` é o dela, por centro de custo;
   `PREENCHER_AVALIADORES_82_PARES.csv` é o da T.I., por par filial × CC. São arquivos
   diferentes, com públicos diferentes.
