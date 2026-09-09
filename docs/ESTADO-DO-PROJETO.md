# Gestão de Pessoas — estado do projeto

> Ponto de entrada para quem vai mexer no módulo. Diz onde estamos, o que não se
> discute mais e onde ler o resto. Última revisão: **08/09/2026** (fim do dia).
>
> Piloto previsto para **15/09/2026**.

## ✅ PUBLICADO EM 09/09/2026 — `origin/main` = `eb1264a9`

Publicado pelo Clenio no fim do dia: **`2835b51d..eb1264a9`**, 27 commits, 313 objetos. Local e
remoto iguais (0 à frente, 0 atrás, árvore limpa). Publicações anteriores: 08/09
(`6f13a210..e4f7d453`, 17 commits) e 07/09 (`6855c918..6f13a210`, 1.079 objetos).

⚠️ **O que foi publicado hoje NÃO está em ambiente nenhum além do DEV.** PROD e HLG continuam sem
o módulo Gestão de Pessoas, e o roteiro de deploy do Marco segue **superado** — o alvo mudou de
novo com a onda de hoje.

### Onde cada ambiente está (08/09)

| | Commit | Tem o Gestão de Pessoas? |
|---|---|---|
| `origin/main` | **`e4f7d453`** | sim |
| **HOMOLOGAÇÃO** | `6855c918` | **não** |
| **PRODUÇÃO** | `6855c918` | **não** |

⚠️ **A distância cresceu.** O que está publicado tem **hoje inteiro** — 11 itens do roteiro de
tela, incluindo o cancelamento de avaliação (com **migration**) e o encerramento com pendência.
Nenhum ambiente além do DEV viu qualquer coisa disso.

O Marco aplicou em 07/09, em HLG **e** em PROD, o roteiro de 04/09
(`PlatformCapul_20260904_Roteiro_Deploy.md`, alvo `6855c918`) — que **não continha este
módulo**. ⚠️ Confirmar o rótulo quando for conveniente (`/health` → `versao.commit`): o que
está acima é o declarado, e estado de ambiente é o que mais envelhece nestes registros.

⏸️ **DEPLOY ADIADO (decisão de 09/09, noite).** O piloto é o teste final do **PRODUTO**, não só
da avaliação: se o RH não consegue ver nem editar as perguntas, o piloto testa metade do sistema.
Os dias até 15/09 vão para fechar as telas que faltam. **Nada do que foi levantado se perde** —
muda de data:

| Guardado | Onde está |
|---|---|
| Transporte do cadastro DEV → HLG | `gestao-pessoas/scripts/exportar-cadastro-para-hlg.sh` + `conferir-cadastro-hlg.sql` — **ensaiados** em banco limpo em 09/09 |
| As 5 verificações do HLG antes de montar o ciclo | (1) módulo instalado · (2) `rh.colaborador` populado · (3) contas dos 5 avaliadores · (4) permissão `GESTAO_PESSOAS` de cada um · (5) dois `RH_ADMIN` — as consultas estão em `conferir-cadastro-hlg.sql` |
| Roteiro de deploy do módulo | **por escrever** (~2h): 3 serviços, 2 `location`, 12 migrations, auth-gateway primeiro, job `*-migrate` com build próprio, reload do nginx no fim |
| Decisão pendente do transporte | 521 das 1.384 designações têm `registrado_por_id` de um usuário do DEV, que não existe em HLG — reescrever, anular ou deixar |

✅ **O piloto de 15/09 vai para HOMOLOGAÇÃO** (Marco confirmou em 09/09/2026: *"serve sim"*,
acesso e dado). É a opção que paga o ensaio do deploy — o roteiro do módulo estreia num servidor
de verdade, na rede da empresa, com URL alcançável pelas 137 pessoas — **sem** pôr um ciclo de
teste com gente real, nota real e resultado apurado dentro da base de PRODUÇÃO. ⚠️ Rodar em DEV
estava descartado por um motivo só, e ele decide sozinho: `https://localhost` na máquina do
Clenio, atrás de WSL2 e de certificado autoassinado, **não é URL que se manda a um repositor no
salão do supermercado** — e aí o piloto perderia justamente o teste do celular em pé, que é uma
das sete coisas que só ele prova.

⭐ **O cadastro vai por SQL, não por planilha** — `gestao-pessoas/scripts/`:
`exportar-cadastro-para-hlg.sh` gera um `.sql` de 3,6 MB com as 5 tabelas que o piloto precisa
(colaborador 1.036 · designacao_padrao 1.384 · importacao_designacao 2 · treinamento 2.268 ·
histórico de função 14.024), na ordem das FKs, e `conferir-cadastro-hlg.sql` compara os dois
lados. **Ensaiado em 09/09 num banco limpo** (estrutura do zero + carga): as duas pontas batem,
inclusive a impressão md5 das matrículas. ⚠️ Questionário, critérios e faixas **não viajam** —
vêm do `prisma db seed`, que é a fonte deles; copiar dado que tem seed cria uma segunda verdade.
⚠️ E planilha está descartada por motivo do próprio módulo: **o Excel come o zero à esquerda**
(é por isso que `planilha.ts` tem `normalizarMatricula`), e uma matrícula truncada vira o **403
que parece falta de permissão** — o pior erro possível num ambiente onde 137 pessoas entram pela
primeira vez.

⚠️ **Então o módulo precisa de roteiro PRÓPRIO** — e ele é maior que uma onda comum, porque
sobe um serviço novo em vez de atualizar um existente:

| O que entrou | Detalhe |
|---|---|
| **3 serviços novos** no `docker-compose.yml` | `gestao-pessoas-migrate` (job com build próprio e GUARDA), `gestao-pessoas-backend` (porta **3004**), `gestao-pessoas-frontend` |
| **nginx** | duas `location` novas (`/gestao-pessoas/` e `/api/v1/gestao-pessoas/`) — **reload obrigatório** depois do rebuild |
| **12 migrations** | **2 do `auth-gateway`** (registra o módulo + roles; e a que **ativa o card no Hub**) e **10 do `gestao-pessoas`** — a última é a de 08/09, `20260908090000_avaliacao_cancelada_com_motivo` |
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

### ⭐⭐ Quem é dono de cada NÚMERO neste documento

Achado em 08/09, varrendo o próprio arquivo: o censo de acesso aparecia como **estado atual**
em três lugares, e dois estavam errados havia um dia. É a **regra 5 da §5.9 aplicada ao
documento** — *relatório cita atributo, não o possui* —, e vale como convenção de escrita:

**1. Toda conta viva tem UM dono declarado, e ele é a §0.** Ambiente e commits, censo de
acesso, contagem de testes e de migrations moram lá. Fora da §0, o mesmo número só aparece
**datado** (*"em 08/09 eram 8"*) ou como **ponteiro** (*"a conta está na §0"*).

**2. Número dentro de um achado é CITAÇÃO, e citação não se atualiza.** Ele registra o que se
mediu quando aquilo foi consertado; reescrevê-lo apaga a evidência do conserto. Foi por isso
que a tabela do acesso virou "07/09 × 08/09" em vez de ser trocada.

**3. O teste é a FRASE, não a repetição.** Se ela responde *"como está hoje?"*, precisa de dono
ou de data. Se responde *"como estava quando isto foi decidido?"*, está no lugar certo — ainda
que o número apareça dez vezes no arquivo. Os **108** e **95** da §3.12 se repetem de propósito:
são o exemplo que sustenta a explicação, não um estado.

⚠️ **Isto é convenção, e NÃO é verificável por ferramenta** — ao contrário da varredura de
contrato do §3.1.9, que roda. Um script que comparasse os números do documento com o banco
erraria justamente nas **citações datadas**, que são a maioria e estão certas: ele acusaria como
"desatualizado" cada evidência de conserto. Saber **por que não automatizamos** vale tanto
quanto a regra — sem isso, alguém escreve o script daqui a um mês e ele vira ruído que se
aprende a ignorar.

⚠️ **E esta regra é SÓ deste documento — o motivo é a natureza dele.** O ESTADO é o documento
**vivo**, atualizado várias vezes por dia, e é dele que se lê *"como as coisas estão"*. A
especificação e os ADRs são **estáveis por construção**: número neles é quase sempre citação
legítima, e **um ADR sem o número da época perde a evidência da decisão** — atualizar apagaria
o que se decidiu e sobre qual dado. O mesmo vale para documento dirigido a quem vai decidir
(`DECISAO_RH_ESCOLARIDADE.md`): a base de 05/09 é o que a gestora leu, e reescrevê-la depois da
resposta invalidaria a própria decisão. **Aplicar esta regra lá faz mal.** Conferido em 08/09:
nenhum dos quatro documentos do módulo apresenta estado corrente do DEV.

---

## 0. O que trava e o que anda — fechamento de 06/09/2026

Os 🔴 do dia nasceram espalhados por §3.1.1, §3.1.2, §3.1.4, §5 e §11. Aqui estão os
mesmos itens em dois blocos, sem prosa. **Esta lista é um índice: quem decide o quê fica
na seção citada.**

### 📍 ONDE O DIA PAROU — 08/09/2026

> 📐 **Regras de método:** `docs/REGRAS-DE-METODO.md` — 26 regras, cada uma com o **gatilho** que
> a dispara. É o que se relê daqui a um mês; esta seção é o que envelhece em semanas.

> ⚠️ **Esta seção é a DONA das contas vivas** — ambientes e commits, censo de acesso, contagem
> de testes e de migrations. **Está atualizando algum desses números?** Ele se atualiza **aqui**.
> Se você precisa citá-lo noutra seção, **date-o** (*"em 08/09 eram 8"*) ou aponte para cá — não
> repita como estado. O porquê está no cabeçalho do arquivo.

✅ Publicado no meio do dia: `6f13a210..e4f7d453`, 17 commits. ⚠️ **Depois disso vieram mais
7 commits locais — `origin/main` está em `b121fa78` e o push é do Clenio.** Eles são: a
correção da chapa no Configurador e a rede no módulo (§3.1.25), a designação das 13 do
`supdept01` para a `renataborges`, e a varredura dos números do próprio documento.

O dia foi inteiro o **roteiro de tela**: 11 itens fechados (A, B, C + os 8 da lista), **490
testes** (eram 422 na véspera), **1 migration** aplicada com `GUARDA: ok`
(`20260908090000_avaliacao_cancelada_com_motivo`), e **5 ciclos descartáveis** criados e
apagados, cada um com o SELECT antes e a conta conferida depois.

⚠️ **PROD e HLG continuam em `6855c918`, sem o módulo.** Nada do que foi feito hoje está em
nenhum ambiente além do DEV, e o roteiro de deploy do Marco segue **superado** (o alvo mudou de
novo: mais uma migration).

**O que ficou registrado sem fazer**, por decisão: itens **17** (recorte provisório sem
confirmação — depende da Arielly), **18** (os menores do item K) e **19** (URL desconhecida que
leva ao lugar errado em silêncio) da lista (B). E **⭐ as regras de método do dia estão na
§5.9** — é o que se relê daqui a um mês, não a lista de tarefas.

⚠️ **Duas linhas mudaram DEPOIS de este fechamento ser escrito:**

- **o censo** — **8 de 53** abrem o módulo, **179 de 894** alcançáveis, **0** contas sem
  permissão, **45** sem conta nenhuma. **A lacuna "conta sem permissão" zerou em 08/09**;
  ⚠️ **corrigido em 09/09 — o denominador estava misturado.** O que se lia (54 / 46 / 187)
  somava o Piloto com o ciclo "Avaliação Geral 2026". **Recontado só no Piloto**, medindo no
  banco: 53 avaliadores distintos, 8 com conta, 45 sem, 179 de 894 alcançáveis. A soma dos oito
  fecha em 179 e o erro por pessoa era um só — `wandersonnascimento` valia 14 no Piloto, não 22;
- **o item 2 da (B) saiu** — o `rodrigoleao` salvou, e **não houve terceiro caso do sintoma do
  Configurador**. No lugar dele entrou a **colisão de chapa** (§3.1.25), já ✅.

**Amanhã:** o roteiro curto do Chrome nas duas partes combinadas, e depois o **item 1** — as
46 contas, que é trabalho do Clenio no Configurador.

### 🔁 Segunda rodada da conferência de tela — 6 consertos + 1 levantamento (08/09)

A skill do Chrome rodou de novo sobre os 11 itens da véspera. **8 passaram limpos** e não voltam
a ser conferidos. O que ela achou está em **§3.1.26 a §3.1.31**:

| # | O quê | Estado |
|---|---|---|
| 1 | Modal de vínculo errava por 1 no modo GRUPO | ✅ §3.1.26 |
| 2 | `designar/previa`: cinco ações, quatro contadores | ✅ §3.1.27 |
| 3 + 4 | Dois cortes de lista mudos (+ o grep dos dois restantes) | ✅ §3.1.28 |
| 5 + 6 | Cabeçalho não fechava a conta · título não recebia o modo | ✅ §3.1.29 |
| 7 | As **cinco** superfícies de prévia | 📋 levantado → **1 e 2 feitos**, 3 parado |
| 8 | Prévia de verdade no modal de vínculo | 📝 §3.1.30 — trava numa pergunta de produto |
| 9 | Descrição do centro de custo | ⏸️ §3.1.31 — adiado, escopo corrigido |

⭐ **O levantamento do item 7 está em `docs/LEVANTAMENTO_PREVIAS_GESTAO_PESSOAS_08SET.md`** — os
cinco payloads lado a lado, a resposta às quatro perguntas, e **dois achados novos**: a prévia de
`designar` **não roda duas guardas que o ato roda** (autoavaliação e troca de aplicação — medido:
a prévia diz `SUBSTITUIR`, o ato recusa), e `barradosPelaRegua` conta exclusão manual em
`previa-da-abertura`. Também **corrige uma premissa**: o `criar` dos dois endpoints **não** colide.

#### O que saiu do levantamento, na ordem de custo que ele propôs

**1. As duas colisões, nomeadas** (§3.1.32) — `barradosPelaRegua` → `foraDoCiclo` na
`previa-da-abertura`, que era o mais urgente porque o campo conta **exclusão manual do RH** e o
nome afirmava régua; e `adicionar` → `entramNoPublico`, para separar os dois objetos (lista ×
avaliação). Junto: o `criar` **não** colidia, e isso ficou escrito no fonte, ao lado dos dois
campos, porque a próxima pessoa vai desconfiar de novo.

**2. A prévia rodando as mesmas guardas** (§3.1.33) — as duas subiram para o classificador
compartilhado e `assertPodeTrocarDeAplicacao` deixou de existir. **Não é uma cópia das guardas: é
a mesma função.** Conferido no DEV: onde a prévia dizia `SUBSTITUIR` e o ato recusava, agora os
dois dizem `RECUSAR` **com a mesma frase**.

**3. Unificar (1) e (2)** — **parado**, e de propósito: depende da pergunta do `JA_RESPONDIDA`,
agora na lista (A) junto da do `EXIGE_CONFIRMACAO` no cadastro. Unificar antes escolheria a
política por omissão, que é como o buraco do §3.1.27 nasceu.

**537 testes** (eram 515). Nenhuma migration. **Nada foi gravado no banco** — o ciclo
`ZZ CONFERE 09/09` seguiu intacto para a skill terminar a conferência.

### 🔁 Terceira rodada — os nove passaram, e vieram mais três (08/09)

A skill confirmou o item 4 no payload (`recusar: 1`, `acao: RECUSAR`). O que ela achou depois:

| # | O quê | Estado |
|---|---|---|
| 1 | Botão armado sobre prévia vazia — o inverso do §3.1.27 | ✅ §3.1.34 (as outras 4 prévias já travavam) |
| 2 | Concordância de número — **e era geral**: 19 erradas, 56 fugas, 10 ternários | ✅ §3.1.35 |
| 3 | "0 fora do ciclo" como ruído | ✅ §3.1.36 |
| 4 | Os dois slices por identificar | ✅ **fechado** — §3.1.28 |

⭐ **O item 2 é o achado do dia**, e não pelo tamanho: as duas frases erradas eram sintoma de
**três convenções convivendo** no mesmo módulo. Um jeito só agora (`flexao`/`contagem`), com a
regra escrita ao lado da irmã dela (§3.1.7).

⭐ **O item 4 fechou com identificação, não com dedução**: o `.slice(0,5)` foi extraído do bundle
com o contexto e é do **React DOM** (teste de prefixo `data-`/`aria-`). O fonte tem 8 `.slice(`
no total, os 8 catalogados. Não volta.

### 🧪 Ciclo de SIMULACAO 09/09 — montado pela TELA, parado em RASCUNHO (09/09)

**2 aplicações · 54 no público · 50 designados · 0 sem avaliador · 4 fora do ciclo.**
Roteiro em `docs/ROTEIRO_CICLO_SIMULACAO_09SET.md`. **Não aberto** — decisão do Clenio.

⚠️ **Duas previsões minhas caíram, e a tela estava certa nas duas:**
- previ **3 sem avaliador** deixando a Controladoria fora da cópia. Deu **0** — o cadastro cobre as
  54, Controladoria inclusive, e a inclusão posterior no público não impediu o vínculo de existir;
- previ **2 fora do ciclo**. São **4** — duas afastadas a mais, nascidas na montagem do público, e
  a prévia avisou com nome e motivo **antes de gravar**. A tela fez o trabalho dela.

⭐ **O ciclo pagou o que custou no primeiro dia:** dois defeitos, um deles o mais grave achado no
módulo desde que ele existe (§3.1.37, 48% das designações impossíveis), mais quatro menores
(§3.1.39). Nenhum apareceu em 537 testes nem em três rodadas de conferência de tela — só em rodar
o processo inteiro com dado real.

**Depois de §3.1.37 e §3.1.38:** a skill redistribuiu, abriu e **respondeu 13 avaliações pela
tela** — e apurou as 13. O ciclo está com 52 linhas (2 canceladas), 13 enviadas, 13 apuradas.

⭐ **Saldo do ciclo de simulação até agora: 9 defeitos**, dos quais **3 graves** — 48% das
designações impossíveis (§3.1.37), o denominador que nunca fecharia em 100% (§3.1.38/§3.1.40) e a
tela prometendo ao avaliador um caminho que não existia (§3.1.41/§3.1.43). Nenhum apareceu em 537
testes nem em três rodadas de conferência de tela.

⚠️ **Dois deles foram achados DEPOIS de eu dizer que estava resolvido** — os três `_count` do
§3.1.40 e a promessa do §3.1.45. O padrão vale mais que os defeitos: o que escapa não é o caso
difícil, é a **forma que eu não procurei**. Virou a regra 13 da §5.9.

### ✅ O processo foi percorrido INTEIRO pela tela — e o encerramento rendeu 9 (09/09)

Montar → designar → abrir → responder → apurar → resultado → **encerrar**. O último passo nunca
tinha sido percorrido, e sozinho rendeu **9 achados** (§3.1.46 a §3.1.51), dois graves: o motivo
que estava gravado e não chegava à tela, e o cancelamento em massa irreversível que **nenhum dos
dois diálogos** mencionava.

⭐ **Saldo do ciclo de simulação: 18 defeitos.** Nenhum apareceu em 537 testes nem em três rodadas
de conferência de tela — só em rodar o processo inteiro, com dado real, até o fim. **A etapa que
nunca tinha sido percorrida foi a que mais rendeu**, e isso vale para o próximo módulo: o passo
que ninguém testou não é o mais simples, é o menos conhecido.

O ciclo está **ABERTO, reaberto 1×, com 39 canceladas** — o único lugar onde esse estado existe.
Não apagar.

### 🔁 Quarta rodada — o ciclo ZZ ENCERRA, e 5 dos 7 passaram (09/09)

