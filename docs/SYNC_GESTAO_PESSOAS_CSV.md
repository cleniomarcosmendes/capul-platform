# Sincronização de colaboradores — carga por CSV

**Módulo:** Gestão de Pessoas · **Data:** 05/09/2026
**Endpoint:** `POST /api/v1/gestao-pessoas/sincronizacao` (role `RH_ADMIN`)
**Variável:** `RH_CSV_DIR` — diretório dos três arquivos (padrão `/app/carga`)

> ⭐⭐ **SOMENTE LEITURA NA ORIGEM.** O ambiente de DESENVOLVIMENTO aponta para o Protheus
> de PRODUÇÃO. O sync lê a fonte e escreve **apenas** no schema `rh` — a interface
> `FonteColaboradores` não tem, e não pode ganhar, método de escrita.

---

## Os três arquivos

| Arquivo | Origem | Alimenta |
|---|---|---|
| `colaboradores.csv` | `SRA010` + `SX5010` (tabela 26) + `SQ3010` (cargo) | `rh.colaborador` |
| `historico_funcao.csv` | `SR7010` | `rh.colaborador_funcao_historico` |
| `treinamentos.csv` | `RA4010` | `rh.colaborador_treinamento` |

Os nomes das colunas vêm do cabeçalho, então a ordem não importa. Campos do Protheus são
de largura fixa e vêm com espaço à direita — o leitor faz `trim` em tudo.

## SQL de extração (somente leitura)

```sql
-- colaboradores.csv
select trim(RA_FILIAL) filial, trim(RA_MAT) matricula, trim(RA_NOME) nome, trim(RA_CIC) cpf,
       trim(RA_CC) centro_custo, ' ' centro_custo_descricao,
       trim(a.RA_CODFUNC) cargo_codigo,
       -- ⚠️ A descricao do cargo vem do SQ3010, nao do SRA010. Sem este join a
       -- tela do avaliador mostra "Sem cargo cadastrado" para todo mundo, e o
       -- avaliador perde a referencia de quem esta avaliando.
       trim(nvl((select max(q.Q3_DESCSUM) from SQ3010 q
                 where q.D_E_L_E_T_=' ' and trim(q.Q3_CARGO)=trim(a.RA_CODFUNC)),' ')) cargo_descricao,
       trim(RA_ADMISSA) data_admissao, trim(RA_DEMISSA) data_demissao,
       trim(RA_SITFOLH) situacao_folha, trim(RA_CATFUNC) categoria_funcional,
       trim(RA_GRINRAI) grau_instrucao_codigo,
       trim(nvl((select max(x.X5_DESCRI) from SX5010 x
                 where x.D_E_L_E_T_=' ' and x.X5_TABELA='26'
                   and trim(x.X5_CHAVE)=trim(a.RA_GRINRAI)),' ')) grau_instrucao_descricao,
       trim(nvl((select max(q.Q3_DESCSUM) from SQ3010 q
                 where q.D_E_L_E_T_=' ' and trim(q.Q3_CARGO)=trim(a.RA_CODFUNC)),' ')) descricao_funcao
from SRA010 a where a.D_E_L_E_T_=' ';

-- historico_funcao.csv
select trim(R7_FILIAL) filial, trim(R7_MAT) matricula, trim(R7_DATA) data, trim(R7_SEQ) sequencia,
       trim(R7_FUNCAO) funcao_codigo, trim(R7_DESCFUN) funcao_descricao, trim(R7_TIPO) tipo,
       R_E_C_N_O_ recno_origem
from SR7010 where D_E_L_E_T_=' ';

-- treinamentos.csv
select trim(RA4_FILIAL) filial, trim(RA4_MAT) matricula, trim(RA4_CURSO) descricao,
       trim(RA4_DATAIN) data_inicio, trim(RA4_DATAFI) data_fim, RA4_HORAS carga_horaria
from RA4010 where D_E_L_E_T_=' ';
```

⚠️ **Extraia as tabelas INTEIRAS** (só `D_E_L_E_T_ = ' '`), sem filtrar população. Quem
decide quem entra é o sync, e ele precisa ver o que recusou para o relatório fechar com o
total do arquivo.

⚠️ **`R_E_C_N_O_` é obrigatório no histórico** — faz parte da chave natural. Ver
"duplicidade na origem", abaixo.

---

## Resultado da carga real (capulmig, 05/09/2026)

Rodada duas vezes; os números do relatório batem com o banco nas duas, e a segunda não
duplicou nada.

| | Lidos | Gravados | Fora, e por quê |
|---|---:|---:|---|
| Colaboradores | 8.111 | **1.036** | 4.131 demitidos · 2.944 autônomos |
| Histórico funcional | 29.881 | 14.024 | 15.758 sem colaborador · 99 inválidas |
| Treinamentos | 3.258 | 2.268 | 986 sem colaborador · 4 sem data de início |

