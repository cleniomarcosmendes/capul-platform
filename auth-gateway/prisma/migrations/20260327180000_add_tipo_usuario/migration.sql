-- CreateEnum
DO $$ BEGIN
    CREATE TYPE core."TipoUsuario" AS ENUM ('INDIVIDUAL', 'PADRAO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddColumn
ALTER TABLE core.usuarios
    ADD COLUMN IF NOT EXISTS tipo core."TipoUsuario" NOT NULL DEFAULT 'INDIVIDUAL';