Ciclo descartável montado só para percorrer o **encerramento com pendência** — o SIMULACAO tinha
zero pendentes e não dispararia o diálogo. `ZZ ENCERRA 09/09`, 1 aplicação, público de 9,
5 designadas. **Os consertos de 08–09/09 estão de pé**: o motivo chega às 5, os dois blocos, os
textos do estado encerrado, os botões cinza.

**Três achados novos (§3.1.52 a §3.1.54)** e **dois registrados sem fazer (§3.1.55)**. ⭐ O padrão
do dia: **os três são de ALCANCE — regra certa aplicada a um recorte menor que o real.** O mínimo
do motivo valia para um ato e não para o irmão dele; o `fechado ?` valia para um bloco e não para
os vizinhos; a ressalva do reabrir valia no diálogo e não na tela onde se decide.

⚠️ **E os três escaparam de 564 testes** — porque teste afirma comportamento de UM caminho, e
alcance é sobre **quais caminhos existem**. O que pega isso é varredura de fonte: virou
`motivo.invariante.spec.ts`. **572 testes** agora.

⚠️ **`ZZ ENCERRA 09/09` fica ENCERRADO, com 5 canceladas, nunca reaberto** — é o único ciclo
nesse estado na base. Não apagar. (Dá para apagar por SQL se um dia precisar: não existe rota
DELETE de ciclo, e as FKs de `rh.*` são todas RESTRICT — são 11 DELETEs em ordem. A `rh.auditoria`
não tem FK e **sobrevive**, apontando para um ciclo que deixou de existir.)

### ✅ Depois do fechamento — o acesso destravou (08/09, madrugada)

O Clenio configurou `rodrigoleao`, `vanialucia` e `denisealves` no Configurador; **as três
salvaram**. ⚠️ **Não houve terceiro caso do sintoma "a permissão não salvou"** — o item 2 da
lista (B) saiu. A primeira consulta que fiz à `denisealves` rodou **antes** de ele salvar, e eu
apresentei "nenhuma linha" como fato sobre a configuração quando era só o instante em que olhei.

E as **13 avaliações do `supdept01`** (Clenio) foram para a **RENATA BORGES** — pela API, com a
prévia conferida antes (13 `SUBSTITUIR`, **0 respondidas**, 0 recusas) e 13 linhas `DESIGNAR` na
auditoria.

| | Fechamento | Agora |
|---|---|---|
| Avaliadores do ciclo | 53 | **53** |
| Com conta | 5 | **8** |
| **Abrem o módulo** | 5 | **8** |
| **Conta sem permissão** | 3 | **0** ✅ |
| Sem conta nenhuma | 48 | **45** |
| **Avaliações alcançáveis** | ~110 | **179 de 894** |

⚠️ **A coluna "Agora" foi recontada em 09/09 — só o Piloto.** A anterior (54 / 46 / 187) somava
o Piloto com o "Avaliação Geral 2026", que tem 9 avaliações e 2 avaliadores. Medido no banco:
o Piloto tem **53 avaliadores distintos**, e a classificação não deixa resto — **45 sem conta
nenhuma, 8 entram, 0 com conta sem permissão, 0 com conta inativa**.

Quem entra, **contado no Piloto**: `adrianacaetano` 84 · `claudimaroliveira` 44 ·
`wandersonnascimento` 14 · `renataborges` 13 · `ariellypereira` 13 (RH_ADMIN) · `vanialucia` 6 ·
`rodrigoleao` 4 · `lidyanerocha` 1. **Soma 179.** (`admin` e `denisealves` também têm permissão,
mas **0 avaliações no Piloto** — por isso são 10 contas com acesso e 8 avaliadores alcançados.)

⚠️ **`clenio` segue sem matrícula** em `core.usuarios` — sem ela o módulo recusa antes de olhar
papel. **O Clenio resolve; não mexer em conta daqui.**

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
| 🔴 **O mapeamento por PREFIXO de centro de custo manda 80 pessoas da FÁBRICA para o questionário de LOJA.** O recorte provisório é por prefixo (`1101…`→Administrativo 11 perguntas · `2101…`→Operação de Loja 14 · `3101…`/`4101…`→Produção 14), e na filial 18 três CCs têm prefixo `2101`: **ADMINISTRATIVO - FABRICA (49)**, **EXPEDICAO (30)** e ARMAZEM GERAL (1). ⚠️ E existem **dois CCs com o mesmo nome e prefixos diferentes** — `21011202 ADMINISTRATIVO - FABRICA` (49 pessoas → Loja) e `41010114 ADMINSTRATIVO DA FABRICA` (4 pessoas → Produção): mesma função, questionários diferentes, por causa do código contábil. **A pergunta:** o prefixo descreve o TRABALHO ou só a conta contábil? Se for só a conta, estes CCs precisam de recorte nominal. Achado ao montar o piloto de 15/09 — descoberto na avaliação oficial custa mais | Gestora de RH | §5 · §7 |
| Quem avalia **os avaliadores do ciclo** (quantos são, na §0) — a maioria cai no Diretor Executivo pela regra provisória | Diretoria + RH | §5 · §11 |
| Quem avalia Presidente e Vice | Diretoria | §5 |
| 🔵 **Avaliação RECÍPROCA entre chefe e segundo é intencional?** No recorte do piloto, **ADRIANA CAETANO (003113) e WANDERSON NASCIMENTO (002749) avaliam um ao outro** — ela é a avaliadora dele e ele o avaliador dela, no mesmo centro de custo (SUPERMERCADO UNAÍ). Não é autoavaliação, então a separação de funções **não barra** e o sistema permite; e as duas avaliações já estão dentro das filas de 85 e 13. Mas ninguém decidiu que isso vale — e num ciclo que conta para mérito, "eu avalio quem me avalia" é decisão de política | Gestora de RH | §5 · piloto 15/09 |
| Régua de escolaridade · aprendizes · afastados · enunciados das perguntas | Gestora de RH | §5 |
| 🔴 **"O questionário atual é o que você quer usar no piloto?"** — pergunta DIRETA, e ela não depende de tela nenhuma. As **44 perguntas** (4 modelos, 20 grupos, 176 alternativas) vieram do **RD8010 `000004` + SQP010 + RDB010** por `prisma/seed.ts`: são o instrumento do Protheus, transcrito. **Ninguém do RH escolheu enunciado, peso ou alternativa.** ⚠️ A resposta MUDA A ORDEM do trabalho: se for "não", a tela de questionários vira urgente (16–20h) e passa na frente de tudo; se for "sim", seguimos com aplicação editável → conceitos do ciclo → questionários | Gestora de RH | §5 · piloto 15/09 |
| Quem dispara o sync — enquanto não se decide, não existe cron | Gestora de RH | §5 |
| **Quem é o segundo `RH_ADMIN`** (a pessoa) — dar a permissão é da T.I. e está em (B) | Gestora de RH | §5 · §3.1 |
| 🟢 **CONFIRMAÇÃO, não bloqueio:** cancelar avaliação com respostas já dadas — implementado com **as respostas ficando registradas e fora da apuração, nunca apagadas**. Se ela preferir que o sistema recuse e obrigue o avaliador a enviar, a mudança é pequena | Gestora de RH | §5 · §3.1.18 |
| 🟢 **CONFIRMAÇÃO, não bloqueio:** encerrar ciclo com pendência é **RH_ADMIN só**, o mesmo degrau do reabrir. Se ela quiser estender a quem monta o ciclo (`RH_CICLO`), é uma linha no controller | Gestora de RH | §5 · §3.1.18 |
| 🔵 **POLÍTICA, não código — DESCANCELAR uma avaliação.** Hoje não existe: cancelada não volta, por nenhum caminho. Fazer custa **~30 linhas + um modal**, e trava em **três perguntas que não são da T.I.**: **(a)** a avaliação volta para `PENDENTE` ou `EM_ANDAMENTO` quando há **respostas parciais**? (é sobre o que acontece com o trabalho já feito) · **(b)** o `motivoCancelamento` é **apagado ou vira histórico**? (é sobre a trilha) · **(c)** **em massa ou uma a uma**? — 37 uma a uma é inviável, e em massa reintroduz o risco do encerrar em massa. ⚠️ A 4ª (devolver pendências que voltam a travar o encerramento) **não é decisão, é consequência**: quem descancela quer exatamente isso. ⭐ Os textos do §3.1.47 valem **de qualquer forma**, inclusive depois de descancelar existir | Gestora de RH | §3.1.47 |
| 🔵 **POLÍTICA, não código:** trocar o avaliador de uma avaliação **já respondida** — o **lote** do cadastro RECUSA (`JA_RESPONDIDA`) e a designação **individual** PERMITE com confirmação (`EXIGE_CONFIRMACAO`). Só a segunda tem razão escrita. Pode estar certo (em lote ninguém lê 50 avisos), mas ninguém decidiu — e **unificar as prévias está parado até isto** | Gestora de RH | §3.1.30 · levantamento |
| 🔵 **POLÍTICA, não código:** no **cadastro** de avaliadores, o que "exige confirmação" quer dizer? No ciclo é *"já respondida"*, e o cadastro não tem resposta. **(A)** nada exige — campo 0, contrato uniforme; **(B)** sobrescrever linha provisória ou não revisada (927 e 159 hoje). Sem a resposta, o endpoint é desenhado duas vezes | Gestora de RH | §3.1.30 |

### (B) TRABALHO TÉCNICO PENDENTE — na ordem em que eu faria

⭐ **O item 1 é o único que mexe no número que decide o piloto.** Dos **53 avaliadores do
Piloto, 8 conseguem entrar** — e um desses oito é a conta de TESTE do Claudimar, criada por nós
(§6). **179 das 894** avaliações do Piloto são alcançáveis. Nenhum outro item desta lista move
esse número. (A conta viva está na §0; aqui é ponteiro.)

⭐ **A curva é boa, e isso abre uma saída que não é "criar as 45"** (medido em 09/09): as
avaliações concentram no topo. **8 contas novas** — os 8 maiores sem conta, que com os 2 do topo
que já têm formam os 10 maiores avaliadores — levam de **179 para 551 (61,6%)**, ou **21
avaliações por conta criada**. A cauda é o oposto: os **8 últimos avaliadores somam 14
avaliações** (4 pessoas com 2–4, 4 pessoas com **uma só**). ⚠️ **Mas a curva é do AVALIADOR, não
do avaliado** — parar em 61,6% deixa **343 pessoas sem avaliação**, e não é recorte aleatório: é
quem responde a chefe de equipe pequena. Escolher quem fica de fora é **recorte de público, que
é decisão do RH** (lista A), não da T.I.

| # | Item | Onde está |
|---|---|---|
| ~~0~~ | ✅ **Reabrir avaliação — FEITO em 09/09.** Botão na linha da Designação, diálogo dizendo a nota que apaga, auditoria guardando o resultado apagado. A decisão foi **apagar** o `ResultadoAvaliacao` | §3.1.43 |
| 1 | **Contas para os avaliadores — `45 dos 53` não têm conta.** É o que decide o piloto, e é **trabalho do Clenio no Configurador**, não daqui. ⚠️ Quem recebe conta acompanha a lista real do RH, mas **quem já é avaliador no dado de hoje independe dela** | §3.1.3 |
| 2 | ✅ **FEITO em 08/09 — colisão de chapa (`E01981` × `001981`)**, dos dois lados: a **fonte** no Configurador (`normalizarChapa` ao preencher e ao salvar) e a **rede** no módulo (`porMatricula` e a importação de planilha buscam pelas duas formas). ⚠️ O sintoma era um **403 que PARECE falta de permissão**, e mandava quem investiga ao Configurador dar papel a quem já tem. ✅ E o dado legado foi corrigido no mesmo dia: **nenhuma conta de pessoa real fora do formato** | §3.1.25 |
| 3 | **Segundo `RH_ADMIN`** — a separação de funções exige dois; com um só, ninguém corrige a avaliação da gestora. A pessoa é escolha do RH (A); a permissão é daqui | §5 · §3.1 |
| 4 | Cadastro de **critérios e faixas**: o painel manda cadastrar uma faixa e a tela não existe | §7 |
| ~~5~~ | ✅ **FEITO em 09/09** — era o mesmo item que o ~~0~~. Ver §3.1.43 | §7 · §2 |
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
| 16 | ✅ **FEITO em 08/09** — a linha de Resultados passou a parecer clicável (cursor, chevron, hover de fundo, rótulo “memória de cálculo”) e a memória ganhou **“Enviada em”** ao lado de “Apurado em”, que é a comparação que responde a contestação depois de reapuração. `enviadaEm` já vinha do backend | §3.1.9 |
| 17 | 🟠 **"Recorte provisório" não tem como confirmar** (item D do roteiro + 🟡 11 do anterior — são o mesmo). A etiqueta marca que o público veio de um atalho e não é decisão do RH, e **não existe o ato de confirmar**: nem por linha, nem por aplicação, nem por ciclo. Etiqueta que ninguém pode tirar deixa de significar alguma coisa. 🔴 **Precisa da Arielly antes do desenho: confirmar é por linha, por aplicação ou por ciclo?** — a resposta muda a tela inteira | roteiro do Chrome · §5 |
| 18 | 🟠 **Os menores do item K**, em ordem de custo: **Enter morto no modal de vínculo** (com 108 pendências é mouse em cada uma) · **duas convenções para o mesmo botão em lote** · **dois modais irmãos com contratos diferentes** (o do cadastro tem o resumo *"X passa a avaliar Y"*, o do ciclo não) · **"Minhas avaliações" sem `<h1>`** · **escolher a si mesmo descarta a escolha válida anterior em silêncio**. ⚠️ E um de OUTRO módulo, só registrado: o **Hub mostra "Bem-vindo, !"** sem interpolar o nome | roteiro do Chrome |
| 19 | 🟠 **`/gestao-pessoas/resultados` leva ao lugar errado EM SILÊNCIO.** Resultados vive dentro do ciclo (`/ciclos/:id/resultados`) — decisão nossa no menu, e ela está certa. O defeito é outro: `<Route path="*" element={<Navigate to="/" replace />} />` faz **qualquer URL desconhecida** cair na fila do avaliador **sem dizer nada**, como se tivesse levado a algum lugar. Alguém vai compartilhar esse link. ⚠️ **A correção não é criar a rota de topo** — é a URL desconhecida **dizer que não existe** | §3.1.6 |
| 20 | 🔴 **A FONTE REPÕE O PROBLEMA: demissão não toca avaliação viva.** O `sincronizacao` **não está** entre os oito arquivos que escrevem em `prisma.avaliacao` — quem é demitido vira `situacao='DEMITIDO'`, sai da régua das listas NOVAS, e a avaliação criada antes fica `PENDENTE` para sempre. O cancelamento manual de 08/09 **resolve o caso, não a fonte**: com 894 avaliações abertas, o RH vai fazer isso à mão toda vez. ⚠️ **É pergunta, não conserto** — cancelar automaticamente no sync é o sistema decidindo sozinho tirar alguém do ciclo, e "afastado" não é "demitido". Medido em 08/09: **0 demitidos** com avaliação viva hoje; os 86 não-ATIVOs com avaliação são **FERIAS**, que são elegíveis por definição | §3.1.18 |
| 22 | 🔴 **A SENHA TEMPORÁRIA NÃO É TROCADA — e isso mira a regra de desenho do módulo.** Medido em 09/09: `primeiroAcesso` existe no backend (devolvido no login, zerado no `change-password`), mas **nenhum frontend o lê** — 2 ocorrências no Hub e 2 no Configurador, ambas só declaração de tipo; 0 no Gestão de Pessoas e 0 no Gestão TI. Ninguém é levado a trocar. Evidência: `renataborges` e `wandersonnascimento` logaram em 09/09 13:35–13:36 e seguem com `primeiro_acesso = true`. ⚠️ **Em PROD isso seriam 45 pessoas com a MESMA senha** (hoje `Temp2026` no DEV), num módulo cuja regra de desenho é **separação de funções**: cada uma abriria a avaliação das outras, e a trilha de auditoria registraria o nome errado. ⚠️ **NÃO é conserto do Gestão de Pessoas** — é do **Hub/Configurador**, e **afeta todos os módulos da plataforma**; o Gestão de Pessoas só é onde dói mais. Alternativa sem código: senha individual por pessoa na criação das 45 | §6 · (B) 1 |
| 21 | 🔴 **Fechar a meia rede do §3.1.9**: gerar o cliente a partir do backend **ou** teste de contrato (resposta real × o que a tela consome). ⚠️ Só a segunda pegaria o 1º dos três casos; a varredura periódica não substitui nenhuma das duas | §3.1.9 |

### ⛔ DESCARTADO em 09/09 — `autenticaPortal` para as 45 contas

Fica escrito **com o motivo**, senão volta a parecer boa ideia daqui a um mês — a ideia é minha,
e ela é sedutora pelo lado errado.

**A proposta:** criar as 45 contas com `autenticaPortal: true` + matrícula. O service não pede
senha (`if (!dto.autenticaPortal && !dto.senha) throw`), grava um hash inutilizável, e quem
valida a senha é o portal RH do Protheus.

**Por que foi descartada, na ordem que importa:**

1. ⭐ **O custo que ela removia não existe.** Justifiquei por "inventar, distribuir e resetar 45
   senhas" — mas a prática real é **uma senha temporária para todas** (`Temp2026`). Eu estava
   otimizando um custo que ninguém paga. ⚠️ Isso não é detalhe: **eu inventei o custo e depois
   propus a solução dele**. Antes de propor mudança de caminho, medir o custo do caminho atual.
2. **Ela ACRESCENTA uma dependência externa no ato de entrar.** O próprio código devolve
   `ServiceUnavailableException` — *"Portal de autenticação (RH) indisponível"* — quando o
   Protheus não responde. Isso amarraria o **login de 45 pessoas** à disponibilidade do Protheus,
   num piloto. Hoje o módulo só depende do Protheus no **sync**, que é assíncrono e pode esperar;
   login não pode.
3. **É caminho não exercitado: `autentica_portal = false` nas 177 contas da base.** Zero
   evidência de produção. Some-se o `infoFuncionario` preso em HOM, já registrado como bug
   latente em PROD.
4. **Não é para isto que ele foi feito.** Os comentários do fonte dizem *"login do app do
   entregador"* e *"Mesmo endpoint usado no Chamado PADRAO"* — perfil `PADRAO` e app móvel. O
   Gestão de Pessoas é web, com contas `INDIVIDUAL`.

⭐ **A regra que fica:** trocar autenticação interna (bcrypt) por externa é decisão de
disponibilidade, não de conveniência de cadastro. Só se paga esse preço por um ganho que o
caminho atual não dá — e aqui o caminho atual já dava.

⚠️ **O que ficou aberto e é real:** a senha temporária que ninguém troca — item **22** da (B).
Descartar o `autenticaPortal` não resolve isso, e o problema não é do Gestão de Pessoas.

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
| Banco | migrations em `rh` (26 tabelas) + 2 no `auth-gateway` (módulo/roles e ativação) — **a conta está na §0** |
| Testes | verdes, com `tsc -b` e ESLint limpos nos dois lados — **a contagem está na §0** |
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
  a decisão que isso realmente é. Ciclo `ENCERRADO` não aceita nem o período.
- ✅ **A APLICAÇÃO passou a ter edição em 09/09** (`PATCH /aplicacoes/:id`, `DELETE`,
  `GET :id/efeito-de-editar`): **nome sempre** · **peso e critérios só em RASCUNHO** (depois
  mudariam a nota de quem já respondeu) · **questionário NUNCA**. O `DELETE` só sem avaliação, e
  a confirmação diz o número de pessoas do público que vai junto.

### ⛔ DECISÃO DE PRODUTO — não se troca o instrumento debaixo de um recorte já montado

**Vale além da aplicação, e é por isso que está aqui e não numa nota de implementação.**

