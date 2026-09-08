# Varredura — lições de método que NÃO viraram regra

**09/09/2026** · levantamento para decidir o que entra no arquivo próprio.
**Nada foi movido ainda.** A §5.9 tem 14; a varredura achou **mais 21 candidatas**.

> Critério: lição **transferível** — vale para outro módulo, outra pessoa, outro mês. Ficaram de
> fora as ~80 memórias que são fato de projeto (portas, credenciais, comportamento do Protheus,
> convenções da Logística), que são referência e não método.

---

## A. Fortes — eu levaria as 9 sem discutir

| # | Regra | Onde está hoje | Gatilho proposto |
|---|---|---|---|
| A1 | **Dois números verdadeiros na mesma tela precisam do termo que os concilia** | §3.1.29, §3.1.38, §3.1.44 — **três instâncias, nenhuma regra** | *"Esta tela mostra dois números do mesmo assunto? Um explica o outro, ou o leitor tem de adivinhar a diferença?"* |
| A2 | **O backend manda, o cliente descarta, e nada reclama** | §3.1.9 (chamada "A CLASSE") + memória | *"Acrescentei campo no payload — quem consome já lê? E o que a tela mostra hoje sai de qual campo?"* |
| A3 | **Mesmo fato, mesma palavra** — vocabulário colide entre payloads | §3.1.32 + a violação de hoje | *"Este campo novo já existe com outro nome em outro endpoint?"* |
| A4 | **Concordância de número tem UM jeito** — nunca `"(s)"`, nunca ternário à mão | §3.1.35 + memória | *"Estou escrevendo um número seguido de palavra? Usei o helper?"* |
| A5 | **Texto que promete capacidade é dívida** — pior se promete a OUTRA pessoa | §3.1.41, §3.1.45 + memória | *"Escrevi 'peça a X que faça Y' / 'para isso, use Z'? Y e Z têm caminho em tela para quem executa?"* |
| A6 | **Diálogo de ato irreversível diz o que se PERDE; o que 'desfaz' diz o que NÃO desfaz** | §3.1.47 + memória | *"Estou listando o que este ato faz. E o que ele destrói? E o que ele NÃO desfaz?"* |
| A7 | **Tela que atribui trabalho diz se a pessoa consegue executá-lo** | §3.1.37 + memória | *"Esta lista mostra pessoas com tarefas. Todas conseguem entrar para fazer?"* |
| A8 | **Texto do estado anterior sobrevive à mudança de estado** | §3.1.19, §3.1.48 — duas instâncias | *"Este texto é verdade nos DOIS estados da tela? Ele fala de algo que o botão ao lado já proíbe?"* |
| A9 | **Guard repetido em N lugares vira teste que varre o FONTE** | memória (precursora da regra 13) | *"Estou escrevendo a mesma guarda pela terceira vez?"* |

⭐ **A1 é a mais forte da lista inteira** — é o padrão que mais se repetiu no projeto (três vezes em
dois dias), e é o único da tabela que **não tem nenhuma regra escrita em lugar nenhum**.

---

## B. Boas, mas mais estreitas — decisão sua

| # | Regra | Onde está | Gatilho proposto |
|---|---|---|---|
| B1 | **Voz ativa: nada de particípio concordado em gênero** | §3.1.7, já rotulada "REGRA DE TEXTO" | *"Escrevi um particípio sobre uma pessoa?"* |
| B2 | **A API recusa para a tela poder perguntar** — recusa com o DADO (quantos/quais) | memória | *"A tela precisa avisar ou confirmar? Então a API recusa, e diz quantos."* |
| B3 | **Regra duplicada envelhece errada — extrair, não re-derivar** | memória | *"Estou copiando esta condição para um segundo lugar?"* |
| B4 | **Sweep proativo de variantes ANTES de dar por resolvido** | memória | *"Corrigi um caso. Onde estão os irmãos dele?"* — ⚠️ é quase a regra 13 pelo lado preventivo |
| B5 | **Regra escrita vence comentário de código** | memória | *"Vou declarar isto intencional. Onde está escrito?"* |
| B6 | **Rótulo ausente diz 'desconhecido', nunca chuta** | memória | *"Este identificador pode não existir? O que aparece então?"* |
| B7 | **Revisar o DELTA não basta — a pergunta é sobre o ESTADO** | memória (gate de segurança) | *"Estou revisando o diff. A pergunta era sobre o diff ou sobre o que está no ar?"* |
| B8 | **Automação que revoga acesso precisa de freio** | memória | *"Esta rotina desativa em massa? Distingue 'não existe' de 'não consegui ver'?"* |
| B9 | **Reconheça o SINTOMA, não só a causa** — um 403 que parece falta de permissão | §3.1.25 | *"Este erro tem a cara de outro problema? Quem investigar vai ao lugar errado?"* |
| B10 | **Botão com cor precisa TROCAR de cor ao desabilitar** | §3.1.50 | *"Este botão tem cor própria e pode ficar desabilitado?"* |

