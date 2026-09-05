# Especificação de Implementação — Módulo Gestão de Pessoas
## Avaliação de Desempenho · Capul Platform

**Para:** implementação assistida no repositório `capul-platform`
**Slug do módulo:** `gestao-pessoas` · **Schema do banco:** `rh`
**Piloto em produção:** 15/09/2026 · **Produção geral:** 30/09/2026
**Artefatos que acompanham:** `schema-rh.prisma` · `seed-rh.ts`

---

## 1. Contexto em cinco linhas

A TOTVS descontinuou o Portal GCH, que era a interface onde a Capul rodava avaliação de
desempenho no Protheus. O backend (SIGAAPD) continua, mas sem porta de entrada. A decisão
foi reconstruir na plataforma própria, melhor do que era: o modelo antigo aplicava **as
mesmas 15 perguntas a todos os ~1.000 colaboradores**, sem grupos e sem pesos. O novo
permite **questionário por perfil de centro de custo**, com grupos ponderados.

---

## 2. Regra número um

**Siga a arquitetura que já existe.** Antes de escrever qualquer coisa, leia o módulo
existente mais bem estruturado de ponta a ponta — migration, modelo, repositório,
serviço, controller, guard, rota, componente de tela — e replique o padrão. Este módulo
deve parecer escrito pela mesma pessoa que escreveu os outros.

Inclui: estrutura de pastas, convenção de nomes, forma de registrar o módulo no HUB,
entrada no nginx, serviço no docker compose e job `*-migrate`.

Não introduza biblioteca nova sem necessidade real. Especificamente: **não traga BullMQ**
(cron simples resolve) e **não traga driver Oracle** sem decisão explícita — ver §5.

---

## 3. Modelo de dados

Use `schema-rh.prisma` como está. Ele foi desenhado sobre as decisões já fechadas e sobre
o modelo real extraído do Protheus.

Migrations pelo caminho seguro da casa — **nunca `prisma migrate dev`**, que reseta o
banco:

```bash
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel  prisma/schema.prisma \
  --script > prisma/migrations/<timestamp>_init_rh/migration.sql
npx prisma migrate deploy
```

Conferir no SQL gerado antes de aplicar:

- `CREATE SCHEMA rh`
- unique composta `(filial, matricula)` em `core.colaborador` — **matrícula se repete
  entre filiais**, já confirmado no banco
- ausência de FK entre `rh` e `core` — a leitura entre schemas é por SQL cru, como já se
  faz na plataforma

Rodar o seed depois: cria três modelos de produção (Operação de Loja, Produção e
Indústria, Administrativo) e um `[DEMO]`, com as 15 questões reais.

---

## 4. Regras de cálculo — **implementar exatamente assim**

Esta é a parte que não pode ter interpretação. Todo o resto é convenção; isto é a regra
de negócio.

### 4.1. Nota de grupo MANUAL

```
nota_grupo = (Σ valores das respostas do grupo)
           / (Σ maiores valores das alternativas de cada pergunta do grupo)
           × 100
```

Nunca use constante. O modelo antigo dividia por 18 fixo; se uma pergunta fosse
adicionada, a nota passava de 100 sem acusar erro.

### 4.2. Nota de grupo AUTOMÁTICO

Calcula o valor bruto, localiza a faixa em `criterio_faixa`, aplica a pontuação.

| Tipo | Valor bruto | Regra |
|---|---|---|
| `ESCOLARIDADE` | `colaborador.grauInstrucaoCodigo` | faixa `DOMINIO`. Código nulo/vazio → `semDado = true` |
| `TEMPO_EMPRESA` | `(ciclo.dataBase − dataAdmissao) / 365.25` anos | nunca `semDado`; se `dataAdmissao` nula, é erro de sync — abortar |
| `TEMPO_FUNCAO` | `(ciclo.dataBase − dataUltimaFuncao) / 365.25` anos | `dataUltimaFuncao` recebe `dataAdmissao` no sync quando não há SR7 (§5.3) |
| `QTDE_TREINAMENTO` | contagem em `core.colaborador_treinamento` com `dataFim` entre `dataBase − janelaTreinamentoMeses` e `dataBase` | zero é valor legítimo, não ausência |

**Sempre `ciclo.dataBase`, nunca `now()`.** O select antigo usava `current_date` e a nota
mudava conforme o dia em que o relatório rodava. Comparação sempre em tipo `date`, nunca
string.

### 4.3. Nota final com renormalização