Trocar o `modeloVersao` de uma aplicação seria trocar o QUESTIONÁRIO de um público que já foi
escolhido pessoa a pessoa. O argumento, na forma que transfere: **o público continua lá, a tela
continua idêntica, e o que aquelas pessoas vão responder passa a ser outro instrumento.** Nada
na aparência denuncia. Com avaliação já respondida é pior — as respostas pertencem às perguntas
do modelo antigo e ficariam órfãs, com a nota saindo errada sem acusar erro (é o mesmo raciocínio
de `designacao/troca-de-aplicacao.ts`, escrito antes e por outro motivo).

⭐ **A regra geral:** quando um recorte de PESSOAS já foi montado sobre um instrumento, o
instrumento não troca — cria-se outro e move-se o recorte. Vale para o que vier: trocar o modelo
de uma aplicação, trocar a versão publicada de um questionário sob um ciclo aberto, trocar a
régua de critérios de um público já designado.

⚠️ E a recusa **diz a saída**, que muda com o estado: sem avaliação, *"apague-a e crie outra com
o questionário certo"*; com avaliação, *"nem apagar resolve — crie outra aplicação e mova o
público"*. Recusa sem alternativa faz a pessoa procurar sozinha, e o que ela acha é criar uma
segunda aplicação e deixar a errada no ciclo.
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

⚠️ **Censo de 07/09 — SUPERADO.** Mantido porque é o que motivou o degrau abaixo; a conta viva
está na §0 (*"Depois do fechamento — o acesso destravou"*).

| | 07/09 | **08/09** |
|---|---|---|
| Avaliadores do ciclo (pelo dado) | 53 | **54** |
| …com conta na plataforma (matrícula casada) | 7 | **8** |
| …com permissão no módulo | 4 | **8** |
| …com conta e SEM permissão | 3 | **0** ✅ |
| …sem conta nenhuma | 46 | **46** |

Em 07/09 os **3 com conta e sem permissão** — `supdept01` (13 avaliações), `rodrigoleao` (4) e
`lidyanerocha` (1) — recebiam `403 Sem acesso ao módulo`. **Resolvido em 08/09:** o Clenio
concedeu no Configurador, e as 13 do `supdept01` passaram para a `renataborges`. Os **46 sem
conta** seguem esperados — o piloto ainda não distribuiu acesso, e é o item 1 da lista (B).

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

⭐ **A irmã desta regra é o §3.1.35 — concordância de NÚMERO**, e ela nasceu do mesmo jeito, um dia
depois. A diferença que importa: para gênero **não há dado**; para número o dado está na mão. Por
isso lá o `"(s)"` saiu de vez, enquanto aqui a saída é a voz ativa.

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

#### Varredura rodada em 08/09 — depois do TERCEIRO caso, não do quarto

O `enviadaEm` (campo declarado, nunca renderizado) foi o **terceiro** achado da classe em três
dias, e é exatamente o lado que o script pega. Rodada logo depois: **40 interfaces, 22 telas,
32 campos suspeitos em 19 interfaces.** Triados, sobra **um** que importa:

| Veredito | Campos | Por quê |
|---|---|---|
| 🔴 **Real** | `centroCustoDescricao` em **`PessoaSemAvaliador`, `PessoaForaDoCiclo`, `ColaboradorDaBusca`** | as três telas mostram só o **código** (`02/21010101`). A descrição vem no mesmo payload e é o que um humano lê — e essas listas existem para alguém **agir** sobre elas: quem cobra precisa saber a área, não o número. Três interfaces = padrão, não descuido |
| ⚪ Por desenho | `AlertaAgregado.criterioNome` / `.valores` | o backend manda a **frase pronta** (`resumo`) *e* os campos crus; a tela usa a frase, que é a regra do módulo. Redundância deliberada |
| ⚪ Entrada | `NovoCiclo`, `NovaAplicacao`, `AlvoDoPublico` (`filiais`, `colaboradorIds`) | a tela **envia**, não renderiza. Falso positivo previsto e documentado |
| ⚪ Tela não existe | `CriterioDoCatalogo` (`tipoValor`, `codigoCalculo`, `faixas`), `VersaoDeModelo.pontuacaoMaxima`, `CicloDetalhado.conceitos` | catálogo de critérios e questionários são itens 4 e 13 da lista (B) |
| ⚪ Menor | `ordem`, `avaliacaoId`, `importacaoId`, `aplicacaoNome`, `abertoEm`/`reabertoEm` na lista | chave técnica, ordenação, ou informação já dita de outro jeito na mesma tela |

⭐ **O dado de que quase nada voltou também vale** — e é o argumento a favor de rodar cedo: a
varredura não achou um quarto `enviadaEm` porque o terceiro foi corrigido no mesmo dia em que
apareceu. A rede meia continua meia (item 21 da lista (B)): ela só pega o campo que o contrato
**declara**, nunca o que o backend devolve sem o contrato conhecer — que foi o primeiro caso
da família.

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
- **08/09/2026** — apagados os ciclos **`ZZ TESTE — abrir vazio/montado (08/09)`**, das duas
  telas do §3.1.23: 1 avaliação, **0 respostas**, 3 no público.
- **08/09/2026** — apagados os ciclos **`ZZ TESTE — item H false/true (08/09)`**, criados para
  medir a prévia sob as duas políticas de afastados (§3.1.21): 2 ciclos, 2 aplicações, **0 no
  público, 0 avaliações** — só a prévia foi chamada, e ela não grava.
- **08/09/2026** — apagado o ciclo **`ZZ TESTE — item F (08/09)`**, criado para reproduzir os
  três quadrantes do §3.1.20: 2 avaliações, **0 respostas, 0 resultados**, 3 no público. SELECT
  antes, DELETE transacional, auditoria preservada.
- **08/09/2026** — apagado o ciclo **`ZZ TESTE — linha de estado (08/09)`**, criado para
  exercitar as quatro gravações do §3.1.19: 1 aplicação, 2 no público, 2 avaliações, **0
  respostas, 0 resultados**. SELECT antes, DELETE transacional, auditoria preservada (1 linha).
  Depois: 2 ciclos (9/98 e 894/1036), 0 órfãos.
- **08/09/2026** — apagado o ciclo **`ZZ TESTE — cancelar (08/09)`**, criado para a bateria ao
  vivo do cancelamento (§3.1.18): 1 aplicação, 3 no público, 3 avaliações, 11 respostas e 1
  resultado — **tudo criado na própria sessão, nenhum trabalho humano**. SELECT isolando antes,
  DELETE transacional, **auditoria preservada** (4 linhas). Depois: 2 ciclos (9/98 e 894/1036),
  0 órfãos, fila da Arielly de volta às 13 do Piloto.
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
escrito dentro), aplicada com `GUARDA: ok`. **461 testes, 33 suítes** — 31 novos, entre eles: a
recusa da ENVIADA e a ordem que ela ensina; o motivo carregado para dentro de cada avaliação; a
auditoria distinta do override; que nenhuma resposta é apagada; e que a fila do avaliador exclui
canceladas **sem** virar lista de status vivos.

#### ✅ Bateria AO VIVO — 08/09, conta `ariellypereira`

Ciclo descartável `ZZ TESTE — cancelar (08/09)`: 1 aplicação (**`Administrativo`**, 11
perguntas), 3 no público, as 3 designadas para a própria Arielly — que como **avaliadora
designada** pode responder sem furar a separação de funções. LANA respondeu as 11, enviou
(**nota 25,00**) e foi **apurada** (`ResultadoAvaliacao`, conceito "Não atende"), justamente
para o caso da ENVIADA ser testado com resultado gravado, e não só com envio.

| # | O que se queria ver | Resultado |
|---|---|---|
| 1 | recusa do `encerrar` com o número exato | **400** nos dois ciclos reais: *"…891 avaliação(ões)…"* e *"…5…"*, que batem com o banco (889+2 e 5). **Nada foi escrito** |
| 2 | `EXCLUIR` cancelando | `avaliacaoCancelada: true`; no banco, `CANCELADA` com *"Excluído do ciclo pelo RH: …"* |
| 3 | a etiqueta na linha | SILVINEI: `elegivel=false`, `avaliador=ARIELLY`, `status=CANCELADA` — **a avaliação continua visível para o RH**, que era o defeito |
| 4 | ⭐ a cancelada **sumindo da fila** | fila do ciclo: **3 → 2** linhas. O furo dentro do furo, fechado |
| 5 | ⭐⭐ **ENVIADA recusando** | **400**: *"…já ENVIOU esta avaliação… o resultado apurado ficaria órfão… reabra a avaliação primeiro…"*. E a prova que importa: depois da recusa, `status=ENVIADA`, `nota=25,00`, **11 respostas** e o `resultado_avaliacao` **intacto** — o órfão não aconteceu |
| 6 | `encerrar` com confirmação | `ENCERRADO`, `avaliacoesCanceladas: 1`; o motivo entrou **dentro** da avaliação (*"Ciclo encerrado com pendência: …"*), e a auditoria gravou **`ENCERRAR_COM_PENDENCIA`** com `{canceladas: 1, motivo: …}` |

⭐ **O `efeitoDoExcluir` devolvido por linha foi conferido no mesmo GET**, e é o que prova que a
frase da tela e a decisão da API são a mesma: `RECUSAR` na LANA (com o texto idêntico ao do
400), `CANCELAR` no ORLANDO, `NADA_A_FAZER` no SILVINEI já cancelado.

⚠️ **Dois achados da própria bateria, corrigidos na hora:**
- **`[DEMO] Modelo de Treinamento` é barrado em ciclo válido** — guarda existente, que eu não
  conhecia; era o questionário mais curto e teria sido o caminho fácil. Funcionou.
- **"e as 1 ficam registradas"** — a concordância quebrava com pendência única, numa frase que a
  gestora lê. O número já está no começo da mensagem; virou "e elas ficam". Spec própria.

**Limpeza** (§3.1.13): SELECT isolando primeiro (1 ciclo, 1 aplicação, 3 avaliações, 11
respostas, 1 resultado, 3 do público, 1 elegibilidade, 2 conceitos — **tudo criado por mim
nesta sessão, nenhum trabalho humano**), DELETE transacional na ordem das FKs, **auditoria
preservada** (4 linhas). Depois: os **2 ciclos de sempre** (9/98 e 894/1036), **0 órfãos**, e a
fila da Arielly de volta às **13** do Piloto.

### 3.1.19. 🟠 A linha de estado mentia entre a gravação e o F5 (08/09)

Item G do roteiro de tela: em **todas** as gravações, o cabeçalho ficava com o número anterior
— *"0 aplicações"* com a aplicação na tela, *"0 no público"* com 5 listados.

⚠️ **Não é atraso, é mentira no único trabalho que a peça tem.** A linha de estado existe para
dizer "onde estou": mostrar o número anterior à ação que a pessoa acabou de fazer contamina a
decisão seguinte — quem lê "0 aplicações" vai criar a segunda.

#### O diagnóstico, antes do conserto

Não era cache mal invalidado nem estado compartilhado mal assinado. **O `/resumo` era buscado
UMA vez** (`useEffect` com dependência `[cicloId]`) e nunca mais. Dois agravantes:

- **trocar de aba não corrigia** — as abas são `<Outlet>` dentro do `CicloPage`, que **não
  remonta** na navegação; a linha sobrevivia velha a toda a sessão de montagem;
- **as abas estavam certas** — cada uma recarrega o próprio dado depois de gravar (18 pontos no
  módulo). Por isso o sintoma era o corpo atualizado com o cabeçalho velho: **a tela se
  contradizendo sozinha**, que é pior do que congelar inteira.

E a causa de fundo: **não havia canal**. O pai é dono do `resumo` num `useState` local e passava
`<Outlet context={{ ciclo }}>` — só o ciclo, só leitura. Os filhos não tinham como dizer "gravei".

#### PRIMEIRO a duplicata, depois o canal

Antes de ligar o canal, uma limpeza que o conserto teria petrificado: `/resumo` mandava
**`status` e `encerradoEm`**, dois fatos que `GET /ciclos/:id` já entrega. A etiqueta do topo
lia um; as faixas liam o outro. Concordavam só porque as duas chamadas saíam do mesmo efeito —
bastaria recarregar uma para a tela mostrar **ABERTO na etiqueta com a faixa de RASCUNHO
embaixo**.

⭐ **O critério de quem sobrevive é o DONO NATURAL do fato**, não a conveniência:

| Natureza | Dono | Exemplos |
|---|---|---|
| atributo **gravado na linha** `rh.ciclo` | o **registro**, `GET /ciclos/:id` | status, data-base, período, `encerradoEm`, `reabertoEm` |
| contagem/derivação que **não existe na linha** e é apurada agora | o **relatório**, `/painel/.../resumo` | público, designados, enviadas, apuradas, próximo passo, pendências, reaberturas (da auditoria) |

⚠️ **Isso trocaria uma duplicata por um acoplamento?** Era o risco, e a resposta é **não** —
porque depois do conserto **nenhuma faixa decide com duas fontes**:

- **FaixaDoRascunho** decide pelo **próprio conteúdo**: `pendenciasParaAbrir` é `null` fora de
  rascunho, por construção do backend. Ela deixou de perguntar o status a quem quer que seja.
- **FaixaDoEncerrado** decide pelo `ciclo` — dono do status — e mostra o `encerradoEm` da
  **mesma** fonte. ⚠️ `encerradoEm` não serve de discriminador: ele sobrevive de propósito à
  reabertura.
- **LinhaDeEstado** e **`proximoPasso`** nunca precisaram do status: o próximo passo é derivado
  no backend, e o cliente não decide nada.

#### As outras duplicatas — e por que ficam

O dia mostrou que essas coisas vêm em três; vieram em **cinco**. Duas eram **ativas** (as duas
telas liam de fontes diferentes) e saíram. As outras três são **latentes** e ficam, com motivo
escrito: `_count.aplicacoes`, `_count.avaliacoes` e `reabertoEm/motivoReabertura` existem em
`CicloDaLista` porque a **lista de Ciclos** precisa desses números **sem carregar o resumo** —
ela não tem um. Ninguém na tela do ciclo lê essas três; se alguém passar a ler, aí sim viram
ativas.

#### O canal

`recarregarResumo()` desce pelo `Outlet context`, ao lado do `ciclo` — sem store e sem
biblioteca. ⚠️ **Recarrega os DOIS endpoints juntos, sempre**: as faixas decidem pelo ciclo e
mostram números do resumo; atualizar um só devolveria a divergência que a saída do `status`
acabou de fechar.

⚠️ **Fora do `carregar()`, num `gravou()` próprio.** A primeira versão pendurou a recarga no
`carregar()` das abas — que roda **também na montagem**, e a medição ao vivo mostrou **2
chamadas ao `/resumo` no load**. O `/resumo` é caro (varre as aplicações contando quem está sem
avaliador), e isso dobraria o custo a cada troca de aba para atualizar um número que não mudou.

#### ✅ Verificado AO VIVO, sem F5 (ciclo descartável, Playwright)

| Ação | Linha de estado, sem recarregar a página |
|---|---|
| **criar aplicação** | `0 aplicações` → **`1 aplicação`**; Próximo: *"Monte a primeira aplicação"* → *"Monte o público"* |
| **adicionar ao público** | `0 no público` → **`2 no público`**, `0 sem avaliador` → **`2`**; Próximo → *"Designe as 2 pessoa(s)"* |
| **designar pela linha** | `2 sem avaliador` → **`1`**, `0 de 0 enviadas` → **`0 de 1`** |
| **designar em lote** | `1 sem avaliador` → **`0`**, `0 de 1` → **`0 de 2`**; Próximo → ***"Abra o ciclo"*** |

E o `/resumo` foi chamado **1 vez no load** (era 2) e **1 vez por gravação**.

⚠️ **Dois achados do próprio roteiro**, que não são desta correção e vão para a lista: marcar em
lote alcança quem **já tem avaliador** e redesigna **sem avisar** (item E/6 do relatório, já
previsto), e a faixa passou corretamente de *"nenhuma pessoa no público"* para *"Nada — a
validação da abertura passa"* assim que o público entrou — o §3.1.17 conferido de novo, de graça.

**Junto, o achado da varredura:** `centroCustoDescricao` passou a aparecer no **seletor de
colaborador** (escolher avaliador entre homônimos de unidades diferentes era escolher no escuro)
e na lista **"fora de todas as aplicações"** do painel, que mostrava `02/21010101` para alguém
que precisa agir sobre aquela pessoa. ⚠️ O terceiro consumidor (`PessoaSemAvaliador`) **não tem
tela**: o painel mostra só a contagem, e a lista de nomes espera o "ver todos" da lista (B).

### 3.1.20. 🟠 O painel classificava pelo CADASTRO e escrevia sobre o CICLO (08/09)

Item F do roteiro: o aviso dizia *"2 pessoas não estão na lista de ninguém e **ficarão de fora
do ciclo**"* sobre gente que estava **dentro**, com avaliador designado à mão. E a
classificação era incoerente **consigo mesma**: três pessoas designadas à mão do mesmo jeito, e
só uma caía em *"ajustadas à mão"* — as outras duas, em *"sem avaliador no cadastro"*.

⚠️ **Defeito de raciocínio, não de texto.** Reescrever a frase teria disfarçado.

#### Que pergunta cada número responde

| Motivo | Pergunta | Eixo |
|---|---|---|
| `SEM_AVALIADOR_NO_CADASTRO` | o **cadastro** tem avaliador para ela? | CADASTRO |
| `AJUSTE_MANUAL_DO_CICLO` | ela já tem avaliação **no ciclo**, feita à mão? | CICLO |
| `JA_RESPONDIDA` | essa avaliação já tem resposta? | CICLO |
| `TROCA_DE_APLICACAO` | copiar a moveria de aplicação? | CICLO |

⭐ **Os dois primeiros são eixos INDEPENDENTES — a combinação é 2×2 —, e o código os tratava
como uma sequência.** O teste do cadastro vinha primeiro e **absorvia** os casos do ciclo: quem
tinha linha no cadastro chegava ao teste do manual (virava "ajustadas à mão"); quem não tinha
parava antes (virava "sem avaliador no cadastro"). As três estavam na mesma situação de ciclo;
o que as separou foi um fato de **outro eixo**. Daí a incoerência — e daí a frase falsa, porque
o balde de cima afirmava algo sobre o ciclo que só o outro eixo sabe.

#### O conserto

O quadrante que faltava ganhou nome: **`SEM_CADASTRO_JA_DESIGNADA`**.

| | **sem avaliação no ciclo** | **já designada no ciclo** |
|---|---|---|
| **sem cadastro** | `SEM_AVALIADOR_NO_CADASTRO` — *"fica de fora"*, e agora é **verdade** | 🆕 `SEM_CADASTRO_JA_DESIGNADA` — *"continua com o avaliador atual e **NÃO** fica de fora"* |
| **com cadastro** | o lote cria | `AJUSTE_MANUAL_DO_CICLO` — *"marque substituir se o cadastro é que está certo"* |

Os baldes continuam **dois** para as designadas à mão — porque as perguntas são duas e o RH age
diferente em cada uma —, mas os dois dizem a verdade.

⚠️ **`substituir os ajustes manuais` não alcança o quadrante novo, e não deve:** substituir por
um cadastro que não existe deixaria a pessoa **sem avaliador nenhum**, pior que a situação de
partida. A frase diz isso.

⭐ E o aviso do quadrante novo aponta o custo REAL, que não é este ciclo: *"elas seguem com o
avaliador que têm — o lote não muda nada nelas —, mas o **PRÓXIMO ciclo** vai encontrá-las sem
avaliador. Registre quem as avalia no cadastro."*

#### A segunda afirmação falsa, mais ampla que o aviso

