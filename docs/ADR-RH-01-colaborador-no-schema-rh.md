# ADR-RH-01 — `colaborador` mora no schema `rh`, não em `core`

**Status:** aceito · **Data:** 05/09/2026 · **Decide:** Clenio (T.I.)
**Contexto:** criação do módulo Gestão de Pessoas (`gestao-pessoas`, schema `rh`)
**Substitui:** a alocação em `core` proposta em `docs/06_especificacao_gestao_pessoas.md` §3
e no `schema-rh.prisma` original.

---

## Decisão

As tabelas **`colaborador`**, **`cargo`** e **`colaborador_treinamento`** (mais o enum
`SituacaoColaborador`) ficam no schema **`rh`**, de propriedade do módulo
`gestao-pessoas`. A especificação as colocava em `core`.

## Por quê

**1. `core` tem dono, e não é este módulo.** O `core` é do auth-gateway; para os demais
módulos ele é read-only — está no `CLAUDE.md` (Diretrizes §3) e é seguido por todos:
Gestão TI tem middleware bloqueando escrita, e nem Fiscal nem Logística têm uma única
migration que toque em `core`. O sync do RH **escreve** nessas tabelas o tempo todo. Pôr
o módulo para escrever em `core` abriria uma exceção à regra mais transversal da
plataforma, e exceção não fica sozinha.

**2. A ferramenta trabalha contra.** Um módulo que declara `core` no
`datasource.schemas` faz o `prisma migrate diff` enxergar todas as tabelas do
auth-gateway que ele não declara — e propor `DROP`. Já aconteceu: em 23/05/2026 o
diagnóstico apontou **165 mudanças fantasma, 12 delas `DropTable`**
(`docs/INVESTIGACAO_DRIFT_DEV_23MAI.md`). Com `schemas = ["rh"]` o gerador fica
correto por construção, sem depender de alguém revisar o SQL antes de aplicar.

**3. Custa pouco reverter, e muito antecipar.** Hoje nenhum outro módulo lê colaborador.
Promover para `core` depois é `ALTER TABLE ... SET SCHEMA` mais o ajuste de quem lê —
barato enquanto o número de leitores é zero. O caminho inverso (nascer em `core`, com a
exceção à regra e o gerador de migration comprometido) não tem volta barata.

**4. O ganho colateral é real.** Em `rh`, `colaborador` está no mesmo schema das
avaliações — dá para ter **FK de verdade** entre `rh.avaliacao` e `rh.colaborador`, coisa
que a arquitetura cross-schema da casa proíbe. A migration inicial já sai com 21 FKs,
todas `rh` → `rh`.

## Condições que acompanham a decisão

| # | Condição | Como se verifica |
|---|---|---|
| 1 | **Nomes neutros.** `rh.colaborador`, nunca `rh.avaliacao_colaborador`. A tabela descreve a PESSOA, não o uso que a avaliação faz dela — o nome não pode dificultar a promoção futura. | `@@map` em `prisma/schema.prisma` |
| 2 | **Nenhum outro módulo consulta direto.** Nada de `$queryRaw` em `rh.colaborador` vindo de fora. Quem precisar, pede ao service do `gestao-pessoas`. | busca por `rh.colaborador` fora de `gestao-pessoas/` |
| 3 | **Gatilho de revisão.** Quando um **segundo módulo** precisar de colaborador, este ADR é reaberto — não se resolve com um `$queryRaw` "só desta vez". | ver abaixo |

## Gatilho de revisão — reabrir quando

- Um segundo módulo precisar ler colaborador (o candidato conhecido é o **T&D**, o "doc 05"
  citado no `schema-rh.prisma`: `colaborador_treinamento` já é a base dele); **ou**
- alguém precisar de FK de `core` para colaborador; **ou**
- o cadastro passar a ser mantido fora do `gestao-pessoas` (por exemplo, o Configurador
  assumindo a manutenção de pessoas).

**O que reabrir significa:** decidir entre (a) promover as tabelas para `core`, com o DDL
passando a ser do auth-gateway e o `gestao-pessoas` mantendo a escrita por exceção
documentada, ou (b) manter em `rh` e expor uma API de leitura. A condição 2 existe
justamente para que essa escolha continue possível: enquanto ninguém consultar direto, o
número de lugares a ajustar é conhecido.

**O que NÃO é gatilho:** precisar de um campo novo, de mais volume ou de outro índice —
isso é evolução normal da tabela, no dono atual.

## Consequências

- `datasource.schemas = ["rh"]`; `core` continua sendo lido por SQL cru no
  `CoreLookupService`, como em Logística e Fiscal.
- A migration inicial não referencia `core` em nenhuma linha (conferido: 0 ocorrências).
- `colaborador.usuarioId` continua guardando o `core.usuarios.id` como **coluna solta, sem
  FK** — é o mesmo padrão que a Logística usa para IDs de `core`, validado no service.
- A unique composta `(filial, matricula)` é preservada. Confirmada nos dados: das 8.111
  linhas do `SRA010`, há 6.997 matrículas distintas e 8.111 pares `(filial, matrícula)` —
  a matrícula se repete entre filiais porque a transferência deixa histórico, e a pessoa
  ativa é a linha da filial sem demissão.
