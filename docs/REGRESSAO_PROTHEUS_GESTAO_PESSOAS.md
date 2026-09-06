# Regressão do motor de cálculo contra o Protheus

**Data:** 05/09/2026 · **Base:** `capulmig` (Oracle 192.168.7.92:1521), somente leitura
**Ciclo comparado:** RD8010 modelo `000006` / tipo `000008` — o último ciclo real de
avaliação da Capul. Data-base **30/11/2025**, confirmada em `RDU010` (código `000014`,
"AVALIACAO GERAL 2025", de 01/10 a 30/11/2025). A primeira versão deste documento inferia
31/10/2025 pelo `RDB_DTFAVA` da maioria das linhas — ver a correção no item 2.
**Script:** `gestao-pessoas/backend/scripts/regressao-protheus.ts`

> O lado "antigo" é uma **reconstrução do comportamento documentado**: o texto do select
> original não está no repositório. As faixas usadas são as mesmas do seed, que vieram
> dele. Onde a reconstrução podia divergir do original, está dito abaixo.

---

## Conclusão

**Nenhuma divergência sem explicação.** Todas as diferenças caem em uma das quatro
correções conhecidas, e nenhuma aparece onde não deveria.

| # | Correção | Efeito medido |
|---|---|---:|
| 1 | Divisão fixa por 18 → denominador calculado | **0 divergências** em 108 |
| 2 | Tempo na função: última linha do SR7 → última **troca** de função | **107 de 108** saíam com a **nota mínima** |
| 3 | Renormalização (o `NVL` fora da soma) | 0 sem escolaridade · 1 sem registro de função |
| 4 | `current_date` → `ciclo.dataBase` | deriva de **+0,85 ano** no tempo de empresa |

---

## A amostra, e por que ela é de 108 pessoas

O ciclo `000006` tem **905 avaliados** e 13.613 respostas. Deles:

| | Pessoas |
|---|---:|
| ainda ativos no cadastro | **108** |
| já demitidos | 377 |
| **sem nenhuma linha em `SRA010`** | **488** |

⚠️ As 488 não são rotatividade: a matrícula **não existe** no `SRA010` de `capulmig`
**nem** de `capulhlg` (conferido: zero linhas na faixa `0066xx` nas duas bases). O
cadastro de pessoal dessas bases é parcial — a base de avaliação tem gente que a de
pessoal não tem. Não invalida a comparação, que é entre **fórmulas** sobre os mesmos
dados, mas convém saber antes de tirar qualquer conclusão populacional daqui.

Completude das respostas no ciclo: **902 pessoas com as 15 questões**, 1 com apenas 8
(avaliação incompleta) e **2 avaliadas em duplicidade** (30 e 45 respostas — 2× e 3× o
questionário). No modelo novo o `@@unique([cicloId, avaliadoId])` impede a duplicidade
e o envio recusa questionário incompleto.

---

## 1. Nota do questionário — 108 de 108 idênticas

O select antigo dividia por **18 fixo**. O novo divide por `Σ(maior valor × peso)`.

Com as 15 questões respondidas e todos os pesos iguais a 1, `Σ = 15 × 1,2 = 18` — os dois
dão exatamente o mesmo número. **É o resultado esperado, e é a melhor evidência de que o
motor novo reproduz o antigo onde nada mudou.**

A correção só se manifesta quando o instrumento muda: acrescentar uma 16ª questão levava
a nota acima de 100 no modelo antigo, sem acusar erro. Há teste cobrindo isso
(`nota-avaliacao.spec.ts`).

## 2. Tempo na função — 107 de 108 saíam com a nota mínima

⚠️ **Correção de uma afirmação da primeira versão deste documento.** Estava escrito que o
critério "vinha zerando" para toda a folha. **Não zerava: entregava a nota mínima.** A
diferença importa para a conversa com o RH, e a conta abaixo mostra por quê.

Rodando o cálculo **na data-base real do ciclo** (30/11/2025), a regra antiga — "a última
linha do `SR7010`" — enxerga o **dissídio coletivo de 01/11/2025**:

| O que a regra antiga via | Pessoas |
|---|---:|
| **0,08 ano** de função | **107** |
| 1,08 ano | 1 |

0,08 ano cai na faixa `> 0 e ≤ 2 anos` = **25 pontos de 100**. Ou seja: todo mês de
novembro, o dissídio reiniciava o relógio de praticamente toda a folha, e o critério
passava a valer o degrau mais baixo para quase todo mundo — sem erro, sem aviso, e sem
distinguir quem estava há um ano na função de quem estava há vinte.

Com a regra nova (última **troca** de `R7_FUNCAO`), as mesmas 108 pessoas se espalham
pelas faixas de verdade, e **60 mudam de faixa — todas para cima**. Nenhuma desce.

