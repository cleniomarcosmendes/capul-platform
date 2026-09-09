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
# Id do usuário do HLG que assume a autoria do transporte (ver o bloco abaixo).
ADMIN_HLG_ID="${ADMIN_HLG_ID:-}"

# Ordem = ordem das FKs. Não reordene sem olhar as dependências.
TABELAS=(
  rh.colaborador
  rh.importacao_designacao
  rh.designacao_padrao
  rh.colaborador_treinamento
  rh.colaborador_funcao_historico
)

if [ -z "${ADMIN_HLG_ID:-}" ]; then
  echo "" >&2
  echo "⛔ ADMIN_HLG_ID não informado — e sem ele a trilha das 521 designações" >&2
  echo "   apontaria para um usuário que não existe no HLG (vira '(não encontrado)')." >&2
  echo "   Pegue o id no HLG e rode de novo:" >&2
  echo "     select id, username from core.usuarios where username = '<admin do HLG>';" >&2
  echo "     ADMIN_HLG_ID=<id> $0 $SAIDA" >&2
  exit 1
fi

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

# ============================================================================
# ⭐⭐ A TRILHA NÃO PODE APONTAR PARA O VAZIO.
#
# 521 das 1.384 linhas de `designacao_padrao` têm `registrado_por_id` com o id de
# um usuário do DEV. **Não há FK entre schemas**, então isso copia CALADO — e no
# HLG passa a apontar para um usuário que não existe.
#
# ⚠️ Por que isso não pode ficar para depois: a tela resolve o id para um nome, e
# um id órfão vira **"(não encontrado)"**. Meses depois ninguém distingue as três
# coisas que essa mesma frase pode significar: (a) veio da importação de outro
# ambiente, (b) o usuário foi apagado, (c) o dado corrompeu. "Não encontrado" é
# resposta que encerra a investigação sem responder nada.
#
# A escolha aqui é declarar (a) explicitamente: **tudo que veio deste transporte
# fica no nome do admin do HLG**, e a linha diz isso. Não é fingir autoria — é
# dizer a verdade sobre a origem: quem trouxe estes dados para o HLG foi o
# transporte, executado por essa conta.
#
# ⚠️ ADMIN_HLG_ID é obrigatório de propósito. Sem ele o script PARA, em vez de
# gerar um arquivo que envenena a trilha em silêncio — é o mesmo princípio do
# `desconhecido` da identidade de build: rótulo ausente nunca vira palpite.
# ============================================================================

cat >> "$SAIDA" <<SQL

-- ---------- trilha: quem trouxe estes dados ----------
-- As linhas nasceram no DEV e o usuário que as registrou não existe aqui. Em vez
-- de deixar id órfão (que a tela mostra como "(não encontrado)"), o transporte
-- assume a autoria: foi ele que trouxe.
UPDATE rh.designacao_padrao
   SET registrado_por_id = '$ADMIN_HLG_ID'
 WHERE registrado_por_id IS NOT NULL;

UPDATE rh.importacao_designacao
   SET importado_por_id = '$ADMIN_HLG_ID'
 WHERE importado_por_id IS NOT NULL;
SQL

echo "COMMIT;" >> "$SAIDA"
echo "" >&2
echo "✅ $SAIDA ($(wc -l < "$SAIDA") linhas, $(du -h "$SAIDA" | cut -f1))" >&2
echo "   Aplicar no HLG:  psql -U <user> -d capul_platform -f $SAIDA" >&2
echo "   Conferir DEPOIS: psql ... -f conferir-cadastro-hlg.sql (nos DOIS lados)" >&2
