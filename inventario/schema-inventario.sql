--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13
-- Dumped by pg_dump version 15.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: inventario; Type: SCHEMA; Schema: -; Owner: inventario_user
--

CREATE SCHEMA inventario;


ALTER SCHEMA inventario OWNER TO inventario_user;

--
-- Name: counting_status; Type: TYPE; Schema: inventario; Owner: inventario_user
--

CREATE TYPE inventario.counting_status AS ENUM (
    'PENDING',
    'COUNTED',
    'REVIEWED',
    'APPROVED',
    'ZERO_CONFIRMED'
);


ALTER TYPE inventario.counting_status OWNER TO inventario_user;

--
-- Name: inventory_status; Type: TYPE; Schema: inventario; Owner: inventario_user
--

CREATE TYPE inventario.inventory_status AS ENUM (
    'DRAFT',
    'IN_PROGRESS',
    'COMPLETED',
    'CLOSED'
);


ALTER TYPE inventario.inventory_status OWNER TO inventario_user;

--
-- Name: user_role; Type: TYPE; Schema: inventario; Owner: inventario_user
--

CREATE TYPE inventario.user_role AS ENUM (
    'ADMIN',
    'SUPERVISOR',
    'OPERATOR'
);


ALTER TYPE inventario.user_role OWNER TO inventario_user;

--
-- Name: advance_cycle(uuid, numeric); Type: FUNCTION; Schema: inventario; Owner: inventario_user
--

CREATE FUNCTION inventario.advance_cycle(p_inventory_id uuid, p_tolerance_percent numeric DEFAULT 5.0) RETURNS TABLE(items_needing_recount integer, next_cycle integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_current_cycle INTEGER;
    v_next_cycle INTEGER;
    v_items_needing_recount INTEGER;
BEGIN
    -- Obter ciclo atual
    SELECT current_cycle INTO v_current_cycle
    FROM inventario.inventory_lists
    WHERE id = p_inventory_id;
    
    -- Calcular próximo ciclo
    v_next_cycle := LEAST(v_current_cycle + 1, 3);
    
    -- Identificar itens que precisam recontagem
    WITH discrepancies AS (
        SELECT 
            ii.id,
            ii.expected_quantity,
            CASE v_current_cycle
                WHEN 1 THEN ii.count_cycle_1
                WHEN 2 THEN ii.count_cycle_2
                WHEN 3 THEN ii.count_cycle_3
            END as counted_quantity
        FROM inventario.inventory_items ii
        WHERE ii.inventory_list_id = p_inventory_id
    )
    SELECT COUNT(*) INTO v_items_needing_recount
    FROM discrepancies
    WHERE ABS(COALESCE(counted_quantity, 0) - COALESCE(expected_quantity, 0)) > 
          (COALESCE(expected_quantity, 1) * p_tolerance_percent / 100);
    
    -- Atualizar flags de recontagem para próximo ciclo
    IF v_next_cycle = 2 THEN
        UPDATE inventario.inventory_items ii
        SET needs_recount_cycle_2 = TRUE
        FROM discrepancies d
        WHERE ii.id = d.id
        AND ABS(COALESCE(d.counted_quantity, 0) - COALESCE(d.expected_quantity, 0)) > 
            (COALESCE(d.expected_quantity, 1) * p_tolerance_percent / 100);
    ELSIF v_next_cycle = 3 THEN
        UPDATE inventario.inventory_items ii
        SET needs_recount_cycle_3 = TRUE
        FROM discrepancies d
        WHERE ii.id = d.id
        AND ABS(COALESCE(d.counted_quantity, 0) - COALESCE(d.expected_quantity, 0)) > 
            (COALESCE(d.expected_quantity, 1) * p_tolerance_percent / 100);
    END IF;
    
    -- Atualizar ciclo atual
    UPDATE inventario.inventory_lists
    SET current_cycle = v_next_cycle,
        list_status = 'ABERTA'
    WHERE id = p_inventory_id;
    
    RETURN QUERY SELECT v_items_needing_recount, v_next_cycle;
END;
$$;


ALTER FUNCTION inventario.advance_cycle(p_inventory_id uuid, p_tolerance_percent numeric) OWNER TO inventario_user;

--
-- Name: calculate_counting_status(); Type: FUNCTION; Schema: inventario; Owner: inventario_user
--

CREATE FUNCTION inventario.calculate_counting_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    final_qty NUMERIC(15,4);
    expected_qty NUMERIC(15,4);
    tolerance NUMERIC(15,4) := 0.01;
    debug_product_code VARCHAR(20);
BEGIN
    -- Buscar product_code para debug (se disponível)
    IF TG_TABLE_NAME = 'counting_list_items' THEN
        SELECT ii.product_code INTO debug_product_code
        FROM inventario.inventory_items ii
        WHERE ii.id = NEW.inventory_item_id;
    ELSIF TG_TABLE_NAME = 'inventory_items' THEN
        debug_product_code := NEW.product_code;
    END IF;

    -- Log para debug
    RAISE NOTICE '🔄 [TRIGGER] Calculando status para produto %', COALESCE(debug_product_code, 'N/A');

    -- ============================================
    -- ETAPA 1: Buscar quantidade esperada (movido para ANTES)
    -- ============================================
    -- Para counting_list_items, buscar de inventory_items
    IF TG_TABLE_NAME = 'counting_list_items' THEN
        SELECT ii.expected_quantity INTO expected_qty
        FROM inventario.inventory_items ii
        WHERE ii.id = NEW.inventory_item_id;

        RAISE NOTICE '🎯 Quantidade esperada (via inventory_items): %', expected_qty;

    -- Para inventory_items, usar expected_quantity
    ELSIF TG_TABLE_NAME = 'inventory_items' THEN
        expected_qty := NEW.expected_quantity;
        RAISE NOTICE '🎯 Quantidade esperada (expected_quantity): %', expected_qty;
    END IF;

    -- Tratar NULL como 0
    expected_qty := COALESCE(expected_qty, 0);

    -- ============================================
    -- ETAPA 2: Verificar ZERO CONFIRMADO (v2.17.4)
    -- Se expected=0 E sem contagens = zero confirmado
    -- ============================================
    IF NEW.count_cycle_1 IS NULL AND
       NEW.count_cycle_2 IS NULL AND
       NEW.count_cycle_3 IS NULL THEN

        IF expected_qty = 0 THEN
            -- Zero confirmado (esperado=0 + campo vazio)
            NEW.status := 'ZERO_CONFIRMED';
            RAISE NOTICE '✅ Status = ZERO_CONFIRMED (esperado=0 + sem contagens)';
            RETURN NEW;
        ELSE
            -- Pendente (esperado>0 + não contado)
            NEW.status := 'PENDING';
            RAISE NOTICE '⚠️ Status = PENDING (sem contagens, esperado > 0)';
            RETURN NEW;
        END IF;
    END IF;

    -- ============================================
    -- ETAPA 3: Calcular quantidade final
    -- Prioridade: count_3 > count_2 > count_1
    -- ============================================
    final_qty := COALESCE(NEW.count_cycle_3, NEW.count_cycle_2, NEW.count_cycle_1);

    RAISE NOTICE '📊 Quantidade final calculada: %', final_qty;

    -- ============================================
    -- ETAPA 4: Comparar e definir status
    -- Tolerância: 0.01 para lidar com decimais
    -- ============================================
    IF ABS(final_qty - expected_qty) < tolerance THEN
        -- Quantidade bate = COUNTED
        NEW.status := 'COUNTED';
        RAISE NOTICE '✅ Status = COUNTED (diferença: % < %)', ABS(final_qty - expected_qty), tolerance;
    ELSE
        -- Quantidade difere = PENDING (indica divergência)
        NEW.status := 'PENDING';
        RAISE NOTICE '⚠️ Status = PENDING (diferença: % >= %)', ABS(final_qty - expected_qty), tolerance;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION inventario.calculate_counting_status() OWNER TO inventario_user;

--
-- Name: can_user_count(uuid, uuid); Type: FUNCTION; Schema: inventario; Owner: inventario_user
--

CREATE FUNCTION inventario.can_user_count(p_inventory_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_current_cycle INTEGER;
    v_can_count BOOLEAN := FALSE;
    v_counter_count INTEGER;
BEGIN
    -- Obter ciclo atual do inventário
    SELECT current_cycle
    INTO v_current_cycle
    FROM inventario.inventory_lists
    WHERE id = p_inventory_id;
    
    -- Se não encontrou o inventário, retornar false
    IF v_current_cycle IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Verificar se usuário tem atribuições para este inventário no ciclo atual
    -- Buscar nas counting_assignments baseado no ciclo
    IF v_current_cycle = 1 THEN
        -- Ciclo 1: buscar em counter_cycle_1 ou assigned_to (fallback)
        SELECT COUNT(*)
        INTO v_counter_count
        FROM inventario.counting_assignments ca
        JOIN inventario.inventory_items ii ON ca.inventory_item_id = ii.id
        WHERE ii.inventory_list_id = p_inventory_id
          AND (ca.counter_cycle_1 = p_user_id OR 
               (ca.counter_cycle_1 IS NULL AND ca.assigned_to = p_user_id));
               
    ELSIF v_current_cycle = 2 THEN
        -- Ciclo 2: buscar em counter_cycle_2 ou assigned_to (fallback)
        SELECT COUNT(*)
        INTO v_counter_count
        FROM inventario.counting_assignments ca
        JOIN inventario.inventory_items ii ON ca.inventory_item_id = ii.id
        WHERE ii.inventory_list_id = p_inventory_id
          AND (ca.counter_cycle_2 = p_user_id OR 
               (ca.counter_cycle_2 IS NULL AND ca.assigned_to = p_user_id AND ca.count_number = 2));
               
    ELSIF v_current_cycle = 3 THEN
        -- Ciclo 3: buscar em counter_cycle_3 ou assigned_to (fallback)
        SELECT COUNT(*)
        INTO v_counter_count
        FROM inventario.counting_assignments ca
        JOIN inventario.inventory_items ii ON ca.inventory_item_id = ii.id
        WHERE ii.inventory_list_id = p_inventory_id
          AND (ca.counter_cycle_3 = p_user_id OR 
               (ca.counter_cycle_3 IS NULL AND ca.assigned_to = p_user_id AND ca.count_number = 3));
    END IF;
    
    -- Retornar true se encontrou pelo menos uma atribuição
    RETURN v_counter_count > 0;
END;
$$;


ALTER FUNCTION inventario.can_user_count(p_inventory_id uuid, p_user_id uuid) OWNER TO inventario_user;

--
-- Name: enforce_single_default_store(); Type: FUNCTION; Schema: inventario; Owner: inventario_user
--

CREATE FUNCTION inventario.enforce_single_default_store() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Se a loja sendo inserida/atualizada é marcada como padrão
    IF NEW.is_default = TRUE THEN
        -- Desmarcar todas as outras lojas padrão do mesmo usuário
        UPDATE inventario.user_stores
        SET is_default = FALSE,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = NEW.user_id
          AND id != NEW.id
          AND is_default = TRUE;

        RAISE NOTICE 'Loja % marcada como padrão para usuário %. Outras lojas desmarcadas.', NEW.store_id, NEW.user_id;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION inventario.enforce_single_default_store() OWNER TO inventario_user;

--
-- Name: find_product_by_barcode(character varying, uuid); Type: FUNCTION; Schema: inventario; Owner: inventario_user
--

CREATE FUNCTION inventario.find_product_by_barcode(p_barcode character varying, p_store_id uuid DEFAULT NULL::uuid) RETURNS TABLE(product_id uuid, product_code character varying, product_name character varying, barcode character varying, alternative_barcodes jsonb)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.b1_cod,
        p.b1_desc,
        p.b1_codbar,
        p.alternative_barcodes
    FROM inventario.products p
    WHERE
        (p.store_id = p_store_id OR p_store_id IS NULL)
        AND (
            -- Busca por código de barras principal
            p.b1_codbar = p_barcode
            -- Busca por códigos de barras alternativos (JSONB - super rápido com índice GIN)
            OR p.alternative_barcodes @> to_jsonb(ARRAY[p_barcode])
        )
    LIMIT 1;
END;
$$;


ALTER FUNCTION inventario.find_product_by_barcode(p_barcode character varying, p_store_id uuid) OWNER TO inventario_user;

--
-- Name: generate_sub_list_code(character varying); Type: FUNCTION; Schema: inventario; Owner: inventario_user
--

CREATE FUNCTION inventario.generate_sub_list_code(parent_inventory_name character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $_$
DECLARE
    next_number INTEGER;
    new_code VARCHAR(50);
BEGIN
    -- Buscar próximo número sequencial para este inventário pai
    SELECT COALESCE(MAX(
        CAST(
            SUBSTRING(sub_code FROM LENGTH(parent_inventory_name || '_') + 1) 
            AS INTEGER
        )
    ), 0) + 1
    INTO next_number
    FROM inventario.inventory_sub_lists isl
    JOIN inventario.inventory_lists il ON isl.parent_inventory_id = il.id
    WHERE il.name = parent_inventory_name
    AND sub_code ~ ('^' || parent_inventory_name || '_[0-9]+$');
    
    -- Gerar código no formato: inventario_nome_001
    new_code := parent_inventory_name || '_' || LPAD(next_number::TEXT, 3, '0');
    
    RETURN new_code;
END;
$_$;


ALTER FUNCTION inventario.generate_sub_list_code(parent_inventory_name character varying) OWNER TO inventario_user;

--
-- Name: log_cycle_audit(uuid, uuid, uuid, character varying, integer, integer, jsonb); Type: FUNCTION; Schema: inventario; Owner: inventario_user
--

CREATE FUNCTION inventario.log_cycle_audit(p_inventory_list_id uuid, p_counting_list_id uuid, p_user_id uuid, p_action character varying, p_old_cycle integer DEFAULT NULL::integer, p_new_cycle integer DEFAULT NULL::integer, p_extra_metadata jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO inventario.cycle_audit_log (
        inventory_list_id,
        counting_list_id,
        user_id,
        action,
        old_cycle,
        new_cycle,
        extra_metadata
    ) VALUES (
        p_inventory_list_id,
        p_counting_list_id,
        p_user_id,
        p_action,
        p_old_cycle,
        p_new_cycle,
        p_extra_metadata
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;


ALTER FUNCTION inventario.log_cycle_audit(p_inventory_list_id uuid, p_counting_list_id uuid, p_user_id uuid, p_action character varying, p_old_cycle integer, p_new_cycle integer, p_extra_metadata jsonb) OWNER TO inventario_user;

--
-- Name: migrate_existing_inventories(); Type: FUNCTION; Schema: inventario; Owner: inventario_user
--

CREATE FUNCTION inventario.migrate_existing_inventories() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    inv_record RECORD;
    new_list_id UUID;
BEGIN
    -- Para cada inventário existente
    FOR inv_record IN
        SELECT id, name, counter_cycle_1, counter_cycle_2, counter_cycle_3,
               current_cycle, list_status, released_at, released_by,
               closed_at, closed_by, created_by
        FROM inventario.inventory_lists
        WHERE use_multiple_lists IS NULL OR use_multiple_lists = FALSE
    LOOP
        -- Criar uma lista de contagem padrão
        INSERT INTO inventario.counting_lists (
            inventory_id, list_name, description,
            counter_cycle_1, counter_cycle_2, counter_cycle_3,
            current_cycle, list_status,
            released_at, released_by, closed_at, closed_by,
            created_by
        ) VALUES (
            inv_record.id,
            'Lista Principal',
            'Lista migrada do sistema anterior',
            inv_record.counter_cycle_1,
            inv_record.counter_cycle_2,
            inv_record.counter_cycle_3,
            inv_record.current_cycle,
            inv_record.list_status,
            inv_record.released_at,
            inv_record.released_by,
            inv_record.closed_at,
            inv_record.closed_by,
            inv_record.created_by
        ) RETURNING id INTO new_list_id;

        -- Migrar os itens para a nova estrutura
        INSERT INTO inventario.counting_list_items (
            counting_list_id, inventory_item_id,
            needs_count_cycle_1, needs_count_cycle_2, needs_count_cycle_3,
            count_cycle_1, count_cycle_2, count_cycle_3,
            status, last_counted_at, last_counted_by
        )
        SELECT
            new_list_id,
            id,
            needs_recount_cycle_1,
            needs_recount_cycle_2,
            needs_recount_cycle_3,
            count_cycle_1,
            count_cycle_2,
            count_cycle_3,
            status,
            last_counted_at,
            last_counted_by
        FROM inventario.inventory_items
        WHERE inventory_list_id = inv_record.id;

        -- Marcar inventário como usando múltiplas listas
        UPDATE inventario.inventory_lists
        SET use_multiple_lists = TRUE,
            total_lists = 1
        WHERE id = inv_record.id;
    END LOOP;
END;
$$;


ALTER FUNCTION inventario.migrate_existing_inventories() OWNER TO inventario_user;

--
-- Name: update_protheus_integration_timestamp(); Type: FUNCTION; Schema: inventario; Owner: inventario_user
--

CREATE FUNCTION inventario.update_protheus_integration_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION inventario.update_protheus_integration_timestamp() OWNER TO inventario_user;

--
-- Name: update_sub_list_stats(); Type: FUNCTION; Schema: inventario; Owner: inventario_user
--

CREATE FUNCTION inventario.update_sub_list_stats() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Atualizar contadores da sublista quando produtos são adicionados/removidos
    IF TG_OP = 'INSERT' THEN
        UPDATE inventario.inventory_sub_lists 
        SET 
            total_products = (
                SELECT COUNT(*) 
                FROM inventario.inventory_sub_items 
                WHERE sub_list_id = NEW.sub_list_id
            ),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.sub_list_id;
        
        RETURN NEW;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        UPDATE inventario.inventory_sub_lists 
        SET 
            total_products = (
                SELECT COUNT(*) 
                FROM inventario.inventory_sub_items 
                WHERE sub_list_id = OLD.sub_list_id
            ),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.sub_list_id;
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$;


ALTER FUNCTION inventario.update_sub_list_stats() OWNER TO inventario_user;

--
-- Name: update_szb010_timestamp(); Type: FUNCTION; Schema: inventario; Owner: inventario_user
--

CREATE FUNCTION inventario.update_szb010_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION inventario.update_szb010_timestamp() OWNER TO inventario_user;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: inventario; Owner: inventario_user
--

CREATE FUNCTION inventario.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION inventario.update_updated_at_column() OWNER TO inventario_user;

--
-- Name: update_user_stores_timestamp(); Type: FUNCTION; Schema: inventario; Owner: inventario_user
--

CREATE FUNCTION inventario.update_user_stores_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION inventario.update_user_stores_timestamp() OWNER TO inventario_user;

--
-- Name: validate_cycle_assignment(); Type: FUNCTION; Schema: inventario; Owner: inventario_user
--

CREATE FUNCTION inventario.validate_cycle_assignment() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Ao liberar para contagem, garantir que o contador está definido
    IF NEW.list_status = 'EM_CONTAGEM' AND OLD.list_status = 'ABERTA' THEN
        -- Se não há contador para o ciclo atual, copiar do ciclo anterior
        IF NEW.current_cycle = 2 AND NEW.counter_cycle_2 IS NULL THEN
            NEW.counter_cycle_2 := NEW.counter_cycle_1;
        ELSIF NEW.current_cycle = 3 AND NEW.counter_cycle_3 IS NULL THEN
            NEW.counter_cycle_3 := COALESCE(NEW.counter_cycle_2, NEW.counter_cycle_1);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION inventario.validate_cycle_assignment() OWNER TO inventario_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: closed_counting_rounds; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.closed_counting_rounds (
    id uuid NOT NULL,
    inventory_list_id uuid NOT NULL,
    user_id uuid NOT NULL,
    round_number integer NOT NULL,
    closed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    notes text
);


ALTER TABLE inventario.closed_counting_rounds OWNER TO inventario_user;

--
-- Name: counting_assignments; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.counting_assignments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    inventory_item_id uuid NOT NULL,
    assigned_to uuid NOT NULL,
    assigned_by uuid NOT NULL,
    count_number integer NOT NULL,
    reason text,
    deadline timestamp with time zone,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp with time zone,
    notes text,
    counter_cycle_1 uuid,
    counter_cycle_2 uuid,
    counter_cycle_3 uuid,
    previous_counter_id uuid,
    cycle_number integer DEFAULT 1,
    updated_at timestamp with time zone,
    reassigned_at timestamp with time zone,
    reassigned_by uuid,
    list_status character varying(20) DEFAULT 'ABERTA'::character varying,
    CONSTRAINT counting_assignments_count_number_check CHECK (((count_number >= 1) AND (count_number <= 3)))
);


ALTER TABLE inventario.counting_assignments OWNER TO inventario_user;

--
-- Name: TABLE counting_assignments; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON TABLE inventario.counting_assignments IS 'Atribuições de contadores para itens específicos de inventário';


--
-- Name: COLUMN counting_assignments.reassigned_at; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.counting_assignments.reassigned_at IS 'Data/hora em que houve reatribuição do contador para outro usuário';


--
-- Name: COLUMN counting_assignments.reassigned_by; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.counting_assignments.reassigned_by IS 'ID do usuário que realizou a reatribuição (supervisor/admin)';


--
-- Name: COLUMN counting_assignments.list_status; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.counting_assignments.list_status IS 'Status individual da lista de contagem do usuário (ABERTA, EM_CONTAGEM, ENCERRADA)';


--
-- Name: counting_list_items; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.counting_list_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    counting_list_id uuid NOT NULL,
    inventory_item_id uuid NOT NULL,
    needs_count_cycle_1 boolean DEFAULT true,
    needs_count_cycle_2 boolean DEFAULT false,
    needs_count_cycle_3 boolean DEFAULT false,
    count_cycle_1 numeric(15,4),
    count_cycle_2 numeric(15,4),
    count_cycle_3 numeric(15,4),
    status inventario.counting_status DEFAULT 'PENDING'::inventario.counting_status,
    last_counted_at timestamp with time zone,
    last_counted_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone
);


ALTER TABLE inventario.counting_list_items OWNER TO inventario_user;

--
-- Name: TABLE counting_list_items; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON TABLE inventario.counting_list_items IS 'Itens de cada lista de contagem com controle individual de ciclos';


--
-- Name: COLUMN counting_list_items.counting_list_id; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.counting_list_items.counting_list_id IS 'Referência à lista de contagem específica';


--
-- Name: COLUMN counting_list_items.inventory_item_id; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.counting_list_items.inventory_item_id IS 'Referência ao item do inventário geral';


--
-- Name: counting_lists; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.counting_lists (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    inventory_id uuid NOT NULL,
    list_name character varying(100) NOT NULL,
    description text,
    counter_cycle_1 uuid,
    counter_cycle_2 uuid,
    counter_cycle_3 uuid,
    current_cycle integer DEFAULT 1,
    list_status character varying(20) DEFAULT 'PREPARACAO'::character varying,
    released_at timestamp with time zone,
    released_by uuid,
    closed_at timestamp with time zone,
    closed_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone,
    created_by uuid NOT NULL,
    finalization_type character varying(20) DEFAULT 'automatic'::character varying,
    CONSTRAINT counting_lists_current_cycle_check CHECK (((current_cycle >= 1) AND (current_cycle <= 3)))
);


ALTER TABLE inventario.counting_lists OWNER TO inventario_user;

--
-- Name: TABLE counting_lists; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON TABLE inventario.counting_lists IS 'Listas de contagem - Múltiplas por inventário, cada uma com seus contadores';


--
-- Name: COLUMN counting_lists.inventory_id; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.counting_lists.inventory_id IS 'Referência ao inventário pai';


--
-- Name: COLUMN counting_lists.list_name; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.counting_lists.list_name IS 'Nome da lista (ex: Lista 1, Lista Setor A, etc)';


--
-- Name: COLUMN counting_lists.current_cycle; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.counting_lists.current_cycle IS 'Ciclo atual desta lista específica (1, 2 ou 3)';


--
-- Name: counting_lots; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.counting_lots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    counting_id uuid NOT NULL,
    lot_number character varying(50) NOT NULL,
    quantity numeric(15,4) DEFAULT 0 NOT NULL,
    expiry_date date,
    observation text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    CONSTRAINT counting_lots_quantity_positive CHECK ((quantity >= (0)::numeric))
);


ALTER TABLE inventario.counting_lots OWNER TO inventario_user;

--
-- Name: countings; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.countings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    inventory_item_id uuid NOT NULL,
    quantity numeric(15,4) NOT NULL,
    lot_number character varying(50),
    serial_number character varying(50),
    observation text,
    counted_by uuid NOT NULL,
    count_number integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone
);


ALTER TABLE inventario.countings OWNER TO inventario_user;

--
-- Name: TABLE countings; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON TABLE inventario.countings IS 'Registros de contagem física dos itens';


--
-- Name: cycle_audit_log; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.cycle_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inventory_list_id uuid NOT NULL,
    counting_list_id uuid,
    user_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    old_cycle integer,
    new_cycle integer,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    extra_metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT cycle_audit_log_action_check CHECK (((action)::text = ANY ((ARRAY['CREATE_LIST'::character varying, 'START_CYCLE'::character varying, 'END_CYCLE'::character varying, 'FINALIZE_INVENTORY'::character varying, 'RECALCULATE_DISCREPANCIES'::character varying, 'ADVANCE_CYCLE'::character varying, 'SYNC_CYCLES'::character varying, 'MANUAL_ADJUSTMENT'::character varying, 'ANOMALY_DETECTED'::character varying])::text[]))),
    CONSTRAINT cycle_audit_log_cycle_values CHECK ((((old_cycle IS NULL) OR (old_cycle >= 1)) AND ((new_cycle IS NULL) OR (new_cycle >= 1))))
);