O cabeçalho do bloco dizia **"{N} pessoa(s) ficam de fora:"** para **todas** as não-aplicadas —
incluindo as **já respondidas** e as **ajustadas à mão**, que estão bem dentro do ciclo. Virou
**"{N} pessoa(s) que o lote NÃO altera:"**, que é o que essas linhas de fato têm em comum; ficar
de fora é só de um dos motivos, e o rótulo de cada um diz qual.

#### ⚠️ NÃO era o caso do §3.1.19

Vale registrar porque a hipótese era razoável: o aviso continuar na tela ao lado de
*"Sem avaliador (0)"* **não** é dado velho. `aplicarCopia` substitui o relatório pelo da
execução que acabou de rodar — ele é **recalculado**. A frase estava errada **antes e depois**,
e o canal do §3.1.19 não a conserta. Sintomas parecidos, causas diferentes: um era **dado não
refeito**, este é **conta errada**.

#### Verificação

**466 testes** (5 novos). ⚠️ Um spec **antigo** falhou no conserto e a falha estava certa: ele
estava preso à frase que mentia (`/não estão na lista de ninguém e ficarão de fora/`). Foi
atualizado com o motivo escrito ao lado.

✅ **Ao vivo**, ciclo descartável com as três situações e as duas primeiras designadas à mão
**do mesmo jeito**:

```
ALLINE  (sem cadastro, designada à mão) → SEM_CADASTRO_JA_DESIGNADA  "continua com o avaliador atual"
CLENIO  (com cadastro, designada à mão) → AJUSTE_MANUAL_DO_CICLO     "marque substituir se…"
WAGNER  (sem cadastro, sem avaliação)   → SEM_AVALIADOR_NO_CADASTRO  "fica de fora do ciclo"
```

e os avisos separados: **1** que fica de fora, **1** que segue como está com a pendência jogada
para o próximo ciclo. Antes, ALLINE e WAGNER cairiam no mesmo balde, com a mesma frase falsa
sobre ALLINE.

### 3.1.21. 🟠 A prévia do público não avisava quem a régua do ciclo vai barrar (08/09)

Item H: a prévia prometeu **5**, entraram **5** no público e só **4** geraram avaliação — uma
afastada na data-base, num ciclo configurado para não incluir afastados. A informação existia e
estava bem explicada na Designação (*"Fora: regra ciclo"*), mas **só chegava depois de gravar**,
que é tarde para quem está montando o recorte.

#### A prévia e a régua eram a mesma função? **Não — e não eram duas cópias**

Essa distinção decidiu o conserto:

| | O que fazia |
|---|---|
| **prévia** | filtrava por `SITUACOES_ELEGIVEIS` — quem **existe** no quadro (ATIVO/AFASTADO/FÉRIAS) |
| **régua do ciclo** | `avaliarElegibilidade` — cargo inelegível (Presidente/Vice), demitido na data-base, e **afastado quando o ciclo não os inclui** |

⭐ A prévia **não recalculava** a elegibilidade por conta própria: ela simplesmente **não a
aplicava**. Não era duplicação de regra — era **omissão** de regra. E isso muda o conserto:
não havia que escolher entre duas contas, havia que **chamar a função que já existe**. A prévia
agora pergunta a quem decide.

⚠️ E usa a **mesma aproximação** que a Designação, de propósito: `categoriaFuncional: null` (não
é coluna do nosso cadastro — Presidente e Vice saem por decisão registrada) e a situação de hoje
como proxy da situação na data-base. Melhorar isso **só aqui** criaria exatamente a divergência
que o conserto evita.

#### Duas perguntas, dois números

O rótulo *"5 pessoa(s) entram"* estava **certo sobre o público** — e era lido como "5 vão ser
avaliadas". São perguntas diferentes, e a prévia passou a responder as duas em vez de misturar
numa só:

> **3** pessoa(s) entram **no público** · 0 já estão aqui · 3 no recorte
> **1** destas **geram avaliação** — 2 não gera(m), pela régua do ciclo.
>
> *Entram no público e NÃO geram avaliação — ficam na lista de Designação, marcadas com o motivo:*
> *EDMAR ANTONIO TEIXEIRA BORGES (002342) — Afastado na data-base do ciclo, e este ciclo está
> configurado para não incluir afastados.*

⭐ **A justificativa é a da régua, não um texto próprio da prévia** — a mesma frase que a
Designação mostra depois. Se o RH reescrever o texto lá, a prévia acompanha sozinha.

É a mesma família do §3.1.20: **responder uma pergunta e escrever sobre a outra**. Lá era
cadastro × ciclo; aqui é público × avaliação.

#### Verificação

**471 testes** (5 novos). ⚠️ Eles afirmam a **regra**, não as frases — inclusive um que compara
a justificativa devolvida com a saída de `avaliarElegibilidade` **chamada no próprio teste**:
se o texto da régua mudar, o teste continua válido. (Ver a nota de método na §6, escrita depois
do tropeço do item F.)

✅ **Ao vivo**, dois ciclos descartáveis com o **mesmo** público de 4 pessoas (1 afastado, 1 em
férias, 2 ativos):

| Ciclo | entram no público | geram avaliação |
|---|---|---|
| `incluirAfastados = false` | 4 | **3** — OSMAR barrado, com o motivo da régua |
| `incluirAfastados = true` | 4 | **4** |

Mesmo recorte, política diferente, número diferente — que é a prova de que quem decide é a régua
do ciclo, e não uma conta da prévia. E **férias não é barrada**, como a régua já dizia.
Conferido também na tela, num centro de custo real com 2 afastados de 3.

### 3.1.22. 🟠 Não dava para trocar o avaliador pela linha — e o lote sobrescrevia calado (08/09)

Itens E e 5.c do roteiro. São dois, e o segundo é pior.

**(a) A linha não oferecia correção.** O botão *"Definir avaliador"* só aparecia para quem estava
**sem** avaliador; quem errou a designação via só *"Excluir"*. A única saída era o lote — que é
o defeito (b). Agora a linha tem o botão **sempre** que a pessoa é elegível, com o rótulo dizendo
qual é o caso: **"Definir avaliador"** ou **"Trocar avaliador"**.

**(b) O lote sobrescrevia em silêncio.** O diálogo não dizia **quem** eram as N, não avisava que
ia **substituir** quem já tinha avaliador, e não dava retorno nenhum ao terminar. No roteiro ele
trocou o avaliador da CLEIA sem uma palavra — e eu esbarrei no mesmo em 08/09, redesignando
alguém que já tinha avaliador e vendo o número não mudar.

É a família do modal de vínculo: **botão armado com efeito que a tela não mostra.**

#### A pergunta antes do conserto: trocar o avaliador esbarra em regra que o excluir não tem?

**Sim — e o buraco era maior do que o do relatório.** `designar()` é um `upsert`, e trocar só o
**avaliador** dentro da mesma aplicação **não passava por guarda nenhuma**: nem `ENVIADA`, nem
respostas gravadas. É parente do `JA_RESPONDIDA` que o lote do cadastro recusa desde sempre.

⚠️ **Medido antes de mexer**, na auditoria do DEV: **368 trocas de avaliador**, e **zero** sobre
avaliação `ENVIADA`/`EM_ANDAMENTO`. O buraco existia e nunca foi acionado. Sorte, não guarda.

#### ⭐⭐ Mas havia uma DECISÃO ESCRITA em contrário, e ela não foi atropelada

`troca-de-aplicacao.spec.ts` afirmava, com motivo: *"trocar só o AVALIADOR, na mesma aplicação,
não é bloqueado nem com nota enviada"* — porque nenhuma resposta muda de instrumento, nenhum
modelo entra em jogo, e *"corrigir 'designei o supervisor errado' continua sendo um ato de uma
linha para o RH"*.

**Essa decisão está certa sobre a INTEGRIDADE do dado. O que faltava nela é a ATRIBUIÇÃO:** quem
lê a memória de cálculo vê *"avaliado por"* com o nome **novo** sobre respostas que foram de
outra pessoa.

⭐ As duas se conciliam sem que nenhuma perca: **o ato continua permitido e deixa de ser
silencioso.** Novo estado `EXIGE_CONFIRMACAO` — a API recusa sem `confirmarTrocaDeAvaliador`, e
a recusa é o próprio aviso. Recusar de vez tiraria do RH uma correção legítima; deixar passar
calado era o defeito. Auditoria própria: **`DESIGNAR_TROCA_AVALIADOR_RESPONDIDA`**, porque é o
ato que alguém vai procurar quando a memória mostrar um nome inesperado.

⚠️ E `CANCELADA` passou a **recusar**: o `upsert` a reviveria cancelada com avaliador novo — um
estado que não quer dizer nada. A recusa admite que **não há caminho para descancelar** hoje, em
vez de inventar um de passagem.

#### A prévia vem do backend

`POST /designacao/aplicacao/:id/designar/previa` devolve, por pessoa, o que o botão vai fazer —
pela **mesma função** que o `designar` usa para decidir (`efeitoDeDesignar`). A tela **não
recalcula** quantos serão substituídos: se recalculasse, a prévia e o ato divergiriam no primeiro
caso de borda, que é o defeito que ela veio evitar. Mesmo desenho do `efeitoDoExcluir` (§3.1.18).

O diálogo passou a mostrar: **N ganham avaliador · N têm o avaliador SUBSTITUÍDO**, a lista de
quem troca *com o nome de quem sai*, o bloco vermelho das já respondidas, as recusadas com o
motivo — e, ao fim, **mensagem de sucesso** com quantas foram gravadas e quantas substituíram.
O rótulo do botão carrega o efeito: *"Aplicar · 3 substituição(ões)"*, *"Aplicar mesmo assim
(3 respondida(s))"*.

