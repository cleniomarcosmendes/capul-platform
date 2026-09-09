# Regras de método

**26 regras.** Cada uma nasceu de um caso concreto deste projeto e **vale além dele** — outro
módulo, outra pessoa, outro mês.

> **Como usar:** não se lê de cabo a rabo. Cada regra começa por um **GATILHO** — o momento em que
> alguém para e pergunta. Procure o gatilho que descreve o que você está prestes a fazer.

---

## Por que gatilho, e não princípio

Esta é a lição que organiza o arquivo, e ela custou caro:

⭐⭐ **Regra sem gatilho não pega nem quem a escreveu.**

Em 09/09/2026 eu quebrei **três regras minhas, no mesmo dia em que as escrevi**. Não por descuido —
porque elas descreviam **um estado bom** em vez de nomear **um momento**:

| Quebrei | Quando | O que aconteceu |
|---|---|---|
| **Concordância de número** (hoje regra 18) | ~4 h depois de escrevê-la | Varri 56 `"(s)"` do módulo pela manhã e escrevi que a convenção estava morta. À tarde escrevi `` `${a.aFazer} parada(s)`.replace('(s)', …) `` — o parêntese que eu tinha eliminado, com um *replace* por cima. Peguei relendo o diff. |
| **Regra 5** (dono do fato) | ~2 h depois | Criei o mesmo fato com dois nomes em dois payloads (`canceladas` e `avaliacoesCanceladas`), **no mesmo dia em que documentei colisões de vocabulário**. |
| **Regra 3** (afirmar o fato) | ~1 h depois | Escrevi um spec afirmando a frase (`/pelo menos 15 caracteres — faltam 12/`) tendo escrito, uma hora antes, a função que produz essa frase. **Não vi sozinha** — só apareceu quando o Clenio perguntou. |

⚠️ **O padrão é exato:** as regras que me pegaram naquele dia (2, 13, 14) **todas nomeiam um
momento**. As que me escaparam (3, 5, e a concordância) **todas descreviam um resultado desejável**.

Por isso toda regra aqui tem gatilho. E por isso **uma candidata a regra que não fecha gatilho não
é regra** — é nota, e vai para a memória.

---

# Parte 1 — as catorze primeiras

*Nasceram entre 07 e 09/09/2026. Os números são estáveis: há comentários de código e commits que
citam "regra 8", "regra 13". Não renumerar.*

## Sobre ferramentas de verificação

### 1. Falso verde adia a descoberta; falso vermelho destrói a ferramenta

> **GATILHO:** *estou prestes a ignorar, pular ou desligar uma verificação porque "ela está com
> problema".*

*Caso:* `npx tsc` rodando o pacote decoy `tsc@2.0.4` e saindo 1, ao lado do cache do Docker
servindo bundle velho e saindo 0.

