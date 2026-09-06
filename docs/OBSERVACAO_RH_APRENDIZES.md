# Aprendizes na avaliação — por que "incluir ou excluir" era a pergunta errada

**Data:** 05/09/2026 · **Para:** conversa com a gestora de RH
**Situação:** 31 aprendizes ativos (17 "Aprendiz em Comércio", 14 "Aprendiz Aux.
Administrativo"), categoria SEFIP `07`, dentro dos 1.036 colaboradores do quadro.
**Decisão tomada:** eles **entram** no ciclo, com **aplicação própria**.

---

## O problema

Um aprendiz fica no **piso de todos os critérios cadastrais**, por definição do que é ser
aprendiz — não por desempenho:

| Critério | Onde o aprendiz cai | Por quê |
|---|---|---|
| Escolaridade | degrau mais baixo | está cursando o ensino médio |
| Tempo de empresa | menos de 1 ano, ou pouco mais | o contrato é de até 2 anos |
| Tempo na função | menos de 1 ano | entrou agora, na primeira função |
| Treinamentos | zero ou perto disso | ainda não passou pelos ciclos de curso |

No modelo em que os critérios cadastrais pesam ~40% da nota, isso significa que **o
aprendiz começa com ~40% da avaliação travada perto do mínimo antes de alguém responder
uma única pergunta**. Ele seria medido pela idade e pelo tempo de contrato, não pelo
trabalho — e a nota tem consequência de mérito.

Excluir também não resolve: o aprendiz deixa de receber devolutiva justamente na fase em
que ela mais serve.

## A saída, que é configuração e não código

Uma **Aplicação própria para aprendizes**:

- questionário adequado ao que se espera de um aprendiz (a gestora define as questões e
  os pesos);
- **sem critérios cadastrais** — ou, o que dá no mesmo, sem nenhum `AplicacaoCriterio`;
- `pesoAvaliacao` sozinho no denominador, então a nota final **é** a nota do
  questionário: 100% desempenho observado.

O mecanismo de Aplicação já suporta isso — é a mesma peça que permite questionário
diferente para loja, fábrica e administrativo. **Aplicação sem nenhum critério é válida**,
e há teste garantindo que continue sendo (`ciclo/abertura.validator.spec.ts`: *"aceita
aplicação SEM critério algum, desde que o questionário tenha peso"*, e
`calculo/apuracao.spec.ts`: *"aplicação sem critério nenhum funciona"*).

Nada disso exige deploy: é montar a aplicação na tela do ciclo e apontar os centros de
custo, ou designar os aprendizes manualmente para ela.

## O que a régua faz e o que ela não faz

A régua de elegibilidade (`src/designacao/elegibilidade-ciclo.ts`) **não tem nenhuma
regra sobre aprendizes**. Eles entram na lista inicial como qualquer outro colaborador, e
a designação é que os encaminha para a aplicação certa. Foi decisão consciente: são 31
pessoas e a leitura varia caso a caso — régua binária no código endureceria o que precisa
ser julgamento.

## O que vale conferir com o RH

1. O questionário dos aprendizes deve ter as mesmas questões dos demais, ou um recorte
   próprio? (Assiduidade, conduta e iniciativa fazem sentido; "atendimento ao cliente"
   depende de onde ele está alocado.)
2. Aprendiz avaliado por quem — o supervisor da área, ou quem acompanha o programa?
3. A nota do aprendiz entra na mesma régua de conceitos (0–25–50–75–90–100) ou é lida
   separadamente?

---

## Sobre a régua de conceitos — decisão tomada em 05/09

O ponto acima é real: **sem critérios cadastrais o denominador é outro**, então um 80 de
aprendiz e um 80 de mensalista não medem a mesma coisa. O do aprendiz é 80 de
questionário puro; o do mensalista mistura questionário e critérios cadastrais em pesos
diferentes.

**Não se mudou nada no cálculo** — mudar a régua de conceitos por aplicação criaria duas
escalas de "Supera" na mesma empresa, que é exatamente o que os conceitos no CICLO (e não
no modelo) existem para evitar.

O que se faz é **tornar a diferença visível**: o relatório mostra a **APLICAÇÃO ao lado da
nota**, sempre. Assim, ao comparar duas linhas, fica evidente que vieram de réguas
distintas — em vez de a diferença ficar escondida atrás de dois números do mesmo tamanho.

Fica como observação para a gestora: ao ler o consolidado, **comparar dentro da mesma
aplicação**. Comparar aprendiz com mensalista pela nota final é comparar duas medidas
diferentes, mesmo quando o número é igual.
