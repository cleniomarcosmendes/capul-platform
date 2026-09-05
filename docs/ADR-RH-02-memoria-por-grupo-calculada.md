# ADR-RH-02 — a nota por grupo é calculada na leitura, não materializada

**Status:** aceito · **Data:** 05/09/2026 · **Decide:** Clenio (T.I.)
**Contexto:** reestruturação do modelo do módulo Gestão de Pessoas (peso na pergunta,
critérios na aplicação, avaliar ≠ apurar).

---

## Decisão

O relatório mostra a nota por grupo agrupando as **respostas** por `Pergunta.grupoId`, em
tempo de leitura. **Não existe tabela de resultado por grupo, e não deve passar a existir.**

`rh.resultado_criterio` materializa a memória de cálculo **por critério cadastral** —
escolaridade, tempo de casa, cursos. Não por grupo do questionário. São coisas diferentes
e a semelhança dos nomes é justamente o risco.

## Por quê

**1. Grupo virou organização visual.** Depois que o peso saiu do grupo e foi para a
pergunta, grupo não participa de conta nenhuma: é como as perguntas aparecem na tela e no
relatório. Materializar o resultado de algo que não entra no cálculo cria um número que
precisa ser mantido em sincronia sem ter dono.

**2. O dado já está lá, completo e imutável.** As respostas ficam em `rh.resposta`, com o
valor da alternativa escolhida, e a versão do modelo publicada é imutável. Reagrupar por
`grupoId` devolve sempre o mesmo resultado — não é cache de coisa cara, é uma soma sobre
poucas dezenas de linhas por avaliação.

**3. Materializar cria uma segunda verdade.** Se a nota por grupo fosse gravada, uma
reapuração passaria a ter dois lugares para atualizar, e o dia em que um deles não fosse
atualizado ninguém perceberia — o relatório continuaria mostrando um número plausível.
É o mesmo tipo de divergência silenciosa que este módulo já encontrou no `NVL` do select
antigo e nas réplicas do `SR7010`.

## O que NÃO é motivo para reabrir

- *"O relatório ficou lento."* Meça antes: são poucas linhas por avaliação e o índice
  `pergunta(grupo_id, ordem)` já existe. Se um dia doer de verdade, a saída é cache de
  leitura com invalidação explícita — não uma coluna nova em `resultado_avaliacao`.
- *"`resultado_criterio` grava por critério, então por simetria deveria gravar por
  grupo."* Não é simetria: critério tem peso próprio na apuração e faixa aplicada, e o
  valor bruto vem de fora (Protheus). Grupo não tem nada disso.

## O que reabre

Um requisito de negócio que dê **peso próprio ao grupo** — aí grupo volta a participar do
cálculo e a materialização passa a fazer sentido. Foi exatamente o que se removeu em
05/09/2026, e por um motivo: peso em dois níveis (grupo e pergunta) tornava impossível
prever o efeito de mudar um número.

## Consequência prática

Quem for escrever o relatório: agrupe por `Pergunta.grupoId`, some
`resposta.valor × pergunta.peso` no numerador e `maior_valor_da_pergunta × pergunta.peso`
no denominador — a mesma fórmula da nota do questionário, restrita ao grupo. A tela de
montagem usa `somatorioPorGrupo()` (`src/modelo/publicacao.validator.ts`), que já exibe o
peso total de cada grupo para o RH enxergar o balanço sem calcular na mão.
