-- 015_add_offline_count_tracking.sql
--
-- Fase 0 da contagem offline no app mobile.
-- Ver docs/PLANO_INVENTARIO_MOBILE_OFFLINE_FASE0.md
--
-- Tres blocos independentes. Todas as colunas sao nulaveis ou tem default,
-- entao a web de hoje continua funcionando sem nenhuma mudanca de contrato.

-- ---------------------------------------------------------------------------
-- Bloco 1 (itens 0.1 / 0.4) — rastreabilidade da captura offline
--
-- idempotency_key: dedupe de reenvio da fila do app. O register_count ja e
--   upsert por (item, ciclo), entao o valor nao duplicaria; a chave evita
--   REPROCESSAR efeito colateral (recalculo, auditoria, fecho de lista) e da
--   rastreabilidade de qual captura gerou qual gravacao.
--
-- counted_at_client: hora da captura no aparelho. Serve para ORDENAR capturas
--   do MESMO aparelho (o operador conta 10, corrige para 12, e as duas sobem
--   fora de ordem). NAO e hora confiavel em termos absolutos nem comparavel
--   entre aparelhos diferentes — para isso existe o lease do bloco 3.
-- ---------------------------------------------------------------------------
ALTER TABLE inventario.countings
  ADD COLUMN IF NOT EXISTS idempotency_key   TEXT,
  ADD COLUMN IF NOT EXISTS counted_at_client TIMESTAMPTZ;

-- Indice PARCIAL: as linhas historicas ficam com a chave NULL e nao colidem
-- entre si (NULL nao e igual a NULL, mas o parcial deixa a intencao explicita).
CREATE UNIQUE INDEX IF NOT EXISTS countings_idempotency_key_uidx
  ON inventario.countings (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Bloco 2 (item 0.3) — rastro do preenchimento do handoff
--
-- ATENCAO ao revisar: o preenchimento com ZERO no handoff esta CORRETO e nao
-- muda. Zero e contagem legitima (produto que realmente acabou), e o handoff
-- so toca item com count_cycle_N IS NULL — e o contador declarando "varri a
-- lista, o que sobrou eu nao achei".
--
-- O problema que esta coluna resolve e outro: depois do preenchimento o item
-- fica identico a uma contagem ativa (0 + COUNTED + last_counted_by do
-- operador), e o unico rastro era AGREGADO no historico ("N itens gravados
-- como zero"). Sem marca por item, um preenchimento que passe por cima de
-- contagem real presa num celular offline nao teria como ser localizado depois.
--
-- Historico fica FALSE: para o passado nao sabemos quais zeros vieram de
-- preenchimento, e inventar isso seria pior que admitir.
-- ---------------------------------------------------------------------------
ALTER TABLE inventario.counting_list_items
  ADD COLUMN IF NOT EXISTS zerado_no_fecho BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- Bloco 3 (item 0.5) — lease da lista por dispositivo
--
-- Hoje NAO existe controle de concorrencia nenhum: os guards das telas de
-- contagem sao de autorizacao, nao de concorrencia. E ja existem duas
-- superficies web (ContagemDesktopPage + ContagemMobilePage); o app seria a
-- terceira. O modelo ja quer dono unico (counter_cycle_N), mas ninguem amarra
-- em quantos APARELHOS esse contador pode estar.
--
-- O lease NAO e lock distribuido — o app conta offline sem falar com o
-- servidor. Ele reduz a janela e, principalmente, torna a colisao DETECTAVEL.
-- ---------------------------------------------------------------------------
ALTER TABLE inventario.counting_lists
  ADD COLUMN IF NOT EXISTS lease_token     UUID,
  ADD COLUMN IF NOT EXISTS lease_device_id TEXT,
  ADD COLUMN IF NOT EXISTS lease_user_id   UUID,
  ADD COLUMN IF NOT EXISTS lease_at        TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'counting_lists_lease_user_id_fkey'
      AND table_schema = 'inventario'
  ) THEN
    ALTER TABLE inventario.counting_lists
      ADD CONSTRAINT counting_lists_lease_user_id_fkey
      FOREIGN KEY (lease_user_id) REFERENCES inventario.users(id);
  END IF;
END $$;

-- Busca "quais listas estao com lease ativo" (tela do supervisor).
CREATE INDEX IF NOT EXISTS counting_lists_lease_token_idx
  ON inventario.counting_lists (lease_token)
  WHERE lease_token IS NOT NULL;

-- A liberacao FORCADA do lease pelo supervisor (escape hatch de aparelho
-- perdido) e registrada no historico de handoff, que ja existe. O CHECK atual
-- so aceita ENTREGUE/DEVOLVIDA/FINALIZADA/ENCERRADA — precisa do valor novo.
ALTER TABLE inventario.counting_list_handoff_history
  DROP CONSTRAINT IF EXISTS chk_handoff_evento;

ALTER TABLE inventario.counting_list_handoff_history
  ADD CONSTRAINT chk_handoff_evento CHECK (
    evento IN ('ENTREGUE', 'DEVOLVIDA', 'FINALIZADA', 'ENCERRADA', 'LEASE_LIBERADO')
  );