Dos 14.024 lançamentos gravados, **11.580 alimentam o cálculo** e 2.444 são réplicas de
filial anterior — gravadas e marcadas, não descartadas.

No banco: 1.036 colaboradores (891 ativos, 98 em férias, 47 afastados), 14.024 lançamentos
e 2.268 treinamentos. Duração: ~55 s na primeira carga, ~41 s na segunda.

---

## Três achados de dado que a carga real revelou

### 1. Duplicidade na origem — 312 chaves repetidas no `SR7010`

**A gravação estava perdendo linha; o cálculo, não — mas por sorte dos dados, não por
construção.** Das 312 chaves repetidas, **68 trazem funções diferentes** e **9 delas
atingem pessoas ativas**. Conferido nas 1.036 ativas, resolvendo a data com o `recno`
crescente e decrescente: **em nenhuma a data muda**. Nos dados de hoje é ruído de
cadastro, não critério de nota.

⚠️ **Não é invariante.** A ordem passa a importar quando um lançamento POSTERIOR repete a
função de uma das duplicatas — aí uma das ordens enxerga uma troca a mais, mais tarde. Não
existe nenhum caso assim hoje, e por isso não há regra de desempate; se a conferência
acusar algum, o candidato natural é o maior `recno` (lançamento mais recente). Há teste
demonstrando os dois casos — o indiferente e o que muda — para a conclusão não ser lida
como garantia.

O problema era de GRAVAÇÃO. `(filial, matrícula, data, sequência)` não é única no
Protheus, e as linhas repetidas trazem funções diferentes:

```
18  001214  20101101  seq 1  função 00400  tipo 005
18  001214  20101101  seq 1  função 00190  tipo 003
```

Com a chave sem o `recno`, o upsert gravava uma e **perdia a outra em silêncio** — 76
linhas se perdiam na carga da Capul. Por isso `recnoOrigem` entrou na chave natural
(migration `20260906020000`). Se a fonte não informar o recno, o campo vira 0 e as
duplicatas voltam a colidir: **extraia sempre o `R_E_C_N_O_`**.

### 2. 99 lançamentos sem data

98 pessoas, **79 delas no quadro ativo**. Sem data não há como ordenar o histórico nem
gravá-lo (a chave inclui a data), então a linha fica de fora — mas **não invalida as outras
linhas da pessoa** e **não derruba o arquivo**. Sai contada no relatório
(`historicoFuncional.invalidas`) e listada no log com matrícula e filial.

### 3. 15.758 lançamentos sem colaborador na base — e não é erro de join

⚠️ **Correção de uma afirmação da primeira versão deste documento.** Estava escrito que
eram "os expurgados do `SRA010`". Não são: **todos existem no `SRA010`**, e foram
filtrados por serem demitidos ou autônomos. Conferido:

| | Linhas | De pessoa ATIVA | Existe no SRA, filtrada | Matrícula inexistente |
|---|---:|---:|---:|---:|
| `SR7010` | 29.881 | 14.103 | 15.778 | **0** |
| `RA4010` | 3.258 | 2.272 | 986 | **0** |

Zero matrículas inexistentes nos dois arquivos — não há erro de junção. E a conta fecha
exatamente com o que foi gravado: **14.103 − 79** (lançamentos sem data de pessoas ativas)
**= 14.024**; **2.272 − 4** (cursos sem data de início) **= 2.268**.

(Os expurgados do `SRA010` existem, mas são outra coisa: 488 dos 905 avaliados do ciclo
de 2025, no `RDB010` — histórico de avaliação, não de folha. Ver
docs/REGRESSAO_PROTHEUS_GESTAO_PESSOAS.md.)

---

## Reexecução

É seguro rodar quantas vezes quiser:

- colaborador: upsert por `(filial, matricula)`;
- histórico: upsert por `(colaborador, filial, data, sequência, recno)`;
- treinamento: substituição por pessoa, restrita à origem `PROTHEUS_RA4`.

## Sobre o disparo

**Não há cron.** Quem dispara a sincronização ainda é decisão em aberto com o RH ("RH ou
T.I.?"), e a carga leva ~1 minuto. Ligar agendamento antes dessa resposta seria escolher
por eles. Quando vier, é `@Cron` com `timeZone: 'America/Sao_Paulo'`, como nos outros
módulos da plataforma.

## Quando o REST existir

A fonte é injetada por token (`FONTE_COLABORADORES`). Trocar CSV por REST é acrescentar
uma classe que implemente `FonteColaboradores` e mudar uma linha no módulo — a regra do
sync não sabe de onde os dados vieram. Hoje o Protheus só expõe `infoFuncionario`, que
devolve `{ matricula, nome, cc }`: nenhuma das quatro tabelas de que este módulo precisa
está disponível por REST.