O verde falso alguém descobre quando o defeito aparece — é dívida com data de vencimento. O
vermelho falso faz alguém **desligar o passo** achando que é problema de máquina (*"aqui o
typecheck não roda"*, *"essa suíte é instável"*), e a verificação some do processo **sem ninguém
ter decidido removê-la**.

### 2. Mutação como método: injetar o erro e ver a ferramenta pegá-lo

> **GATILHO:** *vou afirmar que uma checagem protege X.*

*Caso:* `const MUTACAO_DO_TESTE: number = ciclo.nome;` derrubando o build com `TS2322` antes do
`vite`.

Garantia que ninguém tentou quebrar é garantia **suposta**. Antes de escrever "X está limpo", saber
dizer **qual comando executou a checagem** e **como sei que ele executou** — *"ele imprimiu que
estava tudo bem"* não é resposta. Ver regra 1.

## Sobre testes

### 3. Afirmar o FATO, não a redação

> **GATILHO:** *estou afirmando texto num teste. Existe uma função que produz esse texto?*

*Caso:* o spec que exigia `/não estão na lista de ninguém e ficarão de fora/` — a frase que mentia.
Ele passava **exatamente porque o defeito existia**.

Afirmar contagens, motivos, códigos e estados. Quando o texto **é** o requisito (uma recusa tem de
ensinar o caminho), afirmar o **pedaço que carrega a obrigação** (`/RH_ADMIN/`, `/motivo/`), nunca
a frase inteira. Melhor ainda: **comparar com a saída da função que decide**, chamada dentro do
próprio teste.

⚠️ *Quebrei esta regra em 09/09 — ver o topo do arquivo. O gatilho nasceu da quebra.*

### 4. Spec que quebra ao consertar um defeito é INFORMAÇÃO

> **GATILHO:** *um teste quebrou e eu vou atualizá-lo.*

*Casos, e os dois desfechos:* num, o spec era **fóssil do defeito** e foi corrigido; noutro, era
**decisão escrita com motivo** (*"trocar só o avaliador não é bloqueado nem com nota enviada"*) e
**não foi atropelado** — virou `EXIGE_CONFIRMACAO`, conciliando as duas.

O teste que quebra está dizendo alguma coisa. Às vezes é *"você quebrou"*; às vezes é *"alguém já
decidiu isto, com razão"*. **Não dá para saber sem ler.**

## Sobre contratos entre partes

### 5. Relatório cita atributo, não o possui

> **GATILHO:** *dois lugares mandam este mesmo campo. Qual deles é o dono do fato?*

*Caso:* `/resumo` mandando `status` e `encerradoEm`, que `GET /ciclos/:id` já entrega — a etiqueta
lia um, as faixas liam o outro.

Quem sobrevive a uma duplicata é o **dono natural do fato**, não o mais conveniente: atributo
gravado na linha pertence ao **registro**; contagem apurada agora pertence ao **relatório**.
⚠️ E elas vêm em bando: procuradas depois de achar uma, apareceram **cinco**.

⚠️ *Quebrei esta regra em 09/09 — ver o topo. O gatilho nasceu da quebra.*

### 6. Prévia mostra o que vai gravar, vem de quem decide — e grava o que mostrou

> **GATILHO:** *a tela vai mostrar o efeito antes de confirmar.*

*Casos:* `efeitoDoExcluir`, `previaDaDesignacao`, a prévia do público, a da abertura, a da
reabertura.

Se a tela recalcula, ela diverge no primeiro caso de borda — e o caso de borda é sempre o que a
prévia existia para pegar. A frase que o usuário lê antes de confirmar e a que a API devolve ao
recusar têm de sair **da mesma função**.

⭐ **Corolário de identidade:** o botão grava **exatamente o conjunto que a prévia mostrou**, nunca
um recalculado no clique. *(Caso: o `Aplicar` que recalculava o alvo no clique — conferia um
recorte e gravava outro.)*

⭐ **Segundo corolário:** entrar numa lista e produzir um efeito são **perguntas diferentes**.
Responder uma e escrever sobre a outra foi defeito três vezes.

## Sobre o que a tela diz

### 7. A tela não afirma intenção sobre pessoas

> **GATILHO:** *estou escrevendo uma frase sobre pessoas que não fizeram algo.*

*Caso:* *"do mais atrasado ao menos"* e *"quem está segurando"*, lidos imediatamente antes de a
gestora cobrar alguém ou cancelar a avaliação dele.

Quem não respondeu pode ter mil motivos. A tela mostra **contagem**, não veredito. E o vocabulário
se propaga: **quem escreve a próxima frase copia da anterior** — ao corrigir uma, varrer as
vizinhas.

### 8. Capacidade sem sinal na tela é capacidade que não existe

> **GATILHO:** *existe uma rota ou ação que a tela não oferece? Ou vou esconder um controle?*

*Casos:* a rota de reabrir sem botão; *"Definir avaliador"* que sumia de quem já tinha um; a
memória de cálculo atrás de um clique sem cursor nem seta.

E o par dela: **desabilitar com o motivo, nunca esconder**.

⚠️ **QUALIFICAÇÃO (09/09) — sem ela alguém "conserta" o botão certo:**

| Falta o quê | O que fazer |
|---|---|
| **objeto** — não há o que a ação faria | **some** |
| **permissão** ou **estado** — há objeto e algo impede | **desabilita com o motivo** |

*Caso:* o botão *Reabrir* na linha da Designação. Ele **some** em avaliação não enviada (não há o
que reabrir; um botão cinza convidaria a pessoa a procurar a permissão que lhe falta) e fica
**cinza com o motivo** em ciclo encerrado (*"reabra o ciclo primeiro"*), que é estado.

## Sobre o próprio trabalho

### 9. Passo que falha INTERROMPE o roteiro

> **GATILHO:** *um passo falhou ou foi recusado, e eu vou continuar.*

*Caso:* 07/09, script que seguiu depois de uma recusa da API e escreveu **84 avaliações** por
engano.

### 10. Token vencido é pedido a fazer, não obstáculo a contornar

> **GATILHO:** *vou contornar uma barreira de autenticação ou permissão para seguir.*

*Caso:* 08/09, senha adivinhada e JWT forjado — as duas bloqueadas, e bloqueadas **certo**.
⚠️ A regra é sobre **eu ir buscar**, não sobre o outro entregar.

### 11. Mudança em dado: isola, apaga em transação, confere depois

> **GATILHO:** *vou apagar ou alterar dado no banco.*

SELECT que isola primeiro, DELETE transacional, auditoria preservada — e o número conferido depois.
*Caso:* as cinco limpezas de ciclos descartáveis de 08/09, todas com *"0 respostas, 0 resultados"*
verificado **antes** de apagar.

### 12. Leitura de bundle minificado é HIPÓTESE, não fato

> **GATILHO:** *estou identificando código a partir de bundle, minificado ou decompilado.*

*Caso:* um `.slice(0, N)` identificado como *"lista de erros"* por **proximidade textual** a tokens
no bundle. A conclusão virou fato ao ser repassada e **priorizou o trabalho**. Varrido o fonte
depois: dos dois `.slice(0, 10)` suspeitos, **os dois eram conversão de data ISO**, e o
`.slice(0, 5)` **não existia no nosso código**.

⚠️ **CORREÇÃO (09/09) — a regra original proibiria o método que fechou o próprio caso.** Ela dizia
*"só o nome do símbolo sustenta identificação"*, e o `.slice(0, 5)` foi identificado **sem nome de
símbolo nenhum**: lendo o código ao redor e reconhecendo o teste de prefixo `data-`/`aria-` do
React DOM. A distinção certa é outra:

| Identifica | Não identifica |
|---|---|
| o **nome do símbolo**, quando sobrevive | **proximidade** de tokens |
| o **source map** | estar no mesmo bloco |
| a **semântica inequívoca do código ao redor** — ler o que ele **faz** | ler o que está **perto** |

O minificador reordena, inlina e junta módulos: dois símbolos vizinhos podem vir de arquivos que
nunca se viram. Na dúvida, `grep` no fonte.

⚠️ **Vale para os dois lados:** quem lê marca como hipótese; quem recebe **não promove a fato** ao
repassar.

### 13. Quando um defeito escapa, pergunte se escapou o CASO ou a FORMA

> **GATILHO:** *dei um assunto por encerrado e ele voltou.*

*Casos:* os três `_count` que contavam canceladas, e a segunda frase que prometia a reabertura.

Caso difícil se conserta **no sítio**; **forma não procurada se conserta no INSTRUMENTO**. Os três
`_count` escaparam porque o grep buscava `status: { not: 'CANCELADA' }` — a regra escrita — e eles
são exatamente onde ela **nunca foi escrita**; o conserto foi um varredor de fonte, não três
edições. A segunda frase escapou porque consertei **a que me apontaram**; o conserto foi varrer as
frases que citam a capacidade.

⭐ **O sinal é barato e não falha: defeito que volta depois de "resolvido" quase nunca é um caso a
mais — é a evidência de que a busca tinha um formato e o mundo tem outros.**

É da mesma família da **regra 3** (afirmar o fato, não a redação) e da **regra 5** (as duplicatas
vêm em bando): as três dizem que **verificar o que você lembra não é verificar o que existe** — a 3
sobre o que se lê, a 13 sobre o que se procura, a 5 sobre o que se conta.

### 14. O passo que ninguém testou não é o mais simples — é o menos conhecido

> **GATILHO:** *vou escolher o que testar.*

*Caso:* o ciclo de simulação de 09/09 rendeu **18 defeitos**, e **9 vieram do encerramento** — a
única etapa do processo que nunca tinha sido percorrida. Metade dos defeitos em um sexto do
caminho.

⚠️ A intuição é a oposta: a etapa não testada parece a mais simples **porque nunca deu problema** —
e nunca deu problema porque ninguém passou por ela. **Silêncio é ausência de observação, não de
defeito.**

⭐ A pergunta melhor não é *"o que parece frágil?"* — é **"qual passo deste processo nunca foi
percorrido inteiro, com dado real, até o fim?"**

---

# Parte 2 — as nove novas (15 a 23)

*Levantadas na varredura de 09/09: eram lições que já tinham virado item numerado, comentário de
código ou memória — mas nunca regra. A primeira é a que mais se repetiu no projeto inteiro.*

### 15. ⭐⭐ Dois números verdadeiros na mesma tela precisam do termo que os concilia

> **GATILHO:** *esta tela mostra dois números do mesmo assunto.*

**Três instâncias em dois dias, e nenhuma delas era um número errado:**

| Onde | Dizia | E também dizia | O que faltava |
|---|---|---|---|
| Cabeçalho do ciclo | `1036 no público` | `894 designados · 95 sem avaliador` | os **47 fora do ciclo** |
| Card e cabeçalho | `52 avaliações` | `Faltam 37 por enviar` | as **2 canceladas**, fora do denominador |
| Memória de cálculo | `Peso 60` | aba Aplicações: `Questionário 100,0%` | a **fração** que o 60 representa |

Nos três casos os dois números estavam certos e respondiam perguntas diferentes. Quem lia procurava
o erro — 40 pontos de critérios que não existiam, 47 pessoas que sumiram — e não achava, porque não
havia erro: havia **um termo intermediário que ninguém tinha escrito**.

⭐⭐ **A saída NÃO é escolher um dos dois.** Trocar o cabeçalho de 1036 para 989 "resolveria" a soma
**apagando da tela a existência dos excluídos**, que é uma decisão registrada de alguém. Mostram-se
os dois, com o termo que os liga.

⚠️ **Corolário:** termo de conciliação só aparece quando existe (`0 fora do ciclo` é ruído). Termo
de **estado** aparece zerado (`0 apuradas` diz em que passo o ciclo está).

### 16. O backend manda, o cliente descarta, e nada reclama

> **GATILHO:** *acrescentei ou mudei um campo no payload.*

Campo que o backend calcula e a tela não lê **some em silêncio** — sem erro, sem log, sem tipo
reclamando. O caminho inverso também: a tela mostra o campo errado e ninguém percebe porque os dois
existem.

*Casos:* `motivoCancelamento` gravado nas 39 avaliações e **sem nenhum lugar na tela**, enquanto a
linha mostrava a `justificativa` — que responde outra pergunta; o `amostra` que vinha desde sempre
e a tela mostrava só números; três casos em dois dias, **todos achados por conferência de tela,
nunca por teste**.

⚠️ A rede definitiva é gerar o cliente do backend ou ter teste de contrato. Enquanto não houver,
o gatilho é a defesa.

### 17. Mesmo fato, mesma palavra

> **GATILHO:** *vou nomear um campo novo.*

*Casos:* `adicionar` × `geramAvaliacao` (entrar na lista × virar avaliação); `barradosPelaRegua`
que contava **também exclusão manual**; `criar`/`atualizar`/`jaIguais` de um endpoint contra
`criar`/`substituir`/`nadaAFazer` de outro, para os mesmos três fatos.

Duas perguntas, sempre: **este campo já existe com outro nome noutro endpoint?** E: **o nome afirma
uma causa que o número não garante?** *(`barradosPelaRegua` afirmava régua e contava decisão de
gente — concordavam por acaso, 47 × 0.)*

⚠️ *Quebrei esta regra em 09/09 — ver o topo.*

### 18. Concordância de número tem UM jeito

> **GATILHO:** *estou escrevendo um número seguido de palavra.*

Existiam **três** convenções no mesmo módulo: 10 ternários `n === 1 ? … : …` (certos, reinventados
um a um), **19 frases erradas** (*"1 pessoas"*, *"1 ganham avaliador"*) e **56 fugas com `"(s)"`**.
Três jeitos é o mesmo que nenhum.

⚠️ **E o `"(s)"` não é neutro: ele PRODUZ erro.** *"1 pessoa(s) **adicionadas**"*, *"1
avaliação(ões) **estão ENVIADAS**"* — o substantivo foge da concordância e o verbo fica preso a
ela.

⭐ Para **gênero** não há dado (o cadastro não guarda); para **número** o dado está na mão —
escrever `"(s)"` é declinar de usar o que se tem. A regra de gênero é a voz ativa; a de número é o
helper.

⚠️ *Quebrei esta regra em 09/09, quatro horas depois de escrevê-la — ver o topo.*

── **A regra tem DOIS lados, e o do backend não é o helper** (09/09, tarde) ──

O helper resolve na TELA. No backend ele não pode existir: seria uma segunda implementação da
mesma regra de texto (o frontend já tem `lib/formato.ts`), que é a classe de defeito da regra 25.
E "migrar as frases para a tela" também não serve — **mensagem de recusa da API tem de existir
mesmo quando ninguém está olhando uma tela**.

A terceira saída é de FORMA, e sai mais barato que o helper: *"Designe as 1 pessoa(s)"* quebra;
*"Sem avaliador neste ciclo: 1"* não quebra com número nenhum.

⚠️⚠️ **E a receita curta não basta.** "Ponha o número num rótulo" conserta o número e deixa o
RESTO da frase flexionando. Medido: das dez primeiras frases reescritas, **três ainda quebravam com
1** e só apareceram depois do deploy — *"Designe para não **ficarem** de fora"* (infinitivo
pessoal), *"dividiu **essas linhas**"*, *"**Seguem** com o avaliador que **têm** … encontrá-**las**"*.
E a prova melhor: **eu escrevi *"As {n} respostas já dadas ficam registradas"* na tela uma hora
antes, enquanto catalogava esta mesma classe.**

⭐ **A regra, na forma que resiste:** *tire a contagem de qualquer palavra que concorde com ela —
**verbo e pronome inclusive**.* Palavras que não flexionam com nada (`quem`, `ninguém`, `cada uma`,
`essa pessoa`) são a saída pronta. E o teste final é ler a frase inteira **com o número 1**.

⭐ Fecho mecânico: `common/texto-sem-flexao.invariante.spec.ts` recusa a forma parentética e o
`${…}` colado a palavra que concorda. ⚠️ Ele **não** pega concordância distante (*"…e **elas ficam**
registradas"*) — a limitação está escrita no próprio teste, porque invariante que não declara o
buraco vira falsa segurança.

### 19. Texto que promete capacidade é dívida

> **GATILHO:** *escrevi "peça a X que faça Y", "para isso use Z", "se precisar, faça W".*

Pior que capacidade escondida (regra 8): ali a tela **cala** sobre algo que existe; aqui ela
**anuncia** algo que não existe.

**Dois agravantes:**
1. **A promessa é feita a OUTRA pessoa.** *"Peça ao RH que reabra a avaliação"* — e reabrir só
   existia na API. Quem descobre é o avaliador, pedindo o impossível; o RH descobre sendo cobrado.
2. **A promessa é a saída de um erro.** A mesma frase aparecia no diálogo de trocar avaliador de
   quem já respondeu — **exatamente quando a pessoa está prestes a errar**. Uma frase que desvia
   alguém de um erro só funciona se a saída existir; senão **empurra de volta**, com a autoridade
   de um conselho do sistema.

⚠️ Ao **implementar** a capacidade prometida, varrer as frases que já a citam. Eram **duas**.

### 20. Diálogo de ato irreversível diz o que se PERDE

> **GATILHO:** *estou escrevendo um diálogo de confirmação.*

Diálogo lista naturalmente **o que se ganha**. O que decide é **o que se perde**.

*Casos:* *encerrar com pendência* falava das respostas preservadas e da fila que libera, e **nada**
sobre o cancelamento não ter volta; *reabrir o ciclo* prometia *"volta a permitir designar, apurar"*
— que alguém que encerrou por engano lê como **"desfaz o encerramento"**. Não desfaz.

⭐ **E o par:** todo ato que a tela apresente como reversão escreve **"o que isto NÃO faz"**, com o
número do que fica. Meia verdade num ato que a pessoa aciona **para consertar outro** custa o
dobro.

### 21. Tela que atribui trabalho diz se a pessoa consegue executá-lo

> **GATILHO:** *esta lista mostra pessoas com tarefas atribuídas.*

*Caso:* **24 de 50 designações (48%)** estavam em avaliadores **sem conta na plataforma**, e a fila
os mostrava com a mesma barra e o mesmo *"N a fazer"* dos demais. O ciclo abriria, o prazo
correria, e metade nunca seria respondida — sem erro, sem log. O defeito só apareceria quando
alguém fosse **cobrar a pessoa errada**.

Designar, atribuir, encaminhar — **nenhum desses atos verifica acesso**, e a lista resultante
parece igualmente viável em todas as linhas.

⭐ **Aviso, nunca bloqueio:** a atribuição é legítima; o que falta é conta, que é ato de outra
pessoa. E o rótulo muda junto: *"13 paradas"*, não *"13 a fazer"* — **"a fazer" pressupõe que dá
para fazer**.

### 22. Texto do estado anterior sobrevive à mudança de estado

> **GATILHO:** *esta tela tem mais de um estado.*

*Casos:* a linha de estado que mentia entre a gravação e o F5; *"Montar público continua valendo"*
num ciclo **encerrado**, com o botão ao lado desabilitado e a faixa do topo dizendo o contrário;
*"Monte o público que falta"* mandando a pessoa a uma tela onde nada é clicável.

⭐ **Quem lê acredita no texto, não no botão cinza.**

⚠️ E o que muda é a **instrução**, não o número: *"937 fora de todas as aplicações"* continua
verdadeiro e útil no ciclo fechado — é ele que diz o tamanho do buraco.

### 23. Guard repetido em N lugares vira teste que varre o FONTE

> **GATILHO:** *estou escrevendo a mesma guarda ou condição pela terceira vez.*

Revisão caso a caso falha sempre na rota que ninguém revisou — no RDV da Logística o mesmo furo
reapareceu **quatro vezes** antes de virar teste.

⚠️ **Duas armadilhas do próprio varredor**, as duas medidas em 09/09:
1. **Varra por FORMA, não pela regra escrita.** Um varredor que procura `status: { not: 'CANCELADA' }`
   não acha os `_count: { select: { avaliacoes: true } }` — que são exatamente onde a regra nunca
   foi escrita. Perguntar antes: **de quantas formas dá para fazer isto?**
2. **Dispensa por CHECAGEM, nunca por arquivo.** Um arquivo dispensado por um motivo legítimo de
   *outra* checagem ficou isento da que importava — e era o arquivo do defeito. Só a mutação
   (regra 2) denunciou.

⭐ E o varredor precisa de **um teste de que ele reconhece a forma errada** — senão um regex que
deixou de casar passa a aprovar tudo em silêncio.

── **Evidência de que eles funcionam: pegaram trabalho NOVO, sozinhos** ──

Duas vezes na semana de 09/09, um invariante barrou código novo **antes de qualquer revisão**:

| Quando | O que pegou |
|---|---|
| Ao extrair `STATUS_VIVOS` e `MODULO` | `fonte-unica.invariante` — validado por mutação: os três literais reintroduzidos, os três pegos |
| Ao acrescentar a ação `contestar` ("não é minha equipe") | **os DOIS guardas ao mesmo tempo**: o `Record` de `EXIGENCIA_POR_ACAO` recusou COMPILAR até a ação declarar o que exige, e o spec que lista as ações quebrou em seguida |

⭐ O segundo caso é o que vale citar: os dois guardas cobrem a mesma regra por caminhos
diferentes — **tipo** e **teste** —, e nenhum dos dois foi escrito pensando em `contestar`. O
autor da ação nova não precisou saber que a regra existia; a regra o encontrou. É a diferença
entre uma convenção documentada e um invariante: a convenção depende de alguém lembrar.

---

# Parte 3 — como trabalhamos

*Outra natureza: não são de engenharia, são de relação de trabalho. Ficam separadas de propósito —
misturadas com as 23, diluem a lista.*

| | Regra | Onde nasceu |
|---|---|---|
| T1 | **Análise profunda, não concordância.** Em proposta de arquitetura ou UX: mapear, dar alternativas, **recomendar uma** | `feedback_analise_profunda_nao_concordar` |
| T2 | **Solução robusta em vez de paliativa** — o paliativo que "economiza" cobra depois | `feedback_preferir_solucao_robusta` |
| T3 | **Corrigir tudo agora** quando a varredura revelar latentes do mesmo tópico | `feedback_corrigir_tudo_agora` |
| T4 | **Entrega incremental**: sub-fases verificadas e commitadas, checkpoint a checkpoint | `feedback_entrega_incremental_subfases` |
| T5 | **Testando com a skill do Chrome: sem deploy no meio** — e anotar o commit testado | `feedback_teste_chrome_sem_deploy_no_meio` |
| T6 | **Rebuildar o frontend antes de mandar testar tela** — senão o teste valida código velho | `feedback_rebuildar_frontend_antes_de_testar` |

---

# Parte 4 — índice das estreitas

*Reais, mas de alcance menor: valem consulta, não decoram. Uma linha cada, apontando para a
memória.*

| Regra | Memória |
|---|---|
| A API **recusa** para a tela poder perguntar — e recusa **com o dado** (quantos, quais) | `feedback_api_recusa_para_a_tela_perguntar` |
| Regra duplicada envelhece errada — **extrair, não re-derivar** | `feedback_regra_duplicada_envelhece_errada` |
| Sweep proativo de variantes **antes** de dar por resolvido | `feedback_sweep_proativo_variantes` |
| Regra **escrita** vence comentário de código | `feedback_regra_escrita_vence_comentario` |
| Rótulo ausente diz **"desconhecido"**, nunca chuta | `feedback_rotulo_ausente_nunca_e_palpite` |
| No gate de segurança, revisar o **delta** não basta — a pergunta é sobre o **estado** | `feedback_security_review_delta_nao_basta` |
| Automação que **revoga acesso** precisa de freio | `feedback_rotina_que_desativa_precisa_de_freio` |
| Reconheça o **sintoma**, não só a causa — um 403 que parece falta de permissão | `feedback_chapa_colide_5_digitos` |
| Voz **ativa**: nada de particípio concordado em gênero | `ESTADO §3.1.7` |
| Botão com **cor própria** troca de cor ao desabilitar, não fica translúcido | `ESTADO §3.1.50` |
| Antes de manter uma validação, confirmar **o que de fato decide** o resultado | `feedback_trava_confirmar_o_que_decide` |

---

### 24. ⭐⭐ Guarda mais externa e mais burra sequestra a mensagem da mais interna e melhor

> **GATILHO:** *a mesma condição é checada em duas camadas — e só uma delas sabe explicar.*

Caso que a nomeou (09/09): reabrir o ciclo passou a exigir motivo de 15 caracteres, e o número
foi para o `@MinLength(15)` do DTO. O service já tinha a checagem — e a mensagem que **ensina**:
*"Ele fica registrado no ciclo e na auditoria — é o que responde, meses depois, por que um ciclo
encerrado voltou a aceitar mudança. Escreva pelo menos 15 caracteres — faltam 12."*

O class-validator responde **primeiro**. O que chega a quem chamou é *"motivo must be longer than
or equal to 15 characters"* — em inglês, sem dizer para que serve o campo, sem dizer quantos
faltam. A frase boa virou **código morto sem deixar rastro**: nenhum teste quebra, nenhum aviso,
o comportamento fica "correto" e a explicação some.

⭐ **A regra:** quando duas camadas checam a mesma coisa, a **externa é piso** — recusa o
absurdo — e a **interna é a regra**, porque é ela que tem o contexto para explicar. Endurecer a
externa até o nível da interna é o que mata a mensagem.

⚠️ **O sintoma é invisível pelo lado de dentro.** A checagem interna continua lá, continua certa,
continua testada — e nunca mais executa. Procure por ela do lado de FORA: mande a requisição
inválida e leia o que volta. Se o texto não é o que você escreveu, alguém está respondendo antes.

⚠️ **Não vale só para DTO × service.** Vale para o guard antes do service, o `disabled` do botão
antes da recusa da API, a validação do formulário antes do backend. Toda vez que a camada de fora
fica tão esperta quanto a de dentro, a de dentro para de falar.

### 25. ⭐ Ao extrair uma constante ou função, varra os literais dela no MESMO commit

> **GATILHO:** *acabei de criar uma fonte única para algo que já existia espalhado.*

A extração é a parte fácil e é a que dá a sensação de pronto. O que fica para trás são os
**chamadores anteriores**, que continuam com o valor escrito à mão: compilam, passam nos testes e
dizem a mesma coisa — até o dia em que a constante muda e eles não.

Varredura de 09/09/2026 no `gestao-pessoas`: **seis casos, todos da mesma forma** — a fonte única
criada DEPOIS dos chamadores, e o commit que a criou não varreu. Não é distração de uma pessoa: é
o que acontece por padrão quando o commit termina no arquivo novo.

O pior deles mostra por que isto não é higiene: `encerrarCiclo` contava as avaliações pendentes com
uma cópia da lista e as cancelava com outra — **as duas metades do mesmo ato**, escritas à mão a 30
linhas de distância. Iguais naquele dia. Divergindo, a recusa fala de um conjunto e o encerramento
cancela outro, sem erro nenhum, sobre avaliação de gente.

⭐ **O sinal de busca importa mais do que a disposição de procurar.** Duas perguntas foram feitas no
mesmo dia sobre o mesmo código:

| Pergunta | Resultado |
|---|---|
| *"exportado que ninguém importa"* | 58 achados, quase todos ruído — e nenhum dos seis casos |
| *"constante cujo valor literal aparece escrito fora dela"* | os **seis**, sem ruído |

A primeira pergunta procura um **estado suspeito**; a segunda descreve **a forma exata do defeito**.
Vale para toda varredura: gaste o tempo formulando a pergunta, não lendo os 58.

⚠️ **Duas coisas que a varredura NÃO deve fazer:**
- **Unificar por semelhança.** `normalizarChapa` (`E01981` → `001981`) e `normalizarMatricula`
  (`1741` → `001741`, o zero que o Excel comeu) parecem a mesma função e cobrem corrupções
  opostas. Onde duas coisas parecidas são de propósito, **escreva ao lado por quê** — a próxima
  varredura é que vai ler, e ela pode ser sua.
- **Trocar por equivalência aparente.** `ehProprioAvaliado(a, b)` e `a === b` divergem quando falta
  id: o `===` responde `true` para dois nulos. Onde a função existe, ela existe por causa da borda.

⭐ Quando a fonte única é do tipo que **N lugares consomem**, o fecho é a regra 23: um teste que
varre o fonte (`common/fonte-unica.invariante.spec.ts`) e falha se o literal reaparecer. Sem ele, a
varredura vale para o commit de hoje e para mais nenhum.

── **O gatilho não pegou. Três vezes em dois dias** (09/09, noite) ──

`MOTIVO_MINIMO` (extraído, ninguém importava) · `STATUS_VIVOS` (extraído, dois chamadores com o
literal à mão) · `flexao`/`contagem` (**importados no próprio arquivo, três linhas acima da frase
que não os usou**). O terceiro é o que desmente a explicação fácil: não é desconhecimento da fonte
única, é que **escrever a frase e lembrar da fonte são dois atos, e o segundo não tem gatilho
natural.**

⭐ **A conclusão tem duas metades, e elas dependem do TIPO:**

| Tipo de fonte única | Dá invariante genérico? |
|---|---|
| **Constante com valor literal distintivo** (string, lista de strings) | **Sim, e genérico**: derivar do próprio `export` e varrer a árvore pelo valor. É mecânico e não precisa de lista escrita à mão — o que hoje é `fonte-unica.invariante` caso a caso pode virar automático |
| **Constante numérica curta** (`3`, `15`, `100`) | Não — `15` aparece legitimamente em mil lugares. Só caso a caso, pelo CONTEXTO (foi assim no `motivo.invariante`: `@MinLength` + campo de motivo) |
| **Função helper** (`flexao`, `normalizarChapa`) | **Não existe genérico.** "Deveria ter usado" é semântico. O que existe é um detector da FORMA ERRADA, um por helper — `texto-sem-flexao.invariante` é isso para o `flexao` |

⚠️ Onde não há invariante, **a resposta é cadência escrita — e cadência sem momento é a mesma
regra sem gatilho que este arquivo inteiro condena.** O momento é o do **roteiro de tela**: antes
de mandar alguém percorrer a tela, rodar a varredura de forma dos helpers do módulo. É o único
ponto do processo em que alguém já vai olhar texto com atenção, e é barato (segundos). Fora dele,
a classe volta.

⭐⭐ E o invariante que se escreve para isso **declara o próprio buraco**. A frase que ficou no
`texto-sem-flexao.invariante.spec.ts`, e que vale para qualquer varredor: *"Um verde aqui NÃO é
prova de que a frase está certa com 1; é prova de que as duas formas conhecidas não estão nela."*
Varredor que não diz o que não alcança vira falsa segurança — e falsa segurança é pior que
varredor nenhum, porque encerra a busca.

---

### 26. ⭐⭐ Duas varreduras do mesmo alvo podem não se cruzar em nada — e ambas estarem certas

> **GATILHO:** *duas buscas pelo mesmo defeito deram listas que não se sobrepõem.*

É a regra 14 pelo avesso. Lá, o perigo é **o passo que ninguém percorreu**; aqui é **o RAMO que
ninguém percorreu** — dentro de um passo que foi percorrido inteiro.

Caso que a nomeou (09/09): duas varreduras atrás do mesmo defeito de concordância no
`gestao-pessoas`.

| Método | Achou |
|---|---|
| Leitura de FONTE (grep por `(s)` / `(ões)`) | 17 frases, todas no backend |
| Percurso de TELA (roteiro de 7 passos, ciclo real) | **zero** dessas 17 — e 4 outras, que o fonte não pega, do tipo *"1 de 1 enviadas"* |

**Interseção: vazia.** E nenhuma das duas estava errada. As 17 moram em ramos `RASCUNHO`/`ABERTO`
(o rótulo de "próximo passo", a confirmação do Excluir, a prévia do Designar) e o roteiro percorreu
um ciclo **ENCERRADO**, que entra por outro ramo do mesmo `if`. As 4 da tela são texto composto em
tempo de render, que grep nenhum acha por padrão de string.

⚠️ **O erro que isso quase produziu** foi de conclusão, não de busca: *"nenhum `(s)` renderizado,
logo essas frases não chegam à tela"*. Falso — pelo menos 10 das 17 renderizam no caminho normal;
o que não aconteceu foi o percurso passar por elas. **"Não apareceu" é fato sobre o CAMINHO, nunca
sobre o código.**

⭐ **A regra:** interseção vazia entre dois métodos **não valida nem invalida** nenhum dos dois —
é sinal de que eles cobrem regiões diferentes. Antes de concluir qualquer coisa da diferença,
pergunte **o que cada método NÃO alcança**: o fonte não alcança texto composto em render; o
percurso não alcança ramo não visitado. A união é o alvo; a interseção não é medida de nada.

⚠️ Corolário para quem manda percorrer: um roteiro sobre **um estado só** (aqui, o ciclo
encerrado) mede um ramo só. Se o alvo é texto que varia com o estado, o roteiro precisa dizer
**em que estados** passar — ou o relatório vem verdadeiro e incompleto, que é o mais difícil de
perceber.

---

## Descartadas, com motivo

*Candidatas que não fecharam gatilho — e, pelo critério deste arquivo, isso é o sinal de que são
nota e não regra.*

| Candidata | Por que ficou de fora |
|---|---|
| *"Prévia grava o que mostrou"* | **Fundiu na regra 6** — o gatilho que saiu era o mesmo. É o corolário de identidade dela, não regra nova. |
| *"Fila ≠ gate de leitura"* | Decisão de domínio do módulo. Não transfere. |
| *"Identidade vem do banco, não do JWT"* | Arquitetura, não método — vale como ADR. |
| *"Questionar premissas de design"* | Postura permanente, sem momento. Postura permanente não pega ninguém. Coberta pela T1. |

---

*Criado em 09/09/2026, a partir da §5.9 do `docs/ESTADO-DO-PROJETO.md` mais a varredura de
`docs/VARREDURA_REGRAS_DE_METODO_09SET.md`. A §5.9 continua existindo como âncora — há comentários
de código que a citam — e aponta para cá.*