```
nota_final = Σ (nota_grupo × peso_grupo) / Σ (peso_grupo)
```

considerando **apenas grupos com `semDado = false`**. Grupo sem dado sai do numerador
**e do denominador**.

Isso corrige o bug mais grave do modelo antigo: o `NVL` ficava fora da soma, e em SQL
`NULL + n = NULL`. Quem não tinha registro de função saía com **média zero**, parecendo
péssimo desempenho quando era falta de cadastro.

Quando houver renormalização, marcar `resultado_avaliacao.houveRenormalizacao = true`.

### 4.4. Materialização

No fechamento do ciclo, gravar `resultado_avaliacao` **e** um `resultado_criterio` por
grupo, com valor bruto, faixa aplicada, pontuação e peso. Relatório apenas lê.

Recalcular só por ação explícita, com registro em `rh.auditoria`.

### 4.5. Conceito

Localizar a faixa em `conceito_faixa` **do ciclo** (não do modelo) e gravar o texto
em `resultado_avaliacao.conceitoDescricao`.

### 4.6. Validações na publicação/abertura

- faixas de critério cobrem todo o domínio, sem buraco nem sobreposição
- faixas de conceito cobrem 0–100, sem buraco nem sobreposição
- modelo com `finalidade = DEMONSTRACAO` **não pode** ser usado em ciclo válido
- `modelo_versao` publicada é imutável: para alterar, clonar nova versão

---

## 5. Integração com o Protheus

### 5.1. Transporte

A plataforma acessa o Protheus **por REST**, com endpoints configurados em
`core.integracoes_api_endpoints`. Não existe driver Oracle no projeto e **não é para
introduzir um** sem decisão explícita.

Para a carga inicial do piloto, é aceitável importar por CSV extraído do ambiente de
teste. Estruture o serviço de sincronização com a fonte plugável (REST / CSV), para que
trocar não exija reescrever a regra.

**Somente leitura. Jamais escrever no ERP.**

### 5.2. Origem dos dados

| Destino | Origem | Campos |
|---|---|---|
| `core.colaborador` | `SRA010` | `RA_FILIAL`, `RA_MAT`, `RA_NOME`, `RA_CIC`, `RA_CC`, `RA_ADMISSA`, `RA_DEMISSA`, `RA_SITFOLH`, `RA_CODFUNC`, `RA_GRINRAI` |
| `grauInstrucaoDescricao` | `SX5010` tabela `26` | join por `RA_GRINRAI = X5_CHAVE` |
| `dataUltimaFuncao`, `descricaoFuncao` | `SR7010` | ver 5.3 |
| `core.colaborador_treinamento` | `RA4010` | descrição, `RA4_DATAIN`, `RA4_DATAFI` |

Filtros de elegibilidade: `D_E_L_E_T_ = ' '`, `RA_DEMISSA = ' '`, `RA_SITFOLH <> 'D'`.

> Havia no select antigo um filtro `RA_MAT LIKE '0%'`, cuja regra de negócio não foi
> documentada. **Confirmar com o RH antes de replicar.** Se não houver justificativa,
> não replicar.

### 5.3. Tratamento do SR7010 — atenção

O select antigo tinha dois defeitos aqui, e ambos devem ser corrigidos:

1. Excluía registros com `R7_DATA = '20241101'`, data fixa embutida no código — era um
   remendo para ignorar uma carga em massa que reiniciaria o tempo de função de todo
   mundo. **Trate como origem do registro** (movimento real × carga), não como data
   mágica. Se não houver como distinguir na origem, deixe o parâmetro configurável.
2. A data exibida e a data usada no cálculo vinham de subqueries com filtros
   **diferentes**, e podiam divergir. Aqui deve ser **uma só**.

Quando não houver registro de alteração funcional, `dataUltimaFuncao = dataAdmissao`.
A pessoa não mudou de função desde que entrou — não é dado ausente.

### 5.4. Pendências cadastrais

Tela que lista, antes da abertura do ciclo, quem está sem dado necessário (hoje: apenas
escolaridade). O RH corrige e então libera. O resíduo cai na renormalização de §4.3.

---

## 6. Escopo do piloto — 15/09

### Construir