ALTER TABLE inventario.cycle_audit_log OWNER TO inventario_user;

--
-- Name: TABLE cycle_audit_log; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON TABLE inventario.cycle_audit_log IS 'Tabela de auditoria para rastreamento completo de operações de ciclos de inventário (v2.16.0)';


--
-- Name: COLUMN cycle_audit_log.id; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.cycle_audit_log.id IS 'ID único do log de auditoria';


--
-- Name: COLUMN cycle_audit_log.inventory_list_id; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.cycle_audit_log.inventory_list_id IS 'ID do inventário relacionado';


--
-- Name: COLUMN cycle_audit_log.counting_list_id; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.cycle_audit_log.counting_list_id IS 'ID da lista de contagem (NULL se operação no inventário)';


--
-- Name: COLUMN cycle_audit_log.user_id; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.cycle_audit_log.user_id IS 'ID do usuário que executou a ação';


--
-- Name: COLUMN cycle_audit_log.action; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.cycle_audit_log.action IS 'Tipo de ação executada (CREATE_LIST, START_CYCLE, END_CYCLE, etc.)';


--
-- Name: COLUMN cycle_audit_log.old_cycle; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.cycle_audit_log.old_cycle IS 'Ciclo anterior (NULL se não aplicável)';


--
-- Name: COLUMN cycle_audit_log.new_cycle; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.cycle_audit_log.new_cycle IS 'Novo ciclo (NULL se não aplicável)';


--
-- Name: COLUMN cycle_audit_log."timestamp"; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.cycle_audit_log."timestamp" IS 'Data/hora da operação';


--
-- Name: COLUMN cycle_audit_log.extra_metadata; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.cycle_audit_log.extra_metadata IS 'Dados adicionais em formato JSON: { products_pending: 10, discrepancies: 5, products_counted: 100, etc }';


--
-- Name: da1010; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.da1010 (
    da1_filial character varying(10) NOT NULL,
    da1_codtab character varying(10) NOT NULL,
    da1_codpro character varying(50) NOT NULL,
    da1_item character varying(10) NOT NULL,
    da1_prcven numeric(15,4),
    da1_moeda character varying(3),
    da1_tpoper character varying(10),
    da1_datvig timestamp without time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


ALTER TABLE inventario.da1010 OWNER TO inventario_user;

--
-- Name: discrepancies; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.discrepancies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    inventory_item_id uuid NOT NULL,
    variance_quantity numeric(15,4) NOT NULL,
    variance_percentage numeric(8,4) NOT NULL,
    tolerance_exceeded boolean DEFAULT false NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    observation text,
    resolution text,
    created_by uuid NOT NULL,
    resolved_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    resolved_at timestamp with time zone
);


ALTER TABLE inventario.discrepancies OWNER TO inventario_user;

--
-- Name: TABLE discrepancies; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON TABLE inventario.discrepancies IS 'Divergências encontradas entre esperado e contado';