---

## C. Sobre como trabalhamos — método, mas de outra natureza

| # | Regra | Onde está |
|---|---|---|
| C1 | Análise profunda, com alternativas e recomendação — não concordar | memória |
| C2 | Solução robusta em vez de paliativa | memória |
| C3 | Corrigir tudo agora quando a varredura revelar latentes | memória |
| C4 | Entrega incremental em sub-fases commitadas | memória |
| C5 | Testando com a skill do Chrome: **sem deploy no meio** | memória |
| C6 | Rebuildar o frontend antes de mandar testar tela | memória |

⚠️ **Estas seis são de relação de trabalho, não de engenharia.** Se entrarem, entram numa seção
própria — misturadas com as outras, diluem a lista.

---

## D. As que eu NÃO consigo formular gatilho — sinal de que são nota, não regra

| Candidata | Por que não fecha |
|---|---|
| *"Prévia grava o que mostrou"* (§3.1.10) | O gatilho já é o da regra 6 (*"a prévia vem de quem decide"*). Não é regra nova: é o **corolário de identidade** dela. Fundiria na 6, não separaria. |
| *"Fila ≠ gate de leitura"* | É decisão de domínio do módulo, não método. Não transfere. |
| *"Identidade vem do banco, não do JWT"* | É arquitetura, não método. Vale como ADR. |
| *"Questionar premissas de design"* | Não consigo formular um momento — é postura permanente, e postura permanente não pega ninguém. Ou vira C1, ou sai. |

---

## E. O que a §5.9 tem hoje e precisa mudar (já acordado)

1. **Toda regra ganha gatilho.** ⚠️ **A 3 e a 5 não têm** — e são exatamente as duas que eu quebrei
   hoje depois de escrevê-las. Propostos:
   - **3** → *"Estou afirmando texto num teste. Existe uma função que produz esse texto?"*
   - **5** → *"Dois lugares mandam este mesmo campo. Qual deles é o dono do fato?"*
2. **12 corrigida:** semântica inequívoca do código ao redor identifica; proximidade de tokens não.
   É ler o que o código **faz** contra ler o que está **perto**. (A regra atual proibiria o método
   que fechou o próprio item.)
3. **8 qualificada:** falta de **objeto** some; falta de **permissão** ou de **estado** desabilita
   com o motivo.
4. **13 com a referência consertada:** ela cita *"a terceira"* apontando para o corolário das
   duplicatas, que não é regra numerada.
5. **As três que eu quebrei hoje entram como evidência**, com nome: a concordância (§3.1.35,
   quebrada em horas), os dois nomes do mesmo fato (regra 5), e o spec que afirma a redação
   (regra 3). Não como confissão — como o argumento de que **regra sem gatilho não pega nem quem a
   escreveu**.

---

## Contas

| | |
|---|---|
| Regras hoje na §5.9 | **14** |
| Candidatas fortes (A) | **9** |
| Candidatas estreitas (B) | **10** |
| Relação de trabalho (C) | **6** |
| Descartadas com motivo (D) | **4** |
| **Máximo se tudo entrar** | **39** |

⚠️ **39 é lista que ninguém lê.** Minha recomendação: **14 + A (9) = 23**, com C numa seção
separada no fim e B virando um índice de uma linha cada, apontando para a memória. Mas a decisão é
sua — trouxe todas para você ver o tamanho real antes de escolher.
