# Gestão de Pessoas — estado do projeto

> Ponto de entrada para quem vai mexer no módulo. Diz onde estamos, o que não se
> discute mais e onde ler o resto. Última revisão: **06/09/2026**.
>
> Piloto previsto para **15/09/2026**.

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
| Backend | NestJS 11 + Prisma 6, schema `rh`, porta 3004, prefixo `/api/v1/gestao-pessoas`. **26 endpoints** em 8 controllers. |
| Frontend | React 19 + Vite 7 + Tailwind v4, base `/gestao-pessoas/`, porta 5178. **7 telas** (8 arquivos em `pages/` — `CicloPage` é a moldura com as abas, não uma tela). |
| Banco | 4 migrations em `rh` (23 tabelas) + 2 no `auth-gateway` (módulo/roles e ativação). |
| Testes | **269 testes, 19 suítes**, verdes. `tsc -b` e ESLint limpos nos dois lados. |
| Módulo no Hub | **ATIVO** desde 06/09 (`20260906030000_ativa_gestao_pessoas_no_hub`). |

**As sete telas:** fila do avaliador · responder questionário · ciclos · aplicações ·
designação · painel (com pendências cadastrais) · resultados (com memória de cálculo).

**Motor de cálculo** completo, com renormalização, e validado por regressão contra o
ciclo 000006 do Protheus — a nota do questionário bate **108/108** (ver
`REGRESSAO_PROTHEUS_GESTAO_PESSOAS.md`).

**Sincronização** rodada de verdade em 06/09: 8.111 linhas lidas → **1.036 colaboradores**
(o resto é demitido ou autônomo), 29.881 → 14.024 lançamentos de histórico funcional,
3.258 → 2.268 treinamentos, **82 pares filial × centro de custo com descrição**.

### Pela metade

- **Ciclo e aplicação não têm edição.** Dá para criar, abrir e encerrar o ciclo; criar a
  aplicação. Não há `PATCH` nem `DELETE` de nenhum dos dois — errou, cria outro. Aceitável
  enquanto o ciclo é RASCUNHO, incômodo depois.
- **Reabertura de avaliação** existe na API (`POST /avaliacoes/:id/reabrir`, com motivo
  obrigatório e auditoria) e **não tem botão em tela nenhuma**.
- **Sincronização** existe na API (`POST /sincronizacao`, RH_ADMIN) e **não tem tela nem
  cron**. Hoje se dispara por `curl`, e os três CSVs precisam ser extraídos do Protheus à
  mão e colocados em `RH_CSV_DIR` (padrão `/app/carga`, que não existe no container — é
  preciso criar e copiar). Ver `SYNC_GESTAO_PESSOAS_CSV.md`.
- **Designação é sempre manual.** O cadastro do Protheus não diz quem é o superior de
  quem, então não existe designação automática por centro de custo — a tela faz seleção
  múltipla + um avaliador para o lote, o que transforma ~1.000 designações em ~74 (uma por
  centro de custo), desde que o RH diga quem avalia cada centro. **É o gargalo do piloto.**
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
| **Quem é o avaliador de cada centro de custo** — sem isso a designação não sai do lugar | Gestora de RH |
| Por que o registro de treinamento parou em 14/11/2025 | RH / Protheus |
| Quem dispara o sync: RH ou T.I.? Enquanto não se decide, **não** existe cron | Gestora de RH + T.I. |
| Confirmar os enunciados das perguntas — o export do Protheus trouxe o texto das alternativas, não o enunciado; os títulos do seed foram **derivados** | Gestora de RH |
| Segundo `RH_ADMIN` (a separação de funções exige dois) | Gestora de RH + T.I. |

---

## 6. Armadilhas do ambiente

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

`ariellypereira` / `Temp2026` → RH_ADMIN.  `wandersonnascimento` / `Temp2026` → AVALIADOR.

⚠️ **Testar com ADMIN nunca pega defeito de RBAC** — ADMIN tem bypass no `RolesGuard`. Logue
com a role real.

⚠️ Há **3 avaliações enviadas de verdade** no ciclo do DEV (uma delas com respostas
variadas, nota 54,65) e 3 resultados apurados. São o único dado real de uso — não apagar.

---

## 7. Próximo passo

**Montar o ciclo do piloto de ponta a ponta com dado real, e descobrir quanto tempo leva a
designação.**

O caminho está inteiro e nada disso precisa de código novo:

1. Criar o ciclo do piloto (nasce RASCUNHO, `valeParaMerito = false`).
2. Montar **três aplicações** — é o que prova a melhoria pedida. Os três modelos de
   produção já estão publicados pelo seed; falta escolher os centros de custo de cada
   público (a tela mostra quantas pessoas há em cada um).
3. Designar. **É aqui que se descobre se o piloto é viável.** Sem a lista de "quem avalia
   cada centro de custo" (pendência do RH), não há como sair do lugar; com ela, a tela faz
   por lote e são ~74 operações em vez de ~1.000.
4. Abrir o ciclo e conferir o que a validação recusa.

O que esse exercício deve responder: quanto tempo custa a designação de verdade, e se falta
alguma tela que só aparece quando se usa o sistema inteiro de uma vez.

Depois disso, e em ordem de dor: **cadastro de critérios e faixas** (o painel manda
cadastrar uma faixa e não existe tela), **botão de reabertura**, **tela do sync**.

---

## 8. Onde ler mais

| Documento | O que tem lá |
|---|---|
| `06_especificacao_gestao_pessoas.md` | A especificação. Modelo de dados, fórmulas, escopo do piloto, decisões fechadas (§7 — ⚠️ a linha "pesos por grupo" está superada), guardas de qualidade, e duas anomalias abertas no histórico do Protheus (§10). **Comece por aqui.** |
| `ADR-RH-01-colaborador-no-schema-rh.md` | Por que pessoas moram em `rh` e não em `core`, com as três condições e o gatilho que reabre a decisão |
| `ADR-RH-02-memoria-por-grupo-calculada.md` | Por que a nota por grupo nunca é gravada — no formato "o que reabre / o que NÃO reabre" |
| `DECISAO_RH_ESCOLARIDADE.md` | Para a gestora. A distribuição real das 1.036 pessoas por código, três alternativas e o efeito medido de cada uma (média 34,5 → 50,4 na opção B) |
| `OBSERVACAO_RH_APRENDIZES.md` | Os aprendizes e por que a aplicação deles não tem critérios cadastrais |
| `REGRESSAO_PROTHEUS_GESTAO_PESSOAS.md` | A regressão contra o ciclo 000006: o que bateu (questionário, 108/108) e o que não bateu, e por quê |
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