--
-- Name: inventory_items; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.inventory_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    inventory_list_id uuid NOT NULL,
    product_id uuid,
    sequence integer NOT NULL,
    expected_quantity numeric(15,4),
    status inventario.counting_status DEFAULT 'PENDING'::inventario.counting_status NOT NULL,
    last_counted_at timestamp with time zone,
    last_counted_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone,
    product_code character varying(50),
    b2_qatu numeric(15,4),
    warehouse character varying(2) DEFAULT '01'::character varying,
    is_available_for_assignment boolean DEFAULT true,
    needs_recount_cycle_1 boolean DEFAULT true,
    needs_recount_cycle_2 boolean DEFAULT false,
    needs_recount_cycle_3 boolean DEFAULT false,
    count_cycle_1 numeric(15,4),
    count_cycle_2 numeric(15,4),
    count_cycle_3 numeric(15,4)
);


ALTER TABLE inventario.inventory_items OWNER TO inventario_user;

--
-- Name: TABLE inventory_items; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON TABLE inventario.inventory_items IS 'Itens que compõem cada lista de inventário';


--
-- Name: COLUMN inventory_items.needs_recount_cycle_1; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.inventory_items.needs_recount_cycle_1 IS 'Item precisa ser contado no 1º ciclo';


--
-- Name: COLUMN inventory_items.needs_recount_cycle_2; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.inventory_items.needs_recount_cycle_2 IS 'Item precisa ser recontado no 2º ciclo';


--
-- Name: COLUMN inventory_items.needs_recount_cycle_3; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.inventory_items.needs_recount_cycle_3 IS 'Item precisa ser recontado no 3º ciclo';


--
-- Name: COLUMN inventory_items.count_cycle_1; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.inventory_items.count_cycle_1 IS 'Quantidade contada no 1º ciclo';


--
-- Name: COLUMN inventory_items.count_cycle_2; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.inventory_items.count_cycle_2 IS 'Quantidade contada no 2º ciclo';


--
-- Name: COLUMN inventory_items.count_cycle_3; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.inventory_items.count_cycle_3 IS 'Quantidade contada no 3º ciclo';


--
-- Name: inventory_items_snapshot; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.inventory_items_snapshot (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    inventory_item_id uuid NOT NULL,
    b2_filial character varying(4),
    b2_cod character varying(50),
    b2_local character varying(2),
    b2_qatu numeric(15,4),
    b2_cm1 numeric(15,4),
    b1_desc character varying(200),
    b1_rastro character varying(1),
    b1_grupo character varying(50),
    b1_xcatgor character varying(50),
    b1_xsubcat character varying(50),
    b1_xsegmen character varying(50),
    b1_xgrinve character varying(50),
    bz_xlocal1 character varying(50),
    bz_xlocal2 character varying(50),
    bz_xlocal3 character varying(50),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    b2_xentpos numeric(15,2) DEFAULT 0.00
);


ALTER TABLE inventario.inventory_items_snapshot OWNER TO inventario_user;

--
-- Name: TABLE inventory_items_snapshot; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON TABLE inventario.inventory_items_snapshot IS 'Snapshot de dados congelados do produto no momento da inclusão no inventário. Unifica dados de SB1 (Cadastro), SB2 (Estoque) e SBZ (Indicadores). Relacionamento 1:1 com inventory_items. Imutável após criação.';


--
-- Name: COLUMN inventory_items_snapshot.inventory_item_id; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.inventory_items_snapshot.inventory_item_id IS 'Relacionamento 1:1 com inventory_items. Cada item tem exatamente um snapshot.';


--
-- Name: COLUMN inventory_items_snapshot.b2_cm1; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.inventory_items_snapshot.b2_cm1 IS 'Custo médio unitário congelado (b2_cm1) para cálculos financeiros. Permite calcular valor total do inventário: qty * b2_cm1';


--
-- Name: COLUMN inventory_items_snapshot.b1_rastro; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.inventory_items_snapshot.b1_rastro IS 'Tipo de rastreamento: L=Lote, S=Série, N=Não rastreia. Produtos com L=Lote terão snapshots em inventory_lots_snapshot.';


--
-- Name: COLUMN inventory_items_snapshot.b2_xentpos; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.inventory_items_snapshot.b2_xentpos IS 'Quantidade de produtos vendidos (faturados) mas ainda não retirados pelo cliente (snapshot congelado).';


--
-- Name: inventory_lists; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.inventory_lists (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    reference_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    count_deadline timestamp with time zone,
    status inventario.inventory_status DEFAULT 'DRAFT'::inventario.inventory_status NOT NULL,
    store_id uuid NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone,
    warehouse character varying(2) DEFAULT '01'::character varying,
    warehouse_location character varying(10),
    cycle_number integer DEFAULT 1,
    list_status character varying(20) DEFAULT 'ABERTA'::character varying,
    released_at timestamp with time zone,
    released_by uuid,
    closed_at timestamp with time zone,
    closed_by uuid,
    counter_cycle_1 uuid,
    counter_cycle_2 uuid,
    counter_cycle_3 uuid,
    current_cycle integer DEFAULT 1,
    use_multiple_lists boolean DEFAULT false,
    total_lists integer DEFAULT 0,
    finalization_type character varying(20) DEFAULT 'automatic'::character varying,
    CONSTRAINT inventory_lists_current_cycle_check CHECK (((current_cycle >= 1) AND (current_cycle <= 3)))
);


ALTER TABLE inventario.inventory_lists OWNER TO inventario_user;

--
-- Name: TABLE inventory_lists; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON TABLE inventario.inventory_lists IS 'Listas de inventário físico';


--
-- Name: COLUMN inventory_lists.counter_cycle_1; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.inventory_lists.counter_cycle_1 IS 'Usuário responsável pela 1ª contagem';


--
-- Name: COLUMN inventory_lists.counter_cycle_2; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.inventory_lists.counter_cycle_2 IS 'Usuário responsável pela 2ª contagem';


--
-- Name: COLUMN inventory_lists.counter_cycle_3; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.inventory_lists.counter_cycle_3 IS 'Usuário responsável pela 3ª contagem';


--
-- Name: COLUMN inventory_lists.current_cycle; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.inventory_lists.current_cycle IS 'Ciclo atual de contagem (1, 2 ou 3)';


--
-- Name: COLUMN inventory_lists.finalization_type; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.inventory_lists.finalization_type IS 'Tipo de finalização da lista: automatic (sistema encerrou sem divergências), manual (usuário encerrou no 3º ciclo), forced (usuário forçou encerramento antes do 3º ciclo)';


--
-- Name: inventory_lots_snapshot; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.inventory_lots_snapshot (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    inventory_item_id uuid NOT NULL,
    b8_lotectl character varying(50) NOT NULL,
    b8_saldo numeric(15,4) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    b8_lotefor character varying(18) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE inventario.inventory_lots_snapshot OWNER TO inventario_user;

--
-- Name: TABLE inventory_lots_snapshot; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON TABLE inventario.inventory_lots_snapshot IS 'Snapshot de lotes congelados no momento da inclusão do produto no inventário. Armazena múltiplos lotes de SB8 (Saldo por Lote). Relacionamento 1:N com inventory_items (um produto pode ter vários lotes). Apenas produtos com b1_rastro=L terão registros aqui. Imutável após criação.';


--
-- Name: COLUMN inventory_lots_snapshot.inventory_item_id; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.inventory_lots_snapshot.inventory_item_id IS 'Relacionamento 1:N com inventory_items. Cada item pode ter múltiplos lotes.';


--
-- Name: COLUMN inventory_lots_snapshot.b8_lotectl; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.inventory_lots_snapshot.b8_lotectl IS 'Número do lote congelado (ex: 000000000019208). Constraint garante que não há lotes duplicados para o mesmo item.';


--
-- Name: COLUMN inventory_lots_snapshot.b8_saldo; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.inventory_lots_snapshot.b8_saldo IS 'Saldo do lote congelado no momento da inclusão. Usado para validação de contagens por lote.';


--
-- Name: COLUMN inventory_lots_snapshot.b8_lotefor; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.inventory_lots_snapshot.b8_lotefor IS 'Número do lote do fornecedor (snapshot). Congelado no momento da criação do inventário.';


--
-- Name: inventory_sub_items; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.inventory_sub_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    sub_list_id uuid NOT NULL,
    inventory_item_id uuid NOT NULL,
    sequence_in_sub_list integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT positive_sequence CHECK ((sequence_in_sub_list > 0))
);


ALTER TABLE inventario.inventory_sub_items OWNER TO inventario_user;

--
-- Name: TABLE inventory_sub_items; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON TABLE inventario.inventory_sub_items IS 'Mapeamento de produtos para sublistas específicas';


--
-- Name: inventory_sub_lists; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.inventory_sub_lists (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    parent_inventory_id uuid NOT NULL,
    sub_name character varying(100) NOT NULL,
    sub_code character varying(50) NOT NULL,
    assigned_user_id uuid NOT NULL,
    status inventario.inventory_status DEFAULT 'DRAFT'::inventario.inventory_status NOT NULL,
    current_cycle integer DEFAULT 1 NOT NULL,
    released_for_cycle_1 boolean DEFAULT false NOT NULL,
    released_for_cycle_2 boolean DEFAULT false NOT NULL,
    released_for_cycle_3 boolean DEFAULT false NOT NULL,
    cycle_1_closed_at timestamp with time zone,
    cycle_2_closed_at timestamp with time zone,
    cycle_3_closed_at timestamp with time zone,
    total_products integer DEFAULT 0 NOT NULL,
    counted_products integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone,
    CONSTRAINT valid_cycle CHECK (((current_cycle >= 1) AND (current_cycle <= 3)))
);


ALTER TABLE inventario.inventory_sub_lists OWNER TO inventario_user;

--
-- Name: TABLE inventory_sub_lists; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON TABLE inventario.inventory_sub_lists IS 'Sublistas de inventário - permite múltiplas listas por inventário principal';


--
-- Name: COLUMN inventory_sub_lists.parent_inventory_id; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.inventory_sub_lists.parent_inventory_id IS 'Referência ao inventário pai (real)';


--
-- Name: COLUMN inventory_sub_lists.sub_code; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.inventory_sub_lists.sub_code IS 'Código único da sublista (ex: clenio_02_001)';


--
-- Name: COLUMN inventory_sub_lists.assigned_user_id; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.inventory_sub_lists.assigned_user_id IS 'Usuário responsável por esta sublista';


--
-- Name: COLUMN inventory_sub_lists.current_cycle; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.inventory_sub_lists.current_cycle IS 'Ciclo atual da sublista (1, 2 ou 3)';


--
-- Name: lot_counting_drafts; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.lot_counting_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inventory_item_id uuid NOT NULL,
    counted_by uuid NOT NULL,
    draft_data jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    current_cycle integer DEFAULT 1
);


ALTER TABLE inventario.lot_counting_drafts OWNER TO inventario_user;

--
-- Name: TABLE lot_counting_drafts; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON TABLE inventario.lot_counting_drafts IS 'Rascunhos de contagem de lotes - persiste dados mesmo com limpeza do navegador';


--
-- Name: COLUMN lot_counting_drafts.draft_data; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.lot_counting_drafts.draft_data IS 'Dados dos lotes em formato JSON: [{lot_number, counted_qty, system_qty, expiry_date}]';


--
-- Name: COLUMN lot_counting_drafts.current_cycle; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.lot_counting_drafts.current_cycle IS 'Ciclo de contagem ao qual este rascunho pertence (1, 2 ou 3)';


