#!/usr/bin/env bash
# ============================================================================
# ⭐⭐ CADASTRO DO PILOTO: DEV → HOMOLOGAÇÃO, por SQL — nunca por planilha.
#
# O piloto de 15/09 roda em HLG, e lá `rh.colaborador` nasce vazio (as migrations
# criam a tabela, não os dados). Este script gera UM arquivo .sql com o cadastro
# que o piloto precisa, na ordem das dependências.
#
# ⚠️ POR QUE NÃO PLANILHA — e o argumento é do próprio módulo:
# `designacao-padrao/planilha.ts` existe porque **o Excel come o zero à esquerda**
# em TODA coluna numérica. Matrícula tem 6 posições e filial tem 2, as duas são
# texto: `001741` volta `1741` e `01` volta `1`. É por isso que aquele arquivo tem
# `normalizarMatricula` e `normalizarFilial`.
#   Passar 1.036 matrículas por uma planilha reintroduz esse defeito de propósito
# — e ele falha CALADO: a chapa deixa de casar, a pessoa vira "sem colaborador
# ativo" e o sintoma que chega é **um 403 que parece falta de permissão**. Num
# ambiente onde 137 pessoas vão entrar pela primeira vez, é o pior erro possível.
# `pg_dump` não interpreta tipo nenhum: texto sai texto.
#
# ── O QUE VIAJA, e por quê ──────────────────────────────────────────────────
#   colaborador (1.036)                  as pessoas
#   importacao_designacao (2)            proveniência — FK de designacao_padrao
#   designacao_padrao (1.384)            QUEM AVALIA QUEM: é o objeto do piloto
#   colaborador_treinamento (2.268)      critério de treinamento
#   colaborador_funcao_historico (14.024) "tempo na função" (a troca de R7_FUNCAO)
#
# ── O QUE **NÃO** VIAJA ─────────────────────────────────────────────────────
#   modelo/grupo/pergunta/alternativa/criterio/faixa → vêm do `prisma db seed`,
#     que é a fonte deles. Copiar dado que tem seed cria uma segunda verdade.
#   ciclo/aplicacao/avaliacao/resposta/auditoria → o piloto cria os dele. Levar
#     ciclo de teste do DEV para HLG é exatamente o que se quer evitar.
# ============================================================================
set -euo pipefail

CONTAINER="${CONTAINER:-capul-db}"
DB="${DB:-capul_platform}"
USUARIO="${USUARIO:-capul_user}"
SAIDA="${1:-cadastro-piloto-hlg.sql}"

# Ordem = ordem das FKs. Não reordene sem olhar as dependências.
TABELAS=(
  rh.colaborador
  rh.importacao_designacao
  rh.designacao_padrao
  rh.colaborador_treinamento
  rh.colaborador_funcao_historico
)

echo "-- Cadastro do piloto (DEV → HLG) — gerado em $(date -Is)" > "$SAIDA"
echo "-- ⚠️ Rodar com rh.colaborador VAZIO. Ver conferir-cadastro-hlg.sql." >> "$SAIDA"
echo "BEGIN;" >> "$SAIDA"

for t in "${TABELAS[@]}"; do
  echo "  · $t" >&2
  echo "" >> "$SAIDA"
  echo "-- ---------- $t ----------" >> "$SAIDA"
  docker exec -i "$CONTAINER" pg_dump -U "$USUARIO" -d "$DB" \
    --data-only --no-owner --no-privileges --table="$t" \
    | grep -v '^--' | grep -v '^SET ' | grep -v '^SELECT pg_catalog' \
    >> "$SAIDA"
done

echo "COMMIT;" >> "$SAIDA"
echo "" >&2
echo "✅ $SAIDA ($(wc -l < "$SAIDA") linhas, $(du -h "$SAIDA" | cut -f1))" >&2
echo "   Aplicar no HLG:  psql -U <user> -d capul_platform -f $SAIDA" >&2
echo "   Conferir DEPOIS: psql ... -f conferir-cadastro-hlg.sql (nos DOIS lados)" >&2
