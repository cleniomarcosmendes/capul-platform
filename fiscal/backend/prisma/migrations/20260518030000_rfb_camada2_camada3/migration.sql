-- Migration 18/05/2026: enriquecimento da base local CNPJ (Camada 2+3).
--
-- Clenio: consulta local sem informacao analitica. F1 importou so o
-- subconjunto essencial. Agora:
--  Camada 2: campos que JA vinham no ZIP de Estabelecimentos/Empresas
--            mas eram projetados fora (data abertura, CNAE secundaria,
--            motivo/situacao especial, qualificacao do responsavel).
--  Camada 3: Socios/QSA (arquivo Socios*.zip, excluido na F1) + dominios
--            de descricao (motivos, qualificacoes, paises).
--
-- Tabelas rfb sao DROP+swap a cada import (estrutura real = spec.colunas
-- do importer, so TEXT). Esta migration cria o estado inicial idempotente
-- para o schema/Prisma ser valido antes do 1o re-import (consultas
-- retornam vazio ate la). socios nao tem chave natural -> tabela TEXT
-- pura, indice nao-unico por cnpj_basico, consultada via $queryRaw.

ALTER TABLE "rfb"."estabelecimentos"
  ADD COLUMN IF NOT EXISTS "motivo_situacao"        TEXT,
  ADD COLUMN IF NOT EXISTS "data_inicio_atividade"  TEXT,
  ADD COLUMN IF NOT EXISTS "cnae_secundaria"        TEXT,
  ADD COLUMN IF NOT EXISTS "situacao_especial"      TEXT,
  ADD COLUMN IF NOT EXISTS "data_situacao_especial" TEXT,
  ADD COLUMN IF NOT EXISTS "pais"                   TEXT;

ALTER TABLE "rfb"."empresas"
  ADD COLUMN IF NOT EXISTS "qualificacao_responsavel" TEXT,
  ADD COLUMN IF NOT EXISTS "ente_federativo"          TEXT;

CREATE TABLE IF NOT EXISTS "rfb"."motivos"       ("codigo" TEXT PRIMARY KEY, "descricao" TEXT);
CREATE TABLE IF NOT EXISTS "rfb"."qualificacoes" ("codigo" TEXT PRIMARY KEY, "descricao" TEXT);
CREATE TABLE IF NOT EXISTS "rfb"."paises"        ("codigo" TEXT PRIMARY KEY, "descricao" TEXT);

CREATE TABLE IF NOT EXISTS "rfb"."socios" (
  "cnpj_basico"        TEXT,
  "identificador_socio" TEXT,
  "nome_socio"         TEXT,
  "cnpj_cpf_socio"     TEXT,
  "qualificacao_socio" TEXT,
  "data_entrada"       TEXT,
  "pais"               TEXT,
  "repr_legal_cpf"     TEXT,
  "repr_legal_nome"    TEXT,
  "repr_legal_qualif"  TEXT,
  "faixa_etaria"       TEXT
);
CREATE INDEX IF NOT EXISTS "socios_cnpjb_idx" ON "rfb"."socios" ("cnpj_basico");