**Sobre o valor negativo:** medindo *hoje*, sem recorte de data, a regra antiga chega a
devolver tempo **negativo** (−0,2 ano), porque a última linha do SR7 de muita gente já é
um lançamento de **2026**, posterior ao ciclo. Isso não é o que acontecia na época — é o
que aconteceria ao **reapurar hoje um ciclo antigo**, e é exatamente a razão da correção
de recorte: todo resolver só considera fatos até `ciclo.dataBase`.

## 3. Renormalização

- **0 pessoas sem escolaridade** — consistente com o levantamento do cadastro (1.036 de
  1.036 preenchidos). A tela de pendências cadastrais nasce sem trabalho a fazer.
- **1 pessoa sem nenhum registro de troca de função**, que passa a usar a data de
  admissão (decisão C9) em vez de virar dado ausente.

O efeito prático da renormalização, portanto, vem quase todo do item 2: era ali que o
`NULL` entrava.

## 4. `current_date` × `ciclo.dataBase`

Rodando o relatório antigo **hoje** (05/09/2026) em vez de na data-base do ciclo
(30/11/2025), o tempo de empresa de cada pessoa sobe **+0,85 ano em média** — e sobe mais
a cada dia que passa. É a razão de `dataBase` existir: no modelo antigo, a nota de um
ciclo fechado mudava conforme o dia em que o relatório rodava.

---

## Como reproduzir

Somente leitura, `capulmig` ou `capulhlg`. Gere o CSV:

```sql
with resp as (
  select trim(RDB_CODADO) mat, count(*) qtd, sum(RDB_RESOBT) soma
  from TOTVS_PRD.RDB010 where D_E_L_E_T_=' ' and trim(RDB_CODMOD)='000006'
  group by trim(RDB_CODADO)
),
pes as (
  select trim(RA_FILIAL) fil, trim(RA_MAT) mat, trim(RA_ADMISSA) adm, trim(RA_GRINRAI) esc
  from TOTVS_PRD.SRA010
  where D_E_L_E_T_=' ' and RA_DEMISSA=' ' and RA_SITFOLH<>'D' and RA_CATFUNC<>'A'
),
h as (
  select trim(R7_FILIAL) fil, trim(R7_MAT) mat, trim(R7_DATA) dt, trim(R7_FUNCAO) fu,
         lag(trim(R7_FUNCAO)) over (partition by trim(R7_FILIAL),trim(R7_MAT)
                                    order by trim(R7_DATA),trim(R7_SEQ)) fa
  from TOTVS_PRD.SR7010 where D_E_L_E_T_=' '
),
func as (
  select fil, mat, max(dt) ultima_linha,
         max(case when fa is not null and fu<>fa then dt end) inicio_funcao
  from h group by fil, mat
),
tre as (
  select trim(RA4_MAT) mat, count(*) cursos
  from TOTVS_PRD.RA4010
  where D_E_L_E_T_=' ' and trim(RA4_DATAFI) between '20241130' and '20251130'
  group by trim(RA4_MAT)
)
select p.mat matricula, r.qtd qtd_questoes, r.soma soma_resobt, p.adm admissao,
       nvl(p.esc,' ') escolaridade,
       nvl(f.inicio_funcao, p.adm) func_correta,
       nvl(f.ultima_linha, p.adm)  func_ingenua,
       nvl(t.cursos, 0) cursos
from resp r
join pes p on p.mat = r.mat
left join func f on f.fil = p.fil and f.mat = p.mat
left join tre t on t.mat = p.mat
order by p.mat;
```

Depois:

```bash
cd gestao-pessoas/backend
npx ts-node --project tsconfig.seed.json scripts/regressao-protheus.ts <csv>
```

⚠️ **O CSV contém dado pessoal** (matrícula, admissão, escolaridade). Fica fora do
versionamento por `scripts/_regressao-*.csv` no `.gitignore` — gere sob demanda e apague.

---

## O que ficou de fora, e por quê

- **Nota final ponderada.** O modelo antigo tinha outra composição (a avaliação valia
  ~20% do total) e os pesos novos vivem na Aplicação, que o RH ainda vai montar. Comparar
  as notas finais seria comparar duas escalas diferentes e não ensinaria nada. As quatro
  comparações acima isolam **uma correção por vez**, que é o que permite explicar cada
  divergência.
- **O SQL original** (`docs/select-original-protheus.sql`) não chegou ao repositório, e a
  regressão foi encerrada antes de precisar dele: o objetivo era confirmar a nota do
  QUESTIONÁRIO, o que o item 1 fez (108/108). As divergências dos critérios cadastrais são
  as correções feitas de propósito, não defeitos a investigar.
- **A anomalia da spec §10.1** (`RDB_RESOBT = 0` nas alternativas 02, 03 e 04) **não
  existe neste ciclo**: zero ocorrências em 13.613 respostas. Se for migrar histórico
  mais antigo, vale reconferir — mas o último ciclo está limpo.