--
-- Name: product_barcodes; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.product_barcodes (
    id uuid NOT NULL,
    slk_filial character varying(10) NOT NULL,
    slk_codbar character varying(50) NOT NULL,
    slk_produto character varying(50) NOT NULL,
    product_id uuid NOT NULL,
    store_id uuid NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


ALTER TABLE inventario.product_barcodes OWNER TO inventario_user;

--
-- Name: product_prices; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.product_prices (
    id uuid NOT NULL,
    da1_filial character varying(10) NOT NULL,
    da1_item character varying(10) NOT NULL,
    da1_codtab character varying(10) NOT NULL,
    da1_codpro character varying(50) NOT NULL,
    da1_prcven numeric(15,4) NOT NULL,
    da1_xupd timestamp with time zone,
    product_id uuid NOT NULL,
    store_id uuid NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


ALTER TABLE inventario.product_prices OWNER TO inventario_user;

--
-- Name: product_stores; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.product_stores (
    id uuid NOT NULL,
    bz_filial character varying(10) NOT NULL,
    bz_cod character varying(50) NOT NULL,
    bz_xlocliz1 character varying(50),
    bz_xlocliz2 character varying(50),
    bz_xlocliz3 character varying(50),
    product_id uuid NOT NULL,
    store_id uuid NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


ALTER TABLE inventario.product_stores OWNER TO inventario_user;

--
-- Name: products; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.products (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    barcode character varying(50),
    name character varying(200) NOT NULL,
    description text,
    category character varying(100),
    unit character varying(10) NOT NULL,
    cost_price numeric(15,4),
    sale_price numeric(15,4),
    current_stock numeric(15,4) DEFAULT 0,
    has_serial boolean DEFAULT false NOT NULL,
    has_lot boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    store_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone,
    warehouse character varying(2) DEFAULT '01'::character varying,
    b1_cod character varying(15),
    b1_desc character varying(100),
    b1_codbar character varying(50),
    b1_rastro character(1),
    b1_um character varying(2),
    b1_tipo character(2),
    b1_grupo character varying(4),
    b1_filial character varying(2),
    hierarchy_category character varying(20),
    hierarchy_subcategory character varying(20),
    hierarchy_segment character varying(20),
    alternative_barcodes jsonb DEFAULT '[]'::jsonb,
    protheus_recno integer,
    last_sync_at timestamp with time zone,
    sync_status character varying(20) DEFAULT 'pending'::character varying,
    CONSTRAINT chk_products_rastro CHECK (((b1_rastro IS NULL) OR (b1_rastro = ANY (ARRAY['L'::bpchar, 'S'::bpchar, 'N'::bpchar])))),
    CONSTRAINT chk_products_sync_status CHECK (((sync_status)::text = ANY ((ARRAY['pending'::character varying, 'synced'::character varying, 'error'::character varying])::text[])))
);


ALTER TABLE inventario.products OWNER TO inventario_user;

--
-- Name: TABLE products; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON TABLE inventario.products IS 'Cache local de produtos do Protheus (SB1010) + códigos de barras (SLK010) - Performance 1.860x melhor';


--
-- Name: COLUMN products.code; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.products.code IS 'Código do produto (mesmo que b1_cod) - mantido para compatibilidade';


--
-- Name: COLUMN products.barcode; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.products.barcode IS 'Código de barras principal (mesmo que b1_codbar) - mantido para compatibilidade';


--
-- Name: COLUMN products.name; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.products.name IS 'Nome do produto (mesmo que b1_desc) - mantido para compatibilidade';


--
-- Name: COLUMN products.alternative_barcodes; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.products.alternative_barcodes IS 'Array de códigos de barras alternativos da SLK010 em formato JSONB - usa índice GIN para buscas rápidas';


--
-- Name: COLUMN products.protheus_recno; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.products.protheus_recno IS 'R_E_C_N_O_ do Protheus para sincronização incremental (detectar novos/alterados)';


--
-- Name: protheus_integration_items; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.protheus_integration_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    integration_id uuid NOT NULL,
    item_type character varying(20) NOT NULL,
    product_code character varying(15) NOT NULL,
    product_description character varying(100),
    lot_number character varying(50),
    source_warehouse character varying(2),
    target_warehouse character varying(2),
    quantity numeric(15,4) NOT NULL,
    expected_qty numeric(15,4),
    counted_qty numeric(15,4),
    adjusted_qty numeric(15,4),
    unit_cost numeric(15,4),
    total_value numeric(15,2),
    adjustment_type character varying(20),
    item_status character varying(20) DEFAULT 'PENDING'::character varying,
    error_detail text,
    protheus_seq character varying(20),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT protheus_integration_items_adjustment_type_check CHECK (((adjustment_type)::text = ANY ((ARRAY['INCREASE'::character varying, 'DECREASE'::character varying, 'ZERO_OUT'::character varying, 'NO_CHANGE'::character varying])::text[]))),
    CONSTRAINT protheus_integration_items_item_status_check CHECK (((item_status)::text = ANY ((ARRAY['PENDING'::character varying, 'SENT'::character varying, 'CONFIRMED'::character varying, 'ERROR'::character varying])::text[]))),
    CONSTRAINT protheus_integration_items_item_type_check CHECK (((item_type)::text = ANY ((ARRAY['TRANSFER'::character varying, 'ADJUSTMENT'::character varying])::text[])))
);


ALTER TABLE inventario.protheus_integration_items OWNER TO inventario_user;

--
-- Name: TABLE protheus_integration_items; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON TABLE inventario.protheus_integration_items IS 'Itens detalhados das integrações (transferências e ajustes)';


--
-- Name: COLUMN protheus_integration_items.item_type; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.protheus_integration_items.item_type IS 'TRANSFER=SD3, ADJUSTMENT=SB7';


--
-- Name: protheus_integrations; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.protheus_integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inventory_a_id uuid NOT NULL,
    inventory_b_id uuid,
    store_id uuid NOT NULL,
    integration_type character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'DRAFT'::character varying NOT NULL,
    integration_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    protheus_response jsonb,
    protheus_doc_transfers character varying(50),
    protheus_doc_inventory character varying(50),
    error_message text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    sent_at timestamp with time zone,
    confirmed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancelled_by uuid,
    cancellation_reason text,
    version integer DEFAULT 1,
    CONSTRAINT protheus_integrations_integration_type_check CHECK (((integration_type)::text = ANY ((ARRAY['SIMPLE'::character varying, 'COMPARATIVE'::character varying])::text[]))),
    CONSTRAINT protheus_integrations_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'PENDING'::character varying, 'SENT'::character varying, 'PROCESSING'::character varying, 'CONFIRMED'::character varying, 'PARTIAL'::character varying, 'ERROR'::character varying, 'CANCELLED'::character varying])::text[])))
);


ALTER TABLE inventario.protheus_integrations OWNER TO inventario_user;

--
-- Name: TABLE protheus_integrations; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON TABLE inventario.protheus_integrations IS 'Controle de integrações de inventário com ERP Protheus (v2.19.0)';


--
-- Name: COLUMN protheus_integrations.integration_type; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.protheus_integrations.integration_type IS 'SIMPLE=apenas SB7, COMPARATIVE=SD3+SB7';


--
-- Name: COLUMN protheus_integrations.integration_data; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.protheus_integrations.integration_data IS 'Payload JSON completo para envio ao Protheus';


--
-- Name: COLUMN protheus_integrations.summary; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.protheus_integrations.summary IS 'Resumo para exibição rápida na UI';


--
-- Name: COLUMN protheus_integrations.version; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.protheus_integrations.version IS 'Incrementado a cada reprocessamento';