| # | Item |
|---|---|
| 1 | Registro do módulo no HUB, nginx, compose, job de migrate |
| 2 | Migration + seed |
| 3 | Sincronização de colaboradores (com log e reexecução segura) |
| 4 | CRUD de Ciclo: nome, período, `dataBase`, janela de treinamento, conceitos |
| 5 | CRUD de Aplicação: nome, modelo, centros de custo |
| 6 | Designação: filtra por CC → traz colaboradores → RH desmarca → define avaliador |
| 7 | Tela do avaliador: pendências + formulário de resposta |
| 8 | Motor de cálculo + fechamento |
| 9 | Painel do RH: % respondido por unidade e por avaliador |
| 10 | Relatório de resultado + exportação |
| 11 | Tela de pendências cadastrais |

### **Não** construir agora

Construtor visual de modelo · configuração de faixas por tela (vêm por seed) ·
autoavaliação · avaliação de pares ou do gestor · questão aberta obrigatória ·
"não se aplica" · PDI · metas e PLR · pesquisa de clima · acesso do colaborador ·
login por matrícula, quiosque ou mobile · contestação · calibração e 9box.

Nenhum item acima está no escopo. Se parecer necessário para algo funcionar, **pergunte
antes de implementar** — provavelmente há um caminho mais simples.

### Ordem sugerida

Módulo e migration → seed → sincronização → **motor de cálculo** → designação → tela do
avaliador → painel → relatório.

Cálculo **antes** das telas. Se a conta estiver errada, tela bonita não salva. Feito o
motor, valide contra o resultado do select antigo para as mesmas pessoas — é o melhor
teste de regressão disponível.

---

## 7. Decisões já fechadas (não reabrir)

| Tema | Decisão |
|---|---|
| Avaliadores por avaliado | exatamente **um** (`@@unique([cicloId, avaliadoId])`) |
| Autoavaliação | não existe |
| Escala | 4 alternativas com texto âncora **próprio de cada questão** — não é escala compartilhada |
| "Não se aplica" | não existe; toda pergunta é obrigatória |
| Pesos | por grupo, livres, normalizados no cálculo |
| Peso por centro de custo | varia — por isso cada perfil tem seu modelo |
| Faixas de critério | iguais para todos os CCs |
| Modelo × centro de custo | modelo **não** tem CC; o vínculo é na Aplicação |
| Designação | sugerida pelo CC, ajustável manualmente pelo RH |
| Visibilidade do avaliador | apenas quem lhe foi designado |
| Colaborador vê a nota | não; conversa com o gestor fora do sistema |
| Ciência e contestação | não há registro formal |
| Salário | não entra |
| Consequência da nota | há (mérito) — por isso auditoria e imutabilidade são obrigatórias |

---

## 8. Guardas de qualidade

- Toda rota nova precisa de **guard explícito**. O gateway não aplica proteção global —
  rota sem guard nasce aberta.
- Não existe RLS: o escopo por filial e centro de custo é **100% aplicativo**. Reaproveite
  os helpers de escopo já existentes na plataforma e escreva teste para eles.
- `rh.auditoria` gravado obrigatoriamente em: alteração de nota, reabertura de avaliação,
  exclusão, publicação de modelo e acesso a resultado individual por quem não é o
  avaliador designado.
- Ambiente de desenvolvimento pode apontar para Protheus de produção — por isso o sync é
  **somente leitura**, sem exceção.
- Ao usar `tsc`, use `tsc -b`. O `tsc --noEmit` dá aprovação falsa na configuração atual
  do repositório.
- Testes: priorize o **motor de cálculo** (nota de grupo, renormalização, faixas, limites
  de faixa, conceito). É onde um erro custa caro e onde não há como conferir no olho.

---

## 9. Cuidados com o piloto

- `ciclo.valeParaMerito` nasce `false`. O piloto valida o sistema; **não decide carreira
  de ninguém.**
- Monte **três aplicações** no piloto, não uma. É o que prova a melhoria pedida:
  questionário por perfil.
- Em 30/09, abrir a produção **por ondas de unidade**, não tudo de uma vez. Isso não
  exige código — o público já é parâmetro do ciclo.

---

## 10. Duas pendências abertas

1. **Anomalia no histórico.** Em `RDB010`, alternativas 02, 03 e 04 têm registros com
   `RDB_RESOBT = 0` — alternativa escolhida, pontuação zero. Não afeta o novo sistema,
   mas se o histórico for migrado ou comparado, essas notas estão subestimadas.
2. **Títulos das questões.** O export do Protheus traz o texto das alternativas, não o
   enunciado. Os títulos no seed foram derivados do conteúdo e precisam de confirmação do
   RH. Se o enunciado existir em outra tabela, prefira o original.
