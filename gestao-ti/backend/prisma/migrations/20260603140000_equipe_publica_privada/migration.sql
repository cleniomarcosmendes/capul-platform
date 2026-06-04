-- Equipe pública/privada — unifica e SUBSTITUI a flag aceita_chamado_externo
-- (que só bloqueava USUARIO_FINAL, por papel). Novo conceito é por DEPARTAMENTO:
-- privada=TRUE => só staff (ADMIN/GESTOR/SUPORTE) do próprio depto enxerga/abre
-- chamado direto pra equipe. Transferência permanece global (inalterada).
-- Backfill preserva a intenção atual: equipe que NÃO aceitava externo vira privada.

-- 1) Nova coluna (default público = comportamento atual; aditivo/idempotente).
ALTER TABLE "gestao_ti"."equipes_ti"
  ADD COLUMN IF NOT EXISTS "privada" BOOLEAN NOT NULL DEFAULT false;

-- 2) Backfill a partir da flag antiga (aceita_externo=false => privada=true).
UPDATE "gestao_ti"."equipes_ti"
  SET "privada" = NOT "aceita_chamado_externo";

-- 3) Remove a flag antiga (substituída pelo conceito de visibilidade por depto).
ALTER TABLE "gestao_ti"."equipes_ti"
  DROP COLUMN IF EXISTS "aceita_chamado_externo";