--
-- Name: sb1010; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.sb1010 (
    b1_filial character varying(10) NOT NULL,
    b1_cod character varying(50) NOT NULL,
    b1_codbar character varying(50),
    b1_desc character varying(100),
    b1_tipo character varying(2),
    b1_um character varying(2),
    b1_locpad character varying(10),
    b1_grupo character varying(10),
    b1_xcatgor character varying(100),
    b1_xsubcat character varying(100),
    b1_xsegmen character varying(100),
    b1_xgrinve character varying(100),
    b1_rastro character varying(1) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


ALTER TABLE inventario.sb1010 OWNER TO inventario_user;

--
-- Name: sb2010; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.sb2010 (
    b2_filial character varying(10) NOT NULL,
    b2_cod character varying(50) NOT NULL,
    b2_local character varying(10) NOT NULL,
    b2_qatu numeric(15,4),
    b2_vatu1 numeric(15,2),
    b2_cm1 numeric(15,4),
    b2_qemp numeric(15,4),
    b2_reserva numeric(15,4),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    b2_xentpos numeric(15,2) DEFAULT 0.00 NOT NULL
);


ALTER TABLE inventario.sb2010 OWNER TO inventario_user;

--
-- Name: COLUMN sb2010.b2_xentpos; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.sb2010.b2_xentpos IS 'Quantidade de produtos vendidos (faturados) mas ainda não retirados pelo cliente. Utilizado para ajustar quantidade esperada no inventário físico. Fórmula: Qtde Esperada = b2_qatu + b2_xentpos';


--
-- Name: sb8010; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.sb8010 (
    id uuid NOT NULL,
    b8_filial character varying(10) NOT NULL,
    b8_produto character varying(50) NOT NULL,
    b8_local character varying(10) NOT NULL,
    b8_lotectl character varying(20) NOT NULL,
    b8_saldo numeric(15,4),
    b8_dtvalid character varying(10),
    b8_numlote character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    b8_lotefor character varying(18) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE inventario.sb8010 OWNER TO inventario_user;

--
-- Name: COLUMN sb8010.b8_lotefor; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.sb8010.b8_lotefor IS 'Número do lote do fornecedor. Utilizado como informação complementar ao b8_lotectl para facilitar identificação física durante contagem.';


--
-- Name: sbm010; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.sbm010 (
    bm_filial character varying(10) NOT NULL,
    bm_grupo character varying(20) NOT NULL,
    bm_desc character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    is_active boolean NOT NULL
);


ALTER TABLE inventario.sbm010 OWNER TO inventario_user;

--
-- Name: sbz010; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.sbz010 (
    bz_filial character varying(10) NOT NULL,
    bz_cod character varying(50) NOT NULL,
    bz_local character varying(10),
    bz_xlocal1 character varying(50),
    bz_xlocal2 character varying(50),
    bz_xlocal3 character varying(50),
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


ALTER TABLE inventario.sbz010 OWNER TO inventario_user;

--
-- Name: slk010; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.slk010 (
    id uuid NOT NULL,
    slk_filial character varying(10) NOT NULL,
    slk_codbar character varying(50) NOT NULL,
    slk_produto character varying(50) NOT NULL,
    product_id uuid,
    store_id uuid,
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


ALTER TABLE inventario.slk010 OWNER TO inventario_user;

--
-- Name: stores; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.stores (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(10) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    address character varying(200),
    phone character varying(20),
    email character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone
);


ALTER TABLE inventario.stores OWNER TO inventario_user;

--
-- Name: TABLE stores; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON TABLE inventario.stores IS 'Cadastro de lojas/filiais da empresa';


--
-- Name: system_config; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.system_config (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    key character varying(100) NOT NULL,
    value text,
    description text,
    category character varying(50),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone
);


ALTER TABLE inventario.system_config OWNER TO inventario_user;

--
-- Name: TABLE system_config; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON TABLE inventario.system_config IS 'Configurações gerais do sistema';


--
-- Name: system_logs; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.system_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    level character varying(10) NOT NULL,
    message text NOT NULL,
    module character varying(50),
    function character varying(50),
    user_id uuid,
    store_id uuid,
    ip_address inet,
    user_agent text,
    additional_data jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE inventario.system_logs OWNER TO inventario_user;

--
-- Name: TABLE system_logs; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON TABLE inventario.system_logs IS 'Logs de auditoria do sistema';


--
-- Name: szb010; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.szb010 (
    zb_filial character varying(2) NOT NULL,
    zb_xlocal character varying(2) NOT NULL,
    zb_xdesc character varying(30) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    zb_xsbzlcz character(1) DEFAULT '1'::bpchar
);


ALTER TABLE inventario.szb010 OWNER TO inventario_user;

--
-- Name: TABLE szb010; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON TABLE inventario.szb010 IS 'Cadastro de Armazéns/Locais (espelho Protheus SZB010)';


--
-- Name: COLUMN szb010.zb_filial; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.szb010.zb_filial IS 'Código da filial (2 caracteres)';


--
-- Name: COLUMN szb010.zb_xlocal; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.szb010.zb_xlocal IS 'Código do armazém (2 caracteres)';


--
-- Name: COLUMN szb010.zb_xdesc; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.szb010.zb_xdesc IS 'Descrição do armazém (30 caracteres)';


--
-- Name: COLUMN szb010.zb_xsbzlcz; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.szb010.zb_xsbzlcz IS 'Indica qual localização usar: 1=BZ_XLOCAL1, 2=BZ_XLOCAL2, 3=BZ_XLOCAL3';


--
-- Name: szd010; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.szd010 (
    zd_filial character varying(10) NOT NULL,
    zd_xcod character varying(20) NOT NULL,
    zd_xdesc character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    is_active boolean NOT NULL
);


ALTER TABLE inventario.szd010 OWNER TO inventario_user;

--
-- Name: sze010; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.sze010 (
    ze_filial character varying(10) NOT NULL,
    ze_xcod character varying(20) NOT NULL,
    ze_xdesc character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    is_active boolean NOT NULL
);


ALTER TABLE inventario.sze010 OWNER TO inventario_user;

--
-- Name: szf010; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.szf010 (
    zf_filial character varying(10) NOT NULL,
    zf_xcod character varying(20) NOT NULL,
    zf_xdesc character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    is_active boolean NOT NULL
);


ALTER TABLE inventario.szf010 OWNER TO inventario_user;

--
-- Name: user_stores; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.user_stores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    store_id uuid NOT NULL,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    updated_at timestamp with time zone
);


ALTER TABLE inventario.user_stores OWNER TO inventario_user;

--
-- Name: TABLE user_stores; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON TABLE inventario.user_stores IS 'Relacionamento N:N entre usuários e lojas/filiais. Permite que um usuário acesse múltiplas lojas.';


--
-- Name: COLUMN user_stores.id; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.user_stores.id IS 'Chave primária UUID';


--
-- Name: COLUMN user_stores.user_id; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.user_stores.user_id IS 'Referência ao usuário (FK para users.id)';


--
-- Name: COLUMN user_stores.store_id; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.user_stores.store_id IS 'Referência à loja/filial (FK para stores.id)';


--
-- Name: COLUMN user_stores.is_default; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.user_stores.is_default IS 'Indica se esta é a loja padrão sugerida no login para este usuário. Apenas uma loja pode ser padrão por usuário (garantido por trigger).';


--
-- Name: COLUMN user_stores.created_at; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.user_stores.created_at IS 'Data/hora de criação do registro';


--
-- Name: COLUMN user_stores.created_by; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.user_stores.created_by IS 'Usuário (ADMIN) que criou o vínculo';


--
-- Name: COLUMN user_stores.updated_at; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON COLUMN inventario.user_stores.updated_at IS 'Data/hora da última atualização (auto-atualizada por trigger)';


--
-- Name: users; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    username character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL,
    full_name character varying(100) NOT NULL,
    email character varying(100),
    role inventario.user_role DEFAULT 'OPERATOR'::inventario.user_role NOT NULL,
    store_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    last_login timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone
);


ALTER TABLE inventario.users OWNER TO inventario_user;

--
-- Name: TABLE users; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON TABLE inventario.users IS 'Usuários do sistema com controle de acesso por loja';


--
-- Name: v_counting_lists_summary; Type: VIEW; Schema: inventario; Owner: inventario_user
--

CREATE VIEW inventario.v_counting_lists_summary AS
 SELECT cl.id AS list_id,
    cl.list_name,
    cl.description,
    cl.current_cycle,
    cl.list_status,
    il.id AS inventory_id,
    il.name AS inventory_name,
    il.warehouse,
    il.status AS inventory_status,
    u1.username AS counter_cycle_1_name,
    u2.username AS counter_cycle_2_name,
    u3.username AS counter_cycle_3_name,
    count(cli.id) AS total_items,
    count(
        CASE
            WHEN (cli.status = 'COUNTED'::inventario.counting_status) THEN 1
            ELSE NULL::integer
        END) AS counted_items,
    count(
        CASE
            WHEN (cli.status = 'PENDING'::inventario.counting_status) THEN 1
            ELSE NULL::integer
        END) AS pending_items
   FROM (((((inventario.counting_lists cl
     JOIN inventario.inventory_lists il ON ((cl.inventory_id = il.id)))
     LEFT JOIN inventario.users u1 ON ((cl.counter_cycle_1 = u1.id)))
     LEFT JOIN inventario.users u2 ON ((cl.counter_cycle_2 = u2.id)))
     LEFT JOIN inventario.users u3 ON ((cl.counter_cycle_3 = u3.id)))
     LEFT JOIN inventario.counting_list_items cli ON ((cl.id = cli.counting_list_id)))
  GROUP BY cl.id, cl.list_name, cl.description, cl.current_cycle, cl.list_status, il.id, il.name, il.warehouse, il.status, u1.username, u2.username, u3.username;


ALTER TABLE inventario.v_counting_lists_summary OWNER TO inventario_user;

--
-- Name: v_inventory_cycle_status; Type: VIEW; Schema: inventario; Owner: inventario_user
--

CREATE VIEW inventario.v_inventory_cycle_status AS
 SELECT il.id AS inventory_id,
    il.name AS inventory_name,
    il.current_cycle,
    il.list_status,
    u1.full_name AS counter_cycle_1_name,
    u2.full_name AS counter_cycle_2_name,
    u3.full_name AS counter_cycle_3_name,
    count(DISTINCT ii.id) AS total_items,
    count(DISTINCT
        CASE
            WHEN ii.needs_recount_cycle_1 THEN ii.id
            ELSE NULL::uuid
        END) AS items_cycle_1,
    count(DISTINCT
        CASE
            WHEN ii.needs_recount_cycle_2 THEN ii.id
            ELSE NULL::uuid
        END) AS items_cycle_2,
    count(DISTINCT
        CASE
            WHEN ii.needs_recount_cycle_3 THEN ii.id
            ELSE NULL::uuid
        END) AS items_cycle_3
   FROM ((((inventario.inventory_lists il
     LEFT JOIN inventario.users u1 ON ((il.counter_cycle_1 = u1.id)))
     LEFT JOIN inventario.users u2 ON ((il.counter_cycle_2 = u2.id)))
     LEFT JOIN inventario.users u3 ON ((il.counter_cycle_3 = u3.id)))
     LEFT JOIN inventario.inventory_items ii ON ((ii.inventory_list_id = il.id)))
  GROUP BY il.id, il.name, il.current_cycle, il.list_status, u1.full_name, u2.full_name, u3.full_name;


ALTER TABLE inventario.v_inventory_cycle_status OWNER TO inventario_user;

--
-- Name: v_inventory_stats; Type: VIEW; Schema: inventario; Owner: inventario_user
--

CREATE VIEW inventario.v_inventory_stats AS
SELECT
    NULL::uuid AS id,
    NULL::character varying(100) AS name,
    NULL::text AS description,
    NULL::timestamp with time zone AS reference_date,
    NULL::timestamp with time zone AS count_deadline,
    NULL::inventario.inventory_status AS status,
    NULL::uuid AS store_id,
    NULL::uuid AS created_by,
    NULL::timestamp with time zone AS created_at,
    NULL::timestamp with time zone AS updated_at,
    NULL::character varying(10) AS store_code,
    NULL::character varying(100) AS store_name,
    NULL::character varying(100) AS created_by_name,
    NULL::bigint AS total_items,
    NULL::bigint AS counted_items,
    NULL::numeric AS progress_percentage;


ALTER TABLE inventario.v_inventory_stats OWNER TO inventario_user;

--
-- Name: v_products_enhanced; Type: VIEW; Schema: inventario; Owner: inventario_user
--

CREATE VIEW inventario.v_products_enhanced AS
 SELECT p.id,
    p.code,
    p.b1_cod,
    p.barcode,
    p.b1_codbar,
    p.name,
    p.b1_desc,
    p.b1_rastro AS tracking,
    p.b1_um AS unit,
    p.b1_tipo AS type,
    p.b1_grupo AS group_code,
    p.hierarchy_category,
    p.hierarchy_subcategory,
    p.hierarchy_segment,
    p.alternative_barcodes,
    COALESCE(jsonb_array_length(p.alternative_barcodes), 0) AS alt_barcodes_count,
    p.store_id,
    p.warehouse,
    p.is_active,
    p.created_at,
    p.updated_at,
    p.last_sync_at,
    p.sync_status
   FROM inventario.products p;


ALTER TABLE inventario.v_products_enhanced OWNER TO inventario_user;

--
-- Name: v_products_with_store; Type: VIEW; Schema: inventario; Owner: inventario_user
--

CREATE VIEW inventario.v_products_with_store AS
 SELECT p.id,
    p.code,
    p.barcode,
    p.name,
    p.description,
    p.category,
    p.unit,
    p.cost_price,
    p.sale_price,
    p.current_stock,
    p.has_serial,
    p.has_lot,
    p.is_active,
    p.store_id,
    p.created_at,
    p.updated_at,
    s.code AS store_code,
    s.name AS store_name
   FROM (inventario.products p
     JOIN inventario.stores s ON ((p.store_id = s.id)));


ALTER TABLE inventario.v_products_with_store OWNER TO inventario_user;

--
-- Name: warehouses; Type: TABLE; Schema: inventario; Owner: inventario_user
--

CREATE TABLE inventario.warehouses (
    id uuid NOT NULL,
    code character varying(2) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    store_id uuid NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


ALTER TABLE inventario.warehouses OWNER TO inventario_user;

--
-- Name: closed_counting_rounds closed_counting_rounds_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.closed_counting_rounds
    ADD CONSTRAINT closed_counting_rounds_pkey PRIMARY KEY (id);


--
-- Name: counting_assignments counting_assignments_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_assignments
    ADD CONSTRAINT counting_assignments_pkey PRIMARY KEY (id);


--
-- Name: counting_list_items counting_list_items_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_list_items
    ADD CONSTRAINT counting_list_items_pkey PRIMARY KEY (id);


--
-- Name: counting_lists counting_lists_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_lists
    ADD CONSTRAINT counting_lists_pkey PRIMARY KEY (id);


--
-- Name: counting_lots counting_lots_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_lots
    ADD CONSTRAINT counting_lots_pkey PRIMARY KEY (id);


--
-- Name: countings countings_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.countings
    ADD CONSTRAINT countings_pkey PRIMARY KEY (id);


--
-- Name: cycle_audit_log cycle_audit_log_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.cycle_audit_log
    ADD CONSTRAINT cycle_audit_log_pkey PRIMARY KEY (id);


--
-- Name: da1010 da1010_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.da1010
    ADD CONSTRAINT da1010_pkey PRIMARY KEY (da1_filial, da1_codtab, da1_codpro, da1_item);


--
-- Name: discrepancies discrepancies_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.discrepancies
    ADD CONSTRAINT discrepancies_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_items_snapshot inventory_items_snapshot_inventory_item_id_key; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_items_snapshot
    ADD CONSTRAINT inventory_items_snapshot_inventory_item_id_key UNIQUE (inventory_item_id);


--
-- Name: inventory_items_snapshot inventory_items_snapshot_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_items_snapshot
    ADD CONSTRAINT inventory_items_snapshot_pkey PRIMARY KEY (id);


--
-- Name: inventory_lists inventory_lists_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_lists
    ADD CONSTRAINT inventory_lists_pkey PRIMARY KEY (id);


--
-- Name: inventory_lots_snapshot inventory_lots_snapshot_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_lots_snapshot
    ADD CONSTRAINT inventory_lots_snapshot_pkey PRIMARY KEY (id);


--
-- Name: inventory_sub_items inventory_sub_items_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_sub_items
    ADD CONSTRAINT inventory_sub_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_sub_lists inventory_sub_lists_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_sub_lists
    ADD CONSTRAINT inventory_sub_lists_pkey PRIMARY KEY (id);


--
-- Name: lot_counting_drafts lot_counting_drafts_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.lot_counting_drafts
    ADD CONSTRAINT lot_counting_drafts_pkey PRIMARY KEY (id);


--
-- Name: product_barcodes product_barcodes_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.product_barcodes
    ADD CONSTRAINT product_barcodes_pkey PRIMARY KEY (id);


--
-- Name: product_prices product_prices_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.product_prices
    ADD CONSTRAINT product_prices_pkey PRIMARY KEY (id);


--
-- Name: product_stores product_stores_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.product_stores
    ADD CONSTRAINT product_stores_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: protheus_integration_items protheus_integration_items_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.protheus_integration_items
    ADD CONSTRAINT protheus_integration_items_pkey PRIMARY KEY (id);


--
-- Name: protheus_integrations protheus_integrations_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.protheus_integrations
    ADD CONSTRAINT protheus_integrations_pkey PRIMARY KEY (id);


--
-- Name: sb1010 sb1010_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.sb1010
    ADD CONSTRAINT sb1010_pkey PRIMARY KEY (b1_filial, b1_cod);


--
-- Name: sb2010 sb2010_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.sb2010
    ADD CONSTRAINT sb2010_pkey PRIMARY KEY (b2_filial, b2_cod, b2_local);


--
-- Name: sb8010 sb8010_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.sb8010
    ADD CONSTRAINT sb8010_pkey PRIMARY KEY (id);


--
-- Name: sbm010 sbm010_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.sbm010
    ADD CONSTRAINT sbm010_pkey PRIMARY KEY (bm_filial, bm_grupo);


--
-- Name: sbz010 sbz010_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.sbz010
    ADD CONSTRAINT sbz010_pkey PRIMARY KEY (bz_filial, bz_cod);


--
-- Name: slk010 slk010_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.slk010
    ADD CONSTRAINT slk010_pkey PRIMARY KEY (id);


--
-- Name: stores stores_code_key; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.stores
    ADD CONSTRAINT stores_code_key UNIQUE (code);


--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);


--
-- Name: system_config system_config_key_key; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.system_config
    ADD CONSTRAINT system_config_key_key UNIQUE (key);


--
-- Name: system_config system_config_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.system_config
    ADD CONSTRAINT system_config_pkey PRIMARY KEY (id);


--
-- Name: system_logs system_logs_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.system_logs
    ADD CONSTRAINT system_logs_pkey PRIMARY KEY (id);


--
-- Name: szb010 szb010_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.szb010
    ADD CONSTRAINT szb010_pkey PRIMARY KEY (zb_filial, zb_xlocal);


--
-- Name: szd010 szd010_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.szd010
    ADD CONSTRAINT szd010_pkey PRIMARY KEY (zd_filial, zd_xcod);


--
-- Name: sze010 sze010_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.sze010
    ADD CONSTRAINT sze010_pkey PRIMARY KEY (ze_filial, ze_xcod);


--
-- Name: szf010 szf010_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.szf010
    ADD CONSTRAINT szf010_pkey PRIMARY KEY (zf_filial, zf_xcod);


--
-- Name: counting_assignments uk_counting_assignments_item_count; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_assignments
    ADD CONSTRAINT uk_counting_assignments_item_count UNIQUE (inventory_item_id, count_number);


--
-- Name: inventory_items uk_inventory_items_list_product; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_items
    ADD CONSTRAINT uk_inventory_items_list_product UNIQUE (inventory_list_id, product_id);


--
-- Name: inventory_lots_snapshot uk_inventory_lots_snapshot_item_lot; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_lots_snapshot
    ADD CONSTRAINT uk_inventory_lots_snapshot_item_lot UNIQUE (inventory_item_id, b8_lotectl);


--
-- Name: products uk_products_code_store; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.products
    ADD CONSTRAINT uk_products_code_store UNIQUE (code, store_id);


--
-- Name: lot_counting_drafts unique_draft_per_user_item_cycle; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.lot_counting_drafts
    ADD CONSTRAINT unique_draft_per_user_item_cycle UNIQUE (inventory_item_id, counted_by, current_cycle);


--
-- Name: counting_list_items unique_list_item; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_list_items
    ADD CONSTRAINT unique_list_item UNIQUE (counting_list_id, inventory_item_id);


--
-- Name: inventory_sub_lists unique_sub_code; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_sub_lists
    ADD CONSTRAINT unique_sub_code UNIQUE (sub_code);


--
-- Name: inventory_sub_items unique_sub_item; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_sub_items
    ADD CONSTRAINT unique_sub_item UNIQUE (sub_list_id, inventory_item_id);


--
-- Name: user_stores user_stores_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.user_stores
    ADD CONSTRAINT user_stores_pkey PRIMARY KEY (id);


--
-- Name: user_stores user_stores_unique; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.user_stores
    ADD CONSTRAINT user_stores_unique UNIQUE (user_id, store_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


--
-- Name: idx_counting_assignments_assigned_by; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_counting_assignments_assigned_by ON inventario.counting_assignments USING btree (assigned_by);


--
-- Name: idx_counting_assignments_assigned_to; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_counting_assignments_assigned_to ON inventario.counting_assignments USING btree (assigned_to);


--
-- Name: idx_counting_assignments_count_number; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_counting_assignments_count_number ON inventario.counting_assignments USING btree (count_number);


--
-- Name: idx_counting_assignments_deadline; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_counting_assignments_deadline ON inventario.counting_assignments USING btree (deadline);


--
-- Name: idx_counting_assignments_item; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_counting_assignments_item ON inventario.counting_assignments USING btree (inventory_item_id);


--
-- Name: idx_counting_assignments_list_status; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_counting_assignments_list_status ON inventario.counting_assignments USING btree (list_status);


--
-- Name: idx_counting_assignments_status; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_counting_assignments_status ON inventario.counting_assignments USING btree (status);


--
-- Name: idx_counting_list_items_inventory_item; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_counting_list_items_inventory_item ON inventario.counting_list_items USING btree (inventory_item_id);


--
-- Name: idx_counting_list_items_list; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_counting_list_items_list ON inventario.counting_list_items USING btree (counting_list_id);


--
-- Name: idx_counting_list_items_status; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_counting_list_items_status ON inventario.counting_list_items USING btree (status);


--
-- Name: idx_counting_lists_counters; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_counting_lists_counters ON inventario.counting_lists USING btree (counter_cycle_1, counter_cycle_2, counter_cycle_3);


--
-- Name: idx_counting_lists_inventory; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_counting_lists_inventory ON inventario.counting_lists USING btree (inventory_id);


--
-- Name: idx_counting_lists_status; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_counting_lists_status ON inventario.counting_lists USING btree (list_status);


--
-- Name: idx_counting_lots_counting_id; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_counting_lots_counting_id ON inventario.counting_lots USING btree (counting_id);


--
-- Name: idx_counting_lots_created_at; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_counting_lots_created_at ON inventario.counting_lots USING btree (created_at);


--
-- Name: idx_counting_lots_lot_number; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_counting_lots_lot_number ON inventario.counting_lots USING btree (lot_number);


--
-- Name: idx_countings_date; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_countings_date ON inventario.countings USING btree (created_at);


--
-- Name: idx_countings_item; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_countings_item ON inventario.countings USING btree (inventory_item_id);


--
-- Name: idx_countings_lot; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_countings_lot ON inventario.countings USING btree (lot_number);


--
-- Name: idx_countings_serial; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_countings_serial ON inventario.countings USING btree (serial_number);


--
-- Name: idx_countings_user; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_countings_user ON inventario.countings USING btree (counted_by);


--
-- Name: idx_cycle_audit_log_action; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_cycle_audit_log_action ON inventario.cycle_audit_log USING btree (action);


--
-- Name: idx_cycle_audit_log_counting_list; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_cycle_audit_log_counting_list ON inventario.cycle_audit_log USING btree (counting_list_id) WHERE (counting_list_id IS NOT NULL);


--
-- Name: idx_cycle_audit_log_extra_metadata_gin; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_cycle_audit_log_extra_metadata_gin ON inventario.cycle_audit_log USING gin (extra_metadata);


--
-- Name: idx_cycle_audit_log_inventory_list; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_cycle_audit_log_inventory_list ON inventario.cycle_audit_log USING btree (inventory_list_id);


--
-- Name: idx_cycle_audit_log_timestamp; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_cycle_audit_log_timestamp ON inventario.cycle_audit_log USING btree ("timestamp" DESC);


--
-- Name: idx_cycle_audit_log_user; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_cycle_audit_log_user ON inventario.cycle_audit_log USING btree (user_id);


--
-- Name: idx_discrepancies_created_by; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_discrepancies_created_by ON inventario.discrepancies USING btree (created_by);


--
-- Name: idx_discrepancies_item; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_discrepancies_item ON inventario.discrepancies USING btree (inventory_item_id);


--
-- Name: idx_discrepancies_resolved_by; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_discrepancies_resolved_by ON inventario.discrepancies USING btree (resolved_by);


--
-- Name: idx_discrepancies_status; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_discrepancies_status ON inventario.discrepancies USING btree (status);


--
-- Name: idx_inventory_items_list; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_inventory_items_list ON inventario.inventory_items USING btree (inventory_list_id);


--
-- Name: idx_inventory_items_product; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_inventory_items_product ON inventario.inventory_items USING btree (product_id);


--
-- Name: idx_inventory_items_recount_flags; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_inventory_items_recount_flags ON inventario.inventory_items USING btree (needs_recount_cycle_1, needs_recount_cycle_2, needs_recount_cycle_3);


--
-- Name: idx_inventory_items_sequence; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_inventory_items_sequence ON inventario.inventory_items USING btree (inventory_list_id, sequence);


--
-- Name: idx_inventory_items_snapshot_created_at; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_inventory_items_snapshot_created_at ON inventario.inventory_items_snapshot USING btree (created_at);


--
-- Name: idx_inventory_items_snapshot_item; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_inventory_items_snapshot_item ON inventario.inventory_items_snapshot USING btree (inventory_item_id);


--
-- Name: idx_inventory_items_snapshot_product; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_inventory_items_snapshot_product ON inventario.inventory_items_snapshot USING btree (b2_cod);


--
-- Name: idx_inventory_items_status; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_inventory_items_status ON inventario.inventory_items USING btree (status);


--
-- Name: idx_inventory_lists_counters; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_inventory_lists_counters ON inventario.inventory_lists USING btree (counter_cycle_1, counter_cycle_2, counter_cycle_3);


--
-- Name: idx_inventory_lists_created_by; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_inventory_lists_created_by ON inventario.inventory_lists USING btree (created_by);


--
-- Name: idx_inventory_lists_date; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_inventory_lists_date ON inventario.inventory_lists USING btree (reference_date);


--
-- Name: idx_inventory_lists_status; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_inventory_lists_status ON inventario.inventory_lists USING btree (status);


--
-- Name: idx_inventory_lists_store; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_inventory_lists_store ON inventario.inventory_lists USING btree (store_id);


--
-- Name: idx_inventory_lots_snapshot_created_at; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_inventory_lots_snapshot_created_at ON inventario.inventory_lots_snapshot USING btree (created_at);


--
-- Name: idx_inventory_lots_snapshot_item; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_inventory_lots_snapshot_item ON inventario.inventory_lots_snapshot USING btree (inventory_item_id);


--
-- Name: idx_inventory_lots_snapshot_lot; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_inventory_lots_snapshot_lot ON inventario.inventory_lots_snapshot USING btree (b8_lotectl);


--
-- Name: idx_lot_drafts_cycle; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_lot_drafts_cycle ON inventario.lot_counting_drafts USING btree (current_cycle);


--
-- Name: idx_lot_drafts_item; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_lot_drafts_item ON inventario.lot_counting_drafts USING btree (inventory_item_id);


--
-- Name: idx_lot_drafts_updated; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_lot_drafts_updated ON inventario.lot_counting_drafts USING btree (updated_at DESC);


--
-- Name: idx_lot_drafts_user; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_lot_drafts_user ON inventario.lot_counting_drafts USING btree (counted_by);


--
-- Name: idx_products_active; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_products_active ON inventario.products USING btree (is_active);


--
-- Name: idx_products_alt_barcodes_gin; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_products_alt_barcodes_gin ON inventario.products USING gin (alternative_barcodes jsonb_path_ops);


--
-- Name: INDEX idx_products_alt_barcodes_gin; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON INDEX inventario.idx_products_alt_barcodes_gin IS 'Índice GIN para busca ultra-rápida em códigos de barras alternativos (JSONB)';


--
-- Name: idx_products_b1_cod; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_products_b1_cod ON inventario.products USING btree (b1_cod) WHERE (b1_cod IS NOT NULL);


--
-- Name: idx_products_b1_codbar; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_products_b1_codbar ON inventario.products USING btree (b1_codbar) WHERE ((b1_codbar IS NOT NULL) AND ((b1_codbar)::text <> ''::text));


--
-- Name: idx_products_barcode; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_products_barcode ON inventario.products USING btree (barcode);


--
-- Name: idx_products_category; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_products_category ON inventario.products USING btree (category);


--
-- Name: idx_products_code; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_products_code ON inventario.products USING btree (code);


--
-- Name: idx_products_code_name; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_products_code_name ON inventario.products USING btree (code, name);


--
-- Name: idx_products_hierarchy; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_products_hierarchy ON inventario.products USING btree (hierarchy_category, hierarchy_subcategory, hierarchy_segment);


--
-- Name: idx_products_name; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_products_name ON inventario.products USING gin (name public.gin_trgm_ops);


--
-- Name: idx_products_protheus_recno; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_products_protheus_recno ON inventario.products USING btree (protheus_recno) WHERE (protheus_recno IS NOT NULL);


--
-- Name: idx_products_rastro; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_products_rastro ON inventario.products USING btree (b1_rastro) WHERE (b1_rastro = ANY (ARRAY['L'::bpchar, 'S'::bpchar]));


--
-- Name: idx_products_store; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_products_store ON inventario.products USING btree (store_id);


--
-- Name: idx_products_store_code; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_products_store_code ON inventario.products USING btree (store_id, b1_cod) WHERE (store_id IS NOT NULL);


--
-- Name: idx_products_sync_status; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_products_sync_status ON inventario.products USING btree (sync_status, last_sync_at);


--
-- Name: idx_protheus_int_created; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_protheus_int_created ON inventario.protheus_integrations USING btree (created_at DESC);


--
-- Name: idx_protheus_int_inv_a; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_protheus_int_inv_a ON inventario.protheus_integrations USING btree (inventory_a_id);


--
-- Name: idx_protheus_int_inv_b; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_protheus_int_inv_b ON inventario.protheus_integrations USING btree (inventory_b_id) WHERE (inventory_b_id IS NOT NULL);


--
-- Name: idx_protheus_int_items_integration; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_protheus_int_items_integration ON inventario.protheus_integration_items USING btree (integration_id);


--
-- Name: idx_protheus_int_items_product; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_protheus_int_items_product ON inventario.protheus_integration_items USING btree (product_code);


--
-- Name: idx_protheus_int_items_status; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_protheus_int_items_status ON inventario.protheus_integration_items USING btree (item_status);


--
-- Name: idx_protheus_int_items_type; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_protheus_int_items_type ON inventario.protheus_integration_items USING btree (item_type);


--
-- Name: idx_protheus_int_status; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_protheus_int_status ON inventario.protheus_integrations USING btree (status);


--
-- Name: idx_protheus_int_store; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_protheus_int_store ON inventario.protheus_integrations USING btree (store_id);


--
-- Name: idx_protheus_int_type_status; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_protheus_int_type_status ON inventario.protheus_integrations USING btree (integration_type, status);


--
-- Name: idx_sb1010_b1_grupo; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_sb1010_b1_grupo ON inventario.sb1010 USING btree (b1_grupo);


--
-- Name: idx_sb1010_b1_xcatgor; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_sb1010_b1_xcatgor ON inventario.sb1010 USING btree (b1_xcatgor);


--
-- Name: idx_sb1010_b1_xsegmen; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_sb1010_b1_xsegmen ON inventario.sb1010 USING btree (b1_xsegmen);


--
-- Name: idx_sb1010_b1_xsubcat; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_sb1010_b1_xsubcat ON inventario.sb1010 USING btree (b1_xsubcat);


--
-- Name: idx_sb2010_xentpos; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_sb2010_xentpos ON inventario.sb2010 USING btree (b2_xentpos) WHERE (b2_xentpos > (0)::numeric);


--
-- Name: idx_sb8010_lotefor; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_sb8010_lotefor ON inventario.sb8010 USING btree (b8_lotefor) WHERE ((b8_lotefor)::text <> ''::text);


--
-- Name: idx_stores_active; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_stores_active ON inventario.stores USING btree (is_active);


--
-- Name: idx_stores_code; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_stores_code ON inventario.stores USING btree (code);


--
-- Name: idx_sub_items_inventory; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_sub_items_inventory ON inventario.inventory_sub_items USING btree (inventory_item_id);


--
-- Name: idx_sub_items_sequence; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_sub_items_sequence ON inventario.inventory_sub_items USING btree (sub_list_id, sequence_in_sub_list);


--
-- Name: idx_sub_items_sublist; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_sub_items_sublist ON inventario.inventory_sub_items USING btree (sub_list_id);


--
-- Name: idx_sub_items_unique; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE UNIQUE INDEX idx_sub_items_unique ON inventario.inventory_sub_items USING btree (sub_list_id, inventory_item_id);


--
-- Name: idx_sub_lists_code; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE UNIQUE INDEX idx_sub_lists_code ON inventario.inventory_sub_lists USING btree (sub_code);


--
-- Name: idx_sub_lists_parent; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_sub_lists_parent ON inventario.inventory_sub_lists USING btree (parent_inventory_id);


--
-- Name: idx_sub_lists_status; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_sub_lists_status ON inventario.inventory_sub_lists USING btree (status);


--
-- Name: idx_sub_lists_user; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_sub_lists_user ON inventario.inventory_sub_lists USING btree (assigned_user_id);


--
-- Name: idx_system_config_category; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_system_config_category ON inventario.system_config USING btree (category);


--
-- Name: idx_system_config_key; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_system_config_key ON inventario.system_config USING btree (key);


--
-- Name: idx_system_logs_additional_data; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_system_logs_additional_data ON inventario.system_logs USING gin (additional_data);


--
-- Name: idx_system_logs_date; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_system_logs_date ON inventario.system_logs USING btree (created_at);


--
-- Name: idx_system_logs_level; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_system_logs_level ON inventario.system_logs USING btree (level);


--
-- Name: idx_system_logs_module; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_system_logs_module ON inventario.system_logs USING btree (module);


--
-- Name: idx_system_logs_user; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_system_logs_user ON inventario.system_logs USING btree (user_id);


--
-- Name: idx_szb010_filial; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_szb010_filial ON inventario.szb010 USING btree (zb_filial);


--
-- Name: idx_szb010_local; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_szb010_local ON inventario.szb010 USING btree (zb_xlocal);


--
-- Name: idx_user_stores_created_by; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_user_stores_created_by ON inventario.user_stores USING btree (created_by);


--
-- Name: idx_user_stores_default; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_user_stores_default ON inventario.user_stores USING btree (user_id, is_default) WHERE (is_default = true);


--
-- Name: idx_user_stores_store; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_user_stores_store ON inventario.user_stores USING btree (store_id);


--
-- Name: idx_user_stores_user; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_user_stores_user ON inventario.user_stores USING btree (user_id);


--
-- Name: idx_users_active; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_users_active ON inventario.users USING btree (is_active);


--
-- Name: idx_users_email; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_users_email ON inventario.users USING btree (email);


--
-- Name: idx_users_role; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_users_role ON inventario.users USING btree (role);


--
-- Name: idx_users_store; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_users_store ON inventario.users USING btree (store_id);


--
-- Name: idx_users_username; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE INDEX idx_users_username ON inventario.users USING btree (username);


--
-- Name: sb8010_natural_key_idx; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE UNIQUE INDEX sb8010_natural_key_idx ON inventario.sb8010 USING btree (b8_filial, b8_produto, b8_local, b8_lotectl);


--
-- Name: slk010_unique_barcode_idx; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE UNIQUE INDEX slk010_unique_barcode_idx ON inventario.slk010 USING btree (slk_filial, slk_codbar, slk_produto);


--
-- Name: uq_integration_inv_a_b; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE UNIQUE INDEX uq_integration_inv_a_b ON inventario.protheus_integrations USING btree (inventory_a_id, inventory_b_id) WHERE (inventory_b_id IS NOT NULL);


--
-- Name: uq_integration_inv_a_only; Type: INDEX; Schema: inventario; Owner: inventario_user
--

CREATE UNIQUE INDEX uq_integration_inv_a_only ON inventario.protheus_integrations USING btree (inventory_a_id) WHERE (inventory_b_id IS NULL);


--
-- Name: v_inventory_stats _RETURN; Type: RULE; Schema: inventario; Owner: inventario_user
--

CREATE OR REPLACE VIEW inventario.v_inventory_stats AS
 SELECT il.id,
    il.name,
    il.description,
    il.reference_date,
    il.count_deadline,
    il.status,
    il.store_id,
    il.created_by,
    il.created_at,
    il.updated_at,
    s.code AS store_code,
    s.name AS store_name,
    u.full_name AS created_by_name,
    count(ii.id) AS total_items,
    count(
        CASE
            WHEN (ii.status = 'COUNTED'::inventario.counting_status) THEN 1
            ELSE NULL::integer
        END) AS counted_items,
    round((((count(
        CASE
            WHEN (ii.status = 'COUNTED'::inventario.counting_status) THEN 1
            ELSE NULL::integer
        END))::numeric / (NULLIF(count(ii.id), 0))::numeric) * (100)::numeric), 2) AS progress_percentage
   FROM (((inventario.inventory_lists il
     JOIN inventario.stores s ON ((il.store_id = s.id)))
     JOIN inventario.users u ON ((il.created_by = u.id)))
     LEFT JOIN inventario.inventory_items ii ON ((il.id = ii.inventory_list_id)))
  GROUP BY il.id, s.code, s.name, u.full_name;


--
-- Name: protheus_integrations trg_protheus_integration_updated; Type: TRIGGER; Schema: inventario; Owner: inventario_user
--

CREATE TRIGGER trg_protheus_integration_updated BEFORE UPDATE ON inventario.protheus_integrations FOR EACH ROW EXECUTE FUNCTION inventario.update_protheus_integration_timestamp();


--
-- Name: counting_list_items trg_update_counting_list_items_status; Type: TRIGGER; Schema: inventario; Owner: inventario_user
--

CREATE TRIGGER trg_update_counting_list_items_status BEFORE INSERT OR UPDATE OF count_cycle_1, count_cycle_2, count_cycle_3 ON inventario.counting_list_items FOR EACH ROW EXECUTE FUNCTION inventario.calculate_counting_status();


--
-- Name: TRIGGER trg_update_counting_list_items_status ON counting_list_items; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON TRIGGER trg_update_counting_list_items_status ON inventario.counting_list_items IS 'Auto-atualiza campo status quando contagens são inseridas ou modificadas';


--
-- Name: inventory_items trg_update_inventory_items_status; Type: TRIGGER; Schema: inventario; Owner: inventario_user
--

CREATE TRIGGER trg_update_inventory_items_status BEFORE INSERT OR UPDATE OF count_cycle_1, count_cycle_2, count_cycle_3 ON inventario.inventory_items FOR EACH ROW EXECUTE FUNCTION inventario.calculate_counting_status();


--
-- Name: TRIGGER trg_update_inventory_items_status ON inventory_items; Type: COMMENT; Schema: inventario; Owner: inventario_user
--

COMMENT ON TRIGGER trg_update_inventory_items_status ON inventario.inventory_items IS 'Auto-atualiza campo status quando contagens são inseridas ou modificadas';


--
-- Name: inventory_lists trg_validate_cycle_assignment; Type: TRIGGER; Schema: inventario; Owner: inventario_user
--

CREATE TRIGGER trg_validate_cycle_assignment BEFORE UPDATE ON inventario.inventory_lists FOR EACH ROW EXECUTE FUNCTION inventario.validate_cycle_assignment();


--
-- Name: user_stores trigger_enforce_single_default_store; Type: TRIGGER; Schema: inventario; Owner: inventario_user
--

CREATE TRIGGER trigger_enforce_single_default_store BEFORE INSERT OR UPDATE OF is_default ON inventario.user_stores FOR EACH ROW EXECUTE FUNCTION inventario.enforce_single_default_store();


--
-- Name: szb010 trigger_szb010_updated_at; Type: TRIGGER; Schema: inventario; Owner: inventario_user
--

CREATE TRIGGER trigger_szb010_updated_at BEFORE UPDATE ON inventario.szb010 FOR EACH ROW EXECUTE FUNCTION inventario.update_szb010_timestamp();


--
-- Name: inventory_sub_items trigger_update_sub_list_stats; Type: TRIGGER; Schema: inventario; Owner: inventario_user
--

CREATE TRIGGER trigger_update_sub_list_stats AFTER INSERT OR DELETE ON inventario.inventory_sub_items FOR EACH ROW EXECUTE FUNCTION inventario.update_sub_list_stats();


--
-- Name: user_stores trigger_update_user_stores_timestamp; Type: TRIGGER; Schema: inventario; Owner: inventario_user
--

CREATE TRIGGER trigger_update_user_stores_timestamp BEFORE UPDATE ON inventario.user_stores FOR EACH ROW EXECUTE FUNCTION inventario.update_user_stores_timestamp();


--
-- Name: counting_assignments update_counting_assignments_updated_at; Type: TRIGGER; Schema: inventario; Owner: inventario_user
--

CREATE TRIGGER update_counting_assignments_updated_at BEFORE UPDATE ON inventario.counting_assignments FOR EACH ROW EXECUTE FUNCTION inventario.update_updated_at_column();


--
-- Name: countings update_countings_updated_at; Type: TRIGGER; Schema: inventario; Owner: inventario_user
--

CREATE TRIGGER update_countings_updated_at BEFORE UPDATE ON inventario.countings FOR EACH ROW EXECUTE FUNCTION inventario.update_updated_at_column();


--
-- Name: inventory_items update_inventory_items_updated_at; Type: TRIGGER; Schema: inventario; Owner: inventario_user
--

CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON inventario.inventory_items FOR EACH ROW EXECUTE FUNCTION inventario.update_updated_at_column();


--
-- Name: inventory_lists update_inventory_lists_updated_at; Type: TRIGGER; Schema: inventario; Owner: inventario_user
--

CREATE TRIGGER update_inventory_lists_updated_at BEFORE UPDATE ON inventario.inventory_lists FOR EACH ROW EXECUTE FUNCTION inventario.update_updated_at_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: inventario; Owner: inventario_user
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON inventario.products FOR EACH ROW EXECUTE FUNCTION inventario.update_updated_at_column();


--
-- Name: stores update_stores_updated_at; Type: TRIGGER; Schema: inventario; Owner: inventario_user
--

CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON inventario.stores FOR EACH ROW EXECUTE FUNCTION inventario.update_updated_at_column();


--
-- Name: system_config update_system_config_updated_at; Type: TRIGGER; Schema: inventario; Owner: inventario_user
--

CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON inventario.system_config FOR EACH ROW EXECUTE FUNCTION inventario.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: inventario; Owner: inventario_user
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON inventario.users FOR EACH ROW EXECUTE FUNCTION inventario.update_updated_at_column();


--
-- Name: closed_counting_rounds closed_counting_rounds_inventory_list_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.closed_counting_rounds
    ADD CONSTRAINT closed_counting_rounds_inventory_list_id_fkey FOREIGN KEY (inventory_list_id) REFERENCES inventario.inventory_lists(id) ON DELETE CASCADE;


--
-- Name: closed_counting_rounds closed_counting_rounds_user_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.closed_counting_rounds
    ADD CONSTRAINT closed_counting_rounds_user_id_fkey FOREIGN KEY (user_id) REFERENCES inventario.users(id);


--
-- Name: counting_assignments counting_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_assignments
    ADD CONSTRAINT counting_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES inventario.users(id);


--
-- Name: counting_assignments counting_assignments_assigned_to_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_assignments
    ADD CONSTRAINT counting_assignments_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES inventario.users(id);


--
-- Name: counting_assignments counting_assignments_counter_cycle_1_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_assignments
    ADD CONSTRAINT counting_assignments_counter_cycle_1_fkey FOREIGN KEY (counter_cycle_1) REFERENCES inventario.users(id);


--
-- Name: counting_assignments counting_assignments_counter_cycle_2_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_assignments
    ADD CONSTRAINT counting_assignments_counter_cycle_2_fkey FOREIGN KEY (counter_cycle_2) REFERENCES inventario.users(id);


--
-- Name: counting_assignments counting_assignments_counter_cycle_3_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_assignments
    ADD CONSTRAINT counting_assignments_counter_cycle_3_fkey FOREIGN KEY (counter_cycle_3) REFERENCES inventario.users(id);


--
-- Name: counting_assignments counting_assignments_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_assignments
    ADD CONSTRAINT counting_assignments_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES inventario.inventory_items(id) ON DELETE CASCADE;


--
-- Name: counting_assignments counting_assignments_previous_counter_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_assignments
    ADD CONSTRAINT counting_assignments_previous_counter_id_fkey FOREIGN KEY (previous_counter_id) REFERENCES inventario.users(id);


--
-- Name: counting_assignments counting_assignments_reassigned_by_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_assignments
    ADD CONSTRAINT counting_assignments_reassigned_by_fkey FOREIGN KEY (reassigned_by) REFERENCES inventario.users(id);


--
-- Name: counting_lots counting_lots_counting_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_lots
    ADD CONSTRAINT counting_lots_counting_id_fkey FOREIGN KEY (counting_id) REFERENCES inventario.countings(id) ON DELETE CASCADE;


--
-- Name: counting_lots counting_lots_created_by_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_lots
    ADD CONSTRAINT counting_lots_created_by_fkey FOREIGN KEY (created_by) REFERENCES inventario.users(id);


--
-- Name: countings countings_counted_by_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.countings
    ADD CONSTRAINT countings_counted_by_fkey FOREIGN KEY (counted_by) REFERENCES inventario.users(id);


--
-- Name: countings countings_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.countings
    ADD CONSTRAINT countings_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES inventario.inventory_items(id) ON DELETE CASCADE;


--
-- Name: cycle_audit_log cycle_audit_log_counting_list_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.cycle_audit_log
    ADD CONSTRAINT cycle_audit_log_counting_list_id_fkey FOREIGN KEY (counting_list_id) REFERENCES inventario.counting_lists(id) ON DELETE SET NULL;


--
-- Name: cycle_audit_log cycle_audit_log_inventory_list_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.cycle_audit_log
    ADD CONSTRAINT cycle_audit_log_inventory_list_id_fkey FOREIGN KEY (inventory_list_id) REFERENCES inventario.inventory_lists(id) ON DELETE CASCADE;


--
-- Name: cycle_audit_log cycle_audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.cycle_audit_log
    ADD CONSTRAINT cycle_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES inventario.users(id) ON DELETE RESTRICT;


--
-- Name: discrepancies discrepancies_created_by_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.discrepancies
    ADD CONSTRAINT discrepancies_created_by_fkey FOREIGN KEY (created_by) REFERENCES inventario.users(id);


--
-- Name: discrepancies discrepancies_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.discrepancies
    ADD CONSTRAINT discrepancies_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES inventario.inventory_items(id) ON DELETE CASCADE;


--
-- Name: discrepancies discrepancies_resolved_by_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.discrepancies
    ADD CONSTRAINT discrepancies_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES inventario.users(id);


--
-- Name: counting_list_items fk_counting_list_items_counted_by; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_list_items
    ADD CONSTRAINT fk_counting_list_items_counted_by FOREIGN KEY (last_counted_by) REFERENCES inventario.users(id);


--
-- Name: counting_list_items fk_counting_list_items_inventory_item; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_list_items
    ADD CONSTRAINT fk_counting_list_items_inventory_item FOREIGN KEY (inventory_item_id) REFERENCES inventario.inventory_items(id) ON DELETE CASCADE;


--
-- Name: counting_list_items fk_counting_list_items_list; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_list_items
    ADD CONSTRAINT fk_counting_list_items_list FOREIGN KEY (counting_list_id) REFERENCES inventario.counting_lists(id) ON DELETE CASCADE;


--
-- Name: counting_lists fk_counting_lists_closed_by; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_lists
    ADD CONSTRAINT fk_counting_lists_closed_by FOREIGN KEY (closed_by) REFERENCES inventario.users(id);


--
-- Name: counting_lists fk_counting_lists_counter1; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_lists
    ADD CONSTRAINT fk_counting_lists_counter1 FOREIGN KEY (counter_cycle_1) REFERENCES inventario.users(id);


--
-- Name: counting_lists fk_counting_lists_counter2; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_lists
    ADD CONSTRAINT fk_counting_lists_counter2 FOREIGN KEY (counter_cycle_2) REFERENCES inventario.users(id);


--
-- Name: counting_lists fk_counting_lists_counter3; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_lists
    ADD CONSTRAINT fk_counting_lists_counter3 FOREIGN KEY (counter_cycle_3) REFERENCES inventario.users(id);


--
-- Name: counting_lists fk_counting_lists_created_by; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_lists
    ADD CONSTRAINT fk_counting_lists_created_by FOREIGN KEY (created_by) REFERENCES inventario.users(id);


--
-- Name: counting_lists fk_counting_lists_inventory; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_lists
    ADD CONSTRAINT fk_counting_lists_inventory FOREIGN KEY (inventory_id) REFERENCES inventario.inventory_lists(id) ON DELETE CASCADE;


--
-- Name: counting_lists fk_counting_lists_released_by; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.counting_lists
    ADD CONSTRAINT fk_counting_lists_released_by FOREIGN KEY (released_by) REFERENCES inventario.users(id);


--
-- Name: inventory_items_snapshot fk_inventory_items_snapshot_item; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_items_snapshot
    ADD CONSTRAINT fk_inventory_items_snapshot_item FOREIGN KEY (inventory_item_id) REFERENCES inventario.inventory_items(id) ON DELETE CASCADE;


--
-- Name: inventory_items_snapshot fk_inventory_items_snapshot_user; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_items_snapshot
    ADD CONSTRAINT fk_inventory_items_snapshot_user FOREIGN KEY (created_by) REFERENCES inventario.users(id);


--
-- Name: inventory_lots_snapshot fk_inventory_lots_snapshot_item; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_lots_snapshot
    ADD CONSTRAINT fk_inventory_lots_snapshot_item FOREIGN KEY (inventory_item_id) REFERENCES inventario.inventory_items(id) ON DELETE CASCADE;


--
-- Name: inventory_lots_snapshot fk_inventory_lots_snapshot_user; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_lots_snapshot
    ADD CONSTRAINT fk_inventory_lots_snapshot_user FOREIGN KEY (created_by) REFERENCES inventario.users(id);


--
-- Name: inventory_items inventory_items_inventory_list_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_items
    ADD CONSTRAINT inventory_items_inventory_list_id_fkey FOREIGN KEY (inventory_list_id) REFERENCES inventario.inventory_lists(id) ON DELETE CASCADE;


--
-- Name: inventory_items inventory_items_last_counted_by_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_items
    ADD CONSTRAINT inventory_items_last_counted_by_fkey FOREIGN KEY (last_counted_by) REFERENCES inventario.users(id);


--
-- Name: inventory_items inventory_items_product_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_items
    ADD CONSTRAINT inventory_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES inventario.products(id);


--
-- Name: inventory_lists inventory_lists_closed_by_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_lists
    ADD CONSTRAINT inventory_lists_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES inventario.users(id);


--
-- Name: inventory_lists inventory_lists_counter_cycle_1_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_lists
    ADD CONSTRAINT inventory_lists_counter_cycle_1_fkey FOREIGN KEY (counter_cycle_1) REFERENCES inventario.users(id);


--
-- Name: inventory_lists inventory_lists_counter_cycle_2_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_lists
    ADD CONSTRAINT inventory_lists_counter_cycle_2_fkey FOREIGN KEY (counter_cycle_2) REFERENCES inventario.users(id);


--
-- Name: inventory_lists inventory_lists_counter_cycle_3_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_lists
    ADD CONSTRAINT inventory_lists_counter_cycle_3_fkey FOREIGN KEY (counter_cycle_3) REFERENCES inventario.users(id);


--
-- Name: inventory_lists inventory_lists_created_by_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_lists
    ADD CONSTRAINT inventory_lists_created_by_fkey FOREIGN KEY (created_by) REFERENCES inventario.users(id);


--
-- Name: inventory_lists inventory_lists_released_by_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_lists
    ADD CONSTRAINT inventory_lists_released_by_fkey FOREIGN KEY (released_by) REFERENCES inventario.users(id);


--
-- Name: inventory_lists inventory_lists_store_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_lists
    ADD CONSTRAINT inventory_lists_store_id_fkey FOREIGN KEY (store_id) REFERENCES inventario.stores(id);


--
-- Name: inventory_sub_items inventory_sub_items_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_sub_items
    ADD CONSTRAINT inventory_sub_items_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES inventario.inventory_items(id) ON DELETE CASCADE;


--
-- Name: inventory_sub_items inventory_sub_items_sub_list_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_sub_items
    ADD CONSTRAINT inventory_sub_items_sub_list_id_fkey FOREIGN KEY (sub_list_id) REFERENCES inventario.inventory_sub_lists(id) ON DELETE CASCADE;


--
-- Name: inventory_sub_lists inventory_sub_lists_assigned_user_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_sub_lists
    ADD CONSTRAINT inventory_sub_lists_assigned_user_id_fkey FOREIGN KEY (assigned_user_id) REFERENCES inventario.users(id);


--
-- Name: inventory_sub_lists inventory_sub_lists_parent_inventory_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.inventory_sub_lists
    ADD CONSTRAINT inventory_sub_lists_parent_inventory_id_fkey FOREIGN KEY (parent_inventory_id) REFERENCES inventario.inventory_lists(id) ON DELETE CASCADE;


--
-- Name: lot_counting_drafts lot_counting_drafts_counted_by_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.lot_counting_drafts
    ADD CONSTRAINT lot_counting_drafts_counted_by_fkey FOREIGN KEY (counted_by) REFERENCES inventario.users(id);


--
-- Name: lot_counting_drafts lot_counting_drafts_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.lot_counting_drafts
    ADD CONSTRAINT lot_counting_drafts_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES inventario.inventory_items(id) ON DELETE CASCADE;


--
-- Name: product_barcodes product_barcodes_product_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.product_barcodes
    ADD CONSTRAINT product_barcodes_product_id_fkey FOREIGN KEY (product_id) REFERENCES inventario.products(id) ON DELETE CASCADE;


--
-- Name: product_barcodes product_barcodes_store_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.product_barcodes
    ADD CONSTRAINT product_barcodes_store_id_fkey FOREIGN KEY (store_id) REFERENCES inventario.stores(id) ON DELETE CASCADE;


--
-- Name: product_prices product_prices_product_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.product_prices
    ADD CONSTRAINT product_prices_product_id_fkey FOREIGN KEY (product_id) REFERENCES inventario.products(id) ON DELETE CASCADE;


--
-- Name: product_prices product_prices_store_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.product_prices
    ADD CONSTRAINT product_prices_store_id_fkey FOREIGN KEY (store_id) REFERENCES inventario.stores(id) ON DELETE CASCADE;


--
-- Name: product_stores product_stores_product_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.product_stores
    ADD CONSTRAINT product_stores_product_id_fkey FOREIGN KEY (product_id) REFERENCES inventario.products(id) ON DELETE CASCADE;


--
-- Name: product_stores product_stores_store_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.product_stores
    ADD CONSTRAINT product_stores_store_id_fkey FOREIGN KEY (store_id) REFERENCES inventario.stores(id) ON DELETE CASCADE;


--
-- Name: products products_store_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.products
    ADD CONSTRAINT products_store_id_fkey FOREIGN KEY (store_id) REFERENCES inventario.stores(id);


--
-- Name: protheus_integration_items protheus_integration_items_integration_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.protheus_integration_items
    ADD CONSTRAINT protheus_integration_items_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES inventario.protheus_integrations(id) ON DELETE CASCADE;


--
-- Name: protheus_integrations protheus_integrations_cancelled_by_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.protheus_integrations
    ADD CONSTRAINT protheus_integrations_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES inventario.users(id);


--
-- Name: protheus_integrations protheus_integrations_created_by_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.protheus_integrations
    ADD CONSTRAINT protheus_integrations_created_by_fkey FOREIGN KEY (created_by) REFERENCES inventario.users(id);


--
-- Name: protheus_integrations protheus_integrations_inventory_a_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.protheus_integrations
    ADD CONSTRAINT protheus_integrations_inventory_a_id_fkey FOREIGN KEY (inventory_a_id) REFERENCES inventario.inventory_lists(id) ON DELETE RESTRICT;


--
-- Name: protheus_integrations protheus_integrations_inventory_b_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.protheus_integrations
    ADD CONSTRAINT protheus_integrations_inventory_b_id_fkey FOREIGN KEY (inventory_b_id) REFERENCES inventario.inventory_lists(id) ON DELETE RESTRICT;


--
-- Name: protheus_integrations protheus_integrations_store_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.protheus_integrations
    ADD CONSTRAINT protheus_integrations_store_id_fkey FOREIGN KEY (store_id) REFERENCES inventario.stores(id);


--
-- Name: slk010 slk010_product_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.slk010
    ADD CONSTRAINT slk010_product_id_fkey FOREIGN KEY (product_id) REFERENCES inventario.products(id) ON DELETE CASCADE;


--
-- Name: slk010 slk010_store_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.slk010
    ADD CONSTRAINT slk010_store_id_fkey FOREIGN KEY (store_id) REFERENCES inventario.stores(id) ON DELETE CASCADE;


--
-- Name: system_logs system_logs_store_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.system_logs
    ADD CONSTRAINT system_logs_store_id_fkey FOREIGN KEY (store_id) REFERENCES inventario.stores(id);


--
-- Name: system_logs system_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.system_logs
    ADD CONSTRAINT system_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES inventario.users(id);


--
-- Name: user_stores user_stores_created_by_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.user_stores
    ADD CONSTRAINT user_stores_created_by_fkey FOREIGN KEY (created_by) REFERENCES inventario.users(id);


--
-- Name: user_stores user_stores_store_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.user_stores
    ADD CONSTRAINT user_stores_store_id_fkey FOREIGN KEY (store_id) REFERENCES inventario.stores(id) ON DELETE CASCADE;


--
-- Name: user_stores user_stores_user_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.user_stores
    ADD CONSTRAINT user_stores_user_id_fkey FOREIGN KEY (user_id) REFERENCES inventario.users(id) ON DELETE CASCADE;


--
-- Name: users users_store_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.users
    ADD CONSTRAINT users_store_id_fkey FOREIGN KEY (store_id) REFERENCES inventario.stores(id);


--
-- Name: warehouses warehouses_store_id_fkey; Type: FK CONSTRAINT; Schema: inventario; Owner: inventario_user
--

ALTER TABLE ONLY inventario.warehouses
    ADD CONSTRAINT warehouses_store_id_fkey FOREIGN KEY (store_id) REFERENCES inventario.stores(id);


--
-- Name: SCHEMA inventario; Type: ACL; Schema: -; Owner: inventario_user
--

GRANT USAGE ON SCHEMA inventario TO inventario_app;


--
-- Name: FUNCTION advance_cycle(p_inventory_id uuid, p_tolerance_percent numeric); Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON FUNCTION inventario.advance_cycle(p_inventory_id uuid, p_tolerance_percent numeric) TO inventario_app;


--
-- Name: FUNCTION calculate_counting_status(); Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON FUNCTION inventario.calculate_counting_status() TO inventario_app;


--
-- Name: FUNCTION can_user_count(p_inventory_id uuid, p_user_id uuid); Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON FUNCTION inventario.can_user_count(p_inventory_id uuid, p_user_id uuid) TO inventario_app;


--
-- Name: FUNCTION enforce_single_default_store(); Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON FUNCTION inventario.enforce_single_default_store() TO inventario_app;


--
-- Name: FUNCTION find_product_by_barcode(p_barcode character varying, p_store_id uuid); Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON FUNCTION inventario.find_product_by_barcode(p_barcode character varying, p_store_id uuid) TO inventario_app;


--
-- Name: FUNCTION generate_sub_list_code(parent_inventory_name character varying); Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON FUNCTION inventario.generate_sub_list_code(parent_inventory_name character varying) TO inventario_app;


--
-- Name: FUNCTION log_cycle_audit(p_inventory_list_id uuid, p_counting_list_id uuid, p_user_id uuid, p_action character varying, p_old_cycle integer, p_new_cycle integer, p_extra_metadata jsonb); Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON FUNCTION inventario.log_cycle_audit(p_inventory_list_id uuid, p_counting_list_id uuid, p_user_id uuid, p_action character varying, p_old_cycle integer, p_new_cycle integer, p_extra_metadata jsonb) TO inventario_app;


--
-- Name: FUNCTION migrate_existing_inventories(); Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON FUNCTION inventario.migrate_existing_inventories() TO inventario_app;


--
-- Name: FUNCTION update_protheus_integration_timestamp(); Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON FUNCTION inventario.update_protheus_integration_timestamp() TO inventario_app;


--
-- Name: FUNCTION update_sub_list_stats(); Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON FUNCTION inventario.update_sub_list_stats() TO inventario_app;


--
-- Name: FUNCTION update_szb010_timestamp(); Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON FUNCTION inventario.update_szb010_timestamp() TO inventario_app;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON FUNCTION inventario.update_updated_at_column() TO inventario_app;


--
-- Name: FUNCTION update_user_stores_timestamp(); Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON FUNCTION inventario.update_user_stores_timestamp() TO inventario_app;


--
-- Name: FUNCTION validate_cycle_assignment(); Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON FUNCTION inventario.validate_cycle_assignment() TO inventario_app;


--
-- Name: TABLE closed_counting_rounds; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.closed_counting_rounds TO inventario_app;


--
-- Name: TABLE counting_assignments; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.counting_assignments TO inventario_app;


--
-- Name: TABLE counting_list_items; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.counting_list_items TO inventario_app;


--
-- Name: TABLE counting_lists; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.counting_lists TO inventario_app;


--
-- Name: TABLE counting_lots; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.counting_lots TO inventario_app;


--
-- Name: TABLE countings; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.countings TO inventario_app;


--
-- Name: TABLE cycle_audit_log; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.cycle_audit_log TO inventario_app;


--
-- Name: TABLE da1010; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.da1010 TO inventario_app;


--
-- Name: TABLE discrepancies; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.discrepancies TO inventario_app;


--
-- Name: TABLE inventory_items; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.inventory_items TO inventario_app;


--
-- Name: TABLE inventory_items_snapshot; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.inventory_items_snapshot TO inventario_app;


--
-- Name: TABLE inventory_lists; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.inventory_lists TO inventario_app;


--
-- Name: TABLE inventory_lots_snapshot; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.inventory_lots_snapshot TO inventario_app;


--
-- Name: TABLE inventory_sub_items; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.inventory_sub_items TO inventario_app;


--
-- Name: TABLE inventory_sub_lists; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.inventory_sub_lists TO inventario_app;


--
-- Name: TABLE lot_counting_drafts; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.lot_counting_drafts TO inventario_app;


--
-- Name: TABLE product_barcodes; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.product_barcodes TO inventario_app;


--
-- Name: TABLE product_prices; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.product_prices TO inventario_app;


--
-- Name: TABLE product_stores; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.product_stores TO inventario_app;


--
-- Name: TABLE products; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.products TO inventario_app;


--
-- Name: TABLE protheus_integration_items; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.protheus_integration_items TO inventario_app;


--
-- Name: TABLE protheus_integrations; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.protheus_integrations TO inventario_app;


--
-- Name: TABLE sb1010; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.sb1010 TO inventario_app;


--
-- Name: TABLE sb2010; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.sb2010 TO inventario_app;


--
-- Name: TABLE sb8010; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.sb8010 TO inventario_app;


--
-- Name: TABLE sbm010; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.sbm010 TO inventario_app;


--
-- Name: TABLE sbz010; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.sbz010 TO inventario_app;


--
-- Name: TABLE slk010; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.slk010 TO inventario_app;


--
-- Name: TABLE stores; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.stores TO inventario_app;


--
-- Name: TABLE system_config; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.system_config TO inventario_app;


--
-- Name: TABLE system_logs; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.system_logs TO inventario_app;


--
-- Name: TABLE szb010; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.szb010 TO inventario_app;


--
-- Name: TABLE szd010; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.szd010 TO inventario_app;


--
-- Name: TABLE sze010; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.sze010 TO inventario_app;


--
-- Name: TABLE szf010; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.szf010 TO inventario_app;


--
-- Name: TABLE user_stores; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.user_stores TO inventario_app;


--
-- Name: TABLE users; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.users TO inventario_app;


--
-- Name: TABLE v_counting_lists_summary; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.v_counting_lists_summary TO inventario_app;


--
-- Name: TABLE v_inventory_cycle_status; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.v_inventory_cycle_status TO inventario_app;


--
-- Name: TABLE v_inventory_stats; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.v_inventory_stats TO inventario_app;


--
-- Name: TABLE v_products_enhanced; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.v_products_enhanced TO inventario_app;


--
-- Name: TABLE v_products_with_store; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.v_products_with_store TO inventario_app;


--
-- Name: TABLE warehouses; Type: ACL; Schema: inventario; Owner: inventario_user
--

GRANT ALL ON TABLE inventario.warehouses TO inventario_app;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: inventario; Owner: inventario_user
--

ALTER DEFAULT PRIVILEGES FOR ROLE inventario_user IN SCHEMA inventario GRANT ALL ON SEQUENCES  TO inventario_app;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: inventario; Owner: inventario_user
--

ALTER DEFAULT PRIVILEGES FOR ROLE inventario_user IN SCHEMA inventario GRANT ALL ON FUNCTIONS  TO inventario_app;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: inventario; Owner: inventario_user
--

ALTER DEFAULT PRIVILEGES FOR ROLE inventario_user IN SCHEMA inventario GRANT ALL ON TABLES  TO inventario_app;


--
-- PostgreSQL database dump complete
--