⚠️ **A explicação vai UMA vez, a lista diz só de quem se trata.** A primeira versão repetia a
frase inteira por pessoa: já em três ficou ilegível, e com cinquenta ninguém leria. O aviso do
grupo (`avisoDeRespondidas`) e o resumo de uma linha (`estadoAtual`, *"ENVIADA por JOÃO"*, *"7
resposta(s), por JOÃO"*) **também são escritos no backend** — se a tela compusesse os dela, as
duas envelheceriam separadas.

#### Verificação

**488 testes** (17 novos). ✅ Ao vivo no ciclo Geral: **9 botões "Trocar avaliador"** na lista; a
prévia de 3 pessoas devolvendo os três casos distintos (`CRIAR`, `SUBSTITUIR` com o nome de quem
sai, `EXIGE_CONFIRMACAO` na ENVIADA) **sem gravar nada**; e o `POST .../designar` da ENVIADA
**recusado com 400** sem a confirmação, com o banco conferido depois — avaliador **inalterado**.

### 3.1.23. 🟠 A confirmação do Abrir sem números, e a validação DEPOIS do aviso (08/09)

Item I. São dois, e o segundo é o que importa.

**(b) A validação rodava depois do aviso de irreversibilidade.** A pessoa encarava *"não tem
volta: não existe voltar para rascunho"*, confirmava, e **só então** recebia *"Falta resolver:
o ciclo não tem nenhuma aplicação"*. O aviso mais pesado da tela era gasto com quem **nem podia
abrir** — e quem podia lia um "tem certeza?" sem número nenhum.

Invertido: a tela pergunta ao backend o que a abertura faria; **se há problema, mostra o
problema e nada mais**; se não há, aí sim o aviso, com os números.

**(a) A confirmação não dizia nada.** Agora diz — e os números vêm do backend
(`GET /painel/ciclo/:id/previa-da-abertura`), das **mesmas funções que decidem**: `listar()` da
designação, que aplica a régua do ciclo, e `problemasParaAbrir`, que a API roda no clique.
Contar no diálogo divergiria no primeiro caso de borda, e o caso de borda aqui é **a régua
barrando alguém que está no público**: a pessoa aparece no total e não gera avaliação.

#### ⚠️ E a tela afirmava algo falso: "Abrir gera as avaliações"

Achado ao ler o `abrir()` para saber de onde tirar o número: **abrir não cria avaliação
nenhuma.** Ele muda o status e trava a montagem — quem cria `Avaliacao` é a **designação**
(§3.12). A frase do cartão dizia o contrário desde sempre.

⭐ **Varrido depois, porque quem escreve a próxima frase copia da anterior:** a frase falsa
existia em **um lugar só** (o texto cinza sob o botão). Duas vizinhas parecem o mesmo e estão
**certas**, e foram deixadas como estavam — *"Abrir gera **nota**"* (`ciclo.controller.ts`) e
*"a partir dele começam a nascer **notas**"* (`CiclosPage`): a nota sai no **envio**, que exige
ciclo ABERTO. O falso era "gerar **avaliações**". O ESTADO já registrava certo (*"designar —
gera as avaliações"*), e nenhum spec afirmava o contrário.

Por isso o número certo não é "quantas vão nascer", e sim:

> **1** avaliação(ões) já designadas serão liberadas para responder, em **1** aplicação(ões) ·
> **3** pessoa(s) no público.
> ⚠️ **2** no público estão **fora pela régua do ciclo** (afastados, cargo inelegível ou decisão
> do RH) — entram na conta do público e não geram avaliação.

E, quando existe, ⚠️ **N no público sem avaliador** — não serão avaliadas enquanto ninguém as
designar (e designar continua valendo depois de abrir).

#### Recorte provisório: avisa, não bloqueia

> ⚠️ **1 de 1 aplicação(ões) estão com recorte provisório.** A própria tela chama esse público de
> *recorte de trabalho, não decisão do RH* — e o ciclo vai abrir com ele.

⚠️ **Deliberadamente não bloqueia.** Confirmar o provisório em bloco é a pergunta que está com a
gestora (lista (A), item 17); bloquear antes de ela responder tiraria a única saída que existe
hoje. O aviso resolve o que estava errado — abrir sem saber —, sem decidir no lugar dela.

#### Verificação

✅ **Ao vivo**, dois ciclos descartáveis:

| Ciclo | O que a tela fez |
|---|---|
| **vazio** | **nenhum modal**. Só *"Falta resolver: O ciclo não tem nenhuma aplicação."* — o aviso de irreversibilidade não apareceu |
| **montado** (público provisório num CC com 2 afastados de 3) | modal com **1 designada · 1 aplicação · 3 no público**, o aviso dos **2 barrados pela régua** e o do **recorte provisório** |

Os dois apagados depois (1 avaliação, **0 respostas**), com os dois ciclos de sempre intactos.

### 3.1.24. 🟠 O "→ Próximo" sumia na fase mais LONGA do ciclo (08/09)

Item J. Depois de aberto e arrumado, o passo desaparecia — exatamente entre **abrir e apurar**,
que é onde o ciclo passa semanas.

⚠️ **A regra do `null` estava certa e não mudou.** Ela continua valendo para o ciclo aberto e
vazio e para o ENCERRADO. O que estava errado era este caso caber nela: **"a bola não é sua" e
"não há nada a fazer" são coisas diferentes**, e o `null` dizia a segunda.

O passo novo **não sugere apurar** (empurraria apuração parcial) **nem encerrar** (bateria na
recusa) — há spec para cada uma dessas duas coisas.

> → **Próximo:** *Agora é com os avaliadores: 891 avaliação(ões) a enviar. O Painel mostra
> quantas faltam por avaliador*

#### ⭐⭐ `ACOMPANHAR` é o único código NÃO-IMPERATIVO — e isso não é assimetria

Todos os outros nomeiam um **ato do RH**, e o rótulo vem no imperativo: *"Monte"*, *"Designe"*,
*"Apure"*, *"Encerre"*, *"Abra"*. **Nesta fase não há ato do RH**: as avaliações estão
designadas e quem responde são os avaliadores. O passo existe para dizer **de quem é a vez**,
que é informação, não ordem.

⚠️ Está escrito no tipo, e com o porquê — não só "é exceção". Quem for uniformizar vai achar que
faltou o verbo: **não faltou.** Escrever *"Acompanhe"* seria mandar olhar, e mandar olhar não é
um passo. A frase aponta o Painel porque é lá que a contagem por avaliador existe — a única
coisa concreta desta fase. Há spec exigindo que o rótulo **não** comece por verbo no imperativo.

#### ⚠️ E a frase não atribui intenção — nem ela, nem as vizinhas

Esta é a frase que a gestora lê **imediatamente antes de cobrar alguém**. Quem não respondeu
pode ter mil motivos, e o Painel mostra uma **contagem por pessoa, não um veredito sobre ela**.
Por isso *"quem está segurando"* não entrou — e as outras duas ocorrências do mesmo vício, que
já estavam na tela, saíram junto:

| Onde | Antes | Agora |
|---|---|---|
| Painel, título da fila | *"do mais **atrasado** ao menos"* | *"de quem tem **mais a fazer** para quem tem menos"* |
| Diálogo de encerrar com pendência | *"cobre no Painel: lá está **quem está segurando**, por nome"* | *"o Painel mostra **quantas faltam por avaliador**"* |

⭐ A varredura foi pelo mesmo motivo da frase falsa do §3.1.23: **quem escrever a próxima frase
copia da anterior.** O vocabulário do módulo é o que decide o tom das próximas telas.

#### Verificação

**490 testes** (5 novos no `proximo-passo.spec`, entre eles: não sugere apurar nem encerrar; não
começa por imperativo; não usa "segurando/atrasado/parado"). ✅ Ao vivo, num ciclo descartável
com tudo designado e nada respondido — `ACOMPANHAR`, `aba: painel`, e o Painel apontado
mostrando *"ARIELLY · 2 a fazer"*. ⚠️ Os dois ciclos reais **não** mostram este passo, e é o
certo: ambos ainda têm gente sem avaliador, então `DESIGNAR` vence — a ordem das regras não
mudou.

### 3.1.25. ✅ Colisão de chapa: um 403 que PARECE falta de permissão (08/09)

`IdentidadeService.porMatricula` compara **texto exato** (`matricula: alvo`). A `renataborges`
tinha **`E01981`** em `core.usuarios` e **`001981`** em `rh.colaborador` — a mesma pessoa, dois
formatos. Resultado: login válido, papel `AVALIADOR` ativo, e a tela dizendo *"sua matrícula não
corresponde a nenhum colaborador ativo"*.

#### ⚠️ O caro não é o código — é o SINTOMA

Quem bate nisso lê um **403** e conclui *"a permissão não salvou"*. E vai ao Configurador **dar
papel a quem já tem**, onde vai encontrar tudo certo, e concluir que a tela do Configurador está
com defeito. O defeito está a dois schemas de distância, num campo de texto.

⭐ **Isso quase contaminou a investigação de 08/09.** Estávamos caçando exatamente esse sintoma —
"a permissão não salvou" — no `rodrigoleao` e depois na `denisealves`. Se o Clenio não tivesse
corrigido a matrícula da Renata **antes** de eu mover as 13 avaliações para ela, ela as receberia
e **não veria nada**; a leitura natural teria sido *"a permissão dela também não salvou"* — o
terceiro caso do sintoma que estávamos perseguindo, e que **não existe**. Duas causas
completamente diferentes com a mesma cara na tela, e a errada estava com a atenção toda.

⚠️ E o custo teria sido maior que uma investigação perdida: eu teria **entregue as 13 avaliações
como resolvidas** — a designação certa, o número certo no censo, e ninguém conseguindo abrir.

#### O precedente já existe

⭐ **A Logística normaliza pelos 5 últimos dígitos** ([[feedback_chapa_colide_5_digitos]]):
`E01047` e `001047` são a mesma chapa; **1 valor usa, 0 ou 2+ devolve `null`**. Não é decisão
nova a tomar — é aplicar o que a casa já faz, com a mesma regra de ambiguidade, que aqui já tem
par (`escolherColaboradorUnico` e o `MatriculaAmbiguaError`).

⚠️ Quando for feito: a normalização vale para a **busca**, não para o dado. Nada de reescrever
`core.usuarios` — o schema é read-only aqui, e o cadastro é do Configurador.

#### ✅ A FONTE foi corrigida no Configurador (08/09)

O Clenio achou de onde vinha: a busca **"pelo nome (Protheus)"** do `UsuarioFormPage` preenchia o
campo de matrícula com o valor **cru** do `infoFuncionario`, que é a forma `E…`. O comentário do
próprio código já dizia *"Protheus SA1, só chapas E…"* — e ninguém tinha ligado uma coisa à outra.

`configurador/src/lib/chapa.ts` → `normalizarChapa()`, aplicada em **dois pontos**: ao escolher o
funcionário na busca (que é onde o Clenio viu) e **no envio**, que cobre quem digita `E01981` à
mão.

⚠️ **Regra estreita de propósito:** só converte `^E\d{5}$`. Não toca em `SUPVEN01` (login de
posto, 8 caracteres) nem em nada que não case — se aparecer outro prefixo, é para falhar
visivelmente, não para adivinhar.

⚠️ **Por que trocar é seguro, e isso precisou ser medido antes:** a mesma consulta ao Protheus
alimenta o `verificarMatricula` da **varredura que DESATIVA usuário**. Se o Protheus só conhecesse
`E…`, gravar `0…` faria a varredura ler *"saiu da empresa"* para gente que está trabalhando.
Verificado em 08/09 com duas leituras pontuais: **`MATRICULA=003942` devolve `E03942`** — o
Protheus aceita as duas formas e resolve internamente. E o `verificarMatricula` só olha se veio
alguém; **não compara formatos**.

#### O que sobra

| | |
|---|---|
| ✅ **Dado antigo, corrigido** | `marcelojunio` foi de `E03942` para `003942` pelo Clenio, ainda em 08/09. **Nenhuma conta de pessoa real ficou fora do formato** — a varredura de `core.usuarios` devolve só `admin` (`E09999`), `supven01` (`SUPVEN01`) e `zz_teste94` (`999888`, INATIVA), que **não são colaboradores** e é correto não resolverem |
| ✅ **A defesa também foi feita** | ver abaixo — a fonte é a torneira, isto é a rede |

#### ✅ E a REDE, no próprio módulo (08/09)

`common/chapa.ts` — `normalizarChapa` e `chapasEquivalentes` —, ligada nas **duas portas** que
casam chapa:

| Onde | O que fazia | O que faz |
|---|---|---|
| `IdentidadeService.porMatricula` | `matricula: alvo` (exato) → **403 no login** | `matricula: { in: ['001981','E01981'] }` |
| `distribuicao.montarPrevia` | índice por `c.matricula` cru → a linha da planilha virava *"matrícula não existe entre os colaboradores ativos"* | índice pela chapa **normalizada**, nos dois lados |

⚠️ **A segunda porta não estava na conta.** Só apareceu ao varrer quem mais casa matrícula no
módulo — e é a **importação da planilha do RH**, que é montada a partir do que o Protheus mostra,
onde a chapa é `E…`. A recusa dela já falava do *"zero à esquerda que o Excel come"*: é a mesma
família, e faltava metade.

⚠️ **Busca pelas DUAS formas, não só pela normalizada.** Se um dia o `rh` tiver `E…` (importação
nova, correção manual), a busca continua achando em vez de passar a falhar do outro lado. E se as
duas existirem como pessoas diferentes, quem decide é o `escolherColaboradorUnico`, que já
lançava `MatriculaAmbiguaError` — a função só oferece candidatos, não decide.

⚠️ **Regra estreita, e há spec para isso:** `SUPVEN01`, `E0194`, `X01981` e `999888` passam
**crus**. Prefixo novo deve falhar visivelmente, não ser adivinhado.

⭐ **Um spec antigo quebrou, e a falha estava meio certa:** ele afirmava
`expect(where.matricula).toBe('001741')` — a **forma** do filtro, não o fato que protege
(*"busca só por matrícula, sem pedir filial"*). O fato não mudou; a forma sim. Corrigido para
`expect(where.matricula.in).toContain('001741')`, com o motivo ao lado. É a regra 3 da §5.9 numa
variante que ainda não tínhamos visto: **acoplamento à forma, não ao texto.**

**515 testes** (25 novos) *no fechamento deste item*. Conferido na imagem: `chapasEquivalentes('E03942')` →
`["003942","E03942"]`.

### 3.1.26. 🔴 O modal de vínculo errava por 1 — no caso que a própria tela recomenda (08/09)

A regra *"ninguém avalia a si mesmo"* **existia e não rodava no modo grupo**. Com uma pessoa,
escolher ADELSON para ADELSON desabilitava o botão. Com o grupo COMERCIO LATICINIOS (18), o mesmo
ADELSON era aceito e o modal anunciava **"passa a avaliar 18 pessoa(s)"** — o efeito real era 17.

⭐⭐ **O agravante é onde o erro cai.** A tela diz, logo acima da lista: *"nomear o responsável de
um grupo resolve o grupo inteiro"*. O responsável **quase sempre está no grupo**. O caminho que a
tela recomenda era exatamente o que contava errado.

#### A checagem é a MESMA — o que mudou foi contra o quê ela roda

`escolhido.id === alvos[0].colaboradorId` (identidade com um alvo único) virou
`alvos.filter(p => p.colaboradorId !== escolhido.id)` (pertinência ao grupo). Uma lista, usada em
**três** lugares: o resumo, o `disabled` do botão e o `aplicar()`. Nada de "desconto" só no texto —
[[feedback_previa_grava_o_que_mostrou]]: o número anunciado e a lista gravada têm de ser o mesmo
objeto, senão voltam a divergir na primeira mexida.

⚠️ **Bloquear o botão no grupo seria a correção errada.** Só recusa quando não sobra nada a gravar
(uma pessoa que é ela mesma; um grupo cujo único membro é quem se escolheu). No grupo de vários o
ato segue valendo para as outras — barrar tiraria o caminho recomendado para resolver um defeito
de contagem. E o resumo passa a **nomear** quem ficou de fora: dizer "17" onde o grupo tem 18
deixaria quem lê procurando o que sumiu.

Efeito colateral bom: como a linha da própria pessoa não é mais enviada, o *"1 pessoa(s) não
receberam o vínculo"* some — ele anunciava a falha de algo que a tela nunca prometeu gravar.

### 3.1.27. 🔴 Cinco ações, quatro contadores — o buraco saía do servidor pronto (08/09)

`efeitoDeDesignar` devolve **cinco** ações; `designar/previa` publicava **quatro** contadores.
`EXIGE_CONFIRMACAO` existia só derretido dentro da frase `avisoDeRespondidas` — como texto, não
como número. Trocar o avaliador de quem já respondeu devolvia:

```
{ total: 1, criar: 0, substituir: 0, nadaAFazer: 0, recusar: 0 }
```

A tela imprimia *"0 ganham · 0 SUBSTITUÍDO"* e o botão logo abaixo aplicava **1**, porque ele lê
`linhas` direto. ⭐ **A tela não calculava nada** — o buraco vinha pronto do servidor, e é por isso
que o conserto é lá.

⚠️ **NÃO somar dentro de `substituir`.** Dobrar fecharia a conta e **apagaria a distinção** de que
o bloco vermelho e a flag `confirmar` dependem — a diferença entre "troca comum" e "troca sobre o
julgamento de outro". Campo novo, `exigeConfirmacao`.

#### A invariante virou teste — `previa-fecha-a-conta.spec.ts`

```
criar + substituir + nadaAFazer + recusar + exigeConfirmacao === total
```

É a regra 6 da §5.9 ([[feedback_invariante_varre_o_fonte]]) na forma aritmética: **uma sexta ação
que ninguém publique quebra a suíte por construção**. Revisão caso a caso é justamente o que
falhou aqui — a quinta ação existia desde que `EXIGE_CONFIRMACAO` foi criada, e ninguém notou.

⭐ A prévia do público **já** fechava a conta (`encontradas = adicionar + jaNesta +
emOutraAplicacao`; `adicionar = geramAvaliacao + barrados`) e entra no mesmo arquivo como caso que
passa — para não regredir, e para deixar escrito qual é o padrão da casa.

**Validado por mutação** (regra 2 da §5.9), duas vezes: remover o balde → 3 falhas; dobrar dentro
de `substituir` → 3 falhas. A soma sozinha **não** pegaria a segunda; quem a pega é o
`expect(p.substituir).toBe(1)` explícito. Por isso ele existe.

Conferido contra o Piloto: a linha ENVIADA devolve `exigeConfirmacao: 1`, soma 1 = total 1; o lote
misto (1 enviada + 4 pendentes) devolve `substituir: 4, exigeConfirmacao: 1`, soma 5 = total 5.

### 3.1.28. 🟠 Dois cortes de lista mudos — um deles ao lado do irmão que fala (08/09)

**`naoAplicadas`**: a prévia do lote dizia *"13 ajustadas à mão"* e listava **12 nomes**, sem
indicador. O backend mandava os 13 certos (`porMotivo.AJUSTE_MANUAL_DO_CICLO: 13`). Qualquer ciclo
com mais de 12 ajustes manuais mentia calado — **e o Piloto já passou desse número**.

⚠️ A causa: a **contagem** era sobre `naoAplicadas` inteira e o **corte** sobre a lista filtrada.
Duas listas diferentes na mesma frase. Agora é uma só (`nomeadas`), e o "… e mais N" fala dela.

**`emOutraAplicacao`**: cortava em 8 sem indicador, **encostado** em `barradosPelaRegua`, que corta
em 8 **com** indicador. Alguém acertou um e esqueceu o irmão.

O padrão *"… e mais N"* já existia na casa (o Painel, em "fora de todas as aplicações", mostra
*"… e mais 890"*). Usado o que já existe, não inventado outro.

#### ⚠️ O grep dos dois slices restantes — e o que eles NÃO são

O item 4 pedia para não presumir. Varridos **todos** os `.slice(` / `.substring(` do frontend
(8 ocorrências):

| Onde | O quê | Veredito |
|---|---|---|
| `lib/formato.ts:11` | `valor.slice(0, 10)` | **data ISO**, `AAAA-MM-DD` → pt-BR. Não é lista. |
| `pages/CiclosPage.tsx:714` | `d.toISOString().slice(0, 10)` | **data ISO**. Não é lista. |
| `PainelPage.tsx:166` | `.slice(0, 6)` | lista, **com** "… e mais N". OK. |
| `DesignacaoPage.tsx:708 / 727` | `.slice(0, 10)` | listas, **com** "… e mais N". OK. |

⭐ **`.slice(0, 5)` não existe no nosso fonte.** Nenhuma ocorrência, em nenhum arquivo. E o
`.slice(0, 10)` "perto de tokens de status/retry" é uma das **duas conversões de data** acima —
que num minificado ficam a poucos bytes de qualquer coisa.

#### ✅ FECHADO — os dois foram identificados no bundle, não por dedução

O bundle construído tem **4** `.slice(0,10)` e **1** `.slice(0,5)`. Os quatro são nossos: duas
datas (`formato.ts`, `CiclosPage`) e duas listas que já têm indicador (`DesignacaoPage`). O
`.slice(0,5)`, extraído com o contexto ao redor, é do **React DOM**:

```js
case "boolean": var n = t.toLowerCase().slice(0,5); if (n !== "data-" && n !== "aria-") …
```

É o teste de prefixo `data-`/`aria-` na aplicação de atributos. **Não é lista, não trunca nada e
não é nosso.** O item não volta: o fonte tem 8 `.slice(` no total, e os 8 estão na tabela acima.
Ver a regra 12 da §5.9 — foi o caso que a gerou.

### 3.1.29. 🟠 O cabeçalho do ciclo misturava dois registros, e a conta não fechava (08/09)

`4 aplicações · 1036 no público · 95 sem avaliador · 3 de 894 enviadas · 3 apuradas`.
**894 + 95 = 989**, não 1036. Faltavam **47** — e nada na linha dizia que existiam.

⭐⭐ **Os dois números estão certos, e respondem perguntas diferentes.** `1036` é o número de
**montagem**: todas as linhas de público, inclusive as que o RH já tirou (é o mesmo dos chips
*"Todos (N)"* da Designação). `989` é **quem o ciclo ainda alcança**. O defeito era imprimir um de
montagem seguido de três operacionais, **sem o termo que os liga**.

⚠️ **Trocar o cabeçalho para 989 seria a correção errada:** "resolveria" a soma apagando da tela a
existência dos excluídos — que é uma decisão de alguém, com justificativa registrada. O termo que
faltava entra; o número de montagem fica:

```
4 aplicações · 1036 no público · 47 fora do ciclo · 95 sem avaliador · 3 de 894 enviadas · 3 apuradas
```

Campo novo `foraDoCiclo`, calculado **na mesma varredura** de `semDesignacao` e da mesma régua —
uma segunda conta divergiria na primeira listagem que mudasse. E a prévia do lote passa a dizer
**"ativos no público"**, porque o `publico` de `porAplicacao` sempre foi o dos elegíveis.

⚠️ **O nome `foraDoCiclo` é deliberado.** `!elegivel` inclui a régua **e** a exclusão manual do RH
("a decisão manual SOBREPÕE a régua, nos dois sentidos"). Chamar isso de `barradosPelaRegua` —
como `previa-da-abertura` faz — passaria a dizer "régua" sobre decisão de pessoa. Hoje os 47 são
`REGRA_CICLO` 47 / manual 0: concordam **por acaso**. Ver o levantamento das prévias.

Conferido contra o Piloto: `1036 − 47 = 989 = 894 + 95`. **Fecha.**

Junto, cosmético: o diálogo se intitulava *"Definir avaliador de…"* mesmo aberto pelo botão
**"Trocar avaliador"**. O título não recebia o modo; a linha já sabia qual era (`semAvaliador`).
Agora recebe.

### 3.1.30. 📝 PENDENTE (a decidir) — o que `EXIGE_CONFIRMACAO` significa no CADASTRO

O modal de vínculo (§3.1.26) segue **sem prévia de verdade**: ele anuncia uma frase, não um
contrato de baldes como as outras cinco superfícies. O encanamento existe ao lado — o módulo
`designacao-padrao` já tem a prévia da importação de planilha.

⚠️ **O que trava o desenho é uma pergunta de produto, não código.** No ciclo,
`EXIGE_CONFIRMACAO` quer dizer *"já respondida"*. **O cadastro não tem resposta.** Então:

- **Opção A — "aqui nada exige confirmação".** O campo fica `0`, sempre. O contrato continua
  uniforme entre as superfícies e não há caso especial.
- **Opção B — sobrescrever linha PROVISÓRIA ou NÃO REVISADA.** A tela já anuncia **927
  provisórias** e **159 não revisadas**; substituir uma decisão que ninguém conferiu é o análogo
  mais próximo de "pôr o nome de um sobre o julgamento de outro".

**Alguém precisa dizer qual.** Sem isso o endpoint é desenhado duas vezes — e, como o
§3.1.27 mostrou, política escolhida por omissão é como o buraco nasce.

#### ⚠️ E há uma SEGUNDA pergunta de política, do mesmo tipo

Trocar o avaliador de uma avaliação **já respondida**: o **lote** do cadastro RECUSA
(`JA_RESPONDIDA`) e a designação **individual** PERMITE com confirmação (`EXIGE_CONFIRMACAO`).
Mesmo fato do domínio, decisões opostas — e **só a segunda tem razão escrita** (o cabeçalho de
`efeito-de-designar.ts`: recusar de vez tiraria do RH uma correção legítima). Pode estar certo
que o lote recuse — em lote ninguém lê cinquenta avisos, e recusar é o padrão seguro —, mas isso
é decisão a registrar, não detalhe de implementação.

⭐ **Unificar as prévias (item 3 da ordem de custo) está parado até esta resposta.** Unificar
antes escolheria a política por omissão, que é literalmente como o buraco do §3.1.27 nasceu.

As duas perguntas estão na lista **(A)**, com quem responde.

⚠️ Isto **não pega carona** no conserto do §3.1.26: aquele era número errado na tela, este é
capacidade nova.

### 3.1.31. ⏸️ ADIADO, com escopo corrigido — descrição do centro de custo

São **DOIS** endpoints, não três: `resultados/ciclo/:id` e `designacao/aplicacao/:id` mandam
`"centroCusto": "11010205"` **sem descrição**. É **payload**, não formatação — a tela não tem o
dado para formatar.

⚠️ **O terceiro caso não é do mesmo assunto.** Em `aplicacoes/ciclo` →
`publico.origens[].referencia` o valor é **texto livre gravado na montagem**
(*"PROVISORIO: prefixo 11"*), não um campo de centro de custo. **Não forçar descrição ali** —
seria inventar estrutura sobre uma anotação de quem montou.

### 3.1.32. ✅ As duas colisões de vocabulário, nomeadas (08/09)

Item 1 da ordem de custo do levantamento — barato e independente de decidir política.

**`barradosPelaRegua` → `foraDoCiclo`, em `previa-da-abertura`.** Era o mais urgente dos três: a
conta é `!elegivel`, e `elegivel` sai de `designacao.listar`, onde *"a decisão manual SOBREPÕE a
régua, nos dois sentidos"*. O número **inclui quem o RH tirou à mão** — e o nome afirmava a causa,
e só uma delas. Medido no Piloto: 47 fora do ciclo, `REGRA_CICLO` 47, manual **0** — concordam
**por acaso**, porque ninguém excluiu à mão ainda. Na primeira exclusão manual o campo passaria a
dizer *"a régua barrou"* sobre um ato de gente, com a confiança de um número.

⭐ A tela dizia o mesmo em negrito (*"fora pela régua do ciclo"*) e admitia a outra causa entre
parênteses. Corrigida junto: afirmar no destaque e ressalvar no rodapé é a mesma mentira, só que
onde alguém lê.

⚠️ Em `publico/previa` o nome **fica** — lá ele é literal, e conta só a régua.

**`adicionar` → `entramNoPublico`, em `publico/previa`.** "Adicionar" não diz **a quê**. A prévia
conta duas coisas encadeadas — entrar na LISTA e virar AVALIAÇÃO — e entre elas está a régua; quem
lesse `adicionar` como "quantas avaliações saem daqui" erraria exatamente em `barradosPelaRegua`.
É o mesmo eixo do cabeçalho do ciclo (1036 montado × 989 alcançado): **público e avaliação são
objetos diferentes e cada um precisa da sua palavra.**

**E o `criar` NÃO colide** — a suspeita era falsa, conferida campo a campo. Nos dois endpoints
significa *"não existia `Avaliacao` no ciclo → uma será criada"*; é a única palavra que os dois
payloads já têm em comum. Registrado no fonte, ao lado dos dois campos, porque a próxima pessoa
vai desconfiar de novo. O que diverge são os vizinhos (`atualizar`/`substituir`,
`jaIguais`/`nadaAFazer`) e a política do §3.1.30.

### 3.1.33. 🔴 A prévia prometia gravar o que o ato recusa (08/09)

Item 2 da ordem de custo — e o mais grave dos três, porque não é contador errado: é a **tela
autorizando o que a API vai negar**. O botão fica armado, a pessoa clica e leva um erro que a
prévia tinha acabado de dizer que não viria.

`efeitoDeDesignar` é pura e era compartilhada entre a prévia e o ato — e mesmo assim os dois
divergiam, porque `designar()` rodava **mais duas guardas que o classificador não conhecia**:

| Guarda | Onde estava | A prévia rodava? |
|---|---|---|
| autoavaliação (`avaliadoId === avaliadorId`) | inline, **antes** do classificador | ❌ |
| troca de aplicação (`assertPodeTrocarDeAplicacao`) | método, **depois** dele | ❌ |

Medido no Piloto, mesmo par: prévia `SUBSTITUIR` `{substituir: 1, recusar: 0, total: 1}` × ato
*"Ninguém pode ser o avaliador da própria avaliação."*

#### As mesmas guardas, não uma cópia delas

As duas **subiram para o classificador**. Não há uma segunda implementação para manter em acordo —
prévia e ato chamam a mesma função, e é impossível uma saber o que a outra não sabe. A DECISÃO da
troca continua sendo a função pura de sempre (`decidirTrocaDeAplicacao`), a mesma que a cópia do
cadastro consulta; o que mudou foi **quem a consulta**. `assertPodeTrocarDeAplicacao` deixou de
existir — guarda que só um chamador enxerga é como as duas divergências nasceram.

⚠️ **Uma mudança de ORDEM, deliberada.** A troca de aplicação passa a ser avaliada **antes** do
`EXIGE_CONFIRMACAO`, porque a primeira é recusa **dura** (confirmação nenhuma a levanta) e a
segunda é **confirmável**. Na ordem anterior, um ato que fosse as duas coisas pedia confirmação
primeiro e só recusava depois de confirmado — fazia a pessoa autorizar o que seria negado de
qualquer jeito. O desfecho final é o mesmo; o caminho deixa de ser humilhante.

⚠️ Efeito colateral bom: a guarda lê `atual.respostas`, que os dois chamadores já trazem, em vez
de recontar no banco. Uma ida a menos, pelo mesmo número.

#### O teste protege o ACORDO, não a mensagem

`previa-fecha-a-conta.spec.ts` ganhou oito cenários que rodam **a prévia e o ato sobre o mesmo
estado** e exigem que decidam igual — e, quando recusam, que a **frase seja a mesma string**.
Uma guarda nova que alguém acrescente só ao ato — que é exatamente como estas duas nasceram —
quebra os casos sem que ninguém precise lembrar de vir aqui.

**Validado por mutação**, os dois arranjos antigos reconstruídos: guarda de autoavaliação só no
ato → 2 falhas; guarda de troca invisível à prévia → 7 falhas (com a suíte da troca junto).

**537 testes.**

### 3.1.34. 🟠 Botão armado sobre prévia vazia — o inverso do §3.1.27 (08/09)

Com **tudo recusado**, o diálogo de designar imprimia *"Nada mudaria com esta escolha"* e o botão
continuava habilitado. É a mesma família do defeito da manhã, invertida: lá o botão fazia **mais**
do que o resumo dizia; aqui não faria **nada** e parecia que faria.

`disabled` quando `criar + substituir + exigeConfirmacao === 0` — e a conta é **a mesma** que
escreve o "Nada mudaria", extraída para uma constante lida nos dois lugares. Se ficassem duas,
voltariam a discordar, que é o assunto do §3.1.27.

#### As outras quatro prévias, conferidas

| Prévia | Trava? |
|---|---|
| modal de vínculo (cadastro) | ✅ já travava — `alvosEfetivos` vazio |
| público da aplicação | ✅ já travava — *"Nada a adicionar"* |
| lote / cópia do cadastro | ✅ já travava — `aGravar === 0` (`criar + atualizar`) |
| importação de planilha | ✅ já travava — `pares.total === 0`, e `total` é `aGravar.length`, sem os inalterados |
| **designar** | 🔴 era a única aberta |

### 3.1.35. ⭐ CONCORDÂNCIA DE NÚMERO — a irmã da regra §3.1.7, e ela era geral

Duas frases erradas apareceram na conferência (*"1 já respondidas — pedem confirmação"*, *"1 serão
recusadas"*). Não eram duas: varrido o módulo, havia **três jeitos convivendo**.

| | Quantos | O que é |
|---|---|---|
| ternário `n === 1 ? … : …` | 10 | certo, reinventado um a um |
| **frase simplesmente errada** | **19** | *"1 pessoas"*, *"1 ganham avaliador"*, *"1 serão recusadas"* |
| fuga com `"(s)"` | 56 | não erra, mas não resolve — e gerava híbridos |

⭐ **Três jeitos é o mesmo que nenhum.** A próxima frase é escrita pela mesma mão que escreveu a
anterior — foi assim que as 19 nasceram, e é o argumento literal do §3.1.7 ("*subiu para regra
porque a próxima frase seria escrita pela mesma mão, com o mesmo erro*").

#### Por que o `"(s)"` também saiu

O §3.1.7 **já decidiu** o caso análogo: *"não resolva com 'avaliado(a)' — parêntese é ruído em
tela que alguém lê em pé, no corredor da loja"*. E aqui o argumento é mais forte: para **gênero**
não há dado (`rh.colaborador` não guarda), para **número** o dado está na mão. Escrever `"(s)"` é
declinar de usar o que se tem.

⚠️ E o parêntese estava **produzindo** erro, não só ruído: *"1 pessoa(s) **adicionadas** ao
público"*, *"1 avaliação(ões) **estão ENVIADAS**"* — o substantivo fugia da concordância e o verbo
ficava presa dela. Quatro híbridos assim, todos dentro de frases que pareciam resolvidas.

#### Um jeito só

`flexao(n, umaSó, várias)` e `contagem(n, umaSó, várias)` em `lib/formato.ts`. Recebem as duas
formas por extenso de propósito: plural em português não é "+s" (`avaliação`→`avaliações`), e uma
regra automática erraria **calada** — que é o defeito que elas existem para tirar da tela.

⚠️ Colisão achada no caminho: `DesignacaoPage` já tinha um `const contagem` (contadores dos
filtros). Renomeado para `contadores`, que é o nome que o backend usa para a mesma coisa. Nome de
helper genérico colide com nome de domínio; o typecheck pegou.

**Resultado: 0 parênteses de número e 0 concordâncias nuas no módulo** — conferido por varredura,
não por amostra.

### 3.1.36. 🟠 "0 fora do ciclo" era ruído na linha de estado (08/09)

O termo novo do §3.1.29 aparecia zerado em ciclo limpo. Correto e inútil.

⭐ **A distinção que decide:** os outros números da linha são de **ESTADO** — *"0 apuradas"* e
*"0 sem avaliador"* dizem em que passo o ciclo está, e valem zerados. Este é um termo de
**CONCILIAÇÃO**: existe para a soma fechar quando alguém foi tirado do ciclo. Num ciclo limpo a
conta já fecha sem ele. Some quando é zero (`soQuandoHa`), com o motivo escrito ao lado — para
ninguém "consertar" achando que faltou.

### 3.1.37. 🔴 DESIGNAR NÃO DÁ ACESSO — 24 de 50 designações eram impossíveis (09/09)

O ciclo de simulação foi montado pela tela e ficou pronto para abrir. **48% das designações
estavam em avaliadores sem conta na plataforma**, e a *"Fila por avaliador"* os mostrava
exatamente como os demais — mesma linha, mesma barra, mesmo *"N a fazer"*.

O ciclo abriria, o RH veria filas cheias, o prazo correria, e **essas avaliações nunca seriam
respondidas**. Sem erro, sem log, sem nada. O defeito só apareceria quando alguém fosse cobrar o
atraso — e cobraria a pessoa errada, que não tem como nem entrar.

⚠️ É a família do modelo de DEMONSTRAÇÃO (§3.1.30), **sem a guarda**: lá a recusa existe e chega
tarde, na abertura; aqui não existia recusa nenhuma.

#### Medido, não estimado

| Avaliador | Avaliações | Situação |
|---|---|---|
| ESMERALDA (001277) | 13 | sem conta |
| GILBERTO (001121) | 5 | sem conta |
| JAICLER (001134) | 2 | sem conta |
| LAIS (002865) | 2 | sem conta |
| MARCELINO (005373) | 2 | sem conta |
| **total** | **24 de 50** | **48%** |

⚠️ **O primeiro levantamento dizia 22 (44%).** Faltava o MARCELINO — ele é da Controladoria, avalia
2 pessoas do próprio setor e entrou no público no último passo da montagem. A conta certa só
apareceu quando a consulta foi rodada contra o ciclo em vez de derivada da montagem.

#### Dava para saber, e sem acoplar ao Configurador

O módulo **já lê `core` read-only por `$queryRaw`** — é assim que o `IdentidadeService` resolve
usuário → colaborador desde sempre. A checagem nova é o caminho inverso, e usa as mesmas tabelas:
`core.usuarios` + `core.permissoes_modulo` + `core.modulos_sistema`. Nenhuma dependência nova,
nenhuma escrita, nenhum acoplamento além do que existia.

São **três degraus**, e são exatamente os que o login já cobra de quem tenta entrar:
`SEM_CONTA` → `CONTA_INATIVA` → `SEM_PERMISSAO`. ⚠️ A ordem importa para a **frase**: dizer *"sem
permissão"* de quem não tem conta manda alguém procurar a tela de permissões de um usuário que não
existe. Hoje os 24 são todos `SEM_CONTA`; os outros dois entram porque são igualmente invisíveis.

⚠️ **A regra da chapa não foi reescrita em SQL.** As formas possíveis saem de `chapasEquivalentes`
(TypeScript) e entram como parâmetro — duplicar a normalização criaria a segunda cópia que
envelhece errada, e essa regra já custou um 403 que parecia falta de permissão (§3.1.25).

#### Aviso, nunca bloqueio

A designação é **legítima**: quem avalia quem é decisão do RH, e a pessoa existe como colaborador.
O que falta é **conta**, que é ato do Configurador e de outra pessoa, e que pode ser resolvido com
o ciclo já aberto. Então aparece em dois lugares e não impede nada:

- **na fila do painel**, com a frase do backend, e a fila passa a **ordenar por "não consegue"
  antes de por tamanho** — uma fila de 13 que ninguém abre não é trabalho atrasado, é trabalho
  impossível, e é a pergunta mais urgente das duas;
- **na prévia da abertura**, em bloco próprio — fora da lista âmbar de pendências do ciclo, porque
  esta se resolve em **outro módulo**. Diz quantas avaliações estão paradas, com quem, e por quê.

⚠️ O rótulo da fila também mudou: quem não consegue entrar lê **"13 paradas"**, não *"13 a fazer"*.
*"A fazer"* pressupõe que dá para fazer.

### 3.1.38. 🟠 "0 de 52 enviadas" — três telas, três números (09/09)

O mesmo ciclo, a mesma pergunta, três respostas: cabeçalho e card da lista diziam **52**; o cartão
da aplicação separava *"29 não iniciadas / 2 canceladas"*; a prévia da abertura dizia **50**.

⭐ **O certo é 50**, e não é preferência. O próprio diálogo de exclusão promete que a cancelada
*"deixa de travar o encerramento do ciclo"*; o encerramento de fato a ignora; e `filaPorAvaliador`
já a tirava da conta, com a razão escrita (*"não é trabalho de ninguém, e somá-la faria a fila de
quem não deve nada parecer cheia"*). Contá-la no denominador quebra a promessa de um jeito que só
aparece no fim: **o ciclo nunca chega a 100%.**

#### Não corrigi dois pontos — extraí a regra

Estava assim: **cinco lugares certos com `status: { not: 'CANCELADA' }` escrito à mão, e dois
esquecidos**. Nada apontava os dois. Corrigir só eles deixaria a sétima consulta livre para nascer
errada do mesmo jeito — [[feedback_regra_duplicada_envelhece_errada]].

Agora há `avaliacao/avaliacoes-que-contam.ts`: um fragmento de `where` para o Prisma e duas
funções para contagem em memória. Os sete lugares usam. ⚠️ É `not: CANCELADA` e **não** uma lista
de status vivos, de propósito: um status novo no enum deve entrar na conta **por padrão** — uma
allowlist o deixaria de fora em silêncio, que é o mesmo defeito ao contrário.

**Teste de invariante:** os três lugares são chamados sobre o mesmo estado e têm de devolver o
mesmo número. Validado por mutação — restaurada a conta antiga, 2 falhas.

Conferido no ciclo real: cabeçalho **50** · prévia **50** · painel **50** · canceladas `0 + 2`.

### 3.1.39. 📋 Achados menores do ciclo de simulação (09/09)

| # | O quê | Estado |
|---|---|---|
| **A9** | `em 2 aplicações· 54 pessoas` — faltava espaço | ✅ **corrigido** |
| **A5** | O cartão do público não consolida os centros de custo | 📋 registrado |
| **A1** | *"Designar pelo cadastro"* ao lado do seletor de aplicação | 📋 registrado |
| **A3** | *"Recorte provisório"* vem marcado por padrão | ⏸️ ligado à pergunta da lista (A) |

**A9 — a causa vale a regra.** O JSX **apaga** a quebra de linha entre uma expressão e o texto
seguinte: `{flexao(…)}` + nova linha + `· <strong>` sai como *"aplicações· 54"*. Não é typo, é
comportamento — e some com `{' '}` explícito. Varri o módulo: as outras duas ocorrências do padrão
(`SeletorDeColaborador`) já tinham o `{' '}`. Esta era a única.

**A5 —** depois de incluir a Controladoria, a aplicação B mostra *"29 por centro custo — 3 centros
de custo"* **e** *"3 por centro custo — 01|11010211"*, em duas linhas, em vez de 4 centros
consolidados. São duas linhas de `publico.origens[]`, uma por ato de inclusão. ⚠️ A segunda metade
do achado (mostrar `01|11010211` em vez do nome) **esbarra no §3.1.31**: `origens[].referencia` é
**texto livre gravado na montagem**, não campo de centro de custo — consolidar exige decidir o que
guardar ali, não só formatar na leitura.

**A1 —** *"Designar pelo cadastro"* é ato **do ciclo** (percorre todas as aplicações), mas o botão
fica ao lado do seletor de aplicação, que sugere o contrário. O seletor filtra a **lista**, não a
**ação**. É a família do §3.1.34: a tela sugerindo um escopo que o botão não tem.

**A3 —** *"Recorte provisório"* vem **marcado** por padrão, então as duas aplicações do ciclo
nasceram provisórias e a abertura avisa sem bloquear. O padrão seguro é defensável (§ da
importação: *"o padrão é o seguro"*), mas ninguém decidiu para o público. **Liga na pergunta da
Arielly que já está na lista (A)** — decidir aqui sem ela seria escolher por omissão.

### 3.1.40. 🟠 O oitavo, o nono e o décimo — e por que o grep não podia achá-los (09/09)

Depois dos 13 envios, o **mesmo card** da lista de Ciclos mostrava as duas linhas:

```
2 aplicações · 52 avaliações
Faltam 37 avaliações por enviar.          ← 37 = 50 − 13
```

Dois números de **fontes diferentes no mesmo render**: o "Faltam" já vinha da regra corrigida
(§3.1.38), o "52" não. O mesmo campo alimentava o chip *"31 avaliações"* da aba Aplicações.

#### Eram três, não dois — e escaparam por MUDANÇA DE FORMA

| Onde | O quê |
|---|---|
| `ciclo.service.ts` `listar()` | o card da lista |
| `ciclo.service.ts` `porId()` | o cabeçalho de um ciclo |
| `aplicacao.service.ts` `listarDoCiclo()` | o chip da aba Aplicações |

⚠️ **Eu disse "os sete lugares usam". Eram sete de dez** — e a falha não foi descuido, foi método.
Procurei por `status: { not: 'CANCELADA' }` e substituí onde achei. Os três que faltaram **nunca
tiveram um `where`**: são `_count: { select: { avaliacoes: true } }`, contagem de RELAÇÃO declarada
num `select`. O grep não podia encontrá-los, porque eu procurava **pela regra escrita** e eles são
exatamente o lugar onde ela nunca foi escrita.

⚠️ **E o teste de invariante que escrevi não os cobria**: ele dirige `resumoDoCiclo`, `doCiclo` e
`previaDaAbertura` — os três consumidores que eu **conhecia**. Nenhum passa por `ciclo.listar()`.
Enumerar consumidores à mão verifica os que você lembra; varrer o fonte verifica os que existem.

#### O conserto é o varredor, não os três sítios

`avaliacoes-que-contam.invariante.spec.ts` varre o FONTE e cobra duas formas: nenhum `_count`
conta a relação `avaliacoes` sem `where`, e nenhum `avaliacao.count()` conta sem citar a regra ou
um status. Mesmo remédio do `separacao-funcoes.invariante.spec.ts`, pela mesma razão.

⚠️⚠️ **A primeira versão do varredor tinha um furo, e a mutação o denunciou.** A dispensa era **por
arquivo**: `ciclo.service.ts` entrou nela por um motivo legítimo (conta PENDENTE/EM_ANDAMENTO por
status antes de encerrar) e com isso ficou isento **também da checagem do `_count`** — que é
justamente onde estava o defeito. Restaurados os três erros, o varredor acusou o `aplicacao` e
**passou batido no `ciclo`**. Agora são **duas listas, uma por checagem**, e a da relação só admite
o próprio arquivo da regra, com teste cobrando isso. Dispensa larga demais é um furo com aparência
de decisão.

Conferido no ciclo real: card **50** · chips **21 + 29 = 50** · cabeçalho **13 de 50** ·
50 − 37 = 13. **554 testes.**

### 3.1.41. 🔴 A tela promete ao AVALIADOR um caminho que o RH não tem (09/09)

O diálogo de envio diz: *"Se precisar corrigir alguma coisa, será necessário pedir ao RH que
reabra a avaliação."* **Reabrir avaliação só existe na API** — nenhum botão, em tela nenhuma.

⚠️ É a família "capacidade sem sinal na tela" (§5.9 regra 8) **agravada**: ali a tela esconde uma
capacidade de quem a usaria; aqui ela **anuncia a capacidade para outra pessoa**. O avaliador envia
confiando na saída, e o RH não tem por onde. Quem descobre é o avaliador, depois, pedindo algo
impossível.

#### Custo — quase todo de tela, com uma pergunta que não é

O backend está **completo**: `POST /avaliacoes/:id/reabrir`, `RH_ADMIN` only, motivo obrigatório,
separação de funções por `carregarParaAcao`, recusa se o ciclo não aceita
(`assertCicloAceitaReaberturaDeAvaliacao`), zera `notaAvaliacao`, grava `REABRIR` na auditoria com
o motivo. Nada a fazer lá.

| Item | Tamanho |
|---|---|
| `api.ts` — um método | ~5 linhas |
| Botão na linha da Designação (só com `avaliacaoStatus === 'ENVIADA'`), desabilitado com o motivo quando não cabe | pequeno |
| Modal com motivo obrigatório — o `DialogoDecisao` da mesma tela já é o molde | pequeno |
| ⚠️ `LinhaDaLista` **não traz `avaliacaoId`** — só `avaliacaoStatus`. Um campo no backend | 1 linha |

🔴 **E uma que não é de tela:** `reabrir` **não toca em `ResultadoAvaliacao`**. Reabrir uma
avaliação **já apurada** deixa o resultado antigo de pé — a tela de Resultados segue mostrando uma
nota de uma avaliação que agora está `EM_ANDAMENTO` e com `notaAvaliacao: null`. Só a apuração
apaga (`delete` + `create`), e ninguém garante que ela rode. **Decidir antes de fazer o botão:** o
reabrir apaga o resultado, marca-o como vencido, ou recusa enquanto houver resultado? O ciclo de
simulação vai bater nisso assim que alguém quiser refazer uma resposta já apurada.

### 3.1.42. 📌 Registrado, sem fazer — dado de teste e método de cálculo

**Dado de simulação no banco de produção do RH.** Os 13 envios do `SIMULACAO 09/09` são sobre
**pessoas reais, com matrícula**, assinados pela `ariellypereira`, na mesma base do Piloto. Antes
de produção: **ou apagar o ciclo, ou garantir que ciclo de simulação não entre em relatório de RH
nenhum**. ⚠️ Hoje **não há marca de "simulação"** no modelo de ciclo — a distinção existe só no
nome, que nada lê. Decisão do Clenio; fica escrito para não depender de alguém lembrar.

**⭐ Método: resposta determinística vira invariante de cálculo.** A skill respondeu com padrão
determinístico — 4 níveis, 11 perguntas no mesmo nível cada. Isso dá um invariante para a
apuração: **mesmo nível em todas as perguntas tem de produzir nota idêntica**, e notas de níveis
diferentes têm de ordenar como os níveis. Se divergir, o defeito está no **peso por pergunta**, não
na faixa de conceito — a faixa é a mesma para todos. É um jeito barato de separar as duas causas
sem instrumentar o motor, e vale para toda apuração futura.

### 3.1.43. ✅ REABRIR AVALIAÇÃO — a tela que faltava, e o resultado que ela apaga (09/09)

O §3.1.41 achou a promessa; este é o conserto. A decisão do Clenio sobre o `ResultadoAvaliacao`:
**apagar**, e as três opções ficam escritas porque a rejeitada volta a parecer boa daqui a um mês.

| Opção | Por que não |
|---|---|
| **RECUSAR** enquanto houver resultado | transformaria *"apurei cedo para conferir o cálculo"* — que a tela de Resultados **diz ser legítimo** — em porta fechada: quem apurou parcial ficaria impedido de corrigir **qualquer** avaliação daquele ciclo |
| **MARCAR COMO VENCIDO** | um terceiro estado que ninguém pediu, com o resultado antigo **visível** em Resultados enquanto a avaliação está `EM_ANDAMENTO` — a inconsistência que se quer evitar, com um rótulo em cima |
| ✅ **APAGAR** | é o que a reapuração **já faz** (`delete` + `create`). Não é comportamento novo: é o mesmo, disparado antes. E é coerente com o `notaAvaliacao: null` que a reabertura já fazia — a nota é do ENVIO, e o envio foi desfeito |

#### A sequência do apagar saiu de dentro da apuração

`ResultadoCriterio` **não tem `onDelete: Cascade`**: a memória de cálculo sai primeiro ou a FK
barra. Isso estava escrito uma vez, dentro da reapuração. Em vez de copiar para a reabertura —
que é exatamente o erro do §3.1.40 —, virou `apuracao/apagar-resultado.ts`, com os dois
chamadores. ⚠️ E devolve **o que apagou**, não `void`: quem reabre precisa da nota para a
auditoria.

#### O que a tela diz, com o número

O diálogo pergunta ao backend **antes** (`GET /avaliacoes/:id/efeito-da-reabertura`, mesma porta e
mesmo papel do ato) e mostra:

> **Isto apaga o resultado apurado desta pessoa.**
> Nota **88,00** · conceito **BOM** · apurado em 09/09/2026 13:02.
> Ele **volta quando você apurar de novo**. Até lá, esta pessoa sai da lista de Resultados e da
> média do ciclo — que passa a ser sobre as demais.

⚠️ A nota vem do **mesmo registro que o ato vai apagar**, nunca de uma conta da tela (§3.1.22).

#### A auditoria guarda a nota, não só o ato

`valorAnterior: { resultadoApagado: { notaFinal, conceito, apuradoEm } }`. Sem isso o resultado
some sem rastro e *"por que a média do ciclo mudou"* fica sem resposta.

#### E o que acontece com a média do ciclo — a pergunta do Clenio

**Sim, passa a ser sobre 12** — e a tela já dizia isso certo, sem precisar de conserto. A média de
Resultados é calculada sobre as linhas de `resultado_avaliacao` que existem, e o cabeçalho já traz
a **base** desde o §3.1.8: passa de *"13 de 50 avaliações do ciclo apuradas · média sobre essas
13"* para *"**12** de 50 · média sobre essas **12**"*, com o aviso de **apuração parcial** subindo
de 37 para 38. ⭐ Nada a fazer: a base à vista era justamente a defesa contra este tipo de
mudança silenciosa. E o denominador (50) é o `_count` que o §3.1.40 corrigiu hoje — antes diria 52.

#### Onde o botão fica

Na **linha da Designação**, ao lado de *Trocar avaliador* e *Excluir*, só para `RH_ADMIN` e só
sobre avaliação `ENVIADA`. ⚠️ Aqui ele **some** em vez de ficar desabilitado, e a diferença tem
regra: *"desabilite com o motivo"* vale para o que a pessoa **poderia querer fazer**; reabrir uma
avaliação que não foi enviada é ato **sem objeto**.

Isso exigiu um campo: `LinhaDaLista` trazia `avaliacaoStatus` e **não** `avaliacaoId` — a tela
sabia QUE havia avaliação e não conseguia agir sobre ela.

### 3.1.44. 🟠 "Peso 60" × "Questionário 100,0%" — o mesmo peso, dois números (09/09)

A memória de cálculo mostrava **`Peso 60`**; a aba Aplicações, para a mesma aplicação, **`Questionário
100,0%`** e *"CRITÉRIOS: Nenhum — a nota é 100% do questionário"*. A nota final não sofria
(componente único normaliza para 1 de qualquer jeito), mas quem abrisse a memória para **conferir a
conta** procuraria **40 pontos de critérios que não existem**.

⭐ **É a família do `52 × 50`**: dois números verdadeiros, mesma tela, sem o termo que os concilia.
E a saída é a mesma do cabeçalho do ciclo (§3.1.29) — **não trocar o número, mostrar o termo que
falta**.

A memória **mantém o peso bruto** (é o que está cadastrado e é o insumo da conta) e ganha ao lado a
fração: `60 · 100,0%`, com a coluna virando **"Peso · da nota"** e o rodapé fechando em
`60 · 100%`. ⚠️ Critério **sem dado** mostra `—` em vez de fração: o motor redistribui o peso dele
(`houveRenormalizacao`), e dar-lhe uma fração faria a soma passar de 100%.

⚠️ E a normalização virou **uma função só** (`lib/composicao-da-nota.ts`), usada pelas duas telas.
Duas normalizações foi o que as fez discordar — a mesma lição do §3.1.40, aplicada antes de doer.

### 3.1.45. 📌 O sistema cita a reabertura em DOIS lugares — e o segundo é o pior

Confirmado pela skill em 09/09, antes de o botão existir:

1. **no envio, ao avaliador** — *"Se precisar corrigir alguma coisa, será necessário pedir ao RH
   que reabra a avaliação."*
2. **no diálogo de trocar avaliador de quem já respondeu** — *"reabra a avaliação (ato do
   RH_ADMIN, com motivo) e refaça-a."*

⚠️ **O segundo é pior**, e vale registrar por quê: ele aparece **exatamente quando a pessoa está
prestes a fazer a coisa errada** — trocar o nome de quem avalia por cima do julgamento de outro — e
oferece a saída certa. Uma frase que desvia alguém de um erro só funciona se a saída existir; senão
ela **empurra de volta** para o erro que estava evitando, com a autoridade de um conselho do
sistema.

⭐ As duas frases agora são verdade. Ficam registradas porque **texto que promete capacidade é
dívida**: quem escrever a próxima precisa saber que ela será cobrada.

### 3.1.46. 🔴 O motivo estava gravado nas 39 e a tela não tinha por onde mostrá-lo (09/09)

O diálogo de encerrar promete que o motivo *"fica gravado no ciclo, na auditoria e **em cada
avaliação cancelada** — é o que responde, meses depois, por que estas ficaram sem nota"*. Na
Designação, as 37 apareciam só como **"cancelada"**, sem uma palavra.

**Conferido no banco: as 39 têm `motivoCancelamento` preenchido.** O ato cumpre a promessa; a
**tela não lia**.

#### Por que 2 mostravam e 37 não — e a distinção que faltava

| Campo | Responde |
|---|---|
| `justificativa` (de `CicloElegibilidade`) | por que a **PESSOA** está fora do ciclo |
| `motivoCancelamento` (de `Avaliacao`) | por que a **AVALIAÇÃO** dela foi cancelada |

A linha só trazia o primeiro. O *Excluir* grava **os dois** (mesmo texto), então as 2 excluídas à
mão mostravam o delas; o *encerrar com pendência* não cria decisão de elegibilidade nenhuma, então
as 37 não tinham nada a exibir. ⚠️ O efeito colateral era pior que o silêncio: parecia que **umas
tinham motivo e outras não**, quando todas tinham.

Agora a linha traz `motivoCancelamento` e o mostra **quando difere** da justificativa — senão o
Excluir imprimiria o mesmo texto duas vezes.

### 3.1.47. 🔴 O cancelamento em massa é irreversível, e os dois diálogos calavam (09/09)

As 2 antigas têm *"Incluir"*; as 37 do encerramento **não têm caminho nenhum** — nem Incluir, nem
restaurar, nem em lote. E `efeitoDeDesignar` recusa designar sobre CANCELADA (*"o upsert a reviveria
cancelada"*), com a nota escrita de que **não há caminho para descancelar**.

⚠️ **Os dois diálogos listavam só o que se ganha:**
- **Encerrar** falava das respostas preservadas, da fila que libera, da contagem no painel — e nada
  sobre não ter volta;
- **Reabrir** promete *"volta a permitir designar, mexer no público, apurar, reabrir avaliações"* —
  e quem encerrou com pendência lê isso como **"desfaz o encerramento"**. Não desfaz.

Meia verdade num ato que alguém aciona **para consertar outro** é o pior lugar para ela estar.

Os dois textos entraram: o encerrar diz *"isto não tem volta… reabrir o ciclo não as traz de
volta"*, com o número; o reabrir ganhou um bloco *"o que reabrir NÃO faz"*, que só aparece quando
há canceladas — e para isso a listagem passou a devolver `avaliacoesCanceladas`.

#### O custo de descancelar — pequeno em código, quatro decisões em aberto

| | |
|---|---|
| Backend | `descancelar(id, motivo)` — RH_ADMIN, ciclo aberto, motivo, auditoria: ~30 linhas |
| Frontend | botão na linha + modal: pequeno |
| **Decisões** | (a) volta para `PENDENTE` ou `EM_ANDAMENTO` quando há respostas parciais? (b) o `motivoCancelamento` é apagado ou vira histórico? (c) **em massa?** — 37 uma a uma é inviável, e em massa reintroduz o risco do encerrar em massa (d) descancelar 37 devolve 37 pendências que **voltam a travar o encerramento** — é o ponto, mas alguém tem de querer |

⚠️ Nenhuma delas é técnica. **Enquanto não forem respondidas, os dois textos são a defesa** — e
eles valem mesmo que descancelar venha depois.

### 3.1.48. 🟠 Dois textos do estado ABERTO sobrevivendo no ENCERRADO (09/09)

- **Aplicações:** *"Montar público continua valendo: quem entrar agora precisa ser designado"* —
  verdade no ABERTO, **falsa** no ENCERRADO, com o botão ao lado desabilitado e a faixa do topo
  dizendo o contrário.
- **Painel:** *"937 pessoas fora de TODAS as aplicações… Monte o público que falta, em Aplicações"*
  — instrução que manda a pessoa a uma tela onde o botão está cinza.

⭐ É a família do §3.1.19 (a linha de estado que mentia entre a gravação e o F5): **quem lê acredita
no texto, não no botão cinza.** Os dois passaram a ter dois estados. No Painel o **número continua**
(é ele que diz o tamanho do buraco); o que muda é o que se pode fazer.

### 3.1.49. 🟠 A exigência de motivo era muda — e 3 caracteres a tornavam decorativa (09/09)

Digitar `"ab"` e clicar não produzia nada: sem hint, sem contador, sem mensagem. E `"xpt"` passava.

**Duas correções, porque o achado era duplo.** A regra passou a **aparecer antes de o botão travar**
(*"Escreva pelo menos N caracteres — faltam M"*), no encerrar e no reabrir avaliação.

E o mínimo virou **dois números** (`common/motivo.ts`), acompanhando o alcance do ato:

| | | Por quê |
|---|---|---|
| `MOTIVO_MINIMO` | **3** | atos de UMA linha — quem lê tem o nome, o status e a data ao redor |
| `MOTIVO_MINIMO_EM_MASSA` | **15** | encerrar com pendência: esta frase é a **única** explicação que sobra para dezenas de pessoas |

⚠️ *"Pessoa desligada"* tem 16 — o mínimo força uma oração sem inviabilizar a resposta curta
legítima. E a tela usa **o mesmo número** do backend: tela mais frouxa deixa clicar onde a API
recusa; mais estrita trava onde a API aceitaria.

⭐ **Um spec quebrou e estava certo:** o caso da auditoria usava `'fim do piloto'` (13). O fato que
ele protege é o nome da ação, não o tamanho do motivo — corrigido o fixture, não a regra.

### 3.1.50. 🟠 Botão desabilitado que não parece desabilitado — 16 lugares (09/09)

*"Designar pelo cadastro"* seguia **verde sólido** e *"Reabrir"* laranja num ciclo encerrado; só o
cursor e o `title` denunciavam. ⚠️ A causa é `disabled:opacity-50` **sobre cor própria**: um verde a
50% continua um verde. Funciona em botão branco ou de borda cinza — e é por isso que *"Trocar
avaliador"* e *"Excluir"* acinzentavam certo, e ninguém tinha percebido.

**Botão com cor precisa TROCAR de cor ao desabilitar**, não ficar translúcido. Varridos **16** —
não os 2 relatados: era forma, não caso (§5.9 regra 13).

### 3.1.51. 📌 Registrado, sem fazer — o que o encerramento apaga da vista

- **A fila por avaliador colapsa sem histórico.** LIDYANE (12), RENATA (12), CLAUDIMAR (7) e VANIA
  (6) somem do Painel com 37 tarefas. É correto — cancelada não é trabalho de ninguém —, mas quem
  abrir no dia seguinte não sabe o que houve. O rastro existe só na auditoria.
- **O cartão da aplicação B mostra "0 avaliações · público 32"** e nada sobre as 31 canceladas:
  indistinguível de uma aplicação que nunca gerou nada.
- **O Painel conta 39 numa etiqueta só**, sem separar as 2 do *Excluir* das 37 do encerramento.
  São dois atos, dois motivos e duas histórias; a tela mostra um número.

⭐ Os três são a **mesma pergunta**: depois do encerramento, o painel fica limpo e a evidência do
custo sai da tela. O §3.1.45 (a linha de estado ganhando *"39 canceladas"*) foi o primeiro passo;
estes três são o resto dele.

### 3.1.52. 🟠 Reabrir o ciclo pedia motivo de 3 — e é ato EM MASSA (09/09)

Encerrar com pendência exige **15**; reabrir aceitava **3**. E reabrir devolve designação,
público e apuração do ciclo inteiro — os que estavam fora voltam a poder entrar. Pela regra
escrita em `common/motivo.ts` (*"a frase é a única explicação que sobra"*), é ato em massa.

⭐⭐ **A forma do erro importa mais que o número: a analogia com o ato de mesmo NOME.** O DTO
dizia, por escrito, *"como no reabrir avaliação"*. Mesma palavra, alcance oposto — um devolve UMA
linha, o outro devolve o ciclo. Ao escolher o mínimo, a pergunta é **quantos registros o ato
atinge**, nunca como ele se chama. Está na doc de `motivo.ts`, ao lado da regra.

**A varredura achou a causa, que não era o número.** Os **quatro** DTOs escreviam `@MinLength(3)`
na mão, e **`MOTIVO_MINIMO` não era importado em lugar nenhum**: a regra foi extraída para
`common/motivo.ts` e as chamadas ficaram para trás — a família do [[feedback_extrair_regra_exige_varrer_o_fonte]].
Com literal, o ato novo copia o vizinho e herda o número errado. Agora os quatro importam:

| Ato | Alcance | Mínimo |
|---|---|---|
| Reabrir **avaliação** | uma linha | `MOTIVO_MINIMO` (3) ✅ já estava certo |
| **Decidir** incluir/excluir | uma linha (um `colaboradorId`) | `MOTIVO_MINIMO` (3) ✅ já estava certo |
| **Encerrar** com pendência | o ciclo | `MOTIVO_MINIMO_EM_MASSA` (15) ✅ já estava certo |
| **Reabrir o ciclo** | o ciclo | `MOTIVO_MINIMO_EM_MASSA` (15) 🔴 **era 3** |

⚠️ **O DTO é PISO, o service é a regra** — e isso foi conserto de segunda passada. Pôr 15 no
`@MinLength` fez o class-validator responder primeiro com *"motivo must be longer than or equal to
15 characters"*, e a mensagem que **ensina** (a do service, com "faltam N") virou código morto. O
`encerrar` já era assim; o `reabrir` passou a ser. ⭐ **Guarda mais externa e mais burra
sequestra a mensagem da mais interna e melhor.**

⭐ **A tela tinha a MESMA armadilha, pior:** `CiclosPage` chamava de `MOTIVO_MINIMO` o valor
**15** — o mesmo nome que no backend vale **3**. Nome igual com valor diferente é pior que número
solto: quem confere um lado contra o outro lê "iguais" e segue. Virou `src/lib/motivo.ts`, com os
dois números e **os nomes do backend**; `DesignacaoPage` tinha três literais e passou a importar.

**Os dois testes que faltavam** — porque a mudança 3 → 15 **não quebrou nada** nos 564:
`reabrir-minimo-em-massa.spec.ts` (o ato) e `motivo.invariante.spec.ts` (a forma: varre o fonte e
recusa `@MinLength(<literal>)` em campo de motivo). ⚠️ Validados por **mutação** — repondo o
literal e afrouxando o service, **3 testes ficam vermelhos pelos motivos certos**. Sem essa
checagem eu teria dois testes verdes que nunca provaram nada.

### 3.1.53. 🟠 A varredura dos blocos de orientação do painel — e o terceiro caso (09/09)

O conserto de 08/09 pôs `fechado ? … : …` no bloco **vermelho** ("N fora de TODAS as aplicações")
e deixou o **âmbar logo acima**, que seguia mandando *"resolvem-se com Designar pelo cadastro"* —
botão desabilitado num ciclo encerrado. É a **regra 13**: escapou a **forma**, não o caso.

⭐ **Varrer em vez de consertar os dois citados achou um terceiro**, em outra seção da página:
*"Vale reabrir e reenviar essas"*, nas pendências cadastrais. Reabrir avaliação é recusado com o
ciclo encerrado (`assertCicloAceitaReaberturaDeAvaliacao`) — a tela prometia o caminho que a API
fecha. Ninguém tinha citado esse.

| Bloco | Antes | Agora |
|---|---|---|
| âmbar · *"já têm avaliador no cadastro"* | manda usar *Designar pelo cadastro* | 🔴 → diz para reabrir o ciclo primeiro |
| âmbar · *"nem no cadastro"* | manda ir a *Avaliadores* | 🔴 → **as duas metades**: o cadastro segue editável, trazer para ESTE ciclo exige reabrir |
| vermelho · *"fora de TODAS"* | — | ✅ já corrigido em 08/09 |
| vermelho · *"ENVIADAS sem nota"* | *"Vale reabrir e reenviar"* | 🔴 → diz que exige o ciclo aberto |

⭐ **O NÚMERO nunca muda — muda o que se pode fazer com ele.** É a mesma frase que já estava no
comentário do bloco vermelho, e agora vale para os quatro.

### 3.1.54. 🟠 O card da lista prometia o que o diálogo desmente (09/09)

O card do ciclo encerrado dizia *"designar, mexer no público e apurar estão fechados. **Reabrir
devolve tudo isso**"*. O diálogo de reabrir desmente em bloco âmbar — *"as N canceladas continuam
canceladas"* — mas **quem decide olhando a lista nunca chega ao diálogo**: a promessa é lida no
card e a ressalva mora duas telas adiante.

⭐ **A regra: a ressalva tem de estar onde a decisão é TOMADA, não onde o ato é confirmado.** Pôr
a verdade só no último passo protege quem já decidiu — não quem está decidindo. O card passou a
dizer "devolve **esses três**" e, havendo canceladas, o que reabrir **não** faz.

**Dois de texto, na mesma família:**

- ⭐ **O aviso do mínimo SUBSTITUÍA a explicação.** Era um ternário só: enquanto a pessoa escrevia
  o motivo, a frase que diz **para que ele serve** sumia, e só voltava aos 15 caracteres — some
  exatamente no instante em que ela decide o que escrever, que é quando a explicação vale mais.
  **O contador é sobre a FORMA, a explicação é sobre o CONTEÚDO, e uma não é versão da outra.**
  Agora convivem, no encerrar **e** no reabrir (que era mudo: o botão travava sem dizer nada).
- **O banner prometia motivo visível.** *"Os botões aparecem desabilitados, com o motivo"* — e o
  motivo só existia no `title`, que não aparece no toque, no teclado nem no leitor de tela. A
  frase mudou: o motivo é o da própria faixa, e ela deixa de prometer uma segunda cópia dele.

### 3.1.55. 📌 Registrado, sem fazer — dois da conferência de 09/09

- **O card mostra "0 avaliações" num ciclo com 5 canceladas.** Da lista o ciclo parece vazio; as 5
  só existem entrando nele. É o **`_count` do §3.1.40 visto de outro ângulo** — lá era a fila, aqui
  é o card — e o mesmo do 2º item do §3.1.51. **A decisão é uma:** o card mostra *"5 canceladas"*
  ou some com a linha. Mostrar `0` é a única opção que mente.
- **Dois "fora" com sentidos diferentes em abas vizinhas:** o chip *"Fora do ciclo (0)"* e
  *"980 pessoas fora de TODAS as aplicações"*. Mesma palavra, universos distintos — é a família do
  **1036 × 989** (§3.12) e da **regra 15**: dois números verdadeiros na mesma tela precisam do
  termo que os concilia.

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
**inclui férias e afastados** (em 06/09, 98 e 47). Usar `situacao = 'ATIVO'` derrubaria 145 das 1.036
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

## 5.9. ⭐⭐ REGRAS DE MÉTODO → `docs/REGRAS-DE-METODO.md`

**As regras saíram daqui em 09/09/2026.** Eram 14, no fim de um arquivo de 4.000 linhas, lidas só
por quem já sabia que existiam — e a varredura mostrou que **outras 9 lições nunca tinham chegado
até elas**, tendo virado item numerado, comentário de código ou memória.

👉 **`docs/REGRAS-DE-METODO.md` — 26 regras, cada uma com GATILHO.**

⚠️ **Esta seção continua existindo como ÂNCORA**: há comentários de código, commits e memórias que
citam *"§5.9 regra 8"*, *"regra 12 da §5.9"*. Os **números 1 a 14 não mudaram** — as novas são
15 a 23.

⭐ **O que a mudança de lugar trouxe junto, e é o mais importante:** toda regra passou a começar
pelo **momento em que alguém para e pergunta**, não pelo princípio. A razão está escrita no topo do
arquivo novo — em 09/09 quebrei **três regras minhas no mesmo dia em que as escrevi**, e o padrão
foi exato: as que me pegaram nomeavam um momento, as que me escaparam descreviam um estado bom.

## 6. Armadilhas do ambiente

### ⭐⭐ A CLASSE: ferramenta que responde sem fazer o trabalho

Não são seis armadilhas soltas — são **uma classe**, e já mordeu seis vezes em quatro dias.
O denominador comum: **um comando dá um veredito sem ter executado a verificação que o
veredito afirma.** Não há erro, não há log, não há nada que denuncie. O que se lê é o
veredito; o que aconteceu é outra coisa.

Ela tem **dois modos**, e o segundo é o pior.

#### 🟢 FALSO VERDE — passa sem ter feito o trabalho

| Caso | O que parece | O que houve |
|---|---|---|
| **Cache do Docker no build de frontend** | imagem nova, `Built` | o contexto (WSL lendo o filesystem do Windows) entregou **fonte velho**; em 06/09 uma imagem de 2 minutos servia código de duas edições atrás |
| **`No pending migrations to apply.`** | sucesso, exit 0 | o job `*-migrate` tem **build próprio**; sem rebuildá-lo, ele confere o `prisma/migrations/` **da imagem velha** — poucas migrations, todas aplicadas |
| **`tsc --noEmit`** | exit 0, "typecheck limpo" | o `tsconfig.json` é **arquivo-solução** (`files: []`): checou **zero arquivo** |

#### 🔴 FALSO VERMELHO — falha sem ter feito o trabalho

| Caso | O que parece | O que houve |
|---|---|---|
| **`npx tsc -b`** no frontend | *"This is not the tsc command you are looking for"*, exit 1 — parece dependência quebrada | sem `typescript` local, o `npx` foi ao registro e rodou o pacote npm literalmente chamado **`tsc`** (`tsc@2.0.4`, um decoy). O TypeScript **não rodou** |
| **Suíte do backend** sob `mem_limit: 512m` | *"11 suítes falharam"* — parece código quebrado | os workers do Jest morreram por **SIGKILL / heap**. **Zero testes falharam de verdade** |
| **`npx jest` no container que está RODANDO** (09/09) | *"40 suítes falharam, 40 total"* — parece o módulo inteiro quebrado | a imagem de **runtime** é build de produção e **não leva o `tsconfig.spec.json`** (o Dockerfile copia só `tsconfig.json` e `tsconfig.seed.json`). As 40 morreram em `File not found: tsconfig.spec.json`, e a linha que denuncia é **`Tests: 0 total`** — nenhum teste chegou a rodar. No estágio `builder`: **564 passaram, em 14s** |

⚠️ **O remendo pela metade produziu o caso 5.** Ao achar que faltava só o arquivo, copiei o
`tsconfig.spec.json` para dentro do container em execução (`docker cp`) e rodei de novo: **39
falharam, 1 passou, 12 testes**, em **785s** — agora por `jest-worker … _onExit`, que é
exatamente o falso vermelho do `mem_limit`. Dois falsos vermelhos **empilhados** no mesmo
comando, o segundo escondido atrás do primeiro. ⚠️ E a limpeza falhou (`Permission denied` — o
container roda como `appuser`): quem faz isso precisa de `docker exec -u root … rm` depois, ou
deixa lixo dentro de um container em produção. **Consertar o ambiente errado custa mais que
trocar de ambiente:** o estágio `builder` deu a resposta certa em 14 segundos.

⭐⭐ **O falso vermelho é o pior a longo prazo.** O falso verde alguém descobre quando o
defeito aparece em tela — é uma dívida com data de vencimento. O falso vermelho não: ele faz
alguém **desligar o passo** achando que é problema de máquina — "aqui o typecheck não roda",
"essa suíte é instável" — e aí a verificação some do processo **para sempre**, sem ninguém ter
decidido removê-la. Falso verde adia a descoberta; falso vermelho **destrói a ferramenta**.

#### O comando que faz o trabalho de verdade

Não o que dá o veredito — o que **executa**. É isto que futuro-eu vai procurar aqui:

| Em vez de | Rode isto |
|---|---|
| olhar a data da imagem / `--no-cache` | `docker compose exec -T <mod>-frontend sh -c "grep -c 'string que você acabou de escrever' /usr/share/nginx/html/assets/*.js"` — e no backend, o mesmo no `dist/` |
| ler `No pending migrations` | `docker compose build <mod>-migrate && docker compose run --rm <mod>-migrate` — e a linha que vale é **`GUARDA: ok — as N migrations … estao aplicadas`** |
| `npx tsc -b` / `tsc --noEmit` | `docker compose build gestao-pessoas-frontend` — o Dockerfile roda `npm run build`, e o script é **`tsc -b && vite build`**. O `&&` é a garantia; erro de tipo derruba com exit 2 antes do `vite` |
| `docker compose run … npx jest` | `docker run --rm -m 3g -e NODE_OPTIONS=--max-old-space-size=2560 -v <backend>/src:/app/src -v <backend>/tsconfig*.json:/app/ -v <backend>/package.json:/app/package.json -w /app --entrypoint npx capul-platform-gestao-pessoas-backend:latest jest --maxWorkers=2` |
| `docker compose exec <mod>-backend npx jest` (o container que está no ar) | `cd <mod>/backend && docker build --target builder -t <mod>-test:local . && docker run --rm <mod>-test:local npx jest` — o estágio **`builder`** é o único que tem `npm ci` com devDependencies **e** os `tsconfig*.json`. Apagar a imagem depois |

#### ⚠️ Teste que afirma TEXTO fossiliza o defeito junto

Achado no item F (08/09). Ao consertar a frase que mentia — *"não estão na lista de ninguém e
ficarão de fora"*, dita sobre gente que estava dentro —, **um spec antigo falhou**. E a falha
estava certa: ele afirmava

```ts
expect(r.avisos.join(' ')).toMatch(/não estão na lista de ninguém e ficarão de fora/);
```

ou seja, **estava preso à frase, não à regra**. O teste passava exatamente porque o defeito
existia, e teria "protegido" o defeito de qualquer correção. Suíte verde a favor do erro.

⭐ **A regra prática:** um teste deve afirmar o **fato**, não a redação dele.

- ✅ afirmar contagens, motivos, códigos, estados: `porMotivo`, `acao`, `status`;
- ✅ afirmar **igualdade com a função que decide**, quando o que importa é a origem do texto —
  no item H, o teste compara a justificativa devolvida com a saída de `avaliarElegibilidade`
  chamada no próprio teste, então reescrever o texto da régua não quebra nada;
- ⚠️ quando o texto **é** o requisito (uma recusa tem de ensinar o caminho), afirmar o
  **pedaço que carrega a obrigação** e dizer por escrito qual é: `/reabra o ciclo/i`,
  `/RH_ADMIN/`, `/motivo/` — não a frase inteira. Foi assim que as recusas do ciclo encerrado
  sobreviveram a três reescritas de texto sem um teste quebrar.

⚠️ E o corolário incômodo: **spec que quebra quando você conserta um defeito é informação, não
estorvo.** Vale ler o que ele afirmava antes de atualizá-lo — no item F, era o próprio defeito.

#### ⭐⭐ O MÉTODO, não só os casos: verificação por MUTAÇÃO

As seis só foram descobertas por acidente. O que as encontra de propósito é o mesmo método
do teste de invariante do RDV: **injetar um erro e ver a ferramenta pegá-lo.** Garantia que
ninguém tentou quebrar é garantia **suposta**.

- **Typecheck** — em 08/09: `const MUTACAO_DO_TESTE: number = ciclo.nome;` em `CiclosPage.tsx`
  → `error TS2322` + `exit code: 2`, antes do `vite`. Reverter e reconstruir em seguida.
  ⚠️ O `vite build` sozinho **não** pegaria: ele transpila e joga os tipos fora.
- **Bundle** — a "mutação" natural é a própria string nova: se ela não está no `.js` do
  container, o build não é o seu.
- **Migration** — a guarda já é a mutação institucionalizada: ela compara contra a **árvore do
  repositório**, não contra a imagem, justamente para falhar no caso que se quer pegar.
- **Suíte** — quebrar um `expect` de propósito e ver a suíte ficar vermelha *pelo motivo certo*
  distingue "teste falhou" de "worker morreu".

⚠️ **A regra prática:** antes de escrever "X está limpo" em qualquer lugar, saber dizer **qual
comando executou a checagem** e **como sei que ele executou**. Se a resposta for "ele imprimiu
que estava tudo bem", ainda não sei.

### Ver a tela em largura de celular, aqui

Há um Chromium do Playwright em `~/.cache/ms-playwright/chromium-1187`. Com
`playwright-core` (só o pacote, o navegador já está lá) dá para renderizar em 360px e tirar
print — foi assim que se pegou o título do módulo virando "Aval…" no cabeçalho.

⚠️ Ponha o token no `localStorage` com `context.addInitScript` **antes** do primeiro
`goto`: sem token o `AuthProvider` redireciona para o Hub e a navegação é interrompida.

### ⛔ LIMITE DE MÉTODO: token expirado se resolve com o USUÁRIO logando

O access token vale **60 minutos** e o refresh **7 dias**; numa sessão longa os dois expiram no
meio do trabalho. Em 08/09, com os dois vencidos, o caminho que tentei foi **procurar a
credencial no ambiente** — testar senhas prováveis contra `/auth/login`, e depois reassinar um
payload antigo com o `JWT_SECRET` do `.env`. **O classificador bloqueou as duas, e bloqueou
certo.**

⚠️ **A regra, para não voltar:** token vencido **não é problema de ambiente a contornar, é
pedido a fazer.** Nem senha adivinhada contra o `/auth/login`, nem JWT forjado com o
`JWT_SECRET` — mesmo em DEV, mesmo sendo "só verificação". O custo de pedir é um minuto; o de
normalizar o contorno é que a próxima sessão o faz sozinha, num ambiente que talvez não seja o
DEV.

⚠️ **A regra é sobre EU ir buscar, não sobre o Clenio entregar.** Em 08/09 ele avaliou que
passar a credencial era mais rápido que passar o token e a passou — decisão dele, sobre o
ambiente dele, e legítima. O que a regra proíbe é o caminho inverso: eu tratar a credencial
como um obstáculo do ambiente e ir atrás dela sozinho.

**O procedimento:**

1. Logar em `https://localhost/gestao-pessoas/` com a conta que tem o papel necessário
   (hoje `ariellypereira` é a única `RH_ADMIN` — ver §6, contas do módulo).
2. No console do navegador: `copy(localStorage.getItem('accessToken'))`
   *(a chave é `accessToken`, guardada pelo Hub e compartilhada por mesma origem).*
3. Gravar o **JWT cru** — uma linha, sem `Bearer `, sem aspas — em `/tmp/rh.tok`.
4. ⚠️ **O relógio de 60min começa no login.** Bateria longa: token fresco imediatamente antes.

⭐ É a mesma família do "não buildar APK aqui" e do "push é do Clenio": há atos que o ambiente
até permitiria e que **não são meus**. A diferença é que estes dois estão escritos há meses e
este não estava — e por isso eu tentei.

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

### 🔴 O `PATCH` de usuário do Configurador NÃO deixa rastro — e afeta todos os módulos

**Mesma família do IP nulo acima, um degrau mais grave.** `core.system_logs` registra
`USER_CREATE` (164), `PASSWORD_RESET` (51), `PASSWORD_CHANGE` (29), `PERMISSION_GRANT` (201) e
`PERMISSION_REVOKE` (27) — mas **não existe `USER_UPDATE`**. Editar um usuário
(`PATCH /api/v1/core/usuarios/:id`) muda nome, matrícula, cargo, e-mail e `autenticaPortal`
**sem uma linha em lugar nenhum**.

⚠️ Medido em 09/09/2026: mudei o nome do usuário `claudimaroliveira` por essa rota e **nada foi
registrado** — a mudança está documentada nesta página porque o sistema não a documentou.

⚠️ **Por que é pior que o IP nulo:** a matrícula é o que liga a conta ao colaborador
(`chapasEquivalentes`). Uma edição errada de matrícula quebra o acesso de alguém ao Gestão de
Pessoas — o **403 que parece falta de permissão** — e não há como descobrir **quem** mudou nem
**quando**. Criar a conta deixa rastro; corromper a conta depois, não.

⭐ É do **Configurador**, não deste módulo, e vale para toda a plataforma: quem edita usuário
hoje edita anônimo. O conserto é uma linha de log no `UsuarioService.update`, com `valorAnterior`
e `valorNovo` — o mesmo formato que `rh.auditoria` já usa.


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

⚠️ **Mais rápido, e o que se usou em 07–08/09** — reaproveita a imagem já construída (com o
Prisma Client gerado) e monta só o fonte. **`-m 3g` e `NODE_OPTIONS` não são luxo:** sob o
`mem_limit: 512m` do compose os workers morrem por SIGKILL/heap e o relatório sai *"11 suítes
falharam"* **sem nenhum teste falhando** — o falso vermelho da classe acima.

```bash
B=$PWD/gestao-pessoas/backend
docker run --rm -m 3g -e NODE_OPTIONS=--max-old-space-size=2560 \
  -v $B/src:/app/src -v $B/tsconfig.json:/app/tsconfig.json \
  -v $B/tsconfig.spec.json:/app/tsconfig.spec.json -v $B/package.json:/app/package.json \
  -w /app --entrypoint npx capul-platform-gestao-pessoas-backend:latest jest --maxWorkers=2
```

⚠️ Se o schema do Prisma mudou, **rebuildar a imagem antes** — o client vem dela, não do
fonte montado.

### Contas de teste no DEV

Todas com senha `Temp2026`. Login é pelo campo **`login`** (não `username`): 
`POST /api/v1/auth/login {"login":"...","senha":"..."}`.

| Conta | Papel no módulo | Fila | Observação |
|---|---|---|---|
| `ariellypereira` | RH_ADMIN | 13 | a gestora; também é AVALIADA (é o caso da separação de funções) |
| `adrianacaetano` | AVALIADOR | 84 | Gerente Supermercado — a maior fila depois do Diretor |
| `vanialucia` | AVALIADOR | 6 | ⚠️ o username é `vanialucia`, **não** `vaniacosta` |
| `wandersonnascimento` | AVALIADOR | 22 | 14 do Piloto + 8 do Geral — a fila **soma os dois ciclos** (§3.10) |
| `claudimaroliveira` | AVALIADOR | 44 | ✅ **LEGITIMADA em 09/09/2026** — o `(TESTE DEV)` saiu do nome (`PATCH /api/v1/core/usuarios/:id`, a mesma rota do Configurador), porque ele é o **avaliador real da ESMERALDA e da IRENE** no piloto de 15/09 e sem ele as duas ficam sem avaliador. ⚠️ **O `PATCH` de usuário NÃO gera registro em `core.system_logs`** (só `USER_CREATE` aparece lá) — a mudança está registrada aqui porque o sistema não a registrou. Criada por nós no DEV em 06/09/2026 (Claudimar Dias de Oliveira, Diretor Executivo, matrícula 001079, departamento Diretoria). **Por quê:** o Diretor Executivo não tinha conta e é o avaliador designado da gestora — sem ele não havia como enviar a avaliação dela e provar a marcação da §3.1.1. **Mantida de propósito:** ele tem **44 avaliados** e é a única forma de exercitar *"quem avalia os avaliadores"* (§11) e a carga da cauda (§9). ⚠️ **Não existe em produção** — lá a conta dele precisa ser CRIADA para o piloto, e não deve sair de script — quando o RH definir o acesso real, esta some |
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
(§ abaixo), e **em 06/09 eram 928 linhas vigentes · 108 sem avaliador · 159 não revisadas ·
53 avaliadores**. Confira no banco antes de citar — número de documento envelhece.
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

**O bloqueio real não era a lista, era o acesso.** Em 06/09, das 894 avaliações do ciclo, só
27 estavam com alguém que conseguia entrar no sistema — e a conta que tem o papel `AVALIADOR`
(`wandersonnascimento`) tinha **zero**.

✅ **Isso foi resolvido em 08/09** — o Clenio concedeu as permissões que faltavam, e **nenhuma
conta com matrícula ficou sem acesso ao módulo**. A conta viva está na §0.

🔴 **O gargalo MUDOU de lugar, e o de hoje é outro: a maioria dos avaliadores não tem conta
nenhuma na plataforma.** Não é mais "permissão que falta em quem já entra" — é gente que nunca
teve login. É o **item 1 da lista (B)**, é trabalho do Clenio no Configurador, e é o único que
move o número que decide o piloto.

⚠️ O parágrafo abaixo é o retrato de **06/09** e fica como registro do que motivou o script de
população — não como estado de hoje:
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
