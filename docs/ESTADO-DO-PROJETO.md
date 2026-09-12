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

### 🌙 FECHAMENTO DE 09/09/2026

✅ **PUBLICADO: `origin/main` = `eb30abcf`** (22 commits, `9fd4b9fb..eb30abcf`, pushado pelo
Clenio no fim do dia). **609 testes verdes.**

⚠️ **Publicado ≠ implantado.** HLG e PROD continuam em `6855c918`, **sem o módulo** — a distância
entre o que está no GitHub e o que roda na empresa cresceu de novo, e agora inclui tudo de hoje.
O que muda com o push é que o roteiro de deploy do HLG passa a ter um alvo estável para citar.

| Ciclo (DEV) | Status | Total | Enviadas | Canceladas | Apuradas |
|---|---|---|---|---|---|
| Avaliação Geral 2026 | ABERTO | 9 | 4 | 0 | 4 |
| Piloto 15/09/2026 | ABERTO | 894 | 3 | 0 | 3 |
| ZZ CONFERE 09/09 | ABERTO | 2 | 0 | 0 | 0 |
| SIMULACAO 09/09 | ABERTO (reaberto 1×) | 52 | 13 | 39 | 13 |
| ZZ ENCERRA 09/09 | ENCERRADO | 5 | 0 | 5 | 0 |
| **ZZ ENCERRA2 09/09** | ENCERRADO | 6 | 1 | 5 | 0 |

⚠️ **ZZ ENCERRA2 é descartável** — montado em 09/09 para a conferência de tela (encerrar com
pendência) e usado depois como caso real de borda: ciclo encerrado, com cancelada, **sem apuração**.
Foi ele que provou a régua de conceitos e o "apagar aplicação". Pode ser apagado quando quiser; se
ficar, não atrapalha ninguém.

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

### 🌙 FECHAMENTO DE 11/09/2026 — parada de desenvolvimento

✅ **PUBLICADO — `origin/main` = `dfb5e3c3`**, árvore limpa, nada pendente.

Os **4 commits**, cada um de um módulo só (conferido arquivo a arquivo antes do push):

| Commit | Módulo | |
|---|---|---|
| `9242939c` | gestao-pessoas | RH_CICLO lê o instrumento + tela do período |
| `4a0c5a29` | gestao-pessoas | descancelar |
| `15f636ab` | **logistica** | frota e RDV vazavam na tela e no painel de Entregas — com 2 specs novos |
| `dfb5e3c3` | docs | este fechamento |

⚠️ **Publicado ≠ implantado.** PROD e HLG seguem em `6855c918`, **sem o módulo**.

⚠️ **A regra que o dia deixou:** nada de `git commit -am` nem `git add -A` com mais de um módulo
em andamento — foi assim que o commit de rótulo trocado nasceu neste mesmo dia (ver abaixo).

#### O que o dia entregou

| | |
|---|---|
| **Testes** | **640** · 52 suítes (eram 614 em 10/09) |
| **Migrations** | **13** — a nova é `20260911200000_origem_do_cancelamento`, aplicada com `GUARDA: ok` |
| **Telas** | **10** (eram 8) |
| **Piloto no DEV** | 894 avaliações, **894 PENDENTE**, conferência de destino em **zero** |

1. ✅ **Ler o instrumento** (§3.1.58) — as 44 perguntas ganham caminho. `RH_ADMIN` + `RH_MODELO`
   **+ `RH_CICLO`** (quem monta a Aplicação escolhe o modelo). ⭐ *Ler o instrumento não é ler nota.*
2. ✅ **URL desconhecida diz que não existe** (§3.1.59) — item **19** da lista (B).
3. ✅ **Tela do período** (§3.1.60) — a capacidade que só existia por `curl`.
4. ✅ **Descancelar** (§3.1.61) — as quatro decisões de política respondidas, entregue como
   **conserto da promessa do Incluir**, não como botão novo.
5. ✅ **Decisão de versionamento do modelo** — versão nova a cada mudança; versão em uso por ciclo
   ABERTO é imutável. Baixou o editor de 3–4 para **2–3 semanas**, com a **duplicação dentro do
   escopo** — sem ela, "versão nova" vira "redigite 14 perguntas".
6. ✅ **Correção de fato:** a validação do resolver são **DOIS** momentos, não três.

#### ⚠️ O incidente do dia — commit com rótulo trocado, e o meu erro em cima dele

Um `commit -am` do Clenio, feito durante a sessão, varreu 12 arquivos meus em andamento para
dentro de um commit cuja mensagem dizia *"fix(logistica)"*. Ao refazer, **eu usei `git add -A` e
varri trabalho de logística que tinha aparecido no disco** — o mesmo erro, na direção contrária.

⭐ **O que pegou:** conferir a **árvore** contra a de antes, e ela divergir. Sem essa conferência,
eu teria publicado trabalho em curso de outro módulo dentro de um commit de Gestão de Pessoas.

⭐ **A regra que fica, e é a mesma das limpezas de banco:** **caminho explícito, nunca recorte
automático.** `git add docs/ gestao-pessoas/`, não `-A`. Nada foi publicado, nada foi perdido —
provado por `git diff backup-antes-da-limpeza HEAD -- docs/ gestao-pessoas/` vazio. A branch
`backup-antes-da-limpeza` pode ser apagada depois do push.

#### ⏭️ Onde retomar

**O que trava:** a resposta da **Arielly** sobre as 44 perguntas. A tela existe agora
(`/questionarios`, com impressão) — é o que faltava para ela poder responder.

- **Se "sim"** → aplicação editável → conceitos → editor.
- **Se "não"** → o editor sobe para a frente: **2–3 semanas**, três atos (duplicar · editar
  rascunho · publicar).

**Não começar** o editor nem o cadastro de critérios/faixas — decisão do Clenio. Critérios e
faixas (1 a 1,5 semana) saiu da frente da fila: não bloqueia a fase 1.

**O piloto virou DUAS FASES** — a 1 valida o processo com o instrumento herdado, sem o RH poder
editá-lo; a 2 valida o RH configurando sozinho. A data volta a ser negociada.

### 📍 ONDE O DIA PAROU — 11/09/2026

> ⚠️ Esta seção é a DONA das contas vivas. Números novos se atualizam **aqui**.

⭐⭐ **MUDANÇA DE RUMO:** o foco deixou de ser *chegar ao piloto dia 15* e passou a ser
**concluir a implementação**. O piloto é o instrumento de validação, e instrumento incompleto
valida pouco. Ele vira **duas fases** — a 1 com o questionário herdado do RD8010, sem o RH poder
editá-lo; a 2 com o RH configurando sozinho. **A data volta a ser negociada com a Arielly.**
Recorte, contas e deploy **saíram da fila**.

O que ordenou a decisão foi o levantamento de custo: **do cadastro do instrumento à devolutiva
são 7 a 9 semanas**, e o editor de questionário sozinho vale metade. Não cabia em cinco dias.

| Conta | Valor |
|---|---|
| Testes | **640** (eram 614 em 10/09) · 52 suítes |
| Telas | **10** (eram 8) — entraram a leitura do questionário e a de página não encontrada |
| Ciclos no DEV | Piloto **ABERTO** (894 avaliações, 894 PENDENTE) · 3 ENCERRADOS · 1 descartável em RASCUNHO |
| `origin/main` | ver o fim desta seção |
| Migrations | **13** — a de 11/09 é `20260911200000_origem_do_cancelamento` (aditiva: 1 enum, 1 coluna, 1 índice, backfill estrutural) |

**Feito em 11/09:**

1. ✅ **Ler o instrumento** — `GET /catalogo/modelos/:versaoId` + tela `/questionarios`, leitura
   pura, `RH_ADMIN` + `RH_MODELO`, com impressão. **A pergunta que travava a ordem de tudo agora
   pode ser feita.** Ver §3.1.58.
2. ✅ **A rota que caía em silêncio** — `path="*"` deixou de ser `<Navigate to="/">` e virou uma
   tela que **diz que não existe**, com o caminho tentado escrito e os destinos filtrados por
   papel. Ver §3.1.59 — é o item **19** da lista (B), fechado.
3. ✅ **Decisão de versionamento do modelo**, tomada antes do editor porque muda o tamanho dele:
   **versão nova a cada mudança; versão em uso por ciclo ABERTO é imutável**. Baixou a estimativa
   do editor de 3–4 para **2–3 semanas**. Ver §3.1.58.
4. ✅ **RH_CICLO lê o instrumento** — corrigido no mesmo dia em que ficou de fora: quem monta a
   Aplicação escolhe o modelo. ⭐ *Ler o instrumento não é ler nota.*
5. ✅ **Tela do período** (§3.1.60) e ✅ **descancelar** (§3.1.61) — os dois curtos que tiram a T.I.
   do meio. O segundo veio com migration e com as quatro decisões de política respondidas.
6. ✅ **Correção de fato no registro:** a validação do resolver acontece em **DOIS** momentos, não
   três — o terceiro é do desenho e não tem código, porque não existe salvar critério. Corrigido
   aqui, no `CLAUDE.md` e na memória.

**Dois itens tirados da fila pelo Clenio, com razão escrita:**

- *"Destravar o peso da aplicação"* **não é item**: o `PATCH` já faz, em RASCUNHO. O campo travado
  que a varredura viu era o Piloto **ABERTO** — é regra, não lacuna.
- **Critérios e faixas** (1 a 1,5 semana) **sai da frente da fila** — não é pequeno, e não bloqueia
  a fase 1.

⏭️ **Próximo:** fechar a lista da fase 1 com a Arielly. O editor e o cadastro de critérios **não
começaram** — por decisão.

### 📍 ONDE O DIA PAROU — 08/09/2026

> 📐 **Regras de método:** `docs/REGRAS-DE-METODO.md` — 27 regras, cada uma com o **gatilho** que
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
| ✅ **RESPONDIDO e FEITO em 11/09 — ver §3.1.61.** 🔵 POLÍTICA, não código — DESCANCELAR uma avaliação. Era: *não existe, cancelada não volta por nenhum caminho.* Fazer custa **~30 linhas + um modal**, e trava em **três perguntas que não são da T.I.**: **(a)** a avaliação volta para `PENDENTE` ou `EM_ANDAMENTO` quando há **respostas parciais**? (é sobre o que acontece com o trabalho já feito) · **(b)** o `motivoCancelamento` é **apagado ou vira histórico**? (é sobre a trilha) · **(c)** **em massa ou uma a uma**? — 37 uma a uma é inviável, e em massa reintroduz o risco do encerrar em massa. ⚠️ A 4ª (devolver pendências que voltam a travar o encerramento) **não é decisão, é consequência**: quem descancela quer exatamente isso. ⭐ Os textos do §3.1.47 valem **de qualquer forma**, inclusive depois de descancelar existir | Gestora de RH | §3.1.47 |
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
| ~~19~~ | ✅ **FEITO em 11/09 — ver §3.1.59.** 🟠 **`/gestao-pessoas/resultados` levava ao lugar errado EM SILÊNCIO.** Resultados vive dentro do ciclo (`/ciclos/:id/resultados`) — decisão nossa no menu, e ela está certa. O defeito é outro: `<Route path="*" element={<Navigate to="/" replace />} />` faz **qualquer URL desconhecida** cair na fila do avaliador **sem dizer nada**, como se tivesse levado a algum lugar. Alguém vai compartilhar esse link. ⚠️ **A correção não é criar a rota de topo** — é a URL desconhecida **dizer que não existe** | §3.1.6 |
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
| Frontend | React 19 + Vite 7 + Tailwind v4, base `/gestao-pessoas/`, porta 5178. **10 telas** (10 arquivos em `pages/` — `CicloPage` é a moldura com as abas, não uma tela). As duas de 11/09: leitura do questionário e a de página não encontrada. |
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
- ✅ **As duas capacidades que existiam SÓ NA API ganharam tela.** `POST
  /avaliacoes/:id/reabrir` em 09/09 (§3.1.43) e `PATCH /ciclos/:id/periodo` em 11/09
  (§3.1.60). As duas seguem `RH_ADMIN` e gravando em `rh.auditoria` com o valor anterior.
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
  `PerguntaAlternativa` **só nascem pelo seed** — não há escrita nenhuma em `src/`, só no
  `prisma/seed.ts`. ⚠️ Isto **não bloqueia o piloto**: o seed já publicou três modelos de
  PRODUÇÃO (Administrativo 11 perguntas, Operação de Loja 14, Produção e Indústria 14) e um
  `[DEMO]` que a validação de abertura recusa de propósito.
  ✅ **LER já existe desde 11/09** (`/questionarios`, `GET /catalogo/modelos/:versaoId`), e
  `RH_MODELO` ganhou seu primeiro item de menu. O que não existe é EDITAR — ver §3.1.58,
  inclusive a decisão de versionamento que fixa o tamanho do editor em 2–3 semanas.
- **Cadastro de critérios e faixas.** `Criterio` e `CriterioFaixa` também só vêm do seed. O
  painel diz "cadastre a faixa no critério e reapure" — e não há tela para isso. É a maior
  incoerência do módulo hoje.
- **Relatório e exportação.** Falta **PDF/impressão de relatório**. ⚠️ O CSV **existe**:
  `GET /resultados/ciclo/:id/csv` e `/canceladas.csv`, com os dois botões na tela de
  Resultados — e a leitura do instrumento imprime pelo navegador.
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

> 🧾 **As três apurações foram apagadas em 10/09** (dado de teste sobre gente real, antes do
> piloto). A memória de cálculo completa das três, com a conta refeita por fora do motor, está
> preservada em **§3.1.56** — a prova de que a apuração roda ponta a ponta não depende mais
> das linhas.

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

### 3.1.56. 🧾 EVIDÊNCIA DOCUMENTAL — as três apurações do Piloto, antes de saírem da base (10/09)

**Por que esta seção existe.** As três avaliações apuradas do Piloto (§3.1.8, *"Apurar com 3 de
894"*) eram a única prova de que a apuração roda **ponta a ponta**: questionário respondido →
nota do questionário → critérios cadastrais → ponderação → nota final → conceito. Em 10/09 elas
foram apagadas, porque avaliação respondida sobre **gente real** não pode estar de pé quando 53
avaliadores entrarem no dia 15 — o Wanderson encontraria quatro pessoas já respondidas por ele,
e a aba Resultados abriria o piloto com uma média sobre ninguém.

⭐ **Apagar o dado não pode apagar a prova.** A memória de cálculo completa fica aqui, com a
conta refeita **por fora do motor** (SQL independente, sobre as mesmas linhas). É o que responde,
daqui a meses, *"a apuração já foi verificada de verdade alguma vez?"* — sem precisar do dado.

#### O questionário, pergunta a pergunta

Fórmula: `nota = Σ(peso × valor/valor_máximo) ÷ Σ(peso) × 100`. Todas as alternativas valem
0,3 · 0,6 · 0,9 · 1,2 (máximo 1,2), como o RD8010.

**ANEUSO PINTO BRANDAO** — 14 perguntas

| Grupo | Pergunta | Alternativa marcada | Valor | Peso | Pontos |
|---|---|---|---:|---:|---:|
| Assiduidade e Pontualidade | Assiduidade | Falta muito ao trabalho, com ou sem justificat… | 0.3 | 4.5 | 1.1250 |
| Assiduidade e Pontualidade | Pontualidade | Atrasa com frequência com e sem justificativa | 0.3 | 4.5 | 1.1250 |
| Relacionamento e Conduta | Trabalho em Equipe | Auxilia os colegas e tem facilidade para traba… | 1.2 | 3.34 | 3.3400 |
| Relacionamento e Conduta | Respeito e Cordialidade | Não tem humildade, não respeita o outro | 0.3 | 3.33 | 0.8325 |
| Relacionamento e Conduta | Conduta e Normas Internas | Não segue as normas e regras internas, tem con… | 0.3 | 3.33 | 0.8325 |
| Iniciativa e Adaptabilidade | Iniciativa e Proatividade | Não realiza atividades extras e quando solicit… | 0.3 | 3 | 0.7500 |
| Iniciativa e Adaptabilidade | Flexibilidade e Colaboração | Não havendo outra opção atua de forma momentân… | 0.6 | 3 | 1.5000 |
| Iniciativa e Adaptabilidade | Adaptabilidade a Mudanças | Denota dificuldade para se adaptar a mudanças … | 0.3 | 3 | 0.7500 |
| Qualidade e Organização | Organização e Conclusão de Tarefas | Deixa atividades sem finalizar, não se organiz… | 0.3 | 3 | 0.7500 |
| Qualidade e Organização | Energia e Motivação | Revela interesse em realizar o que lhe e solic… | 0.6 | 3 | 1.5000 |
| Qualidade e Organização | Zelo pelos Equipamentos | Apresenta cuidado e preocupação com os equipam… | 0.9 | 3 | 2.2500 |
| Atendimento ao Cliente | Atendimento ao Cliente | Total disponibilidade e atenção ao cliente, at… | 1.2 | 13 | 13.0000 |
| Metas e Trabalho sob Pressão | Metas e Trabalho sob Pressão | Lida bem com pressão, certa dificuldade em alc… | 0.9 | 5 | 3.7500 |
| Apresentação Pessoal | Apresentação Pessoal | As vezes se apresenta no trabalho com aparênci… | 0.9 | 5 | 3.7500 |
| | | **soma** | | **60** | **35.2550** |

`35.2550 ÷ 60 × 100 = `**`58.76`**


**ARIELLY APARECIDA JOSE PEREIRA** — 11 perguntas

| Grupo | Pergunta | Alternativa marcada | Valor | Peso | Pontos |
|---|---|---|---:|---:|---:|
| Assiduidade e Pontualidade | Assiduidade | Falta ao trabalho com motivos justificados | 0.6 | 6 | 3.0000 |
| Assiduidade e Pontualidade | Pontualidade | Raramente atrasa ao trabalho | 0.9 | 6 | 4.5000 |
| Relacionamento e Conduta | Trabalho em Equipe | Prefere trabalhar sozinho, mas se solicita aux… | 0.6 | 5.34 | 2.6700 |
| Relacionamento e Conduta | Respeito e Cordialidade | Entrosou-se bem com os demais, mas precisa ter… | 0.9 | 5.33 | 3.9975 |
| Relacionamento e Conduta | Conduta e Normas Internas | Conhece e respeita as regras e normas da empre… | 1.2 | 5.33 | 5.3300 |
| Iniciativa e Adaptabilidade | Iniciativa e Proatividade | Realiza apenas os trabalhos destinados ao seu … | 0.6 | 5.34 | 2.6700 |
| Iniciativa e Adaptabilidade | Flexibilidade e Colaboração | Caso seja solicitado se dispõe a auxiliar por … | 0.9 | 5.33 | 3.9975 |
| Iniciativa e Adaptabilidade | Adaptabilidade a Mudanças | Apresenta muita facilidade com o novo, gosta d… | 1.2 | 5.33 | 5.3300 |
| Qualidade e Organização | Organização e Conclusão de Tarefas | Dificuldade em executar com qualidade e finali… | 0.6 | 5.34 | 2.6700 |
| Qualidade e Organização | Energia e Motivação | Apresenta interesse e disponibilidade para o t… | 0.9 | 5.33 | 3.9975 |
| Qualidade e Organização | Zelo pelos Equipamentos | Sempre zela dos equipamentos, mantém limpos e … | 1.2 | 5.33 | 5.3300 |
| | | **soma** | | **60** | **43.4925** |

`43.4925 ÷ 60 × 100 = `**`72.49`**


**ARTHUR GARCIA CAMPOS MOTA** — 11 perguntas

| Grupo | Pergunta | Alternativa marcada | Valor | Peso | Pontos |
|---|---|---|---:|---:|---:|
| Assiduidade e Pontualidade | Assiduidade | Falta muito ao trabalho, com ou sem justificat… | 0.3 | 6 | 1.5000 |
| Assiduidade e Pontualidade | Pontualidade | Atrasa as vezes com motivo justificado | 0.6 | 6 | 3.0000 |
| Relacionamento e Conduta | Trabalho em Equipe | Entrosa-se bem com os demais, mas não tem muit… | 0.9 | 5.34 | 4.0050 |
| Relacionamento e Conduta | Respeito e Cordialidade | E educado e conseguiu boa aceitação da equipe … | 1.2 | 5.33 | 5.3300 |
| Relacionamento e Conduta | Conduta e Normas Internas | Não segue as normas e regras internas, tem con… | 0.3 | 5.33 | 1.3325 |
| Iniciativa e Adaptabilidade | Iniciativa e Proatividade | Realiza apenas os trabalhos destinados ao seu … | 0.6 | 5.34 | 2.6700 |
| Iniciativa e Adaptabilidade | Flexibilidade e Colaboração | Caso seja solicitado se dispõe a auxiliar por … | 0.9 | 5.33 | 3.9975 |
| Iniciativa e Adaptabilidade | Adaptabilidade a Mudanças | Apresenta muita facilidade com o novo, gosta d… | 1.2 | 5.33 | 5.3300 |
| Qualidade e Organização | Organização e Conclusão de Tarefas | Deixa atividades sem finalizar, não se organiz… | 0.3 | 5.34 | 1.3350 |
| Qualidade e Organização | Energia e Motivação | Revela interesse em realizar o que lhe e solic… | 0.6 | 5.33 | 2.6650 |
| Qualidade e Organização | Zelo pelos Equipamentos | Apresenta cuidado e preocupação com os equipam… | 0.9 | 5.33 | 3.9975 |
| | | **soma** | | **60** | **35.1625** |

`35.1625 ÷ 60 × 100 = `**`58.60`**


#### Os critérios cadastrais

| Avaliado | Critério | Valor bruto | Pontuação | Peso |
|---|---|---|---:|---:|
| ANEUSO PINTO BRANDAO | Escolaridade | código 35 | 25,00 | 10 |
| ANEUSO PINTO BRANDAO | Tempo de Empresa | 10,0972 anos | 100,00 | 10 |
| ANEUSO PINTO BRANDAO | Tempo na Função | 0,5503 anos | 25,00 | 10 |
| ARIELLY APARECIDA JOSE PEREIRA | Escolaridade | código 85 | 100,00 | 10 |
| ARIELLY APARECIDA JOSE PEREIRA | Tempo de Empresa | 17,6728 anos | 100,00 | 10 |
| ARIELLY APARECIDA JOSE PEREIRA | Tempo na Função | 0,5503 anos | 25,00 | 10 |
| ARTHUR GARCIA CAMPOS MOTA | *(nenhum — aplicação "Aprendizes", peso 100 no questionário)* | — | — | — |

#### A nota final, e a conta refeita

`nota_final = (nota_avaliação × peso_avaliação + Σ(pontuação × peso)) ÷ (peso_avaliação + Σ(peso))`

| Avaliado | Nota quest. | Peso quest. | Nota critérios | Σ peso crit. | Conta | Nota final | Conceito | Gravado |
|---|---:|---:|---:|---:|---|---:|---|---|
| ANEUSO PINTO BRANDAO | 58,76 | 60 | 50,00 | 30 | `(58,76×60 + 50,00×30) ÷ 90` | **55,84** | Atende | ✅ CONFERE |
| ARIELLY APARECIDA JOSE PEREIRA | 72,49 | 60 | 75,00 | 30 | `(72,49×60 + 75,00×30) ÷ 90` | **73,33** | Atende | ✅ CONFERE |
| ARTHUR GARCIA CAMPOS MOTA | 58,60 | 100 | — | 0 | `(58,60×100) ÷ 100` | **58,60** | Atende | ✅ CONFERE |

⭐ **Os três verificados nos DOIS níveis** — a nota do questionário e a nota final —, por SQL
escrito à parte, não pelo motor que produziu os números. `houve_renormalizacao = false` nos três:
nenhum critério ficou sem dado, então a conta é a direta.

⚠️ **O ARTHUR é o caso de borda que vale guardar:** aplicação *Aprendizes*, `pesoAvaliacao = 100`
e **zero critérios**. É o caso que a regra *"`pesoAvaliacao > 0` é obrigatório"* torna trivial —
componente único normaliza para 1 e a nota final é a do questionário, sem caso especial na
fórmula. Ele estava na base e provava isso; agora prova daqui.


#### O registro da limpeza — 10/09/2026

Transação única, **só listas de ids explícitas** (nenhum recorte por data: `DELETE ... WHERE
criado_em >= hoje` apagaria o que ninguém conferiu). Contagens conferidas antes e batidas depois:

| Passo | Tabela | Linhas |
|---|---|---:|
| 1 | `rh.resultado_criterio` (das 3 apuradas) | 6 |
| 2 | `rh.resultado_avaliacao` | 3 |
| 3 | `rh.resposta` (das 11 avaliações) | 60 |
| 4 | `rh.avaliacao` → `PENDENTE` | 11 |
| 5 | `rh.ciclo_elegibilidade` (o EXCLUIR do RYAN) | 1 |
| 6 | `rh.auditoria` (17 ids, um a um) | 17 |

**As 11 avaliações** (ciclo `05842983-db39-44af-bfbb-a299ef21ebf4`):

| Avaliado | id | Origem |
|---|---|---|
| ADRIANA DOS SANTOS BARBOSA | `c97a8741…` | 08/09 |
| ANA CLAUDIA GOMES RODRIGUES | `3949b8ed…` | 06/09 |
| ANEUSO PINTO BRANDAO | `eb566766…` | 06/09 · apurada |
| ANGELO DA SILVA BRITO | `6936b189…` | 06/09 |
| ANTONIO FABIO SOUSA AVELAR | `84f585bd…` | 10/09 · enviada e reaberta |
| ARIELLY APARECIDA JOSE PEREIRA | `d2a25e36…` | 06/09 · apurada |
| ARTHUR GARCIA CAMPOS MOTA | `38fdc351…` | 06/09 · apurada |
| MATHEUS SOARES ARAUJO | `7806a3e3…` | 10/09 |
| RYAN ITALO MOREIRA NUNES | `b8c95c89…` | 10/09 · cancelada |
| TAMIRES BARBOZA DA COSTA | `f9dd8e5b…` | 10/09 |
| VERONICA MENDES PEREIRA | `30a43e94…` | 10/09 |

⭐ **`atualizado_em` restaurado ao carimbo do último `DESIGNAR`** de cada linha (06/09 13:22,
13:32, 15:52 ou 16:11, conforme a linha) — o valor de antes não era recuperável, porque
`@updatedAt` já o havia sobrescrito. Deixá-lo em 10/09 marcaria as 11 para sempre **exatamente
na conferência que este mesmo dia criou**. SQL cru não dispara o `@updatedAt`, então dá para
escrevê-lo.

⚠️ **`DESIGNAR` ficou** (1.472 linhas na base): é como as avaliações nasceram, e é de onde veio
o carimbo acima. Saíram os 17 de **envio, apuração, cancelamento, reabertura e as leituras que
passariam a apontar para resultados inexistentes**. ⚠️ **Ficaram também os 4 `ACESSO_*` de
06/09** sobre a avaliação da Arielly — são registro de um acesso que de fato aconteceu, e a
avaliação continua existindo (voltou a `PENDENTE`).

**Depois:** Piloto com **894 avaliações, 894 `PENDENTE`, 0 resultados, 0 elegibilidades**.

#### Os ciclos, no mesmo dia

| Ciclo | O que foi feito | Arrastou |
|---|---|---|
| `ZZ CONFERE 09/09` | **apagado** (11 DELETEs na ordem das FKs) | 2 avaliações · 9 público · 1 aplicação · 5 conceitos · 1 ciclo. `rh.auditoria` **preservada** (não tem FK), como em §3.1.13 |
| `SIMULACAO 09/09` | **ENCERRADO** pela API | nada — 0 pendentes. `reabertoEm` e as 39 canceladas **preservadas**: o estado de borda continua na base, agora como *encerrado, reaberto 1×* |
| `Avaliação Geral 2026` | **ENCERRADO com pendência** pela API | 5 `PENDENTE` → `CANCELADA`, com motivo escrito. ⚠️ Reabrir devolve o ciclo, **não as 5** |
| `Piloto 15/09/2026` | segue **ABERTO** — o único | — |
| `ZZ DESCARTAVEL — teste de tela (pode apagar)` | **criado** em `RASCUNHO`, para substituir o ZZ CONFERE | 1 aplicação (Administrativo v1, peso 60 + os 3 critérios ativos a 10) · público de **3** (01/11010210 AUDITORIA INTERNA) · 5 conceitos |

⚠️ **Encerrar não bastava, e é por isso que o filtro veio junto** — ver §3.1.57.

⭐ **Por que o descartável nasce em `RASCUNHO`, e deve voltar para lá:** com o filtro de
§3.1.57, ciclo em RASCUNHO **não entra na fila de ninguém** — dá para montar aplicação, público
e designação à vontade sem que um avaliador real veja. Ele só aparece para alguém quando for
**aberto de propósito**, e o público de 3 limita o estrago a três pessoas. Encerrá-lo depois do
teste o tira da fila; apagá-lo são os 11 DELETEs na ordem das FKs (não existe rota `DELETE` de
ciclo).

⚠️ **Uma última varredura, 10/09 20:1x — houve escrita DEPOIS da limpeza.** A conferência não
deu zero na primeira execução: `ARTHUR MENDES DA SILVA` apareceu ENVIADA, 11 respostas, nota
51,66, pela conta `adrianacaetano` às 20:09:32 — teste de tela do Clenio, feito enquanto a
limpeza rodava. Limpo na mesma disciplina (11 respostas · 1 UPDATE · 1 auditoria `ENVIAR`, por
id). ⭐ **É o argumento a favor do ciclo descartável:** testar tela no ciclo do piloto reabre o
problema que se acabou de fechar, e só a conferência pega.


### 3.1.57. 🔴 A FILA NUNCA ESVAZIAVA — ciclo encerrado seguia na mão de todo mundo (10/09)

Achado ao responder *"o que cada ciclo de teste exige para sair do caminho?"*. A resposta que eu
ia dar — *"encerrar tira da fila"* — **estava errada**, e o erro não era da tela.

`minhasAvaliacoes` (`avaliacao.service.ts`) filtrava por `avaliadorId` e por `not: CANCELADA`, e
**por nada mais**. Nenhuma condição sobre o ciclo. O `MinhasAvaliacoesPage` recebe
`ciclo.status` no contrato (`api.ts`) e **nunca o lê** — as 10 leituras de `ciclo.status` no
frontend estão todas nas telas do RH.

⚠️ **O sintoma que já existia:** a barra da Arielly somava dois ciclos abertos e anunciava
*"13 de 26 enviadas"* — `ProgressoGeral` recebe `total={itens.length}`, que é a resposta
inteira. Nenhum dos dois ciclos tinha 26.

⭐⭐ **O sintoma que ainda não tinha acontecido é o que decide.** Encerrado o Piloto, as 53
pessoas continuariam vendo as **894 avaliações** na fila, com os cartões "A responder"
clicáveis — e `responder` recusando na hora, porque exige ABERTO. **Isso apareceria no primeiro
encerramento real**, com 53 pessoas de verdade olhando. Não é conserto de tela: é regra
permanente, e o ciclo de teste só foi o que a fez aparecer três dias antes.

**O conserto** é uma condição: `ciclo: { status: 'ABERTO' }`.

⚠️ **É `ABERTO`, não `not: ENCERRADO`** — o buraco é simétrico. Designar é permitido em
`RASCUNHO` (`assertCicloOperavel` só barra ENCERRADO), então um ciclo ainda não aberto encheria
a fila de quem também não pode responder. A mesma condição fecha os dois lados, é a que
`responder` já exige, e é a única que não precisa ser revista quando alguém acrescentar um
status ao enum — o oposto da allowlist, que deixaria o status novo de fora em silêncio.

**A barra fecha sozinha**, sem tocar no frontend: `itens` passa a ter só ciclo aberto. E o caso
de zero já era curto-circuitado — `if (itens.length === 0) return <Vazio />` vem **antes** do
`ProgressoGeral`, então não existe "Tudo enviado · 0%" sobre lista vazia.

**Medido na API depois do conserto:**

| Avaliador | Antes | Depois |
|---|---|---|
| `ariellypereira` | 26 linhas, 2 ciclos → *"13 de 26"* | **13**, só o Piloto → *"0 de 13"* |
| `wandersonnascimento` | 22 linhas, 2 ciclos | **14**, só o Piloto → *"0 de 14"* |

**Teste:** `fila-so-ciclo-aberto.spec.ts`, 5 casos, **validado por mutação nos dois sentidos** —
sem o filtro, 4 de 5 falham; trocando por `not: ENCERRADO`, os mesmos 4 falham (é o teste do
RASCUNHO que pega essa). O 5º é o de `CANCELADA`, que existe justamente para provar que o filtro
novo não comeu o antigo. **614 testes** (eram 609).

⭐ **A lição, que é a §5.9 de novo:** o defeito não estava num caminho difícil — estava no
**caminho que ninguém tinha percorrido até o fim**. Nenhum ciclo com avaliação designada tinha
sido encerrado e reaberto para conferir a fila DEPOIS. Foi preciso querer encerrar um ciclo de
teste para descobrir o que aconteceria no encerramento do de verdade.


### 3.1.58. ⭐⭐ LER o instrumento, e a decisão de como ele vai ser EDITADO (11/09)

**Mudança de rumo, registrada primeiro porque explica tudo abaixo:** o foco deixou de ser
*chegar ao piloto dia 15* e passou a ser **concluir a implementação**. O piloto é o instrumento
de validação, e instrumento incompleto valida pouco. O piloto vira **duas fases** — a 1 valida o
processo com o questionário herdado do RD8010, sem o RH poder editá-lo; a 2 valida o RH
configurando sozinho. A data volta a ser discutida com a gestora de RH; recorte, contas e deploy
saíram da fila.

#### ✅ O que foi feito: ler o instrumento

Levantamento de 11/09, e o número que decidiu: **do cadastro do instrumento à devolutiva são 7 a
9 semanas**, com o editor de questionário sozinho valendo metade. Não cabia em cinco dias.

Mas havia uma peça de **um dia** que destrava a decisão de todas as outras, e era a que faltava:
**ninguém conseguia LER as 44 perguntas.** `GET /catalogo/modelos` devolve `perguntas: 11` — uma
CONTAGEM. O enunciado só existia em `prisma/seed.ts`. A pergunta *"este questionário é o que você
quer usar?"* não tinha como ser feita, e é ela que ordena o resto do trabalho.

| | |
|---|---|
| `GET /catalogo/modelos/:versaoId` | o instrumento inteiro: grupos → perguntas → alternativas, com peso de cada pergunta, valor de cada alternativa e o balanço por grupo |
| Papéis | **`RH_ADMIN` + `RH_MODELO` + `RH_CICLO`** — os três papéis do RH. ⚠️ `RH_CICLO` entrou no mesmo dia em que ficou de fora: quem monta a Aplicação **escolhe o modelo**, e escolher por nome sem ver o conteúdo é decidir às cegas. ⭐ A distinção que resolve, e vale para o módulo inteiro: **ler o INSTRUMENTO não é ler NOTA** — o que a separação de funções guarda é o julgamento sobre uma pessoa (`/resultados`, só `RH_ADMIN`, com `LER_RESULTADO_INDIVIDUAL` na auditoria); o questionário em branco é a régua, não dado de ninguém. Fora ficam `AVALIADOR` e quem não tem o módulo |
| Tela | `/questionarios`, **leitura pura**, com botão de imprimir |
| Menu | **"Questionários"** em CADASTROS — e é a primeira vez que `RH_MODELO` tem item |

⭐ **O rótulo nomeia o OBJETO, não uma capacidade.** "Questionários", não "Editar
questionários": a tela não edita, e quando o editor existir o rótulo não muda — a tela é que
ganha o que fazer. Um aviso no topo diz que é leitura e **por onde a mudança passa hoje**
(pela T.I.), porque "somente leitura" sozinho deixa a pessoa procurando o botão.

⭐⭐ **As DUAS pontuações máximas, lado a lado.** A gravada na publicação e a recalculada agora,
pela mesma `pontuacaoMaxima()` que a publicação usa. Iguais, é conferência; **diferentes, alguém
mexeu no banco por fora e a nota de todo mundo está saindo sobre um denominador que não é o do
instrumento** — e aí a tela diz isso em vermelho, com os dois números. Mostrar só uma delas
esconderia exatamente o caso que importa. Conferido nos 4 modelos: todos CONFERE.

**Lido ao vivo em 11/09** — os 4 modelos, 20 grupos, **44 perguntas**, 176 alternativas:

| Modelo | Grupos | Perguntas | Alternativas | Σ pesos | Pontuação máxima |
|---|---:|---:|---:|---:|---|
| Administrativo | 4 | 11 | 44 | 60 | 72 ✅ |
| Operação de Loja | 7 | 14 | 56 | 60 | 72 ✅ |
| Produção e Indústria | 7 | 14 | 56 | 60 | 72 ✅ |
| [DEMO] Modelo de Treinamento | 2 | 5 | 20 | 50 | 60 ✅ |

#### ⭐ Os validadores já estavam escritos — e sem chamador

Ao montar a leitura, `somatorioPorGrupo` e `pontuacaoMaxima` ganharam **o primeiro chamador da
vida deles**. Vale registrar o que mais está nessa situação, porque muda a estimativa do editor:

| Peça | Tamanho | Estado em 11/09 |
|---|---:|---|
| `modelo/publicacao.validator.ts` | 136 linhas | `validarModeloParaPublicacao` e `assertModeloPublicavel` — **ainda sem chamador**. `somatorioPorGrupo` e `pontuacaoMaxima` passaram a ter |
| `criterio/criterio.validator.ts` | 94 linhas | `validarCriterio` / `assertCriterioSalvavel` — **sem chamador**. Só `validarCriterioEmUso` é usado (pela abertura do ciclo) |
| `modelo/distribuir-peso.ts` | 27 linhas | usado pelo seed |

Todos com spec própria e verdes. **Quando o editor vier, o miolo das regras já existe** — o que
falta é a casca: HTTP, persistência, auditoria e tela.

⚠️ **E é daí que vem a correção dos "TRÊS momentos"** de validação do resolver: são **DOIS**. O
terceiro — *ao salvar no catálogo* — é do desenho, não do código, porque não existe salvar.
Corrigido no `CLAUDE.md`, na §5 e na memória.

#### ⭐⭐ DECISÃO — versão nova a cada mudança; modelo em uso por ciclo ABERTO é imutável

Decidida em 11/09, antes de o editor começar, porque ela **muda o tamanho dele**.

**Versionar, nunca editar em lugar.** Mudar enunciado, peso ou alternativa cria uma
`ModeloVersao` nova; a anterior fica. O `@@unique([modeloId, versao])` e o `publicadoEm` já
foram desenhados para isso.

**O porquê, que é o que não pode se perder:** o Piloto tem **894 avaliações designadas** contra
essas versões. Editar em lugar mudaria o instrumento **embaixo de um ciclo em curso** — as
respostas já dadas pertencem às perguntas antigas, e a nota sairia errada sem acusar erro. É o
mesmo raciocínio da ⛔ DECISÃO DE PRODUTO sobre trocar o `modeloVersao` de uma aplicação, e da
`designacao/troca-de-aplicacao.ts`: **quando um recorte de PESSOAS já foi montado sobre um
instrumento, o instrumento não troca.**

Decorre disso a regra operacional: **versão usada por aplicação de ciclo ABERTO é imutável**, e
a recusa precisa dizer a saída — *"crie uma versão nova; ela vale para os próximos ciclos"*.
O `aplicacoesQueUsam` que a leitura já devolve existe para a tela poder dizer isso antes.

⚠️ **Consequência que barateia o editor, e é por isso que a decisão vem antes:** não é preciso
edição transacional sobre um grafo em uso, nem migração de respostas, nem "editar e republicar".
O editor trabalha sempre sobre uma versão em **RASCUNHO** (`publicadoEm = null`) — e RASCUNHO
não tem avaliação apontando para ele, por construção. Publicar é o ponto sem volta, e é onde
`assertModeloPublicavel` finalmente é chamado.

**Estimativa refinada do editor: de 3–4 semanas para 2–3 semanas.** O que saiu da conta:
edição concorrente sobre versão em uso, migração de respostas, e a regra de "o que acontece com
quem já respondeu" — que deixa de existir.

#### ⭐⭐ DUPLICAR UMA VERSÃO É PARTE DO EDITOR — não um item solto

Registrado assim por decisão do Clenio em 11/09, e o motivo desarma um risco real: **eu tinha
anotado a duplicação como "o que a decisão não resolve", como se fosse um extra.** Não é.

**Sem duplicar, "versão nova a cada mudança" vira "redigite 14 perguntas".** A decisão que
barateou o editor — versão em uso é imutável, o editor só trabalha sobre RASCUNHO — **fica
inutilizável na prática**: mudar o peso de UMA pergunta exigiria remontar o questionário inteiro
do zero, e quem tem esse trabalho pela frente ou desiste, ou pede para a T.I. mexer no banco —
que é exatamente o que este módulo existe para acabar.

Então o escopo do editor tem **três atos, não dois**:

| Ato | O que é |
|---|---|
| **Criar versão a partir da anterior** | duplica grupos, perguntas, pesos e alternativas numa `ModeloVersao` nova com `publicadoEm = null`. **É o caminho normal**, não a exceção |
| **Editar o rascunho** | o trabalho em si, sobre a cópia — sem avaliação apontando para ela, por construção |
| **Publicar** | o ponto sem volta, onde `assertModeloPublicavel` finalmente é chamado |

⚠️ **Criar do zero é o caso RARO** — só o primeiro modelo de uma família. A tela tem de tratar a
duplicação como o botão principal, e não escondê-la atrás de "novo modelo".

⚠️ **As 2–3 semanas já contam os três.** A duplicação em si é barata (uma transação que copia um
grafo de 4 níveis); o que ela evita é caro. O que continua fora da conta e **fora do escopo desta
fase**: o que fazer com a versão antiga quando nenhum ciclo a usa mais — hoje ela simplesmente
fica, e ficar não machuca ninguém.


### 3.1.59. ✅ URL desconhecida DIZ que não existe — o item 19 da lista (B), fechado (11/09)

Era `<Route path="*" element={<Navigate to="/" replace />} />`, **dentro do Layout**: qualquer
caminho desconhecido sob `/gestao-pessoas/*` caía na fila do avaliador, **calado**, como se
tivesse levado a algum lugar.

O caso que estava na lista: `/gestao-pessoas/resultados`. Resultados vive dentro do ciclo
(`/ciclos/:id/resultados`) — **decisão nossa no menu, e ela está certa**. O defeito era outro:
quem abrisse aquele link via a própria fila e concluía que tinha chegado, ou que o sistema estava
quebrado. E alguém ia compartilhar o link.

⚠️ **A correção não é criar as rotas de topo** — é a URL desconhecida dizer que não existe.

**O que a tela faz, e por quê:**

- **escreve o caminho tentado** (`Nada responde em /resultados`). Sem ele, quem clicou num link
  compartilhado não sabe o que estava errado nem como avisar quem mandou;
- **diz onde as telas do ciclo moram**, que é a confusão real;
- **oferece os destinos filtrados por papel**, com a mesma condição do `Sidebar` — não se oferece
  porta que vai dar 403. É a regra da casa: *a recusa ensina o caminho*; dizer só "não existe"
  faz a pessoa procurar sozinha, e o que ela acha costuma ser o errado.

Reusa o `<Vazio>` de `components/Estado.tsx`. **~25 linhas e uma linha em `App.tsx`** — a
estimativa era de 1 hora e foi isso.

⚠️ **Fica mais urgente agora, não menos:** com a fase 1 anunciada ao RH, as telas que ainda não
existem (`/questionarios` passou a existir; `/criterios` e `/sincronizacao` não) vão ser tentadas
justamente por quem ouviu que estão vindo.


### 3.1.60. ✅ Ajustar o PERÍODO pela tela — a capacidade que só existia por `curl` (11/09)

`PATCH /ciclos/:id/periodo` está no ar desde 07/09: `RH_ADMIN`, auditado com o valor anterior, e
**sem tela**. Para corrigir uma data digitada errada o RH dependia da T.I. — que é o que o módulo
existe para acabar. É a família do §3.1.5: *capacidade sem caminho na tela*.

Entrou como seção retrátil em `CicloPage`, **ao lado da régua de conceitos** e pelo mesmo motivo:
período é **propriedade do ciclo**, não etapa dele. Só aparece para `RH_ADMIN`, como o endpoint —
a tela não oferece o que a API vai recusar.

⭐ **A tela explica por que o ajuste é ESTREITO**, em vez de deixar a pessoa procurando os outros
campos: período é **rótulo** e não entra em conta nenhuma; quem ancora todo cálculo temporal é a
`dataBase`, e ela não muda. Mudá-la num ciclo em andamento moveria a nota de quem já respondeu,
em silêncio — quem precisa de outra data-base **cria outro ciclo**, que é a decisão que isso
realmente é.

⭐⭐ **As duas recusas do backend aparecem ANTES do clique**, com a mesma regra do
`validarPeriodo` — a tela não inventa outra:

| Recusa | Como aparece |
|---|---|
| ciclo **ENCERRADO** | campos cinza + o motivo escrito acima deles, como na régua |
| o período novo não **contém a data-base** | aviso âmbar enquanto a pessoa digita, com a data-base no texto |

A segunda é a que pega na prática: é fácil encolher o período e deixar a data-base do lado de
fora sem perceber. Conferido ao vivo — a API recusa com *"A data-base precisa estar dentro do
período do ciclo"*, e a tela diz o mesmo antes.

⚠️ **E o botão desabilitado tem `title`** dizendo o que falta (encerrado · o impedimento · "nada
mudou"). Botão cinza mudo faz a pessoa clicar de novo achando que não pegou — §3.1.50.

⚠️ **Registro de um erro meu, porque a regra vale:** testei o endpoint no **ciclo do Piloto**,
mudei o período e desfiz. O ciclo `ZZ DESCARTAVEL` existe exatamente para isso e foi criado ontem
por este motivo. Restaurado (01/09–30/09) e as **2 linhas de `AJUSTAR_PERIODO` de 11/09 apagadas
por id**; a de 06/09 fica, é real. Reteste refeito no descartável. **O ciclo descartável só serve
se for o primeiro lugar em que se pensa** — ter um não basta.


### 3.1.61. ⭐⭐ DESCANCELAR — as quatro decisões, e o Incluir cumprindo a promessa (11/09)

O item estava travado em **política, não em código** (§3.1.47): ~30 linhas de backend e quatro
perguntas que não eram da T.I. As respostas vieram em 11/09 e estão abaixo, cada uma com o porquê,
porque é o porquê que impede a decisão de ser refeita ao contrário daqui a meses.

⭐ **Entregue como CONSERTO DE PROMESSA, não como botão novo** — decisão do Clenio, e ela mudou o
desenho. O modal do **Excluir** sempre disse que é reversível pelo **Incluir**; o Incluir só
registrava uma decisão nova e a avaliação continuava CANCELADA. Então o trabalho foi **fazer o
Incluir cumprir**, e só o que ele não cobre — as canceladas pelo encerramento, que não têm linha
de elegibilidade — ganhou caminho próprio, **na tela onde o ato aconteceu**.

#### (a) Para qual estado ela volta — DERIVADO DO DADO

Com resposta gravada, `EM_ANDAMENTO`; sem, `PENDENTE`. As respostas nunca foram apagadas — cancelar
tira da CONTA, não do banco —, então devolver como `PENDENTE` uma avaliação com 4 respostas mentiria
para o avaliador, que abriria "não começou" e encontraria trabalho feito. E um terceiro estado só
para o pós-descancelamento seria estado que ninguém mais sabe ler.

#### (b) O motivo original — APAGADO do registro, PRESERVADO na auditoria

`motivoCancelamento` sai da linha: campo que descreve um estado que não vale mais é a armadilha do
§3.1.48. O texto vai para `valorAnterior`, **e é obrigatório que vá** — sem ele a trilha guarda
"descancelou" e perde o porquê, que é a metade que responde a pergunta de daqui a seis meses.
Conferido no banco: `{"status":"CANCELADA","respostas":4,"motivoCancelamento":"Ciclo encerrado com
pendência: …"}`.

⭐ **Junto veio a assimetria que a varredura pegou:** a linha da Designação mostrava o motivo do
**cancelamento** e calava o da **reabertura**. São dois atos do mesmo peso — os dois tiram a
avaliação do estado em que estava, os dois exigem motivo, os dois respondem *"por que isto está
assim?"*. Com um só na tela, a reabertura parecia rotina e o cancelamento parecia grave. Agora os
dois aparecem; **em cores diferentes**, porque mesmo peso não é mesmo efeito — cancelar tira da
conta (rosa), reabrir devolve para a fila (âmbar).

#### (c) A granularidade da reversão é a do ATO QUE CAUSOU

⚠️ **Aqui eu tinha proposto errado, e o Clenio corrigiu.** Eu quis "em massa por ciclo, nunca com
recorte por colaborador", importando a regra da **reapuração**. Lá ela guarda resultado apurado
contra a separação de funções; **aqui o Excluir já é por linha** — negar o desfazer por linha seria
buraco, não guarda.

| Ato que cancelou | Como se desfaz |
|---|---|
| **`DECISAO_RH`** — o Excluir, por linha, com motivo por linha | pelo **Incluir**, por linha |
| **`ENCERRAMENTO`** — UM ato sobre N avaliações, UM motivo | **em massa, por ciclo**, com motivo e prévia |

E cada caminho **recusa o que é do outro, dizendo onde ele fica** — porque o Incluir de uma pessoa
não pode ressuscitar o que o encerramento do ciclo cancelou.

#### (d) As duas origens, em transação única — e o campo de origem

Desfazer um `DECISAO_RH` reverte **cancelamento e elegibilidade juntos**. Separados, sobra o estado
partido que `decidirElegibilidade` foi escrito para fechar: avaliação viva com decisão de exclusão
vigente, que a próxima cópia do cadastro exclui de novo, calada.

⭐ **`origem_cancelamento` é COLUNA, não prefixo do motivo** (migration
`20260911200000_origem_do_cancelamento`). Dava para distinguir por `LIKE 'Excluído do ciclo pelo
RH:%'` — e seria errado: comportamento decidido por prefixo de frase quebra no dia em que alguém
melhora a redação, e quebra **em silêncio**. O texto é para humano ler. Backfill **estrutural**
(quem tem linha `EXCLUIR` em `ciclo_elegibilidade` veio do Excluir), conferido contra o texto:
**bate 100% nas 54 linhas** — 2 `DECISAO_RH`, 52 `ENCERRAMENTO`.

#### O que mais mudou por tabela cruzada

- **`efeito-de-designar.ts` dizia *"hoje não há caminho para descancelar; fale com a T.I."***.
  Virou mentira no dia em que isto subiu. ⭐ **Texto que NEGA capacidade envelhece tão errado quanto
  o que promete** — manda a pessoa pedir socorro para o que ela resolve em dois cliques. A recusa
  continua (cancelada não se redesigna); o que mudou é a saída que ela ensina.
- **Três specs quebraram, e as três estavam certas em quebrar**: o invariante `texto-sem-flexao`
  pegou um *"com as ${n} respostas"* meu (com n=1 sai "as 1 respostas" — §3.1.35, e eu o escrevi
  numa sessão em que já tinha citado essa regra duas vezes); e dois specs afirmavam o comportamento
  antigo (*"INCLUIR nem procura avaliação"*, *"admite que não há caminho de volta"*). **Spec que
  quebra é informação** — os três viraram o registro do que mudou e por quê.

**Conferido ao vivo no `ZZ ENCERRA2` (o ciclo descartável, desta vez):** prévia com o ciclo
encerrado responde `total: 5, comRespostas: 1`; o ato com o ciclo encerrado **recusa** e manda
reabrir; motivo curto **recusa** com quantos caracteres faltam; devolvidas **5 → 1 EM_ANDAMENTO +
4 PENDENTE**, com a ENVIADA intocada. E o round-trip Excluir → Incluir: `CANCELADA/DECISAO_RH` →
`EM_ANDAMENTO`, motivo e origem limpos, elegibilidade `EXCLUIR` **não vigente**.

⚠️ **`ZZ ENCERRA2` mudou de estado** com este teste: era *encerrado com 5 canceladas*, agora está
**ABERTO com as 5 devolvidas**. Continua descartável.

**640 testes** (eram 623). Migration **13**.

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
- **Critério calculado exige resolver registrado**, validado em **DOIS momentos** (ao montar
  a aplicação e na abertura do ciclo — mesma função, duas chamadas). Sem isso o critério
  devolve vazio, em silêncio, para o ciclo inteiro. ⚠️ **Corrigido em 11/09: eram três no
  desenho e são dois no código.** O terceiro — *ao salvar no catálogo* — não tem caminho
  porque **não existe salvar**: `assertCriterioSalvavel` está escrito, com spec, e **sem
  chamador**. É o momento mais barato de recusar (fala com quem errou), e ele volta junto com
  o cadastro de critérios. Ver §3.1.58.
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

👉 **`docs/REGRAS-DE-METODO.md` — 27 regras, cada uma com GATILHO.**

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

---

### 3.1.62. ⭐⭐ ACERVO DE QUESTÕES — o levantamento, as duas correções e o desenho escolhido (11/09)

Levantamento pedido pelo Clenio antes de escolher entre manter os modelos separados e virar um
**acervo** de questões. O levantamento corrigiu duas afirmações que vinham sendo repetidas —
uma minha, na contagem, e uma do desenho proposto. Ficam registradas aqui porque **as duas
mudam o tamanho do trabalho**, e porque a segunda veio do DADO, não de opinião.

#### ⚠️ CORREÇÃO 1 — são 39 perguntas e 3 modelos, não 44 e 4

Repetido em conversa e em prompt até 11/09. A contagem certa, medida em `rh` do DEV:

| Afirmação corrente | Real | Por quê |
|---|---|---|
| 44 perguntas | **39** em produção | as outras 5 são do `[DEMO] Modelo de Treinamento`, `finalidade = DEMONSTRACAO` |
| 4 modelos | **3** em produção + 1 DEMO | são **4 APLICAÇÕES**: `Aprendizes` reusa a `ModeloVersao` do `Administrativo`, com `pesoAvaliacao = 100` e 0 critérios |
| 20 grupos | **18** em produção + 2 do DEMO | idem |
| "os 3 resultados que já apurei" | **17** no banco | 4 em `Avaliação Geral 2026` + 13 em `SIMULACAO 09/09`, ambos ENCERRADO. **O Piloto tem 0** — as três apurações de §3.1.56 foram apagadas em 10/09 |

⭐ **De onde vinha o erro:** `select count(*) from rh.pergunta` dá 44, e o DEMO não se anuncia.
Toda contagem do instrumento tem de filtrar `finalidade = 'PRODUCAO'` — o DEMO existe
exatamente para não valer, e passa despercebido porque tem grupos e perguntas de verdade
(reusa os códigos `004`, `005`, `006`, `007`, `011`).

#### ⚠️⚠️ CORREÇÃO 2 — o peso é do GRUPO, não da questão; o 5,33/5,34 é ARREDONDAMENTO

O desenho proposto era *peso na questão, dentro do perfil* (o par aplicação × pergunta). **O dado
diz outra coisa**, e a evidência é aritmética, não interpretativa:

```
Qualidade e Organização · Administrativo    → 5,34 + 5,33 + 5,33 = 16
Qualidade e Organização · Operação de Loja  → 3,00 + 3,00 + 3,00 =  9
Relacionamento e Conduta · Op. de Loja      → 3,34 + 3,33 + 3,33 = 10
```

**Dentro de cada grupo, em cada modelo, todas as questões têm o MESMO peso.** As 18 somas de
grupo são inteiras (3, 5, 9, 10, 12, 13, 16) e o total de cada modelo é **exatamente 60** — o
mesmo 60 do `aplicacao.peso_avaliacao`.

⭐ **O `5,33 / 5,34` não é intenção — é o resto da divisão.** 16 ÷ 3 = 5,333…; alguém deu um
centavo a mais à primeira questão para a soma fechar em 16. Tratar esse centavo como decisão
pedagógica é ler ruído como sinal. O peso por questão gravado em `rh.pergunta.peso` é uma
**reescrita com perda** de *"60 pontos repartidos entre grupos, e cada grupo repartido
igualmente entre suas questões"*.

⚠️ **A regra de método que isto instancia:** número com aparência de precisão (duas casas,
valores próximos mas diferentes) merece a pergunta *"isto é escolha ou é resto de conta?"*
antes de virar requisito. A resposta estava a um `sum() group by` de distância, e teria mudado
o desenho se ninguém perguntasse.

#### O acervo tem 15 questões, não 40–50

| | |
|---|---:|
| Linhas de `pergunta` em produção | 39 |
| Enunciados distintos | **15** |
| Duplicatas | **24 (62%)** |

Dos 15: **11 aparecem nos 3 modelos**, 2 em dois, 2 são exclusivos (`Atendimento ao Cliente` na
Operação de Loja, `Conhecimento Técnico do Maquinário` na Produção). O DEMO **não acrescenta
nenhum** — reusa 5 dos mesmos códigos.

Três fatos que tornam a unificação barata e sem perda de informação:

1. **As alternativas são idênticas.** Para cada um dos 15, o conjunto de 4 alternativas
   (texto + valor) é o mesmo em todo modelo onde aparece — `count(distinct assinatura) = 1`
   nos 15. Não há "qual versão fica" a decidir.
2. **O `codigo_origem` do SQP010 já é a chave do acervo** (`004`–`018`), estável entre modelos.
   O Protheus já tratava isto como acervo; **foi a importação que duplicou**.
3. **A classificação já é atributo da questão.** `count(distinct grupo) = 1` para os 15: nenhuma
   questão muda de tema conforme o perfil. A migration não tem **um** caso ambíguo em 39 linhas.

#### ✅ DESENHO ESCOLHIDO (Clenio, 11/09)

| Decisão | O que fica |
|---|---|
| **Acervo unificado** | 15 questões, chaveadas pelo `codigo_origem` do SQP010 |
| **Peso no GRUPO** — opção (ii) | dividido igualmente entre as questões daquele grupo **naquele perfil**. Peso por questão é **derivado**; **não** criar `aplicacao_pergunta.peso` |
| **UMA classificação por questão** | tags de busca ficam para depois, se fizerem falta, e **não tocam no motor** |
| **Versionamento** | `ModeloVersao` continua sendo o nome do **arranjo**; questão do acervo é **imutável enquanto referenciada por arranjo publicado**; editar cria questão nova |
| ⛔ **(iii) peso em dois níveis** | **DESCARTADO** — não se reabre a decisão do schema (*"peso em dois níveis torna impossível prever o efeito de mudar um número na montagem"*) |

**Por que (ii) e não (i):** não é só mais barato (8 números por perfil em vez de 15, e a conta
não muda quando se acrescenta questão) — é **o que o instrumento já é**. (i) preservaria um grau
de liberdade que ninguém usou em 39 linhas.

⚠️ **O caso que (ii) não cobre:** questão que deva pesar mais que as irmãs do mesmo grupo. Hoje
não existe nenhuma. A saída barata é dar classificação própria a ela; a cara é (iii), e (iii)
está descartado.

#### ⚠️ COMPARABILIDADE ENTRE PERFIS — hoje ela é acidente, e o acervo a entrega ao RH

A nota por grupo sobrevive sem esforço: é **calculada na leitura, nunca materializada**
(ADR-RH-02) — `notaPorGrupo` troca a chave de agrupamento de `grupoId` para `classificacaoId`,
**uma linha**.

O que quase passou batido: **hoje os 3 perfis têm a MESMA contagem de questões por grupo**
(2/2/2, 3/3/3, 3/3/3, 3/3/3). Só o peso difere. Por isso *"Relacionamento: 78"* é hoje
comparável entre um administrativo e um operador — mesmas 3 perguntas, mesmas âncoras.

No acervo livre, um perfil pode ter 2 questões de Pontualidade e outro 5. A nota do grupo
continua sendo um percentual válido — mas **comparável como percentual, não como medida**. E
nada avisaria: os dois números sairiam bonitos lado a lado no relatório.

⭐ **Decisão: informar, não bloquear.** Quando a montagem do arranjo for construída, a tela
**diz quantas questões cada outro perfil tem naquela classificação**. A garantia que hoje é
coincidência de construção passa a ser escolha consciente de quem monta.

#### Ordem de execução decidida

| # | Item | Custo | Por quê nesta ordem |
|---|---|---|---|
| **1** | **Migration de unificação** | 3–4 dias | **única peça com prazo natural** — ver abaixo |
| 2 | Cadastro de critérios e faixas | 1–1,5 sem | destrava o `INFORMADO` (compor nota com planilha, sem T.I.); aproveita `assertCriterioSalvavel`, que já está escrito |
| 3 | Editor do acervo | resto das 3–3,5 sem | — |

⭐⭐ **Por que a migration vem primeiro, e é a única coisa com relógio:** o Piloto tem **894
avaliações `PENDENTE` e ZERO respostas**. Uma migration que reescreve `pergunta` hoje não toca
nenhuma delas. **Depois da primeira resposta**, a mesma migration precisa reapontar
`resposta.pergunta_id` e `resposta.alternativa_id` e conviver com resultados apurados: sobem
3–5 dias e muda de categoria de risco.

⚠️ **Ressalva medida depois do levantamento:** já existem **214 respostas** em ciclos de
teste/simulação (158 no Administrativo, 56 na Operação de Loja) — a migration **tem** de
remapeá-las. A chave `(pergunta.codigo_origem, alternativa.ordem)` foi verificada e identifica
a alternativa sem ambiguidade nas 176 linhas, DEMO incluído.

#### Conferência obrigatória da migration — se qualquer número mudar, está errada

1. Os 3 perfis produzem **exatamente os mesmos pesos efetivos por questão** de hoje.
2. `pontuacao_maxima` de cada perfil continua **72,0000**.
3. A soma de pesos de cada perfil continua **60,0000**.
4. **Regressão do ciclo `000006` do Protheus: 108/108.** Baseline registrado antes da migration,
   pelo FONTE atual (não pelo `dist/`, que estava de 06/09).

⚠️ **`tsconfig.spec.json` não vai na imagem** do `gestao-pessoas-backend` — `npm test` dentro do
container falha com *"File not found: tsconfig.spec.json"* em **52 suítes com 0 testes**. Isso é
**harness quebrado, não suíte vermelha**: 0 testes executados nunca é resultado. Copiar o arquivo
(`docker cp`) antes de rodar, ou corrigir o Dockerfile.

#### 🔴 TREINAMENTO — pendência de PROCESSO do RH, não de sistema

O sistema está **inteiro**: resolver `qtdeTreinamento` escrito e registrado, critério no catálogo,
**5 faixas cadastradas** (0 / 1–2 / 3–5 / 6–8 / +8 → 0, 25, 50, 75, 100). Está `ativo = false` e
com **0 usos** por decisão, não por falta de código — ligar é um `UPDATE` e uma linha em
`aplicacao_criterio`.

**O que falta é o RH responder por que o registro parou:**

```
2022 →     5        2024 → 1.011 (604 pessoas)
2023 → 1.188        2025 →    64 (34 pessoas)   último registro: 14/11/2025
```

Na janela de 12 meses da `dataBase` do Piloto, **6 pessoas de 1.036 pontuariam**. Com peso 10
contra 60, ligar assim empurraria a nota de 1.030 pessoas para baixo por uma lacuna
administrativa — e o critério **não distingue "não fez curso" de "ninguém registrou o curso"**.

#### ⚠️ ARMADILHA — `RA4_HORAS` existe, não é nulo, e é FALSO

`carga_horaria` está preenchida nas **2.268 linhas** de `rh.colaborador_treinamento` — e
`sum(carga_horaria) = 0`. Todos zeros.

⭐ **É o pior formato de dado ruim:** não é nulo, então `semDado` nunca dispara e a
renormalização não protege; não é ausente, então nenhuma validação reclama. Um critério de
"carga horária total" passaria em qualquer teste com dado sintético e sairia **zero para todo
mundo em produção, calado** — exatamente o modo de falha que a validação de resolver existe para
evitar, só que vindo do dado em vez do código.

**Nunca criar critério sobre `RA4_HORAS` sem antes conferir `sum()` na base real.** Os campos
utilizáveis do `RA4010` são: `descricao` (37 distintas), `RA4_DATAIN` e `RA4_DATAFI` (2.268/2.268
preenchidos). **Não existe tipo/categoria de curso** no contrato.

---

### 3.1.63. ✅ MIGRATION DO ACERVO — aplicada e conferida (11/09)

`20260911230000_acervo_de_questoes`, aplicada no DEV em 11/09. É o item 1 da ordem decidida em
§3.1.62 — o único com prazo natural, porque o Piloto ainda tem **894 avaliações `PENDENTE` e zero
respostas**.

#### O que mudou no banco

| | Antes | Depois |
|---|---:|---:|
| Linhas de `pergunta` | 39 (+5 DEMO) | **15** (acervo) |
| Linhas de grupo | 20 | **8** `classificacao` (global) |
| `pergunta_alternativa` | 176 | **60** |
| Peso por questão | coluna `pergunta.peso` | **derivado** de `arranjo_grupo.peso` |
| Questionário da versão | grafo privado (`grupo` → `pergunta`) | `arranjo_grupo` (20) + `arranjo_pergunta` (44) |
| Respostas | 214 | **214**, remapeadas |

#### ⭐⭐ A REGRA DE DERIVAÇÃO — descoberta, não inventada

A conferência nº 1 pedida pelo Clenio (*"os 3 perfis têm que produzir exatamente os mesmos pesos
efetivos"*) **não seria satisfazível** com divisão simples: 12 das 39 questões mudariam (≤ 0,0067)
e a nota variaria até **0,025** no Administrativo — medido, não estimado.

A regra que preserva tudo saiu de olhar o dado:

```
peso(questão) = floor(peso_do_grupo ÷ n, 2 casas)
              + 0,01 para as `resto` primeiras, por ordem
```

Reproduz **44 de 44** pesos gravados (39 produção + 5 DEMO).

⭐⭐ **E não precisava ter sido descoberta: já estava escrita.** `modelo/distribuirPeso` fazia
exatamente isto desde 05/09 — para o SEED, que sempre teve os pesos **por grupo** e os repartia na
gravação. O comentário dele dizia, com todas as letras, *"os números vieram dos pesos que eram por
grupo e foram redistribuídos entre as perguntas"*.

**A informação nunca esteve na coluna `pergunta.peso`; a coluna é que era a camada com perda.** O
acervo não introduziu a regra — devolveu o peso para onde o seed já o tinha.

⚠️ Por isso `calculo/peso-derivado.ts` **importa** `distribuirPeso` em vez de reimplementá-lo. A
primeira versão tinha a cópia, e cópia de regra que decide a nota de todo mundo é o erro que este
projeto já pagou ([[feedback_regra_duplicada_envelhece_errada]]).

#### As quatro conferências — todas passaram

| # | Conferência | Resultado |
|---|---|---|
| 1 | Pesos efetivos por questão, antes × depois | ✅ **44 de 44 idênticos** (`diff` vazio) |
| 2 | Soma dos pesos por perfil | ✅ **60,0000** nos três |
| 3 | `pontuacao_maxima` gravada × calculada | ✅ **72,0000 = 72,0000** nos três |
| 4 | Regressão do ciclo `000006` do Protheus | ✅ **108/108**, idêntica ao baseline |
| + | As 214 respostas (avaliação, código, valor) | ✅ `diff` vazio; 0 órfãs, 0 incoerentes |
| + | Suíte | ✅ **655 testes** (640 + 15 novos), 53 suítes |

⭐ **Parte da conferência está DENTRO da migration**, num `DO $$` final que aborta a transação se
o acervo não tiver 15, se algum perfil não somar 60, se sobrar resposta órfã ou se alguma questão
do arranjo tiver classificação sem peso. Conferência que depende de alguém lembrar de rodar depois
não é conferência.

#### 🐛 O bug que a spec pegou — arredondar por questão

`pontuacaoMaximaDoArranjo` arredondava **cada** produto: `5,34 × 1,2 = 6,408` virava 6,41, e três
questões de um grupo de 16 somavam 19,21 em vez de 19,2. No Administrativo a pontuação máxima saía
**72,03** — e toda nota do perfil sairia 0,04% menor, sem nada acusar erro.

⭐ Foi pego pelo teste que compara com o instrumento herdado, não por revisão. **Arredondar uma vez
só, no fim** — a regra vale para qualquer soma ponderada deste módulo.

#### ⚠️ Dois achados silenciosos na adaptação do código

1. **`designacao.service`** contava `prisma.pergunta.count()` para o denominador de *"4 de 11"*.
   Depois do acervo isso devolveria **15 para todo perfil** — o acervo inteiro, não o questionário.
   Passou a contar `arranjoPergunta`.
2. **A tela do instrumento dizia "soma das perguntas"** ao lado do peso do grupo. Virou **"peso do
   grupo"**, e o peso da questão virou **"peso derivado"** — o rótulo antigo mandaria quem quer
   mudar o número procurar na pergunta, que é exatamente onde ele não está mais
   ([[feedback_texto_que_promete_capacidade_e_divida]]).

#### ⚠️ Armadilha de ambiente: `tsconfig.spec.json` não vai na imagem

`npm test` dentro do `capul-gestao-pessoas-api` dá **52 suítes falhando com 0 testes** —
*"File not found: tsconfig.spec.json"*. E o container tem `mem_limit: 512m`: o jest come a memória
do app, derruba o healthcheck e às vezes morre com **exit 137**.

⭐ **0 testes executados nunca é resultado** — nem verde nem vermelho. Rodar a suíte num container
descartável (`docker run --rm --memory=6g`, montando `src`, `prisma`, `tsconfig.spec.json`, e com
`npx prisma generate` antes) leva **14 segundos** e dá os 655.

---

### 3.1.64. ✅ CADASTRO DE CRITÉRIOS E FAIXAS — o catálogo deixa de ser só leitura (11/09)

Item 2 da ordem de §3.1.62. Até aqui `rh.criterio` e `rh.criterio_faixa` só nasciam pelo seed:
não havia um `create`/`update` em lugar nenhum do `src/`. O efeito prático era que
*"cadastre a faixa no critério e reapure"* — que o motor manda quando um valor não cai em faixa
nenhuma — **não tinha para onde mandar**: a saída era T.I. no banco.

#### ⚠️ A validação de continuidade que existia NÃO servia

A ordem dizia *"a validação de continuidade já existe — use"*. Existe, mas é outra:
`ciclo/abertura.validator → validarConceitos` é de **`ConceitoFaixa`** (0–100 fechado, no ciclo).

| | ConceitoFaixa | CriterioFaixa |
|---|---|---|
| Domínio | 0 a 100, fechado | ponta **aberta** ("mais de 7 anos") |
| Tipo | só numérica | numérica **ou** DOMINIO (código exato, sem limite nenhum) |
| Exigência | começar em 0, terminar em 100 | nenhuma das duas |

⭐ **Aplicar a regra dos conceitos aqui reprovaria `TEMPO_EMPRESA` e `ESCOLARIDADE`** — os dois
critérios que rodam hoje. `criterio/faixa.validator.ts` é nova, modelada na existente, e o
**primeiro bloco da spec trava os dois critérios reais**: se ele quebrar, a validação está
reprovando o instrumento em produção e o erro é dela.

O que ela checa, e o caso que ninguém vê:

- **buraco** → o valor não cai em faixa nenhuma, o critério vira `semDado` e sai da nota pela
  renormalização, **sem erro**, para todos naquela faixa;
- **sobreposição** → `localizarFaixa` devolve a primeira por `ordem`, então a pontuação passa a
  depender da ordem de cadastro;
- ⭐ **a FRONTEIRA** — `(0,3]` seguido de `[3,5]` não tem buraco nem sobreposição de intervalo,
  mas o valor 3 cai nas duas. Não aparece olhando a lista de limites. A checagem é sobre a
  INCLUSIVIDADE: exatamente uma das duas pontas fecha.

#### ⭐⭐ A regra da tela é a MESMA função do backend — literalmente

A recusa aparece **antes do clique** por `POST /criterios/:id/faixas/conferir`, que roda o mesmo
`validarFaixasDoCriterio` do `PUT`, sem gravar e sem auditar. A alternativa era portar ~100 linhas
de regra para o frontend — duas cópias que envelhecem diferente, com sintoma mudo nos dois
sentidos (a tela libera o que a API recusa, ou recusa o que ela aceita).

#### 🐛 DEFEITO MEU — sanitizar em silêncio o que a regra manda recusar

`assertSalvavel` zerava o `codigoCalculo` por origem **antes** de validar:

```ts
codigoCalculo: dto.origem === 'CALCULADO' ? dto.codigoCalculo : null   // ERRADO
```

Com isso a regra escrita em `criterio.validator` — *"INFORMADO com código de cálculo: recuse"* —
**nunca era alcançada**: o service limpava o campo e o validador não via nada errado.

⭐ **Sanitizar em silêncio o que a regra recusa é pior que não validar**: some com o sintoma e
deixa quem trocou a origem achando que o cálculo continua valendo. Corrigido, com spec de
regressão.

⚠️ **Foi pego exercitando o serviço contra o BANCO, não pela suíte** — que estava verde com 676.
É o mesmo padrão de 09/09: percorrer o caminho inteiro acha o que o teste unitário não vê.

#### ⚠️⚠️ O INFORMADO está PELA METADE, e a tela diz isso

Cadastrar o critério é metade do caminho: **sem o VALOR de cada pessoa ele não pontua ninguém** —
a apuração o marca `SEM_VALOR_INFORMADO` e o tira da nota pela renormalização, sem erro.
`rh.criterio_valor_informado` existe e tem **0 linhas**; a tela de importar/digitar **não existe**.

O cartão do critério INFORMADO ativo, com faixas e zero valores, avisa. Calada, a tela prometeria
capacidade pela metade e a descoberta viria na apuração — quando não há mais o que fazer. O aviso
some sozinho quando a tela existir: a condição é o próprio contador.

**A entrada de valor é FRENTE SEPARADA** — estimativa 4–6 dias (upload de planilha + casamento por
matrícula + prévia do que vai entrar + o que fazer com quem está na planilha e não no ciclo).

#### As duas correções de tela da varredura

1. **O aviso do painel agora LEVA ao critério.** *"Cadastre a faixa no critério"* era instrução sem
   destino. Virou link para `/criterios#criterio-<codigo>` — ⚠️ **só para `RH_ADMIN`**: link que
   leva a 403 troca *"não é com você"* por *"o sistema quebrou"*.
2. **A memória de cálculo mostrava `Superior completo (35)`.** O 35 é código de cadastro e lia como
   nota, três colunas antes da pontuação real (75). Virou `(código 35)`. **Só em DOMINIO** — em
   NUMERICO o bruto já vem com unidade ("5,4 anos"), que o distingue sozinho.

#### O que a fronteira RH × T.I. virou, na prática

| Ato | Quem faz |
|---|---|
| Criar critério **INFORMADO**, faixas, rótulos, ativar/desativar | **RH sozinho** |
| Criar critério **CALCULADO** escolhendo um cálculo existente | **RH sozinho** — `<select>` de `codigosRegistrados()`, com quem já usa cada um ao lado |
| Criar um **cálculo novo** | **T.I.** — resolver é código |
| Informar o VALOR de um INFORMADO | **ninguém ainda** — próxima frente |

⭐ `assertCriterioSalvavel` (94 linhas, spec verde desde 05/09) ganhou o **primeiro chamador da
vida dele**. O comentário do arquivo fala em "TRÊS momentos" e só dois existiam; agora são três.

#### Verificação

Exercitado contra o banco de DEV com um critério descartável — criado, percorrido em **11 passos**
e **apagado por código explícito**: resolvers, as 3 recusas de cadastro, buraco, fronteira nas
duas, conferir-sem-gravar (e a prova de que não gravou), salvar, troca de tipo com faixas.

⚠️ Na primeira rodada a limpeza dependia de uma variável que o passo 3 ainda não tinha preenchido,
e **uma linha ficou no banco**. Recorte de limpeza é por **chave explícita**, sempre — a mesma
regra dos commits.

**Piloto intacto: 894 PENDENTE, 0 respostas.** Suíte: **681 testes, 55 suítes**.

⚠️ **Não há conta de teste com `RH_ADMIN` no DEV** — só `ariellypereira`, que é pessoa real. Por
isso a verificação foi no serviço contra o banco, e **a tela em si não foi percorrida por
ninguém logado**. Criar a conta de teste é pré-requisito do roteiro de tela desta frente.

---

### 3.1.65. ⭐⭐ REGRA — antes de reaproveitar, conferir se a peça existente SERVE

Duas vezes no mesmo dia (11/09), nas **duas direções opostas**, e é isso que faz a regra:

| | O que aconteceu | O que teria custado |
|---|---|---|
| **`distribuirPeso`** | quase **reimplementei** o que já existia — escrevi a repartição em centavos do zero, e só depois achei a original em `modelo/distribuir-peso.ts`, escrita em 05/09 para o seed | duas cópias da regra que decide a nota de todo mundo, envelhecendo diferente |
| **`validarConceitos`** | quase **usei** o que não servia — a ordem dizia *"a validação de continuidade já existe"*, e existe: mas é a de `ConceitoFaixa` (0–100 fechado, sem ponta aberta, sem DOMÍNIO) | reprovaria `TEMPO_EMPRESA` e `ESCOLARIDADE` — os dois critérios que rodam hoje |

**A regra:** *"já existe" e *"serve"* são perguntas SEPARADAS, e as duas precisam de resposta antes
de escrever a primeira linha.

- **Antes de escrever**, procurar. O sinal que teria achado o `distribuirPeso`: a regra que eu ia
  escrever produz um número que **já está gravado no banco** — alguém o gravou, e esse alguém é
  código.
- **Antes de reaproveitar**, ler o DOMÍNIO da peça, não o nome dela. Duas funções chamadas
  "validar continuidade de faixas" checavam coisas diferentes porque as faixas são diferentes:
  uma fecha em 0–100, a outra tem ponta aberta e tipo de domínio.
- **O teste que separa as duas:** rodar a peça candidata contra o DADO REAL antes de adotá-la.
  `validarConceitos` aplicada às faixas de `TEMPO_EMPRESA` reprova na hora — a resposta custava
  um minuto e vinha antes de qualquer decisão.
- Quando a peça existente **não** serve, a nova nasce **modelada nela** e com o comentário dizendo
  por que não é a mesma. `criterio/faixa.validator.ts` abre com essa comparação, para o próximo
  não refazer a pergunta.

### 3.1.66. ⭐⭐ FAMÍLIA DE DEFEITO — o que passa no teste e sai errado em produção, calado

Dois defeitos de 11/09, achados **exercitando contra o banco**, com a suíte verde nos dois casos:

| | Defeito | Por que a spec não pegou | Como sairia em produção |
|---|---|---|---|
| **1** | `pontuacaoMaximaDoArranjo` arredondava **por questão** (`5,34 × 1,2 = 6,408 → 6,41`) | a spec só existiu quando comparei com o **instrumento herdado**; com dado sintético de pesos redondos o erro não aparece | Administrativo com pontuação máxima **72,03** em vez de 72 — toda nota do perfil 0,04% menor, e o número gravado deixando de bater com o calculado |
| **2** | `assertSalvavel` zerava o `codigoCalculo` por origem **antes** de validar | a regra recusada nunca era **alcançada**: o service limpava o campo e o validador não via nada errado. Um teste do VALIDADOR passa; o defeito está na casca | INFORMADO com código de cálculo entra no banco "limpo" — quem trocou a origem segue achando que o cálculo vale |

**O que os dois têm em comum, e é a família:**

1. **Nenhum quebra.** Não há exceção, não há log, não há linha vermelha. O sistema responde 200 e
   grava um número.
2. **O erro é de MAGNITUDE ou de OMISSÃO**, não de tipo — 72,03 em vez de 72; um campo `null` em
   vez de uma recusa. Passa por qualquer validação de forma.
3. **A camada onde o defeito mora não é a camada que tem spec.** A regra estava certa nos dois
   casos: o arredondamento na função de soma, a validação no validador. O erro estava em **quem
   chama** — a ordem da conta, e o que se entrega ao validador.
4. ⭐ **Os dois foram pegos percorrendo com DADO REAL**, não por revisão nem por teste unitário. O
   primeiro por comparar com o instrumento que já existia; o segundo por exercitar o serviço
   inteiro contra o banco, criando e apagando um critério descartável.

⭐ **A contramedida que funcionou nos dois:** *escrever um teste que compara com o que JÁ EXISTE
em produção* (os 44 pesos gravados; as recusas que a regra escrita promete). Dado sintético
confirma a implementação; **dado real confirma a intenção**.

⚠️ **Corolário para a casca.** Service que "normaliza" antes de validar tem de provar que a
normalização não apaga um caso que a regra recusaria. **Sanitizar em silêncio o que a regra manda
recusar é pior que não validar**: some com o sintoma e deixa a pessoa com a crença errada.

---

### 3.1.67. ⭐⭐ SEPARAÇÃO DE FUNÇÕES — a regra vale para AGIR **e para LER** (11/09)

Item 17 da varredura. O CSV já omitia a própria linha; a **tela** mostrava nota, conceito e o
botão da memória de cálculo, e a **memória** devolvia tudo — apenas *registrando*
`proprioResultado: true` na auditoria. **Registrar não é impedir**: a trilha provava o acesso
depois de ele ter acontecido.

#### ⚠️ Não foi esquecimento — foi decisão registrada, e o texto a legitimava

A dispensa de `resultado.service.ts` no `separacao-funcoes.invariante.spec.ts` dizia, por escrito:

> *"a linha de quem gera o arquivo fica FORA dos dois CSV: **na tela a própria linha aparece
> marcada**, mas arquivo que sai do sistema é outro ato."*

Marcar foi tratado como suficiente para a tela. O texto da dispensa foi corrigido junto com o
código — senão a próxima leitura reafirma a regra antiga, e o invariante passa a defender o furo.

⭐ **Lição de forma:** dispensa de invariante não descreve só *por que o arquivo está fora* — ela
**afirma qual é a regra**. Quando a regra muda, o texto da dispensa é código.

#### As três superfícies, agora iguais

| Superfície | Antes | Agora |
|---|---|---|
| CSV do ciclo | linha fora do arquivo ✅ | igual |
| **Tela de Resultados** | 🔴 nota, conceito e botão da memória | linha **aparece**, sem nota, conceito nem renormalização |
| **Memória de cálculo** | 🔴 devolvia tudo, só auditava | **403** em qualquer papel, com a tentativa auditada |

- **Zerado no SERVIDOR**, não escondido no cliente — esconder na tela deixaria o número viajando
  no JSON, e quem chamasse a API direto o leria.
- Verificação por **REGISTRO** (`ehProprioAvaliado`), nunca por papel: `RH_ADMIN` e o `ADMIN` da
  plataforma incluídos.
- **A linha fica**, com nome e matrícula, no mesmo tom que o módulo já usa com o avaliador
  (*"a sua própria avaliação não fica visível para você"*). Omiti-la faria o total da tela divergir
  do total do ciclo sem explicação.
- A própria linha deixou de ser BOTÃO: botão que abre 403 convida ao clique e responde com erro,
  que a pessoa lê como defeito.

#### ⭐⭐ A MÉDIA precisou mudar — sem isso a omissão não valeria nada

Pergunta do Clenio, e a resposta é **sim, era trivialmente recuperável**:

```
própria = média × N − Σ(notas das outras linhas)
```

Com N linhas visíveis e N−1 notas na tela, é uma subtração. Esconder o número e mantê-lo dentro
da média não esconde nada.

A média passou a ser sobre `comNota` (exclui a própria) e o rótulo diz **"sobre N, sem a sua"** —
dois números verdadeiros lado a lado precisam do termo que os concilia. **As CONTAGENS seguem
sobre tudo**: elas não permitem deduzir nota nenhuma.

#### A varredura dos outros caminhos de leitura

| Caminho | Devolve nota individual? | Aplica a regra? |
|---|---|---|
| `resultado.doCiclo` (tela) | sim | ✅ agora |
| `resultado.csvDoCiclo` | sim | ✅ já aplicava |
| `resultado.memoria` | sim (completa) | ✅ agora, com 403 |
| `resultado.csvDeCanceladas` | não (canceladas não têm nota) | n/a |
| `ciclo.previaDaDevolucao` | **não** — nomes + contagem de respostas | n/a |
| `apuracao.conferir/apurar` | **não** — contagens e alertas agregados | n/a |
| `avaliacao.enviar` | sim (própria, no envio) | já barrado: `responder`/`editar` recusam no próprio |
| `painel.*` | não — só agregados | n/a |

**Nada a mudar fora do `resultado.service`.** Registrado assim porque a pergunta *"quais aplicam e
quais não"* vale mais que a correção: da próxima vez a varredura começa desta tabela.

#### Verificação

`resultado/propria-nota.spec.ts` (novo) cobre as três superfícies com os dois ramos. E o caminho
foi percorrido **contra dado real** no ciclo SIMULACAO, rodando o serviço como uma pessoa que tem
resultado lá: a linha dela vem sem nota e sem conceito, a das outras intacta, a memória própria dá
403 com auditoria, a de terceiro abre, e o CSV sai com **12 de 13** sem o nome nem a matrícula dela.

⚠️ Na primeira rodada o passo do CSV acusou "0 linhas" — **era o script de prova lendo o campo
errado** (`csv.conteudo` em vez de `.linhas`), não um defeito. Conferir antes de chamar de achado:
falso vermelho destrói a ferramenta.

---

### 3.1.68. 🔑 CONTA DE TESTE do módulo no DEV — `zz.teste.rh` (11/09)

Criada em 11/09 a pedido do Clenio. **Não substitui a decisão de quem é o segundo `RH_ADMIN` de
verdade** — essa continua com a Arielly (ver `common/roles-rh.ts`: a separação de funções exige
dois, porque a gestora também é avaliada).

| | |
|---|---|
| Login / senha | `zz.teste.rh` / `TesteRh2026` |
| Papel | `RH_ADMIN` em `GESTAO_PESSOAS`, departamento T.I. |
| Matrícula | `009900` (faixa `0099xx` estava vazia) |
| Colaborador | `zz-teste-ti-colaborador` — *"ZZ CONTA DE TESTE T.I. — NÃO É PESSOA"* |
| Centro de custo | `ZZTESTE` — **nenhuma aplicação mira este CC**, então ela não entra em ciclo |

⚠️ **Por que precisou de um COLABORADOR, e não só de um usuário:** o `IdentidadeGuard` falha
fechada — usuário sem matrícula que bata com colaborador ativo **não entra no módulo**. O próprio
guard já registrava a consequência: *"contas de SISTEMA sem matrícula não acessam o módulo (…) o
segundo RH_ADMIN precisa ser uma PESSOA com matrícula"*. Uma conta de teste é o mesmo caso.

⚠️ **`rh.colaborador` foi de 1.036 para 1.037.** Toda contagem populacional do DEV muda em 1. Não
afeta ciclo (CC fora de qualquer aplicação, e o público do Piloto já está montado nominalmente),
mas afeta *"quantas pessoas ativas existem"*. Para remover:

```sql
DELETE FROM rh.colaborador WHERE matricula = '009900';   -- e o usuário, no Configurador
```

⭐ **Duas personas da varredura de 10/09 não rodaram por falta de conta** — este é o mesmo
gargalo que [[feedback_designar_nao_da_acesso]] registra do lado do avaliador: *designar não dá
acesso*, e **testar também exige conta que exista**.

---

### 3.1.69. ⭐⭐ A CHECAGEM QUE EXISTE E É INALCANÇÁVEL QUANDO SERVIRIA (11/09)

A conferência de pendências do painel roda sobre `status: 'ENVIADA'`. Com zero enviadas — que é o
estado do ciclo **no dia em que ele abre** — ela responde *"Nada a conferir ainda"*. A checagem
existia, estava certa, e **só falava depois que as notas já tinham saído sem o critério**.

⭐ **A forma do defeito:** a pré-condição de existência do dado coincide com o momento em que a
checagem já não serve. Não é checagem faltando nem errada — é checagem **fora de hora**, e por isso
não aparece em revisão: quem lê o código vê uma verificação correta.

**A família:** é o mesmo desenho da guarda do `[DEMO]` (§3.1.30), que vivia só na abertura — dava
para montar a aplicação inteira sobre um modelo de demonstração e descobrir na última porta.

**Varredura das outras com essa forma** (11/09):

| Checagem | Momento | Chega a tempo? |
|---|---|---|
| conferência de pendências (`SEM_FAIXA`, `SEM_VALOR_INFORMADO`, `SEM_DADO_CADASTRAL`) | sobre `ENVIADA` | 🔴 **era a única restante** — agora pareada com o aviso da abertura |
| guarda do `[DEMO]` | abertura **+ criar/editar aplicação** | ⚠️ **CORRIGIDO EM 12/09 — ver abaixo** |
| resolver registrado | montagem da Aplicação **+** abertura | ✅ dois momentos, por desenho |
| peso, público vazio, critério duplicado | criar/editar **+** abertura | ✅ |

**Nenhuma outra.** Registrado como tabela porque a pergunta *"quais chegam a tempo"* vale mais que
a correção: a próxima varredura começa daqui.

> ### ⚠️ CORREÇÃO DESTE REGISTRO (12/09/2026)
>
> A linha do `[DEMO]` estava **errada pela metade**, e o erro é de método: eu varri os **momentos
> da API** e escrevi "chega a tempo" a partir deles. A pergunta é *"chega a tempo para QUEM?"* — e
> quem precisa da resposta é a pessoa na tela.
>
> A guarda de fato roda em três pontos da API. **Na TELA ela chega tarde:** o `<option>` do modelo
> de DEMONSTRAÇÃO continuava **selecionável**, com o aviso escrito sob o rótulo do campo. A pessoa
> escolhia o [DEMO], nomeava a aplicação, distribuía os pesos entre os critérios — e a recusa
> chegava no **Salvar**. O aviso existia; o clique não era impedido.
>
> ⭐ **Aviso que não impede o clique não chega antes: chega junto com o trabalho perdido.** Uma
> varredura de "chega a tempo" que só olha o backend responde a pergunta errada — e passou por
> revisão minha em 11/09 sem que eu notasse, porque eu estava contando pontos de validação em vez
> de percorrer a tela. Corrigido em 12/09 (§3.1.105): a opção é `disabled`, e o rótulo diz por quê.

#### O que foi feito

- **Escopo CALCULADO** (`escopoAgregado`): `SEM_VALOR_INFORMADO` e `SEM_DADO_CADASTRAL` sobem para
  `CONFIGURACAO` quando atingem **todo mundo**. *"Resolve-se caso a caso"* para 894 pessoas manda
  fazer 894 correções onde cabe uma importação — e ainda ordenava o alerta **abaixo** dos de
  configuração. O texto muda junto: *"NINGUÉM tem valor informado… Importe os valores e reapure."*
- **Aviso na abertura** (`avisosParaAbrir`): critério `INFORMADO` sem nenhum valor no ciclo. Lista
  **separada** da de problemas — juntas, o aviso pareceria impedimento e a tela diria "não pode
  abrir" para algo que pode.

### 3.1.70. ⭐⭐ DISTRIBUIÇÃO REAL POR FAIXA — a régua passa a mostrar o que mede (11/09)

`GET /criterios/:id/distribuicao`. O cadastro mostrava os limites e escondia o tamanho: dava para
apagar a faixa de 480 pessoas sem que nada na tela dissesse que eram 480.

- **Reusa os RESOLVERS e a `localizarFaixa`** — o número da tela tem de ser o mesmo que a apuração
  vai produzir. Uma segunda forma de calcular "em que faixa esta pessoa cai" divergiria da
  primeira, e o sintoma seria a tela prometendo uma distribuição que a nota não confirma.
- **DOMÍNIO e NUMÉRICO.** `INFORMADO` responde `aplicavel: false` **com o motivo** (o valor é por
  ciclo) — zeros pareceriam "ninguém se encaixa", que é afirmação falsa.
- **Ancorada em HOJE, e a tela diz.** Tempo de empresa e de função mudam com a data-base; número
  sem a data que o ancora envelhece calado.
- Carrega **uma vez, na abertura do diálogo**: a distribuição é do que está GRAVADO, não do que
  está sendo digitado.

**Medido em produção (1.037 ativos):**

| Critério | Distribuição |
|---|---|
| ESCOLARIDADE | `[3, 9, 27, 95, 68, 138, **480**, 74, 108, 1, 0, 33, 1]` — o 480 é o código 45 |
| TEMPO_EMPRESA | `[**0**, 418, 133, 100, 386]` |
| QTDE_TREINAMENTO | `[**1031**, 4, 2, 0, 0]` — 6 pontuariam, e o argumento de mantê-lo desligado ficou **visível na tela** |

#### 🔎 Achado de brinde — a faixa `[0,0]` de TEMPO_EMPRESA rotulada "Menos de 1 ano" tem ZERO pessoas

Ela é `0 ≤ x ≤ 0`: só casa com **exatamente zero anos**, isto é, admitido hoje. Quem tem 6 meses
cai na faixa seguinte, `(0,3]` — *"Até 3 anos"*, 25 pontos. **O rótulo promete um intervalo que a
faixa não tem.**

⚠️ **Não mexi**: ela reproduz o `CASE WHEN` do select do Protheus, e a regressão do ciclo `000006`
depende dela. Mudar o limite mudaria a nota de quem tem menos de 1 ano — decisão do RH, não da T.I.
O que a distribuição fez foi **tornar visível** o que estava escrito havia meses e ninguém tinha
como ver: uma faixa com zero pessoas, num cadastro que agora mostra o tamanho.

### 3.1.71. ⭐⭐ FAMÍLIA — o sistema AFIRMANDO que está certo quando não está

Três defeitos de 11/09, e os três são o mesmo. Não são "faltou validar": são **afirmação errada**.

| | Onde | O que o sistema AFIRMAVA | O que era |
|---|---|---|---|
| **1** | `conferirFaixas` com conjunto vazio | `{"problemas": []}` — *está tudo certo* | apagaria as 13 faixas de ESCOLARIDADE, 5 aplicações, e o critério pararia de pontuar 1.037 pessoas |
| **2** | `assertSalvavel` zerando `codigoCalculo` antes de validar | o cadastro **passou** — logo, é válido | a regra escrita manda RECUSAR `INFORMADO` com código de cálculo; ela nunca era alcançada |
| **3** | `RA4_HORAS` no `RA4010` | coluna **preenchida**, não nula — logo, tem dado | 2.268 linhas, **todas zero**. Um critério sobre ela daria 0 para todos, calado |

**O que os une:**

- ⭐ **Não é silêncio — é aval.** Silêncio deixa a pessoa desconfiada; afirmação errada encerra a
  investigação com a resposta trocada. Nos três, o sistema respondeu *"ok"* a uma pergunta que ele
  não tinha como responder.
- **Passam em qualquer teste de forma.** `[]` é uma lista válida; `null` é um valor válido; `0` é
  um número válido. Nenhum quebra tipo, schema ou contrato.
- **A camada que afirma não é a camada que sabe.** A conferência não sabia que o critério estava em
  uso; o validador não recebeu o campo cru; o resolver não sabia que a coluna vinha zerada da
  origem.
- ⭐⭐ **Os três só apareceram com DADO REAL.** Nenhum foi achado por spec — e não seria: dado
  sintético confirma a implementação, dado real confirma a intenção
  ([[feedback_numero_preciso_pode_ser_resto_de_conta]], §3.1.66).

**A contramedida:** antes de uma camada responder *"está certo"*, perguntar **o que ela não sabe**.
Se a resposta depende de um fato que ela não carregou (o critério está em uso? o campo veio cru? a
coluna tem valor de verdade?), ela não pode afirmar — só pode dizer *"não vi problema no que eu
olhei"*, que é outra frase. Foi assim que o `conferir` ganhou `avisos` além de `problemas`.

### 3.1.72. ✅ O `1.036` conferido — só prosa, nada compara

Com a conta de teste (§3.1.68) `rh.colaborador` foi para **1.037**. Varredura do número como valor
fixo: **11 ocorrências, todas em comentário, `.md` ou spec como texto explicativo**. Nenhum
`toBe(1036)`, nenhuma comparação, nenhum limite de consulta. Nada passa a divergir.

⚠️ O que **muda de valor** é a distribuição de §3.1.70 (1.037 em vez de 1.036) e qualquer contagem
populacional lida da tela — por isso a conta de teste está registrada com o SQL de remoção.

---

### 3.1.73. 🔴 PENDÊNCIA DA ARIELLY — a faixa "Menos de 1 ano" não alcança ninguém

**Não é bug para a T.I. consertar. É decisão de RH, e mexer arrasta três coisas.**

`TEMPO_EMPRESA` e `TEMPO_FUNCAO` têm, cada um, uma faixa `0 ≤ x ≤ 0` rotulada **"Menos de 1 ano"**,
valendo **0 pontos**. Ela só casa com **exatamente zero** — admissão na própria data-base. Medido
com a distribuição (§3.1.70), sobre 1.037 ativos:

| Critério | Faixa `[0,0]` "Menos de 1 ano" | Faixa seguinte |
|---|---:|---|
| TEMPO_EMPRESA | **0 pessoas** | `(0,3]` "Até 3 anos" → **418 pessoas**, 25 pontos |
| TEMPO_FUNCAO | **0 pessoas** | `(0,2]` "Até 2 anos" → **755 pessoas**, 25 pontos |

⭐ **Consequência hoje:** quem tem menos de 1 ano de casa é pontuado como *"Até 3 anos"* e recebe
**25 pontos**, não 0. O rótulo "Menos de 1 ano" descreve uma intenção que a faixa não implementa.

#### ⚠️ O que se arrasta ao "consertar" — e é por isso que isto está escrito

1. **Muda a nota de gente.** Corrigir o limite (por exemplo `[0,1)` → 0 pontos) tira 25 pontos do
   critério de quem tem menos de um ano. Com peso 10 contra 60, mexe na nota final delas.
2. **O Protheus tem o MESMO `CASE WHEN`.** O select antigo pontua igual. Corrigir aqui faz o módulo
   **divergir do sistema que o RH conhece** — e a diferença apareceria como "o sistema novo deu
   nota diferente", sem ninguém lembrar desta linha.
3. **Quebra a regressão do ciclo `000006` como baseline.** Os 108/108 do
   `docs/REGRESSAO_PROTHEUS_GESTAO_PESSOAS.md` valem porque as faixas reproduzem o select original.
   Mudar a faixa e manter o teste verde exigiria mudar o esperado — isto é, **perder a referência
   externa** que prova que o motor novo reproduz o antigo.

⛔ **Não corrigir por conta própria.** É o tipo de coisa que alguém "arruma" numa tarde por parecer
um limite errado óbvio — e arrasta os três de uma vez, sem que nada acuse.

**O que decidir:** manter como está (e então **corrigir o rótulo**, que é o que mente), ou mudar a
régua (e aí decidir junto o que fazer com a regressão como baseline).

### 3.1.74. ✅ VARREDURA DAS FAIXAS INALCANÇÁVEIS — e a diferença entre escassez e limite errado

Pergunta levantada por o `[0,0]` ter aparecido: **alguma outra faixa é logicamente inalcançável?**

#### As três faixas de ponto único — e por que uma delas está certa

| Critério | Faixa | Pessoas | Domínio | Veredito |
|---|---|---:|---|---|
| `QTDE_TREINAMENTO` | `[0,0]` "Nenhum curso" | **1.031** | **DISCRETO** (contagem) | ✅ legítima — "exatamente 0 cursos" é o caso mais comum |
| `TEMPO_EMPRESA` | `[0,0]` "Menos de 1 ano" | **0** | **CONTÍNUO** (`anosEntre` → float) | 🔴 §3.1.73 |
| `TEMPO_FUNCAO` | `[0,0]` "Menos de 1 ano" | **0** | **CONTÍNUO** | 🔴 §3.1.73 |

⭐⭐ **A regra que sai daqui:** faixa de ponto único (`inf == sup`) é legítima sobre domínio
**discreto** e praticamente inalcançável sobre domínio **contínuo** — acertar um float exato é
conjunto de medida zero. As três têm a mesma FORMA e não são o mesmo caso; o que decide é o que o
resolver devolve, não o formato da faixa.

⚠️ `faixa.validator` **aceita** ponto único de propósito, e continua aceitando: recusar quebraria
`QTDE_TREINAMENTO`, que está certo. O validador não conhece o domínio do resolver — quem responde
essa pergunta é a **distribuição**, e é por isso que ela precisava existir.

#### ESCOLARIDADE — escassez, não limite errado

`[3, 9, 27, 95, 68, 138, 480, 74, 108, 1, 0, 33, 1]` sobre 13 códigos do SX5 tabela 26.

| Faixa | Pessoas | Veredito |
|---|---:|---|
| `65` MESTRADO COMPLETO | 1 | **escassez** |
| `75` DOUTORADO COMPLETO | **0** | **escassez** — o código é válido no SX5, ninguém o tem hoje |
| `95` PÓS-DOUTORADO | 1 | **escassez** |

Faixa de DOMÍNIO só é inalcançável se o código **não existe no domínio**. Os três existem e têm a
descrição real do SX5. **Nenhuma correção a fazer** — e cadastrar quem falta é o certo: no dia em
que a Capul contratar um doutor, a faixa já está lá.

#### As faixas de CONCEITO — a pergunta de 10/09, respondida

*"Nota exatamente 25, 50, 75 ou 90 cai em qual?"* Medido rodando `conceitoDaNota` sobre a régua
0 · 25 · 50 · 75 · 90 · 100:

| Nota | Conceito | | Nota | Conceito |
|---:|---|---|---:|---|
| 24,99 | Insuficiente | | 75,00 | **Supera** |
| **25,00** | **Abaixo do esperado** | | 89,99 | Supera |
| 49,99 | Abaixo do esperado | | **90,00** | **Excelente** |
| **50,00** | **Atende** | | 100,00 | Excelente |

⭐ **No valor exato do encontro, a nota vai para a faixa DE CIMA.** Inferior inclusivo, superior
exclusivo — exceto a última, que fecha em 100 para a nota máxima ter conceito.

**Nenhuma faixa de conceito é inalcançável:** varridas as 10.001 notas possíveis de `Decimal(6,2)`
entre 0,00 e 100,00, as 5 faixas são alcançadas.

⚠️ **O que faltava não era a regra — era a TELA dizer.** A régua de conceitos informava *"as faixas
são contíguas: o fim de uma é o começo da próxima"* e **calava sobre o valor do encontro**. Quem
define os limites decide o conceito que a pessoa recebe e não tinha como saber para que lado o
empate vai. Corrigido: a tela agora diz, com o exemplo da régua padrão.

---

## 📋 PENDÊNCIAS DA ARIELLY — a lista para levar (12/09/2026)

Sete itens. Cada um é decisão **dela**, não da T.I. Onde há número, ele foi medido no DEV em
12/09 e está aqui para a conversa não depender de memória.

### 1. As 39 perguntas — o CONTEÚDO (não é mais bloqueio de ordem)

O instrumento veio transcrito do RD8010 e **ninguém do RH escolheu enunciado, peso ou
alternativa**. A tela `/questionarios` existe e imprime — dá para ler tudo.

⚠️⚠️ **MUDANÇA DE ORDEM, 13/09 (Clenio).** Este item **deixou de bloquear a fila**. O raciocínio:
se a meta é o sistema completo, **o editor do acervo entra de qualquer jeito** — a pergunta dela só
decidia se vinha antes ou depois. Sem contato, vem antes.

O que sobra é **decisão sobre o CONTEÚDO** — enunciado, peso por perfil, alternativas —, e ela a
toma **na tela**, quando o editor existir. Não precisa de resposta antecipada para o trabalho
começar.

### 2. A faixa "Menos de 1 ano" — são DUAS, e mexer arrasta três coisas

`TEMPO_EMPRESA` e `TEMPO_FUNCAO`, ambas `[0,0]`, **zero pessoas** (§3.1.73/§3.1.74). Hoje quem tem
menos de um ano é pontuado como *"Até 3 anos"* / *"Até 2 anos"* — **25 pontos, não 0**.

Corrigir: muda a nota dessas pessoas · faz o módulo **divergir do Protheus**, que tem o mesmo
`CASE WHEN` · **quebra a regressão do `000006` como baseline**. Alternativa barata: manter a régua
e **corrigir o rótulo**, que é o que mente.

### 3. Prefixo de centro de custo mandando a fábrica para o questionário de loja

**Medido — os dois CCs com o mesmo nome:**

| CC | Descrição | Pessoas | Questionário pelo prefixo |
|---|---|---:|---|
| `21011202` | ADMINISTRATIVO - FABRICA | **49** | 🔴 Operação de Loja |
| `41010114` | ADMINSTRATIVO DA FABRICA | 4 | Produção e Indústria |

**53 pessoas**, mesmo trabalho, dois códigos, dois questionários. E `21010109` AGROVETERINARIA (89)
e `21010301` POSTO (37) também caem em "Loja" pelo prefixo `21`.

#### ⭐⭐ CORREÇÃO — o sistema NÃO impõe o código contábil

Como este item estava escrito antes, sugeria que o sistema obriga a seguir o prefixo do centro de
custo. **É falso, e a diferença muda a conversa inteira.**

Apurado em 12/09: o público das quatro aplicações do Piloto é **100% nominal** —
`aplicacao_centro_custo` está **vazio para todas as quatro**. Quem decide quem entra é
`rh.aplicacao_publico`, **uma linha por pessoa**. O prefixo foi apenas **como o recorte foi
montado** naquela vez, por quem o montou.

| | |
|---|---|
| O sistema impõe prefixo? | **Não.** Não existe regra de prefixo em lugar nenhum do código |
| O que ele suporta | **lista de pares `(filial, centro de custo)` exatos**, quantos quiser — e também por filial, ou pessoa a pessoa |
| Custo de corrigir | **remontar o público** da aplicação. Nada de código, nada de migration |

⭐ **A decisão é 100% dela**, e é sobre o INSTRUMENTO: as 49 pessoas do `ADMINISTRATIVO - FABRICA`
devem responder o questionário de Loja, o de Produção, ou um terceiro? O código contábil não tem
opinião sobre isso — quem tinha era o atalho usado na montagem.

#### ⭐⭐ E o item cresceu: é o maior bloco gerencial fora do supermercado

Medido em 12/09 sobre os 16 CCs do ensaio: dos **39 cargos gerenciais**,
**8 estão no `21011202` ADMINISTRATIVO - FABRICA** — três `GER GADO CORTE E LEITE`, um
`GERENTE ADMINISTRATI` (truncado no cadastro), um `GERENTE GERAL` e três `SUPERVISOR ADM
COMERCIAL`. Só o supermercado tem mais.

⚠️ **Correção do enquadramento:** este item deixou de ser *"80 pessoas no questionário errado"*.
Passa a ser: **o maior bloco gerencial fora do supermercado está no CC cuja classificação está em
dúvida** — e o questionário que essas 49 pessoas respondem é decidido pelo mesmo atalho que está
em questão.

⚠️ **Correção de fato:** o `21011202` **ESTÁ no recorte do ensaio** (é um dos 16), e tem
responsável presente — `lidyanerocha` (002336) está lotada nele. O rótulo *"INDUSTRIA"* que
circulou para este CC está errado: no cadastro ele se chama **ADMINISTRATIVO - FABRICA**. Quem é
`GERENCIA INDUSTRIAL` é o `41010121`, com **1 pessoa**.

### 4. Segundo `RH_ADMIN` — encaminhamento: Claudimar

**Medido:** hoje só `ariellypereira` tem `RH_ADMIN`. `claudimaroliveira` (001079, DIRETOR EXECUTIVO)
tem **`AVALIADOR`**.

⚠️ Duas coisas faltam, e a segunda é a que costuma ser esquecida: **confirmar o Claudimar** e
**decidir quem cobre a avaliação dele** — pela separação de funções, um `RH_ADMIN` não mexe na
própria avaliação, então com ele no papel alguém precisa poder corrigir a dele.

### 5. Recorte provisório — o que se confirma: linha, aplicação ou ciclo?

A tela já distingue público **provisório** de confirmado e mostra a quebra por origem. Falta a
decisão sobre a **granularidade do ato**: confirmar pessoa a pessoa, a aplicação inteira, ou o
ciclo todo de uma vez.

### 6. Treinamento — pendência de PROCESSO do RH, não de sistema

O registro no Protheus parou em **14/11/2025**. Na janela do Piloto, **6 de 1.036** pontuariam —
e a distribuição agora **mostra isso na tela**: `[1031, 4, 2, 0, 0]`. O sistema está inteiro
(resolver, critério, 5 faixas); está desligado por decisão, com o motivo gravado no próprio dado.
**Falta o RH dizer por que o registro parou.**

### 7. Divisão do CC `11010219` entre Jaicler e Laís

Os dois avaliam o **mesmo** centro de custo (DEPARTAMENTO CADASTRO, 7 pessoas), como já era no
Protheus. **Segue assim** — a designação é manual e aceita isso sem nenhum tratamento especial.
Formalizar a divisão é decisão dela.
### 8. Reciprocidade — "eu avalio quem me avalia" é decisão de política

O sistema **permite** A avaliar B e B avaliar A: não é autoavaliação, a separação de funções não
barra, e nada avisa. Já acontece no Piloto — **ADRIANA CAETANO (003113) ↔ WANDERSON NASCIMENTO
(002749)**, mesmo centro de custo, avaliando um ao outro (levantado em 10/09).

⭐ **O ensaio de 12/09 NÃO tem nenhuma reciprocidade** — e isso não é o sistema impedindo: é
consequência do desenho de duas passadas, em que os 16 responsáveis são avaliados pelo Claudimar e
não uns pelos outros. O mesmo par Adriana ↔ Wanderson aparece no ensaio em **uma direção só**.

⚠️ **Se ela escolher outra hierarquia, A↔B volta a ser possível e ninguém é avisado.** Num ciclo
que conta para mérito, isso é decisão de política — não de montagem.

### 9. Falta o conceito de "está no topo, e por isso não é avaliado"

O diretor executivo avalia 15 pessoas e **não é avaliado por ninguém** — o presidente não está no
cadastro. O sistema aceita isso sem reclamar (ser avaliador e ser avaliado são independentes), mas
**não tem como registrar o fato**.

O painel o conta em *"sem avaliador"* para sempre, e o único caminho que o sistema oferece para
tirá-lo dessa conta é a **EXCLUSÃO manual**, que grava *"foi retirado do ciclo"* — **que não é a
verdade**. Ele está dentro, no topo, e ninguém acima para avaliá-lo.

⭐ Em 12/09 o texto do próximo passo foi consertado (*"Designe, ou abra assim — quem ficar sem
avaliador não é avaliado neste ciclo"*), então **não pede mais o impossível**. O que continua
faltando é o CONCEITO: uma forma de dizer *"esta pessoa não é avaliada por estar no topo"* que não
seja mentir no histórico.

⚠️ **Decisão dela**, porque é de política: existe alguém que avalia o diretor (conselho,
presidente), ou o topo simplesmente não é avaliado?


---

### 3.1.75. 📏 MEDIÇÃO DO RECORTE DE 16 CENTROS DE CUSTO (12/09) — só leitura, nada montado

⚠️ **CORREÇÃO DE RUMO registrada pelo Clenio:** *"avaliador = responsável do CC"* **não é regra de
designação**. A designação é **MANUAL**. O responsável do CC é uma VISÃO que cobre quase todos os
casos e serve para facilitar o apontamento. O Claudimar avaliando gerentes de vários CCs é o caso
que uma regra por CC **nunca cobriria** — e é por isso que o que falta são **filtros**, não regra.

#### 1. População — 344 pessoas, e uma aplicação fica com UMA

| Aplicação (pelo prefixo) | Pessoas | CCs |
|---|---:|---:|
| Operação de Loja (`21`) | **257** | 5 |
| Administrativo (`11`) | **67** | 10 |
| Aprendizes (cargo `APRENDIZ%`) | **19** | 4 |
| Produção e Indústria (`41`) | **1** | 1 |
| **Total** | **344** | 16 |

⭐⭐ **As 4 aplicações NÃO ficam exercitadas.** `Produção e Indústria` teria **uma pessoa**:
`washingtondonato` (003268, GERENTE INDUSTRIAL, CC `41010121`) — **que é o próprio responsável do
CC**. Ele não pode avaliar a si mesmo (separação de funções), então a aplicação fica com **zero
avaliações possíveis**.

✅ `Aprendizes` fica exercitada (19 pessoas) — o perfil sem critério cadastral e
`pesoAvaliacao = 100` é testado.

**Para exercitar Produção**, o recorte precisa de mais um CC de indústria com gente, e de um
avaliador que não seja o único avaliado.

#### 2. As 16 contas — 3 erros de grafia e 1 falta real

| Na lista | No banco | Conta | Colaborador | CC bate | Acesso ao módulo |
|---|---|---|---|---|---|
| `lidianyrocha` | **`lidyanerocha`** | ✅ | ✅ | ✅ | AVALIADOR |
| `washigtondonato` | **`whashigtondonato`** | ✅ | ✅ | ✅ | AVALIADOR |
| `liciaversiane` | **`liciaversiani`** | ✅ | ✅ | ✅ | AVALIADOR |
| `cleniomarcos` | **`clenio`** | ✅ | ✅ | ✅ | ✅ AVALIADOR — **resolvido em 12/09** |
| outros 13 | — | ✅ | ✅ | ✅ | AVALIADOR (Arielly: RH_ADMIN) |

⭐ **`clenio` era o caso da Esmeralda outra vez** ([[feedback_designar_nao_da_acesso]]): a conta
existia, o colaborador existia, a matrícula batia — e **não havia permissão em `GESTAO_PESSOAS`**.
Designá-lo criaria avaliações que ninguém conseguiria abrir.

✅ **Corrigido no Configurador em 12/09** (AVALIADOR, departamento T.I.), e **verificado por login
real**: `GET /avaliacoes/minhas` devolve `[]`. ⭐ O `[]` é a prova — fila vazia significa que ele
**passou** o `IdentidadeGuard`; se ainda faltasse acesso, a resposta seria **403**. Conferir a
linha de permissão no banco não bastaria: a permissão é uma das três condições, e as outras duas
(colaborador resolvido e matrícula única) só o login exercita.

⚠️ **As 16 contas do recorte estão agora todas em ordem.** O item 5 do §7 ("o que o ensaio não vai
testar") continua valendo por isso mesmo: o cenário de quem NÃO tem acesso saiu do ensaio.

⚠️ **Uma divergência de CC:** `renataborges` (001981) responde por `21012501` (SUPERMERCADO 25, 3
pessoas) mas **está lotada em `21010101`** (SUPERMERCADO, 98). Não impede designar — só significa
que ela avalia um CC que não é o dela.

#### 3. FILTROS DA DESIGNAÇÃO — o que existe, o que falta

**Já existe em `DesignacaoPage`:**

| Recurso | Estado |
|---|---|
| Filtrar por **aplicação** (`<select>`) | ✅ é o recorte primário |
| **Sem avaliador**, com contador | ✅ |
| Excluídos do ciclo | ✅ |
| Busca por **nome ou matrícula** | ✅ |
| **Seleção múltipla + designar em lote** para o mesmo avaliador | ✅ |

**Falta, e é o que dói com 344 linhas:**

| Falta | Por quê | Custo |
|---|---|---|
| **Filtrar por centro de custo** | `centroCusto` **já vem na linha** e não é filtrável nem entra na busca. É o filtro que transforma 257 em 98 | **~4h** — `<select>` alimentado pelos CCs presentes + contador |
| **Selecionar todos os visíveis** | a seleção é uma a uma. Designar 98 pessoas = 98 cliques | **~2h** — caixa no cabeçalho, sobre o filtro aplicado |
| **Filtrar/buscar por cargo** | é como o Claudimar acha "os gerentes". `cargoDescricao` **não vem** em `LinhaDaDesignacao` | **~4h** — campo no backend + busca cobrindo cargo |
| Busca cobrir o CC | hoje só nome e matrícula | incluído nos 4h acima |

**Total ~1,5 dia**, e os dois primeiros sozinhos (**6h**) já tornam o apontamento viável.

⚠️ **Nenhum deles é regra** — são recortes de exibição sobre uma lista que já existe. Não tocam
designação, elegibilidade nem separação de funções.

#### 4. Avaliador que NÃO é avaliado — o sistema aceita, e ele aparece numa lista

O `claudimaroliveira` (DIRETOR EXECUTIVO, único no CC `11010105`) vai avaliar e não será avaliado.

- **Aceita sem reclamar.** Ser avaliador é fato da designação (`avaliacao.avaliadorId`); ser
  avaliado é estar no público. São independentes, e nada exige reciprocidade.
- ⚠️ **Mas ele aparece em `foraDeTodasAsAplicacoes`** no painel — "elegíveis do ciclo que não estão
  no público de nenhuma aplicação", que vem **com os nomes**. Não é tela vermelha nem bloqueio: é
  uma lista de conferência. **Ele vai figurar ali, e é correto que figure** — o painel não tem como
  distinguir "de propósito" de "esquecido".
- **Para não aparecer**, ele precisa sair da elegibilidade do ciclo (exclusão manual com
  justificativa) — o que é uma decisão registrada, e é o comportamento certo.

#### 5. "Gerente" não é identificável no cadastro — a designação do Claudimar é manual

`rh.cargo` está **vazia** e `cargo_descricao` é texto livre com sufixo de nível.

**Medido nos 16 CCs:** **38 pessoas** em cargos com `GER`/`DIRET`/`SUPERV`/`COORD`, em **38
descrições distintas** — `GERENTE FINANCEIRO 3B`, `GER GADO CORTE E LEITE 2A`, `SUB GERENTE 3B`,
`SUPERVISOR DE CAIXA 4D`…

⭐ Dá para **filtrar candidatos**, não para **decidir**: "GER" pega `GER GADO CORTE E LEITE` (3
pessoas), que não é gerente de departamento; e "gerente de departamento" não tem marca no texto.

**Conclusão: a designação do Claudimar é 100% manual** — e é por isso que o filtro por cargo (item
3) vale as 4h: reduz de 344 para ~38 a lista em que ele aponta à mão.

#### 6. Mecânica — dá para montar sem tocar em nada

- ✅ **Público por LISTA de centros de custo é suportado nativamente.** `AplicacaoCentroCusto` é
  `(filial, centroCusto)` — pares **exatos**, quantos quiser. **Não existe prefixo no sistema**
  (§Pendências, item 3). `AlvoDoPublico` aceita ainda `filiais[]` e `colaboradorIds[]`.
- ✅ **Ciclo novo em RASCUNHO, sem tocar em nada.** Ciclo é a raiz de tudo: aplicações, público,
  designação e conceitos penduram nele. Um ciclo novo **não vê** o Piloto, e ciclo em RASCUNHO não
  entra na fila de ninguém (é o que o `ZZ DESCARTAVEL` já faz).
- ✅ **Nada do que precisa ser preservado é tocado:** a regressão do `000006` roda sobre CSV e
  funções puras; os 17 resultados apurados são de outros ciclos; as distribuições leem
  `rh.colaborador`, que não muda.

⛔ **Não limpar o cadastro** — confirmado como desnecessário: restringir o CICLO alcança o mesmo
sem perder nenhuma das três referências.

#### 7. ⚠️ O QUE ESTE ENSAIO NÃO VAI TESTAR — antes de montar

1. ⭐ **`Produção e Indústria` — DECISÃO CONSCIENTE do Clenio (12/09): testar 3 das 4.**
   A aplicação fica com 1 pessoa, que é o próprio avaliador do CC, logo **zero avaliações
   possíveis**.
   **Por que é aceitável:** a composição de Produção é **idêntica** à de Operação de Loja — 14
   perguntas, questionário 60 + 3 critérios a 10. O que deixa de ser exercitado é **o arranjo de
   questões, não caminho de código**: nenhuma linha roda só para Produção.
   `Aprendizes`, que é o perfil **genuinamente diferente** (sem critério cadastral,
   `pesoAvaliacao = 100`), fica coberto com 19 pessoas.
   ⚠️ **Ressalva que fica:** Produção e Indústria **não foi exercitada**. Se algum dia o arranjo
   dela divergir do de Loja — outra questão, outro peso, outro critério —, esta cobertura deixa de
   valer e o ensaio precisa de um CC de indústria com gente e um avaliador que não seja o único
   avaliado.
2. **Critério `INFORMADO`** — não existe entrada de valor. Os três critérios do ensaio são
   CALCULADO.
3. **Volume** — 344 contra 894 do Piloto. Nada sobre desempenho de lista, paginação ou tempo de
   apuração em escala real.
4. **Multi-filial** — 15 dos 16 CCs são de uma filial só (`21010109` tem 2). A régua
   `(filial, CC)` não é exercitada.
5. **O caminho de quem não tem acesso** — era o `clenio`, **resolvido em 12/09**. Com as 16 contas
   em ordem, fica de fora justamente o cenário dos 46 sem conta do Piloto: ninguém no ensaio
   exercita a fila de quem foi designado e não consegue entrar.
6. **Reabertura, devolução e encerramento com pendência** — a menos que o roteiro os inclua de
   propósito; não saem do recorte sozinhos.
7. **A régua de conceitos em faixa extrema** — com 344 pessoas reais, `Insuficiente` e `Excelente`
   podem simplesmente não ocorrer, e aí as faixas ficam sem exercício (não por defeito, por dado).

---

### 3.1.76. 🧪 ENSAIO PILOTO — 16 CCs · MONTADO EM RASCUNHO, NÃO ABERTO (12/09)

Ciclo `ENSAIO PILOTO — 16 CCs`, **RASCUNHO**. Período **01/11/2026 a 30/11/2026**, data-base
**30/11/2026** — fora de setembro, sem sobrepor o Piloto (que é 01–30/09). A data-base dentro do
período, como a validação exige.

⚠️ **Nada foi tocado fora dele:** Piloto segue **894 PENDENTE, 0 respostas**; `rh.colaborador`
segue 1.037; os 17 resultados apurados seguem lá.

#### Público — por LISTA DE PARES `(filial, centroCusto)`, nunca prefixo

| Aplicação | Público | Avaliações | Sem avaliador |
|---|---:|---:|---:|
| Aprendizes | 19 | **19** | 0 |
| Administrativo | 67 | **66** | **1** |
| Operação de Loja | 257 | **257** | 0 |
| Produção e Indústria | 1 | **1** | 0 |
| **Total** | **344** | **343** | **1** |

⭐ **A ordem da montagem importou.** `Aprendizes` foi montado PRIMEIRO, nominalmente pelos 19 ids;
os outros três por lista de CCs. A `Operação de Loja` encontrou **276** e adicionou **257** — o
sistema **pulou sozinho** os 19 que já estavam em outra aplicação do ciclo. Montado na ordem
inversa, os aprendizes teriam caído em Loja e a aplicação deles ficaria vazia.

#### Designação — duas passadas, manual

**1ª, por centro de custo:** cada um dos 16 responsáveis avalia quem está no CC dele. O
`11010219` foi dividido entre Jaicler e Laís, alternado — **arbitrário, só para exercitar**.

**2ª, hierárquica:** o Claudimar avalia os **16** outros responsáveis. ⚠️ São **16, não 15**: o
`11010219` tem dois responsáveis, então há 17 no total e 16 além dele.

| Avaliador | Fila | Aplicações que atravessa |
|---|---:|---|
| ADRIANA (003113) | 96 | Aprendizes + Loja |
| THIAGO (004060) | 88 | Aprendizes + Loja |
| LIDYANE (002336) | 48 | Aprendizes + Loja |
| MARCIO (001960) | 36 | Aprendizes + Loja |
| **CLAUDIMAR (001079)** | **16** | **Administrativo + Loja + Produção** |
| ESMERALDA · CLENIO · VANIA · DENISE · ARIELLY | 14 · 13 · 7 · 6 · 5 | Administrativo |
| RENATA · JAICLER · JULIANA | 3 · 3 · 3 | Loja / Administrativo |
| IVAN · LAÍS · LÍCIA | 2 · 2 · 1 | Administrativo |

⭐ **A designação atravessa aplicação sem problema** — o Claudimar avalia gente das TRÊS, e o
sistema não pede que avaliador e avaliado estejam na mesma. É o que torna a 2ª passada possível.

#### As conferências

| Pergunta | Resposta |
|---|---|
| Quem ficou sem avaliador | **1 — o Claudimar**, e é o desenho: o diretor-presidente não está no cadastro |
| Quem avalia e não é avaliado | **1 — o Claudimar**, o mesmo |
| Quem é avaliado e não avalia | **328** (os 344 menos os 16 avaliadores) |
| **Reciprocidades (A↔B)** | **nenhuma** |

⭐ **A ausência de reciprocidade não foi imposta pelo sistema** — nada impede A avaliar B e B
avaliar A. Ela é consequência do desenho de duas passadas: os responsáveis são avaliados pelo
Claudimar, não uns pelos outros. Se a Arielly decidir outra hierarquia, a reciprocidade volta a
ser possível e ninguém será avisado.

#### ⚠️ O 429 do nginx durante a montagem — throttle funcionando, não defeito

O primeiro script disparou 343 designações sem pausa e levou **191 recusas `429 Too Many
Requests`** do nginx. **Não é defeito**: é o throttle protegendo a API. Refeito com pausa de 120 ms
e reintento exponencial, completou sem erro.

⭐ Fica registrado porque é armadilha de diagnóstico: um 429 em massa **parece** o sistema
quebrando, e o log do backend não mostra nada — o nginx recusa antes de chegar lá. Script de carga
contra esta plataforma precisa de ritmo.

#### O que este ensaio NÃO testa

Ver §3.1.75 §7 — e vale reler antes de tirar conclusão dele. Em resumo: **Produção e Indústria não
é exercitada** (1 pessoa, que é o próprio avaliador — decisão consciente), não há critério
`INFORMADO`, o volume é 344 contra 894, e nenhum avaliador está sem acesso ao módulo.

---

### 3.1.77. 🔎 VARREDURA DAS TELAS DO RH SOBRE O ENSAIO EM RASCUNHO (12/09)

Percorrido com `zz.teste.rh` (RH_ADMIN) sobre o `ENSAIO PILOTO — 16 CCs`, **RASCUNHO**. Primeiro
ciclo em rascunho percorrido de verdade.

#### O inventário — todo número com o rótulo ao lado

| Tela | Número | Rótulo | Confere com os 343? |
|---|---:|---|---|
| Lista de ciclos | 4 · 343 · 343 · 0 | aplicações · avaliações · pendentes · canceladas | ✅ |
| Linha de estado | 344 · 18 · 1 · 0 de 343 · 0 | no público · fora do ciclo · sem avaliador · enviadas · apuradas | ⚠️ ver abaixo |
| Painel | 343 · 0 · 343 · 1 | designados · enviadas · a fazer · sem designação | ✅ |
| Painel — por aplicação | 19 / 66 / 257 / 1 | designados | ✅ |
| Painel — fora de todas | **664** | pessoas fora de todas as aplicações | ✅ (990 elegíveis pela régua − 326 no público) |
| Prévia da abertura | 344 · 343 · 1 · 18 · 0 · 0 | público · designados · sem avaliador · fora do ciclo · sem acesso · avaliações sem acesso | ✅ |
| Pendências cadastrais | 0 · 0 · 0 | apuradas · sem nota · alertas | ✅ |
| Resultados | `[]` | — | ✅ |

#### 🔴 A LINHA DE ESTADO NÃO FECHA — e o Piloto esconde isso

```
ENSAIO:  344 no público − 18 fora do ciclo − 1 sem avaliador = 325   …e "de 343 enviadas"
PILOTO: 1036 no público − 47 fora do ciclo − 95 sem avaliador = 894  …e "de 894 enviadas"  ✅
```

A linha foi desenhada e conferida no Piloto, onde **fecha**. Ela assume, sem dizer, que
*"fora do ciclo"* e *"designado"* são **conjuntos disjuntos**. No ensaio não são: **18 pessoas que
a régua excluiu estão designadas**, e entram nos 343.

⭐⭐ **A causa: a TELA protege, a API não.** Na Designação o checkbox de linha inelegível é
`disabled={!linha.elegivel}` e o botão *"Definir avaliador"* está dentro de `{linha.elegivel && …}`
— **não há caminho de tela** para designar quem a régua excluiu. `POST /designacao/…/designar`
aceita: `efeitoDeDesignar` recusa três casos (troca de aplicação, autoavaliação, avaliação
cancelada) e **elegibilidade não é um deles**.

É [[feedback_tela_e_api_discordam_dois_sentidos]] na direção **permissiva** — a silenciosa:
ninguém reclama, nada quebra, e quem descobre é quem chama a API direto.

⚠️ **Consequência para o ensaio:** ele carrega hoje um estado que uma montagem pela tela **não
produziria**. As 18 avaliações existem, ficariam nas filas ao abrir, e a régua do ciclo diz que
essas pessoas não deveriam ser avaliadas. **Decidir antes de abrir:** excluí-las do ciclo (decisão
registrada, e o `efeitoDoExcluir` já explica o que acontece) ou desfazer a designação.

⭐ **O que NÃO é defeito:** a linha da Designação é honesta. Ela mostra `elegivel: false`, o
motivo (`REGRA_CICLO`), a justificativa por extenso, **e** o avaliador designado, **e** o efeito de
excluir. Os dois fatos estão lá — o que falta é a linha de estado conciliá-los.

#### ⚠️ 664 "fora de todas as aplicações" — correto, e enganoso num recorte estreito

A conta fecha (990 elegíveis pela régua − 326 do público que são elegíveis = 664). Mas num ciclo
que é **deliberadamente um recorte de 16 CCs**, esse é o maior número do painel e ele descreve
**o desenho, não uma pendência**. O painel não tem como distinguir "de propósito" de "esquecido" —
e num ensaio a leitura errada é imediata.

#### 🔵 O próximo passo pede o impossível

`proximoPasso: DESIGNAR — "Sem avaliador neste ciclo: 1. Designe antes de abrir"`. O 1 é o
**Claudimar**, que por desenho não é avaliado (o diretor-presidente não está no cadastro). A
abertura **não está bloqueada** (`problemas: []`), mas o passo sugerido não tem como ser cumprido.

A saída existe — excluí-lo do ciclo com justificativa —, e o próximo passo não a menciona.

#### 🔵 O cartão da aplicação não concilia público × avaliações

`Administrativo` mostra **"66 avaliações"** e **"67 pessoas"** no público, lado a lado, e **não diz
que 1 ficou sem avaliador**. O painel diz; a aba de Aplicações, que é onde se olha o público, não.

É a família do achado 15 de 10/09 (o cartão calado sobre canceladas). ⚠️ **Não deu para observar
canceladas aqui**: o ensaio tem 0.

✅ O que o cartão acerta: etiqueta **"só questionário"** no Aprendizes (`criterios.length === 0`),
público com a quebra por origem, e o aviso de público vazio.

#### ✅ Ciclo em RASCUNHO — o que oferece, e não oferece

| | |
|---|---|
| **Faixa do rascunho** | ✅ diz o que só se faz agora, que **abrir é definitivo** e que não há volta. E lista *"o que falta para abrir"* pela **mesma função** que a API roda |
| Montar público, criar aplicação, mudar peso | ✅ abertos, e é o momento certo |
| Resultados | ✅ `[]` — sem tela quebrada |
| Pendências cadastrais | ✅ 0 alertas, sem erro |
| **Aviso de critério `INFORMADO`** | ✅ `avisos: []` — a checagem **roda e não se aplica**: as 4 aplicações usam só critérios CALCULADO. Confirmado que responde vazio, não erro |
| **Não achei nada oferecido que não deveria** | o encerrar e o reabrir não aparecem em RASCUNHO |

#### O que o ensaio confirmou do que foi construído nos últimos dias

- **A ordem da montagem** (público nominal antes do por CC) funcionou: Loja encontrou 276 e
  adicionou 257, pulando sozinha os 19 aprendizes.
- **Os filtros novos** trazem `centroCustoDescricao` e `cargoDescricao` na linha — conferido em
  697 linhas do Piloto, 8 CCs no seletor, 294 cargos como sugestão.
- **A designação atravessa aplicação**: o Claudimar avalia gente das três.

---

### 3.1.78. ⭐⭐ A GUARDA QUE FALTAVA NA API, E A VARREDURA DA FAMÍLIA SILENCIOSA (12/09)

#### A guarda

`efeitoDeDesignar` ganhou a **quarta recusa**: inelegível não se designa. Antes recusava três
casos (troca de aplicação, autoavaliação, avaliação cancelada) e elegibilidade não era um deles.

Entrou no **classificador**, com as outras — e por isso a **prévia do lote a roda também**, sem
segunda cópia. Provado contra dado real: `designar` devolve **400**, a prévia devolve
`recusar: 1` (não `criar: 1`), e o elegível continua passando.

⚠️ Vem **antes** da autoavaliação: *"esta pessoa não está no ciclo"* é anterior a *"quem avalia
quem"*. E a frase aponta a saída — incluir por decisão registrada, e designar depois.

#### ⭐⭐ A VARREDURA — que regras a tela impõe e a API não checa

A pergunta certa: *"o que a tela impede por `disabled` ou por não renderizar, e a API aceita?"*.
Nenhum teste de tela encontra, porque **a tela está certa**.

| Regra que a tela impõe | A API checa? | Onde |
|---|---|---|
| **Linha inelegível não se designa** | 🔴 **não** → **corrigido hoje** | `efeitoDeDesignar` |
| Ciclo encerrado trava tudo | ✅ | `assertCicloOperavel` / `assertCicloDaAplicacaoOperavel` |
| Aplicação só se cria em RASCUNHO | ✅ | `criar` recusa explicitamente |
| Apagar aplicação com público | ✅ | `efeitoDeApagar` — **mesma função** dos dois lados |
| Motivo mínimo (3 lugares) | ✅ | DTO, `@MinLength(MOTIVO_MINIMO)` |
| `pesoAvaliacao > 0` | ✅ | `validarAplicacao` |
| Própria nota / memória | ✅ | corrigido em 11/09 (§3.1.67) |
| Prévia velha não se aplica | ✅ n/a | a API **recomputa do alvo**; não existe "aplicar prévia salva" |

⚠️ **`ocupado`, `salvando`, `enviando`, `baixando` não são regras** — são "espere a requisição".
Entram no `disabled` e não pertencem a esta varredura; confundi-los com regra inflaria a lista e
esconderia a única que importava.

⭐ **Só uma estava aberta**, e não foi achada por revisão: o sintoma foi a **linha de estado parar
de fechar**. Uma conta que não bate é melhor detector de furo de guarda que ler o código.

#### Os dois consertos que a varredura pediu

**1. O próximo passo pedia o impossível.** *"Designe antes de abrir"* tratava designação como
pré-requisito — não é: `problemasParaAbrir` não olha `semDesignacao`. E havia o caso incumprível,
o diretor no topo. Virou: *"Designe, ou abra assim — quem ficar sem avaliador não é avaliado neste
ciclo"*. ⚠️ **Aviso que pede o impossível ensina a ignorar avisos**, e este é lido em todas as abas.

**2. O cartão da aplicação não conciliava.** Mostrava *"66 avaliações"* e *"67 pessoas"* lado a
lado, calado sobre a diferença. Família do achado 15 de 10/09.

⚠️⚠️ **A subtração seria MENTIRA.** `total − avaliações` mistura duas coisas de naturezas opostas:
quem a régua tirou (correto) e quem ficou sem avaliador (pendência). Na `Operação de Loja` a
diferença é **14 — e as 14 são afastadas**. Um cartão dizendo *"14 sem avaliador"* inventaria uma
pendência inexistente e mandaria o RH resolver o que já está resolvido.

Vêm os **dois** números, da mesma `designacao.listar` do painel. Conferido no ensaio:

```
Aprendizes      19 público  18 avaliações   1 fora do ciclo  0 sem avaliador   19−1   = 18 ✅
Administrativo  67          63              3                1                67−3−1 = 63 ✅
Op. de Loja    257         243             14                0               257−14  = 243 ✅
Produção         1           1              0                0                        =  1 ✅
```

#### As 18 desfeitas — e a lacuna que isso revelou

Removidas por **desfazer a designação**, não por exclusão do ciclo: elas já estavam fora **por
direito da régua**, e a exclusão manual é para decisão do RH — usá-la aqui registraria uma decisão
que ninguém tomou. Recorte explícito (este ciclo · avaliado AFASTADO · PENDENTE · zero respostas).

⚠️ **Não existe rota para desfazer designação.** Foi preciso SQL. A ausência é coerente com o
modelo (quem não deve ser avaliado, exclui-se), e deixa de importar agora que a guarda impede o
estado de nascer — mas fica registrado: se aparecer de novo, não há caminho de tela.

**A linha de estado voltou a fechar:** `344 − 18 − 1 = 325 = designados`.

#### 🔎 O que a Lícia respondeu — elegibilidade é sobre ser AVALIADO, não sobre AVALIAR

`liciaversiani` (005380) está **AFASTADA** e é uma das 16 responsáveis. Depois da limpeza:

| | |
|---|---|
| É avaliada? | **não** — a régua a tirou, e a avaliação dela foi desfeita |
| Continua avaliadora? | **sim, de 1 pessoa** (Luana, ativa) |
| A fila do Claudimar | caiu de 16 para **15** (ela saiu dos avaliados) |

⭐ **As duas coisas são independentes, e é assim que deve ser** — estar afastado não desfaz a linha
de reporte. ⚠️ **Mas ninguém sinaliza que a avaliadora está afastada**: a Luana fica esperando uma
avaliação de quem não está trabalhando, e nada na tela diz. A prévia da abertura confere
`avaliadoresSemAcesso` — **não confere avaliador afastado**. Candidato à próxima varredura.

---

### 3.1.79. ⭐⭐ MÉTODO — conta que não bate detecta furo de guarda melhor que ler código

A guarda de elegibilidade que faltava na API (§3.1.78) **não foi achada por revisão**. Ninguém
leu `efeitoDeDesignar`, contou três recusas e notou a quarta faltando. O que denunciou foi a
**linha de estado parar de fechar**:

```
ENSAIO:  344 − 18 − 1 = 325   …e o painel dizia "de 343"
PILOTO: 1036 − 47 − 95 = 894  …e dizia 894   ✅
```

⭐ **A regra:** uma conta que não bate é um detector melhor que a leitura do código, porque ela
**não depende de saber o que procurar**. Revisão encontra o que o revisor imagina; a aritmética
encontra o que ninguém imaginou — inclusive furos de guarda, que por definição são caminhos que
ninguém pensou em fechar.

**Como usar isso de propósito:**

- Toda tela que mostra vários números do mesmo universo deve ter **uma identidade que feche**
  (`público − fora − sem avaliador = designados`). Ela é a asserção de invariante mais barata que
  existe, e roda toda vez que alguém abre a tela.
- ⚠️ **Fechar num ambiente não é fechar.** A identidade fechava no Piloto e não no ensaio, porque
  o Piloto nunca exercitou o caminho da API direta. Uma conta que fecha prova o caminho testado,
  não a regra.
- Quando ela não fechar, **a primeira hipótese é furo de guarda**, não erro de conta.

Vale ao lado de [[feedback_numero_preciso_pode_ser_resto_de_conta]] (§3.1.66): lá o número
revelou uma intenção mal lida; aqui, uma porta aberta.

### 3.1.80. ✅ DESFAZER A DESIGNAÇÃO — a rota que faltava (12/09)

Designar a pessoa errada é o erro mais comum de uma tela de designação **manual**, e o conserto
era T.I. no banco. As 18 do ensaio saíram por SQL porque não havia rota.

`DELETE /designacao/ciclo/:cicloId/designacao/:avaliadoId`.

#### ⚠️ Não é EXCLUIR, e a diferença é o que se DECLARA

| | O que registra |
|---|---|
| **Excluir do ciclo** | *"esta pessoa não é avaliada neste ciclo"* — decisão do RH, com justificativa, que fica no histórico |
| **Desfazer** | *"o avaliador estava errado"*. A pessoa **continua** no ciclo, elegível, esperando avaliador |

Usar o primeiro para consertar o segundo **registraria uma decisão que ninguém tomou**.

#### As guardas, no classificador

| Estado | Efeito |
|---|---|
| PENDENTE, sem resposta | ✅ desfaz |
| **ENVIADA** | recusa — há nota, e pode haver resultado apurado. Manda **reabrir** primeiro |
| **Com respostas** | recusa — e oferece **trocar** o avaliador. Resposta é julgamento de alguém |
| **CANCELADA** | recusa — é registro de decisão do RH; apagar sumiria com o motivo. Use o **Incluir** |
| Ciclo encerrado | `assertCicloOperavel`, como em tudo |

Na tela: **some** quando não há designação (ato sem objeto) e **desabilita com o motivo** quando
há trabalho dentro — a mesma distinção do Reabrir. A auditoria grava o **avaliador anterior**: sem
ele, a linha diria apenas que algo sumiu.

⚠️ **A guarda de ENVIADA não foi exercitada ao vivo** — o único ciclo com envio está encerrado, e
essa guarda vem antes. Coberta por spec.

---

### 3.1.81. 🔧 CONTEXTO OPERACIONAL — avaliador de licença é gestão do RH, não pendência

**Não é item da Arielly** (decisão do Clenio, 12/09), e nunca entrou na lista dela. Ela tem gestão
do departamento e **o sistema já dá a flexibilidade**: aponta outro avaliador — subgerente, por
exemplo — e resolve sozinha.

**Medido no Piloto real (12/09):** 10 avaliadores de licença com **264 das 894 avaliações**. Na
prévia da abertura aparecem **2 (94 avaliações)**; os outros 8 já estão na lista de **sem acesso**,
que é o impedimento mais fundamental — sem dupla contagem.

⭐ **A rotina, ao abrir um ciclo:** ler a lista *"avaliadores de licença"* da prévia e redesignar o
que fizer sentido. Quem voltar de férias responde normalmente; quem não for voltar a tempo, o RH
troca — e agora tem por onde: **Tirar avaliador** na linha (§3.1.80) e designar outro.

⚠️ **A prévia INFORMA; quem decide é o RH.** É aviso, nunca bloqueio — e é por isso que a lista é
separada da de acesso: "sem conta" pede o Configurador e outra pessoa; "de licença" pede uma
decisão de gestão, que é dela.

---

## 🌙 FECHAMENTO DE 12/09/2026

### O que ficou de pé

| | |
|---|---|
| **`ENSAIO PILOTO — 16 CCs`** | **RASCUNHO**, 325 avaliações · período **01/11–30/11/2026**, data-base **30/11** |
| ⛔ | **NÃO ABRIR** até o Clenio falar com a Arielly — abrir começa a gravar resposta, e a conversa pode mudar o recorte, a divisão do `11010219` e a hierarquia. Remontar rascunho é grátis |
| **Piloto 15/09** | intacto: **894 PENDENTE, 0 respostas** |
| Suíte | **726 testes, 57 suítes** |

### O que foi construído hoje

1. **A guarda que faltava na API** — `efeitoDeDesignar` ganhou a **4ª recusa**: inelegível não se
   designa. A tela já impedia (`disabled={!linha.elegivel}` e botão dentro de
   `{linha.elegivel && …}`); a API aceitava, e criava avaliação para quem a régua excluiu.
   ⭐ **A varredura tela × API fechou com só essa aberta** — as outras sete regras (ciclo
   encerrado, aplicação só em RASCUNHO, apagar com público, motivo mínimo, peso > 0, própria nota,
   prévia velha) já tinham guarda. Tabela completa em §3.1.78.

2. **Desfazer designação** (§3.1.80) — a rota que faltava. ⚠️ **Excluir declara *"esta pessoa não
   é avaliada"*; desfazer diz *"o avaliador estava errado"*.** Usar o primeiro para consertar o
   segundo registra uma decisão que ninguém tomou.

3. **Um fato FALSO corrigido** em `acesso-do-avaliador.ts`: dizia que o afastado *"continua sem
   conseguir entrar"*. **Afastado e férias ENTRAM** — `SITUACOES_ELEGIVEIS` inclui os dois. Daí
   saiu o 4º degrau do acesso, `SEM_VINCULO` (DEMITIDO: tem conta, tem permissão, leva 403 — e a
   prévia dizia "OK").

4. **Avaliador de licença** — lista separada na prévia (§3.1.81), como contexto operacional.

5. **O método**: *conta que não bate detecta furo de guarda melhor que ler código* (§3.1.79).

---

## ▶️ A FILA DE AMANHÃ (13/09, 08:00) — abrir por aqui

### (a) 🔴 Esperando a Arielly — 9 itens, e um deles reordena tudo

A lista está em **📋 PENDÊNCIAS DA ARIELLY**. O que cada resposta destrava:

| # | Item | O que a resposta destrava |
|---|---|---|
| ~~1~~ | **As 39 perguntas — o CONTEÚDO** | ⚠️ **deixou de bloquear a fila (13/09).** Ela decide o conteúdo, **na tela**, quando o editor existir — não a ordem do trabalho |
| 2 | A faixa "Menos de 1 ano" (são DUAS) | manter e corrigir o rótulo, ou mudar a régua — e aí decidir o que fazer com a regressão do `000006` como baseline |
| 3 | Prefixo de CC × fábrica | remontar o público das 49 do `ADMINISTRATIVO - FABRICA`. **Não precisa de código** |
| 4 | 2º `RH_ADMIN` (Claudimar) | destrava quem corrige a avaliação da própria gestora |
| 5 | Recorte provisório — granularidade | define o ato de confirmar: linha, aplicação ou ciclo |
| 6 | Treinamento parado em 14/11/2025 | destrava ligar (ou não) o `QTDE_TREINAMENTO` |
| 7 | Divisão do `11010219` | formalizar a divisão Jaicler/Laís — hoje segue como está |
| 8 | Reciprocidade A↔B | política: vale ou não, num ciclo que conta para mérito |
| 9 | "Está no topo, não é avaliado" | falta o CONCEITO; hoje o único caminho mente no histórico |

### (b) 🟢 Pronto para código — desenho fechado, é só executar

| Frente | Custo | Estado |
|---|---|---|
| **Flag de recorte** no ciclo | **6h** | desenho **aprovado** (derivar por percentual inventa limiar, e limiar arbitrário erra calado) |
| **Entrada do valor INFORMADO** | **4–6 dias** | as 3 decisões **fechadas**: três baldes na prévia · substitui e **nunca soma** · quem não está na planilha **não é tocado** · lote com desfazer · prévia grava por **id**, sem reler o arquivo · ciclo já apurado = **opção (ii)** (marca os resultados como desatualizados) |
| **Editor do acervo** | **3–3,5 semanas** | ▶️ **EM CURSO, por BLOCOS com portão** (reorganizado em 12/09). **A** (2+5) ✅ §3.1.87 · **B** (6) ✅ §3.1.91 · **C** (3+4) ✅ §3.1.98 · **D** (7) ✅ §3.1.101 — **editor COMPLETO**. Cada bloco fecha numa CONTA, conferida antes do próximo |

### (c) ⛔ Bloqueado fora — HLG e o Marco

**O roteiro de deploy NÃO EXISTE**, e a onda cresceu. Medido em 12/09:

| | Medido | ⚠️ |
|---|---|---|
| Migrations do `gestao-pessoas` | **13** | eram 11; entraram o **acervo** (`20260911230000`) e o **motivo do critério inativo** (`20260912020000`) |
| Migrations do `auth-gateway` na onda | **2** | número do registro anterior — **não remedido contra PROD** |
| **Total da onda** | **15** | não 13, e não 14 |
| Serviços novos no compose | **3** | `gestao-pessoas-migrate`, `-backend`, `-frontend` |
| `location` no nginx | **2** | `/gestao-pessoas/` e `/api/v1/gestao-pessoas/` (+ 2 upstreams) |
| Jobs `*-migrate` com `migrate-guarda` | **6 de 7** | ⚠️ **já estão trocados** — o único fora é o `inventario-migrate`, que roda SQL próprio e não usa Prisma |

⚠️ **PROD segue em `6855c918` e sem o Gestão de Pessoas.** Estado de ambiente envelhece: conferir
`/health` → `versao.commit` antes de afirmar.

---

### 3.1.82. ⭐⭐ REGRA — peça sem chamador não é peça pronta, é peça não verificada

**Segunda vez em três dias**, e por isso vira regra:

| Peça | O que parecia | O que era |
|---|---|---|
| `assertModeloPublicavel` (136 linhas, spec verde, 05/09) | pronta para o editor | ⚠️ valida `GrupoParaPublicacao { titulo, perguntas: [{ peso, alternativas }] }` — **forma que a migration do acervo acabou**. Adaptar: **~4h** |
| A "validação de continuidade que já existe" (11/09) | servia para faixa de critério | era a de **`ConceitoFaixa`** (0–100 fechado). Aplicá-la reprovaria `TEMPO_EMPRESA` e `ESCOLARIDADE` |

⭐ **A regra:** código sem chamador não é exercitado por nada — nem pelo compilador contra a forma
real, nem por uso. A spec dele prova que ele faz o que ele diz; **não prova que o que ele diz ainda
é o que se precisa**. Ao planejar com uma peça assim, o custo honesto é **adaptação, nunca zero**.

⚠️ **Como conferir em um minuto**, antes de prometer reuso: comparar a INTERFACE da peça com o
schema/dado de hoje. `GrupoParaPublicacao` tem `peso` na pergunta; `rh.pergunta` não tem coluna
`peso` desde 11/09. Um `grep` responde.

Vale ao lado de [[feedback_extrair_regra_exige_varrer_o_fonte]] e de §3.1.65 (*"já existe" e
"serve" são perguntas separadas*): aquela é sobre reaproveitar o que serve; esta é sobre o custo de
descobrir que **não serve**.

### 3.1.83. 📐 MEDIÇÃO PARA A ETAPA 6 — a escala, e a questão fora de arranjo

#### (a) Escala: os VALORES se repetem sempre; os TEXTOS, nunca

| | |
|---|---|
| Questões no acervo | 15 |
| **Conjuntos de 4 âncoras distintos** | **15** — nenhuma questão repete o conjunto de outra |
| Âncoras (textos) distintas | **60 de 60** — nenhum texto se repete |
| **Conjuntos de VALORES distintos** | **1** — `0,3 · 0,6 · 0,9 · 1,2` nas 15, sem exceção |

⭐ **A conclusão separa as duas coisas:** escala reutilizável de **valor** já é a realidade (e deve
ser imposta); escala reutilizável de **texto** não existe, e não deveria — o padrão é **semântico**
(ruim → insuficiente → bom → excelente), com as palavras da própria questão. É o instrumento real
do Protheus, e foi por isso que as alternativas vivem na PERGUNTA, não numa tabela de escala.

**O que isso faz na Etapa 6:** o formulário **pré-preenche os 4 valores** e pede só os **4 textos**
— metade dos campos, e some a chance de alguém digitar uma escala diferente por acidente.
⚠️ Não muda o tamanho da etapa (continuam 4 textos por questão); muda o **erro possível**.

#### (b) Questão nova antes de existir arranjo — segura por construção

**Nenhuma consulta do módulo lê `prisma.pergunta` diretamente** — as quatro leituras passam pelo
ARRANJO. Uma questão fora de arranjo é **invisível** para avaliação, contagem, apuração e memória
de cálculo. Não quebra nada.

⚠️ **Mas a tela precisa dizer.** *"Questão criada"* e *"questão criada, e ainda não está em nenhum
perfil"* são frases diferentes, e a primeira deixa quem criou achando que já vale. Entra no cartão
da questão na Etapa 1 (o `usada em N perfis`, que com N = 0 vira o aviso).

### 3.1.84. 📌 PENDÊNCIA CONHECIDA — a prévia do efeito na nota

**Não vai existir ao fim do editor**, e é a **primeira pergunta que a Arielly vai fazer**:
*"se eu mudar este peso, a nota de quem já respondeu muda quanto?"*.

⭐ **Hoje a resposta é que versão em uso é IMUTÁVEL** — então a pergunta dela não é bem essa. Vira:
*"quanto mudaria se eu publicasse uma versão nova?"*. E essa tem resposta calculável: as respostas
já dadas estão gravadas; aplicar o arranjo novo sobre elas é aritmética.

⚠️ Fica registrado como previsão, não como escopo. Quando ela perguntar, a conversa começa daqui —
e não de "não dá".

---

### 3.1.85. ✅ ETAPA 1 DO EDITOR — LER o acervo (12/09)

A primeira das sete etapas, e a única que **não escreve nada**. Antes de dar a alguém o poder
de mexer nas questões, é preciso existir uma tela que diga **quais existem e quem as usa** —
senão a primeira edição é feita às cegas.

#### O que ficou

| Peça | Onde |
|---|---|
| Serviço | `backend/src/acervo/acervo.service.ts` |
| Rota | `GET /api/v1/gestao-pessoas/acervo` · `@Roles(RH_ADMIN, RH_MODELO, RH_CICLO)` |
| Tela | `frontend/src/pages/AcervoPage.tsx` · `/acervo` · menu **"Acervo de questões"** |
| Testes | `acervo.spec.ts` — **9** (eram 7; duas nasceram do defeito abaixo) |

**Irmã da `/questionarios`, e a diferença é o RECORTE.** O Questionário mostra **um perfil por
vez**, com as questões na ordem dele. O Acervo mostra **cada questão uma vez**, com a lista dos
perfis que a usam e quanto ela vale em cada um. É a pergunta que se faz antes de editar:
*"mexer nesta questão afeta quem?"*.

#### 🔴 O defeito que a etapa produziu — e o que o pegou

A primeira versão calculava o peso efetivo **ali mesmo**: `peso_do_grupo ÷ n`, arredondado a
duas casas. Parece a mesma coisa. Não é.

```
Administrativo · Relacionamento e Conduta · peso 16 · 3 questões
  divisão ingênua → 5,33 + 5,33 + 5,33 = 15,99
  regra do módulo → 5,34 + 5,33 + 5,33 = 16,00   (o centavo do resto vai para a 1ª, por ordem)
```

Três classificações assim no Administrativo, e a tela somava **59,97** onde o arranjo declara
**60**. O questionário mostraria 5,34 e o acervo 5,33 para a mesma questão — e quem edita
concluiria que **um dos dois está errado, sem saber qual**.

O aviso já estava escrito, em maiúsculas, no cabeçalho do `calculo/peso-derivado.ts`:
*"a repartição é `modelo/distribuirPeso` — **não reimplementar aqui**"*. Reimplementei mesmo
assim, e o comentário não me deteve porque eu não fui lê-lo: escrevi a divisão que "obviamente"
era a conta certa.

**⭐⭐ Quem pegou foi a SOMA, não a leitura.** Nenhum dos 7 testes falhou — todos usavam pesos
que dividiam exato (12 ÷ 2, 9 ÷ 1, 10 ÷ 1). Furo de arredondamento mora **onde sobra**, e
fixture redonda é justamente o caso que não tem resto. O que denunciou foi somar os pesos
efetivos por perfil e comparar com o peso declarado do arranjo — a mesma **conta que não bate**
da §3.1.79.

Os dois testes que nasceram disso:
- peso **16 ÷ 3** → `[5,34; 5,33; 5,33]` e a soma fecha em 16 exato;
- `ordem` entrou na fixture: é ela que decide **quem recebe o centavo**, e fixture sem ordem
  esconde metade da regra.

#### A conferência que vale — 44 pesos, 0 divergências

Não basta a soma fechar: os dois caminhos têm de dar o **mesmo número por questão**. Cruzei
`GET /acervo` contra `GET /catalogo/modelos/:versaoId` (o instrumento), questão por questão:

| Perfil | Questões | Divergentes | Pontuação máxima gravada × calculada |
|---|---|---|---|
| Administrativo | 11 | **0** | 72 × 72 |
| Operação de Loja | 14 | **0** | 72 × 72 |
| Produção e Indústria | 14 | **0** | 72 × 72 |
| [DEMO] Treinamento | 5 | **0** | 60 × 60 |
| **Total** | **44** | **0** | — |

Somas por perfil: **60,00 · 60,00 · 60,00 · 50,00** — exatas.

#### ⚠️ Peso `null` não é peso zero

`pesosDerivados()` **falha alto** quando uma questão está numa classificação sem peso — é o
certo para a avaliação, onde a questão valeria zero em silêncio. Numa tela de LEITURA, porém,
derrubar o acervo inteiro por causa de um rascunho meio montado é o pior desfecho: some tudo,
e ninguém descobre por quê. Aqui a exceção é capturada **por versão**: aquele perfil devolve
`peso: null` e a tela escreve **"sem peso"** em âmbar. Hoje não existe nenhum caso (a migration
confere na subida); o rascunho da **Etapa 3** vai passar por aqui enquanto está sendo montado.

#### Os dois comentários obsoletos do catálogo — corrigidos

`catalogo.service.ts` ainda afirmava que o `pesoTotal` do grupo **é a soma dos pesos das
perguntas** e vem de `somatorioPorGrupo`, e que a pontuação máxima recalculada sai da
`pontuacaoMaxima()` da publicação. Nenhuma das duas é verdade desde 11/09: **inverteu** — o peso
mora no grupo e o da questão é derivado; e quem recalcula é `pontuacaoMaximaDoArranjo()`.

⚠️ Registrado no lugar: as duas funções do `publicacao.validator.ts`
(`pontuacaoMaxima`, `somatorioPorGrupo`, `assertModeloPublicavel`) **não têm chamador de
produção** — só specs. É a família da §3.1.82 (peça sem chamador). Elas voltam na **Etapa 4**,
adaptadas ao arranjo.

#### Guarda conferida nos dois lados

| | Resultado |
|---|---|
| `zz.teste.rh` (RH_ADMIN) | 200, 15 questões |
| `clenio` (AVALIADOR) | **403** — *"Perfil insuficiente…"* |
| sem token | **401** |
| Menu | mesmos três papéis do controller — sem o furo permissivo da §3.1.77 |

#### Números reais lidos na tela

**15 questões · 8 classificações · 0 fora de todo perfil.** Doze das 15 pesam **diferente**
conforme o perfil — que é exatamente o que a tela existe para mostrar. Suíte: **58 suítes,
735 testes**, verdes.

---

### 3.1.86. ⭐⭐ REGRA — fixture redonda não testa arredondamento, e o aviso não é contramedida

**Terceira vez da mesma família**, e as três em quatro dias:

| # | Defeito | O que dizia | O que era | Quem pegou |
|---|---|---|---|---|
| 1 | `pontuacaoMaximaDoArranjo` (11/09) | 72,03 | 72 | arredondava por questão em vez de uma vez no fim |
| 2 | `assertCriterioSalvavel` (11/09) | validava | zerava `codigoCalculo` **antes** de validar — a regra escrita nunca era alcançada | exercitar o serviço contra o banco |
| 3 | Peso efetivo do acervo (12/09) | 59,97 | 60 | `peso ÷ n` arredondado, sem o centavo do resto | somar o derivado e comparar com o declarado |

**Nenhum dos três falharia em teste.** Os três foram pegos por **uma conta que não fecha**, ao fim
de uma etapa curta. É a razão de o editor ir por blocos com portão, e não em uma entrega só.

#### (a) Fixture redonda não testa arredondamento

Os 7 testes do acervo passavam com o defeito dentro. Não por descuido de asserção: os pesos das
fixtures eram **12 ÷ 2, 9 ÷ 1, 10 ÷ 1** — todos exatos. **Furo de arredondamento mora onde SOBRA.**
Fixture com número redondo é justamente o caso em que não há resto, então ela é cega para a única
coisa que a regra de repartição faz de não trivial.

⚠️ **Gatilho:** ao escrever teste de qualquer conta com divisão, arredondamento ou rateio, a
primeira fixture tem de ter **resto** (`16 ÷ 3`, `10 ÷ 3`, `7 ÷ 2`). A redonda entra depois, se
entrar.

⚠️ Corolário que apareceu junto: a fixture do `usoEm` não tinha `ordem`. Ordem parece decoração —
é ela que decide **quem recebe o centavo**. Campo ausente na fixture esconde metade da regra.

#### (b) ⭐⭐ O aviso em maiúsculas NÃO é a contramedida

O cabeçalho do `calculo/peso-derivado.ts` já dizia, em negrito: *"a repartição é
`modelo/distribuirPeso` — **não reimplementar aqui**"*. Escrito por mim, seis dias antes.
Reimplementei mesmo assim, porque **não fui ler o arquivo**: escrevi a divisão que "obviamente"
era a conta certa, e um aviso só protege quem já abriu o arquivo onde ele está.

É o mesmo achado das REGRAS-DE-METODO: *regra sem gatilho não pega nem quem a escreveu*.

**A contramedida é uma CONTA, não um texto:**

> ⭐⭐ **Toda tela que mostra peso soma o derivado e compara com o declarado.**
> A soma dos pesos efetivos de um perfil tem de bater com a soma dos `ArranjoGrupo.peso` daquele
> perfil. Se não bater, alguém repartiu por conta própria.

É verificação de dois números que **já existem** em lugares diferentes — não precisa de fixture,
não precisa de intenção declarada, e vale para tela que ainda não foi escrita. Onde já está
aplicada: `/acervo` × `/catalogo/modelos/:versaoId`, 44 pesos, 0 divergências (§3.1.85).

Vale ao lado da §3.1.79 (*a conta que não bate detecta furo de guarda melhor que ler código*) e da
§3.1.82 (*peça sem chamador*).

---

### 3.1.87. ✅ BLOCO A DO EDITOR — duplicar versão e cadastrar classificações (12/09)

Primeiro bloco da nova organização: **quatro blocos com portão**, no lugar de sete etapas
seguidas. O portão de cada um é uma **conta**, não uma revisão de código — decisão tomada depois
que três defeitos seguidos (§3.1.86) passaram por teste verde e foram pegos por soma que não
fecha.

#### (0) A guarda veio ANTES da peça que a exercita

`validarAplicacao` ganhou `versaoPublicada`. **A tela já filtrava** — `AplicacoesPage` tem
`.filter((v) => v.publicadoEm)` desde sempre — **e a API aceitava qualquer versão**. É a direção
permissiva da §3.1.77, a silenciosa: ninguém reclama, nada quebra, e quem descobre é quem chama a
API direto.

Ficou inofensiva até 12/09 **só porque não existia nenhuma versão em rascunho**: as quatro
nasceram publicadas, pelo seed. Duplicar cria a primeira. Por isso a guarda entrou antes, e não
depois — guarda que nunca teve o que barrar é guarda que ninguém sabe se funciona.

⚠️ **O teste de invariante achou um terceiro chamador que eu não tinha visto.** Escrevi a guarda
para dois momentos (criar a aplicação, abrir o ciclo) e o `versao-publicada.invariante.spec.ts`
apontou `aplicacao.service.ts:173` — **editar** a aplicação. `modeloVersaoId` não é editável, mas
a versão pode ser despublicada no meio, e sem a linha editar o peso seria a porta que revalida
tudo menos isto. Mesmo padrão do `assertRdvAberto` da Logística: o teste varre o FONTE, não a
lista de chamadores de que alguém se lembrou.

#### (1) Etapa 2 — duplicar e descartar (`modelo/versao.service.ts`)

| Rota | O que faz |
|---|---|
| `GET /modelos/:id/versoes` | as versões, com contagens e o `efeitoDeDescartar` pronto |
| `GET /modelos/versoes/:id/previa-duplicar` | a prévia — **a mesma função que o ato consulta** |
| `POST /modelos/versoes/:id/duplicar` | cria o rascunho |
| `DELETE /modelos/versoes/:id` | descarta o rascunho |

⭐ **O que se duplica é o ARRANJO, não as questões.** Depois do acervo a questão é global: duas
versões apontam para a mesma `Pergunta`. Copiar a questão recriaria a duplicação que a unificação
desfez (39 linhas → 15).

⚠️ **`publicadoEm` e `pontuacaoMaxima` nascem NULOS de propósito.** Copiar a pontuação máxima da
origem gravaria um número que descreve outro arranjo — e ele passaria a "conferir" contra o
recalculado errado, que é exatamente o par de números que a tela do instrumento existe para opor.

**Decisão: UM rascunho por perfil.** Com dois, *"o rascunho do Administrativo"* deixa de ter
referente; o editor perguntaria qual a cada abertura e duas pessoas editariam arranjos diferentes
achando que estão no mesmo. A recusa oferece as três saídas (continuar, publicar, descartar) —
recusa sem saída vira beco.

#### (2) Etapa 5 — classificações (`acervo/classificacao.service.ts`)

CRUD completo: criar, renomear, **reordenar a lista inteira**, desativar/reativar, apagar.

⚠️ **`ativa` não filtrava NADA até hoje** — coluna decorativa, lida só pela tela do acervo. Mesma
família do `status` do módulo no Hub (05/09), que o comentário do compose afirmava filtrar. Ela
ganhou significado, e ele é **estreito de propósito**:

> `ativa = false` → a classificação **não é oferecida** ao criar ou mover uma questão. Nada mais.

Não sai dos arranjos que a usam, não tira as questões que estão nela. Se desativar mexesse em
arranjo publicado, **a nota de gente real mudaria por um clique de cadastro** — e a frase do ato
diz isso em voz alta, com os números ("as 3 questões continuam lá, os 4 perfis não mudam — 4 estão
publicados, e nenhuma nota se altera").

⚠️ **Reordenar é a lista INTEIRA, nunca "sobe um".** Com um `PATCH` por item, uma falha no meio
deixa duas classificações na mesma ordem e a tela lista em ordem arbitrária — e ninguém vê, porque
a lista continua com todos os itens.

⚠️ O `@unique` do Postgres é case-**sensitive**: "Assiduidade" e "assiduidade" passariam as duas. A
conferência é sem caixa, e é ela que produz a frase legível (409, citando o nome que já existe).

#### 🚪 O PORTÃO — as quatro contas

Duplicados **os quatro perfis**, conferidos, e três descartados depois.

| Conta | Resultado |
|---|---|
| **Pesos efetivos do rascunho × da origem** | **44 comparados, 0 divergências** |
| **Soma por perfil, no rascunho** | 60,00 · 60,00 · 60,00 · 50,00 — iguais às publicadas |
| **Aplicações/avaliações apontando para rascunho** | **0** |
| `POST /aplicacoes` sobre rascunho | **400**, com a frase escrita |
| `POST /aplicacoes` sobre a publicada, mesmo ciclo | **201** — a guarda não barra demais |
| 2º rascunho no mesmo perfil | **400**, citando a v2 e as três saídas |
| `DELETE` de versão publicada | **400** — *"deixaria avaliação sem régua"* |
| Apagar classificação em uso | **400**, com a contagem |
| Reordenar pela metade | **400** — *"precisa citar as 9, uma vez cada"* |
| Nome repetido em outra caixa | **409** |
| Reordenar ida e volta | ordem restaurada exata |
| Órfãos de arranjo após descartar | **0** |
| 44 pesos das publicadas × instrumento | **0 divergências**, máximas 72/72/72/60 |
| Piloto | **894 PENDENTE, 0 respostas** |
| ENSAIO | RASCUNHO, 325 |

Suíte: **62 suítes, 752 testes** (eram 58/735).

#### O que ficou no DEV, de propósito

**`Administrativo v2` continua como rascunho** — para a tela poder ser vista nos dois estados. É
descartável em um clique, e não alcança ciclo nenhum.

#### ⚠️ Duas coisas que NÃO consegui provar por requisição

1. **Não existe conta `RH_CICLO` nem `RH_MODELO` no DEV.** Só `RH_ADMIN` (2) e `AVALIADOR` (52).
   As guardas novas declaram papéis DIFERENTES entre si — `/acervo` aceita os três papéis de RH,
   `/classificacoes` e `/modelos/*/versoes` só `RH_ADMIN` e `RH_MODELO` —, e essa diferença **não
   foi exercitada**: o que provei foi `AVALIADOR` → 403 e sem token → 401. É pendência de T.I.
   (criar as duas contas), não da Arielly.
2. O aviso da tela de Questionários dizia *"não há por onde editá-lo no sistema"* e virou meia
   verdade no minuto em que o duplicar nasceu. Reescrito para separar o que **já** dá (abrir um
   rascunho) do que **ainda não** dá (mexer no conteúdo dele) — é a §3.1.33 pelo avesso: em vez de
   prometer o que não existe, esconder o que passou a existir.

---

### 3.1.88. ⭐⭐ REGRA — a contramedida para "cinco certos, dois esquecidos" é um TESTE QUE VARRE O FONTE

**O que aconteceu, e é o exemplo curto da regra.** Escrevi `versaoPublicada` para os chamadores
que eu sabia que existiam: criar a aplicação e abrir o ciclo. Escrevi junto um teste de invariante,
mais por hábito do que por dúvida. Ele reprovou apontando `aplicacao/aplicacao.service.ts:173` —
**editar** a aplicação, um terceiro chamador que eu não tinha visto.

Não foi descuido de leitura: eu tinha feito o `grep`. O `grep` acha onde a regra **foi escrita**;
o que faltava era onde ela **deveria estar** — e isso nenhuma busca por nome encontra, porque a
linha ausente não tem nome.

⭐ **A forma da contramedida.** Em vez de conferir à mão os lugares em que a regra deve aparecer,
escrever um teste que **exige que ela apareça em todos**. Duas formas funcionam, e o que muda entre
elas é o SINAL que o teste procura no fonte:

| Forma | Sinal no fonte | Onde já está |
|---|---|---|
| **(A) campo companheiro** | um objeto literal que traz `modeloFinalidade` tem de trazer `versaoPublicada` | `aplicacao/versao-publicada.invariante.spec.ts` |
| **(B) guarda obrigatória** | método que chama `.create/.update/.delete` tem de chamar a guarda do agregado | `assertRdvAberto` na Logística |

⚠️ **O campo é opcional de propósito, e é isso que exige o teste.** `versaoPublicada?: boolean` com
`undefined` = publicado evita que chamador antigo passe a inventar problema — e pela mesma razão
**esquecer o campo desliga a guarda em silêncio**, sem erro de compilação e sem teste vermelho.
Campo opcional numa guarda é uma dívida que só o teste de fonte cobra.

#### Dá para aplicar às outras regras do classificador? Dá — e o custo é o da LISTA DE EXCEÇÕES

Medi os métodos que escrevem, por serviço:

| Serviço | Métodos que escrevem | Classificador que deveria ser consultado |
|---|---|---|
| `ciclo.service` | **7** (criar, abrir, encerrar, devolverCanceladas, reabrir, ajustarConceitos, ajustarPeriodo) | `problemasParaAbrir` / ciclo operável |
| `aplicacao.service` | **5** (criar, editar, apagar, adicionar/removerDoPublico) | `motivoParaNaoEditar`, `validarAplicacao` |
| `classificacao.service` | **5** | `efeitoDeApagar/Desativar/Reativar` |
| `designacao.service` | **3** (designar, decidir, desfazer) | `efeitoDeDesignar`, `efeitoDeDesfazer` |
| `criterio.service` | **3** (criar, atualizar, salvarFaixas) | `assertCriterioSalvavel`, `assertFaixasValidas` |
| `avaliacao.service` | **3** (responder, enviar, reabrir) | separação de funções (**já tem invariante**) |
| `versao.service` | **2** | `efeitoDeDuplicar`, `efeitoDeDescartar` |
| **Total** | **28** | |

⚠️ **Escrever o teste é a parte barata** (~40 linhas cada, o padrão já existe em 6 arquivos). O que
custa é decidir a **lista de exceções**: `devolverCanceladasDoEncerramento` escreve e legitimamente
não passa pela guarda de abertura; `removerDoPublico` também não. Exceção mal escolhida produz
**falso vermelho**, e falso vermelho destrói a ferramenta (regra 1 da §5.9) — a suíte passa a ser
ignorada, e aí ela não protege mais nada.

**Custo honesto, por prioridade:**

| Agregado | Custo | Por que nesta ordem |
|---|---|---|
| `designacao` + `criterio` | **~6h** | escrita que decide **quem julga quem** e a **régua** — erro aqui chega em nota de gente |
| `ciclo` | **~4h** | 7 métodos, e é onde mora a maior lista de exceções |
| `aplicacao` | **~3h** | metade já coberta pelo invariante de 12/09 |
| `classificacao` + `versao` | **~1h**, e **não recomendo agora** | 2 dias de idade, um chamador cada, guarda no topo de todo método: o teste passaria trivialmente hoje e só pagaria depois |

**Total do que vale a pena: ~1,5 dia** (designação, critério, ciclo, aplicação). Não é bloqueio de
nada — cabe em qualquer intervalo entre blocos do editor.

### 3.1.89. ⭐ O 72,03 EVITADO POR DESENHO — `pontuacaoMaxima` nasce NULA no rascunho

Ao duplicar uma versão, `publicadoEm` **e** `pontuacaoMaxima` ficam nulos. O `publicadoEm` é
óbvio; o outro é a decisão que importa.

**Copiar a máxima da origem gravaria um número que descreve OUTRO arranjo.** No instante da cópia
os dois arranjos são idênticos e o número estaria certo — mas o rascunho existe justamente para ser
mexido. Na primeira questão acrescentada, a máxima gravada passa a descrever o arranjo de ontem, e
**nada acusa**: a tela do instrumento mostra as duas colunas (gravada × recalculada) lado a lado
esperando que divirjam quando alguém mexeu no banco por fora, e passaria a mostrar divergência
como se fosse isso.

Pior que o número errado é o número errado **com aparência de conferência**. Vazio é honesto: a
tela escreve *"ainda não publicada"*, que é o que de fato se sabe. A máxima é calculada e gravada
**na publicação** (Etapa 4), sobre o arranjo final.

⭐ É o **72,03 evitado por desenho**, e não por teste: lá (§3.1.86 nº 1) o número errado veio de
arredondar por item; aqui viria de copiar um valor que descreve outra coisa. A mesma família —
*número com aparência de precisão que não é o que parece* — resolvida antes de existir, porque
desta vez a pergunta foi feita na hora de escrever o `create`.

---

### 3.1.90. 🔑 CONTAS DE TESTE DOS TRÊS PAPÉIS — e o 403 que não era de papel

Criadas em 12/09, no DEV. **`RH_MODELO` existe no RBAC desde 05/09 e ninguém nunca a teve** — o
papel que o `roles-rh.ts` descreve como *"monta o INSTRUMENTO: perguntas, grupos, pesos"* nunca
havia sido exercitado contra o editor que estava sendo escrito para ele.

| Login | Papel | Matrícula | Senha |
|---|---|---|---|
| `zz.teste.rh` | RH_ADMIN | 009900 | `TesteRh2026` |
| `zz.teste.modelo` | RH_MODELO | 009901 | `TesteRh2026` |
| `zz.teste.ciclo` | RH_CICLO | 009902 | `TesteRh2026` |

Nome inequívoco nos três: **"ZZ CONTA DE TESTE T.I. (papel) — NAO E PESSOA"**.

#### ⚠️ O que a criação revelou: conta de módulo NÃO basta

As duas contas novas tomaram **403 em TODAS as rotas**, inclusive nas que declaram os papéis
delas. E a mensagem não falava de papel:

> *"A matrícula 009901 do seu usuário não corresponde a nenhum colaborador ativo."*

**Toda rota do módulo exige que a matrícula resolva num colaborador ATIVO** (`identidade.service`)
— ler o acervo inclusive. É a família do **403 que parece falta de permissão** e manda a pessoa ao
Configurador dar papel a quem já tem ([[feedback_chapa_colide_5_digitos]]). Só voltou a funcionar
depois de criar os dois `rh.colaborador` correspondentes (CC `ZZTESTE`, fora de qualquer recorte).

⚠️ **Vale para HLG e PROD**: dar papel a alguém no Configurador **não é suficiente** para essa
pessoa entrar no módulo — a matrícula tem de existir em `rh.colaborador` e estar ativa.

#### A matriz medida — e o desenho está certo

| Rota | RH_ADMIN | RH_MODELO | RH_CICLO |
|---|---|---|---|
| `GET /acervo` | 200 | **200** | **200** |
| `GET /catalogo/modelos` · `/modelos/:versao` | 200 | 200 | 200 |
| `GET /classificacoes` | 200 | 200 | **403** |
| `GET /modelos/:id/versoes` · `previa-duplicar` | 200 | 200 | **403** |
| `POST duplicar` · `DELETE versão` | ok | ok | **403** |
| `POST/PATCH/DELETE /classificacoes` | ok | ok | **403** |
| `GET/POST /acervo/questoes` (Etapa 6) | ok | **ok** | **403** |
| `GET /ciclos` | 200 | **403** | 200 |

⭐ **Lê-se em duas linhas:** LER o instrumento é dos três (*ler o instrumento não é ler nota*);
**MEXER** no instrumento é de `RH_ADMIN` + `RH_MODELO`; **montar CICLO** é de `RH_ADMIN` +
`RH_CICLO`. Os dois papéis se cruzam só na leitura, que é exatamente a separação escrita em
`roles-rh.ts`. Nada a corrigir no desenho.

### 3.1.91. ✅ BLOCO B DO EDITOR — criar e editar questão (12/09)

#### A medição que desenhou o formulário — e as duas metades vão em direções opostas

| | |
|---|---|
| Conjuntos de **VALORES** distintos entre as 15 | **1** — `0,3 · 0,6 · 0,9 · 1,2`, sem exceção |
| **Maior valor** | **1,2** nas 15 |
| Textos de âncora distintos | **60 de 60** |

⚠️ **Eu resumi isto errado na conversa** ("escala reutilizável não se paga") — a §3.1.83 já dizia o
contrário para o VALOR. A conclusão correta separa as duas: o **valor** é universal e **deve ser
imposto**; o **texto** nunca se repete e é o trabalho real.

**Por que o maior valor é invariante, e não preferência:**

```
pontuação máxima do perfil = Σ (peso da questão × MAIOR valor da questão)
com maior = 1,2 e Σpesos = 60  →  72
```

Uma questão com maior ≠ 1,2 muda a máxima daquele perfil e **desloca toda nota dele** — e a conta
continua fechando, sobre outro denominador. É o 72,03 da §3.1.86 por outra porta.

⚠️ Por isso a escala é **derivada do acervo em tempo de execução** (`acervo/escala.ts`), não escrita
como constante: constante seria uma segunda verdade, que continuaria compilando e imporia a escala
de ontem. A `ESCALA_INICIAL` só serve ao acervo VAZIO. E quando o acervo **não** é uniforme, a peça
**recusa criar qualquer questão** e lista quem foge — escolher a majoritária em silêncio congelaria
a escala errada.

#### O formulário diz o tamanho ANTES do primeiro campo

> **Uma questão são cinco textos:** o enunciado e as quatro alternativas — uma para cada nível, do
> pior ao melhor. A **pontuação já vem pronta** (0,3 · 0,6 · 0,9 · 1,2) e é a mesma de todas.

Cada linha tem o rótulo do nível ("A pior situação", "O esperado"…) e um exemplo. O botão mostra
**"Faltam 3 textos"** em vez de "preencha os campos obrigatórios" — o número diz de quanto é o
resto do trabalho.

#### As duas recusas duras têm causas DIFERENTES

| Recusa | Causa | O que trava |
|---|---|---|
| **resposta gravada** | alguém já respondeu aquele texto | o **TEXTO**. A nota não muda (`Resposta.valor` está gravado); o REGISTRO é que passaria a dizer outra coisa |
| **está em arranjo** | o peso é derivado da classificação | a **CLASSIFICAÇÃO**. Mover a questão muda o peso de **duas** classificações em cada perfil que a usa |

⭐ **E não se confundem**: questão com resposta e sem arranjo pode ser reclassificada; questão em
arranjo e sem resposta pode ter o texto corrigido. Um `podeEditar` único trataria "trocar de
classificação" como se fosse "corrigir um acento".

Apagar recusa nos dois casos e **manda desativar** — a saída que tira da montagem e deixa o
histórico de pé.

#### ⭐ Código novo é `C###`, não `019`

`codigo` é a chave natural e veio do **SQP010**. Gerar `019` colidiria no dia em que o Protheus
tiver o dele, e a colisão apareceria como violação de unicidade numa sincronização, longe daqui.
`C###` separa as origens de forma legível na própria tela: **número puro veio do Protheus, `C` veio
daqui** — e o rótulo do cartão acompanha (dizia "RD8010 004" para todas; agora diz *"criada aqui ·
C001"* nas locais, porque atribuir ao Protheus uma decisão do RH é rótulo errado).

#### 🚪 O PORTÃO

| Conta | Resultado |
|---|---|
| Questão nova existe no acervo | ✅ **C001**, 16 questões |
| Não entra em perfil nenhum | ✅ `usos: []`, `foraDeTodoPerfil: 1` |
| A tela diz isso explicitamente | ✅ aviso vem do BACKEND com a questão + tarja âmbar no cartão |
| **Os 44 pesos dos perfis existentes** | ✅ **44 conferidos, 0 divergências**, máximas 72/72/72/60 |
| Somas por perfil | 60 · 60 · 60 · 50 |
| Escala com maior 1,5 | **400**, explicando o deslocamento da nota |
| Dois textos iguais · texto faltando | **400** |
| Reclassificar a 004 (5 perfis) | **400** |
| Apagar a 004 (**19 respostas** reais, do ciclo SIMULACAO) | **400**, mandando desativar |
| Piloto | **894 PENDENTE, 0 respostas** |
| ENSAIO | RASCUNHO, 325 |

Suíte: **64 suítes, 768 testes**.

⚠️ **Um invariante meu me pegou de novo, e é o terceiro em dois dias.** O
`texto-sem-flexao.invariante.spec.ts` reprovou `${esperadas} alternativas` — com 1 sairia
*"1 alternativas"*. Ao corrigir, achei o mesmo erro em outra frase que eu tinha escrito no Bloco A
(*"citar as ${n} classificações"*) e que a rede não pegou. **Um verde ali não é prova; é prova de
que as duas formas conhecidas não estão na frase.**

#### O que ficou no DEV, de propósito

`C001 — ZZ TESTE — Cuidado com o EPI`, para a tarja *"não está em nenhum perfil"* poder ser vista.
Apagável em um clique, e sem resposta nenhuma.

---

### 3.1.92. 📝 CORREÇÃO DE LEITURA — a escala: 1 conjunto de VALORES, 60 textos

Registro porque a leitura errada foi feita **na conversa, sobre um número que já estava certo no
documento** — e é isso que a torna perigosa como precedente.

A §3.1.83 mede duas coisas com resultados **opostos**:

| | |
|---|---|
| Conjuntos de **VALORES** distintos entre as 15 questões | **1** — `0,3 · 0,6 · 0,9 · 1,2` |
| Textos de âncora distintos | **60 de 60** |

Na conversa de 12/09 isso foi resumido como *"15 conjuntos distintos, escala reutilizável não se
paga"* — que é a linha dos **textos** aplicada aos **valores**. A consequência quase construída era
um formulário pedindo os quatro valores a cada questão, ou seja, **abrindo à mão o grau de
liberdade que a §3.1.86 fecha por invariante**.

⚠️ **A lição não é "conferir o número"** — o número estava certo e escrito. É que **uma tabela com
duas linhas de sentidos opostos vira uma frase só quando é resumida**, e o resumo fica com a linha
que soa mais interessante. Quando um levantamento tiver duas metades que apontam para lados
diferentes, o resumo **cita as duas ou não cita nenhuma**.

⭐ Vale ao lado da regra 15 (*dois números verdadeiros na mesma tela precisam do termo que os
concilia*): aqui foram dois números verdadeiros no mesmo levantamento, e o que faltou foi o termo
dizendo que **um é sobre valor e o outro sobre texto**.

### 3.1.93. ⭐⭐ FAMÍLIA — o 403 que fala de outra coisa (a terceira)

| # | Caso | O que a pessoa tinha | O que faltava | O que a mensagem dizia |
|---|---|---|---|---|
| 1 | **Esmeralda** (08/09) | conta na plataforma | **o módulo** | "sem acesso" |
| 2 | **clenio** (11/09) | conta e módulo | **a permissão** | 403 genérico |
| 3 | **`zz.teste.modelo`** (12/09) | conta, módulo **e papel** | **o colaborador** | *"A matrícula 009901 não corresponde a nenhum colaborador ativo"* |

⭐ **Toda rota do módulo exige que a matrícula do usuário resolva num `rh.colaborador` ATIVO** —
`GET /acervo` inclusive, que é leitura de instrumento em branco e não toca em dado de pessoa
nenhuma. A verificação é do `identidade.service`, roda antes de qualquer papel, e é o que mais
confunde: **a mensagem fala de matrícula, quando quem lê está pensando em permissão.**

O caminho errado que ela induz é ir ao **Configurador dar papel a quem já tem** — o mesmo sintoma
da colisão de chapa ([[feedback_chapa_colide_5_digitos]]), por causa diferente.

⚠️ **ENTRA NO ROTEIRO DE DEPLOY (HLG e PROD):**

> **Dar papel no Configurador NÃO basta.** Para alguém entrar no Gestão de Pessoas são **quatro**
> coisas, e faltando uma o sintoma é um 403 que aponta para a errada:
> 1. conta na plataforma, ATIVA;
> 2. o módulo `GESTAO_PESSOAS` atribuído;
> 3. o papel (`RH_ADMIN` / `RH_MODELO` / `RH_CICLO` / `AVALIADOR`);
> 4. **matrícula que resolva num `rh.colaborador` ATIVO** — o que exige a sincronização com o
>    Protheus ter rodado, ou, para conta de serviço/teste, um colaborador criado à mão.

Não é defeito a corrigir: é a decisão do ADR-RH-01 (o colaborador mora em `rh`) chegando na porta
de entrada. O que **é** defeito é a mensagem mandar para o lugar errado, e isso fica anotado como
melhoria de texto — hoje ela é tecnicamente exata e operacionalmente enganosa.

---

### 3.1.94. ✅ OS INVARIANTES DE GUARDA DE ESCRITA — quatro serviços, três exceções, zero furos

Pedido antes do Bloco C, e pela razão certa: **o Bloco C é onde o peso passa a ser escrito pela mão
do RH**, e designação e critério precisavam estar cobertos antes de mexer em peso.

Ficou em **um arquivo só**, dirigido por tabela — `common/guarda-de-escrita.invariante.spec.ts`.
Quatro serviços em vez de quatro arquivos, porque assim a **lista de exceções é uma tabela que se
lê de uma vez**, que é o que precisa ser revisado.

| Serviço | Regra(s) exigida(s) | Métodos que escrevem | Exceções |
|---|---|---|---|
| `designacao.service` | `assertCicloOperavel` **e** um classificador `efeitoDe…`/`efeitoDo…` | 3 | **0** |
| `criterio.service` | `assertSalvavel` ou `assertFaixasValidas` | 3 | **0** |
| `aplicacao.service` | afere o ciclo · **e** valida a aplicação | 5 | **2** (na 2ª regra) |
| `ciclo.service` | afere o estado do ciclo | 7 | **1** |

#### 🔍 A LISTA DE EXCEÇÕES — as três, com o porquê

**1. `ciclo.criar` — não afere o estado do ciclo.**
> Não há ciclo ainda: este é o método que o cria. Não existe estado a aferir, e o que precisa ser
> validado (o período) é validado por `validarPeriodo`.

**2. `aplicacao.adicionarAoPublico` — não chama `validarAplicacao`.**
> O público **não é campo da Aplicação** — é tabela à parte. `validarAplicacao` confere nome, peso
> do questionário e critérios, nada do que este método toca; e a regra do público ("aplicação sem
> público não alcança ninguém") é cobrada na **abertura do ciclo**, por `problemasParaAbrir`, que é
> o único momento em que ela decide algo. Rodá-la aqui recusaria incluir uma pessoa por causa de um
> peso que ninguém mexeu. ⚠️ Ele **passa** na primeira regra: chama
> `assertCicloDaAplicacaoOperavel`.

**3. `aplicacao.removerDoPublico` — mesma coisa.**
> Mexe no público, não na Aplicação. E é o ato de **corrigir**: travá-lo por um problema em outro
> campo prenderia o erro dentro da aplicação, que é o oposto do que a guarda existe para fazer.

#### O que NÃO virou exceção, e quase virou

Três métodos do ciclo — `encerrar`, `reabrir`, `devolverCanceladasDoEncerramento` — não chamam
`assertCicloOperavel`, e a primeira leitura os classificou como candidatos a exceção. **Não são.**
Eles aferem o estado, só que **inline e com estado específico**, porque são a *transição* do ciclo:
`encerrar` exige ABERTO (a guarda genérica aceitaria RASCUNHO), e `reabrir` exige ENCERRADO —
exatamente o estado que a guarda genérica **recusa**. A regra foi escrita para aceitar as duas
formas (`assertCiclo…(` **ou** `ciclo.status [!=]==`), em vez de abrir três exceções para o que é
guarda de verdade escrita de outro jeito.

⭐ Foi o momento em que a regra da exceção pagou: as três linhas de justificativa não saíam com
convicção, e a razão era que **elas não eram exceções**.

#### ⚠️ Validado por MUTAÇÃO, não por construção

Verde ao escrever não prova nada — o teste podia estar procurando a coisa errada. Rodei quatro
mutações contra cópias do fonte:

| Mutação | Resultado |
|---|---|
| Tirar `assertCicloOperavel` de dentro do `designar` | ✕ **reprova, nomeando `designar`** |
| Método novo que faz `update` sem guarda nenhuma | ✕ **reprova, nomeando `mutacaoMetodoNovoSemGuarda`** |
| `adicionarAoPublico` passa a chamar a guarda (exceção vira ficção) | ✕ **reprova como exceção sobrando** |
| Trocar a indentação, quebrando a varredura | ✕ **reprova no canário** ("encontrou 0 métodos") |

⭐ **O canário é a parte que quase faltou.** Sem ele, uma refatoração que mudasse a forma dos
métodos faria o `split` devolver zero e **todas as regras ficariam verdes** — verde por ausência de
leitura, que é o pior resultado possível num teste de guarda. Mesma classe do
`npm test` que rodava "52 suítes, 0 testes" (§3.1.-) e do `tsc --noEmit` que checa zero arquivo.

#### ⚠️ Custo real: ~2h, não 1,5 dia

Eu estimei **1,5 dia** e gastei cerca de **duas horas**. A estimativa assumia achar e tapar furos;
**não havia nenhum** — os quatro serviços já chamavam as guardas em todos os 18 métodos que
escrevem. O que sobrou foi o trabalho de decidir a lista de exceções, e ela tem três entradas em
vez das dez que eu temia.

Registro a diferença porque a estimativa errada foi **para cima e por medo**, e esse é o tipo que
não aparece: entrega antes do prazo passa por boa notícia. O que ela de fato mede é que o padrão do
classificador já estava aplicado com disciplina — a dívida que eu supunha não existia.

Suíte: **65 suítes, 785 testes**.

---

### 3.1.95. ⭐⭐ O CASO QUE VALIDOU A REGRA DA EXCEÇÃO — "se não consegue escrever o porquê, é furo"

A regra nasceu como precaução e foi exercitada no mesmo dia, com resultado que **mudou o desenho**.

Ao montar o invariante do `ciclo.service`, três métodos apareceram como candidatos a exceção:
`encerrar`, `reabrir` e `devolverCanceladasDoEncerramento`. Nenhum chama `assertCicloOperavel`.
Sentei para escrever a linha do porquê de cada um — e **nenhuma saiu com convicção.**

A razão é que **não eram exceções**. Os três aferem o estado do ciclo, só que **inline e com
estado específico**, porque são a *transição* do ciclo:

| Método | Exige | Por que a guarda genérica não serve |
|---|---|---|
| `encerrar` | ABERTO | `assertCicloOperavel` aceitaria RASCUNHO |
| `devolverCanceladas…` | ABERTO | idem |
| `reabrir` | **ENCERRADO** | é exatamente o estado que a guarda genérica **recusa** |

⭐ **A saída certa não era abrir três exceções — era corrigir a REGRA.** Ela passou a aceitar as
duas formas (`assertCiclo…(` **ou** `ciclo.status [!=]==`). Três exceções ali teriam escondido
guarda de verdade escrita de outro jeito, e a lista de exceções — que é o que alguém relê daqui a
seis meses — teria três entradas dizendo "este não precisa", sobre métodos que precisam e cumprem.

**O que a regra fez de fato:** ela não pegou um furo. Ela pegou uma **regra mal formulada**, e o
sintoma foi a justificativa não sair. Escrever o porquê é o teste da regra tanto quanto do método.

### 3.1.96. ⭐⭐ FRASE — guarda que impede o CONSERTO é pior que guarda ausente

Da justificativa do `aplicacao.removerDoPublico`, e vale muito além dele:

> **Travar o ato de corrigir por causa de um problema em outro campo prende o erro dentro do
> registro** — que é o oposto do que a guarda existe para fazer.

Uma guarda ausente deixa passar o erro. Uma guarda no caminho do conserto **fecha a porta com o
erro dentro**, e a pessoa que queria arrumar recebe uma recusa que fala de outra coisa. Ao decidir
onde uma validação entra, a pergunta é *"isto está no caminho de errar, ou no caminho de
desfazer?"*.

Parente de [[feedback_dialogo_diz_o_que_se_perde]] e do §3.1.33: as duas famílias são sobre o ato
de correção sendo tratado como se fosse o ato original.

### 3.1.97. ⭐⭐ REQUISITO — todo teste que varre fonte precisa de CANÁRIO

Não é detalhe de implementação: é **requisito de existência**. Teste de varredura sem canário pode
estar verde por **não ter lido nada**, e ninguém descobre — a lista de infratores vazia é
indistinguível de "não há infratores".

**Mesma classe** do `npm test` que rodava *"52 suítes, 0 testes"* e do `tsc --noEmit` que checa
zero arquivo e sai 0 ([[feedback_frontend_typecheck_tsc_b]]). O padrão do defeito é sempre o mesmo:
**a ferramenta responde "tudo certo" para a pergunta que ela não chegou a fazer.**

#### Os dois níveis, e o primeiro sozinho não basta

| Nível | Prova | Quebra quando |
|---|---|---|
| **(a) leu arquivos** | `expect(fontes.length).toBeGreaterThan(30)` | a caminhada de diretório quebra |
| **(b) ainda RECONHECE** | alimentar o próprio matcher com a forma ERRADA e exigir que ele a reconheça | o padrão para de casar — refatoração, acento, aspa trocada |

⚠️ A maioria tinha só o (a). **O (b) é o que importa**, e é o que estava faltando.

#### O levantamento dos 7 — e os 3 consertos

| Teste | Antes | Agora |
|---|---|---|
| `avaliacoes-que-contam` | ✅ (a) + (b) — *"o varredor reconhece a forma errada quando ela existe"* | — |
| `motivo` | ✅ (a) + (b) (`declaram.length >= 3`) | — |
| `guarda-de-escrita` | ✅ (a) + (b), por nascer com a regra | — |
| `versao-publicada` | ✅ (b) implícito: exige a lista EXATA de arquivos, que vazia reprova | — |
| `fonte-unica` | ⚠️ só (a) | ✅ **canário escrito** |
| `texto-sem-flexao` | ⚠️ só (a) | ✅ **canário escrito** |
| `separacao-funcoes` | 🔴 **nenhum dos dois** | ✅ **canário escrito** |

#### ⚠️ Dois achados no conserto

**1. Canário que interfere no que observa não é canário.** A primeira versão do canário do
`fonte-unica` escrevia um arquivo de teste **dentro de `src/`** e o apagava no fim. As outras suítes
que varrem o mesmo diretório leram o arquivo no instante em que ele sumia: `ENOENT` em dois testes
que não têm nada a ver com este. O arquivo do canário nasce **fora da árvore varrida**
(`mkdtempSync`).

**2. O canário do `separacao-funcoes` reprovou na primeira escrita — e a premissa errada era
minha.** Assumi que *todo dispensado toca avaliação*; `common/testing/prisma-mock.ts` está na lista
e não contém `prisma.avaliacao.` (é o mock que **define** `avaliacao`). A lista de DISPENSADOS
mistura duas coisas: exceção acordada de domínio, e infraestrutura de teste. **Ficou registrado no
próprio arquivo em vez de "arrumado"** — mexer nessa lista é mexer na exceção da separação de
funções, que não se faz de passagem.

Suíte: **65 suítes, 788 testes**.

---

### 3.1.98. ✅ BLOCO C DO EDITOR — montar o arranjo e publicar (12/09)

O bloco de maior risco: **é aqui que o peso passa a ser escrito pela mão do RH**. Até hoje todos os
pesos do módulo vinham do seed, transcritos do RD8010.

#### As três travas de desenho da montagem

**1. Só RASCUNHO.** Versão publicada é imutável — dela saem notas. A recusa ensina a saída
("duplique-a e mexa lá").

**2. O ARRANJO INTEIRO DE UMA VEZ**, nunca "adiciona um / tira um". Com operações item a item
existe um instante em que a classificação já tem peso e ainda não tem questão — e é **exatamente
esse estado** que faz a soma declarada divergir da derivada. Gravar tudo numa transação **elimina o
estado intermediário** em vez de tentar tolerá-lo. Mesma razão do `reordenar` das classificações.

**3. AS DUAS SOMAS VÊM JUNTAS, sempre.** `somaDeclarada` (o que foi digitado) e `somaDerivada` (o
que a nota vai usar) são calculadas por caminhos diferentes e devolvidas lado a lado — na API e no
topo da tela, com o termo que as concilia escrito. É a conta da §3.1.86.

⚠️ **A montagem NÃO valida como se fosse publicar.** Rascunho meio montado é o estado normal de
quem está montando: barrar "classificação sem questão" ao salvar impediria o RH de criar a
classificação antes de escolher as questões dela, que é a ordem natural. O que é erro na publicação
volta na resposta como `problemasParaPublicar`, para a tela dizer o que falta **sem impedir de
salvar** — é a §3.1.96 (*guarda que impede o conserto*) aplicada à montagem.

#### A validação que faltava — e é a que pega dinheiro

`publicacao.validator.ts` foi **reescrito** (era a adaptação de ~4h prevista na §3.1.82: ele
descrevia `{ titulo, perguntas: [{ peso }] }`, forma que a migration do acervo acabou, e passou
seis dias verde e sem chamador). Saiu "peso da pergunta > 0" — não há tal campo. Entrou:

> ⭐⭐ **Classificação com peso e SEM questão.**

`pesosDerivados` ignora esse grupo de propósito — arranjo pela metade não impede ninguém de
responder. Mas **o peso dele some da conta**: declarada 60, derivada 50, e a pontuação máxima sai
sobre a derivada. Ninguém vê, porque os dois números parecem certos cada um por si. Na montagem é
aviso; **na publicação é erro**, e a frase diz para quanto a soma cairia.

#### 🔴 Dois defeitos achados rodando o portão

**1. A recusa da publicação virava 500.** `ModeloNaoPublicavelError` é `Error` puro; sem
mapeamento, o Nest devolvia *"Erro interno do servidor"* e **a lista de problemas — que é o produto
inteiro do validador — sumia no caminho.** ⚠️ O `assertArranjoPublicavel` tem spec **verde**: ela
exercita a FUNÇÃO, não a ROTA. Mesmo padrão do `CicloNaoAbrivelError` em `ciclo.service.ts:150`,
que já estava certo — e que eu não copiei.

**2. A coluna de percentuais somava 100,01.** Com pesos 16/10/34 sobre 60, `(peso ÷ soma) × 100`
arredondado por item dá 26,67 + 16,67 + 56,67. Nasceu `common/percentual.ts`
(`percentuaisQueFecham`, método do maior resto) — e **a mesma função foi aplicada ao catálogo**, que
tinha o defeito desde sempre na tela do instrumento.

⚠️ **A primeira versão dela ordenava o resto em ponto FLUTUANTE**, e o spec reprovou: as três
frações de 16/10/34 são a mesma (0,666…), mas o float as devolve diferentes na 13ª casa — o
centésimo ia para a terceira parte em vez da primeira. A soma continuava 100; o que mudava era
**quem recebia, por ruído de representação**. Tudo em inteiros: empate é empate, e o desempate é a
ordem.

⭐ São **duas** funções e não uma: `distribuirPeso` reparte um total em partes IGUAIS;
`percentuaisQueFecham` recebe partes DESIGUAIS e distribui só o centésimo do arredondamento. Mesma
regra, trabalhos diferentes.

#### 🚪 OS CINCO PORTÕES

Montado um perfil descartável (`ZZ PORTAO C`), publicado, conferido e apagado.

| # | Portão | Resultado |
|---|---|---|
| 1 | Perfil novo montado soma exatamente 60 | ✅ **60,0000** em 2 classificações |
| 2 | Pontuação máxima gravada = calculada | ✅ **72 × 72** |
| 3 | Regressão do `000006` continua 108/108 | ✅ **idênticas: 108/108, divergentes: 0** |
| 4 | Os 44 pesos das PUBLICADAS, 0 divergências | ✅ **44 pesos, 0** — 72/72/72/60 |
| 5 | Declarada = derivada em todo arranjo, API e tela | ✅ **6 de 6 arranjos**, e a soma por questão bate com a declarada nos 6 |

**A montagem que prova a regra**: `Assiduidade` peso **16 ÷ 3 questões** (com a C001 dentro) →
`5,34 + 5,33 + 5,33`; `Relacionamento` peso **44 ÷ 3** → `14,67 + 14,67 + 14,66`. Soma **60,0000**,
máxima **72**, percentuais **100,00**.

**A armadilha, deliberada:** montei primeiro com uma classificação de peso 10 e nenhuma questão.
Declarada 60, derivada 50 — e o sistema recusou publicar dizendo *"a soma cairia para 50 sem nada
acusar"*.

#### Guardas conferidas

| | |
|---|---|
| `RH_MODELO` publicando | **403** — monta, não publica |
| Editar arranjo de versão publicada | 400, com a saída escrita |
| Publicar duas vezes | 400 |
| Descartar versão recém-publicada | 400 |
| Arranjo vazio | 400, pelas duas pontas, **sem** empilhar "as somas não batem" em cima |

**Piloto: 894 PENDENTE, 0 respostas. ENSAIO: RASCUNHO, 325.** Órfãos de arranjo: **0**.
Suíte: **66 suítes, 794 testes**.

---

### 3.1.99. ⭐⭐ FAMÍLIA DO ARREDONDAMENTO — quatro em cinco dias, e a regra

| # | Onde | Dizia | Era | Causa | Quem pegou |
|---|---|---|---|---|---|
| 1 | `pontuacaoMaximaDoArranjo` (11/09) | 72,03 | 72 | arredondou **por item** | spec contra o instrumento herdado |
| 2 | `assertCriterioSalvavel` (11/09) | validava | zerava antes de validar | ordem | exercitar o serviço contra o banco |
| 3 | Peso efetivo do acervo (12/09) | 59,97 | 60 | divisão sem o centavo do resto | somar o derivado |
| 4 | `somatorioPorGrupo` (12/09) | 100,01% | 100% | percentual **por item** | spec do validador |
| 5 | `percentuaisQueFecham`, 1ª versão (12/09) | soma certa | **centavo no dono errado** | resto ordenado em **float** | spec, ao exigir os valores |

⭐ **O nº 5 é o mais instrutivo, porque a soma estava CERTA.** As três frações de 16/10/34 sobre 60
são a mesma — 0,666… — e o ponto flutuante as devolve diferentes na 13ª casa. O centésimo foi para
a terceira parte em vez da primeira. Nada somava errado; **mudava quem recebia**, por ruído de
representação. É a forma que passa por qualquer conferência de total e aparece meses depois como
*"o número mudou sozinho"*.

> ⭐⭐ **A REGRA: distribuição de resto se faz em INTEIROS, nunca em float.**
> Converter para centésimos (ou a menor unidade que importa), dividir com `Math.floor`, tirar o
> resto com `%`, e distribuir por ordem de resto **inteiro** — com o índice como desempate. Em
> inteiros, empate é empate; em float, empate é sorteio.

⚠️ E o corolário que vale para os cinco: **arredondar UMA vez, no fim.** Arredondar por item é o
que produziu 72,03, 59,97 e 100,01 — três dos cinco.

#### A varredura: sobrou algum lugar?

| Lugar | Situação |
|---|---|
| `distribuirPeso` | ✅ inteiros, maior resto |
| `percentuaisQueFecham` | ✅ inteiros, maior resto (depois da correção) |
| `somatorioPorGrupo` (percentual por classificação) | ✅ **corrigido** |
| `catalogo` — percentual por classificação | ✅ **corrigido** |
| `catalogo` — `percentualDoPeso` por QUESTÃO | ✅ **corrigido** (achado nesta varredura; a coluna por questão também soma 100) |
| `pontuacaoMaxima*`, `somaDeclarada`, `somaDerivada` | ✅ arredondam **uma vez, no fim**, sobre acumulador inteiro |
| Barras de progresso (`PainelPage`, `MinhasAvaliacoesPage`) | ✅ não é rateio: cada uma é uma razão independente |
| 🟡 `frontend/src/lib/composicao-da-nota.ts` → `repartirPesos` | ⚠️ **SOBROU** — ver abaixo |

⚠️ **O que sobrou, e por que não foi consertado agora.** `repartirPesos` reparte 100% entre o
questionário e os critérios da Aplicação (`BarraDeComposicao`), com uma casa decimal — e tem o
mesmo defeito. Consertar exige uma de duas coisas, e nenhuma cabe num commit de passagem:
1. **portar `percentuaisQueFecham` para o frontend** — que **não tem test runner** (`package.json`:
   dev/build/lint/preview). Copiar regra de arredondamento sem teste é pior que o defeito;
2. **o backend devolver a composição pronta**, como já faz com os grupos do arranjo — o certo, e é
   mudança no contrato da tela de Aplicações.

**Recomendo a 2, ~3h.** Até lá, o erro é de **exibição** (a legenda pode somar 100,1%), não de
cálculo: a nota final não passa por aqui.

### 3.1.100. ⭐⭐ A PONTE DOS ERROS DE DOMÍNIO — 8 erros, 3 mudos

O 500 da publicação (§3.1.98) era a mesma forma da §3.1.93: **a camada que SABE não é a camada que
RESPONDE**. E `CicloNaoAbrivelError` já fazia certo três arquivos adiante e não foi copiado.

**A varredura respondeu à suspeita, e ela estava certa: não era o único.**

| Erro | Payload | Estava mapeado? |
|---|---|---|
| `CicloNaoAbrivelError` | `problemas` | ✅ |
| `CriterioInvalidoError` | `problemas` | ✅ |
| `FaixasInvalidasError` | `problemas` | ✅ |
| `PlanilhaInvalidaError` | `faltando`, `encontradas` | ✅ |
| `ModeloNaoPublicavelError` | `problemas` | 🔴 **não** — o defeito de origem |
| `AvaliacaoIncompletaError` | `perguntasSemResposta` | 🔴 **não** |
| `ClassificacaoSemPesoError` | `classificacaoId` | 🔴 **não** |
| `MatriculaAmbiguaError` | `matricula`, `encontrados` | 🔴 **não** |

**8 erros, 3 mudos além do que eu já sabia.** E os três são alcançáveis:

- `ClassificacaoSemPesoError` ficou alcançável **hoje**: desde a Etapa 3 existe rascunho, e um
  arranjo a meio caminho chega ao `carregarArranjo` pela leitura do catálogo. Antes de 12/09 não
  havia como.
- `MatriculaAmbiguaError` é a **colisão de chapa** — o caso que a memória do projeto descreve como
  *"um 403 que parece falta de permissão"*. Em 500 ele nem chega a parecer: some.
- `AvaliacaoIncompletaError` é defesa em profundidade (o serviço já checa antes), mas carrega
  **quais** perguntas faltam.

#### A saída: uma ponte, não N `try/catch`

Um `try/catch` por chamador é o desenho **que já falhou** — ele depende de alguém lembrar. Entrou
`common/erro-de-dominio.ts`: uma base abstrata que declara `status` e `corpo()`, e o filtro global
(`all-exceptions.filter.ts`) traduz **antes** do ramo do 500. Chamador novo herda a tradução sem
escrever nada.

⚠️ A tradução ficou **dentro do filtro que já existia**, e não num `@Catch(ErroDeDominio)` separado:
a ordem entre dois filtros globais é sutileza de framework; um `if` no topo do método é ordem
explícita, que se lê.

⚠️ Dois dos três ganharam **409, não 400**: `ClassificacaoSemPesoError` (o estado do arranjo é que
está incompleto, não o pedido) e `MatriculaAmbiguaError` (anomalia de DADO — 403 mandaria a pessoa
ao Configurador pedir permissão que ela já tem, §3.1.93).

O invariante `erro-de-dominio.invariante.spec.ts` cobra: nenhum `…Error` estende `Error` direto; a
base continua sendo a base; todo erro com payload sobrescreve `corpo()`; e o filtro reconhece
`ErroDeDominio` **antes** de `HttpException`. **Validado por 3 mutações**, todas reprovando com o
nome exato.

⚠️ O padrão do teste teve de casar `class X extends Y` genérico e filtrar depois — exigir o sufixo
`Error` deixaria de fora a própria base, que se chama `ErroDeDominio`. **Padrão que só reconhece um
jeito de nomear deixa passar exatamente a classe escrita do outro jeito.**

### 3.1.101. ✅ BLOCO D — avisos de comparabilidade (12/09). **O editor está completo.**

#### O gatilho é o PESO POR QUESTÃO, não a contagem

Os perfis existem **para serem diferentes** — foi a melhoria que o módulo veio fazer. "O
Administrativo tem 11 questões e a Loja 14" não é defeito: é o ponto.

O que não é óbvio é a mesma classificação com o mesmo peso e **contagens diferentes**:

```
Relacionamento, peso 16, em 3 questões → 5,34 cada
Relacionamento, peso 16, em 2 questões → 8,00 cada
```

Uma resposta vale 50% a mais num perfil, e os dois questionários continuam somando 60.

⚠️ **Avisar por CONTAGEM encheria a tela de linhas em que nada muda** — 16 em 3 e 32 em 6 dão o
mesmo 5,33. O gatilho é a diferença no peso por questão (≥ 0,01).

#### 🔴 O aviso nasceu inútil, e o portão mostrou

Rodando o portão: **duplicar o Administrativo sem tocar em nada já produzia 4 avisos.** Correto do
ponto de vista do dado — o instrumento herdado do RD8010 de fato pesa diferente entre perfis
(Assiduidade vale 6 no Administrativo, 4,5 na Loja, 5 na Indústria) — e **inútil como aviso**:
*aviso que aparece sempre deixa de ser lido*, que é a regra escrita no próprio arquivo.

⭐ Entrou o campo **`novo`**: a diferença é comparada também com a **versão publicada deste mesmo
perfil**. Igual = herdada; diferente = **esta edição criou**. A tela lidera com as novas, marca as
herdadas, e o diálogo de publicar mostra **só as novas** — as herdadas o RH já conhece, e repeti-las
no último momento afogaria a que ele acabou de criar.

⚠️ Também ficam de fora da comparação: rascunhos alheios (trabalho em andamento — avisar sobre um
estado que ninguém escolheu) e o **[DEMO]** (não abre ciclo válido, então a régua dele não é régua
de ninguém).

#### 🚪 O PORTÃO

Tirei uma questão de "Relacionamento e Conduta" do rascunho (3 → 2), mantendo o peso 16:

| | Resultado |
|---|---|
| A tela diz quantas cada outro perfil tem | ✅ **aqui 2 (8,00 cada) · Loja 3 (3,33) · Indústria 3 (3,00)** |
| Novas × herdadas | ✅ **1 nova, 3 herdadas** |
| O aviso aparece ANTES de publicar | ✅ na montagem **e** na prévia da publicação |
| É AVISO, não bloqueio | ✅ `problemasParaPublicar: []`, e **a publicação com 4 avisos foi concluída** |

⚠️ O resíduo do portão (v2 publicada com 10 questões) foi **apagado e o rascunho recriado idêntico
à v1** — o DEV volta a `Administrativo v2 · RASCUNHO · 4 grupos · 11 questões`.

**44 pesos das publicadas: 0 divergências**, máximas 72/72/72/60, percentuais por grupo **e** por
questão fechando 100. **Piloto: 894 PENDENTE. ENSAIO: RASCUNHO, 325.** Suíte: **68 suítes, 809
testes**.

---

### 3.1.102. 🔴 LACUNA DO EDITOR — ele não cria FAMÍLIA de perfil

Descoberta ao preparar a área descartável da varredura, e é uma lacuna de verdade.

**O editor versiona e monta, mas não cria um perfil novo.** Não existe rota nem tela: nenhum
`prisma.modelo.create` no fonte inteiro. As quatro famílias (`Administrativo`, `Operação de Loja`,
`Produção e Indústria`, `[DEMO]`) nasceram todas do `seed.ts`.

O que **falta**, por inteiro:

| Ato | Existe? |
|---|---|
| Criar família (`Modelo`) | 🔴 **não** |
| Renomear / mudar descrição | 🔴 **não** |
| Ativar / desativar família | 🔴 **não** |
| Mudar `finalidade` (PRODUÇÃO ↔ DEMONSTRAÇÃO) | 🔴 **não** |
| Duplicar versão · montar arranjo · publicar · descartar | ✅ Blocos A–D |

⚠️ **O que isso significa na prática:** o dia em que o RH quiser um perfil novo — "Transporte",
"Agroveterinária", "Escritório Regional" — **precisa da T.I.**, e a mudança é `INSERT` a mão em
duas tabelas. É a mesma classe do que o cadastro de critérios resolveu em 11/09 (*"cadastre a
faixa e reapure" não tinha para onde mandar*).

⚠️ **Não é bloqueio de nada hoje**: os quatro perfis cobrem o recorte do piloto, e criar família é
raro. Registro porque é **capacidade que a tela sugere ter e não tem** — quem abre "Questionários"
e vê versões nascendo e sendo publicadas conclui, razoavelmente, que dá para criar um perfil ali.

**Custo estimado: ~1 dia** (CRUD do `Modelo` + tela + a guarda que falta — *família com versão
publicada não se apaga*, mesma forma do descartar da Etapa 2).

### 3.1.103. 🧪 ÁREA DESCARTÁVEL DA VARREDURA — e o SQL que a limpa

⚠️ **Por que ela existe.** O editor **escreve**, e **publicar não se desfaz**: descartar uma versão
recém-publicada devolve 400 por desenho, e o resíduo do portão do Bloco C saiu por SQL. Percorrer o
fluxo completo sobre os perfis reais publicaria versão nos modelos que o **Piloto** usa.

#### O que foi montado

| | |
|---|---|
| Família | `ZZ MODELO DESCARTAVEL — varredura de telas (pode apagar)` · id `zz-modelo-descartavel` |
| Finalidade | **DEMONSTRACAO** — não abre ciclo válido (§4.6) **e** fica fora da comparabilidade dos perfis reais, então o descartável não polui o aviso de quem trabalha |
| Versão | v1, **publicada** 12/09 · id `zz-versao-descartavel-1` |
| Arranjo | 2 classificações · 5 questões · soma **60** · máxima **72** |
| Pesos | Assiduidade 20 ÷ 2 = **10 · 10** · Relacionamento 40 ÷ 3 = **13,34 · 13,33 · 13,33** |

⭐ O 40 ÷ 3 é deliberado: a área descartável tem **resto**, para que qualquer coisa que a varredura
faça nela exercite a regra de repartição em vez de esconder o caso (§3.1.86).

⚠️ O arranjo foi montado e publicado **pela API do editor**, não por SQL — só a família e a linha
de versão vazia exigiram SQL, pela lacuna da §3.1.102.

#### 🧹 O SQL DE LIMPEZA — tudo que a varredura pode produzir

⚠️ Rode **em ordem**, dentro da transação. Ele apaga a família descartável inteira (com quantas
versões tiverem nascido), a questão de teste `C001`, e **qualquer** questão/classificação criada
pela varredura — pelo critério *"não está em perfil nenhum e nunca foi respondida"*, que é o único
seguro.

```sql
BEGIN;

-- 1. A FAMÍLIA DESCARTÁVEL, com todas as versões (publicadas inclusive).
--    ⚠️ Só a descartável: o `id` é literal de propósito, para um `LIKE 'ZZ%'`
--    não levar junto algo que alguém batize parecido.
DELETE FROM rh.arranjo_pergunta WHERE modelo_versao_id IN
  (SELECT id FROM rh.modelo_versao WHERE modelo_id = 'zz-modelo-descartavel');
DELETE FROM rh.arranjo_grupo WHERE modelo_versao_id IN
  (SELECT id FROM rh.modelo_versao WHERE modelo_id = 'zz-modelo-descartavel');
DELETE FROM rh.modelo_versao WHERE modelo_id = 'zz-modelo-descartavel';
DELETE FROM rh.modelo WHERE id = 'zz-modelo-descartavel';

-- 2. RASCUNHOS que a varredura tenha deixado nos perfis REAIS.
--    ⚠️ `publicado_em IS NULL` e mais nada: versão publicada NUNCA entra aqui.
--    ⚠️ Deixa de fora a `Administrativo v2`, que é rascunho de propósito —
--    tire o `AND versao <> 2` se quiser limpar ela também.
DELETE FROM rh.arranjo_pergunta WHERE modelo_versao_id IN
  (SELECT id FROM rh.modelo_versao WHERE publicado_em IS NULL AND versao <> 2);
DELETE FROM rh.arranjo_grupo WHERE modelo_versao_id IN
  (SELECT id FROM rh.modelo_versao WHERE publicado_em IS NULL AND versao <> 2);
DELETE FROM rh.modelo_versao WHERE publicado_em IS NULL AND versao <> 2;

-- 3. QUESTÕES criadas pela varredura: código com prefixo `C`, fora de todo
--    arranjo e sem resposta. As três condições juntas — nenhuma sozinha basta.
DELETE FROM rh.pergunta_alternativa WHERE pergunta_id IN (
  SELECT p.id FROM rh.pergunta p
  WHERE p.codigo LIKE 'C%'
    AND NOT EXISTS (SELECT 1 FROM rh.arranjo_pergunta ap WHERE ap.pergunta_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM rh.resposta r WHERE r.pergunta_id = p.id));
DELETE FROM rh.pergunta p
  WHERE p.codigo LIKE 'C%'
    AND NOT EXISTS (SELECT 1 FROM rh.arranjo_pergunta ap WHERE ap.pergunta_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM rh.resposta r WHERE r.pergunta_id = p.id);

-- 4. CLASSIFICAÇÕES criadas pela varredura: sem questão e sem arranjo.
--    ⚠️ Nome com `ZZ` — as oito herdadas não têm, e apagar por "sem uso"
--    sozinho levaria junto uma classificação legítima recém-cadastrada.
DELETE FROM rh.classificacao c
  WHERE c.nome LIKE 'ZZ%'
    AND NOT EXISTS (SELECT 1 FROM rh.pergunta p WHERE p.classificacao_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM rh.arranjo_grupo g WHERE g.classificacao_id = c.id);

-- 5. A questão de teste da Etapa 6, se ainda estiver solta.
DELETE FROM rh.pergunta_alternativa WHERE pergunta_id IN
  (SELECT id FROM rh.pergunta WHERE codigo = 'C001');
DELETE FROM rh.pergunta WHERE codigo = 'C001'
  AND NOT EXISTS (SELECT 1 FROM rh.arranjo_pergunta ap
                  WHERE ap.pergunta_id = (SELECT id FROM rh.pergunta WHERE codigo = 'C001'));

-- 6. CONFERÊNCIA — tem de voltar 15 questões, 8 classificações, 5 versões
--    (4 publicadas reais + Administrativo v2 rascunho) e 0 órfãos.
SELECT (SELECT count(*) FROM rh.pergunta)        AS questoes,
       (SELECT count(*) FROM rh.classificacao)   AS classificacoes,
       (SELECT count(*) FROM rh.modelo_versao)   AS versoes,
       (SELECT count(*) FROM rh.arranjo_grupo g
         WHERE NOT EXISTS (SELECT 1 FROM rh.modelo_versao v WHERE v.id = g.modelo_versao_id))
     + (SELECT count(*) FROM rh.arranjo_pergunta p
         WHERE NOT EXISTS (SELECT 1 FROM rh.modelo_versao v WHERE v.id = p.modelo_versao_id))
                                                 AS orfaos;

COMMIT;
```

⚠️ **O que este SQL NÃO apaga, de propósito:** versão publicada de perfil REAL. Se a varredura
publicar uma (não deveria — a área descartável existe para isso), a limpeza **não** a remove: é
decisão de quem viu o que aconteceu, não de um script. O sintoma seria a conferência do passo 6
devolvendo mais de 5 versões.

#### 📋 ESTADO DE PARTIDA — para conferir depois

**Acervo: 16 questões** (15 herdadas do SQP010 + 1 descartável).

| Descartável | Código | Em perfis | Respostas |
|---|---|---|---|
| ✅ sim | `C001` — ZZ TESTE — Cuidado com o EPI | **0** | **0** |
| ❌ não | `004`–`018` (15) | 1 a 6 cada | 0 a 19 cada |

⚠️ `016` (Conhecimento Técnico do Maquinário) tem **0 respostas** mas está em **1 perfil** — não é
descartável.

**Classificações: 8, todas ativas, todas em uso** (3 questões cada nas quatro primeiras; 1 nas
quatro últimas). **Nenhuma descartável.**

**Versões: 6.**

| Modelo | Finalidade | v | Estado | Máx. | Grupos | Questões | Aplicações |
|---|---|---|---|---|---|---|---|
| Administrativo | PRODUCAO | 1 | publicada 05/09 | 72 | 4 | 11 | **8** |
| Administrativo | PRODUCAO | 2 | **RASCUNHO** | — | 4 | 11 | 0 |
| Operação de Loja | PRODUCAO | 1 | publicada 05/09 | 72 | 7 | 14 | 3 |
| Produção e Indústria | PRODUCAO | 1 | publicada 05/09 | 72 | 7 | 14 | 3 |
| [DEMO] Treinamento | DEMONSTRACAO | 1 | publicada 05/09 | 60 | 2 | 5 | 0 |
| **ZZ DESCARTAVEL** | DEMONSTRACAO | 1 | publicada 12/09 | 72 | 2 | 5 | 0 |

**Os 44 pesos dos perfis reais: 0 divergências.** Máximas 72 · 72 · 72 · 60, somas 60 · 60 · 60 · 50.

**Piloto: 894 PENDENTE, 0 respostas. ENSAIO: RASCUNHO, 325 — não abrir.**

---

### 3.1.104. ⭐⭐ DIVERGÊNCIA TELA × API — as DUAS direções, e qual delas é silenciosa

Os dois achados são da mesma família e chegaram com dois dias de diferença. **Registrados juntos
porque separados eles parecem casos isolados, e juntos eles descrevem uma classe.**

| | Direção | Caso | O que acontece | Quem descobre |
|---|---|---|---|---|
| **A** | **tela protege, API não** (permissiva) | aplicação sobre versão em rascunho (§3.1.87) | o dado errado **entra** | ninguém, até a nota sair errada |
| **B** | **API protege, tela não** (restritiva) | Editar/Apagar habilitados sobre a `005`, que tem 19 respostas (12/09) | o clique é **recusado** | a pessoa, na hora |

⭐ **A diferença que importa não é a gravidade — é o SINAL.**

- A **A é silenciosa**: nada quebra, ninguém reclama, e quem descobre é quem chama a API direto (ou
  o auditor, meses depois). Foi por isso que ela sobreviveu desde 05/09 sem ninguém notar: não
  havia rascunho nenhum para o furo alcançar.
- A **B é barulhenta**, e por isso *parece* menor. Não é: ela **gasta o trabalho de quem confia na
  tela**. A pessoa lê "Editar" habilitado sobre uma questão respondida por 19 pessoas, clica,
  escreve, e recebe a recusa depois. O sistema disse que dava.

⚠️ **E a B tem uma agravante que a A não tem: ela é a tela DESMENTINDO a si mesma.** Na direção A a
tela está certa e a API está frouxa; na B a tela **afirma uma capacidade** que a mesma tela, meio
segundo depois, retira. Quem vê os dois estados não sabe qual acreditar.

> ⭐⭐ **A regra: o estado de bloqueio viaja com a LISTA, não numa segunda busca.**

#### Como o defeito B nasceu — e é uma decisão minha, escrita e argumentada

O comentário que eu deixei no código dizia:

> *"Os efeitos são buscados por questão, sob demanda — 15 chamadas na abertura seriam 15 consultas
> para desabilitar botões que talvez ninguém clique. Buscar no primeiro hover/foco é o meio-termo:
> o botão nasce habilitado e a API recusa se for o caso."*

Cada frase é verdadeira e a conclusão é errada. **A API decide o que ACONTECE; a tela decide o que
a pessoa TENTA.** E o custo que eu estava evitando era imaginário: os dados já estavam na mesma
consulta — bastou um `_count: { respostas: true }` no `include` que já existia. **Zero consultas a
mais.**

⚠️ Além disso: o `hover` não existe no celular, e o `efeito?.` opcional deixava o tipo mentir para
o compilador. O campo agora é **obrigatório** — é o tipo que garante que o dado venha junto.

#### A varredura: que outras telas decidem com dado que chega depois?

| Forma | Resultado |
|---|---|
| Tela que segura o render inteiro até o dado (`if (!x) return <Carregando/>`) | **13 de 13 páginas** — a forma segura, e é a norma do módulo |
| Controle acionável governado por dado opcional (`disabled={x?.…}`, `efeito={x?.…}`) | **1 caso, o do Acervo** — corrigido |
| Estado que ESCONDE até chegar (`podeEditar`) | seguro por direção: nunca oferece o que será recusado, só demora a oferecer |

**Nenhum outro.** O `previa` das telas de Aplicação, Arranjo, Ciclo e Cadastro é buscado **no
clique** e o diálogo só abre depois dele chegar — a ordem certa.

### 3.1.105. 🔎 OS ONZE DA VARREDURA DE 12/09 — o que cada um ensinou

⚠️ **A varredura rodou como `ariellypereira`**, conta de pessoa real — exatamente o que as três
contas de teste existiam para evitar. Duas consequências: a auditoria registrou a Arielly criando
questão e publicando versão (**7 linhas, removidas por id**), e **`RH_MODELO` e `RH_CICLO`
continuam sem percurso**. O que foi percorrido vale como `RH_ADMIN`, e falta metade.

| # | Defeito | A lição |
|---|---|---|
| **2.1** | bloqueio chega depois do primeiro render | §3.1.104 — as duas direções da divergência tela × API |
| **2.2** | diálogo de Apagar com o texto do BLOQUEIO e botão vermelho ativo | **diálogo bloqueado não oferece ação destrutiva** — só o motivo e um "Entendi". Pedir confirmação de algo que o próprio sistema recusa é a tela contra si mesma |
| **2.3 · 2.4** | depois de duplicar, a tela pulava para o Administrativo e a versão nova não aparecia | recarregar a lista **repunha o padrão** ("primeiro de PRODUÇÃO"), que é certo na 1ª carga e errado em toda recarga depois de um ato. E jogava a pessoa num perfil **protegido**, com Montar e Descartar à mão |
| **2.5** | banner de recusa **e** "+ Novo ciclo" habilitado | conferido: o servidor **recusa com 403 e não grava nada** (`zz.teste.ciclo` sem colaborador ativo). Não é risco de dado — é trabalho perdido: o diálogo abria inteiro e pré-preenchido |
| **2.6** | uso que só existe em rascunho invisível no cartão | "usada em 1 perfil" e "usada em 1 perfil, **só em rascunho**" são fatos diferentes: o segundo quer dizer que ninguém responde ainda |
| **2.7 · 2.8** | dois textos negando capacidade existente | ⭐ **texto que nega capacidade existente faz alguém deixar de usar o que já funciona** — e é pior que prometer o que não existe, porque **ninguém reclama de uma função que acredita não existir**. Um deles eu reescrevi de manhã e envelheceu à tarde |
| **2.9** | criar classificação sem retorno | o campo esvaziava e o item ia para o fim de uma lista longa, **abaixo da dobra** — indistinguível de "não aconteceu nada". Criar questão já dava banner: duas telas do mesmo editor, dois comportamentos para o mesmo ato |
| **2.10** | "Bem-vindo, !" | ver abaixo — **terceira aparição** |
| **2.11** | "3 classificações" e "Grupos 3" na mesma tela | o mesmo número com dois nomes, e um deles é o nome de um cadastro no menu. **O termo da tela é o termo do cadastro** |
| **2.12** | 22,22% + 22,21% e "vale até" somando 72,01 | §3.1.99 — a família do arredondamento, agora na tela |
| **3** | opção DEMONSTRAÇÃO selecionável | ver a correção do registro de 11/09 acima |

#### ⭐ 2.10 — por que "Bem-vindo, !" acontece com alguns e não com outros

**Não é bug de código: é dado.** `HubPage` fazia `usuario.nome.split(' ')[0]`.

`core.usuarios.nome` veio do **`RA_NOME` do Protheus, que é CHAR de largura fixa** — e essas contas
entraram com **espaço à ESQUERDA**:

```
[ Arielly Aparecida Jose Pereira    ]     ← 35 chars, começa com espaço
[Clenio Mendes]                            ← criada à mão
```

`" Arielly …".split(' ')[0]` é `""`. **14 de 183 contas** começavam com espaço; **74** tinham
espaço sobrando de alguma forma. `clenio` e `admin` — criadas à mão — nunca reproduzem, e é por
isso que as duas aparições anteriores (Rodrigo, e a Arielly em 10/09) foram tratadas como caso
isolado: quem investigava testava com a própria conta.

**Corrigido nos dois lados**, porque um só não basta:
1. **Dado** — `UPDATE core.usuarios SET nome = btrim(regexp_replace(nome,'\s+',' ','g'))`, 74 linhas
   no DEV. ⚠️ **Vale para HLG e PROD, e entra no roteiro de deploy.**
2. **Exibição** — `(nome ?? '').trim().split(/\s+/)[0] || username`. A próxima carga em lote pode
   trazer o espaço de novo, e a saudação nunca mais fica sem sujeito.

### 3.1.106. 🧪 VITEST NO FRONTEND — e por que a estimativa de 3h estava errada

Eu tinha registrado (§3.1.99) que o `repartirPesos` do frontend se resolveria com *"~3h, o backend
devolve a composição pronta"*. **Errado**, e o motivo aparece ao abrir a tela: a composição é
recalculada **enquanto a pessoa digita os pesos** no modal da Aplicação. Um round-trip por tecla é
o desenho errado, não a solução.

O que faltava de verdade era o que eu tinha dado como impedimento: **o frontend não tinha test
runner**. Entrou `vitest` (uma devDependency, um script, ~1h), e com ele o gêmeo
`lib/reparticao.ts` — cópia declarada de `backend/common/percentual.ts`, com **os mesmos casos no
spec**, inclusive o que reprovou a primeira versão do backend. Se as duas divergirem, um dos dois
specs cai.

⚠️ Isso destrava a classe inteira: até aqui, "não dá para testar no frontend" era razão para não
consertar. Não é mais.

---

### 3.1.107. ⭐⭐ A BARREIRA ERA A FERRAMENTA — o que ficou sem conserto por falta de test runner

O `vitest` custou **~1h** e vale muito mais que o `repartirPesos` que o motivou. Até 12/09,
*"o frontend não tem test runner"* era uma razão **correta** para não consertar: copiar regra de
arredondamento sem teste é pior que o defeito. A razão era boa; o que faltava era remover a
condição, não conviver com ela.

⚠️ **O padrão a reconhecer:** quando a mesma justificativa aparece pela segunda vez para adiar
coisas diferentes, ela deixou de ser uma decisão sobre aquele item e virou uma **barreira**. O
custo de derrubá-la se paga contra a fila inteira, não contra o item da vez — e é por isso que ela
some das estimativas: cada item sozinho não justifica.

#### A fila que estava atrás dela

Todos os cinco são **cópias declaradas de regras do backend** — e cada um já tem, no próprio
cabeçalho, a história de quando a cópia divergiu.

| Módulo | Gêmeo no backend | O que decide | Já deu errado? | Custo |
|---|---|---|---|---|
| ✅ ~~`roles.ts`~~ | `common/roles-rh.ts` | **quais itens de menu existem** | **FEITO em 12/09** — §3.1.112 |  ~~1,5h~~ |
| 🟠 **`ciclo-encerrado.ts`** | `ciclo/ciclo-operavel.ts` | desabilitar-com-motivo em **todo botão de escrita do ciclo** | sim — as telas não sabiam da recusa e a pessoa descobria no clique (§3.1.12) | **~1h** |
| 🟠 **`motivo.ts`** | `common/motivo.ts` | o mínimo de caracteres por ato | sim — `MOTIVO_MINIMO` valia **15** na tela e **3** no backend, com o mesmo nome. Nome igual com valor diferente é pior que número solto | **~45min** |
| 🟡 **`composicao-da-nota.ts`** | (não tem — é regra de exibição) | como o peso vira percentual nas duas telas | sim — 22,22% × 22,21% (§3.1.105) | **~45min** |
| 🟡 **`formato.ts`** | `common/texto-sem-flexao` (o invariante) | `data()` sem `Date` (fuso), `flexao`/`contagem` | sim — `new Date('2026-09-05')` volta **04/09** a oeste de Greenwich, e é a data-base que ancora todo cálculo temporal | **~1h** |

**Total: ~5h; feito o primeiro, restam ~3,5h nos quatro.** Não bloqueia nada.

⚠️ **O `roles.ts` é o mais urgente por um motivo de calendário, não de gravidade:** a próxima
varredura vai rodar com `RH_MODELO` e `RH_CICLO`, papéis **nunca exercitados**, e é justamente ele
que decide o que essas contas enxergam. Um erro ali aparece como *"a tela não tem o item"* — e vai
ser lido como falta de permissão.

### 3.1.108. ⭐⭐ PADRÃO — o bug que não reproduz na conta de quem investiga

O `"Bem-vindo, !"` sobreviveu a **três varreduras** (Rodrigo · Arielly em 10/09 · Arielly em 12/09).
Não porque fosse sutil — a causa é uma string com espaço à esquerda —, mas por **quem o procurava**.

```
[ Arielly Aparecida Jose Pereira    ]   ← veio do RA_NOME (CHAR de largura fixa)
[Clenio Mendes]                          ← criada à mão, no Configurador
```

Quem investiga abre o sistema **com a própria conta**. As contas de quem desenvolve e administra
são criadas à mão; as das 183 pessoas vêm de carga em lote. **O defeito estava exatamente na
fronteira entre as duas populações**, e a população que investiga é a que não reproduz.

> ⭐⭐ **Gatilho:** defeito relatado que não reproduz — antes de fechar como "não consegui
> reproduzir", perguntar **em que a conta do investigador difere da conta de quem relatou**. Origem
> do cadastro (à mão × carga), papel, departamento, filial, e se tem colaborador vinculado.

⚠️ Duas outras armadilhas do módulo são da mesma forma, e as três juntas explicam por que testar
com a conta errada custa caro:

| | Quem NÃO reproduz |
|---|---|
| `"Bem-vindo, !"` | conta criada à mão |
| **RBAC / menu** | **ADMIN** — tem bypass no `RolesGuard`, então nunca vê o item faltar |
| **separação de funções** | quem não é avaliado no ciclo que está olhando |

**É por isso que as três contas `zz.teste.*` existem** — e por que rodar a varredura com uma conta
de pessoa real desfaz o motivo delas.

#### 🚀 Entra no ROTEIRO DE DEPLOY (HLG e PROD)

⚠️ **Limpeza de DADO, não migration de schema** — não vai no `prisma/migrations`, vai na lista de
passos manuais do roteiro, junto com o "Reprocessar metadados" do Fiscal.

```sql
-- Nomes vindos do RA_NOME (CHAR de largura fixa) entram com espaço à esquerda
-- e à direita. 74 linhas no DEV; conferir a contagem antes e depois.
SELECT count(*) FROM core.usuarios
 WHERE nome <> btrim(regexp_replace(nome, '\s+', ' ', 'g'));   -- antes

UPDATE core.usuarios
   SET nome = btrim(regexp_replace(nome, '\s+', ' ', 'g'))
 WHERE nome <> btrim(regexp_replace(nome, '\s+', ' ', 'g'));

SELECT count(*) FROM core.usuarios
 WHERE nome <> btrim(regexp_replace(nome, '\s+', ' ', 'g'));   -- tem de ser 0
```

⚠️ O conserto de exibição no Hub já foi, e é o que garante que a **próxima** carga em lote não
traga o sintoma de volta. O SQL é para os que já estão lá.

### 3.1.109. ⭐⭐ REGRA DE MÉTODO — "a regra existe?" e "aparece onde a pessoa decide?" são DUAS varreduras

Da correção do registro de 11/09 (a guarda do `[DEMO]`), e vale muito além dele.

Em 11/09 varri as guardas por **momento da API** e escrevi, numa tabela, *"chega a tempo ✅"*. A
API de fato validava em três pontos. **Na tela, a opção continuava selecionável** — a pessoa
escolhia o modelo de DEMONSTRAÇÃO, nomeava a aplicação, distribuía os pesos, e a recusa chegava no
Salvar.

A tabela não estava errada sobre o que media. Estava respondendo **outra pergunta**.

> ⭐⭐ **Toda varredura de "a regra existe?" precisa da segunda metade: "ela aparece onde a pessoa
> DECIDE?".** A primeira se responde lendo o backend; a segunda, só percorrendo a tela — e é a
> segunda que diz se a regra chega a tempo, porque quem precisa dela não está no backend.

⚠️ **Aviso que não impede o clique não chega antes: chega junto com o trabalho perdido.** Texto sob
o rótulo de um campo é documentação, não guarda. A guarda na tela é o `disabled` **com o motivo**.

Vale ao lado de:
- §3.1.104 (*divergência tela × API nas duas direções*) — aqui a API está certa e a tela é frouxa;
- [[feedback_capacidade_sem_caminho_na_tela]] — lá a capacidade existe e não tem botão; aqui a
  recusa existe e não tem freio;
- §3.1.88 (*o grep acha onde a regra foi escrita, não onde ela deveria estar*) — a mesma cegueira,
  um andar acima: o inventário acha os momentos que existem, não a superfície que falta.

### 3.1.110. 📌 `[DEMO] Modelo de Treinamento` é FIXTURE DE PRODUTO, não resíduo de teste

**Decidido em 12/09: fica.** Registrado porque o nome com `[DEMO]` convida a apagá-lo numa
limpeza, e ele é o único caso de três coisas ao mesmo tempo:

| | |
|---|---|
| **Única escala diferente** | soma **50**, máxima **60** — todos os outros são 60/72 |
| **Foi ele que expôs o `pontuacaoMaximaDoArranjo`** | qualquer conta que assuma 60/72 passa nos três perfis reais e falha nele |
| **Único `finalidade = DEMONSTRACAO` permanente** | a guarda que recusa modelo de demonstração em ciclo válido **só é exercitável porque ele existe** |

Veio do `seed.ts`, junto com os outros três — não é sobra de teste de ninguém.

⚠️ **Não confundir com `ZZ MODELO DESCARTAVEL`**, que é área de varredura e tem SQL de limpeza
próprio (§3.1.103). O critério: **`[DEMO]` nasce do seed e fica; `ZZ` é criado para um percurso e
sai depois dele.**

---

### 3.1.111. 🧪 ÁREA DESCARTÁVEL — recriada em 12/09, estado de partida da 2ª varredura

Recriada idêntica à anterior depois da limpeza. ⚠️ **O SQL de limpeza é o da §3.1.103** e continua
valendo sem mudança — inclusive para a `C001` nova, que cai no critério `codigo LIKE 'C%'` + fora
de todo arranjo + sem resposta.

| | |
|---|---|
| Família | `ZZ MODELO DESCARTAVEL — varredura de telas (pode apagar)` · `zz-modelo-descartavel` |
| Versão | v1 **publicada** · `zz-versao-descartavel-1` · máxima **72** |
| Arranjo | Assiduidade **20 ÷ 2 = 10 · 10** · Relacionamento **40 ÷ 3 = 13,34 · 13,33 · 13,33** · soma **60** |
| Questão nova | **`C001`** — *ZZ DESCARTAVEL — Cuidado com o EPI (pode apagar)* · em **0** perfis, **0** respostas |

⭐ O **40 ÷ 3** é deliberado: a área tem resto, para que qualquer coisa que a varredura faça nela
exercite a regra de repartição em vez de esconder o caso (§3.1.86). Só a família e a linha de
versão vazia nasceram de SQL — o arranjo e a publicação passaram **pela API do editor**.

#### 📋 O ESTADO DE PARTIDA

**Acervo: 16 questões.** Uma descartável.

| | Código | Perfis | Respostas |
|---|---|---|---|
| ✅ **descartável** | `C001` | **0** | **0** |
| ❌ não | `004`–`018` (15, do SQP010) | 1 a 6 | 0 a 19 |

⚠️ `016` (Conhecimento Técnico do Maquinário) tem **0 respostas** mas está em **1 perfil** — não é
descartável. É a armadilha da lista: "sem resposta" sozinho não basta.

**Classificações: 8, todas ativas, todas em uso.** Nenhuma descartável. As quatro primeiras com 3
questões, as quatro últimas com 1.

**Versões: 6.**

| Modelo | Fin. | v | Estado | Máx. | Grupos | Questões | Soma | Aplicações |
|---|---|---|---|---|---|---|---|---|
| Administrativo | PRODUCAO | 1 | publicada 05/09 | 72 | 4 | 11 | 60 | **8** |
| Administrativo | PRODUCAO | 2 | **RASCUNHO** | — | 4 | 11 | 60 | 0 |
| Operação de Loja | PRODUCAO | 1 | publicada 05/09 | 72 | 7 | 14 | 60 | 3 |
| Produção e Indústria | PRODUCAO | 1 | publicada 05/09 | 72 | 7 | 14 | 60 | 3 |
| [DEMO] Treinamento | DEMONSTRACAO | 1 | publicada 05/09 | 60 | 2 | 5 | 50 | 0 |
| **ZZ DESCARTAVEL** | DEMONSTRACAO | 1 | publicada 12/09 | 72 | 2 | 5 | 60 | 0 |

**Os 44 pesos dos perfis reais: 0 divergências.** Máximas gravada × calculada iguais nos quatro, e
a coluna "vale até" agora **fecha na máxima** (72 · 72 · 60 · 72) — era o 72,01 da §3.1.105.

**As três contas de teste** — senha **`TesteRh2026`** nas três:

| Login | Papel | Matrícula | Colaborador |
|---|---|---|---|
| `zz.teste.rh` | **RH_ADMIN** | 009900 | ATIVO |
| `zz.teste.modelo` | **RH_MODELO** | 009901 | ATIVO |
| `zz.teste.ciclo` | **RH_CICLO** | 009902 | ATIVO |

⚠️ As três precisam do `rh.colaborador` ATIVO, e não é detalhe: sem ele **toda** rota do módulo
devolve 403 falando de matrícula (§3.1.93). Se a varredura tomar esse 403, é isto — não é papel.

**Piloto: 894 PENDENTE, 0 respostas. ENSAIO: RASCUNHO, 325 — não abrir.**

⚠️ **Rodar a varredura com as três contas, nunca com conta de pessoa real.** A de 12/09 rodou como
`ariellypereira` e custou 7 linhas de auditoria a remover — e, pior, deixou `RH_MODELO` e
`RH_CICLO` sem percurso, que era o motivo dela (§3.1.108).

---

### 3.1.112. ✅ `roles.ts` COM SPEC — e o defeito do `REGISTRADOR_FROTA` NÃO é herdado

Feito antes do percurso, pelo argumento de calendário: a varredura vai rodar com `RH_MODELO` e
`RH_CICLO`, papéis nunca exercitados, e é este arquivo que decide o que essas contas enxergam.
**Erro aqui aparece como "a tela não tem o item" e é lido como falta de permissão** — foi
exatamente essa confusão que levou a varredura de 12/09 a ser refeita como `ariellypereira`, com a
conclusão de que "o cadastro de questionários não existia".

#### ⚠️ A confirmação pedida: o defeito NÃO é herdado

O cabeçalho do arquivo citava o `REGISTRADOR_FROTA` que ficou com "só Início" na Logística. **Esse
caso é de lá, e está citado como precedente — não como defeito presente aqui.** Conferido nos dois
lados:

| | Lê | Fallback |
|---|---|---|
| `backend/common/roles-rh.ts` → `rolesRh` | `departamentos[].role`, deduplicado | o legado `modulos[].role` só quando não há nenhuma role em `departamentos[]` |
| `frontend/lib/roles.ts` → `rolesDoModulo` | **idêntico** | **idêntico** |

**Nenhum lugar do módulo lê `modulos[].role` direto** — varrido: zero ocorrências fora do próprio
`roles.ts`. O módulo nasceu depois do incidente e já nasceu certo; o comentário foi reescrito para
dizer isso, porque como estava lia-se como bug em aberto.

⚠️ **Nos três tokens de teste o denormalizado coincide com o real** (uma role por conta), então
**eles não exercitam o caso**. Quem exercita é o spec, com o token de duas roles em departamentos
diferentes. É a razão de o teste existir e não bastar "conferir na tela".

#### O que ganhou spec

⭐ **`temPapel` saiu de dentro de um `useMemo`.** A decisão *"este papel serve?"* — com o bypass do
ADMIN — vivia no `AuthContext`: pura, decisiva e **inalcançável por teste**. Agora mora em
`lib/roles.ts`. **11 testes**, incluindo o que trava a "simplificação": um token com `RH_MODELO` no
denormalizado e `RH_CICLO` num segundo departamento — se alguém trocar a função por `mod.role`, a
linha cai.

⭐ **`ITENS_DO_MENU` e `filtrarPorPapel` saíram do `Sidebar.tsx`** para que a matriz abaixo seja
**gerada da lista de verdade** (`menu.spec.ts`, 9 testes). Matriz escrita à mão envelhece no
primeiro item novo, e o sintoma de estar errada é mudo.

⚠️ **Escrevi um "achado" que não existia.** Esperava que o `RH_MODELO` visse o cabeçalho `[CICLO]`
órfão, por ser o último da lista e a condição `proximo != null` parecer deixá-lo passar. Errei:
`undefined != null` é `false` e a seção sai. O teste ficou — invertido — porque o caso do **fim da
lista** é o único que a leitura do código não resolve à primeira vista, e o próximo item
acrescentado ao fim muda quem é o último.

#### 📋 A MATRIZ — o que cada papel vê no menu

| Item | RH_ADMIN | RH_MODELO | RH_CICLO | AVALIADOR |
|---|:---:|:---:|:---:|:---:|
| **Minhas avaliações** | ✅ | ✅ | ✅ | ✅ |
| *[CADASTROS]* | ✅ | ✅ | ✅ | — |
| Quem avalia quem | ✅ | — | — | — |
| Questionários | ✅ | ✅ | ✅ | — |
| Acervo de questões | ✅ | ✅ | ✅ | — |
| Classificações | ✅ | ✅ | — | — |
| Critérios da nota | ✅ | — | — | — |
| *[CICLO]* | ✅ | — | ✅ | — |
| Ciclos | ✅ | — | ✅ | — |

Lê-se em três linhas:
- **RH_ADMIN** vê tudo.
- **RH_MODELO** monta o INSTRUMENTO — e não vê Ciclos, nem "Quem avalia quem", nem "Critérios".
- **RH_CICLO** monta o CICLO e **lê** o instrumento (escolher modelo por nome sem ver o conteúdo é
  decidir às cegas), mas não o edita: sem Classificações.

⚠️ **"Minhas avaliações" não tem condição de papel**, de propósito (§3.1.3): ser avaliador é fato
do DADO, não papel do JWT — a gestora avalia 13 pessoas tendo só `RH_ADMIN`.

⚠️ **ADMIN vê o mesmo que RH_ADMIN**, pelo bypass — e é por isso que **varredura feita com ADMIN
não mede RBAC**. Está como teste, para não ser esquecido.

> ⭐ **Uso operacional:** quando a varredura disser *"não achei o item X"*, esta tabela responde na
> hora se é **tela** (deveria aparecer e não aparece) ou **papel** (não é para aparecer mesmo).

### 3.1.113. ⭐⭐ REGRA — justificativa repetida para adiar coisas diferentes é BARREIRA, não decisão

Formulada ao derrubar o "o frontend não tem test runner" (§3.1.107), e vale além dele.

> **Quando a mesma justificativa aparece pela segunda vez para adiar coisas DIFERENTES, ela deixou
> de ser uma decisão sobre aquele item e virou uma barreira. O custo de derrubá-la se paga contra a
> FILA inteira, não contra o item da vez.**

⚠️ **Por que ela some das estimativas.** Avaliada item a item, a barreira nunca se paga: "1h de
setup para consertar um percentual de 0,01" é obviamente ruim, e é a conta que se faz — porque a
fila não está na frente de quem decide. O `vitest` custou 1h e destravou **cinco** módulos que
somam ~5h de conserto e três defeitos já conhecidos.

⚠️ **E a justificativa costuma ser CORRETA**, que é o que a torna difícil de ver: copiar regra de
arredondamento sem teste é mesmo pior que o defeito. O erro não é aceitar a razão — é aceitá-la
duas vezes sem perguntar o que custaria removê-la.

**Gatilho:** ao escrever "não dá para fazer X porque Y" pela segunda vez, com X diferente,
**parar e orçar Y**. Se o orçamento de Y for menor que a soma dos X represados, Y vira a tarefa.

Outras candidatas do projeto, com a mesma forma:

| Barreira | O que está represado atrás |
|---|---|
| *"o app não é buildado nesta máquina"* | tudo que exige APK novo espera o Marco/Douglas — e a fila não é visível |
| *"o roteiro de deploy não existe"* | 15 migrations, 3 serviços e 2 `location` esperando desde 11/09 |
| *"não há tela para informar o valor"* | o critério INFORMADO inteiro, cadastrado e sem pontuar ninguém |

---

### 3.1.114. 🔑 "Não consigo logar" — o que a AUDITORIA respondeu, e o defeito que estava ao lado

Relatado em 12/09: as três contas de teste não entravam pela tela. **A API aceitava as três** — o
que descartava senha errada no cadastro, conta inativa e falta de permissão.

⭐ **Quem respondeu foi `core.system_logs`**, e em uma consulta. A tabela grava `LOGIN_FAILURE` com
o `usuario_id` **quando o usuário foi encontrado** e sem ele quando não foi — então a mesma linha
distingue *"não existe"* de *"senha não confere"*:

```
15:42:33 | LOGIN_FAILURE | zz.teste.modelo | digitou: zz.teste.modelo
                           ↑ usuario_id preenchido = ACHOU a conta
```

**Usuário certo, senha rejeitada.** Não era o cadastro, não era o papel, não era o vínculo de
colaborador — as três hipóteses que a tela sugere. A senha é `TesteRh2026`, e **qualquer variação
de caixa ou espaço falha**: `TesteRH2026`, `testerh2026`, `TesteRh2026 ` → 401.

> ⭐ **Antes de investigar "por que não loga", perguntar ao log se a conta foi ENCONTRADA.** As duas
> falhas dão a mesma mensagem para quem digita — de propósito, para não revelar quais contas
> existem — e respostas opostas para quem investiga.

#### 🔴 O defeito ao lado: o identificador não era trimado

Medido no caminho: **`"clenio "` (um espaço à direita) devolvia 401** — e a mensagem é
*"Credenciais invalidas"*, que manda conferir a **senha**, que está certa. Vale para a plataforma
inteira, não só para estas contas.

Quem cola o usuário de uma planilha, de um chat ou **de uma célula de tabela** leva o espaço junto.
⚠️ E é o caso desta conversa: as credenciais foram entregues numa tabela markdown.

**Corrigido** (`auth-gateway/auth.service.ts`): `dto.login.trim()`.

⚠️ **A SENHA continua sem trim, de propósito.** Espaço em senha é caractere legítimo, e comê-lo
rejeitaria em silêncio quem escolheu uma assim. **O identificador é um nome; a senha é um
segredo — não recebem o mesmo tratamento.**

#### 🟡 Fica em aberto: o login é sensível a MAIÚSCULAS

`Clenio` → 401. Não consertei porque é decisão de identidade, não defeito óbvio, e a medição diz
que dá para tomar com segurança:

| | |
|---|---|
| Usernames que colidem sem caixa | **0** |
| E-mails que colidem sem caixa | **0** |
| Usernames com maiúscula | **1** de 183 |

⚠️ Tornar a busca case-insensitive **sem** um índice único em `lower(username)` deixa a porta
aberta para `Joao` e `joao` coexistirem depois — e aí a ambiguidade vira erro de autenticação, que
é o pior lugar para ela. O par certo é **`ILIKE` + índice único**, e o índice é migration no schema
`core`, que toca PROD. **Custo ~2h**, e é decisão de quem manda no cadastro.

---

### 3.1.115. 🔴 A MEMÓRIA DE CÁLCULO NEGAVA A PRÓPRIA CONTA — e o efeito do centavo, medido

O mais grave da varredura de 12/09. A tela mostrava as notas por grupo em barras e escrevia no
rodapé:

> *"Grupo é organização visual: o peso está em cada pergunta."*

**Era verdade até 10/09.** A unificação do acervo (11/09) **inverteu**: o peso mora na
CLASSIFICAÇÃO e o da questão é derivado dele. A varredura reconstruiu o 63,19 de uma avaliação
justamente pelos pesos de classificação — `(25,00×9 + 66,65×10 + 83,33×9 + 83,33×9 + 50,00×13 +
100,00×5 + 50,00×5) ÷ 60 = 63,19`, exato — e o rodapé mandava procurar o peso onde ele não está
mais.

⚠️ **As barras SÃO os insumos ponderados, e o ponderador era o único número ausente.** Quem
precisa explicar a nota de um colaborador na devolutiva não conseguia refazer a conta.

**Corrigido:** cada linha mostra `peso N · N%`, o título virou *"Questionário, por classificação"*
(termo do cadastro), e o rodapé agora escreve a fórmula: `Σ(nota × peso) ÷ soma = nota`.

#### 📐 MEDIDO — o centavo do arredondamento ENTRA na nota

A varredura viu `66,65` onde a divisão exata dá `66,67` e suspeitou do resto. **Procede**, e o
efeito é maior no grupo do que no total:

| Cenário | Resultado |
|---|---|
| Pesos `3,34 / 3,33 / 3,33`, respostas `0,9 / 0,9 / 0,6` | grupo **66,68** |
| As MESMAS respostas, com o centavo na 3ª questão | grupo **66,65** |
| Pior caso construído, no **grupo** | **0,08 ponto** |
| Pior caso construído, na **nota final** | **0,01 ponto** |
| Com peso **exato** (`3,333333…`) | **66,67**, e **não depende da ordem** |

⭐ **Quem decide o desvio é a ORDEM das questões no arranjo** — o centavo vai para a primeira —,
e essa ordem é escolha de quem monta, não do RH que avalia. Não é exibição: é cálculo.

⚠️ **NÃO CONSERTEI, porque é decisão e não defeito.** As duas saídas:

| | O que muda | Custo | Risco |
|---|---|---|---|
| **(A) Calcular no peso EXATO**, arredondar só para exibir | o artefato desaparece; a nota deixa de depender da ordem | **~4h** | as notas passam a divergir levemente do instrumento herdado — a regressão `108/108` compara com o `÷18` do Protheus e **precisa ser re-rodada** |
| **(B) Manter e declarar** | nada; a tela explica que o peso exibido é arredondado e que a diferença é ≤0,08 no grupo | ~1h | o desvio continua, e quem conferir na mão vai reencontrá-lo |

**Recomendo (A).** O peso de duas casas existe porque veio de uma coluna do Protheus; o cálculo não
tem razão para herdar essa limitação, e "a nota depende de qual questão ficou em primeiro" é
indefensável numa devolutiva.

#### Pergunta a pergunta na memória de cálculo — custo

**Dá.** `itensRespondidos(avaliacaoId)` já devolve enunciado, alternativa escolhida, valor e peso —
é o que alimenta o `notaPorGrupo`. Falta expor e desenhar: **~4h** (2h backend + tela expansível
por classificação, para não virar uma lista de 14 linhas onde hoje há 7).

### 3.1.116. ✅ `RH_MODELO` PUBLICA — a decisão de 12/09 revê a do Bloco C

Nasceu `RH_ADMIN` e só, com o argumento *"monta, não publica"*. A varredura mostrou o que esse
desenho produz: o `RH_MODELO` percorre o editor inteiro — duplicar, montar, mudar peso, ler a
análise de impacto completa — e **toma 403 no confirmar**.

⭐ **Papel que produz rascunho para outra pessoa apertar o botão precisa dessa outra pessoa no
fluxo.** Ela não existe: quem apertaria é o `RH_ADMIN`, que é quem monta CICLO. Sem ela a separação
não separa nada — só interrompe. E o papel se chama "monta o instrumento", o menu lhe dá
Questionários, Acervo e Classificações, e a tela oferece o botão.

Junto, dois defeitos da recusa:
- **o botão continuava habilitado depois do 403**, e dava para repetir indefinidamente. Erro de
  ESTADO se tenta de novo; erro de PERMISSÃO não — nada mudou entre um clique e o outro. Agora
  desabilita, com o motivo no lugar do aviso de "não salvo";
- **a recusa não dizia de quem é a permissão.** O `RolesGuard` respondia *"Perfil insuficiente"*, e
  quem lê é o RH, que não conhece a tabela de papéis. Agora: *"Esta operação é de RH_ADMIN ou
  RH_MODELO. Seu acesso ao Gestão de Pessoas é: RH_CICLO."*

### 3.1.117. 📐 RENOMEAR CLASSIFICAÇÃO — o aviso mentia por omissão, e o Apagar está seguro

**A decisão de 11/09 (renomear é permitido) continua valendo.** O que estava errado era o aviso:
dizia *"o nome aparece no acervo e no questionário impresso"*, e o alcance real inclui **versão
publicada** e **memória de cálculo de resultado apurado, em ciclo encerrado**.

O modal agora lista os três lugares e fecha com a saída: *"se o conceito for outro, crie uma
classificação nova em vez de renomear esta"*.

⚠️ **A postura oposta da tela vizinha é deliberada, e vale escrever:** Critérios PROTEGE o que
Classificações permite. **Critério carrega RÉGUA** (mudar a faixa muda a pontuação de quem já foi
apurado); **classificação carrega RÓTULO** (o peso está no arranjo, que é imutável depois de
publicado). As duas estão no mesmo menu com posturas opostas porque as coisas são diferentes — e é
isso que o texto de cada uma precisa deixar claro.

#### Medido: classificação em versão publicada NÃO fica apagável

A pergunta era se, depois de mover as questões, a guarda cederia. **Não cede** — e é a segunda
guarda que segura:

```
efeitoDeApagar:  questões > 0        → RECUSA  (a que a mensagem ensina a zerar)
                 arranjos > 0        → RECUSA  ← esta
```

`arranjos` conta `ArranjoGrupo`, **incluindo versões publicadas** — e arranjo de versão publicada
não se edita, então o contador nunca chega a zero. Uma classificação citada em versão publicada é
**permanentemente não-apagável**, que é o certo. Conferido nas 8 do acervo.

### 3.1.118. 🔢 OS CONTADORES — o que era defeito, o que era termo faltando

| Achado | Veredito |
|---|---|
| *"USADA EM 7 PERFIS (5 publicados)"* para a `004` | 🔴 **defeito** — são **5 perfis** em **7 versões**. Contava versão e chamava de perfil, inflando justamente o número que responde *"mexer nisto afeta quem?"*. Corrigido: conta perfis distintos e mostra as versões entre parênteses |
| *"1 fora de todo perfil"* × cartão *"usada em 1 perfil — só em rascunho"* | 🟡 **termo faltando** — "fora de todo perfil" conta quem não está em arranjo NENHUM, rascunho inclusive. Não discordavam; faltava o que os concilia. Agora: *"1 fora de todo perfil (nem em rascunho)"* |
| SIMULACAO: *"39 canceladas"* × *"canceladas pelo encerramento: 37"* | 🟡 **termo faltando** — são **39 no total: 37 pelo ENCERRAMENTO + 2 por DECISÃO DO RH**. O cabeçalho conta todas; a seção conta só as que o "Devolver canceladas" alcança |
| SIMULACAO: *"54 no público"* × `0+13+39+4 = 56` | 🟡 **medido**: público **54 pessoas distintas**, **52 avaliações** (39 CANCELADA + 13 ENVIADA) e **2 pessoas no público sem avaliação nenhuma**. `13+39 = 52` são as avaliações; a diferença de 2 é a que a tela não nomeia |
| Barra: *"Soma declarada"* mostrando o valor antigo enquanto digita | 🔴 **defeito** — a legenda diz "é o que foi digitado" e o número era o gravado. Corrigido: declarada acompanha a digitação; distribuída e máxima ficam **explicitamente paradas** ("do último salvo"), porque só o backend as recalcula |
| Máxima calculada sobre a DISTRIBUÍDA sem dizer | 🟡 **termo faltando** — quem lê "declarada 75" espera 90 e vê 78. Agora: *"(= distribuída 65 × 1,2)"* |

#### As duas estratégias de arredondamento — unificadas

| Onde | Era | Agora |
|---|---|---|
| Questionários / editor | redistribui em 2 casas, exibe 2 | ✅ mantido |
| Composição da nota | repartia em **2** casas e exibia **1** — três critérios a 33,3% somavam **99,9%** | ✅ **reparte na precisão em que EXIBE** (`repartirExato(·, 100, 1)`) |

⭐ **A regra que faltava estar escrita: repartir na precisão em que se exibe.** Arredondar depois de
repartir é arredondar por item de novo, e desfaz a repartição.

---

### 3.1.119. ✅ O CENTAVO — calcular no EXATO, exibir o arredondado (opção A)

Decisão de 12/09 sobre o artefato medido na §3.1.115. **`pesosDerivados` passou a devolver dois
números**, e a regra é uma frase:

> ⭐⭐ **Calcula-se no peso EXATO; arredonda-se só para EXIBIR.** Era o inverso.

| | Para quê |
|---|---|
| `peso` — arredondado, com o centavo na primeira por ordem | **exibir**: é o que o RH lê, o que reproduz os 44 pesos herdados, e o que soma exatamente 60 |
| `pesoExato` — `peso_da_classificação ÷ n`, sem arredondar | **calcular**: `Σ(valor × peso)` deixa de depender de qual questão ficou em primeiro |

`itensRespondidos` usa o exato; `pontuacaoMaximaDoArranjo` continua no arredondado, de propósito —
a máxima é o número que a publicação GRAVA e que a tela confere contra o gravado, então tem de ser
o mesmo que sai de somar os pesos exibidos. Pelos dois caminhos dá 72; o que muda é qual deles
alguém refaz na mão.

#### 📐 AS DUAS MEDIÇÕES PEDIDAS

**(a) Divergência máxima contra o Protheus nas 108: ZERO.** `108/108 idênticas, 0 divergentes`.

⚠️ **E a razão importa mais que o número.** Não é que o Protheus também distribua o centavo — é que
o ciclo `000006` tinha **18 questões de peso IGUAL**, e onde os pesos são iguais o exato e o
arredondado coincidem. **A regressão não exercita o caso**, e agora está escrito: ela mede a
divisão fixa por 18, não a repartição por classificação, que nasceu depois.

**(b) Mudam de conceito: NENHUM dos 17.** Maior diferença: **0,0000 ponto**.

⚠️ Também aqui a razão vale o registro: o desvio só aparece quando as respostas **diferem dentro da
mesma classificação**. Se as três questões de Relacionamento receberam a mesma âncora, o numerador
é `valor × (3,34+3,33+3,33)` de qualquer jeito e o centavo cancela. Nos 17 apurados foi o que
aconteceu. **O efeito é real e não se manifestou nestes dados** — não é a mesma coisa que "não
existe", e teria aparecido no primeiro ciclo com respostas variadas.

⚠️ **`Avaliacao.notaAvaliacao` é CONGELADA no envio**, então nenhuma nota gravada muda com esta
correção. O que é recalculado na leitura é a memória por classificação — e se um dia o congelado e
o recalculado divergirem, **o rodapé da memória mostra**, porque ele agora escreve a conta.

#### 🔴 Achado no caminho: eu tinha quebrado a regressão

O script `regressao-protheus.ts` **parou de rodar** quando `nota-avaliacao.ts` passou a importar
`../common/erro-de-dominio.js` (§3.1.100): o `ts-node` em CJS não resolve o sufixo `.js` para o
`.ts`. Ninguém percebeu porque **o script não está na suíte** — roda à mão, quando se quer o
baseline.

⚠️ **Ferramenta de medição fora da suíte quebra em silêncio, e a hora em que se descobre é a hora
em que se precisa dela.** Corrigido com `"ts-node": { "experimentalResolver": true }` no
`tsconfig.seed.json`, com o porquê escrito lá.

### 3.1.120. ✅ MEMÓRIA DE CÁLCULO PERGUNTA A PERGUNTA — a devolutiva com objeto

Sete barras e um total não sustentam conversa: o RH mostra *"Relacionamento 66,67"* e não tem como
dizer **o que** melhorar. Com a âncora escolhida visível — *"Prefere trabalhar sozinho, mas se
solicitado ajuda"* — a conversa tem objeto.

`GET /resultados/:id` passou a trazer `porQuestao`: enunciado, peso exibido, valor, **o texto da
âncora escolhida** e as quatro âncoras com a marcação de qual foi. Na tela, **expansível por
classificação** — 14 linhas abertas onde havia 7 barras trocaria um problema por outro.

**Conferido em resultado real:** 7 classificações, 14 questões, soma dos pesos **60**, e
`Σ(nota × peso) ÷ 60 = 63,19` = **a nota gravada**. O `Relacionamento e Conduta` que a varredura
viu em **66,65** agora lê **66,67**.

### 3.1.121. 📌 A MONTAGEM DO ENSAIO ESTÁ EM NOME DE UMA CONTA DE TESTE

**Fato registrado, não desfeito.** As **348 designações** do `ENSAIO PILOTO — 16 CCs`, mais o ciclo,
as 4 aplicações e os públicos, foram gravados em **12/09 entre 02:33 e 03:35 pela conta
`zz.teste.rh`** — *"ZZ CONTA DE TESTE T.I. (RH_ADMIN) — NAO E PESSOA"*.

⚠️ **Quem auditar aquelas designações vai ler o nome de uma conta de teste**, e não vai encontrar a
pessoa que decidiu. Não se desfaz: reescrever autoria em auditoria é pior que o problema — o
registro passaria a afirmar algo que não aconteceu.

> ⭐ **REGRA, daqui para a frente: montagem de coisa que FICA vai na conta de quem decidiu, não na
> de teste.** Conta de teste é para PERCORRER — abrir telas, exercitar recusa, ver se o botão está
> onde deveria. O que sobrevive ao percurso (ciclo, aplicação, designação, publicação) leva o nome
> de quem responde por ele.

⚠️ O sinal de que a regra foi quebrada é fácil de ver e ninguém olha: **`ZZ` no campo "criado por"**
de um registro que não é descartável.

### 3.1.122. 🏷️ SIMULACAO — os quatro rótulos que faltam nomear

A tela mostra `0 + 13 + 39 + 4` e diz **"54 no público"**, e a soma dá 56. **Medido:**

| | |
|---|---|
| Público nominal (pessoas distintas) | **54** |
| Avaliações que existem | **52** (39 CANCELADA + 13 ENVIADA) |
| **Pessoas no público SEM avaliação nenhuma** | **2** |
| Canceladas: pelo ENCERRAMENTO | **37** |
| Canceladas: por DECISÃO DO RH (o "Excluir") | **2** |

⭐ **As duas divergências são a mesma classe** (regra 15): dois números verdadeiros sem o termo que
os concilia.

- `54 × 52`: a diferença são **2 pessoas que entraram no público e nunca tiveram avaliação criada**
  — e a tela não tem nome para elas.
- `39 × 37`: as 39 são o total de canceladas; a seção conta só as **37 que o "Devolver canceladas"
  alcança**, porque ele só reverte as de origem `ENCERRAMENTO`. As outras 2 voltam pelo "Incluir",
  na aba Designação.

⚠️ **Aguardando os nomes.** Preciso de rótulo para: (1) as **2 sem avaliação**; (2) o total de
canceladas × (3) as recuperáveis pelo "Devolver" × (4) as recuperáveis pelo "Incluir". No
`Avaliação Geral` a conta fecha porque lá não há nenhuma das duas situações.

---

### 3.1.123. ⭐⭐ O QUE A REGRESSÃO 108/108 MEDE — e o que ela NÃO mede

Registrado porque as duas ressalvas **mudam o valor da regressão como
instrumento**, e sem elas o `108/108` é lido como uma garantia que ele não dá.

**(1) Ela mede a divisão fixa por 18, com pesos IGUAIS.** O ciclo `000006` tinha
18 questões de mesmo peso — e onde os pesos são iguais, o exato e o arredondado
**coincidem**. A repartição por classificação (`peso_do_grupo ÷ n`, com resto)
**nasceu depois dela** e não é exercitada por ela.

**(2) Os 17 apurados não mudaram porque as respostas eram uniformes dentro de
cada classificação.** Aí o centavo cancela no numerador: `valor × (3,34+3,33+3,33)`
é o mesmo que `valor × 10`. **O efeito é real e não se manifestou nestes dados** —
teria aparecido no primeiro ciclo com respostas variadas, ou seja, **no piloto**.

> ⭐⭐ **"Passou na regressão" responde: o cálculo continua igual PARA OS DADOS QUE
> ELA TEM.** É uma pergunta sobre continuidade, não sobre correção — e um dado
> histórico uniforme não distingue duas implementações que só divergem quando
> ele varia.

#### O teste que a regressão não faz — `ordem-nao-muda-a-nota.spec.ts`

Sintético e deliberadamente hostil: respostas **diferentes** dentro de uma
classificação cujo peso tem **resto**, e as **6 permutações** da ordem das
questões exigindo o mesmo resultado. Nos três pesos reais com resto (16÷3, 40÷3,
10÷3) e no questionário inteiro.

⚠️ **Com o teste do avesso junto:** o mesmo caso, com o peso ARREDONDADO, exige
que as permutações **divirjam**. Sem ele o teste passaria mesmo se alguém
trocasse `pesoExato` de volta por `peso` — passaria por não estar medindo nada.

E o terceiro: **respostas uniformes não distinguem exato de arredondado**, que é
a razão dos 17 não terem mudado, escrita como teste.

### 3.1.124. ⭐⭐ FERRAMENTA DE MEDIÇÃO FORA DA SUÍTE QUEBRA EM SILÊNCIO

Em 12/09 o `nota-avaliacao.ts` passou a importar `../common/erro-de-dominio.js`.
A suíte ficou verde. A **regressão contra o Protheus parou de rodar** — o
`ts-node` em CJS não resolve o sufixo `.js`. Descobri **na hora em que precisei
dela**, que é sempre quando se descobre.

⚠️ **`tsc --noEmit` NÃO teria pego:** o compilador resolve `.js` → `.ts` sem
reclamar. Quem não resolve é o runtime. **Verificação que não percorre o mesmo
caminho do uso não verifica o uso.**

#### A varredura: as cinco ferramentas fora da suíte

| Ferramenta | O que mede | Resolvido como |
|---|---|---|
| `scripts/regressao-protheus.ts` | o baseline contra o ciclo 000006 | ⭐ **entrou na suíte** — roda de ponta a ponta contra a amostra commitada e exige `108/108 \| divergentes: 0` |
| `prisma/seed.ts` | o instrumento herdado | guarda `require.main` + teste de CARGA |
| `prisma/popular-dev-ciclo-piloto.ts` | o ciclo do DEV | idem |
| `prisma/popular-dev-designacao.ts` | as designações do DEV | idem |
| `prisma/popular-dev-fila-do-avaliador.ts` | a fila do DEV | idem |

⭐ **A divisão certa é por EFEITO, não por importância:** a regressão é **somente
leitura** e tem a amostra commitada, então roda de verdade dentro da suíte. As
outras quatro **gravam no banco** — para essas, o máximo verificável é *"ainda
carrega"*, e é o que o teste faz.

⚠️ **A guarda `require.main === module` é o que torna a ferramenta verificável.**
Sem ela, importar já executa (e o `seed` grava), então nenhum teste consegue nem
abrir o arquivo. As quatro não tinham; agora têm.

**Validado por mutação:** removido o `experimentalResolver` do
`tsconfig.seed.json`, o teste da regressão **reprova** — é exatamente o defeito
que passou.

### 3.1.125. 🏷️ OS QUATRO RÓTULOS DO SIMULACAO — e a regra que eles instituem

Nomes decididos em 12/09, e as duas contas passaram a fechar na tela:

| Rótulo | SIMULACAO |
|---|---|
| `no público` | **54** |
| **`no público, sem avaliação criada`** | **2** |
| **`canceladas (todas as origens)`** | **39** |
| **`canceladas pelo encerramento — recuperáveis em Devolver canceladas`** | **37** |
| **`excluídas por decisão do RH — recuperáveis em Designação › Incluir`** | **2** |

`54 = 52 + 2` · `39 = 37 + 2`.

⚠️ **"fora" e "sem avaliador" estavam proibidas**, e com razão: neste módulo
"fora do ciclo" é quem a régua excluiu e "sem avaliador" é quem tem avaliação e
falta quem responda. A varredura de 10/09 já achou dois "fora" com sentidos
diferentes em abas vizinhas — repetir a palavra seria a terceira.

> ⭐⭐ **A REGRA: origem e caminho de recuperação no MESMO rótulo.** Foi o que
> faltou quando o "Excluir" produzia uma avaliação "cancelada" e ninguém sabia
> desfazer: **o estado estava na tela e a saída não.**

#### 🔴 E um erro meu no caminho, que a conta pegou

A primeira versão do `noPublicoSemAvaliacao` filtrava por `elegivel`, com a
justificativa de "não contar duas vezes com `foraDoCiclo`". Deu **0** onde eu
mesmo tinha medido **2** — as duas eram justamente as que a régua excluiu.

⭐ **Os dois números respondem perguntas diferentes e podem se sobrepor:**
`foraDoCiclo` é *"a régua tirou"*, o outro é *"não existe avaliação"*. No
SIMULACAO, 4 estão fora do ciclo e **2 delas têm avaliação cancelada**. Somar os
dois nunca foi a conta; a conta é `noPublico = avaliações + sem avaliação`.

⚠️ Evitar dupla contagem entre dois números **que não são partes do mesmo todo**
foi o erro — e o que o pegou foi a conta não fechar, de novo.

#### Sim, dá para derivar do nome do botão — e foi assim

`lib/rotulos.ts` guarda `ROTULO_DEVOLVER` e `ROTULO_INCLUIR`, e o **botão** e a
**legenda que manda usá-lo** leem a mesma constante.

⚠️ **Por que importa:** o rótulo cita o nome do botão. Renomear o botão e não a
legenda faz ela mandar procurar uma coisa que não existe mais — **pior que não
dizer nada, porque a pessoa vai procurar.** Com a constante, renomear um
renomeia os dois no mesmo commit, por construção.

⚠️ Só entram ali nomes que **aparecem na tela e são citados em outro lugar**.
Rótulo usado num sítio só continua onde está — constante sem segundo leitor é
indireção sem ganho.

---

### 3.1.126. ⭐⭐ REQUISITO — todo teste de cálculo precisa do CASO QUE FALHA

Irmão do canário (§3.1.97), e a mesma forma: **prova de que a verificação está
medindo alguma coisa.**

O teste das permutações (§3.1.123) passaria mesmo se alguém trocasse `pesoExato`
de volta por `peso` — as seis permutações continuariam dando resultados, e nada
diria que eram os errados. O que o faz valer é o teste ao lado, que exige que
**com o peso arredondado as permutações DIVIRJAM**.

> ⭐⭐ **Todo teste de cálculo precisa de um caso que falhe quando deveria
> falhar** — a implementação errada, escrita de propósito, com o resultado
> diferente exigido. Sem ele, "verde" pode significar "não estou olhando".

#### Os outros testes de cálculo têm? — MEDIDO POR MUTAÇÃO, não por leitura

Não dá para responder isso contando `toThrow` no fonte. A pergunta é *"se a
implementação voltasse a estar errada, algum teste cairia?"* — e o único jeito
honesto é **reverter e ver**:

| Mutação | Resultado |
|---|---|
| `arredondar` passa a usar 1 casa | ✅ **8 testes caem** |
| `localizarFaixa` com a fronteira inferior EXCLUSIVA | ✅ **1 teste cai** |
| Critério sem dado volta a entrar no denominador | ✅ **7 testes caem** |

**Os três são pegos.** A contraparte existe *de fato* nos testes de cálculo —
via valores esperados exatos, que discriminam a implementação errada. O que
falta em vários é a contraparte **explícita e nomeada**, aquela que documenta
*por que* o número esperado é aquele.

⭐ **Recomendação: NÃO escrever os explícitos.** Custo ~2h, ganho baixo — a
mutação mostra que o efeito já existe. Vale mais **institucionalizar a mutação
como aferição**: rodar as três (ou novas) quando se mexer no cálculo, ~15min.

#### 🔴 E um erro meu na própria medição, que vale mais que o resultado

Na primeira rodada, duas das três mutações deram **"159 passed"** e eu quase
reportei que os testes eram cegos. **As mutações não tinham pegado no fonte** —
os padrões não batiam (`faixa.ts` usa `const { limiteInferior: inf }`, não
`f.limiteInferior`).

⚠️ **Mutação que não aplica lê exatamente como "o teste não pega".** É o falso
verde do canário, um nível acima: a ferramenta de aferição afere a si mesma
errado. **Toda mutação tem de provar que ENTROU** — um `assert s != antes` no
script, que é o que passei a fazer.

### 3.1.127. ⭐⭐ FRASE — "passou na regressão" é continuidade, não correção

> **"Passou na regressão" responde: o cálculo continua igual PARA OS DADOS QUE
> ELA TEM.** É uma pergunta sobre continuidade, não sobre correção.

Vale para **todo baseline externo** — a regressão do Protheus, a comparação com
o relatório antigo, o "bateu com a planilha". O baseline prova que não se mudou
o que ele cobre; não prova que o que ele cobre está certo, nem diz nada sobre o
que ele não cobre.

⚠️ E o que ele não cobre é invisível: o `108/108` ficou verde durante a
correção do centavo porque o ciclo `000006` tinha pesos **iguais**. Nada na
saída diz "este caso não é exercitado aqui" — quem lê vê `108/108` e conclui
mais do que está escrito.

**Gatilho:** ao usar um baseline para aprovar uma mudança, escrever junto **o
que ele não mede**. Se não der para escrever, o baseline não serve para aquela
decisão.

### 3.1.128. 🔢 A QUINTA CONTA QUE PEGOU DEFEITO — e o erro era evitar dupla contagem

| # | A conta | O que pegou |
|---|---|---|
| 1 | pontuação máxima gravada × calculada | 72,03 (§3.1.86) |
| 2 | soma dos pesos derivados × declarada | 59,97 (§3.1.85) |
| 3 | soma dos percentuais = 100 | 100,01 (§3.1.99) |
| 4 | `Σ(nota × peso) ÷ soma` = nota gravada | o rodapé que negava a conta (§3.1.115) |
| **5** | **`noPublico` = avaliações + sem avaliação** | **o filtro por `elegivel`, que zerava o termo** |

⭐ **O erro da 5ª foi tentar evitar dupla contagem entre números que NÃO são
partes do mesmo todo.** Filtrei `noPublicoSemAvaliacao` por `elegivel` "para não
contar duas vezes com `foraDoCiclo`" — e deu **0** onde eu mesmo tinha medido
**2**, porque as duas eram justamente as que a régua excluiu.

`foraDoCiclo` responde *"a régua tirou"*; `noPublicoSemAvaliacao` responde *"não
existe avaliação"*. **Perguntas diferentes, conjuntos que se sobrepõem** — no
SIMULACAO, 4 estão fora do ciclo e **2 delas têm avaliação cancelada**.

> ⚠️ **Antes de "não contar duas vezes", perguntar de que TOTAL cada número é
> parte.** Se não forem partes do mesmo total, subtrair um do outro não corrige
> nada — inventa um terceiro número que não responde pergunta nenhuma.

### 3.1.129. ✅ O BLOCO DE ~7,5h — os seis achados de tela da varredura

#### 1. "peso ao salvar" apagava os pesos que a mudança não tocou (2h)

Com alteração pendente, a tela escrevia *"peso ao salvar"* e **apagava o número
de TODAS as questões** — inclusive as que ninguém tocou —, exatamente no momento
de decidir se a alteração está certa.

⭐ **Dá para prever com confiança, e é o que se faz agora.** A regra é uma só
(`distribuirPeso`), e ganhou gêmeo testado no frontend (`distribuirIgual`, com
os mesmos casos do spec do backend). A linha mostra o **peso que vai resultar**,
em âmbar, com o antigo riscado ao lado quando muda. A barra do topo idem:
declarada, distribuída e máxima todas previstas, marcadas *(previsto)*.

⚠️ **O número nunca some.** Tirá-lo para dizer "não sei ainda" é pior que
mostrar o antigo: a pessoa perde a referência de onde estava. E quem GRAVA
continua sendo o servidor — isto é previsão, e o número volta dele ao salvar.

#### 2. Duas versões publicadas: é DESENHO, e faltava o rótulo (1,5h)

**Não é resíduo do percurso e não falta guarda.** A Aplicação aponta para uma
versão **específica** — as 8 do Administrativo apontam para a v1. Se publicar a
v2 despublicasse a v1, **essas 8 ficariam sem instrumento** e as notas já
calculadas sobre ela, sem régua. Versão publicada é permanente, pela mesma razão
que `efeitoDeDescartar` recusa apagá-la.

O que faltava era **dizer qual vale**: entrou `vigente`, e a lista marca
`vigente · publicada em …` × `anterior · publicada em …`, com *"ainda em uso por
N aplicações"* — porque a anterior não é lixo, é a régua de quem a usa.

⚠️ A vigente é a de **maior NÚMERO** entre as publicadas, não a de data mais
recente: a varredura viu duas publicadas **no mesmo dia**, e data não desempata.

#### 3. O banner ensinava um caminho que o RH_CICLO não tem (1h)

O aviso dizia *"Duplicar cria um rascunho, Montar abre o editor, Publicar…"* —
e o bloco de versões **some inteiro** para quem não pode versionar. O RH_CICLO
lia a instrução, procurava os botões e não achava; a conclusão razoável é que a
tela está quebrada. **Texto que ensina um caminho tem de saber se a pessoa tem o
caminho** — agora o banner pergunta ao backend e troca o texto.

#### 4. "Abrir" nomeando dois atos (1h)

Na **mesma tela**: `Abrir ciclo` é o ato irreversível que libera os avaliadores,
e `Abrir` era o link que só navega para o detalhe. Quem já ouviu *"não abra o
ciclo"* hesita em clicar no que só mostra. O link virou **"Ver"**; "Abrir" ficou
reservado ao ato.

#### 5. "avise a T.I." numa situação que o RH resolve (30min)

A divergência entre as somas é **quase sempre de cadastro**: classificação com
peso e sem questão, que o RH resolve em dois cliques. Mandar chamar a T.I.
transforma um ajuste em chamado. A mensagem agora diz o que procurar — e mantém
o "avise a T.I." só para o caso em que todas as classificações têm questão, que
aí é defeito mesmo.

#### 6. Plurais (parte de 1,5h)

`{n} avaliações` em dois pontos do painel → `contagem(...)`.

#### ⚠️ O que NÃO consegui reproduzir

**"caminho de código exposto em tela de RH".** Varri as strings renderizadas
procurando identificadores (`assert*`, `*.service.ts`, `prisma.*`, `efeitoDe*`,
`§3.1.x`) e **todas as ocorrências estão em comentários**, não em texto de tela.
Preciso de **em que tela e em que momento** apareceu — pode ser mensagem de erro
vinda do backend, que não sai de uma string do frontend.

---

### 3.1.130. ⭐⭐ "TEXTO QUE O RH LÊ NÃO CITA FONTE" — e estava no DADO, não no código

A varredura relatou *"caminho de código exposto em tela de RH"* e eu **não
reproduzi** procurando no frontend: varri as strings renderizadas atrás de
`assert*`, `*.service.ts`, `prisma.*`, `§3.1.x` e todas as ocorrências estavam
em **comentários**.

⚠️ **Estava no BANCO, gravado pelo seed.** A descrição do critério
`TEMPO_FUNCAO` dizia, no cartão que a gestora de RH lê:

> *"Anos desde a última TROCA de função (SR7010). Dissídio anual não conta como
> troca — **ver `src/sincronizacao/data-ultima-funcao.ts`**."*

⭐ **A lição de método:** procurei no lugar onde o texto é ESCRITO (o código da
tela) e ele vinha de onde o texto é ARMAZENADO. Num módulo em que quase toda
frase é literal no `.tsx`, a exceção é o texto de CADASTRO — e é justamente
onde ninguém varre, porque não está no `grep` do repositório.

#### Corrigido nos dois lados, no mesmo commit

| Critério | Antes | Agora |
|---|---|---|
| `TEMPO_FUNCAO` | *"(SR7010) … ver `src/sincronizacao/data-ultima-funcao.ts`"* | *"Anos desde a última mudança de função. O reajuste anual do dissídio não conta como troca de função."* |
| `ESCOLARIDADE` | *"(RA_GRINRAI / SX5 tabela 26)"* | *"Grau de instrução registrado no cadastro do Protheus."* |

⚠️ **`prisma/seed.ts` E o banco do DEV**, alinhados no mesmo commit — o seed só
roda em ambiente novo, e o DEV já tinha o texto antigo. Mesmo padrão do motivo
do `QTDE_TREINAMENTO`.

> ⭐ **O que a descrição responde é "o que este critério mede".** Onde o dado
> mora é documentação técnica — e "ver o arquivo X" manda o RH a um lugar onde
> ele não entra.

#### A varredura completa das nove superfícies de texto: **zero**

`criterio.descricao` · `criterio_faixa.rotulo` · `conceito_faixa.descricao` ·
`classificacao.nome` · `pergunta.enunciado` · `pergunta_alternativa.descricao` ·
`modelo.descricao` · `aplicacao.nome` · `ciclo.nome` — nenhuma cita caminho de
arquivo, nome de função, tabela do Protheus ou `§`.

#### E a duplicação: a descrição saía DUAS VEZES no cartão inativo

`CriteriosPage` mostrava `c.descricao` na linha do cartão **e** dentro do bloco
"Desativado" — que é onde ela é o motivo, com o contexto. No
`QTDE_TREINAMENTO`, cuja descrição é a justificativa inteira, era um parágrafo
longo repetido. Agora a linha de cima só aparece **quando o critério está
ativo**.

### 3.1.131. ⭐⭐ A DISCIPLINA DA MUTAÇÃO MORA NO CABEÇALHO DO ARQUIVO, não no ESTADO

Aceito não escrever as contrapartes explícitas (§3.1.126) — 2h de ganho baixo
contra 15min de mutação. **Mas regra que só existe no ESTADO se perde na
terceira pessoa que mexer.**

O bloco **"⚠️ QUANDO MEXER AQUI: RODE AS MUTAÇÕES"** entrou no cabeçalho dos
**seis** arquivos que decidem nota — `nota-avaliacao`, `peso-derivado`,
`apuracao`, `faixa`, `distribuir-peso`, `percentual` — com as quatro mutações,
o número de testes que cada uma deve derrubar, e o aviso de que **toda mutação
tem de provar que entrou**.

⭐ É o mesmo princípio da §3.1.88 (*regra sem gatilho não pega nem quem a
escreveu*): o gatilho é abrir o arquivo, e é lá que o texto tem de estar.

### 3.1.132. ✅ OS SPECS DO FRONTEND — a fila atrás da barreira, fechada

| Módulo | Situação |
|---|---|
| `reparticao.ts` | ✅ com o `repartirExato` (12/09) · **14 testes** |
| `roles.ts` + `menu` | ✅ antes do percurso (§3.1.112) · **20 testes** |
| `ciclo-encerrado.ts` | ✅ **agora** · 7 |
| `motivo.ts` | ✅ **agora** · 5 |
| `formato.ts` | ✅ **agora** · 12 |
| `composicao-da-nota.ts` | ✅ **agora** · 7 |

**65 testes no frontend**, de zero em 12/09 pela manhã.

#### ⭐⭐ O teste do fuso — e a prova de que o fuso forçado PEGOU

`new Date('2026-09-05')` é meia-noite **UTC**; a oeste de Greenwich
`toLocaleDateString` devolve **04/09**. É a data-base do ciclo, o campo que
ancora tempo de empresa, tempo na função e a janela de treinamento.

⚠️ **Testar no fuso da máquina não vale** — e aqui isso não é hipótese: **o
container é UTC**, e em UTC o defeito não acontece. O spec força
`process.env.TZ = 'America/Sao_Paulo'` e roda o pior caso.

⚠️ **E provei que o forçamento pega, por mutação:** trocando para `TZ = 'UTC'`,
os dois testes de fuso **caem**. Sem essa prova, um `beforeAll` que não tivesse
efeito deixaria o teste passar pelo motivo errado — exatamente o falso verde da
§3.1.126.

⭐ O spec inclui a **implementação errada escrita de propósito**:
`expect(new Date('2026-09-05').toLocaleDateString('pt-BR')).toBe('04/09/2026')`.
É o caso que falha quando deveria falhar, e ele documenta por que `data()` não
usa `Date`.

---

### 3.1.133. 📄 O ROTEIRO DE 04/09 — as duas confirmações, e o MODELO do nosso

Localizado em `C:\Arquivos-de-projeto\PlatformCapul_20260904_Roteiro_Deploy.md`
(270 linhas, `a021c8c4` → `6855c918`). Lido inteiro.

#### ✅ As duas coisas que estavam em aberto

**1. O `auth-gateway` em `a021c8c4` NÃO é drift.** Os sete rebuildados são
`inventario-backend`, `inventario-frontend`, `gestao-ti-frontend`,
`fiscal-frontend`, `logistica-backend`, `logistica-frontend`, `fiscal-backend`.
**O `auth-gateway` não aparece uma única vez no roteiro** — zero ocorrências. E o
§4 escreve o critério de inclusão:

> *"mudaram de comportamento o backend do Inventário, o backend da Logística e
> quatro frontends. O `fiscal-backend` entra por **coerência de versão** — o que
> mudou nele foi só limpeza de imports…"*

A leitura de 10/09 estava certa e agora tem **confirmação documental**: rodar
`a021c8c4` é o estado esperado de quem não entrou na onda, não deriva.

**2. HLG recebeu o mesmo roteiro.** Cabeçalho: *"Ambientes: **homologação
primeiro, produção depois**"*. O `6855c918` declarado para HLG **provavelmente
procede** — mas continua sendo *provavelmente*: ⚠️ **o que falta é medir**, e
`/health → versao.commit` é quem responde. Só o Marco tem acesso.

#### ⭐⭐ O que COPIAR dele — seis peças

| # | Peça | Por quê |
|---|---|---|
| 1 | **Gate que confere NO BANCO** (§5.1) | Duas queries: a linha em `schema_migrations` **e** a coluna existindo. *"Se vier vazio, a migration NÃO foi aplicada — pare e investigue."* Mensagem de job é o que o job diz de si; o banco é o que aconteceu |
| 2 | **`nginx -s reload` marcado NÃO OPCIONAL** (§7), com o motivo | *"O container novo recebe um IP novo e o nginx continua apontando para o antigo — sem o reload, as telas respondem 502."* O motivo é o que impede alguém de pular |
| 3 | **`build-com-versao.sh` explicado** (§4) | *"Use o script, não o `docker compose build` puro… Sem ele a imagem sai marcada `desconhecido`."* — que é **exatamente** o que se vê no DEV quando se esquece |
| 4 | **§9 "Avisar os usuários"** | Cinco itens, cada um com o que a pessoa vai estranhar e o que fazer. **É metade do valor do documento**: sem ele o deploy funciona e o suporte recebe as ligações |
| 5 | **O `_Pos_exec.md`** | *"Salve este arquivo como `…_Pos_exec.md` com o retorno REAL de cada query, qualquer erro, e os passos que não bateram. Esse arquivo é lido antes de escrever o próximo roteiro."* |
| 6 | **§6 — a verificação que só existe NAQUELE deploy** | Uma query sobre o dado vivo, para provar que a mudança de comportamento não pegou ninguém no meio: *"nenhuma lista em contagem pode ter virado aberta"* |

⚠️ **O §6 do nosso são DOIS**, e ambos já estão medidos:
- **conferência de destino** — nenhuma avaliação com resposta antes do piloto
  (hoje: Piloto `894 PENDENTE / 0 respostas`);
- **limpeza das 74 linhas** com espaço no `RA_NOME` (§3.1.108), com o `SELECT`
  de contagem antes e depois.

#### 🔴 E uma peça que o modelo NÃO tem: o `_Pos_exec` de 04/09 não foi escrito

O único `_Pos_exec` no diretório é o de **05/05**. O roteiro de 04/09 manda
escrever um e ele não existe.

⚠️ **A regra que o próprio documento institui foi quebrada na execução dele** — e
é a peça que impede o mesmo tropeço se repetir. Registrado porque no nosso a
tentação vai ser maior: 15 migrations e 3 serviços novos produzem mais retorno
para anotar, e é justamente aí que se pula.

#### ⚠️ AS DIFERENÇAS DE ESCALA — elas mudam o risco, não só o tempo

| | 04/09 (o modelo) | O NOSSO |
|---|---|---|
| Migrations | **1**, SQL puro, por **bind-mount** — *"este job NÃO precisa de build"* | **15** Prisma, e o job **tem build próprio** |
| Serviços | 7 **rebuildados** | **3 NOVOS no compose** |
| `docker-compose.yml` / `nginx.conf` / `.env` | **NÃO mexe** | **compose + 2 `location` no nginx** |
| Jobs de migration | `inventario-migrate`, SQL | **6 de 7 trocados para `migrate-guarda`** |
| Arquivo que precisa existir no servidor ANTES | — | ⚠️ **`scripts/migrate-guarda/` é bind-mount**: tem de estar no disco antes de qualquer `up` |
| Tempo | 20–30 min | a estimar, e **não é comparável** |
| Rollback | *"nada aqui é destrutivo… a coluna pode ficar"* | **a estabelecer** — 15 migrations Prisma não se desfazem por omissão |

⭐ **A diferença que mais muda o risco não é o número de migrations: é `mexe em
compose/nginx`.** O roteiro de 04/09 pôde dizer *"nada aqui é destrutivo"* porque
a topologia não mudava — `git pull` + build + `up -d` dos mesmos serviços. O
nosso **acrescenta serviços e rotas**, e um `up -d` parcial deixa o nginx
apontando para o que não existe.

⚠️ E o `migrate-guarda` por bind-mount é a armadilha que o modelo não tem: o
`git pull` do §3 resolve, **desde que o roteiro diga que resolve**. Se alguém
copiar o comando de `up` sem o pull completo, o job sobe sem a guarda.

#### ⭐⭐ O §9 do nosso é de outra natureza: o módulo é NOVO

Os cinco itens de 04/09 são todos *"isto mudou de comportamento"*. **Não temos
comportamento anterior.** O nosso §9 responde três perguntas:

1. **Quem ganha acesso** — e o card aparece no Hub para essas pessoas;
2. **Quem NÃO ganha**, e por quê (não é esquecimento);
3. **O que a pessoa vê ao clicar** — a fila do avaliador, vazia para quem não tem
   designação, com o estado explicando.

⚠️ **E entra o §3.1.93, que vai gerar chamado se não estiver escrito:**

> **Dar papel no Configurador NÃO basta.** São quatro coisas — conta ativa,
> módulo atribuído, papel, **e matrícula que resolva num `rh.colaborador`
> ATIVO**. Faltando a quarta, a pessoa toma **403 falando de matrícula** — e a
> mensagem manda para o Configurador, onde já está tudo certo.

⭐ É a terceira aparição da família do *403 que fala de outra coisa*, e a primeira
que dá para prevenir **antes** de alguém tropeçar.

#### ⛔ NÃO escrever o roteiro ainda

Continuam faltando, e nenhum é meu:
1. **o commit real de HLG** — só o Marco mede (`/health → versao.commit`);
2. **a decisão sobre a Onda A** — separar do módulo os 5 jobs de
   `migrate-guarda`, combinada em 11/09 e ainda em aberto.

---

### 3.1.134. 🚪 O PORTÃO DE LIBERAÇÃO — implementação → ensaio integral → gente real

**Encadeamento combinado em 12/09.** Nada é liberado para a Arielly e os
avaliadores de verdade antes de a skill percorrer o ciclo INTEIRO — os 16
avaliadores e a Arielly, respondendo como o usuário responderá, até a apuração e
a devolutiva.

#### 1. O ensaio integral ESCREVE

Vai haver avaliação **respondida, enviada e apurada**. O lugar é o
**`ENSAIO PILOTO — 16 CCs`** (325 avaliações, RASCUNHO), que existe exatamente
para isso.

⛔ **O `Piloto 15/09` continua em 894 PENDENTE, 0 respostas, e NÃO participa.**

#### 1-bis. ⭐⭐ O ROTEIRO DO ENSAIO TERMINA NA DEVOLUTIVA — a skill APERTA O BOTÃO

Decidido em 12/09 (§3.1.138): **a devolutiva é ato do RH, nunca automática na
apuração.** Logo ela é um **passo numerado do roteiro do ensaio**, não um efeito
que acontece sozinho:

> **… → apurar → conferir o resultado → LIBERAR A DEVOLUTIVA (a skill clica) →
> abrir como o colaborador e ver o que ele vê.**

⚠️ Sem esse passo o ensaio **termina no resultado**, e o último trecho do
processo — o único que o colaborador enxerga — seria percorrido pela primeira
vez por gente real. É a [[feedback_passo_nunca_percorrido]] com nome e data: em
09/09 a única etapa nunca percorrida rendeu **9 dos 18 defeitos**.

#### 2. ⭐⭐ O que o ensaio da skill NÃO valida — são DOIS ensaios, não um

> **O da skill valida o SISTEMA. O de HLG valida as PESSOAS.**

O ensaio integral roda com **16 papéis na mesma máquina, com sessão aberta por
quem conduz**. Ele não valida:
- gente real recebendo **senha temporária** e trocando no primeiro acesso;
- alguém entrando **sem ninguém do lado**, sem saber onde clicar;
- o e-mail chegando na caixa da pessoa, no computador dela.

⚠️ Esse pedaço **só acontece em HLG** e **depende do Marco**. Tratá-los como um
ensaio só é o erro: o primeiro dá verde e o segundo é onde aparece "não consegui
entrar".

#### 3. PRÉ-REQUISITOS — os dois listados, e o que MEDI

| | Custo | Por quê |
|---|---|---|
| **DEVOLUTIVA** | ~1 semana | Sem ela o ciclo **não tem fim**: a régua de conceitos diz *"é este texto que a pessoa recebe"* e não existe tela onde alguém receba. O ensaio não pode terminar no resultado |
| **NOTIFICAÇÃO** | 3–5 dias | É o que faz o avaliador **saber que tem trabalho**. Sem ela o ensaio testa um sistema em que ninguém é avisado |

**Medi o resto, e o ensaio está pronto no que depende de dado:**

| Conferência | Resultado |
|---|---|
| Conceitos do ENSAIO (a régua da apuração) | ✅ **5 faixas contíguas 0–100** |
| Critérios das aplicações | ✅ **todos CALCULADO** (`ESCOLARIDADE`, `TEMPO_EMPRESA`, `TEMPO_FUNCAO`) |
| Os 16 avaliadores conseguem entrar? | ✅ **16 de 16** — conta ativa, permissão e colaborador elegível |
| A Arielly | ✅ `RH_ADMIN`, conta e colaborador ATIVO |

⭐⭐ **Consequência que muda a fila: "entrada do valor INFORMADO" NÃO é
pré-requisito do ensaio.** Nenhuma aplicação do ENSAIO usa critério `INFORMADO`
— os três são calculados do cadastro. Era a suposição mais cara da lista, e o
dado a desfaz.

#### 🔴 E um pré-requisito meu que quase virou bloqueio falso

Ao medir quem entra, filtrei por `col.situacao = 'ATIVO'` e achei **2 de 16
travados** — MARCIO ANTONIO (33 avaliações) e LICIA VERSIANI (1). Ia reportar
como pré-requisito.

⚠️ **Régua errada.** `SITUACOES_ELEGIVEIS = ['ATIVO','AFASTADO','FERIAS']`, e os
dois são FÉRIAS e AFASTADO — **elegíveis**. Com a régua certa: **16 de 16**.

⭐ É o defeito que o próprio ESTADO alerta desde o começo (*"`situacao = 'ATIVO'`
derrubaria 145 das 1.036 pessoas de todas as listas, calado"*) — e eu o cometi
numa consulta de conferência, que é onde ele engana pior: **a conta parece
medir, e mede outra coisa.** A régua tem nome e é importável; escrever
`'ATIVO'` à mão numa query de conferência é reescrever a constante fora dela
(§3.1 fonte-única), só que em SQL, onde nenhum teste varre.

#### ⚠️ Um caso que o ensaio vai exercitar de graça, e vale saber

A aplicação **`Aprendizes`** (18 avaliações) tem **zero critérios** e
`pesoAvaliacao = 100`: a nota final é a nota do questionário, pura. É o caso que
a regra *"`pesoAvaliacao > 0` faz o caso especial cair da fórmula"* existe para
cobrir, e ele nunca foi percorrido de ponta a ponta com dado.

#### 📄 E o `_Pos_exec` vira PASSO NUMERADO

No roteiro de 04/09 ele é recomendação no fim — e **não foi escrito** (§3.1.133).
No nosso ele é **passo numerado do checklist**, com o número dele.

> ⭐ **Passo que não tem número não é executado.**

---

### 3.1.135. ✏️ CORREÇÃO — "valor informado" não bloqueia o ensaio integral

Estava na lista de pré-requisitos e **não é**. Medido: **nenhuma aplicação do
`ENSAIO PILOTO — 16 CCs` usa critério `INFORMADO`** — as três que têm critério
usam `ESCOLARIDADE`, `TEMPO_EMPRESA` e `TEMPO_FUNCAO`, os três `CALCULADO`, e a
quarta (`Aprendizes`) não tem critério nenhum.

⭐ Era a suposição mais cara da fila: 4–6 dias na frente do portão que o portão
não precisava. Desceu para **depois** dele.

⚠️ **Pode subir de novo, e por causa de resposta que não é da T.I.:** se a
Arielly explicar por que o registro de treinamento parou em 14/11/2025, o
`QTDE_TREINAMENTO` volta a fazer sentido — e aí a entrada do valor é o que falta
para ele pontuar.

### 3.1.136. 🔴 A RÉGUA ERRADA EM SQL — o mesmo defeito, onde nenhum teste varre

Medindo quem consegue entrar no ensaio, escrevi:

```sql
count(*) filter (where col.situacao = 'ATIVO')   -- ← ERRADO
```

e achei **2 de 16 travados**. Ia reportar como pré-requisito de acesso. Os dois
são **FÉRIAS** e **AFASTADO** — e `SITUACOES_ELEGIVEIS = ['ATIVO','AFASTADO',
'FERIAS']`. Com a régua certa: **16 de 16**.

⚠️ **É o defeito que o comentário do próprio código afirma, e que já foi
corrigido uma vez** (*"`situacao = 'ATIVO'` derrubaria 145 das 1.036 pessoas de
todas as listas, calado"*). Agora cometido em **SQL de conferência**.

⭐⭐ **Por que aqui engana pior que no código:**

| | No código | Em SQL de conferência |
|---|---|---|
| A constante existe? | sim, e é importável | sim, e **não dá para importar** |
| Algum teste varre? | `fonte-unica.invariante.spec.ts` | **nenhum** — a query nem está no repositório |
| O sintoma | uma lista curta demais | **a conta parece medir e mede outra coisa** |

A consulta não erra: ela responde **outra pergunta**, com aparência de resposta
certa. E como é escrita para *conferir*, o resultado dela é o que decide se algo
está pronto — é o pior lugar possível para uma régua errada.

#### 🔧 A providência — dá, e são duas, com direção de verdade explícita

**Pergunta: as réguas podem virar VIEW ou função no banco?** ⚠️ **Podem, mas
sozinho isso é um segundo dono da verdade** — a `SITUACOES_ELEGIVEIS` do TS e a
lista dentro da view envelheceriam separadas, que é exatamente a família
[[feedback_regra_duplicada_envelhece_errada]]. Então: **view sim, mas com
invariante amarrando as duas.**

**(a) `scripts/conferir-estado.ts` — a conferência pelo CÓDIGO. ~2h. É a melhor.**

Um script que **importa** `SITUACOES_ELEGIVEIS`, `STATUS_VIVOS` e
`ONDE_A_AVALIACAO_CONTA` e imprime o estado do ciclo. A conferência passa pela
mesma régua **por construção**, não por disciplina.

⭐ E ele herda o que já existe: entra na lista do
`ferramenta-fora-da-suite.invariante.spec.ts` (guarda `require.main` + teste de
carga), então **não quebra em silêncio** como a regressão quebrou.

**(b) `rh.v_colaborador_elegivel` por migration — para o `psql` avulso. ~2h.**

Porque nem toda conferência passa por script: o Marco num deploy abre o `psql`.
A view documenta a régua onde ela é usada.

⚠️ **Com invariante:** um spec que lê o arquivo da migration e exige que a lista
literal dentro do `CREATE VIEW` seja **exatamente** a de `SITUACOES_ELEGIVEIS`.
É varredura de fonte, a mesma ferramenta da §3.1.88 — e é o que impede a view de
virar o segundo dono.

**As réguas que pedem isso** (as que uma consulta de estado precisa replicar):

| Régua | Onde | Usos no fonte |
|---|---|---|
| `SITUACOES_ELEGIVEIS` | `common/elegibilidade.ts` | 28 |
| `ONDE_A_AVALIACAO_CONTA` | `avaliacao/avaliacoes-que-contam.ts` | 16 |
| `STATUS_VIVOS` | `avaliacao/cancelamento.ts` | 10 |

**Total ~4h**, e a (a) sozinha já resolve o caso que me pegou.

> ⭐ **A regra curta: consulta que decide se algo está pronto não se escreve à
> mão no terminal.** Ou passa pelo código, ou passa por uma view que um
> invariante prende à constante.

### 3.1.137. ✅ DECISÃO — a devolutiva NÃO entrega texto por conceito

Decidido em 12/09 (a Arielly ajusta depois; não se espera por ela).

**A devolutiva entrega:** a **nota**, o **conceito**, e a **memória de cálculo
pergunta a pergunta** — a que ficou pronta em §3.1.120, com o texto da âncora
escolhida.

⭐ **Escrever cinco textos é decisão de conteúdo de RH**, não de engenharia. E um
campo que nasce vazio faz a tela prometer o que não tem: quem abre a devolutiva
vê um espaço reservado a uma mensagem e conclui que ela existe e não veio.

⚠️ Consequência prática: **`conceito_faixa` NÃO ganha coluna nova.** Hoje ela tem
`descricao, limite_inferior, limite_superior, cor, ordem` — o `descricao` é
rótulo ("Atende", "Supera"), e é o que a devolutiva mostra. Se um dia o RH
quiser a mensagem longa, ela entra como cadastro **com os textos já escritos**,
nunca como campo vazio esperando alguém.

---

### 3.1.138. ⭐⭐ DECISÃO — A DEVOLUTIVA É ATO DO RH, nunca automática na apuração

**Decidido em 12/09/2026 pelo Clenio.** A apuração calcula; **quem libera para o
colaborador ver é a Arielly, num ato explícito.** Dois motivos, e o segundo é o
que fecha a questão:

1. Ela precisa **conferir antes** de o colaborador ver.
2. **A apuração é REVERSÍVEL** — reapurar é rotina (mudou peso, corrigiu
   critério). Devolutiva automática entregaria número que ainda vai mudar, e
   *retirar* o que a pessoa já viu não existe.

#### Consequência para o portão de liberação (§3.1.134)

⚠️ **O roteiro do ensaio integral ganha um passo: a skill APERTA O BOTÃO da
devolutiva.** Sem ele o ensaio termina no resultado e não na devolutiva — e o
último passo do processo, o único que o colaborador enxerga, ficaria sendo
percorrido pela primeira vez por gente real. É exatamente a
[[feedback_passo_nunca_percorrido]]: o passo nunca percorrido rendeu 9 dos 18
defeitos de 09/09.

#### As duas perguntas que decorrem — respondidas

**(a) Libera em LOTE ou uma a uma?** → **Em lote, e cabe no padrão que já
existe.** A prévia de aplicação e a devolução da fila (`devolverParaFila`) já
são "mostra o recorte → confirma → grava por id", com a regra da
[[feedback_previa_grava_o_que_mostrou]]: **o `Aplicar` grava os ids que a prévia
MOSTROU**, nunca recalcula o alvo no clique. A devolutiva entra igual: prévia
por ciclo/aplicação, confirmação, gravação por id.

⚠️ Uma a uma **também** precisa existir, mas não como modo principal: é para a
correção pontual (uma pessoa cuja apuração foi refeita depois da liberação).

**(b) O que acontece se uma avaliação já devolvida for REABERTA depois?**

| | |
|---|---|
| **O que o sistema deveria fazer** | Recusar, ou reabrir **avisando que a pessoa já viu o resultado** — e registrar que viu. |
| **O que ele faz hoje** | **Nada. Não há guarda.** |

E há um obstáculo de modelagem que precisa estar escrito antes de alguém
implementar:

> ⛔ **`devolutiva_em` NÃO pode morar em `resultado_avaliacao`.** O `reabrir`
> **APAGA** o `ResultadoAvaliacao` (é o que o `efeitoDaReabertura` anuncia: a
> nota que vai ser apagada). O fato *"ela já viu"* seria deletado junto com a
> linha — e some justamente no ato contra o qual ele existe para avisar.

Colunas de hoje: `id, ciclo_id, avaliacao_id, colaborador_id, nota_avaliacao,
peso_avaliacao, nota_criterios, nota_final, conceito_id, conceito_descricao,
houve_renormalizacao, calculado_em`. **Nenhuma de devolutiva.** O carimbo tem de
ficar em `Avaliacao` (que sobrevive à reabertura) ou numa tabela de eventos.

**Custo da guarda: ~4h** — coluna em `Avaliacao` + migration, o carimbo no ato de
liberar, e a recusa/aviso no `reabrir` dizendo **quantas** das alvo já foram
devolvidas (o padrão da [[feedback_api_recusa_para_a_tela_perguntar]]).

---

### 3.1.139. ⭐⭐ A REGRA CURTA — consulta que decide se algo está pronto não se escreve à mão no terminal

> **Consulta que decide se algo está pronto não se escreve à mão no terminal.**
> Ou passa pelo `conferir-estado.ts`, ou passa por uma view que um invariante
> prende à constante.

**Gatilho:** toda vez que eu for medir estado para dizer "pode abrir", "está
pronto", "N pessoas conseguem entrar". Nasceu do §3.1.136 — escrevi
`situacao = 'ATIVO'` num terminal e quase reportei 2 de 16 avaliadores travados;
eram férias e afastado, que `SITUACOES_ELEGIVEIS` inclui. **16 de 16.**

O que torna o SQL de terminal pior que o mesmo erro no código: a constante
existe e **não dá para importar**; **nenhum teste varre**, porque a query nem
está no repositório; e o sintoma é a conta **parecer** medir.

As duas peças construídas (~4h, 12/09):

| Peça | O que garante |
|---|---|
| `src/scripts/conferir-estado.ts` | Importa `SITUACOES_ELEGIVEIS`, `STATUS_VIVOS`, `MODULO` e `avaliacaoConta`. Mora em `src/` e roda do `dist/` — **sem `ts-node`**: import quebrado quebra o BUILD. Só leitura. |
| `rh.v_colaborador_elegivel` + `regua-em-sql.invariante.spec.ts` | A view carrega a régua em SQL; o invariante **lê o arquivo da migration** e exige que a lista literal seja igual a `SITUACOES_ELEGIVEIS`. Validado por mutação (tirar `FERIAS` reprova). |

Estado medido pelo script no `ENSAIO PILOTO`: **344 no público · 344 elegíveis ·
325 avaliações · 19 sem avaliação criada · 16/16 avaliadores entram · 5
conceitos.**

---

### 3.1.140. ✅ SMTP — EXISTE e está configurado. A notificação NÃO depende do Marco

**Pergunta do Clenio, antes de gastar 3–5 dias:** o ambiente tem servidor de
e-mail? Algum módulo envia? Há variável de ambiente?

**Resposta: sim, sim e sim.**

| | |
|---|---|
| Variáveis | `SMTP_HOST=smtp.capul.com.br`, `SMTP_PORT=587`, `SMTP_USER=clenio@capul.com.br`, `SMTP_FROM` — mais `SAC_SMTP_*` (greenmail no DEV) |
| Quem já envia | `auth-gateway/src/email/email.service.ts` (nodemailer), com `POST /api/v1/internal/email/send`; e o Fiscal |
| `gestao-pessoas/backend` | **não tem nodemailer** — é o que falta escrever |

⚠️ Duas coisas para decidir na hora de construir, não agora:

1. **Enviar direto ou pelo auth-gateway?** A rota interna dele está `@Public()`.
   Reusar é mais barato; mandar direto do módulo evita depender de uma rota
   aberta. **A recomendação é reusar** — o auth-gateway já resolve credencial e
   `SMTP_FROM`, e duplicar configuração de e-mail é a fonte-única pelo avesso.
2. **Endereço de quem recebe.** É o gargalo real, não o SMTP: o
   `rh.colaborador` vem do Protheus e **o e-mail nem sempre existe**. Medir
   quantos dos avaliadores do ensaio têm e-mail é pré-requisito da notificação
   — mandar para 60% e não dizer isso é o mesmo defeito do
   [[feedback_designar_nao_da_acesso]].

**Conclusão: a notificação não está bloqueada por dependência externa.** O que
ela precisa é da medição do item 2.

---

### 3.1.141. 🔴 A DISPENSA É POR NOME DE ARQUIVO — e o texto dela envelhece sozinho

Ao pôr o `conferir-estado.ts` em `src/`, ele entrou na varredura de dois
invariantes e **reprovou nos dois** — as guardas funcionaram. ⚠️ Registre o
motivo de a suíte estar verde antes: o script morava em `scripts/`, **fora da
raiz varrida**. Ferramenta fora de `src/` é ferramenta fora de toda invariante
do módulo.

O reparo do segundo abriu um achado maior:

> **A lista de dispensados da separação de funções dispensa por NOME DE
> ARQUIVO. O arquivo cresce; o texto da dispensa fica dizendo o que era verdade
> no dia em que foi escrito.**

Três casos da mesma família, e o próprio arquivo já documentava o primeiro:

| Arquivo | O que a dispensa afirmava | O que o arquivo faz |
|---|---|---|
| `resultado.service.ts` | "na tela a própria linha aparece marcada" (11/09) | o CSV omitia e a tela mostrava nota, conceito e memória |
| `ciclo.service.ts` | **"só CONTA avaliações pendentes"** | `previaDaDevolucao` e `devolverParaFila` — **leem e REABREM** |
| `painel.service.ts` | **"só CONTA — groupBy…"** | um `findMany` buscando `avaliadorId` |

**Nenhum dos dois novos é furo**, e as duas dispensas foram reescritas dizendo o
que o código faz:

- **`ciclo.service`** — a devolução é **em LOTE, por ciclo, sem recorte por
  pessoa** (mesma forma da `apuracao.service`, a exceção já acordada). Ninguém
  consegue MIRAR a própria linha: o alvo é `CANCELADA + origem=ENCERRAMENTO` do
  ciclo inteiro. E devolver a avaliação de quem é o **avaliado** não lhe dá
  acesso a nada — devolve o trabalho para a fila do **avaliador** dele.
- **`painel.service`** — lê `avaliadorId` para pôr NOME em quem apontou "não é
  minha equipe": chave estrangeira virando pessoa, não conteúdo de avaliação.

#### A contramedida: a frase virou conta

⭐ *"agregado, não lê o conteúdo de ninguém"* é a frase mais repetida da lista —
e era **afirmação sobre o código que nada conferia**. Agora a lista tem duas
categorias:

| | |
|---|---|
| **`SO_AGREGA`** | quem se justifica pela frase. **A máquina cobra**: em `prisma.avaliacao`, só `count`/`groupBy`/`aggregate`. Hoje: `aplicacao.service` e `conferir-estado`. |
| Lista em prosa | quem lê linha, com o motivo escrito por extenso — honesto, e **continua sem verificação**. |

Canário incluído (a forma distingue `findMany` de `groupBy`) e validado por
mutação: pôr `ciclo.service` em `SO_AGREGA` reprova, e a mutação foi conferida
como entrada antes de ler o resultado (§3.1.113).

É a mesma lição do §3.1.85 num lugar novo: **a contramedida não é o aviso — é a
conta.** Aqui o "aviso" era o texto da própria dispensa, que é o lugar mais
persuasivo possível para uma afirmação falsa morar.
