--
-- PostgreSQL database dump
--

\restrict CZlVKYA6pP8yjzso8ZRiEKVgKncwPFioZpOt8iEc15Ibg10iK3x9yIsdKCNr4BN

-- Dumped from database version 16.12
-- Dumped by pg_dump version 16.12

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
-- Name: logistica; Type: SCHEMA; Schema: -; Owner: capul_user
--

CREATE SCHEMA logistica;


ALTER SCHEMA logistica OWNER TO capul_user;

--
-- Name: CategoriaDespesa; Type: TYPE; Schema: logistica; Owner: capul_user
--

CREATE TYPE logistica."CategoriaDespesa" AS ENUM (
    'VEICULO',
    'INDIVIDUO'
);


ALTER TYPE logistica."CategoriaDespesa" OWNER TO capul_user;

--
-- Name: ConfiancaLocal; Type: TYPE; Schema: logistica; Owner: capul_user
--

CREATE TYPE logistica."ConfiancaLocal" AS ENUM (
    'SEM_DADO',
    'PROVISORIA',
    'CONFIRMADA'
);


ALTER TYPE logistica."ConfiancaLocal" OWNER TO capul_user;

--
-- Name: FinalidadeVeiculo; Type: TYPE; Schema: logistica; Owner: capul_user
--

CREATE TYPE logistica."FinalidadeVeiculo" AS ENUM (
    'ENTREGA',
    'PASSEIO',
    'SERVICO'
);


ALTER TYPE logistica."FinalidadeVeiculo" OWNER TO capul_user;

--
-- Name: OrigemVenda; Type: TYPE; Schema: logistica; Owner: capul_user
--

CREATE TYPE logistica."OrigemVenda" AS ENUM (
    'PRESENCIAL',
    'TELE_VENDA',
    'OUTRO'
);


ALTER TYPE logistica."OrigemVenda" OWNER TO capul_user;

--
-- Name: PorteVeiculo; Type: TYPE; Schema: logistica; Owner: capul_user
--

CREATE TYPE logistica."PorteVeiculo" AS ENUM (
    'PESADO',
    'LEVE'
);


ALTER TYPE logistica."PorteVeiculo" OWNER TO capul_user;

--
-- Name: PropriedadeVeiculo; Type: TYPE; Schema: logistica; Owner: capul_user
--

CREATE TYPE logistica."PropriedadeVeiculo" AS ENUM (
    'PROPRIO',
    'ALUGADO'
);


ALTER TYPE logistica."PropriedadeVeiculo" OWNER TO capul_user;

--
-- Name: SituacaoAdiantamento; Type: TYPE; Schema: logistica; Owner: capul_user
--

CREATE TYPE logistica."SituacaoAdiantamento" AS ENUM (
    'PENDENTE',
    'APROVADO',
    'REJEITADO'
);


ALTER TYPE logistica."SituacaoAdiantamento" OWNER TO capul_user;

--
-- Name: SituacaoVeiculo; Type: TYPE; Schema: logistica; Owner: capul_user
--

CREATE TYPE logistica."SituacaoVeiculo" AS ENUM (
    'DISPONIVEL',
    'EM_USO',
    'EM_MANUTENCAO',
    'BAIXADO'
);


ALTER TYPE logistica."SituacaoVeiculo" OWNER TO capul_user;

--
-- Name: StatusDespesa; Type: TYPE; Schema: logistica; Owner: capul_user
--

CREATE TYPE logistica."StatusDespesa" AS ENUM (
    'PENDENTE',
    'APROVADA',
    'CONTESTADA'
);


ALTER TYPE logistica."StatusDespesa" OWNER TO capul_user;

--
-- Name: StatusEntrega; Type: TYPE; Schema: logistica; Owner: capul_user
--

CREATE TYPE logistica."StatusEntrega" AS ENUM (
    'PENDENTE',
    'EM_VIAGEM',
    'ENTREGUE',
    'NAO_ENTREGUE',
    'CANCELADA'
);


ALTER TYPE logistica."StatusEntrega" OWNER TO capul_user;

--
-- Name: StatusParada; Type: TYPE; Schema: logistica; Owner: capul_user
--

CREATE TYPE logistica."StatusParada" AS ENUM (
    'PLANEJADA',
    'REALIZADA',
    'PULADA'
);


ALTER TYPE logistica."StatusParada" OWNER TO capul_user;

--
-- Name: StatusPlanejamento; Type: TYPE; Schema: logistica; Owner: capul_user
--

CREATE TYPE logistica."StatusPlanejamento" AS ENUM (
    'RASCUNHO',
    'ENVIADO',
    'APROVADO',
    'AJUSTADO',
    'REJEITADO',
    'EM_EXECUCAO',
    'CONCLUIDO',
    'CANCELADO'
);


ALTER TYPE logistica."StatusPlanejamento" OWNER TO capul_user;

--
-- Name: StatusViagem; Type: TYPE; Schema: logistica; Owner: capul_user
--

CREATE TYPE logistica."StatusViagem" AS ENUM (
    'RASCUNHO',
    'EM_CURSO',
    'CONCLUIDA',
    'CANCELADA'
);


ALTER TYPE logistica."StatusViagem" OWNER TO capul_user;

--
-- Name: TipoClienteEntrega; Type: TYPE; Schema: logistica; Owner: capul_user
--

CREATE TYPE logistica."TipoClienteEntrega" AS ENUM (
    'IDENTIFICADO',
    'RECORRENTE_LOCAL',
    'EVENTUAL'
);


ALTER TYPE logistica."TipoClienteEntrega" OWNER TO capul_user;

--
-- Name: TipoLocalCliente; Type: TYPE; Schema: logistica; Owner: capul_user
--

CREATE TYPE logistica."TipoLocalCliente" AS ENUM (
    'PROPRIEDADE',
    'ENTREGA',
    'OUTRO'
);


ALTER TYPE logistica."TipoLocalCliente" OWNER TO capul_user;

--
-- Name: TipoManutencao; Type: TYPE; Schema: logistica; Owner: capul_user
--

CREATE TYPE logistica."TipoManutencao" AS ENUM (
    'PREVENTIVA',
    'CORRETIVA'
);


ALTER TYPE logistica."TipoManutencao" OWNER TO capul_user;

--
-- Name: TipoVeiculo; Type: TYPE; Schema: logistica; Owner: capul_user
--

CREATE TYPE logistica."TipoVeiculo" AS ENUM (
    'CARRO',
    'UTILITARIO',
    'CAMINHAO',
    'OUTRO'
);


ALTER TYPE logistica."TipoVeiculo" OWNER TO capul_user;

--
-- Name: TipoViagem; Type: TYPE; Schema: logistica; Owner: capul_user
--

CREATE TYPE logistica."TipoViagem" AS ENUM (
    'ENTREGA',
    'FROTA',
    'SUPERVISOR'
);


ALTER TYPE logistica."TipoViagem" OWNER TO capul_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: adiantamento; Type: TABLE; Schema: logistica; Owner: capul_user
--

CREATE TABLE logistica.adiantamento (
    id text NOT NULL,
    supervisor_id text NOT NULL,
    mes_referencia integer NOT NULL,
    valor numeric(12,2) NOT NULL,
    data_adiantamento timestamp(3) without time zone NOT NULL,
    observacao text,
    lancado_por_id text NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    situacao logistica."SituacaoAdiantamento" DEFAULT 'APROVADO'::logistica."SituacaoAdiantamento" NOT NULL,
    decidido_por_id text,
    decidido_em timestamp(3) without time zone,
    motivo_rejeicao text
);


ALTER TABLE logistica.adiantamento OWNER TO capul_user;

--
-- Name: anexo_despesa; Type: TABLE; Schema: logistica; Owner: capul_user
--

CREATE TABLE logistica.anexo_despesa (
    id text NOT NULL,
    despesa_id text NOT NULL,
    object_key text NOT NULL,
    hash text,
    mime text,
    tamanho integer,
    ordem integer DEFAULT 0 NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE logistica.anexo_despesa OWNER TO capul_user;

--
-- Name: atividade_visita; Type: TABLE; Schema: logistica; Owner: capul_user
--

CREATE TABLE logistica.atividade_visita (
    id text NOT NULL,
    nome text NOT NULL,
    filial_id text,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE logistica.atividade_visita OWNER TO capul_user;

--
-- Name: cliente_local; Type: TABLE; Schema: logistica; Owner: capul_user
--

CREATE TABLE logistica.cliente_local (
    id text NOT NULL,
    nome text NOT NULL,
    telefone text,
    observacao text,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    filial_id text
);


ALTER TABLE logistica.cliente_local OWNER TO capul_user;

--
-- Name: contador_sequencial; Type: TABLE; Schema: logistica; Owner: capul_user
--

CREATE TABLE logistica.contador_sequencial (
    filial_id text NOT NULL,
    escopo text NOT NULL,
    ultimo_numero integer DEFAULT 0 NOT NULL
);


ALTER TABLE logistica.contador_sequencial OWNER TO capul_user;

--
-- Name: despesa_veiculo; Type: TABLE; Schema: logistica; Owner: capul_user
--

CREATE TABLE logistica.despesa_veiculo (
    id text NOT NULL,
    filial_id text NOT NULL,
    veiculo_id text,
    viagem_id text,
    tipo_despesa_id text NOT NULL,
    valor numeric(12,2) NOT NULL,
    data_despesa timestamp(3) without time zone NOT NULL,
    fornecedor text,
    observacao text,
    situacao logistica."StatusDespesa" DEFAULT 'PENDENTE'::logistica."StatusDespesa" NOT NULL,
    autor_matricula text,
    autor_nome text,
    criado_por_id text NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    aprovado_por_id text,
    aprovado_em timestamp(3) without time zone,
    motivo_contestacao text,
    comprovante_object_key text,
    comprovante_hash text,
    comprovante_mime text,
    fornecedor_id text,
    idempotency_key text,
    anormalidade boolean DEFAULT false NOT NULL,
    motivo_anormalidade text,
    numero_documento text,
    sem_nota boolean DEFAULT false NOT NULL
);


ALTER TABLE logistica.despesa_veiculo OWNER TO capul_user;

--
-- Name: endereco_entrega; Type: TABLE; Schema: logistica; Owner: capul_user
--

CREATE TABLE logistica.endereco_entrega (
    id text NOT NULL,
    matricula text,
    cliente_local_id text,
    apelido text,
    logradouro text NOT NULL,
    numero text,
    complemento text,
    bairro text,
    cidade text,
    uf text,
    cep text,
    ponto_referencia text,
    latitude numeric(10,7),
    longitude numeric(10,7),
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    filial_id text,
    telefone text
);


ALTER TABLE logistica.endereco_entrega OWNER TO capul_user;

--
-- Name: entrega; Type: TABLE; Schema: logistica; Owner: capul_user
--

CREATE TABLE logistica.entrega (
    id text NOT NULL,
    numero integer NOT NULL,
    filial_id text NOT NULL,
    tipo_cliente logistica."TipoClienteEntrega" NOT NULL,
    matricula text,
    cliente_local_id text,
    destinatario_nome text NOT NULL,
    telefone text,
    endereco_entrega_id text,
    end_logradouro text NOT NULL,
    end_numero text,
    end_complemento text,
    end_bairro text,
    end_cidade text,
    end_cep text,
    end_referencia text,
    horario text,
    observacoes text,
    quantidade_volumes integer DEFAULT 1 NOT NULL,
    status logistica."StatusEntrega" DEFAULT 'PENDENTE'::logistica."StatusEntrega" NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    criado_por_id text NOT NULL,
    cancelada_em timestamp(3) without time zone,
    cancelada_por_id text,
    motivo_cancelamento text,
    tem_comprovante boolean DEFAULT false NOT NULL,
    comprovante_id text,
    end_uf character varying(2),
    baixado_por_id text,
    data_hora_entrega timestamp(3) without time zone,
    geo_lat numeric(10,7),
    geo_lng numeric(10,7),
    motivo_nao_entrega text,
    origem_venda logistica."OrigemVenda",
    tentativas integer DEFAULT 1 NOT NULL,
    historico_tentativas jsonb,
    recebedor_nome text,
    registrado_por_matricula text,
    registrado_por_nome text,
    data_entrega timestamp(3) without time zone,
    baixa_geo_lat numeric(10,7),
    baixa_geo_lng numeric(10,7)
);


ALTER TABLE logistica.entrega OWNER TO capul_user;

--
-- Name: entrega_cupom; Type: TABLE; Schema: logistica; Owner: capul_user
--

CREATE TABLE logistica.entrega_cupom (
    id text NOT NULL,
    entrega_id text NOT NULL,
    numero_cupom text,
    valor numeric(12,2)
);


ALTER TABLE logistica.entrega_cupom OWNER TO capul_user;

--
-- Name: fechamento_rdv; Type: TABLE; Schema: logistica; Owner: capul_user
--

CREATE TABLE logistica.fechamento_rdv (
    id text NOT NULL,
    supervisor_id text NOT NULL,
    mes_referencia integer NOT NULL,
    fechado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fechado_por_id text NOT NULL
);


ALTER TABLE logistica.fechamento_rdv OWNER TO capul_user;

--
-- Name: fornecedor_despesa; Type: TABLE; Schema: logistica; Owner: capul_user
--

CREATE TABLE logistica.fornecedor_despesa (
    id text NOT NULL,
    nome text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE logistica.fornecedor_despesa OWNER TO capul_user;

--
-- Name: geocode_cache; Type: TABLE; Schema: logistica; Owner: capul_user
--

CREATE TABLE logistica.geocode_cache (
    id text NOT NULL,
    chave text NOT NULL,
    endereco text NOT NULL,
    lat numeric(10,7),
    lng numeric(10,7),
    fonte text,
    precisao text,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    corrigido_em timestamp(3) without time zone,
    corrigido_por_id text,
    aprendido_amostras integer,
    aprendido_desvio_m integer,
    aprendido_em timestamp(3) without time zone
);


ALTER TABLE logistica.geocode_cache OWNER TO capul_user;

--
-- Name: local_cliente; Type: TABLE; Schema: logistica; Owner: capul_user
--

CREATE TABLE logistica.local_cliente (
    id text NOT NULL,
    filial_id text,
    cliente_matricula text NOT NULL,
    cliente_nome text,
    tipo logistica."TipoLocalCliente" DEFAULT 'PROPRIEDADE'::logistica."TipoLocalCliente" NOT NULL,
    nome text NOT NULL,
    municipio text,
    lat_consolidada numeric(10,7),
    long_consolidada numeric(10,7),
    confianca logistica."ConfiancaLocal" DEFAULT 'SEM_DADO'::logistica."ConfiancaLocal" NOT NULL,
    n_marcacoes integer DEFAULT 0 NOT NULL,
    raio_dispersao_m integer,
    consolidado_em timestamp(3) without time zone,
    enviado_protheus_em timestamp(3) without time zone,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE logistica.local_cliente OWNER TO capul_user;

--
-- Name: local_parada; Type: TABLE; Schema: logistica; Owner: capul_user
--

CREATE TABLE logistica.local_parada (
    id text NOT NULL,
    nome text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    filial_id text,
    departamento_id text,
    veiculo_id text
);


ALTER TABLE logistica.local_parada OWNER TO capul_user;

--
-- Name: manutencao_veiculo; Type: TABLE; Schema: logistica; Owner: capul_user
--

CREATE TABLE logistica.manutencao_veiculo (
    id text NOT NULL,
    veiculo_id text NOT NULL,
    tipo logistica."TipoManutencao" DEFAULT 'PREVENTIVA'::logistica."TipoManutencao" NOT NULL,
    km integer NOT NULL,
    data_manutencao timestamp(3) without time zone NOT NULL,
    motivo text,
    custo numeric(12,2),
    reiniciou_ciclo boolean DEFAULT false NOT NULL,
    km_proxima_gerada integer,
    registrado_por_id text NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    despesa_id text
);


ALTER TABLE logistica.manutencao_veiculo OWNER TO capul_user;

--
-- Name: parada; Type: TABLE; Schema: logistica; Owner: capul_user
--

CREATE TABLE logistica.parada (
    id text NOT NULL,
    viagem_id text NOT NULL,
    sequencia integer NOT NULL,
    entrega_id text,
    local text,
    latitude numeric(10,7),
    longitude numeric(10,7),
    km integer,
    data_hora timestamp(3) without time zone,
    observacao text,
    registrado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status logistica."StatusParada" DEFAULT 'REALIZADA'::logistica."StatusParada" NOT NULL,
    planejado_local text,
    realizada_em timestamp(3) without time zone,
    idempotency_key text,
    atividade_id text,
    cliente_matricula text,
    cliente_nome text,
    municipio text,
    propriedade text,
    local_cliente_id text,
    precisao_m integer,
    no_local boolean,
    motivo_pulada text
);


ALTER TABLE logistica.parada OWNER TO capul_user;

--
-- Name: posicao_veiculo; Type: TABLE; Schema: logistica; Owner: capul_user
--

CREATE TABLE logistica.posicao_veiculo (
    id text NOT NULL,
    viagem_id text NOT NULL,
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    precisao numeric(7,2),
    velocidade numeric(7,2),
    bateria integer,
    capturado_em timestamp(3) without time zone NOT NULL,
    recebido_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE logistica.posicao_veiculo OWNER TO capul_user;

--
-- Name: supervisor; Type: TABLE; Schema: logistica; Owner: capul_user
--

CREATE TABLE logistica.supervisor (
    id text NOT NULL,
    matricula text NOT NULL,
    nome text NOT NULL,
    filial_id text NOT NULL,
    coordenador_id text,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    departamento_id text
);


ALTER TABLE logistica.supervisor OWNER TO capul_user;

--
-- Name: supervisor_departamento; Type: TABLE; Schema: logistica; Owner: capul_user
--

CREATE TABLE logistica.supervisor_departamento (
    id text NOT NULL,
    filial_id text NOT NULL,
    departamento_id text NOT NULL,
    usuario_id text NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    criado_por_id text NOT NULL
);


ALTER TABLE logistica.supervisor_departamento OWNER TO capul_user;

--
-- Name: tipo_despesa; Type: TABLE; Schema: logistica; Owner: capul_user
--

CREATE TABLE logistica.tipo_despesa (
    id text NOT NULL,
    nome text NOT NULL,
    descricao text,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    requer_aprovacao boolean DEFAULT true NOT NULL,
    categoria logistica."CategoriaDespesa" DEFAULT 'VEICULO'::logistica."CategoriaDespesa" NOT NULL
);


ALTER TABLE logistica.tipo_despesa OWNER TO capul_user;

--
-- Name: veiculo; Type: TABLE; Schema: logistica; Owner: capul_user
--

CREATE TABLE logistica.veiculo (
    id text NOT NULL,
    filial_id text NOT NULL,
    placa text NOT NULL,
    renavam text,
    chassi text,
    modelo text,
    marca text,
    ano integer,
    cor text,
    tipo logistica."TipoVeiculo" DEFAULT 'CARRO'::logistica."TipoVeiculo" NOT NULL,
    km_atual integer DEFAULT 0 NOT NULL,
    capacidade_carga text,
    situacao logistica."SituacaoVeiculo" DEFAULT 'DISPONIVEL'::logistica."SituacaoVeiculo" NOT NULL,
    departamento_lotacao_id text NOT NULL,
    supervisor_id text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    intervalo_manutencao_km integer,
    km_ultima_manutencao integer,
    km_proxima_manutencao integer,
    propriedade logistica."PropriedadeVeiculo" DEFAULT 'PROPRIO'::logistica."PropriedadeVeiculo" NOT NULL,
    porte logistica."PorteVeiculo",
    finalidade logistica."FinalidadeVeiculo",
    supervisor_area_matricula text,
    supervisor_area_nome text
);


ALTER TABLE logistica.veiculo OWNER TO capul_user;

--
-- Name: veiculo_supervisor_area_historico; Type: TABLE; Schema: logistica; Owner: capul_user
--

CREATE TABLE logistica.veiculo_supervisor_area_historico (
    id text NOT NULL,
    veiculo_id text NOT NULL,
    matricula_anterior text,
    matricula_nova text NOT NULL,
    nome_novo text,
    alterado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    alterado_por_id text NOT NULL
);


ALTER TABLE logistica.veiculo_supervisor_area_historico OWNER TO capul_user;

--
-- Name: veiculo_supervisor_historico; Type: TABLE; Schema: logistica; Owner: capul_user
--

CREATE TABLE logistica.veiculo_supervisor_historico (
    id text NOT NULL,
    veiculo_id text NOT NULL,
    supervisor_anterior_id text,
    supervisor_novo_id text NOT NULL,
    alterado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    alterado_por_id text NOT NULL
);


ALTER TABLE logistica.veiculo_supervisor_historico OWNER TO capul_user;

--
-- Name: viagem; Type: TABLE; Schema: logistica; Owner: capul_user
--

CREATE TABLE logistica.viagem (
    id text NOT NULL,
    numero integer NOT NULL,
    filial_id text NOT NULL,
    tipo logistica."TipoViagem" DEFAULT 'ENTREGA'::logistica."TipoViagem" NOT NULL,
    veiculo_id text,
    motorista_id text,
    departamento_solicitante_id text,
    km_inicial integer,
    km_final integer,
    local_saida text,
    data_hora_saida timestamp(3) without time zone,
    observacoes_saida text,
    data_hora_chegada timestamp(3) without time zone,
    observacoes_chegada text,
    situacao logistica."StatusViagem" DEFAULT 'RASCUNHO'::logistica."StatusViagem" NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    criado_por_id text NOT NULL,
    condutor_matricula text,
    condutor_nome text,
    registrada_portaria boolean DEFAULT false NOT NULL,
    mes_referencia integer,
    adiantamento numeric(12,2),
    status_planejamento logistica."StatusPlanejamento",
    supervisor_registro_id text,
    aprovado_por_id text,
    aprovado_em timestamp(3) without time zone,
    comentario_coordenador text,
    porteiro_saida_matricula text,
    porteiro_saida_nome text,
    porteiro_retorno_matricula text,
    porteiro_retorno_nome text,
    rdv_viagem_id text,
    acerto_encerrado_em timestamp(3) without time zone,
    acerto_encerrado_por_id text,
    fechado_forcado_em timestamp(3) without time zone,
    fechado_forcado_por_id text,
    fechado_em timestamp(3) without time zone,
    fechado_por_id text,
    cancelado_em timestamp(3) without time zone,
    cancelado_por_id text,
    motivo_cancelamento text,
    departamento_aprovador_id text
);


ALTER TABLE logistica.viagem OWNER TO capul_user;

--
-- Data for Name: adiantamento; Type: TABLE DATA; Schema: logistica; Owner: capul_user
--

COPY logistica.adiantamento (id, supervisor_id, mes_referencia, valor, data_adiantamento, observacao, lancado_por_id, criado_em, situacao, decidido_por_id, decidido_em, motivo_rejeicao) FROM stdin;
72ce4cbb-a838-423c-b19c-5e463537d034	b5a67784-469d-4705-83f9-b0ff185e5a2e	202607	100.00	2026-07-27 14:58:49.816	\N	bc6dd499-2d1c-4102-a33c-a1d75c06a596	2026-07-27 14:58:49.817	PENDENTE	\N	\N	\N
c1837d92-9dc1-444e-b807-db1cc1aac656	c6b91940-8758-4be4-a8a3-4b8e6b76ffc6	202607	500.00	2026-07-01 15:00:00	\N	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-08-01 01:42:54.32	APROVADO	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-08-01 01:42:54.319	\N
6d38428c-93da-4a7e-a735-9193e1f3f6fc	c6b91940-8758-4be4-a8a3-4b8e6b76ffc6	202608	100.00	2026-08-01 15:00:00	\N	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-08-02 00:22:41.165	APROVADO	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-08-02 00:22:41.163	\N
69872427-e9a6-4e72-9aef-76a2a4ca6c21	c6b91940-8758-4be4-a8a3-4b8e6b76ffc6	202608	500.00	2026-08-02 20:20:42.564	\N	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-08-02 20:20:42.566	APROVADO	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-08-02 20:20:42.565	\N
ca53ab55-6a1c-4a3c-a36d-bb7f603eb9d2	b5a67784-469d-4705-83f9-b0ff185e5a2e	202608	500.00	2026-08-03 20:32:55.898	\N	187b1458-8eec-4c07-8e38-60c017441287	2026-08-03 20:32:55.899	APROVADO	187b1458-8eec-4c07-8e38-60c017441287	2026-08-03 20:32:55.899	\N
74669117-65f5-4c5b-ac8c-d2ab5500c715	b5a67784-469d-4705-83f9-b0ff185e5a2e	202608	600.00	2026-08-22 15:00:00	\N	187b1458-8eec-4c07-8e38-60c017441287	2026-08-23 01:28:49.366	APROVADO	187b1458-8eec-4c07-8e38-60c017441287	2026-08-23 01:28:49.365	\N
\.


--
-- Data for Name: anexo_despesa; Type: TABLE DATA; Schema: logistica; Owner: capul_user
--

COPY logistica.anexo_despesa (id, despesa_id, object_key, hash, mime, tamanho, ordem, criado_em) FROM stdin;
39448c0f-90f1-46a3-b034-0240d8174541	503294d1-464c-412f-b514-795892d6ebb2	d764d838-e177-421f-a79d-cb71abdbda83/503294d1-464c-412f-b514-795892d6ebb2/6c618052-a469-4be1-b129-4b250c256ad2.jpg	943f15652e99053aa731a6c050a8049847628c3c25ec4370684b696297ca7de0	image/jpeg	1045697	0	2026-07-17 19:51:11.211
\.


--
-- Data for Name: atividade_visita; Type: TABLE DATA; Schema: logistica; Owner: capul_user
--

COPY logistica.atividade_visita (id, nome, filial_id, ativo, criado_em) FROM stdin;
18064ce5-d29a-461e-bf9b-412929070fec	COLETA PEDIDO/LOGISTICA	d764d838-e177-421f-a79d-cb71abdbda83	t	2026-07-08 11:22:10.273
eba206cf-207b-4197-9d65-b69af1b72bb9	NEGOCIAÇÃO/PROSPECÇÃO	d764d838-e177-421f-a79d-cb71abdbda83	t	2026-07-08 11:22:10.273
f83bf58a-5589-4946-8626-495defb97aed	PARECER ANALISE CREDITO/CADASTRO	d764d838-e177-421f-a79d-cb71abdbda83	t	2026-07-08 11:22:10.273
4ef85de5-09b5-4a19-a826-f74972c78a8c	PARTICIPAÇÃO EVENTOS	d764d838-e177-421f-a79d-cb71abdbda83	t	2026-07-08 11:22:10.273
bb2add3b-d3e9-4093-99b0-8c37ac049c46	PLANEJAMENTO/PROPOSTA COMERCIAL	d764d838-e177-421f-a79d-cb71abdbda83	t	2026-07-08 11:22:10.273
5d9092a0-acf6-49c9-8774-36416e9f9586	POS VENDA/VISITA TECNICA	d764d838-e177-421f-a79d-cb71abdbda83	t	2026-07-08 11:22:10.273
70976cad-029d-49f9-a549-76ba4163566e	SAC	d764d838-e177-421f-a79d-cb71abdbda83	t	2026-07-08 11:22:10.273
d481f9ee-5529-4ba8-b7f4-c5dc86bb1185	TREINAMENTO	d764d838-e177-421f-a79d-cb71abdbda83	t	2026-07-08 11:22:10.273
01a7a8a5-b1eb-4b09-a83c-cd714cd45127	VENDA EFETUADA	d764d838-e177-421f-a79d-cb71abdbda83	t	2026-07-08 11:22:10.273
686819aa-3f08-4a8c-8d24-25e0079a9f14	OUTRO	d764d838-e177-421f-a79d-cb71abdbda83	t	2026-07-08 11:22:10.273
20da8144-e7db-462b-975a-7e57c5767b95	Visita propriedade Pedro Clemente	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	t	2026-07-08 18:47:28.603
f15bb734-43c0-4355-9ab9-2298d082d8b6	Acompanhamento de SAC	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	t	2026-07-14 13:32:08.896
97a16bd4-f7f9-42e7-be9a-85d25ddcd420	Ação Comercial	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	t	2026-07-14 13:32:26.226
aa121ab7-9dd9-4fe6-afc0-71f01dc50231	Visita para planejamento Técnico	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	t	2026-07-14 13:31:45.273
238134da-3e0d-4766-bae1-f479676bc938	Abertura de novas áreas	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	t	2026-07-14 13:33:44.283
\.


--
-- Data for Name: cliente_local; Type: TABLE DATA; Schema: logistica; Owner: capul_user
--

COPY logistica.cliente_local (id, nome, telefone, observacao, ativo, criado_em, filial_id) FROM stdin;
\.


--
-- Data for Name: contador_sequencial; Type: TABLE DATA; Schema: logistica; Owner: capul_user
--

COPY logistica.contador_sequencial (filial_id, escopo, ultimo_numero) FROM stdin;
8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	159
8e843247-5b6b-4404-ba62-a74b84ccb287	VIAGEM	44
a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	ENTREGA	28
a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	VIAGEM	41
d764d838-e177-421f-a79d-cb71abdbda83	VIAGEM	64
e2d9695c-4efa-4363-82a5-99d6dee1d47f	VIAGEM	7
\.


--
-- Data for Name: despesa_veiculo; Type: TABLE DATA; Schema: logistica; Owner: capul_user
--

COPY logistica.despesa_veiculo (id, filial_id, veiculo_id, viagem_id, tipo_despesa_id, valor, data_despesa, fornecedor, observacao, situacao, autor_matricula, autor_nome, criado_por_id, criado_em, aprovado_por_id, aprovado_em, motivo_contestacao, comprovante_object_key, comprovante_hash, comprovante_mime, fornecedor_id, idempotency_key, anormalidade, motivo_anormalidade, numero_documento, sem_nota) FROM stdin;
35483bff-79a6-41e7-a565-827f04ffcd3f	d764d838-e177-421f-a79d-cb71abdbda83	\N	7368cbdf-0b95-4b33-aa2b-feaeb53cbadc	2da1e44a-5e56-4f98-b44e-f8a75b02a5e2	650.00	2026-08-02 15:56:13.333	\N	\N	PENDENTE	\N	\N	bc6dd499-2d1c-4102-a33c-a1d75c06a596	2026-08-02 15:56:13.336	\N	\N	\N	\N	\N	\N	\N	38e021fb-ff2d-4f70-94bf-d156203b2126	f	\N	\N	f
f5eca66c-2fb3-48e6-9e4b-824ea147271b	d764d838-e177-421f-a79d-cb71abdbda83	1c3550d2-179f-4236-b475-60aba9e68523	1c028432-b6ee-4177-a47a-d276ef97feaa	935fd63a-7547-4fa8-aa01-9920ff3ad56e	56.00	2026-08-03 20:36:22.128	\N	\N	APROVADA	\N	\N	bc6dd499-2d1c-4102-a33c-a1d75c06a596	2026-08-03 20:36:22.129	187b1458-8eec-4c07-8e38-60c017441287	2026-08-03 20:38:20.882	\N	\N	\N	\N	\N	84911902-38b9-485a-8c3b-b8b173a9fcf4	f	\N	\N	f
45bdd743-ac98-40d8-b95a-fe8f63ab9ea0	cd644507-4dc3-448d-9f53-c6df8db329dc	185fa4e1-792a-405b-9d68-7afb59bdcb5f	\N	935fd63a-7547-4fa8-aa01-9920ff3ad56e	250.00	2026-07-11 00:00:00	\N	\N	APROVADA	\N	\N	43920ca6-69c8-42c3-91bc-3f25d90aa64d	2026-07-11 13:54:25.571	43920ca6-69c8-42c3-91bc-3f25d90aa64d	2026-07-11 13:54:25.57	\N	\N	\N	\N	\N	\N	f	\N	\N	f
9d350898-f710-41fd-925a-3184e4b1ac89	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	9a0ab60e-0fe7-4f62-8f99-a486030e67ce	901f1bea-3df2-460b-8006-62b3df88525c	703edff3-f76e-4a75-b895-c5e9632ffdfc	50.00	2026-07-11 00:00:00	\N	\N	PENDENTE	E01047	Clenio M. Mendes (TESTE INDIVIDUAL)	a33b01ad-75c5-470a-ad1c-cfeb1a557067	2026-07-11 13:50:49.292	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	f
05e03195-0d5f-4ec2-bacf-b0d504283abb	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	9a0ab60e-0fe7-4f62-8f99-a486030e67ce	901f1bea-3df2-460b-8006-62b3df88525c	935fd63a-7547-4fa8-aa01-9920ff3ad56e	300.00	2026-07-11 13:50:31.798	\N	\N	APROVADA	E01047	Clenio M. Mendes (TESTE INDIVIDUAL)	a33b01ad-75c5-470a-ad1c-cfeb1a557067	2026-07-11 13:50:31.799	43920ca6-69c8-42c3-91bc-3f25d90aa64d	2026-07-11 13:54:56.993	\N	\N	\N	\N	\N	\N	f	\N	\N	f
e6f41089-ac37-415f-b585-923dcc2dc581	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	9a0ab60e-0fe7-4f62-8f99-a486030e67ce	901f1bea-3df2-460b-8006-62b3df88525c	f94712ea-602d-40c7-adf1-78cd360c3502	120.00	2026-07-11 13:51:07.534	\N	\N	CONTESTADA	E01047	Clenio M. Mendes (TESTE INDIVIDUAL)	a33b01ad-75c5-470a-ad1c-cfeb1a557067	2026-07-11 13:51:07.535	43920ca6-69c8-42c3-91bc-3f25d90aa64d	2026-07-11 13:55:21.097	Valor acima do orçado para manutenção preventiva - falta nota fiscal detalhada.	\N	\N	\N	\N	\N	f	\N	\N	f
5c1c2eb4-d236-40be-b93d-8301ff78b8a0	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	1e3ff606-9dc8-4cfc-8b70-fb5cc092e9c7	29c5bb56-c634-4ed4-b539-696b1faaca51	935fd63a-7547-4fa8-aa01-9920ff3ad56e	80.00	2026-07-11 14:02:48.45	\N	\N	PENDENTE	E01047	Clenio M. Mendes (TESTE INDIVIDUAL)	a33b01ad-75c5-470a-ad1c-cfeb1a557067	2026-07-11 14:02:48.451	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	f
d6219a65-887f-4a26-acf2-c592bae7fba3	d764d838-e177-421f-a79d-cb71abdbda83	1c3550d2-179f-4236-b475-60aba9e68523	14807237-1f69-4de7-9ccf-2f4f8e7f07ac	935fd63a-7547-4fa8-aa01-9920ff3ad56e	250.00	2026-08-05 15:00:00	\N	\N	APROVADA	\N	\N	bc6dd499-2d1c-4102-a33c-a1d75c06a596	2026-08-05 19:57:00.399	187b1458-8eec-4c07-8e38-60c017441287	2026-08-05 19:57:52.211	\N	\N	\N	\N	\N	1d9a447a-b7a6-4375-ac34-e1bca54ef7fc	f	\N	\N	f
5d9f0a9a-2691-47b3-bf2e-fecd32ff0904	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	9a0ab60e-0fe7-4f62-8f99-a486030e67ce	b0664578-f36d-433e-bb66-86c084a545ed	935fd63a-7547-4fa8-aa01-9920ff3ad56e	12.50	2026-07-12 16:06:09.215	\N	\N	PENDENTE	SUPVEN01	SUPERVISOR VENDAS 01 (LOGIN)	0a305767-0303-4ebe-8c09-ea7dcd0c48e1	2026-07-12 16:06:09.216	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	f
fdd276a7-953e-433d-8ffa-97d601d73970	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	9a0ab60e-0fe7-4f62-8f99-a486030e67ce	c5b989d4-cacd-4bd3-b5a9-92a7b71e7ef8	935fd63a-7547-4fa8-aa01-9920ff3ad56e	150.00	2026-07-12 16:51:08.457	\N	Teste QA - abastecimento	PENDENTE	001047	Supervisor de Depto 01 (TESTE)	0a305767-0303-4ebe-8c09-ea7dcd0c48e1	2026-07-12 16:51:08.458	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	f
1edc6ec0-46a7-4b58-a4f8-15e7f23cb7eb	8e843247-5b6b-4404-ba62-a74b84ccb287	cdbbb293-8357-4130-803a-d6581cc7a75b	f4416387-9342-4528-95b1-180c9e720fdf	935fd63a-7547-4fa8-aa01-9920ff3ad56e	333.33	2026-08-14 23:49:59.864	\N	\N	APROVADA	\N	\N	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-14 23:49:59.865	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-08-15 01:09:17.837	\N	\N	\N	\N	\N	5d6dd90e-004f-4ae6-90d1-626a147293b9	f	\N	\N	f
4edc1273-56ce-493f-9e9f-4931b5528f0b	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	9a0ab60e-0fe7-4f62-8f99-a486030e67ce	b0664578-f36d-433e-bb66-86c084a545ed	935fd63a-7547-4fa8-aa01-9920ff3ad56e	9.90	2026-07-12 16:54:13.356	\N	\N	APROVADA	SUPVEN01	SUPERVISOR VENDAS 01 (LOGIN)	0a305767-0303-4ebe-8c09-ea7dcd0c48e1	2026-07-12 16:54:13.356	0a305767-0303-4ebe-8c09-ea7dcd0c48e1	2026-07-12 17:12:49.106	\N	\N	\N	\N	\N	\N	f	\N	\N	f
265afef5-47ca-4206-94d1-805c529ca944	e2d9695c-4efa-4363-82a5-99d6dee1d47f	185fa4e1-792a-405b-9d68-7afb59bdcb5f	a5403915-2303-412f-abab-3cc4d30f2149	935fd63a-7547-4fa8-aa01-9920ff3ad56e	300.00	2026-07-10 15:59:53.18	\N	\N	APROVADA	E03942	MARCELO JUNIO DE C SILVEIRA	5fb815a5-8170-44d3-8722-c4d233165682	2026-07-10 15:59:53.183	5fb815a5-8170-44d3-8722-c4d233165682	2026-07-13 13:22:18.23	\N	\N	\N	\N	\N	\N	f	\N	\N	f
6e4142d3-6f25-45c8-966d-7fd864c5d54b	e2d9695c-4efa-4363-82a5-99d6dee1d47f	298f284c-9258-4a57-a211-3f5bd574defd	c9189912-d97c-401c-8748-215804e0889d	0f8e03c6-6ddf-4b88-aca3-2d2116a95e48	35.00	2026-07-09 18:29:50.175	\N	REPARO	APROVADA	E04094	THUANY DE CAMPOS MACIEL	5fb815a5-8170-44d3-8722-c4d233165682	2026-07-09 18:29:50.176	5fb815a5-8170-44d3-8722-c4d233165682	2026-07-13 13:22:20.001	\N	\N	\N	\N	\N	\N	f	\N	\N	f
2aa9ca24-993b-437f-afde-670a07cf553b	e2d9695c-4efa-4363-82a5-99d6dee1d47f	298f284c-9258-4a57-a211-3f5bd574defd	c9189912-d97c-401c-8748-215804e0889d	935fd63a-7547-4fa8-aa01-9920ff3ad56e	100.00	2026-07-09 18:29:25.04	\N	\N	APROVADA	E04094	THUANY DE CAMPOS MACIEL	5fb815a5-8170-44d3-8722-c4d233165682	2026-07-09 18:29:25.041	5fb815a5-8170-44d3-8722-c4d233165682	2026-07-13 13:22:20.994	\N	\N	\N	\N	\N	\N	f	\N	\N	f
7baf664d-9b08-4b90-992c-90290504b5b5	8e843247-5b6b-4404-ba62-a74b84ccb287	cdbbb293-8357-4130-803a-d6581cc7a75b	b93276fa-79f6-4b4f-b48e-06a3eaefaee2	935fd63a-7547-4fa8-aa01-9920ff3ad56e	55.60	2026-08-11 19:49:25.276	\N	\N	APROVADA	\N	\N	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-11 19:49:25.277	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-08-15 01:09:18.688	\N	\N	\N	\N	\N	9048d2a6-4e1b-4eaa-a9cd-28dfa70541f8	f	\N	\N	f
8b2706f4-3ac7-4360-9966-c8510b3af05b	e2d9695c-4efa-4363-82a5-99d6dee1d47f	298f284c-9258-4a57-a211-3f5bd574defd	550de3fe-16e7-4702-851c-2b7f92a359f3	935fd63a-7547-4fa8-aa01-9920ff3ad56e	100.00	2026-07-13 13:28:09.901	\N	POSTO CAPUL	APROVADA	E03942	Marcelo Junio De Castro Silveira	5fb815a5-8170-44d3-8722-c4d233165682	2026-07-13 13:28:09.902	5fb815a5-8170-44d3-8722-c4d233165682	2026-07-13 13:32:01.095	\N	\N	\N	\N	\N	\N	f	\N	\N	f
4b83971d-45e3-4890-8d3a-e9b56e0728bb	d764d838-e177-421f-a79d-cb71abdbda83	1c3550d2-179f-4236-b475-60aba9e68523	69f19d5f-2818-4d94-b3c2-0de0c377fc12	703edff3-f76e-4a75-b895-c5e9632ffdfc	15.00	2026-08-22 15:00:00	\N	TESTE reteste 22/08 - lancada pelo Fabricio	PENDENTE	\N	\N	187b1458-8eec-4c07-8e38-60c017441287	2026-08-22 00:34:05.939	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	f
9eb37ddb-4966-440a-a8f7-790b2585ea2d	e2d9695c-4efa-4363-82a5-99d6dee1d47f	185fa4e1-792a-405b-9d68-7afb59bdcb5f	b4e001ad-250f-44bc-9012-2b2e62c98d03	703edff3-f76e-4a75-b895-c5e9632ffdfc	45.00	2026-07-13 13:40:28.94	\N	\N	APROVADA	E03942	Marcelo Junio De Castro Silveira	5fb815a5-8170-44d3-8722-c4d233165682	2026-07-13 13:40:28.94	5fb815a5-8170-44d3-8722-c4d233165682	2026-07-13 13:41:20.468	\N	\N	\N	\N	\N	\N	f	\N	\N	f
cc2cb5de-a48b-483e-a275-883a74e962c8	e2d9695c-4efa-4363-82a5-99d6dee1d47f	185fa4e1-792a-405b-9d68-7afb59bdcb5f	b4e001ad-250f-44bc-9012-2b2e62c98d03	935fd63a-7547-4fa8-aa01-9920ff3ad56e	150.00	2026-07-13 13:40:15.029	\N	\N	APROVADA	E03942	Marcelo Junio De Castro Silveira	5fb815a5-8170-44d3-8722-c4d233165682	2026-07-13 13:40:15.03	5fb815a5-8170-44d3-8722-c4d233165682	2026-07-13 13:41:21.654	\N	\N	\N	\N	\N	\N	f	\N	\N	f
68a8bda1-15ed-4b80-a514-a86bdb0b04b4	e2d9695c-4efa-4363-82a5-99d6dee1d47f	298f284c-9258-4a57-a211-3f5bd574defd	57574567-af94-4f13-b177-67efe7ef3982	935fd63a-7547-4fa8-aa01-9920ff3ad56e	50.00	2026-07-13 13:37:22.685	\N	\N	APROVADA	E03942	Marcelo Junio De Castro Silveira	5fb815a5-8170-44d3-8722-c4d233165682	2026-07-13 13:37:22.686	5fb815a5-8170-44d3-8722-c4d233165682	2026-07-13 13:41:22.351	\N	\N	\N	\N	\N	\N	f	\N	\N	f
c655e8d0-b1e1-4bd8-9f4d-0d753b5b928c	e2d9695c-4efa-4363-82a5-99d6dee1d47f	185fa4e1-792a-405b-9d68-7afb59bdcb5f	bbb265f7-d31e-4f79-aaaa-99b4514b8143	935fd63a-7547-4fa8-aa01-9920ff3ad56e	400.00	2026-07-13 13:54:44.404	\N	\N	APROVADA	E03942	Marcelo Junio De Castro Silveira	5fb815a5-8170-44d3-8722-c4d233165682	2026-07-13 13:54:44.405	5fb815a5-8170-44d3-8722-c4d233165682	2026-07-13 13:55:49.507	\N	\N	\N	\N	\N	\N	f	\N	\N	f
cdc45078-634b-401b-97d8-b069e2e25ea1	d764d838-e177-421f-a79d-cb71abdbda83	\N	1c028432-b6ee-4177-a47a-d276ef97feaa	2da1e44a-5e56-4f98-b44e-f8a75b02a5e2	40.00	2026-08-03 20:36:42.055	\N	\N	APROVADA	\N	\N	bc6dd499-2d1c-4102-a33c-a1d75c06a596	2026-08-03 20:36:42.056	187b1458-8eec-4c07-8e38-60c017441287	2026-08-03 20:38:21.878	\N	\N	\N	\N	\N	5025abce-f081-409a-aaf5-bbc805244755	f	\N	\N	f
6aa6d477-b349-47e3-a267-8c16b2f2176d	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	7eaf3340-73d6-4ce7-9c2e-8c6c53f2a622	e2da10a7-4e6d-460b-9a98-445b4119a7d7	935fd63a-7547-4fa8-aa01-9920ff3ad56e	150.00	2026-08-09 20:36:20.002	\N	Roteiro 3 - teste despesa	APROVADA	E01047	Clenio M. Mendes (TESTE INDIVIDUAL)	a33b01ad-75c5-470a-ad1c-cfeb1a557067	2026-08-09 20:36:20.003	0a305767-0303-4ebe-8c09-ea7dcd0c48e1	2026-08-09 20:36:49.44	\N	\N	\N	\N	\N	\N	f	\N	\N	f
77350d03-0de6-4f03-9edf-18b1dba25fda	8e843247-5b6b-4404-ba62-a74b84ccb287	cdbbb293-8357-4130-803a-d6581cc7a75b	63251972-866f-43e0-a427-0c9d4c1986d0	935fd63a-7547-4fa8-aa01-9920ff3ad56e	200.00	2026-08-06 13:04:33.72	Posto capul	\N	APROVADA	\N	\N	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-06 13:04:33.721	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-08-15 01:09:19.357	\N	\N	\N	\N	37af6ec2-896d-4df9-9929-d25d8a94fa27	a4a64b5e-bb06-4642-ac60-82873478c159	f	\N	1234	f
dc1f2d35-6af6-4285-87bc-3c915d19f9f9	d764d838-e177-421f-a79d-cb71abdbda83	1c3550d2-179f-4236-b475-60aba9e68523	2af0727d-9df8-4988-9f91-e765a7135703	703edff3-f76e-4a75-b895-c5e9632ffdfc	44.44	2026-08-21 15:00:00	\N	TESTE roteiro 21/08 - lancada pelo Fabricio	PENDENTE	\N	\N	187b1458-8eec-4c07-8e38-60c017441287	2026-08-21 20:51:59.915	bc6dd499-2d1c-4102-a33c-a1d75c06a596	2026-08-22 00:54:34.832	\N	\N	\N	\N	\N	\N	f	\N	\N	f
e2969217-0ab0-4593-9093-6ac220690cc4	d764d838-e177-421f-a79d-cb71abdbda83	\N	fddc7f9b-de51-48a5-8e39-8d9fb03a4f76	2da1e44a-5e56-4f98-b44e-f8a75b02a5e2	55.55	2026-08-23 01:37:33.373	\N	\N	PENDENTE	\N	\N	bc6dd499-2d1c-4102-a33c-a1d75c06a596	2026-08-23 01:37:33.376	\N	\N	\N	\N	\N	\N	\N	5d725e3a-4bde-47fc-bc34-59f904873883	f	\N	\N	f
74fed38f-82c4-46ca-b329-d3afe1edd801	d764d838-e177-421f-a79d-cb71abdbda83	1c3550d2-179f-4236-b475-60aba9e68523	fddc7f9b-de51-48a5-8e39-8d9fb03a4f76	935fd63a-7547-4fa8-aa01-9920ff3ad56e	369.99	2026-08-23 01:37:33.422	\N	\N	PENDENTE	\N	\N	bc6dd499-2d1c-4102-a33c-a1d75c06a596	2026-08-23 01:37:33.424	\N	\N	\N	\N	\N	\N	\N	5b8ba29c-0384-4400-a44c-9133ccbb25e3	f	\N	\N	f
7a2ff2e9-f828-4f12-b0c5-7abd5119889b	e2d9695c-4efa-4363-82a5-99d6dee1d47f	185fa4e1-792a-405b-9d68-7afb59bdcb5f	bbb265f7-d31e-4f79-aaaa-99b4514b8143	6e108550-29a0-4ce9-ac8b-ba0d2f989502	80.00	2026-07-13 13:55:07.174	\N	moto taxi	APROVADA	E03942	Marcelo Junio De Castro Silveira	5fb815a5-8170-44d3-8722-c4d233165682	2026-07-13 13:55:07.175	5fb815a5-8170-44d3-8722-c4d233165682	2026-07-13 13:55:48.457	\N	\N	\N	\N	\N	\N	f	\N	\N	f
35950740-1df8-4377-b10e-ffe7659a14c0	e2d9695c-4efa-4363-82a5-99d6dee1d47f	\N	bbb265f7-d31e-4f79-aaaa-99b4514b8143	2da1e44a-5e56-4f98-b44e-f8a75b02a5e2	80.00	2026-07-13 13:54:34.504	\N	\N	APROVADA	E03942	Marcelo Junio De Castro Silveira	5fb815a5-8170-44d3-8722-c4d233165682	2026-07-13 13:54:34.505	5fb815a5-8170-44d3-8722-c4d233165682	2026-07-13 13:55:50.369	\N	\N	\N	\N	\N	\N	f	\N	\N	f
c96b1166-abcf-439c-ba7d-c52aae22a03e	4884c4bf-54b1-40a0-9b33-bd48e0190ff4	298f284c-9258-4a57-a211-3f5bd574defd	\N	f94712ea-602d-40c7-adf1-78cd360c3502	90.00	2026-07-11 00:00:00	\N	Manutenção corretiva (KM 190) — Troca de correia dentada (quebra inesperada)	APROVADA	\N	\N	43920ca6-69c8-42c3-91bc-3f25d90aa64d	2026-07-11 13:58:55.208	43920ca6-69c8-42c3-91bc-3f25d90aa64d	2026-07-11 13:58:55.208	\N	\N	\N	\N	\N	\N	f	\N	\N	t
5dcde2a0-8d5f-4dc6-a298-c79e58deafb2	4884c4bf-54b1-40a0-9b33-bd48e0190ff4	298f284c-9258-4a57-a211-3f5bd574defd	\N	f94712ea-602d-40c7-adf1-78cd360c3502	150.00	2026-07-11 00:00:00	\N	Manutenção preventiva (KM 190) — Revisão preventiva de rotina	APROVADA	\N	\N	43920ca6-69c8-42c3-91bc-3f25d90aa64d	2026-07-11 13:58:17.892	43920ca6-69c8-42c3-91bc-3f25d90aa64d	2026-07-11 13:58:17.892	\N	\N	\N	\N	\N	\N	f	\N	\N	t
891ad8b5-b7da-48fe-a63a-ed78f4293fc0	d764d838-e177-421f-a79d-cb71abdbda83	\N	696c9461-4d7b-47cd-86f5-f9a875a08e9a	2da1e44a-5e56-4f98-b44e-f8a75b02a5e2	90.00	2026-08-01 15:00:00	\N	\N	APROVADA	\N	\N	187b1458-8eec-4c07-8e38-60c017441287	2026-08-02 00:28:05.219	bc6dd499-2d1c-4102-a33c-a1d75c06a596	2026-08-02 00:35:05.752	\N	\N	\N	\N	\N	\N	f	\N	\N	f
6734628e-7378-4572-8a7a-21ba468c14b6	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	\N	52ddd7f8-3807-4c11-a614-bb75dfedcd2a	2da1e44a-5e56-4f98-b44e-f8a75b02a5e2	50.00	2026-08-06 13:22:55.177	\N	\N	PENDENTE	E04099	TAUANY DE OLIVEIRA MENDES	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	2026-08-06 13:22:55.177	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	f
19fd6ed1-a1f2-49b1-b0a0-34b0b20d217f	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	7eaf3340-73d6-4ce7-9c2e-8c6c53f2a622	52ddd7f8-3807-4c11-a614-bb75dfedcd2a	935fd63a-7547-4fa8-aa01-9920ff3ad56e	50.00	2026-08-06 13:23:01.683	\N	\N	PENDENTE	E04099	TAUANY DE OLIVEIRA MENDES	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	2026-08-06 13:23:01.684	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	f
609290f9-ce89-442b-869f-a90ea019bd8a	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	9a0ab60e-0fe7-4f62-8f99-a486030e67ce	f52ef6d7-d0bd-4fea-a164-a2d39e3d679e	f94712ea-602d-40c7-adf1-78cd360c3502	500.00	2026-07-14 12:56:28.438	\N	\N	APROVADA	E02336	LIDYANE APARECIDA C G ROCHA	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	2026-07-14 12:56:28.439	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	2026-07-14 12:57:16.738	\N	\N	\N	\N	\N	\N	f	\N	\N	f
9e3710ce-82d8-4ed1-bb0f-fdcbae762eb1	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	9a0ab60e-0fe7-4f62-8f99-a486030e67ce	f52ef6d7-d0bd-4fea-a164-a2d39e3d679e	935fd63a-7547-4fa8-aa01-9920ff3ad56e	800.00	2026-07-14 12:56:16.958	\N	\N	APROVADA	E02336	LIDYANE APARECIDA C G ROCHA	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	2026-07-14 12:56:16.959	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	2026-07-14 12:57:17.886	\N	\N	\N	\N	\N	\N	f	\N	\N	f
b2c19cd2-131e-4905-b9a6-d61892d05517	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	\N	f52ef6d7-d0bd-4fea-a164-a2d39e3d679e	2da1e44a-5e56-4f98-b44e-f8a75b02a5e2	500.00	2026-07-14 12:56:05.988	\N	\N	APROVADA	E02336	LIDYANE APARECIDA C G ROCHA	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	2026-07-14 12:56:05.989	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	2026-07-14 12:57:19.285	\N	\N	\N	\N	\N	\N	f	\N	\N	f
cb64e337-e6dc-467c-b69c-d65d3e8ea188	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	\N	e2da10a7-4e6d-460b-9a98-445b4119a7d7	2da1e44a-5e56-4f98-b44e-f8a75b02a5e2	80.00	2026-08-09 20:38:37.241	\N	Roteiro 3 - despesa 2 (teste aprovação)	APROVADA	E01047	Clenio M. Mendes (TESTE INDIVIDUAL)	a33b01ad-75c5-470a-ad1c-cfeb1a557067	2026-08-09 20:38:37.242	0a305767-0303-4ebe-8c09-ea7dcd0c48e1	2026-08-09 22:05:46.974	\N	\N	\N	\N	\N	\N	f	\N	\N	f
5ae008ac-d9ca-43f0-89dd-1ebda25bb9b5	d764d838-e177-421f-a79d-cb71abdbda83	\N	2af0727d-9df8-4988-9f91-e765a7135703	2da1e44a-5e56-4f98-b44e-f8a75b02a5e2	70.00	2026-08-21 15:00:00	\N	TESTE roteiro 21/08 - lancada pelo Kelver	APROVADA	\N	\N	bc6dd499-2d1c-4102-a33c-a1d75c06a596	2026-08-21 20:57:40.345	187b1458-8eec-4c07-8e38-60c017441287	2026-08-22 00:58:17.81	\N	\N	\N	\N	\N	\N	f	\N	\N	f
cd0fffb6-b7c1-4f21-9d8c-ce1d7c380daa	d764d838-e177-421f-a79d-cb71abdbda83	\N	99f85c2d-2337-47f7-9b85-c0abbc421ae3	2da1e44a-5e56-4f98-b44e-f8a75b02a5e2	45.90	2026-08-05 15:00:00	\N	TESTE virada de mes 23/08	CONTESTADA	\N	\N	bc6dd499-2d1c-4102-a33c-a1d75c06a596	2026-08-23 02:55:49.753	187b1458-8eec-4c07-8e38-60c017441287	2026-08-23 02:55:49.934	Planejamento cancelado: planejamento de TESTE da virada de mes 23/08 — desconsiderar	\N	\N	\N	\N	\N	f	\N	\N	f
b99d5b69-b5de-4a01-a2a3-478adcf2b5dc	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	7eaf3340-73d6-4ce7-9c2e-8c6c53f2a622	52ddd7f8-3807-4c11-a614-bb75dfedcd2a	703edff3-f76e-4a75-b895-c5e9632ffdfc	10.00	2026-08-06 13:23:07.66	\N	\N	PENDENTE	E04099	TAUANY DE OLIVEIRA MENDES	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	2026-08-06 13:23:07.66	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	f
39a5655c-cca0-4769-af3a-534632dc9451	d764d838-e177-421f-a79d-cb71abdbda83	\N	efde89c3-26f2-4fe6-8579-f6ec3d2ee9c5	2da1e44a-5e56-4f98-b44e-f8a75b02a5e2	200.00	2026-07-17 19:52:48.282	\N	\N	APROVADA	002336	Lidyane Aparecida Costa Rocha	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-07-17 19:52:48.283	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-07-18 03:08:37.205	\N	\N	\N	\N	\N	\N	f	\N	\N	f
503294d1-464c-412f-b514-795892d6ebb2	d764d838-e177-421f-a79d-cb71abdbda83	\N	efde89c3-26f2-4fe6-8579-f6ec3d2ee9c5	2da1e44a-5e56-4f98-b44e-f8a75b02a5e2	5.00	2026-07-17 19:51:11.171	\N	\N	APROVADA	002336	Lidyane Aparecida Costa Rocha	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-07-17 19:51:11.172	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-07-18 03:08:42.832	\N	d764d838-e177-421f-a79d-cb71abdbda83/503294d1-464c-412f-b514-795892d6ebb2/6c618052-a469-4be1-b129-4b250c256ad2.jpg	943f15652e99053aa731a6c050a8049847628c3c25ec4370684b696297ca7de0	image/jpeg	\N	3fc503b0-7e4f-4af5-952b-a91ebbaced64	f	\N	\N	f
ab831919-2e4c-478e-86f5-b0705eef789d	d764d838-e177-421f-a79d-cb71abdbda83	e4a24d8d-aba3-4645-908e-9b9b26034a76	efde89c3-26f2-4fe6-8579-f6ec3d2ee9c5	935fd63a-7547-4fa8-aa01-9920ff3ad56e	350.00	2026-07-17 15:00:00	\N	\N	APROVADA	002336	Lidyane Aparecida Costa Rocha	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-07-17 19:53:11.91	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-07-17 23:41:33.592	\N	\N	\N	\N	\N	\N	f	\N	\N	f
4169bfa3-a9fe-4f30-9e9c-585dda3c5f19	8e843247-5b6b-4404-ba62-a74b84ccb287	cdbbb293-8357-4130-803a-d6581cc7a75b	d708c387-13a8-424f-8611-122d2b0bad99	935fd63a-7547-4fa8-aa01-9920ff3ad56e	100.00	2026-07-26 22:09:17.044	\N	\N	APROVADA	E03422	RAYDE APARECIDA V B CASTRO	0117ccd5-cafc-4f3b-89b1-d681f600588c	2026-07-26 22:09:17.045	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-26 22:20:12.703	\N	\N	\N	\N	\N	\N	f	\N	\N	f
f3c969c8-3613-4230-872f-9f0323570dae	d764d838-e177-421f-a79d-cb71abdbda83	\N	788b9ddf-e1f3-4ff0-a098-fe4090f88076	2da1e44a-5e56-4f98-b44e-f8a75b02a5e2	25.00	2026-07-18 01:01:42.424	\N	TESTE QA A7 - roteiro 17-07	APROVADA	005274	Kelver Eduardo dos Santos Florenço	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-07-18 01:01:42.425	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-07-18 03:07:15.01	\N	\N	\N	\N	\N	\N	f	\N	\N	f
bf97370b-4f57-465b-b259-f9791855ebf1	d764d838-e177-421f-a79d-cb71abdbda83	1c3550d2-179f-4236-b475-60aba9e68523	788b9ddf-e1f3-4ff0-a098-fe4090f88076	935fd63a-7547-4fa8-aa01-9920ff3ad56e	180.00	2026-07-18 03:08:05.427	\N	\N	APROVADA	005274	Kelver Eduardo dos Santos Florenço	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-07-18 03:08:05.428	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-07-18 03:08:23.846	\N	\N	\N	\N	\N	\N	f	\N	\N	f
837cc338-53b1-437e-a6e6-b6af7141299c	8e843247-5b6b-4404-ba62-a74b84ccb287	cdbbb293-8357-4130-803a-d6581cc7a75b	fb64d02b-55a1-444c-9007-0cb3f9f8539a	935fd63a-7547-4fa8-aa01-9920ff3ad56e	80.00	2026-07-26 22:00:12.877	\N	\N	APROVADA	E03422	RAYDE APARECIDA V B CASTRO	0117ccd5-cafc-4f3b-89b1-d681f600588c	2026-07-26 22:00:12.878	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-26 22:20:13.703	\N	\N	\N	\N	\N	e4761e33-7fc0-4a73-981d-90e5cd450cb4	f	\N	\N	f
1ac7d52e-a9f4-42eb-a5de-59e6d1eac9be	8e843247-5b6b-4404-ba62-a74b84ccb287	cdbbb293-8357-4130-803a-d6581cc7a75b	404fb17a-0792-454d-9829-12f4a0271ef2	935fd63a-7547-4fa8-aa01-9920ff3ad56e	50.00	2026-07-26 21:02:01.28	\N	\N	APROVADA	E01047	CLENIO MARCOS MENDES	0117ccd5-cafc-4f3b-89b1-d681f600588c	2026-07-26 21:02:01.281	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-26 22:20:14.153	\N	\N	\N	\N	\N	28d220c5-d848-4caa-9bf7-5561ba807a0a	f	\N	\N	f
1e950b5e-4cc7-484c-a9fc-c518c534ead6	8e843247-5b6b-4404-ba62-a74b84ccb287	cdbbb293-8357-4130-803a-d6581cc7a75b	404fb17a-0792-454d-9829-12f4a0271ef2	935fd63a-7547-4fa8-aa01-9920ff3ad56e	50.00	2026-07-26 20:39:30.417	\N	\N	APROVADA	E01047	CLENIO MARCOS MENDES	0117ccd5-cafc-4f3b-89b1-d681f600588c	2026-07-26 20:39:30.418	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-26 22:20:14.646	\N	\N	\N	\N	\N	e3c943f5-c8d7-431f-a0f4-f807ca5661ff	f	\N	\N	f
205ddd04-5914-4b46-a1ee-4738bf401ada	8e843247-5b6b-4404-ba62-a74b84ccb287	cdbbb293-8357-4130-803a-d6581cc7a75b	a8c7f119-1445-4d03-b0cb-0b936bca2264	935fd63a-7547-4fa8-aa01-9920ff3ad56e	6.32	2026-07-25 23:56:41.121	\N	\N	APROVADA	\N	\N	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-25 23:56:41.122	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-26 22:20:15.139	\N	\N	\N	\N	\N	e5912cb0-521a-4dc3-999e-9fc4a72e948e	f	\N	\N	f
72342264-122d-440f-88aa-41b2b62bb870	8e843247-5b6b-4404-ba62-a74b84ccb287	cdbbb293-8357-4130-803a-d6581cc7a75b	5b199bfc-a924-458d-a3c8-1db67835c2dc	935fd63a-7547-4fa8-aa01-9920ff3ad56e	563.52	2026-07-25 22:44:17.995	\N	\N	APROVADA	\N	\N	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-25 22:44:17.996	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-26 22:20:15.698	\N	\N	\N	\N	\N	69db42a8-5ec5-46b2-b325-cc23e4b9c4cd	f	\N	\N	f
3ffad5fd-5d6e-48f5-9b71-d8bd119c98e2	8e843247-5b6b-4404-ba62-a74b84ccb287	cdbbb293-8357-4130-803a-d6581cc7a75b	bda72278-06a4-42a3-b463-e4f631beee09	935fd63a-7547-4fa8-aa01-9920ff3ad56e	580.00	2026-07-25 01:13:32.021	\N	\N	APROVADA	\N	\N	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-25 01:13:32.022	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-26 22:20:16.231	\N	\N	\N	\N	\N	8f7a39cc-90df-4169-a65d-b654c9d8f723	f	\N	\N	f
185bc776-9345-429d-ba38-4eb86e1a6bb1	d764d838-e177-421f-a79d-cb71abdbda83	\N	97fc97ea-2520-4ec9-80d6-88aec9071a89	935fd63a-7547-4fa8-aa01-9920ff3ad56e	500.00	2026-07-27 20:49:32.779	\N	\N	APROVADA	\N	\N	187b1458-8eec-4c07-8e38-60c017441287	2026-07-27 20:49:32.783	187b1458-8eec-4c07-8e38-60c017441287	2026-07-27 20:49:32.782	\N	\N	\N	\N	\N	4805178e-c1bf-4b82-bde6-38d798f33df6	f	\N	\N	f
6e1dad7d-733c-45c8-a3ef-0c5d68962b5b	d764d838-e177-421f-a79d-cb71abdbda83	\N	97fc97ea-2520-4ec9-80d6-88aec9071a89	2da1e44a-5e56-4f98-b44e-f8a75b02a5e2	50.00	2026-07-27 20:49:52.15	\N	\N	APROVADA	\N	\N	187b1458-8eec-4c07-8e38-60c017441287	2026-07-27 20:49:52.151	187b1458-8eec-4c07-8e38-60c017441287	2026-07-27 20:49:52.15	\N	\N	\N	\N	\N	0de2f3a9-7080-43d5-abf5-02d44037b021	f	\N	\N	f
8ec7e147-13c5-42b1-9282-48b2b24a3a43	d764d838-e177-421f-a79d-cb71abdbda83	\N	0f08e2e9-6b64-4794-9203-c4c6414ca684	935fd63a-7547-4fa8-aa01-9920ff3ad56e	55.00	2026-08-01 01:50:04.464	\N	\N	PENDENTE	\N	\N	187b1458-8eec-4c07-8e38-60c017441287	2026-08-01 01:50:04.466	\N	\N	\N	\N	\N	\N	\N	5c088d85-d0e5-4d7c-a7df-c116315e654e	f	\N	\N	f
5a2864a8-d4c9-4afc-a8c5-a3ec5d26c0ab	d764d838-e177-421f-a79d-cb71abdbda83	\N	924165f8-dc7b-41cf-b34d-abf5b1f0b1d8	2da1e44a-5e56-4f98-b44e-f8a75b02a5e2	30.00	2026-08-01 01:51:21.266	\N	\N	APROVADA	\N	\N	187b1458-8eec-4c07-8e38-60c017441287	2026-08-01 01:51:21.267	187b1458-8eec-4c07-8e38-60c017441287	2026-08-01 01:51:21.266	\N	\N	\N	\N	\N	a38037a0-97d5-4cb6-a468-ffbc5637538d	f	\N	\N	f
53e15803-250d-45e4-8a95-dc2c9085f316	d764d838-e177-421f-a79d-cb71abdbda83	\N	924165f8-dc7b-41cf-b34d-abf5b1f0b1d8	935fd63a-7547-4fa8-aa01-9920ff3ad56e	80.00	2026-08-01 01:51:39.857	\N	\N	APROVADA	\N	\N	187b1458-8eec-4c07-8e38-60c017441287	2026-08-01 01:51:39.858	187b1458-8eec-4c07-8e38-60c017441287	2026-08-01 01:51:39.857	\N	\N	\N	\N	\N	9af1297d-1b49-434e-952a-8c897ddb7a49	f	\N	\N	f
071008c8-4dbf-4ce2-b706-de13808be9c3	d764d838-e177-421f-a79d-cb71abdbda83	\N	bba461dd-b0f6-4aa1-9526-e9d4d485938d	2da1e44a-5e56-4f98-b44e-f8a75b02a5e2	58.00	2026-07-01 15:00:00	\N	\N	PENDENTE	\N	\N	187b1458-8eec-4c07-8e38-60c017441287	2026-08-01 03:05:35.173	\N	\N	\N	\N	\N	\N	\N	84d03d93-2f44-4cc5-92ae-c1b8a9daae1f	f	\N	\N	f
6dcdabf9-43ee-4351-a850-838970424bab	d764d838-e177-421f-a79d-cb71abdbda83	\N	5daae0ca-dd62-4cfe-9fc6-bb6aad117aaa	2da1e44a-5e56-4f98-b44e-f8a75b02a5e2	55.55	2026-08-01 03:54:43.19	\N	\N	PENDENTE	\N	\N	187b1458-8eec-4c07-8e38-60c017441287	2026-08-01 03:54:43.192	\N	\N	\N	\N	\N	\N	\N	a3b23aa9-6f11-4178-a0cd-f5c66fefd856	f	\N	\N	f
2f2c06b4-8f44-499a-9fe9-f87cec4252f5	d764d838-e177-421f-a79d-cb71abdbda83	\N	5daae0ca-dd62-4cfe-9fc6-bb6aad117aaa	935fd63a-7547-4fa8-aa01-9920ff3ad56e	80.99	2026-08-01 03:54:57.826	\N	\N	PENDENTE	\N	\N	187b1458-8eec-4c07-8e38-60c017441287	2026-08-01 03:54:57.828	\N	\N	\N	\N	\N	\N	\N	66c55b88-b686-427a-9cd7-94a8508a81df	f	\N	\N	f
0b694555-08e4-43dd-93b6-974fcc14a8fd	d764d838-e177-421f-a79d-cb71abdbda83	1c3550d2-179f-4236-b475-60aba9e68523	696c9461-4d7b-47cd-86f5-f9a875a08e9a	f94712ea-602d-40c7-adf1-78cd360c3502	155.00	2026-08-01 15:00:00	\N	\N	APROVADA	\N	\N	187b1458-8eec-4c07-8e38-60c017441287	2026-08-01 14:36:29.828	187b1458-8eec-4c07-8e38-60c017441287	2026-08-02 00:31:33.195	\N	\N	\N	\N	\N	\N	f	\N	\N	f
cedf1139-2939-4b9d-8a3f-50b756cc55a7	d764d838-e177-421f-a79d-cb71abdbda83	\N	696c9461-4d7b-47cd-86f5-f9a875a08e9a	2da1e44a-5e56-4f98-b44e-f8a75b02a5e2	60.00	2026-08-01 15:00:00	\N	\N	PENDENTE	\N	\N	bc6dd499-2d1c-4102-a33c-a1d75c06a596	2026-08-02 00:36:19.884	187b1458-8eec-4c07-8e38-60c017441287	2026-08-02 00:41:44.965	\N	\N	\N	\N	\N	\N	f	\N	\N	f
76383c56-2297-40df-938d-ac8257888502	d764d838-e177-421f-a79d-cb71abdbda83	1c3550d2-179f-4236-b475-60aba9e68523	696c9461-4d7b-47cd-86f5-f9a875a08e9a	935fd63a-7547-4fa8-aa01-9920ff3ad56e	52.00	2026-08-01 14:35:09.429	\N	\N	APROVADA	\N	\N	bc6dd499-2d1c-4102-a33c-a1d75c06a596	2026-08-01 14:35:09.43	187b1458-8eec-4c07-8e38-60c017441287	2026-08-01 14:36:59.646	\N	\N	\N	\N	\N	2c7513c1-38d4-4d20-add6-9cbe735fc71c	f	\N	\N	f
70f7e787-aeae-4f45-ad0e-0a020ae95ecd	d764d838-e177-421f-a79d-cb71abdbda83	\N	696c9461-4d7b-47cd-86f5-f9a875a08e9a	2da1e44a-5e56-4f98-b44e-f8a75b02a5e2	58.88	2026-08-01 14:34:52.659	\N	\N	APROVADA	\N	\N	bc6dd499-2d1c-4102-a33c-a1d75c06a596	2026-08-01 14:34:52.66	187b1458-8eec-4c07-8e38-60c017441287	2026-08-01 14:37:00.516	\N	\N	\N	\N	\N	7ed4768a-afa5-4f07-8cfd-9a4e6491c00f	f	\N	\N	f
1e86568a-c301-403f-8653-1a18faec6b40	d764d838-e177-421f-a79d-cb71abdbda83	1c3550d2-179f-4236-b475-60aba9e68523	4e5bccc2-f0b1-40b7-a68c-4c07c72db717	f94712ea-602d-40c7-adf1-78cd360c3502	500.00	2026-08-01 15:09:38.375	\N	\N	APROVADA	\N	\N	187b1458-8eec-4c07-8e38-60c017441287	2026-08-01 15:09:38.377	bc6dd499-2d1c-4102-a33c-a1d75c06a596	2026-08-01 15:09:53.97	\N	\N	\N	\N	\N	\N	f	\N	\N	f
b978b165-f449-4479-9e22-9d7dc3e806e1	d764d838-e177-421f-a79d-cb71abdbda83	1c3550d2-179f-4236-b475-60aba9e68523	4e5bccc2-f0b1-40b7-a68c-4c07c72db717	935fd63a-7547-4fa8-aa01-9920ff3ad56e	80.00	2026-08-01 14:56:55.568	\N	\N	APROVADA	\N	\N	bc6dd499-2d1c-4102-a33c-a1d75c06a596	2026-08-01 14:56:55.569	187b1458-8eec-4c07-8e38-60c017441287	2026-08-01 15:09:58.918	\N	\N	\N	\N	\N	d54c273e-d36c-4d90-9bf6-4a447747ee61	f	\N	\N	f
c983b395-1272-4515-ad3d-7bb88223835a	d764d838-e177-421f-a79d-cb71abdbda83	\N	4e5bccc2-f0b1-40b7-a68c-4c07c72db717	2da1e44a-5e56-4f98-b44e-f8a75b02a5e2	58.80	2026-08-01 14:56:40.578	\N	\N	APROVADA	\N	\N	bc6dd499-2d1c-4102-a33c-a1d75c06a596	2026-08-01 14:56:40.579	187b1458-8eec-4c07-8e38-60c017441287	2026-08-01 15:09:59.625	\N	\N	\N	\N	\N	dd7603c4-a8b4-4d8a-9507-3322956a09b0	f	\N	\N	f
\.


--
-- Data for Name: endereco_entrega; Type: TABLE DATA; Schema: logistica; Owner: capul_user
--

COPY logistica.endereco_entrega (id, matricula, cliente_local_id, apelido, logradouro, numero, complemento, bairro, cidade, uf, cep, ponto_referencia, latitude, longitude, ativo, criado_em, filial_id, telefone) FROM stdin;
710f8386-d1e0-4490-abe8-30765e3efb33	E01981	\N	\N	Rua Jaçanã	10	\N	Divinéia	Unaí	MG	38613545	\N	\N	\N	t	2026-07-13 19:54:42.515	8e843247-5b6b-4404-ba62-a74b84ccb287	38998665383
f95fe54a-6662-4291-b13c-9c487bd15abf	E03113	\N	\N	RUA SANTA LUZIA	1414	\N	N. SRA. AP.	UNAI	MG	38610000	\N	\N	\N	t	2026-07-13 19:55:07.478	8e843247-5b6b-4404-ba62-a74b84ccb287	38999811390
1dc18d94-6477-405f-b979-9a6c8137fcf3	A00901	\N	\N	Rua Canabrava	1457	\N	Cachoeira	Unaí	MG	38610250	\N	\N	\N	t	2026-07-13 19:56:29.364	8e843247-5b6b-4404-ba62-a74b84ccb287	38999469637
2ed01bae-5d0f-4dbb-8dff-c447256d74a0	E03355	\N	\N	RUA CAMILA P BROCHADO	85	\N	SANTA LUZIA	UNAI	MG	38610000	\N	\N	\N	t	2026-07-16 18:50:33.114	8e843247-5b6b-4404-ba62-a74b84ccb287	38998332041
53dc1752-29e6-47bd-923a-a19a89ac261a	E01019	\N	\N	RUA LEAO LARA	149	\N	DIVINEIA	UNAI	MG	38610000	\N	\N	\N	t	2026-07-16 18:51:18.916	8e843247-5b6b-4404-ba62-a74b84ccb287	38991500476
db23b6d9-77c7-4ef3-973d-217c44d493cd	E03422	\N	\N	RUA OLAVO FRANCISCO DE OLIVEIRA	246	\N	VALE VERDE	UNAI	MG	38610000	\N	\N	\N	t	2026-07-16 18:51:28.085	8e843247-5b6b-4404-ba62-a74b84ccb287	38998030288
c813bbaf-2a50-4ad7-b68d-6b06940e5ff8	E04379	\N	\N	Avenida Castelo Branco	120	\N	Barroca	Unaí	MG	38616072	\N	\N	\N	t	2026-07-26 13:13:16.318	8e843247-5b6b-4404-ba62-a74b84ccb287	38998411997
30e348f6-1acd-424f-b0c5-088fd387a664	E01939	\N	\N	RUA 1 DE MAIO	185	\N	CACHOEIRA	UNAI	MG	38610000	\N	\N	\N	t	2026-07-16 19:03:32.403	8e843247-5b6b-4404-ba62-a74b84ccb287	38999521480
b76cdfd8-b3b9-4453-be91-34a0718b53d9	E02681	\N	\N	RUA ABEL FERREIRA	26	\N	OLARIA	UNAI	MG	38610000	\N	\N	\N	t	2026-07-16 19:03:42.392	8e843247-5b6b-4404-ba62-a74b84ccb287	3899135721
e9b4b43d-c37c-4336-833d-e330d0794981	E03058	\N	\N	RUA GENIPAPERO	273	\N	CIDADE NOVA	UNAI	MG	38610000	\N	\N	\N	t	2026-07-16 19:03:55.51	8e843247-5b6b-4404-ba62-a74b84ccb287	3899979948
17e7a608-efe5-4713-960e-0d1c3729d339	E03322	\N	\N	RUA ALBA GONZAGA	741	AP301	CENTRO	UNAI	MG	38610000	\N	\N	\N	t	2026-07-16 19:11:22.763	8e843247-5b6b-4404-ba62-a74b84ccb287	38999097360
88c24610-0786-408c-9109-e0c3a5a52bf7	E03725	\N	\N	RUA FREI  FRANCISCO	346	\N	NOVO HORIZONTE	UNAI	MG	38610000	\N	\N	\N	t	2026-07-16 19:11:51.651	8e843247-5b6b-4404-ba62-a74b84ccb287	38999602253
c68379fa-cccb-4b7f-88fa-19aa0a3e1cf2	E01981	\N	\N	Rua Canabrava	1457	CASA	Cachoeira	Unaí	MG	38610250	\N	\N	\N	t	2026-07-16 19:12:17.041	8e843247-5b6b-4404-ba62-a74b84ccb287	38998665383
c46d6c77-4c4d-40f9-8a83-adecb17669c8	E03990	\N	\N	RUA AFONSO PENA	83	CS	OLARIA	UNAI	MG	38610000	\N	\N	\N	t	2026-07-16 19:13:27.122	8e843247-5b6b-4404-ba62-a74b84ccb287	38998936645
434d7db4-f2d2-43c1-bed1-10e45224f12e	E03683	\N	\N	RUA TRES	95	CS	SANTA LUZIA	UNAI	MG	38610000	\N	\N	\N	t	2026-07-16 19:13:39.908	8e843247-5b6b-4404-ba62-a74b84ccb287	38998117070
01996b19-710a-4e68-b65e-653947e2dc42	E02749	\N	\N	RUA JURITI	175	\N	FLORESTA	UNAI	MG	38610000	\N	\N	\N	t	2026-07-16 19:26:04.427	8e843247-5b6b-4404-ba62-a74b84ccb287	3898430656
4ba61b0c-db5b-4114-967f-b36c6050acc1	E04838	\N	\N	Rua dos Jambos	34	\N	Primavera	Unaí	MG	38612122	\N	\N	\N	t	2026-07-16 19:26:19.308	8e843247-5b6b-4404-ba62-a74b84ccb287	38998552342
b3d6e6aa-dfb3-4831-8920-790a10827e0f	E03401	\N	\N	RUA VICENTE PAULA PESSOA	216	\N	NOVO HORIZONTE	UNAI	MG	38610000	\N	\N	\N	t	2026-07-16 19:27:53.737	8e843247-5b6b-4404-ba62-a74b84ccb287	38998319486
8e8efa1f-74fa-4093-98e9-443a2b9fe2bf	E01044	\N	\N	RUA CANABRAVA	1416	\N	CACHOEIRA	UNAI	MG	38610000	\N	\N	\N	t	2026-08-11 11:40:21.288	8e843247-5b6b-4404-ba62-a74b84ccb287	3899617600
ee500cf1-7b5e-4bbf-80dd-22a806aab0ef	E01981	\N	\N	RUA JACANA, 04 CASA	10	\N	CENTRO	UNAI	MG	38613545	\N	\N	\N	t	2026-07-16 19:39:24.529	8e843247-5b6b-4404-ba62-a74b84ccb287	38998665383
c926ad3d-db5c-493a-ae73-91483d0b3caf	A00901	\N	\N	FAZ. GLEBA DO GADO BRAVO PARCELA	247	\N	ZONA RURAL	DOM BOSCO	MG	38654000	\N	\N	\N	t	2026-07-16 19:44:23.589	8e843247-5b6b-4404-ba62-a74b84ccb287	38999469637
4d89bb4e-0dca-4034-a0c4-f63a6f20c140	E04489	\N	\N	Rua Juriti	89	\N	Floresta	Unaí	MG	38613145	\N	\N	\N	t	2026-07-16 19:44:32.2	8e843247-5b6b-4404-ba62-a74b84ccb287	38999838637
74b199b1-18e5-4d4a-acb4-e9170e917029	A04721	\N	\N	Rua Cachoeira	120	\N	Centro	Unaí	MG	38610051	\N	\N	\N	t	2026-07-25 00:32:55.02	8e843247-5b6b-4404-ba62-a74b84ccb287	38999625125
00be49f4-6323-40d5-9ed2-af380dc081e0	E04848	\N	\N	Rua Lúcia de Souza Ribeiro	100	\N	Residencial Curva do Rio	Unaí	MG	38620886	\N	\N	\N	t	2026-07-25 00:31:56.937	8e843247-5b6b-4404-ba62-a74b84ccb287	8999023007
f58bf9f5-5f24-44fd-884e-2e49588c4bdf	E03831	\N	\N	AV DELVITO ALVES DA SILVA	215	AP 204	DIVINEIA	UNAI	MG	38610000	\N	\N	\N	t	2026-07-25 02:16:38.983	8e843247-5b6b-4404-ba62-a74b84ccb287	38998481047
a9caa26d-5fad-4a06-8678-f01b575e9167	A05762	\N	\N	Rua Eduardo Rodrigues Barbosa	475	\N	Centro	Unaí	MG	38610061	\N	\N	\N	t	2026-07-25 02:16:18.553	8e843247-5b6b-4404-ba62-a74b84ccb287	38999625125
c1f3e83a-f1f8-45d4-a3e0-4616a5911c46	A04721	\N	\N	FAZ. INHUMAS, SN	\N	\N	ZONA RURAL	UNAI	MG	38610000	\N	\N	\N	t	2026-07-25 02:59:02.946	8e843247-5b6b-4404-ba62-a74b84ccb287	38999625125
3d228200-f659-4bdf-8fab-022c56897a21	E03838	\N	\N	RUA JOZINDA DOS SANTOS CALDEIRA	641	CS	SAGRADA FAMILIA	UNAI	MG	38610000	\N	\N	\N	t	2026-07-25 02:59:10.842	8e843247-5b6b-4404-ba62-a74b84ccb287	38999053620
524d982c-1941-4921-b556-60ae73aee6ed	E03156	\N	\N	Avenida Castelo Branco	34	AP 101	Barroca	Unaí	MG	38616072	\N	\N	\N	t	2026-07-26 13:12:12.886	8e843247-5b6b-4404-ba62-a74b84ccb287	38999480178
07f9f9d1-dcd8-40f1-a561-ed35f5c2fd62	E04379	\N	\N	AV CASTELO BRANCO	120	\N	BARROCA	UNAI	MG	38616072	\N	\N	\N	t	2026-07-26 13:30:05.848	8e843247-5b6b-4404-ba62-a74b84ccb287	38998411997
c37b1920-03fa-4edb-a46b-d26fdb0d1230	A04721	\N	\N	Rua Calixto Martins de Melo	100	\N	Centro	Unaí	MG	38610039	\N	\N	\N	t	2026-07-29 19:41:17.222	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	38999625125
10fa32ec-679d-4826-8066-d24bf00fee19	E01047	\N	\N	Rua Calixto Martins de Melo	475	\N	Centro	Unaí	MG	38610039	\N	\N	\N	t	2026-07-17 13:48:07.91	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	38999625225
6126acba-75e1-4eaf-9d72-5282ce6474f6	E01047	\N	\N	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	MG	38610000	\N	\N	\N	t	2026-07-13 19:55:40.342	8e843247-5b6b-4404-ba62-a74b84ccb287	38999625225
1be1419a-c879-4cfd-8192-2efa5c77d8a0	E04848	\N	\N	Rua Lúcia de Souza Ribeiro	100	\N	Residencial Curva do Rio	Unaí	MG	38620886	\N	\N	\N	t	2026-07-17 13:48:17.213	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	8999023007
0735f71b-1ed0-4404-82b1-f5772b8636c2	E01047	\N	\N	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	MG	38610000	\N	\N	\N	t	2026-08-11 11:38:55.145	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	38999625225
db42940e-ee9d-4b0f-acf1-eb4ebc27a8a0	A02027	\N	\N	Rua Calixto Martins de Melo	2027	\N	Centro	Unaí	MG	38610039	\N	\N	\N	t	2026-07-25 00:31:46.14	8e843247-5b6b-4404-ba62-a74b84ccb287	38999609300
633453e6-59a9-443b-8ce7-06a1ce070460	A02027	\N	\N	Rua Calixto Martins de Melo	500	\N	Centro	Unaí	MG	38610039	\N	\N	\N	t	2026-08-10 18:04:05.489	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	38999609300
9d904bd7-2a59-4799-a702-7ff1abdf7edc	E04099	\N	\N	Rua do Pico	21	\N	Primavera 5	Unaí	MG	38612244	\N	\N	\N	t	2026-08-06 12:50:04.68	8e843247-5b6b-4404-ba62-a74b84ccb287	38997248912
ec5da9bd-c0b1-473e-9be4-dd9e8e67e45f	A04721	\N	\N	CHACARA DO ZE GALINHA	S/N	DEPOIS DA PORTEIRA	ZONA RURAL	Unaí	MG	\N	IGREJA AZUL	\N	\N	t	2026-08-06 12:54:21.766	8e843247-5b6b-4404-ba62-a74b84ccb287	38999625125
ea48b823-78c0-425e-974f-78e507426bf7	E04879	\N	\N	Rua Ari Lacerda	165	\N	Novo Horizonte	Unaí	MG	38616502	\N	\N	\N	t	2026-08-11 14:21:07.589	8e843247-5b6b-4404-ba62-a74b84ccb287	38999241072
1b9b7498-f8ce-4d7b-9a68-f8de01ea59a1	E04060	\N	\N	Avenida Frei Anselmo	125	BLBAP08	Divinéia	Unaí	MG	38613431	\N	\N	\N	t	2026-08-11 14:50:29.627	8e843247-5b6b-4404-ba62-a74b84ccb287	38999777340
74d4cf00-e6f4-4b39-a398-41bc546cf9fe	E03132	\N	\N	AVENIDA QUINTINO F. SILVA	165	BLOQUEIO A PEDIDO DO MESMO	VALE VERDE	UNAI	MG	38610000	\N	\N	\N	t	2026-08-11 14:50:38.865	8e843247-5b6b-4404-ba62-a74b84ccb287	3899619160
3cb1db17-43cc-4dcb-a8fa-19854ebd03b5	E04099	\N	\N	Rua do Pico	21	\N	Primavera 5	Unaí	MG	38612244	\N	\N	\N	t	2026-08-11 19:42:07.738	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	38997248912
c5295dc6-0be5-4bfc-b8ea-3e14b9f3ad3f	E04379	\N	\N	Avenida Castelo Branco	120	\N	Barroca	Unaí	MG	38616072	\N	\N	\N	t	2026-08-11 19:42:18.468	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	38998411997
45321b9c-2b18-4f4b-b56f-acb1b8187fbf	E04379	\N	\N	Avenida Castelo Branco	200	\N	Barroca	Unaí	MG	38613416	\N	\N	\N	t	2026-08-06 12:51:14.665	8e843247-5b6b-4404-ba62-a74b84ccb287	38998411997
28539bd2-281a-4a59-8821-2af560221294	A02027	\N	\N	FAZ. PICO, SN	\N	\N	ZONA RURAL	UNAI	MG	38610000	\N	\N	\N	t	2026-08-14 23:41:15.593	8e843247-5b6b-4404-ba62-a74b84ccb287	38999609300
2c37bee6-0869-411c-b17f-5adf27606f52	E04721	\N	\N	Rua Maria Galdina	104	\N	Nova Canaã	Unaí	MG	38616449	\N	\N	\N	t	2026-08-15 01:49:18.161	8e843247-5b6b-4404-ba62-a74b84ccb287	38998643246
0a6610be-c562-4231-8c9a-dbcffd2b9b12	A04379	\N	\N	Rua Calixto Martins de Melo	500	\N	Centro	Unaí	MG	38610039	\N	\N	\N	t	2026-08-15 02:04:17.061	8e843247-5b6b-4404-ba62-a74b84ccb287	38999651579
067654b6-084c-4267-8f1f-93e401899978	A07503	\N	\N	Rua Djalma Torres	1293	\N	Cachoeira	Unaí	MG	38610259	\N	\N	\N	t	2026-08-21 18:48:09.968	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	38997383227
\.


--
-- Data for Name: entrega; Type: TABLE DATA; Schema: logistica; Owner: capul_user
--

COPY logistica.entrega (id, numero, filial_id, tipo_cliente, matricula, cliente_local_id, destinatario_nome, telefone, endereco_entrega_id, end_logradouro, end_numero, end_complemento, end_bairro, end_cidade, end_cep, end_referencia, horario, observacoes, quantidade_volumes, status, criado_em, criado_por_id, cancelada_em, cancelada_por_id, motivo_cancelamento, tem_comprovante, comprovante_id, end_uf, baixado_por_id, data_hora_entrega, geo_lat, geo_lng, motivo_nao_entrega, origem_venda, tentativas, historico_tentativas, recebedor_nome, registrado_por_matricula, registrado_por_nome, data_entrega, baixa_geo_lat, baixa_geo_lng) FROM stdin;
eae661b9-943d-4a1e-9bcb-9fe07963af5c	23	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	0735f71b-1ed0-4404-82b1-f5772b8636c2	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	38610000	\N	\N	\N	1	PENDENTE	2026-08-11 19:41:55.354	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	\N	\N	\N	f	\N	MG	\N	\N	-16.3593730	-46.9021793	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-11 15:00:00	\N	\N
6081641c-2155-430a-9047-ee81ca36b528	21	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	\N	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	38610000	\N	\N	\N	1	PENDENTE	2026-08-11 11:38:55.132	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	\N	\N	\N	f	\N	MG	\N	\N	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-11 15:00:00	\N	\N
0a05d2bb-cd38-42a4-bfda-dc7d5011792c	132	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	\N	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-08-15 02:30:48.133	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	433b7a25-2f27-413f-83e6-0bc048295c4e	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 03:20:17.037	-16.3624897	-46.8978999	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-14 15:00:00	\N	\N
6da290a3-42f4-4d70-82a7-793983d06b32	22	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	IDENTIFICADO	E04848	\N	JULIANA DA SILVA MARQUES	8999023007	1be1419a-c879-4cfd-8192-2efa5c77d8a0	Rua Lúcia de Souza Ribeiro	100	\N	Residencial Curva do Rio	Unaí	38620886	\N	\N	\N	1	PENDENTE	2026-08-11 11:39:04.317	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	\N	\N	\N	f	\N	MG	\N	\N	-16.3625062	-46.8979151	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-11 15:00:00	\N	\N
21a3383c-5663-4052-9340-4f780f6b5408	107	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A02027	\N	VALDINEI PAULO DE OLIVEIRA	38999609300	db42940e-ee9d-4b0f-acf1-eb4ebc27a8a0	Rua Calixto Martins de Melo	2027	\N	Centro	Unaí	38610039	\N	\N	\N	1	ENTREGUE	2026-08-11 19:43:43.471	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	0743b44a-58ef-4d7e-941b-915db79fd5b4	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-11 20:13:34.135	-16.3615447	-46.8988756	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-11 15:00:00	\N	\N
15d1caa8-9613-4098-b78f-7fc0156187f0	2	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03113	\N	ADRIANA CAETANO VASCONCELOS	38999811390	\N	RUA SANTA LUZIA	1414	\N	N. SRA. AP.	UNAI	38610000	\N	\N	\N	2	ENTREGUE	2026-07-13 19:55:07.465	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	7ba0d1a1-05c8-488d-8d9b-09511f30ed86	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 18:42:00.736	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
1ed42b3e-fb4b-4910-982c-a6a044f14c51	4	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A00901	\N	ANGELO PEREIRA DE FREITAS	38999469637	\N	Rua Canabrava	1457	\N	Cachoeira	Unaí	38610250	\N	\N	\N	1	ENTREGUE	2026-07-13 19:56:29.355	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	51ea17b5-82aa-4d03-adbe-f3b15a2eade1	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 18:46:36.699	\N	\N	\N	TELE_VENDA	1	\N	\N	\N	\N	\N	\N	\N
f204ccfc-b646-4885-b248-0bea8fc48dd1	3	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	EVENTUAL	\N	\N	Ana Costa	38999333003	\N	Rua Floriano Peixoto	45	\N	Bela Vista	Unaí	\N	\N	\N	\N	1	ENTREGUE	2026-07-11 23:17:15.108	a33b01ad-75c5-470a-ad1c-cfeb1a557067	\N	\N	\N	f	\N	MG	0a305767-0303-4ebe-8c09-ea7dcd0c48e1	2026-07-11 23:25:07.95	\N	\N	\N	PRESENCIAL	1	\N	Ana Costa	E01047	Clenio M. Mendes (TESTE INDIVIDUAL)	\N	\N	\N
45fd7af5-aeeb-474c-97e6-4625aeca099b	109	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	6126acba-75e1-4eaf-9d72-5282ce6474f6	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-08-14 23:40:56.547	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	07bdb154-1627-4ba2-924b-2a012c8cd808	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 00:43:24.868	-16.3682431	-46.8995417	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-14 15:00:00	\N	\N
09c36017-4c8e-447d-a8f1-bbc06b63c680	108	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04099	\N	TAUANY DE OLIVEIRA MENDES	38997248912	\N	Rua do Pico	21	\N	Primavera 5	Unaí	38612244	\N	\N	\N	1	ENTREGUE	2026-08-14 23:40:48.845	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	bcb80255-15fe-4601-ab1e-7a4ce50fb959	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 00:50:57.854	-16.3684838	-46.8998142	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-14 15:00:00	-16.3624902	-46.8978974
78437ecb-1f18-4c7d-bdab-bfc1a365a538	5	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	EVENTUAL	\N	\N	Teste Cancelar	38999555005	\N	Rua Tiradentes	10	\N	Centro	Unaí	\N	\N	\N	\N	1	CANCELADA	2026-07-11 23:30:06.548	0a305767-0303-4ebe-8c09-ea7dcd0c48e1	2026-07-11 23:30:50.792	0a305767-0303-4ebe-8c09-ea7dcd0c48e1	Cancelada no balcão	f	\N	MG	\N	\N	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
883b3cf2-8eeb-46ae-9a96-f178659f88e9	111	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A02027	\N	VALDINEI PAULO DE OLIVEIRA	38999609300	\N	FAZ. PICO, SN	\N	\N	ZONA RURAL	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-08-14 23:41:15.584	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	b97d170a-cbcd-429a-944f-34c7fbfb06b8	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 01:05:59.149	-16.3588599	-46.9048974	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-14 15:00:00	\N	\N
487a9b8b-dade-456a-b4c0-f46a81e657d5	121	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04721	\N	GABRIEL GOMES DE OLIVEIRA	38998643246	\N	Rua Maria Galdina	104	\N	Nova Canaã	Unaí	38616449	\N	\N	\N	1	ENTREGUE	2026-08-15 01:49:18.147	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	cdf05e2e-d13f-4b06-b171-7c8f738b9697	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 01:51:09.643	-16.3575000	-46.9061100	\N	PRESENCIAL	1	\N	Clenio Marcos mendss	\N	\N	2026-08-14 15:00:00	-16.3625107	-46.8979133
88cec66b-ad8d-47d0-b363-996726af626f	147	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A02027	\N	VALDINEI PAULO DE OLIVEIRA	38999609300	\N	FAZ. PICO, SN	\N	\N	ZONA RURAL	UNAI	38610000	\N	\N	\N	1	PENDENTE	2026-08-15 03:12:40.097	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	\N	\N	-16.3624969	-46.8979114	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-15 15:00:00	\N	\N
d2faaa20-4d91-40ad-8a80-00776161e140	1	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01981	\N	RENATA BORGES FREITAS CASTRO	38998665383	\N	Rua Jaçanã	10	\N	Divinéia	Unaí	38613545	\N	\N	\N	1	ENTREGUE	2026-07-13 19:54:42.5	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	d5865696-9fe0-4b4d-bace-49770ef8f453	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 18:39:44.955	\N	\N	\N	TELE_VENDA	1	\N	Renata	\N	\N	\N	\N	\N
fc644086-17cd-4ce8-b6a9-96517d6b2452	3	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	\N	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-13 19:55:40.332	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	454eb3b4-3578-4784-b098-4017007bc59e	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 18:40:18.507	\N	\N	\N	TELE_VENDA	1	\N	\N	\N	\N	\N	\N	\N
b0c241e7-13ab-4d5d-87ae-214d786ed51e	6	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01981	\N	RENATA BORGES FREITAS CASTRO	38998665383	\N	Rua Jaçanã	10	\N	Divinéia	Unaí	38613545	\N	\N	\N	1	ENTREGUE	2026-07-16 18:50:07.568	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	f	\N	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:05:52.454	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
390f735c-72e1-4a28-b77d-2c2b237cbfe4	16	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01939	\N	VILMAR JOSE DE CARVALHO	38999521480	\N	RUA 1 DE MAIO	185	\N	CACHOEIRA	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-16 19:03:32.398	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	90ee45fd-b264-4599-abb3-15df416aa2ad	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:16:44.952	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
4bf35988-c620-4f7c-a5b4-b97a4f77696a	13	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01019	\N	MARCIA DA SILVA COUTO	38991500476	\N	RUA LEAO LARA	149	\N	DIVINEIA	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-16 19:02:50.07	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	24e966b3-198b-4712-95fe-436d248bb277	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:17:15.814	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
2bc46547-019b-4a85-81af-9bc403b7eaf1	11	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01981	\N	RENATA BORGES FREITAS CASTRO	38998665383	\N	Rua Jaçanã	10	\N	Divinéia	Unaí	38613545	\N	\N	\N	1	ENTREGUE	2026-07-16 19:02:20.961	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	8202ca88-4558-4a8f-bd56-f7abe30416cc	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:17:31.226	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
6cbe4df2-7860-404d-858e-5aaf3edd05ee	7	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03355	\N	CACIA MENDES DA SILVA	38998332041	\N	RUA CAMILA P BROCHADO	85	\N	SANTA LUZIA	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-16 18:50:33.105	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	f	\N	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:05:52.454	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
dd63b899-2ee9-4006-89a8-8a71863d6f2c	8	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03113	\N	ADRIANA CAETANO VASCONCELOS	38999811390	\N	RUA SANTA LUZIA	1414	\N	N. SRA. AP.	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-16 18:51:11.734	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	f	\N	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:05:52.454	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
49552006-8e83-44ad-a41b-14cfeb38819d	9	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01019	\N	MARCIA DA SILVA COUTO	38991500476	\N	RUA LEAO LARA	149	\N	DIVINEIA	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-16 18:51:18.909	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	f	\N	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:05:52.454	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
5e5372d8-0613-4d53-bbee-3a24729610f7	10	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03422	\N	RAYDE AP.VIEIRA BORGES DE CASTRO	38998030288	\N	RUA OLAVO FRANCISCO DE OLIVEIRA	246	\N	VALE VERDE	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-16 18:51:28.078	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	f	\N	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:05:52.454	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
29f0f120-e276-40f5-8d0e-e7a3343f5854	24	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	IDENTIFICADO	E04099	\N	TAUANY DE OLIVEIRA MENDES	38997248912	\N	Rua do Pico	21	\N	Primavera 5	Unaí	38612244	\N	\N	\N	1	PENDENTE	2026-08-11 19:42:07.726	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	\N	\N	\N	f	\N	MG	\N	\N	-16.3542306	-46.8830291	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-11 15:00:00	\N	\N
3e2d75db-e010-4183-93c6-02539d91fcb4	24	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03990	\N	JEDSON BERTOLDO BRAGA	38998936645	\N	RUA AFONSO PENA	83	CS	OLARIA	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-16 19:13:27.113	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	0f380beb-92cd-4057-8ebb-3c004f08d136	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:22:56.512	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
8cd70ad9-d6ed-40fc-bebf-9464d611d389	157	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03113	\N	ADRIANA CAETANO VASCONCELOS	38999811390	\N	RUA SANTA LUZIA	1414	\N	N. SRA. AP.	UNAI	38610000	\N	\N	\N	1	PENDENTE	2026-08-15 03:14:21.511	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	\N	\N	-16.3556580	-46.8945957	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-15 15:00:00	\N	\N
f47d566e-6ca0-4f40-92e8-99c5484793e6	20	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03725	\N	RONI DE JESUS DE OLIVEIRA	38999602253	\N	RUA FREI  FRANCISCO	346	\N	NOVO HORIZONTE	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-16 19:11:51.645	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	11bc8e59-fde3-4c7a-8aa9-111e4df63338	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:23:44.635	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
10947a0a-53d2-4f85-b54d-a098b12fecc2	75	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04379	\N	STEFANY MENDES ASSIS	38998411997	\N	Avenida Castelo Branco	120	\N	Barroca	Unaí	38616072	\N	\N	\N	1	ENTREGUE	2026-07-26 13:14:04.336	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	35746e57-1918-4069-87c5-e49c19a45614	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-10 18:50:20.33	\N	\N	\N	PRESENCIAL	1	\N	Clenio	\N	\N	\N	\N	\N
8b28ebe4-7d81-445e-80e8-0fbdaac124cb	122	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	\N	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-08-15 02:03:41.163	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	e7b3dfba-c052-46e8-8aab-14de0873757c	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 02:09:29.057	-16.3682431	-46.8995417	\N	PRESENCIAL	1	\N	Clenio Marcos mendes	\N	\N	2026-08-14 15:00:00	\N	\N
f8000e6d-67d6-40e1-919e-32abdd2afac1	110	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04379	\N	STEFANY MENDES ASSIS	38998411997	\N	Avenida Castelo Branco	120	\N	Barroca	Unaí	38616072	\N	\N	\N	1	ENTREGUE	2026-08-14 23:41:07.043	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	b83d13a1-f0df-4d00-9952-03af6c51fe49	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 00:51:27.893	-16.3677285	-46.9001249	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-14 15:00:00	-16.3624902	-46.8978974
e14683b7-c195-4fb7-b2fc-3a82ba2c222b	140	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04848	\N	JULIANA DA SILVA MARQUES	8999023007	\N	Rua Lúcia de Souza Ribeiro	100	\N	Residencial Curva do Rio	Unaí	38620886	\N	\N	\N	1	ENTREGUE	2026-08-15 02:32:08.432	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	28669eaf-9d91-4d19-8fce-6d56f69b1345	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 12:14:48.36	-16.3628767	-46.8924130	\N	PRESENCIAL	1	\N	Clenio Marcos mendes	\N	\N	2026-08-14 15:00:00	-16.3625026	-46.8978650
850246fe-1abe-4ccd-b8d1-be8eb8c925cb	136	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A04379	\N	JOSE ANTONIO DE VASCONCELOS	38999651579	0a6610be-c562-4231-8c9a-dbcffd2b9b12	Rua Calixto Martins de Melo	500	\N	Centro	Unaí	38610039	\N	\N	\N	1	ENTREGUE	2026-08-15 02:31:31.035	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	3ec543a3-a91d-44d7-a067-0a084d75d88f	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 12:31:53.821	-16.3575000	-46.9061100	\N	PRESENCIAL	1	\N	Clenio.marcos.mendss	\N	\N	2026-08-14 15:00:00	-16.3625026	-46.8978650
c30f4efd-d429-40f7-868f-3f7f41e8427d	123	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A02027	\N	VALDINEI PAULO DE OLIVEIRA	38999609300	\N	FAZ. PICO, SN	\N	\N	ZONA RURAL	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-08-15 02:03:48.505	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	3bf341ce-d79a-4e54-ad16-45d7bdc49bf3	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 02:23:19.069	-16.3624969	-46.8979114	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-14 15:00:00	-16.3624897	-46.8978999
c60df025-bff9-49b6-a6eb-d6e063dd01e0	31	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01981	\N	RENATA BORGES FREITAS CASTRO	38998665383	\N	Rua Jaçanã	10	\N	Divinéia	Unaí	38613545	\N	\N	\N	1	ENTREGUE	2026-07-16 19:31:05.859	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	e7d2240d-2dcd-4c79-b1c9-f8d4a0defc9e	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:32:46.914	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
d2c94f2a-1acc-4a1e-abcc-0226894b603c	17	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E02681	\N	CELIA OLIVEIRA SOARES	3899135721	\N	RUA ABEL FERREIRA	26	\N	OLARIA	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-16 19:03:42.383	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	7605607e-cd18-426b-98d8-2aa1ec6ef78d	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:16:57.382	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
b48d04e9-69a4-4280-b31a-7e64657e0318	134	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04099	\N	TAUANY DE OLIVEIRA MENDES	38997248912	\N	Rua do Pico	21	\N	Primavera 5	Unaí	38612244	\N	\N	\N	1	ENTREGUE	2026-08-15 02:31:09.324	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	aaa873de-3424-424b-81e9-12fe9a1c6026	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 03:06:44.91	-16.3624902	-46.8978974	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-14 15:00:00	\N	\N
6e0ad0d4-7459-4f4c-84ab-351f038c3179	22	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01981	\N	RENATA BORGES FREITAS CASTRO	38998665383	\N	Rua Jaçanã	10	\N	Divinéia	Unaí	38613545	\N	\N	\N	1	ENTREGUE	2026-07-16 19:12:29.28	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	e4277879-1075-43f0-a23b-5f2292f94545	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:21:55.555	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
cd478c38-7342-41ae-a780-244594828912	23	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01981	\N	RENATA BORGES FREITAS CASTRO	38998665383	\N	Rua Jaçanã	10	\N	Divinéia	Unaí	38613545	\N	\N	\N	1	ENTREGUE	2026-07-16 19:12:46.549	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	da86918c-9a82-40a3-ac25-312f290ea9c5	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:22:08.997	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
548176ac-a22e-44f4-a393-9b89adcd9a64	25	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	IDENTIFICADO	E04379	\N	STEFANY MENDES ASSIS	38998411997	\N	Avenida Castelo Branco	120	\N	Barroca	Unaí	38616072	\N	\N	\N	1	PENDENTE	2026-08-11 19:42:18.458	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	\N	\N	\N	f	\N	MG	\N	\N	-16.3677285	-46.9001249	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-11 15:00:00	\N	\N
a74721eb-2379-4749-b1f4-0c060ef51bc4	84	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04379	\N	STEFANY MENDES ASSIS	38998411997	\N	Avenida Castelo Branco	120	\N	Barroca	Unaí	38616072	\N	\N	\N	1	ENTREGUE	2026-07-26 13:54:06.415	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	6eb145b9-f4eb-4598-bcda-e90af9c81b1b	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-10 21:13:57.746	\N	\N	\N	PRESENCIAL	1	\N	Clenio	\N	\N	\N	\N	\N
c51b8444-fca3-46e5-9bac-60bc16225a96	104	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04099	\N	TAUANY DE OLIVEIRA MENDES	38997248912	9d904bd7-2a59-4799-a702-7ff1abdf7edc	Rua do Pico	21	\N	Primavera 5	Unaí	38612244	\N	\N	\N	1	ENTREGUE	2026-08-11 19:43:19.879	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	91daad96-29d7-4a96-8f8f-b94211024100	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-11 20:14:42.165	-16.3542306	-46.8830291	\N	PRESENCIAL	1	\N	Bruno	\N	\N	2026-08-11 15:00:00	-16.3684932	-46.8997774
5ac7d4e2-1272-4aa8-a980-1022cc024909	86	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04379	\N	STEFANY MENDES ASSIS	38998411997	\N	Avenida São João	200	\N	Divinéia	Unaí	38613416	\N	\N	\N	1	ENTREGUE	2026-08-06 12:51:14.654	3d6f4527-e2ed-46a6-9955-7c770e8a107a	\N	\N	\N	f	\N	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-11 14:23:47.718	\N	\N	\N	PRESENCIAL	1	\N	Stefany	E01047	CLENIO MARCOS MENDES	\N	\N	\N
dd843869-1d2d-4ac8-bad5-940aa12fc7a5	105	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	6126acba-75e1-4eaf-9d72-5282ce6474f6	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-08-11 19:43:28.485	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	f6751959-6bce-48dd-96e0-2578c25d97f4	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-14 23:49:04.472	-16.3682431	-46.8995417	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-11 15:00:00	\N	\N
b7a20fb4-7481-4e49-a64d-424df392d4d0	34	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01981	\N	RENATA BORGES FREITAS CASTRO	38998665383	\N	Rua Jaçanã	10	\N	Divinéia	Unaí	38613545	\N	\N	\N	1	ENTREGUE	2026-07-16 19:39:19.213	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	f	\N	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:43:50.47	-16.3792538	-46.8925097	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	-16.3792538	-46.8925097
ccb1b764-2c6c-4379-91da-f1821afa7aad	12	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	IDENTIFICADO	\N	\N	TESTE r6 hoje	\N	\N	Rua Teste Roteiro 6	\N	\N	\N	Unaí	\N	\N	\N	\N	1	CANCELADA	2026-08-09 22:52:53.305	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	2026-08-09 22:57:51.57	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	Cancelada no balcão	f	\N	MG	\N	\N	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-09 15:00:00	\N	\N
65773a96-75de-4d84-a9b2-45217ffed0a1	112	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04099	\N	TAUANY DE OLIVEIRA MENDES	38997248912	\N	Rua do Pico	21	\N	Primavera 5	Unaí	38612244	\N	\N	\N	1	ENTREGUE	2026-08-15 00:34:47.721	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	10895d36-c012-4611-b45a-672d966de2b7	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 01:42:07.112	-16.3684838	-46.8998142	\N	PRESENCIAL	1	\N	Clenio.marcos me des	\N	\N	2026-08-14 15:00:00	\N	\N
c51093d5-1bb0-44e6-afdf-4065d9849630	115	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A04721	\N	MARIA NEUZA MENDES	38999625125	\N	FAZ. INHUMAS, SN	\N	\N	ZONA RURAL	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-08-15 00:36:52.547	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	c17be6a2-939c-44ed-ba8a-86aa00c319b0	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 01:01:55.456	-16.3628767	-46.8924130	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-14 15:00:00	\N	\N
a3751d89-b21c-4dc4-9fab-028fb3f5b121	124	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04099	\N	TAUANY DE OLIVEIRA MENDES	38997248912	\N	Rua do Pico	21	\N	Primavera 5	Unaí	38612244	\N	\N	\N	1	ENTREGUE	2026-08-15 02:03:56.704	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	c679b33e-cb00-416b-8474-d67964c050bd	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 02:14:02.317	-16.3684838	-46.8998142	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-14 15:00:00	\N	\N
46ab9cc8-dcb2-4fd9-878d-c0870ffe7af7	125	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A04379	\N	JOSE ANTONIO DE VASCONCELOS	38999651579	\N	Rua Calixto Martins de Melo	500	\N	Centro	Unaí	38610039	\N	\N	\N	1	ENTREGUE	2026-08-15 02:04:17.051	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	178476d0-7abc-4faa-a001-6426065eca6d	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 02:43:32.858	-16.3575000	-46.9061100	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-14 15:00:00	\N	\N
66262c01-bf3d-40a8-885f-29460fe127a3	144	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A02027	\N	VALDINEI PAULO DE OLIVEIRA	38999609300	\N	FAZ. PICO, SN	\N	\N	ZONA RURAL	UNAI	38610000	\N	\N	\N	1	PENDENTE	2026-08-15 02:50:17.508	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	\N	\N	-16.3624969	-46.8979114	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-14 15:00:00	\N	\N
af7ab49f-3ec3-4b8d-b640-1a2c754fe221	74	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04379	\N	STEFANY MENDES ASSIS	38998411997	\N	Avenida Castelo Branco	120	\N	Barroca	Unaí	38616072	\N	\N	\N	1	ENTREGUE	2026-07-26 13:13:59.394	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-06 13:10:32.556	\N	\N	\N	PRESENCIAL	1	\N	Stefany	\N	\N	\N	\N	\N
957a0b49-a3bc-4538-b391-1d72d4eb185d	10	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	EVENTUAL	\N	\N	TESTE p2 hoje	\N	\N	Rua A	\N	\N	\N	\N	\N	\N	\N	\N	1	CANCELADA	2026-08-09 18:59:34.793	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	2026-08-09 19:00:09.641	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	Registro de teste do ponto 2 — removido	f	\N	\N	\N	\N	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-09 15:00:00	\N	\N
80995bc4-4e40-43a2-8dd3-0d7e8b16f5b7	13	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	IDENTIFICADO	\N	\N	TESTE r6 dia 15	\N	\N	Rua Teste Roteiro 6 B	\N	\N	\N	Unaí	\N	\N	\N	\N	1	CANCELADA	2026-08-09 22:53:31.446	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	2026-08-09 22:57:27.193	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	Cancelada no balcão	f	\N	MG	\N	\N	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-09 15:00:00	\N	\N
09ad46a9-9dcd-438d-ac91-04ed340f8c53	9	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	IDENTIFICADO	E04848	\N	JULIANA DA SILVA MARQUES	8999023007	1be1419a-c879-4cfd-8192-2efa5c77d8a0	Rua Lúcia de Souza Ribeiro	100	\N	Residencial Curva do Rio	Unaí	38620886	\N	\N	\N	1	ENTREGUE	2026-07-29 19:41:37.057	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	\N	\N	\N	f	\N	MG	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	2026-08-10 00:32:57.32	\N	\N	\N	PRESENCIAL	1	\N	Juliana da Silva Marques	\N	\N	\N	\N	\N
5408ea27-3f82-4b67-8afd-12378096f565	14	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	IDENTIFICADO	\N	\N	Cliente Teste Roteiro 8 - B1	\N	\N	Rua Teste Roteiro 8, 100	\N	\N	\N	Unaí	\N	\N	\N	Roteiro 8 - entrega teste B1	1	CANCELADA	2026-08-10 00:25:14.53	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	2026-08-10 00:50:21.24	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	Cancelada no balcão	f	\N	MG	\N	\N	\N	\N	\N	PRESENCIAL	2	[{"motivo": null, "dataHora": null, "tentativa": 1, "baixadoPorId": null, "viagemNumero": 41}]	\N	\N	\N	2026-08-09 15:00:00	\N	\N
890dec4e-d5b9-4c88-a526-92b21f678b35	16	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	EVENTUAL	\N	\N	Cliente Teste Roteiro 8 - A2-1	\N	\N	Rua Teste Roteiro 8	300	\N	\N	Unaí	\N	\N	\N	\N	1	CANCELADA	2026-08-10 00:45:12.2	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	2026-08-10 00:51:06.203	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	Cancelada no balcão	f	\N	MG	\N	\N	\N	\N	\N	PRESENCIAL	2	[{"motivo": null, "dataHora": null, "tentativa": 1, "baixadoPorId": null, "viagemNumero": 40}]	\N	\N	\N	2026-08-09 15:00:00	\N	\N
2d1653a7-2b96-4349-93b8-c4016d331411	17	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	EVENTUAL	\N	\N	Cliente Teste Roteiro 8 - A2-2	\N	\N	Rua Teste Roteiro 8	400	\N	\N	Unaí	\N	\N	\N	\N	1	CANCELADA	2026-08-10 00:45:20.787	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	2026-08-10 00:51:26.806	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	Cancelada no balcão	f	\N	MG	\N	\N	\N	\N	\N	PRESENCIAL	2	[{"motivo": null, "dataHora": null, "tentativa": 1, "baixadoPorId": null, "viagemNumero": 40}]	\N	\N	\N	2026-08-09 15:00:00	\N	\N
78c03746-9731-4104-8c3e-1f951f750c30	76	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03156	\N	ELENISA PETTINE	38999480178	524d982c-1941-4921-b556-60ae73aee6ed	Avenida Castelo Branco	34	AP 101	Barroca	Unaí	38616072	\N	\N	\N	1	ENTREGUE	2026-07-26 13:28:58.567	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	32d469bc-75dd-4b05-88cf-28fd03f8937a	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-10 18:20:50.858	-16.3673546	-46.9008669	\N	PRESENCIAL	1	\N	Clenio	\N	\N	\N	-16.3673546	-46.9008669
1dfa46c4-5395-48a3-8cad-0ddebf0f176f	26	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	\N	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	38610000	\N	\N	\N	1	PENDENTE	2026-08-11 19:42:26.565	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	\N	\N	\N	f	\N	MG	\N	\N	-16.3593730	-46.9021793	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-11 15:00:00	\N	\N
26772015-ee1a-4d17-83e8-a47541335ae7	27	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	IDENTIFICADO	A02027	\N	VALDINEI PAULO DE OLIVEIRA	38999609300	633453e6-59a9-443b-8ce7-06a1ce070460	Rua Calixto Martins de Melo	500	\N	Centro	Unaí	38610039	\N	\N	\N	1	PENDENTE	2026-08-11 19:42:35.264	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	\N	\N	\N	f	\N	MG	\N	\N	-16.3575000	-46.9061100	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-11 15:00:00	\N	\N
383de6c8-b3e1-4760-a3d8-0a9de2f3dabb	106	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04379	\N	STEFANY MENDES ASSIS	38998411997	45321b9c-2b18-4f4b-b56f-acb1b8187fbf	Avenida Castelo Branco	200	\N	Barroca	Unaí	38613416	\N	\N	\N	1	ENTREGUE	2026-08-11 19:43:35.61	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	1a0df7fd-76c4-438c-9ad5-6e486bcf7848	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-11 19:47:43.239	-16.3575000	-46.9061100	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-11 15:00:00	-16.3684744	-46.8998415
7c9fc081-2355-4e47-840f-aae79ab4516f	39	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01981	\N	RENATA BORGES FREITAS CASTRO	38998665383	\N	Rua Jaçanã	10	\N	Divinéia	Unaí	38613545	\N	\N	\N	1	ENTREGUE	2026-07-16 19:44:13.786	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	3c9cdbea-9d77-4d41-9456-7eab7147e58d	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-16 19:48:53.982	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
0d94fd5f-e85e-4326-8d91-22deb6fad05c	40	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A00901	\N	ANGELO PEREIRA DE FREITAS	38999469637	\N	FAZ. GLEBA DO GADO BRAVO PARCELA	247	\N	ZONA RURAL	DOM BOSCO	38654000	\N	\N	\N	1	ENTREGUE	2026-07-16 19:44:23.581	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	6a79876e-e4d5-4570-a436-e0aabfddd977	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-16 19:49:23.817	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
b95761e9-3091-4214-ba46-792e52758888	46	8e843247-5b6b-4404-ba62-a74b84ccb287	EVENTUAL	\N	\N	Cliente Sem Origem	38911112222	\N	Rua Sem Origem	10	\N	\N	Unaí	\N	\N	\N	Editado via teste E2a	1	ENTREGUE	2026-07-18 23:40:44.958	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	f	\N	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-18 23:50:50.294	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
ef96c577-7711-4bf1-9346-95bf963a2a38	113	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A02027	\N	VALDINEI PAULO DE OLIVEIRA	38999609300	\N	FAZ. PICO, SN	\N	\N	ZONA RURAL	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-08-15 00:35:26.097	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	d683aed5-fec5-49d8-a149-588f25d948a6	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 01:06:37.126	-16.3588599	-46.9048974	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-14 15:00:00	\N	\N
7dccc911-fcaf-463f-b953-99641242017f	114	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A02027	\N	VALDINEI PAULO DE OLIVEIRA	38999609300	\N	FAZ. PICO, SN	\N	\N	ZONA RURAL	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-08-15 00:36:36.624	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	64170426-8fc0-46b1-ac3b-efd3a87a5ea2	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 01:16:55.478	-16.3588599	-46.9048974	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-14 15:00:00	-16.3624969	-46.8979114
37fc47ae-a1e4-4aea-9b4d-2cae0989956c	126	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A04721	\N	MARIA NEUZA MENDES	38999625125	ec5da9bd-c0b1-473e-9be4-dd9e8e67e45f	CHACARA DO ZE GALINHA	S/N	DEPOIS DA PORTEIRA	ZONA RURAL	Unaí	\N	IGREJA AZUL	\N	\N	1	ENTREGUE	2026-08-15 02:04:32.961	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	2ca63792-3fbc-45b6-b905-57c57bf14e35	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 02:12:19.774	-16.3628767	-46.8924130	\N	PRESENCIAL	1	\N	Clenio Marcos mendss	\N	\N	2026-08-14 15:00:00	-16.3624910	-46.8978961
c6f274a3-697b-43b7-a92f-20a1c1b5892a	38	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	\N	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-16 19:44:06.446	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	0d623ee3-2a44-4d07-b5fc-8dfc2326f163	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-16 19:48:01.214	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
7d449f25-29f9-4b42-a872-3e5b801dfde0	42	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01939	\N	VILMAR JOSE DE CARVALHO	38999521480	\N	RUA 1 DE MAIO	185	\N	CACHOEIRA	UNAI	38610000	\N	\N	\N	1	NAO_ENTREGUE	2026-07-16 19:44:40.806	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	f	\N	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-16 19:48:25.592	\N	\N	Nao estava em casa	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
7335841b-ee39-4659-9fc8-a51ec29e7061	41	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04489	\N	MARILIA ABADIA PEREIRA ARAUJO	38999838637	\N	Rua Juriti	89	\N	Floresta	Unaí	38613145	\N	\N	\N	1	ENTREGUE	2026-07-16 19:44:32.192	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	0e144496-62c7-4e7b-b468-06bdcea4030e	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-16 19:48:40.021	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
c966f53b-7362-47fb-a670-b58aae199b1a	4	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	RECORRENTE_LOCAL	\N	\N	Pedro Almeida	38999444004	\N	Rua Rio Branco	78	\N	Cohab	Unaí	\N	\N	\N	\N	1	EM_VIAGEM	2026-07-11 23:18:03.298	a33b01ad-75c5-470a-ad1c-cfeb1a557067	\N	\N	\N	f	\N	MG	\N	\N	-16.3628767	-46.8924130	\N	PRESENCIAL	2	[{"motivo": "Cliente ausente no momento da entrega", "dataHora": "2026-07-11T23:25:40.856Z", "tentativa": 1, "baixadoPorId": "0a305767-0303-4ebe-8c09-ea7dcd0c48e1", "viagemNumero": 16}]	\N	E01047	Clenio M. Mendes (TESTE INDIVIDUAL)	\N	\N	\N
ceedca50-0189-43fb-a59f-b52ed8cde66e	6	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	\N	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	38610000	\N	\N	\N	1	EM_VIAGEM	2026-07-17 13:48:07.897	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	\N	\N	\N	f	\N	MG	\N	\N	-16.3593730	-46.9021793	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
327a1348-056d-4d41-ae63-2051282835f7	7	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	IDENTIFICADO	E04848	\N	JULIANA DA SILVA MARQUES	8999023007	\N	Rua Lúcia de Souza Ribeiro	100	\N	Residencial Curva do Rio	Unaí	38620886	\N	\N	\N	1	EM_VIAGEM	2026-07-17 13:48:17.204	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	\N	\N	\N	f	\N	MG	\N	\N	-16.3628767	-46.8924130	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
fa89cf04-695b-4aee-8235-893df732d237	45	8e843247-5b6b-4404-ba62-a74b84ccb287	EVENTUAL	\N	\N	Joao Eventual Teste	38977665544	\N	Rua Eventual Unica	50	\N	\N	Unaí	\N	\N	\N	\N	1	CANCELADA	2026-07-18 23:39:56.496	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-18 23:44:16.969	f5519586-dae7-40c6-8d85-fb3195636e5a	Cancelada no balcão	f	\N	MG	\N	\N	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
986068eb-e4e3-435e-b308-5cfa5d0787f5	44	8e843247-5b6b-4404-ba62-a74b84ccb287	RECORRENTE_LOCAL	\N	\N	Maria	38999881122	\N	Rua Teste Recorrente	100	\N	Centro	Unaí	\N	\N	\N	\N	1	ENTREGUE	2026-07-18 23:39:15.574	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	f	\N	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-18 23:49:02.372	\N	\N	\N	PRESENCIAL	1	\N	Maria Recebedora	\N	\N	\N	\N	\N
84c646bf-e023-41fb-9f66-3ad9af655b3e	48	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04848	\N	JULIANA DA SILVA MARQUES	8999023007	\N	Rua Lúcia de Souza Ribeiro	100	\N	Residencial Curva do Rio	Unaí	38620886	\N	\N	\N	1	ENTREGUE	2026-07-25 00:31:56.928	3d6f4527-e2ed-46a6-9955-7c770e8a107a	\N	\N	\N	t	d5b015de-fc29-46a3-a65d-c86a26d6a3c1	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-25 01:45:17.082	\N	\N	\N	PRESENCIAL	1	\N	\N	E01047	CLENIO MARCOS MENDES	\N	\N	\N
f7cddb93-b519-4ac3-88ed-587956f192d3	53	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A04721	\N	MARIA NEUZA MENDES	38999625125	74b199b1-18e5-4d4a-acb4-e9170e917029	Rua Cachoeira	120	\N	Centro	Unaí	38610051	\N	\N	\N	1	ENTREGUE	2026-07-25 02:15:58.73	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	7482a039-6f09-4066-a320-4e1781f022d5	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-25 22:45:02.753	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
fefbccac-113b-477b-aece-dc9bf1d30c48	57	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03113	\N	ADRIANA CAETANO VASCONCELOS	38999811390	\N	RUA SANTA LUZIA	1414	\N	N. SRA. AP.	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-25 02:16:58.372	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	dc30fe83-8329-4aa0-ac90-2ef15902c0c9	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-25 22:45:22.686	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
653d0e21-b8ed-421a-9ff3-08cd62114222	20	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	IDENTIFICADO	A02027	\N	VALDINEI PAULO DE OLIVEIRA	38999609300	\N	Rua Calixto Martins de Melo	500	\N	Centro	Unaí	38610039	\N	\N	\N	1	PENDENTE	2026-08-10 18:04:05.483	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	\N	\N	\N	f	\N	MG	\N	\N	-16.3575000	-46.9061100	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-10 15:00:00	\N	\N
da2b46e7-55ec-4634-a288-7b6fd1a63270	145	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04848	\N	JULIANA DA SILVA MARQUES	8999023007	\N	Rua Lúcia de Souza Ribeiro	100	\N	Residencial Curva do Rio	Unaí	38620886	\N	\N	\N	1	EM_VIAGEM	2026-08-15 02:50:27.229	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	\N	\N	-16.3625062	-46.8979151	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-14 15:00:00	\N	\N
6beedf77-7a41-4d53-9149-8139c4705948	141	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03113	\N	ADRIANA CAETANO VASCONCELOS	38999811390	\N	RUA SANTA LUZIA	1414	\N	N. SRA. AP.	UNAI	38610000	\N	\N	\N	1	PENDENTE	2026-08-15 02:32:22.747	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	\N	\N	-16.3556580	-46.8945957	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-14 15:00:00	\N	\N
3193169c-ca33-47c8-b8f2-13f27fc9d66d	81	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04379	\N	STEFANY MENDES ASSIS	38998411997	\N	Avenida Castelo Branco	120	\N	Barroca	Unaí	38616072	\N	\N	\N	1	ENTREGUE	2026-07-26 13:46:19.073	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	7fc2ad58-d5f2-4bb2-895a-8e3992a4520b	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-10 21:12:55.992	\N	\N	\N	PRESENCIAL	1	\N	Clenio	\N	\N	\N	\N	\N
29c71160-555b-4589-8104-f634ab6c2656	61	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03838	\N	RAFAEL CAETANO COSTA	38999053620	\N	RUA JOZINDA DOS SANTOS CALDEIRA	641	CS	SAGRADA FAMILIA	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-25 02:59:10.834	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	f5291566-2e89-4a0b-b6f3-85fd3c932929	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-25 23:31:02.269	\N	\N	\N	PRESENCIAL	1	\N	Clejk	\N	\N	\N	\N	\N
edb14c3c-7cee-41ff-82f6-2008cced4150	60	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A04721	\N	MARIA NEUZA MENDES	38999625125	\N	FAZ. INHUMAS, SN	\N	\N	ZONA RURAL	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-25 02:59:02.939	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-25 23:50:38.458	\N	\N	\N	PRESENCIAL	1	\N	Clenio	\N	\N	\N	\N	\N
c919c755-9c4d-4cbf-b143-7db93c4a7e2e	116	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	\N	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-08-15 00:55:08.098	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	b337cb9b-8379-4b07-9359-547e4bc9b7c1	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 01:17:55.951	-16.3682431	-46.8995417	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-14 15:00:00	-16.3624969	-46.8979114
4b59e26c-d53b-4ce2-ad60-c3a9a1995b8c	56	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03831	\N	ADRIEL LEMES GRACIANO	38998481047	\N	AV DELVITO ALVES DA SILVA	215	AP 204	DIVINEIA	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-25 02:16:38.968	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	b46e21c9-f5ea-4521-a752-1bd0fc3bb95b	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-25 22:43:28.978	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
d345fdae-2c60-4265-9505-e077786bc755	117	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	\N	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-08-15 00:56:05.551	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	c6d94da0-564b-4dd7-8b95-51b73ec3a9b5	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 01:58:49.439	-16.3682431	-46.8995417	\N	PRESENCIAL	1	\N	Clenuo	\N	\N	2026-08-14 15:00:00	\N	\N
0845c44e-e6a8-42f6-b7b2-3e2923b799a2	52	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A02027	\N	VALDINEI PAULO DE OLIVEIRA	38999609300	db42940e-ee9d-4b0f-acf1-eb4ebc27a8a0	Rua Calixto Martins de Melo	2027	\N	Centro	Unaí	38610039	\N	\N	\N	1	ENTREGUE	2026-07-25 02:15:49.691	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	400432bd-d546-4fe7-b392-37e65f7fa1a4	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-25 22:44:02.615	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
b489e51f-fe3b-4146-a3cb-e2068e6363ed	54	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A05762	\N	CLENIO MARCOS MENDES	38999625125	\N	Rua Eduardo Rodrigues Barbosa	475	\N	Centro	Unaí	38610061	\N	\N	\N	1	ENTREGUE	2026-07-25 02:16:18.547	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	8973b355-983c-4138-92c9-8f50defa2d49	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-25 22:44:46.499	\N	\N	\N	PRESENCIAL	1	\N	Clenio	\N	\N	\N	\N	\N
33187004-e42d-463c-af4d-22f86c1aed91	127	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	\N	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-08-15 02:17:54.946	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	e09e4907-d3b9-4038-bfeb-d0c14d2aea19	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 02:23:50.8	-16.3682431	-46.8995417	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-14 15:00:00	-16.3624897	-46.8978999
ee3f3688-3e14-42b7-8b93-a2f1f7fa7f64	77	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04379	\N	STEFANY MENDES ASSIS	38998411997	\N	Avenida Castelo Branco	120	\N	Barroca	Unaí	38616072	\N	\N	\N	1	ENTREGUE	2026-07-26 13:29:06.233	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	eff7ba7e-f159-4cc0-85a4-4d7c3bc1a868	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-10 19:33:48.331	-16.3685815	-46.8998053	\N	PRESENCIAL	1	\N	Clenio	\N	\N	\N	-16.3685815	-46.8998053
b08fb387-c323-4ac9-80c6-423f0d06533b	146	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04099	\N	TAUANY DE OLIVEIRA MENDES	38997248912	\N	Rua do Pico	21	\N	Primavera 5	Unaí	38612244	\N	\N	\N	1	PENDENTE	2026-08-15 02:50:34.211	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	\N	\N	-16.3624902	-46.8978974	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-14 15:00:00	\N	\N
8572d52f-2ee6-476e-a3fc-343db1f8abb2	148	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04848	\N	JULIANA DA SILVA MARQUES	8999023007	\N	Rua Lúcia de Souza Ribeiro	100	\N	Residencial Curva do Rio	Unaí	38620886	\N	\N	\N	1	PENDENTE	2026-08-15 03:12:48.907	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	\N	\N	-16.3628767	-46.8924130	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-15 15:00:00	\N	\N
2f5295c0-0cdf-45ec-9d1d-014730e820b9	149	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04099	\N	TAUANY DE OLIVEIRA MENDES	38997248912	\N	Rua do Pico	21	\N	Primavera 5	Unaí	38612244	\N	\N	\N	1	PENDENTE	2026-08-15 03:12:56.822	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	\N	\N	-16.3624902	-46.8978974	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-15 15:00:00	\N	\N
c6c6d36e-62fb-4133-900e-4531f59cf9f0	152	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A02027	\N	VALDINEI PAULO DE OLIVEIRA	38999609300	\N	FAZ. PICO, SN	\N	\N	ZONA RURAL	UNAI	38610000	\N	\N	\N	1	PENDENTE	2026-08-15 03:13:27.447	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	\N	\N	-16.3624969	-46.8979114	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-15 15:00:00	\N	\N
0b661b73-7740-492c-be50-09804fc81c1f	8	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	IDENTIFICADO	A04721	\N	MARIA NEUZA MENDES	38999625125	\N	Rua Calixto Martins de Melo	100	\N	Centro	Unaí	38610039	\N	\N	\N	1	ENTREGUE	2026-07-29 19:41:17.207	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	\N	\N	\N	f	\N	MG	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	2026-08-10 00:32:26.502	\N	\N	\N	PRESENCIAL	1	\N	Maria Neuza Mendes	\N	\N	\N	\N	\N
18110a30-f211-446e-b3c7-75607d617545	11	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	EVENTUAL	\N	\N	TESTE p2 dia 15	\N	\N	Rua B	\N	\N	\N	\N	\N	\N	\N	\N	1	CANCELADA	2026-08-09 18:59:34.822	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	2026-08-09 19:00:09.929	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	Registro de teste do ponto 2 — removido	f	\N	\N	\N	\N	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-15 15:00:00	\N	\N
ca454d9e-a036-436d-b7c0-9d3e67a75c07	69	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03113	\N	ADRIANA CAETANO VASCONCELOS	38999811390	\N	RUA SANTA LUZIA	1414	\N	N. SRA. AP.	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-26 13:12:24.089	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	52800002-bf28-4dd1-8c15-52413606b455	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-10 18:17:58.847	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	\N	\N
a4f6f477-d24f-4735-86eb-f1b355222e5e	15	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	IDENTIFICADO	\N	\N	Cliente Teste Roteiro 8 - B2	\N	\N	Rua Teste Roteiro 8, 200	\N	\N	\N	Unaí	\N	\N	\N	Roteiro 8 - entrega teste B2	1	CANCELADA	2026-08-10 00:25:24.008	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	2026-08-10 00:50:48.125	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	Cancelada no balcão	f	\N	MG	\N	\N	\N	\N	\N	PRESENCIAL	2	[{"motivo": null, "dataHora": null, "tentativa": 1, "baixadoPorId": null, "viagemNumero": 41}]	\N	\N	\N	2026-08-09 15:00:00	\N	\N
02df40ea-0de3-43f8-90eb-ff0d04501539	80	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04379	\N	STEFANY MENDES ASSIS	38998411997	\N	Avenida Castelo Branco	120	\N	Barroca	Unaí	38616072	\N	\N	\N	1	ENTREGUE	2026-07-26 13:45:37.828	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	1326b754-95cd-464e-b49f-1f706ce292e3	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-10 20:43:42.082	\N	\N	\N	PRESENCIAL	1	\N	Clenio	\N	\N	\N	\N	\N
dd82218c-f4f3-4ba0-8fc0-57c1f8600ff8	118	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A02027	\N	VALDINEI PAULO DE OLIVEIRA	38999609300	\N	FAZ. PICO, SN	\N	\N	ZONA RURAL	UNAI	38610000	\N	\N	faltou um peça	1	ENTREGUE	2026-08-15 01:35:51.302	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	479c8044-5602-4d02-baee-843d562a6923	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 01:37:43.6	-16.3588599	-46.9048974	\N	PRESENCIAL	1	\N	Clenio Marcos mendes	\N	\N	2026-08-14 15:00:00	-16.3625107	-46.8979133
8147d5b0-3adb-4bec-b1d4-036a1ffff785	91	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01044	\N	ORLANDO SEBASTIAO COSTA	3899617600	\N	RUA CANABRAVA	1416	\N	CACHOEIRA	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-08-11 11:40:21.277	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	3d10c97f-8ff5-427c-b16c-d28205fe4e4e	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-11 14:25:05.212	-16.3684316	-46.8998347	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-11 15:00:00	-16.3684316	-46.8998347
e0527e56-ceff-4589-b09e-9e3fb91f3780	129	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A02027	\N	VALDINEI PAULO DE OLIVEIRA	38999609300	\N	FAZ. PICO, SN	\N	\N	ZONA RURAL	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-08-15 02:18:10.338	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	44e6b28b-2de7-49ac-a019-97732dfbe451	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 02:22:40.897	-16.3624969	-46.8979114	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-14 15:00:00	\N	\N
0a81ee73-f76a-4d78-8037-a7013f55f228	83	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04379	\N	STEFANY MENDES ASSIS	38998411997	\N	AV CASTELO BRANCO	120	\N	BARROCA	UNAI	38616072	\N	\N	\N	1	ENTREGUE	2026-07-26 13:53:24.3	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-11 14:24:15.986	\N	\N	\N	PRESENCIAL	1	\N	Stefany	\N	\N	\N	\N	\N
ac6848b3-edf7-4d39-a8f0-b06fd061548e	131	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04099	\N	TAUANY DE OLIVEIRA MENDES	38997248912	\N	Rua do Pico	21	\N	Primavera 5	Unaí	38612244	\N	\N	\N	1	ENTREGUE	2026-08-15 02:18:35.975	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	964c5ac2-6d9a-4ba4-ad6c-3ed105004671	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 02:24:20.782	-16.3684838	-46.8998142	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-14 15:00:00	-16.3624897	-46.8978999
efcecc81-544a-4d12-8b02-68c0d4cabd43	90	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04848	\N	JULIANA DA SILVA MARQUES	8999023007	\N	Rua Lúcia de Souza Ribeiro	100	\N	Residencial Curva do Rio	Unaí	38620886	\N	\N	\N	1	ENTREGUE	2026-08-11 11:39:40.401	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	1bab4efd-f60e-4289-bfd3-ce0a971c52d0	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-11 14:26:47.856	-16.3684316	-46.8998347	\N	PRESENCIAL	1	\N	Juliana	\N	\N	2026-08-11 15:00:00	-16.3684316	-46.8998347
135dded3-0f5f-4e5f-918a-7358ae9c210e	128	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04099	\N	TAUANY DE OLIVEIRA MENDES	38997248912	\N	Rua do Pico	21	\N	Primavera 5	Unaí	38612244	\N	\N	\N	1	ENTREGUE	2026-08-15 02:18:01.043	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	df5506f8-abf9-4ab7-bdf8-bafd63a3916c	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 02:42:58.433	-16.3624902	-46.8978974	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-14 15:00:00	\N	\N
9860fd6d-045a-4ce8-9db2-f495ac95b401	99	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A02027	\N	VALDINEI PAULO DE OLIVEIRA	38999609300	db42940e-ee9d-4b0f-acf1-eb4ebc27a8a0	Rua Calixto Martins de Melo	2027	\N	Centro	Unaí	38610039	\N	\N	\N	1	ENTREGUE	2026-08-11 14:29:20.482	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	33e11b40-bb14-4f82-bb36-97e41febde56	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-11 14:35:56.211	\N	\N	\N	PRESENCIAL	1	\N	Valdinei	\N	\N	2026-08-11 15:00:00	\N	\N
4b9012ea-99a0-411c-9329-a218a9a0409b	102	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04060	\N	THIAGO MACEDO ROCHA	38999777340	\N	Avenida Frei Anselmo	125	BLBAP08	Divinéia	Unaí	38613431	\N	\N	\N	1	ENTREGUE	2026-08-11 14:50:29.618	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	dc6e9695-966f-4295-ac17-30951775b5e8	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-11 14:54:18.374	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-11 15:00:00	\N	\N
b89212e0-c6fa-425f-940c-6fe565d1472d	62	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	\N	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-25 23:28:11.323	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-25 23:51:02.982	-16.3624682	-46.8979026	\N	PRESENCIAL	1	\N	Clenio	\N	\N	\N	-16.3624682	-46.8979026
e9cfd0bf-55d0-469c-9d30-c36ddca12197	29	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	\N	\N	ANGELO PEREIRA	38999411380	\N	Rua Canabrava	1457	\N	Cachoeira	Unaí	38610250	\N	\N	\N	1	ENTREGUE	2026-07-16 19:27:22.564	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	f	\N	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:30:56.697	-16.3572994	-46.8928211	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	-16.3572994	-46.8928211
fcd8b0cb-ee5a-4ee9-8011-62e4d725c507	26	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01981	\N	RENATA BORGES FREITAS CASTRO	38998665383	\N	Rua Jaçanã	10	\N	Divinéia	Unaí	38613545	\N	\N	\N	3	ENTREGUE	2026-07-16 19:25:28.781	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	f	\N	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:30:56.697	-16.3792538	-46.8925097	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	-16.3792538	-46.8925097
9eca594c-5e2e-45b7-987b-c7852253e01b	5	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01981	\N	RENATA BORGES FREITAS CASTRO	38998665383	\N	Rua Jaçanã	10	\N	Divinéia	Unaí	38613545	\N	\N	\N	1	ENTREGUE	2026-07-13 19:57:24.918	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	ad97505c-a8b2-4e79-887b-1abb7426697d	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 18:41:43.531	-16.3682431	-46.8995417	\N	TELE_VENDA	1	\N	\N	\N	\N	\N	-16.3682431	-46.8995417
9deb4885-6725-4272-8b65-7b86573ac569	32	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03113	\N	ADRIANA CAETANO VASCONCELOS	38999811390	\N	RUA SANTA LUZIA	1414	\N	N. SRA. AP.	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-16 19:31:13.186	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	7670a68b-5a72-4565-8c7c-200758f99b60	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:33:45.084	-16.3682138	-46.8995791	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	-16.3682138	-46.8995791
21469954-9602-483e-b1f7-58f51ca5f277	97	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04099	\N	TAUANY DE OLIVEIRA MENDES	38997248912	\N	Rua do Pico	21	\N	Primavera 5	Unaí	38612244	\N	\N	\N	1	ENTREGUE	2026-08-11 14:28:47.431	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	bf323046-65b8-49fd-a9b5-9122aeddc787	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-11 14:37:30.384	-16.3684316	-46.8998347	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-11 15:00:00	-16.3684316	-46.8998347
7a02ddd9-50af-4b9c-bff1-f00c5d9b7305	96	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04379	\N	STEFANY MENDES ASSIS	38998411997	45321b9c-2b18-4f4b-b56f-acb1b8187fbf	Avenida Castelo Branco	200	\N	Barroca	Unaí	38613416	\N	\N	\N	1	ENTREGUE	2026-08-11 14:28:38.926	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	95461397-5b6f-42d9-83e3-7283d99b8378	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-11 14:54:32.466	-16.3684939	-46.8998577	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-11 15:00:00	-16.3684939	-46.8998577
9a021167-d2c1-466d-8d5c-f96960d165c2	150	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A02027	\N	VALDINEI PAULO DE OLIVEIRA	38999609300	\N	FAZ. PICO, SN	\N	\N	ZONA RURAL	UNAI	38610000	\N	\N	\N	1	PENDENTE	2026-08-15 03:13:03.455	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	\N	\N	-16.3624969	-46.8979114	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-15 15:00:00	\N	\N
a0a18d28-7d3e-4f2e-9694-3f7843dd9cc2	19	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	IDENTIFICADO	E04848	\N	JULIANA DA SILVA MARQUES	8999023007	1be1419a-c879-4cfd-8192-2efa5c77d8a0	Rua Lúcia de Souza Ribeiro	100	\N	Residencial Curva do Rio	Unaí	38620886	\N	\N	\N	1	PENDENTE	2026-08-10 18:03:39.441	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	\N	\N	\N	f	\N	MG	\N	\N	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-10 15:00:00	\N	\N
53f30e8c-300b-4f70-aa18-4960b5e4226b	87	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	\N	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-08-06 12:51:50.337	3d6f4527-e2ed-46a6-9955-7c770e8a107a	\N	\N	\N	t	4876c66d-1d51-4a02-8c08-a31edb36c6d8	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-10 18:17:43.057	\N	\N	\N	PRESENCIAL	1	\N	\N	E01047	CLENIO MARCOS MENDES	\N	\N	\N
6e21851a-eab0-4c8d-86ed-3eb370bcb235	88	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A04721	\N	MARIA NEUZA MENDES	38999625125	\N	CHACARA DO ZE GALINHA	S/N	DEPOIS DA PORTEIRA	ZONA RURAL	Unaí	\N	IGREJA AZUL	\N	\N	1	ENTREGUE	2026-08-06 12:54:21.757	3d6f4527-e2ed-46a6-9955-7c770e8a107a	\N	\N	\N	t	5ad541e3-2f78-42af-b080-fbb0c0bcf8ec	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-10 18:31:03.019	\N	\N	\N	PRESENCIAL	1	\N	Clenio	E01047	CLENIO MARCOS MENDES	\N	\N	\N
2ed6a94e-97f3-4337-ba6c-48dc92733f52	78	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04379	\N	STEFANY MENDES ASSIS	38998411997	\N	AV CASTELO BRANCO	120	\N	BARROCA	UNAI	38616072	\N	\N	\N	1	ENTREGUE	2026-07-26 13:30:05.84	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	befb8317-c618-441a-8760-d611616e3da0	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-10 20:44:41.066	\N	\N	\N	PRESENCIAL	1	\N	Clenio	\N	\N	\N	\N	\N
ef23d77c-9eaf-41fa-bbd2-246a7a8be372	92	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04879	\N	SELMO BARBOSA DE BRITO	38999241072	\N	Rua Ari Lacerda	165	\N	Novo Horizonte	Unaí	38616502	\N	\N	\N	2	ENTREGUE	2026-08-11 14:21:07.575	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-11 19:48:04.352	-16.3575000	-46.9061100	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-11 15:00:00	\N	\N
2e6b9335-958e-4423-be45-4b8634890ca4	158	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04848	\N	JULIANA DA SILVA MARQUES	8999023007	\N	Rua Lúcia de Souza Ribeiro	100	\N	Residencial Curva do Rio	Unaí	38620886	\N	\N	\N	1	CANCELADA	2026-08-15 03:14:39.107	0117ccd5-cafc-4f3b-89b1-d681f600588c	2026-09-04 19:10:08.592	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	Cancelada no balcão	f	\N	MG	\N	\N	-16.3628767	-46.8924130	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-15 15:00:00	\N	\N
6a31c42e-47c7-4207-bc62-4ffb7c664992	98	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	\N	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-08-11 14:29:03.463	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	e00539ad-d068-4bcc-9679-6e3b678fc519	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-11 19:49:04.97	-16.3593730	-46.9021793	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-11 15:00:00	-16.3684932	-46.8997774
8228067d-56c4-4a4f-a04e-e2368148d6bd	89	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	6126acba-75e1-4eaf-9d72-5282ce6474f6	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-08-11 11:39:34.818	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-11 14:24:51.555	\N	\N	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-11 15:00:00	\N	\N
e8628b49-023e-492f-97f5-a59bba5119cf	71	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04379	\N	STEFANY MENDES ASSIS	38998411997	\N	Avenida Castelo Branco	120	\N	Barroca	Unaí	38616072	\N	\N	\N	1	ENTREGUE	2026-07-26 13:13:16.311	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	28c7c086-f254-4c30-bf2b-641841eddafe	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-10 18:20:20.129	-16.3673546	-46.9008669	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	-16.3673546	-46.9008669
d357423a-3ff1-45d9-ab15-ca50be609936	93	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04379	\N	STEFANY MENDES ASSIS	38998411997	45321b9c-2b18-4f4b-b56f-acb1b8187fbf	Avenida Castelo Branco	200	\N	Barroca	Unaí	38613416	\N	\N	\N	1	ENTREGUE	2026-08-11 14:21:17.343	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	dabb5002-5331-4af7-9e96-c6e84d9e1d7d	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-14 23:47:19.548	-16.3575000	-46.9061100	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-11 15:00:00	-16.3625017	-46.8979156
1f52fd80-a425-4cb4-b3d6-693057ca57d0	95	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	6126acba-75e1-4eaf-9d72-5282ce6474f6	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-08-11 14:21:39.588	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	d9b14bd3-c15c-4cc5-acda-dd6395673963	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-11 14:37:30.334	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-11 15:00:00	\N	\N
afdbdb4b-9e0e-4246-8ed7-afdeba3a17b3	94	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04099	\N	TAUANY DE OLIVEIRA MENDES	38997248912	9d904bd7-2a59-4799-a702-7ff1abdf7edc	Rua do Pico	21	\N	Primavera 5	Unaí	38612244	\N	\N	\N	1	ENTREGUE	2026-08-11 14:21:30.025	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	ad67ae7f-34ec-4fd6-97bf-004dd9881ab2	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-14 23:49:43.679	-16.3684838	-46.8998142	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-11 15:00:00	-16.3625005	-46.8978945
06f0a27e-8534-4c9e-8f73-28f1a8207428	101	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04379	\N	STEFANY MENDES ASSIS	38998411997	45321b9c-2b18-4f4b-b56f-acb1b8187fbf	Avenida Castelo Branco	200	\N	Barroca	Unaí	38613416	\N	\N	\N	1	ENTREGUE	2026-08-11 14:38:42.903	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	f3246607-3713-4a5f-98b3-9e4edc59067b	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 00:19:44.855	-16.3575000	-46.9061100	\N	PRESENCIAL	1	\N	Lenio	\N	\N	2026-08-14 15:00:00	\N	\N
27af5ad5-bc0d-4cf3-93aa-314a0bc3ca22	119	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	\N	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-08-15 01:36:13.621	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	297f7b28-21fb-41bf-a0e4-9959845a47ae	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 02:05:49.533	-16.3682431	-46.8995417	\N	PRESENCIAL	1	\N	Clenio.marcos mendes	\N	\N	2026-08-14 15:00:00	-16.3624910	-46.8978961
a79c0098-97ea-46c3-a872-6c5b9b68e274	103	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03132	\N	ELVIS ELIAS ROCHA	3899619160	\N	AVENIDA QUINTINO F. SILVA	165	BLOQUEIO A PEDIDO DO MESMO	VALE VERDE	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-08-11 14:50:38.852	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	8c6e24cd-5b0a-471f-9636-a0cd95a90192	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-11 14:55:25.799	\N	\N	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-11 15:00:00	\N	\N
8576b6d1-36dc-4636-8aa2-401abe337c1c	100	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04099	\N	TAUANY DE OLIVEIRA MENDES	38997248912	9d904bd7-2a59-4799-a702-7ff1abdf7edc	Rua do Pico	21	\N	Primavera 5	Unaí	38612244	\N	\N	\N	1	ENTREGUE	2026-08-11 14:38:21.388	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-11 14:55:25.83	\N	\N	\N	PRESENCIAL	1	\N	Tauany	\N	\N	2026-08-15 15:00:00	\N	\N
94c5c157-b79b-4315-8013-17bb82be05a3	1	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	EVENTUAL	\N	\N	Maria Silva	38999111001	\N	Rua Getúlio Vargas	100	\N	Centro	Unaí	\N	\N	\N	\N	1	ENTREGUE	2026-07-11 23:16:50.141	a33b01ad-75c5-470a-ad1c-cfeb1a557067	\N	\N	\N	f	\N	MG	0a305767-0303-4ebe-8c09-ea7dcd0c48e1	2026-07-11 23:31:29.474	-16.3593730	-46.9021793	\N	PRESENCIAL	1	\N	\N	E01047	Clenio M. Mendes (TESTE INDIVIDUAL)	\N	-16.3593730	-46.9021793
09b0b20d-896e-4361-96ba-b3bb85894c2b	2	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	EVENTUAL	\N	\N	João Pereira	38999222002	\N	Avenida Brasil	250	\N	São Sebastião	Unaí	\N	\N	\N	\N	1	ENTREGUE	2026-07-11 23:17:09.04	a33b01ad-75c5-470a-ad1c-cfeb1a557067	\N	\N	\N	f	\N	MG	0a305767-0303-4ebe-8c09-ea7dcd0c48e1	2026-07-11 23:31:29.474	-16.3856450	-46.9089543	\N	PRESENCIAL	1	\N	\N	E01047	Clenio M. Mendes (TESTE INDIVIDUAL)	\N	-16.3856450	-46.9089543
ee37f2ab-f4d9-43b8-ac08-f4df79b426cc	28	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04838	\N	VALDIRENE DA FONSECA BORGES	38998552342	\N	Rua dos Jambos	34	\N	Primavera	Unaí	38612122	\N	\N	\N	1	ENTREGUE	2026-07-16 19:26:19.299	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	f	\N	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:30:56.697	-16.3616630	-46.8857702	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	-16.3616630	-46.8857702
293e2a99-5442-4e3c-bb73-7fdf0471e437	14	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	\N	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-16 19:03:04.453	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	2f81e2d0-e238-4fae-84c9-3871ec65b7a1	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:09:41.122	-16.3682419	-46.8994329	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	-16.3682419	-46.8994329
32b0307a-e0d9-4c1b-9b7a-292264c7e05a	12	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03113	\N	ADRIANA CAETANO VASCONCELOS	38999811390	\N	RUA SANTA LUZIA	1414	\N	N. SRA. AP.	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-16 19:02:30.986	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	b1f6a01b-2588-46d5-bbb6-73f70c6ae446	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:10:08.084	-16.3681622	-46.8994324	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	-16.3681622	-46.8994324
0522f681-0ec3-45c1-ad27-f2c5b7b37d94	25	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03683	\N	REGILANE APARECIDA DE SOUSA SILVA	38998117070	\N	RUA TRES	95	CS	SANTA LUZIA	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-16 19:13:39.9	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	2bb9cc90-3d66-474d-b5d7-1f01a8f3eebe	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:22:27.563	-16.3681732	-46.8994147	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	-16.3681732	-46.8994147
33a5b6e0-e0fc-4faf-8409-c0ceaf01cc6b	21	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01981	\N	RENATA BORGES FREITAS CASTRO	38998665383	\N	Rua Canabrava	1457	CASA	Cachoeira	Unaí	38610250	\N	\N	\N	1	ENTREGUE	2026-07-16 19:12:17.035	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	73df3382-4091-41ca-9597-b727ba08a258	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:22:43.032	-16.3681527	-46.8993942	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	-16.3681527	-46.8993942
c02df7f4-a9e8-4f3f-8c2d-4f1f22459468	19	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03322	\N	ELIAS GOMES BARBOSA	38999097360	\N	RUA ALBA GONZAGA	741	AP301	CENTRO	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-16 19:11:22.755	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	a2f2dfd2-cd6c-4086-96f4-92f0a6a5cf36	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:23:29.523	-16.3681651	-46.8993987	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	-16.3681651	-46.8993987
822c1f9d-446e-49e1-b425-a29414f393ff	15	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	6126acba-75e1-4eaf-9d72-5282ce6474f6	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-16 19:03:08.337	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	5a662b7f-4821-48d1-ac1a-399b35fd8230	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:08:39.643	-16.3682431	-46.8995417	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	-16.3682431	-46.8995417
b837a791-ef86-435d-a347-b23e6253a542	66	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03113	\N	ADRIANA CAETANO VASCONCELOS	38999811390	\N	RUA SANTA LUZIA	1414	\N	N. SRA. AP.	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-25 23:54:54.702	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-25 23:56:20.224	-16.3625062	-46.8979151	\N	PRESENCIAL	1	\N	Ai	\N	\N	\N	-16.3625062	-46.8979151
04bb2316-9a23-429b-8b66-c3d6b54ead5d	27	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E02749	\N	WANDERSON NASCIMENTO DA COSTA	3898430656	\N	RUA JURITI	175	\N	FLORESTA	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-16 19:26:04.419	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	f	\N	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:30:56.697	-16.3656609	-46.8876010	\N	TELE_VENDA	1	\N	\N	\N	\N	\N	-16.3656609	-46.8876010
ddcacada-4139-4e35-9fca-ab12c609c8f5	30	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03401	\N	MONIA APARECIDA DE SOUSA	38998319486	\N	RUA VICENTE PAULA PESSOA	216	\N	NOVO HORIZONTE	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-16 19:27:53.73	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	f	\N	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:30:56.697	-16.3760766	-46.9110949	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	-16.3760766	-46.9110949
387f7a84-2836-4512-a28a-a4d362cb537c	33	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	6126acba-75e1-4eaf-9d72-5282ce6474f6	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-16 19:31:34.356	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	6b3a779d-3d14-4c07-9c71-8ba6361e2393	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:32:52.046	-16.3681651	-46.8993987	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	-16.3681651	-46.8993987
040d4bf2-172e-498f-af94-4800e7d9a6fc	18	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03058	\N	EDUARDO RIBEIRO DA COSTA	3899979948	\N	RUA GENIPAPERO	273	\N	CIDADE NOVA	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-16 19:03:55.501	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	2015a3ba-c128-4fdd-b379-f80417faad89	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:17:47.074	-16.3681732	-46.8994147	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	-16.3681732	-46.8994147
a675ee3d-2476-4a06-b161-d9f9cdf71bd7	36	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01019	\N	MARCIA DA SILVA COUTO	38991500476	\N	RUA LEAO LARA	149	\N	DIVINEIA	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-16 19:39:30.302	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	f	\N	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:43:50.47	-16.3739906	-46.8924804	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	-16.3739906	-46.8924804
aa1f53c2-5e59-4f70-9fff-eed13bbc9af1	82	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04379	\N	STEFANY MENDES ASSIS	38998411997	\N	Avenida Castelo Branco	120	\N	Barroca	Unaí	38616072	\N	\N	\N	1	ENTREGUE	2026-07-26 13:46:49.877	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	77810aa9-9024-43e5-8ad0-6bddf6cdd9e9	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-10 18:52:34.364	-16.3685815	-46.8998053	\N	PRESENCIAL	1	\N	Clenio	\N	\N	\N	-16.3685815	-46.8998053
96a1ff94-9d49-46a2-8a78-409da2e7fdb1	65	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03113	\N	ADRIANA CAETANO VASCONCELOS	38999811390	\N	RUA SANTA LUZIA	1414	\N	N. SRA. AP.	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-25 23:29:56.633	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	b0eb6a50-9078-4aec-8115-fbfebc50e4fa	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-25 23:52:50.064	-16.3625046	-46.8979246	\N	PRESENCIAL	1	\N	Iao	\N	\N	\N	-16.3625046	-46.8979246
2640705b-0e3f-43b5-b054-5229b89571e4	79	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04379	\N	STEFANY MENDES ASSIS	38998411997	\N	Avenida Castelo Branco	120	\N	Barroca	Unaí	38616072	\N	\N	\N	1	ENTREGUE	2026-07-26 13:30:13.875	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	04bcd95d-0390-4c48-ab58-63942ff0dc8f	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-10 20:06:20.934	-16.3685107	-46.8998146	\N	PRESENCIAL	1	\N	Clenio	\N	\N	\N	-16.3685107	-46.8998146
63f0b171-4783-4196-86d4-4f890eca8317	67	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04848	\N	JULIANA DA SILVA MARQUES	8999023007	\N	Rua Lúcia de Souza Ribeiro	100	\N	Residencial Curva do Rio	Unaí	38620886	\N	\N	\N	1	ENTREGUE	2026-07-25 23:55:01.682	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-25 23:55:51.949	-16.3625062	-46.8979151	\N	PRESENCIAL	1	\N	E	\N	\N	\N	-16.3625062	-46.8979151
ca9a033f-1918-4348-a39b-01e55aa1bcdc	68	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03156	\N	ELENISA PETTINE	38999480178	\N	Avenida Castelo Branco	34	AP 101	Barroca	Unaí	38616072	\N	\N	\N	1	ENTREGUE	2026-07-26 13:12:12.872	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	1d1a9d3f-e914-4369-8211-c65c099cbaad	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-06 13:05:31.75	-16.3684864	-46.8998357	\N	PRESENCIAL	1	\N	Tauany	\N	\N	\N	-16.3684864	-46.8998357
f57d61db-4660-4bbb-9d76-9625b61fac70	72	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04379	\N	STEFANY MENDES ASSIS	38998411997	\N	Avenida Castelo Branco	120	\N	Barroca	Unaí	38616072	\N	\N	\N	1	ENTREGUE	2026-07-26 13:13:41.853	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-06 13:05:49.771	-16.3684759	-46.8998538	\N	PRESENCIAL	1	\N	Nicole	\N	\N	\N	-16.3684759	-46.8998538
e475f288-ac1c-4e06-adf0-a61120107591	73	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A04721	\N	MARIA NEUZA MENDES	38999625125	74b199b1-18e5-4d4a-acb4-e9170e917029	Rua Cachoeira	120	\N	Centro	Unaí	38610051	\N	\N	\N	1	ENTREGUE	2026-07-26 13:13:50.997	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-06 13:06:28.827	-16.3684890	-46.8998457	\N	PRESENCIAL	1	\N	Clenio	\N	\N	\N	-16.3684890	-46.8998457
5b50e12d-f8e4-4f97-9a55-c2c5634d67f0	85	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04099	\N	TAUANY DE OLIVEIRA MENDES	38997248912	\N	Rua do Pico	21	\N	Primavera 5	Unaí	38612244	\N	\N	5 CANO,	5	ENTREGUE	2026-08-06 12:50:04.666	3d6f4527-e2ed-46a6-9955-7c770e8a107a	\N	\N	\N	f	\N	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-06 13:06:37.836	-16.3684838	-46.8998142	\N	PRESENCIAL	1	\N	Tauany	E01047	CLENIO MARCOS MENDES	\N	-16.3684838	-46.8998142
2cb40ffa-ae13-4770-b0ac-4a630f75fec3	63	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03113	\N	ADRIANA CAETANO VASCONCELOS	38999811390	\N	RUA SANTA LUZIA	1414	\N	N. SRA. AP.	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-25 23:28:23.686	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	d6496bd6-9f69-4988-9678-81ebe37fcb53	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-25 23:53:15.743	-16.3625053	-46.8979222	\N	PRESENCIAL	1	\N	Clenii	\N	\N	\N	-16.3625053	-46.8979222
96da6b9a-f26d-4710-ad26-2f8b6feb9d63	35	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01981	\N	RENATA BORGES FREITAS CASTRO	38998665383	\N	RUA JACANA, 04 CASA	10	\N	CENTRO	UNAI	38613545	\N	\N	\N	1	ENTREGUE	2026-07-16 19:39:24.523	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	f	\N	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:43:50.47	-16.3925817	-46.9012543	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	-16.3925817	-46.9012543
e77608e5-772c-4037-a45f-3818e0625327	37	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03113	\N	ADRIANA CAETANO VASCONCELOS	38999811390	\N	RUA SANTA LUZIA	1414	\N	N. SRA. AP.	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-16 19:39:38.426	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	f	\N	MG	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-16 19:43:50.47	-16.3556580	-46.8945957	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	-16.3556580	-46.8945957
0b2e3f62-d538-4cfe-85fe-d32b4960bf68	50	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04489	\N	MARILIA ABADIA PEREIRA ARAUJO	38999838637	\N	Rua Juriti	89	\N	Floresta	Unaí	38613145	\N	\N	\N	1	ENTREGUE	2026-07-25 00:34:01.767	3d6f4527-e2ed-46a6-9955-7c770e8a107a	\N	\N	\N	t	7973120a-b790-454f-baab-86f8ad516116	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-25 01:14:25.45	-16.3625054	-46.8979301	\N	PRESENCIAL	1	\N	Clenio	E01047	CLENIO MARCOS MENDES	\N	-16.3625054	-46.8979301
1df8ae19-24bb-4d3a-8411-eaac1f1c4d8a	47	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A02027	\N	VALDINEI PAULO DE OLIVEIRA	38999609300	\N	Rua Calixto Martins de Melo	2027	\N	Centro	Unaí	38610039	\N	\N	\N	1	ENTREGUE	2026-07-25 00:31:46.115	3d6f4527-e2ed-46a6-9955-7c770e8a107a	\N	\N	\N	t	09d94226-1853-45ed-901b-5879385d199f	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-25 01:49:02.073	-16.3624964	-46.8979252	\N	PRESENCIAL	1	\N	\N	E01047	CLENIO MARCOS MENDES	\N	-16.3624964	-46.8979252
b23bde51-021e-402f-ab16-d6b721e35990	43	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	\N	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-18 23:37:37.804	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	t	d72e0b77-b509-46b9-9982-a7180b50c6d5	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-25 01:49:20.685	-16.3624950	-46.8979201	\N	PRESENCIAL	2	[{"motivo": "Cliente ausente no endereço", "dataHora": "2026-07-18T23:49:42.338Z", "tentativa": 1, "baixadoPorId": "f5519586-dae7-40c6-8d85-fb3195636e5a", "viagemNumero": 9}]	\N	\N	\N	\N	-16.3624950	-46.8979201
aec4a620-91f5-4561-964e-9e58c5c05c8e	49	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A04721	\N	MARIA NEUZA MENDES	38999625125	\N	Rua Cachoeira	120	\N	Centro	Unaí	38610051	\N	\N	\N	1	ENTREGUE	2026-07-25 00:32:55.01	3d6f4527-e2ed-46a6-9955-7c770e8a107a	\N	\N	\N	t	1c0d5994-c440-4500-a757-070bdfdbb61c	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-25 01:49:38.05	-16.3625084	-46.8979180	\N	PRESENCIAL	1	\N	\N	E01047	CLENIO MARCOS MENDES	\N	-16.3625084	-46.8979180
a33f6868-6b73-4a64-8635-8740264e8876	51	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03113	\N	ADRIANA CAETANO VASCONCELOS	38999811390	\N	RUA SANTA LUZIA	1414	\N	N. SRA. AP.	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-25 00:34:21.766	3d6f4527-e2ed-46a6-9955-7c770e8a107a	\N	\N	\N	t	bded0f61-8157-4249-80b5-bb338a23d06c	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-25 01:49:54.49	-16.3625008	-46.8979164	\N	PRESENCIAL	1	\N	\N	E01047	CLENIO MARCOS MENDES	\N	-16.3625008	-46.8979164
07d182d1-cc48-42e8-9ca0-4dc00a3c7e33	58	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A02027	\N	VALDINEI PAULO DE OLIVEIRA	38999609300	db42940e-ee9d-4b0f-acf1-eb4ebc27a8a0	Rua Calixto Martins de Melo	2027	\N	Centro	Unaí	38610039	\N	\N	\N	1	ENTREGUE	2026-07-25 02:58:43.924	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	3ad59f4c-7d96-4ed9-bf42-af6255f5b1cd	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-25 23:50:53.096	-16.3625053	-46.8979219	\N	PRESENCIAL	1	\N	Clenio	\N	\N	\N	-16.3625053	-46.8979219
be6b65bd-6797-466b-a1c7-ba521c87a6b0	64	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	\N	\N	E04848	\N	\N	Rua Eduardo Rodrigues Barbosa	100	\N	Centro	Unaí	38610061	\N	\N	\N	1	ENTREGUE	2026-07-25 23:29:46.996	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	2af64f15-1c72-40a4-b166-27f436be7e43	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-25 23:51:23.309	-16.3624927	-46.8979145	\N	PRESENCIAL	1	\N	Clenio	\N	\N	\N	-16.3624927	-46.8979145
5a47d5fa-b90a-431c-b850-2866591f7594	55	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04848	\N	JULIANA DA SILVA MARQUES	8999023007	00be49f4-6323-40d5-9ed2-af380dc081e0	Rua Lúcia de Souza Ribeiro	100	\N	Residencial Curva do Rio	Unaí	38620886	\N	\N	\N	1	ENTREGUE	2026-07-25 02:16:28.984	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	7c1ea4e6-5994-476d-bcfd-ffb6af6c0d56	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-25 22:43:43.672	-16.3625070	-46.8979271	\N	PRESENCIAL	1	\N	\N	\N	\N	\N	-16.3625070	-46.8979271
81f09e20-2fc5-4cfe-aeab-64336ff88b81	59	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03113	\N	ADRIANA CAETANO VASCONCELOS	38999811390	\N	RUA SANTA LUZIA	1414	\N	N. SRA. AP.	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-07-25 02:58:54.496	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	67d2c55a-8074-4506-a795-ec7e204d7937	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-07-25 23:52:29.328	-16.3625019	-46.8979222	\N	PRESENCIAL	1	\N	Cei	\N	\N	\N	-16.3625019	-46.8979222
328c0ddd-0e28-415a-8fdd-d21e9b337d8c	70	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	\N	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	38610000	\N	\N	\N	1	NAO_ENTREGUE	2026-07-26 13:12:31.907	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-06 13:06:13.916	-16.3684856	-46.8998545	Cliente ausente	PRESENCIAL	1	\N	\N	\N	\N	\N	-16.3684856	-46.8998545
1225079c-03f0-4aab-9ed2-9d0dd386bd97	130	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A02027	\N	VALDINEI PAULO DE OLIVEIRA	38999609300	\N	FAZ. PICO, SN	\N	\N	ZONA RURAL	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-08-15 02:18:24.246	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	ee951aed-a6e5-4893-8737-89ddaaf57008	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 02:42:08.012	-16.3624969	-46.8979114	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-14 15:00:00	-16.3624897	-46.8978999
d0b57591-0609-4e03-81dc-1e0132979798	120	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A02027	\N	VALDINEI PAULO DE OLIVEIRA	38999609300	\N	FAZ. PICO, SN	\N	\N	ZONA RURAL	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-08-15 01:48:47.893	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	1f3f7ab0-1c3c-48d6-adce-03f586e79e9a	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 02:13:17.279	-16.3588599	-46.9048974	\N	PRESENCIAL	1	\N	Mendsa	\N	\N	2026-08-14 15:00:00	-16.3624910	-46.8978961
45c1d862-bfca-4be2-88d0-337d0936a056	133	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A02027	\N	VALDINEI PAULO DE OLIVEIRA	38999609300	\N	FAZ. PICO, SN	\N	\N	ZONA RURAL	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-08-15 02:30:55.439	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	077814f3-bda3-4c97-b11a-c83ee1cc7292	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 03:01:32.47	-16.3624969	-46.8979114	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-14 15:00:00	\N	\N
f5138f0d-372b-46b1-8402-8894a145f8cc	151	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04848	\N	JULIANA DA SILVA MARQUES	8999023007	\N	Rua Lúcia de Souza Ribeiro	100	\N	Residencial Curva do Rio	Unaí	38620886	\N	\N	\N	1	PENDENTE	2026-08-15 03:13:10.345	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	\N	\N	-16.3628767	-46.8924130	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-15 15:00:00	\N	\N
69530132-6f1e-419b-8728-5ea207adafa6	153	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03113	\N	ADRIANA CAETANO VASCONCELOS	38999811390	\N	RUA SANTA LUZIA	1414	\N	N. SRA. AP.	UNAI	38610000	\N	\N	\N	1	PENDENTE	2026-08-15 03:13:35.441	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	\N	\N	-16.3556580	-46.8945957	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-15 15:00:00	\N	\N
f642c952-5c14-4a19-98a3-8eb3ee3eb0c9	154	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04379	\N	STEFANY MENDES ASSIS	38998411997	\N	Avenida Castelo Branco	120	\N	Barroca	Unaí	38616072	\N	\N	\N	1	PENDENTE	2026-08-15 03:13:44.663	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	\N	\N	-16.3685815	-46.8998053	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-15 15:00:00	\N	\N
c03831f2-59e7-46a8-a131-2628722f65aa	155	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A05762	\N	CLENIO MARCOS MENDES	38999625125	a9caa26d-5fad-4a06-8678-f01b575e9167	Rua Eduardo Rodrigues Barbosa	475	\N	Centro	Unaí	38610061	\N	\N	\N	1	PENDENTE	2026-08-15 03:13:53.508	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	\N	\N	-16.3559474	-46.9013985	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-15 15:00:00	\N	\N
24fb522e-839b-4807-9044-4029d11ae0f2	156	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A04721	\N	MARIA NEUZA MENDES	38999625125	\N	FAZ. INHUMAS, SN	\N	\N	ZONA RURAL	UNAI	38610000	\N	\N	\N	1	PENDENTE	2026-08-15 03:14:08.47	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	\N	\N	-16.3628767	-46.8924130	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-15 15:00:00	\N	\N
32386c10-ed6d-4c2b-b341-4112298e7287	137	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04099	\N	TAUANY DE OLIVEIRA MENDES	38997248912	\N	Rua do Pico	21	\N	Primavera 5	Unaí	38612244	\N	\N	\N	1	ENTREGUE	2026-08-15 02:31:45.027	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	2a78f43b-fa1d-4226-968d-4e1a240be586	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 03:21:50.9	-16.3624902	-46.8978974	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-14 15:00:00	\N	\N
1b3c9a61-25ee-42ed-99ee-2035ae5862ef	139	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	\N	RUA CALIXTO MARTINS MELO	475	AP 108	CENTRO	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-08-15 02:32:01.609	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	34e40c98-ca13-440d-a028-017fa51ff18f	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 03:22:24.324	-16.3624897	-46.8978999	\N	PRESENCIAL	1	\N	Clenio	\N	\N	2026-08-14 15:00:00	-16.3624984	-46.8979208
b71bc4b6-9be9-4113-9cba-d064205d60aa	135	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04848	\N	JULIANA DA SILVA MARQUES	8999023007	\N	Rua Lúcia de Souza Ribeiro	100	\N	Residencial Curva do Rio	Unaí	38620886	\N	\N	\N	1	ENTREGUE	2026-08-15 02:31:16.009	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	e475007a-a3d7-4602-9d75-9064e5eb624d	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 03:28:24.11	-16.3628767	-46.8924130	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-14 15:00:00	\N	\N
70bc1992-0d81-4352-963b-1d4ab028bf2b	142	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E03113	\N	ADRIANA CAETANO VASCONCELOS	38999811390	\N	RUA SANTA LUZIA	1414	\N	N. SRA. AP.	UNAI	38610000	\N	\N	\N	1	ENTREGUE	2026-08-15 02:32:30.499	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	03ea5bd0-db8b-4307-9a52-8735d93fda8d	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 12:23:17.492	-16.3556580	-46.8945957	\N	PRESENCIAL	1	\N	Clenio Marcos mendes	\N	\N	2026-08-14 15:00:00	-16.3625026	-46.8978650
731c4259-f7eb-47c3-bec3-52def55a2ee0	143	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04721	\N	GABRIEL GOMES DE OLIVEIRA	38998643246	\N	Rua Maria Galdina	104	\N	Nova Canaã	Unaí	38616449	\N	\N	\N	1	EM_VIAGEM	2026-08-15 02:50:10.02	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	f	\N	MG	\N	\N	-16.3575000	-46.9061100	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-14 15:00:00	\N	\N
f915121f-4cfa-4576-9b7b-3c151f31e52c	138	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	A04721	\N	MARIA NEUZA MENDES	38999625125	ec5da9bd-c0b1-473e-9be4-dd9e8e67e45f	CHACARA DO ZE GALINHA	S/N	DEPOIS DA PORTEIRA	ZONA RURAL	Unaí	\N	IGREJA AZUL	\N	\N	1	ENTREGUE	2026-08-15 02:31:55.251	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	t	c64b434d-9972-4c8d-bfa1-822617adb77e	MG	cb8c650f-4e49-45b6-b422-338e1c071685	2026-08-15 12:40:38.257	-16.3628767	-46.8924130	\N	PRESENCIAL	1	\N	Clenio ma	\N	\N	2026-08-14 15:00:00	\N	\N
8925dfe0-f31c-4592-b6a1-88636aab9fce	18	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	IDENTIFICADO	E01047	\N	CLENIO MARCOS MENDES	38999625225	10fa32ec-679d-4826-8066-d24bf00fee19	Rua Calixto Martins de Melo	475	\N	Centro	Unaí	38610039	\N	\N	\N	1	PENDENTE	2026-08-10 18:03:28.668	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	\N	\N	\N	f	\N	MG	\N	\N	-16.3575000	-46.9061100	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-10 15:00:00	\N	\N
65fb56b1-3c35-4a00-b87b-fe3e15f4526d	28	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	IDENTIFICADO	A07503	\N	THIAGO MOREIRA DA COSTA SANTOS	38997383227	\N	Rua Djalma Torres	1293	\N	Cachoeira	Unaí	38610259	\N	\N	\N	5	PENDENTE	2026-08-21 18:48:09.953	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	\N	\N	\N	f	\N	MG	\N	\N	-16.3575000	-46.9061100	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-21 15:00:00	\N	\N
66c202c1-823b-4e95-a06f-f1769f1d65f8	159	8e843247-5b6b-4404-ba62-a74b84ccb287	IDENTIFICADO	E04099	\N	TAUANY DE OLIVEIRA MENDES	38997248912	\N	Rua do Pico	21	\N	Primavera 5	Unaí	38612244	\N	\N	\N	1	CANCELADA	2026-08-15 03:14:50.617	0117ccd5-cafc-4f3b-89b1-d681f600588c	2026-09-04 19:09:32.173	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	Cancelada no balcão	f	\N	MG	\N	\N	-16.3624902	-46.8978974	\N	PRESENCIAL	1	\N	\N	\N	\N	2026-08-15 15:00:00	\N	\N
\.


--
-- Data for Name: entrega_cupom; Type: TABLE DATA; Schema: logistica; Owner: capul_user
--

COPY logistica.entrega_cupom (id, entrega_id, numero_cupom, valor) FROM stdin;
ec456739-15ed-4347-8d7b-5e364a04a3a3	d2faaa20-4d91-40ad-8a80-00776161e140	10	200.00
939169f0-40fa-4672-852c-916bf7cf64a4	15d1caa8-9613-4098-b78f-7fc0156187f0	12	500.00
ff494f16-9269-4dfb-b062-cb207d742c0f	fc644086-17cd-4ce8-b6a9-96517d6b2452	15	2.00
2dcdedfa-68a0-44b0-9fd5-9576f87590a5	1ed42b3e-fb4b-4910-982c-a6a044f14c51	20	1.00
db456999-726e-4a52-9501-62223665f523	9eca594c-5e2e-45b7-987b-c7852253e01b	50	5.00
c42c3776-e887-41ec-90f6-f814aaedcf74	b0c241e7-13ab-4d5d-87ae-214d786ed51e	10	200.00
9af07971-b376-4017-9047-fc3ed8edd005	6cbe4df2-7860-404d-858e-5aaf3edd05ee	11	200.00
ae5ce781-e64d-4b79-a944-fa62f11d742c	fcd8b0cb-ee5a-4ee9-8011-62e4d725c507	1000	200.00
de7f6801-4958-4972-8f0a-3eaf44137693	04bb2316-9a23-429b-8b66-c3d6b54ead5d	20	1.00
d632942f-54d8-4d0e-8c03-4a048b4d7703	ee37f2ab-f4d9-43b8-ac08-f4df79b426cc	20	500.00
bcd8408d-98a8-4beb-91bf-cfaa40195133	ceedca50-0189-43fb-a59f-b52ed8cde66e	1	1.00
018fb119-05a5-45a5-91ec-47128d3f9f28	327a1348-056d-4d41-ae63-2051282835f7	2	2.00
bc893a9b-f49e-4135-953f-6861f7e90940	1df8ae19-24bb-4d3a-8411-eaac1f1c4d8a	1	12.00
67e3ca7b-a01e-4325-840d-027e91136404	84c646bf-e023-41fb-9f66-3ad9af655b3e	35	1.00
bfa62889-2333-4c2a-ba06-a1db48714b59	aec4a620-91f5-4561-964e-9e58c5c05c8e	12	10.00
33dcd3c6-e73d-43cb-985c-a4a93ea5902f	0b2e3f62-d538-4cfe-85fe-d32b4960bf68	125	1.00
77534730-2b5f-49e6-a7dd-07f14982c075	a33f6868-6b73-4a64-8635-8740264e8876	888	12.00
bf11d363-59c3-41d9-b954-a9e4f7a62e32	f7cddb93-b519-4ac3-88ed-587956f192d3	1	1.00
8f709555-7dc9-4885-ab18-e6680c639fbe	b489e51f-fe3b-4146-a3cb-e2068e6363ed	1	1.00
a6b3388a-55bc-427c-8681-da26fba9366f	5a47d5fa-b90a-431c-b850-2866591f7594	1	1.00
dc3bbf40-b682-4ac0-941f-263f4911affe	fefbccac-113b-477b-aece-dc9bf1d30c48	11	1.00
f3483c81-78bb-436e-841f-f5ba6ba5fa5d	07d182d1-cc48-42e8-9ca0-4dc00a3c7e33	1	11.00
2eac0df3-cbeb-4c23-ba14-95add153fa5a	81f09e20-2fc5-4cfe-aeab-64336ff88b81	1	0.00
3bf82609-d9dd-4e15-9157-f01355d95149	edb14c3c-7cee-41ff-82f6-2008cced4150	1	100.00
7a4ba852-2a78-4720-a048-bfc3fc55fa9c	29c71160-555b-4589-8104-f634ab6c2656	1	0.00
a912da7c-5c0c-451e-86e3-392b36bff8c9	b89212e0-c6fa-425f-940c-6fe565d1472d	120	500.00
d477e709-eb2b-4f5a-9c03-2bb4333c84bc	2cb40ffa-ae13-4770-b0ac-4a630f75fec3	12	120.00
2e7c935e-458a-49ac-9581-d0659254fa0b	be6b65bd-6797-466b-a1c7-ba521c87a6b0	120	1.00
aea972b5-3702-4e49-9d10-5c7f2afab228	96a1ff94-9d49-46a2-8a78-409da2e7fdb1	12	12.00
af67ff9e-2168-4317-b644-79ccbf9b75a6	b837a791-ef86-435d-a347-b23e6253a542	1	1.00
871d96a9-bb85-4753-a364-84e7a7f27ec2	63f0b171-4783-4196-86d4-4f890eca8317	121	1.00
58dc4ab3-44f3-4c6f-ba68-e00ed20b5274	ca9a033f-1918-4348-a39b-01e55aa1bcdc	1	0.00
dac54f62-a19b-41e1-bd22-2903817e5d1f	ca454d9e-a036-436d-b7c0-9d3e67a75c07	1	0.00
3002d7d1-dbe1-4ed2-9b93-4334d27f5200	09ad46a9-9dcd-438d-ac91-04ed340f8c53	1	12.00
4813ffe1-b97d-45ed-a1de-46f8f8376cb7	5b50e12d-f8e4-4f97-9a55-c2c5634d67f0	123	10.00
30eebe3d-9fc8-41c4-9d34-a6315262e217	5ac7d4e2-1272-4aa8-a980-1022cc024909	55	10.00
09d4f70a-2e64-4800-b9a0-ee48e539bffc	53f30e8c-300b-4f70-aa18-4960b5e4226b	120	10.00
5f5bb691-d59a-4174-baf0-87b58ad0ee01	6e21851a-eab0-4c8d-86ed-3eb370bcb235	1200	980.00
2721eff9-590a-488f-8b6e-c0051b98f59b	a0a18d28-7d3e-4f2e-9694-3f7843dd9cc2	1	0.00
a645c7a6-de30-479d-9711-afba720aeb49	6081641c-2155-430a-9047-ee81ca36b528	\N	2.00
6f3c9146-cd6d-44b8-82cc-de73feeb3ae7	ef23d77c-9eaf-41fa-bbd2-246a7a8be372	123	1.00
d44e9e89-7389-463b-afbd-089ea07fda4b	d357423a-3ff1-45d9-ab15-ca50be609936	15	120.00
84d8a4b0-4c40-4c87-a537-c536288140ca	afdbdb4b-9e0e-4246-8ed7-afdeba3a17b3	11	7.00
f53c1ea9-2776-477b-ac01-7e71f6582de8	1f52fd80-a425-4cb4-b3d6-693057ca57d0	11	15.00
4be3a800-e4b1-4516-84c1-0f087a3d08ca	7a02ddd9-50af-4b9c-bff1-f00c5d9b7305	12	700.00
fb9810f4-2fcf-4ffd-a019-7bb49afad1f7	21469954-9602-483e-b1f7-58f51ca5f277	11	1.00
63258c62-ad4c-4f2a-944a-762ea1978360	09c36017-4c8e-447d-a8f1-bbc06b63c680	123	0.00
62d3b49b-e24f-4bc6-8857-bf983177908c	45fd7af5-aeeb-474c-97e6-4625aeca099b	1	1.00
90a92edc-576d-4f83-918c-d946fa0c71ee	f8000e6d-67d6-40e1-919e-32abdd2afac1	1	0.00
3d4ab95d-23a2-4aec-b0a9-d32b90348591	883b3cf2-8eeb-46ae-9a96-f178659f88e9	121	0.00
3711deae-2da4-4e4a-9041-09e343b834f8	65773a96-75de-4d84-a9b2-45217ffed0a1	120	1.00
e3d83d29-c8e0-4090-b152-fd23b7f2746d	ef96c577-7711-4bf1-9346-95bf963a2a38	13100	99.00
6b8e3759-1b08-4387-90db-5a6701f6c65c	7dccc911-fcaf-463f-b953-99641242017f	12	12.11
d140dee6-54c9-4e6a-b137-db779920cf2b	c51093d5-1bb0-44e6-afdf-4065d9849630	1212	1.21
13a17168-2f9c-41f7-9a9d-3441b469404f	c919c755-9c4d-4cbf-b143-7db93c4a7e2e	1212	1.00
a3f08c02-15a8-4daa-9bb1-48c6b989e27d	d345fdae-2c60-4265-9505-e077786bc755	1212	12.00
41ed208d-d10f-4d52-8307-68963556a8f1	dd82218c-f4f3-4ba0-8fc0-57c1f8600ff8	S/NF	\N
c32d5884-a9f4-400d-bf8c-8506657901ae	27af5ad5-bc0d-4cf3-93aa-314a0bc3ca22	121	122.00
d20c2978-dda2-4520-8407-9f6c2b78eb42	d0b57591-0609-4e03-81dc-1e0132979798	12	12.21
f59b1c3e-8285-45ed-8098-97c270358616	487a9b8b-dade-456a-b4c0-f46a81e657d5	121	12121.21
a492f3b7-a0c2-43b1-a0f1-2c2894e8332c	8b28ebe4-7d81-445e-80e8-0fbdaac124cb	121	1.20
8d001df4-1899-4870-b206-c5e6a28ab258	c30f4efd-d429-40f7-868f-3f7f41e8427d	121	21.20
8c73668c-0abc-4d4e-982f-b89ba3047c50	a3751d89-b21c-4dc4-9fab-028fb3f5b121	1212	1.22
7875f24b-7f08-4bb8-ab53-ffd7e5cb9fa1	46ab9cc8-dcb2-4fd9-878d-c0870ffe7af7	112	1.21
56588799-95b8-4af7-adba-d2b8eadedb99	37fc47ae-a1e4-4aea-9b4d-2cae0989956c	121	1.21
92b74729-e4bd-481e-b3fb-113c3bdf249c	33187004-e42d-463c-af4d-22f86c1aed91	1	0.01
4c42bbf9-bdad-4fa7-bed5-2c38eef51480	135dded3-0f5f-4e5f-918a-7358ae9c210e	2	0.02
1ed5fb31-3677-4499-8773-3433c6e9a4ec	e0527e56-ceff-4589-b09e-9e3fb91f3780	1	0.01
dddf8c34-c0d4-4373-980a-bcc51190640f	1225079c-03f0-4aab-9ed2-9d0dd386bd97	3	0.03
a97a1bfa-5784-40e3-9313-57234e972cbe	ac6848b3-edf7-4d39-a8f0-b06fd061548e	5	0.05
ef89a21b-bf8e-4091-bd7c-c310b3a46887	0a05d2bb-cd38-42a4-bfda-dc7d5011792c	11	1.11
67dfb1f2-4430-425d-9fbf-254c264b2ec1	45c1d862-bfca-4be2-88d0-337d0936a056	11	122.00
4e4b1e7e-bee4-4ad7-8d90-bc68bfe4a21d	b48d04e9-69a4-4280-b31a-7e64657e0318	12	1.11
6ee977eb-ecdb-4417-beae-c72e17bc5ed9	b71bc4b6-9be9-4113-9cba-d064205d60aa	11	0.11
d58a94a8-2c0e-4574-9c4f-01d84a3bc846	850246fe-1abe-4ccd-b8d1-be8eb8c925cb	11	0.11
3b61f9c4-9efe-4a54-96e9-c67e11bf8147	32386c10-ed6d-4c2b-b341-4112298e7287	11	12.12
8ae03408-58de-44e3-81a0-b8a2c891a627	f915121f-4cfa-4576-9b7b-3c151f31e52c	121	12.12
31cd0fb6-7837-4b18-a441-a9736d702435	1b3c9a61-25ee-42ed-99ee-2035ae5862ef	55	0.55
b102421f-ecdd-4021-9cd7-09a7daefeecf	e14683b7-c195-4fb7-b2fc-3a82ba2c222b	111	2.22
2eeedd2c-6992-4996-9ef1-27756bdb6804	6beedf77-7a41-4d53-9149-8139c4705948	11	0.11
ca9a4eec-1b78-4857-be41-58ab79385737	70bc1992-0d81-4352-963b-1d4ab028bf2b	1122	2.22
1e9eeaac-8e33-4738-a8a6-fce4be2d874b	731c4259-f7eb-47c3-bec3-52def55a2ee0	121	0.11
25dd923b-96c9-4828-8065-fc3ef30a0176	66262c01-bf3d-40a8-885f-29460fe127a3	11	0.11
84d83605-619f-405c-a6d2-a2d86f28cf2a	da2b46e7-55ec-4634-a288-7b6fd1a63270	33	0.33
4f1ab35f-ad7e-486b-a2a3-0222b8253d0d	b08fb387-c323-4ac9-80c6-423f0d06533b	99	0.99
6c55fa44-ef54-4d78-9f34-ded34dc52c06	88cec66b-ad8d-47d0-b363-996726af626f	11	1.11
3939639f-80bf-4655-9151-c377c8ead645	8572d52f-2ee6-476e-a3fc-343db1f8abb2	222	1.11
b2884784-6bd6-4605-adfa-8a95ae302536	2f5295c0-0cdf-45ec-9d1d-014730e820b9	33	6.66
ad6ef241-1503-4b62-8329-9b5c1d2e95e2	9a021167-d2c1-466d-8d5c-f96960d165c2	3	0.03
3e2ff179-8922-4fbb-81f3-1a8fd363c03e	f5138f0d-372b-46b1-8402-8894a145f8cc	33	3.33
37f9abd6-8acf-4042-91b0-d239360fa8ab	c6c6d36e-62fb-4133-900e-4531f59cf9f0	5	0.05
f4617d07-70c5-4d52-bf28-394fcc304e63	69530132-6f1e-419b-8728-5ea207adafa6	111	2.22
253ca861-a6a8-447c-bd50-4dafa563adf6	f642c952-5c14-4a19-98a3-8eb3ee3eb0c9	333	3.33
f32b2ab4-5b0b-478e-9fd8-2b93cf2f961e	c03831f2-59e7-46a8-a131-2628722f65aa	111	1.11
13384c3d-13d6-4ca3-870c-0d14d9da3f49	24fb522e-839b-4807-9044-4029d11ae0f2	111	1.11
193b58ff-69b2-4c85-99a9-8018b4082ce7	8cd70ad9-d6ed-40fc-bebf-9464d611d389	1111	1.11
d36627f4-e369-49e3-b170-e4953995dca2	2e6b9335-958e-4423-be45-4b8634890ca4	111	1.11
fc91bb82-1005-42c3-9045-4a6c2c63295a	66c202c1-823b-4e95-a06f-f1769f1d65f8	111	1.11
60c8ee5f-d126-4880-a30d-b329f0422f77	65fb56b1-3c35-4a00-b87b-fe3e15f4526d	122	120.00
\.


--
-- Data for Name: fechamento_rdv; Type: TABLE DATA; Schema: logistica; Owner: capul_user
--

COPY logistica.fechamento_rdv (id, supervisor_id, mes_referencia, fechado_em, fechado_por_id) FROM stdin;
\.


--
-- Data for Name: fornecedor_despesa; Type: TABLE DATA; Schema: logistica; Owner: capul_user
--

COPY logistica.fornecedor_despesa (id, nome, ativo, criado_em) FROM stdin;
37af6ec2-896d-4df9-9929-d25d8a94fa27	NÃO DEFINIDO	t	2026-07-05 16:19:10.142
\.


--
-- Data for Name: geocode_cache; Type: TABLE DATA; Schema: logistica; Owner: capul_user
--

COPY logistica.geocode_cache (id, chave, endereco, lat, lng, fonte, precisao, criado_em, corrigido_em, corrigido_por_id, aprendido_amostras, aprendido_desvio_m, aprendido_em) FROM stdin;
9e675b85-9731-4906-b897-fc5eabc552bd	ec552303d40979c7cb37b49c616ace97fb308db6f8ee60705aa7a4eaa59a16ed	RUA GETÚLIO VARGAS|100|CENTRO|UNAÍ|MG|	-16.3593730	-46.9021793	NOMINATIM	BAIRRO	2026-07-11 23:16:58.44	\N	\N	\N	\N	\N
cdad91f7-afb9-4ff8-8a80-85969940f47a	d227575f0d5d0a104a2098c519cecf1453b363cceb2be502b323860cb61733b7	AVENIDA BRASIL|250|SÃO SEBASTIÃO|UNAÍ|MG|	-16.3856450	-46.9089543	NOMINATIM	LOGRADOURO	2026-07-11 23:17:12.587	\N	\N	\N	\N	\N
2116590b-9747-478b-b9ba-7a9b1d92fb3f	8639f9254e93784a3b31f5196198049cbf48e015b39fa616bd591c6c3af0caf0	RUA FLORIANO PEIXOTO|45|BELA VISTA|UNAÍ|MG|	-16.3794050	-46.8871971	NOMINATIM	BAIRRO	2026-07-11 23:17:20.764	\N	\N	\N	\N	\N
e21b2b73-42c5-4790-bc09-fe53faaaf3fc	5956de8624e176a7581699ef30fba71a01479d510989066bca08d7edda5308e8	RUA RIO BRANCO|78|COHAB|UNAÍ|MG|	-16.3628767	-46.8924130	NOMINATIM	CIDADE	2026-07-11 23:18:10.363	\N	\N	\N	\N	\N
c40d5de4-c84b-4c13-8d94-7b19084c8cef	9ee2e84ef2162ced5a0709ebe79d5ddfa68945844a704aed3310bbdd8e5ac163	RUA PREFEITO JOAO COSTA, 1455|||UNAI|MG|38616064	-16.3734584	-46.8949492	NOMINATIM	LOGRADOURO	2026-07-11 23:22:58.552	\N	\N	\N	\N	\N
ee7890b2-73b8-4059-9ecc-fb28c17792a1	783e34f9083bd124ad0cd61f46bea875ee4bd2c371668a825251c518d76c57bc	RUA TIRADENTES|10|CENTRO|UNAÍ|MG|	-16.3767591	-46.8839832	NOMINATIM	LOGRADOURO	2026-07-11 23:30:11.796	\N	\N	\N	\N	\N
e80b2276-de7c-4b9f-b1ed-f1aa5ba33f47	96851fc1b26f38e0eb249b35f7740e07f37cbbaa4fedeb025067c0d1cf22a8d4	RUA JAÇANÃ|10|DIVINÉIA|UNAÍ|MG|38613545	-16.3792538	-46.8925097	NOMINATIM	LOGRADOURO	2026-07-13 19:54:48.28	\N	\N	\N	\N	\N
26211e71-86c2-4162-a572-976422c1f35d	756a0f55bc37c769203c36cb64bc63a3bd16ec30670509eb7e3c553ce4b0eb55	RUA CANABRAVA|1457|CACHOEIRA|UNAÍ|MG|38610250	-16.3572994	-46.8928211	NOMINATIM	LOGRADOURO	2026-07-13 19:56:33.976	\N	\N	\N	\N	\N
70baa9d9-9962-42ca-8e9f-adbf2d481bd9	b8ce07f631a821309f317d1f35795a8b3ccffe33349f631b6400eab7e021abe2	RUA PREFEITO JOAO COSTA, 1375|||UNAI|MG|38616064	-16.3734584	-46.8949492	NOMINATIM	LOGRADOURO	2026-07-13 20:00:08.492	\N	\N	\N	\N	\N
bf87c71d-b17d-4d03-8478-b1c867c213ec	03524753607b46b34cf74b7648dbdb8e3338d870f4f43631bf8df02e3341a542	RUA CAMILA P BROCHADO|85|SANTA LUZIA|UNAI|MG|38610000	-16.3556580	-46.8945957	NOMINATIM	BAIRRO	2026-07-16 18:50:38.703	\N	\N	\N	\N	\N
5a27a3ec-1065-42a1-b015-b2eb446086b2	0ac4dddfe36c38aaa5ba1e8ea43b93bb0271fb460aa3eda1205b5dba20fc742d	RUA LEAO LARA|149|DIVINEIA|UNAI|MG|38610000	-16.3739906	-46.8924804	NOMINATIM	BAIRRO	2026-07-16 18:51:24.464	\N	\N	\N	\N	\N
4c3fea79-252f-43fb-83aa-9db2b3f2914d	4a57c606933f7236a383b6cc0792ef7dc303aa9b0a026cc65d383cadc57acde6	RUA OLAVO FRANCISCO DE OLIVEIRA|246|VALE VERDE|UNAI|MG|38610000	-16.3582983	-46.8860765	NOMINATIM	LOGRADOURO	2026-07-16 18:51:31.018	\N	\N	\N	\N	\N
1cd4f3cd-6ae5-48af-a052-c655c663754d	d08cb686d0c61da650a300edb049859dd4e3af42e67ef94b948b1769e51ef8a9	RUA 1 DE MAIO|185|CACHOEIRA|UNAI|MG|38610000	-16.3532868	-46.8895701	NOMINATIM	LOGRADOURO	2026-07-16 19:03:34.763	\N	\N	\N	\N	\N
22fe13d4-0d16-4569-8cd4-728a66c0afb5	067f6ed7e2d5314e7d2653270036d4788fbb1efb899d512108342276c8568123	RUA ABEL FERREIRA|26|OLARIA|UNAI|MG|38610000	-16.3678376	-46.8863700	NOMINATIM	LOGRADOURO	2026-07-16 19:03:45.934	\N	\N	\N	\N	\N
4c7ef6d2-44fd-4f32-9848-c281502a37a7	ee90d797a160f630c6f2e4c0c6d38b59e095c16084a0ff3525cf94146a343862	RUA GENIPAPERO|273|CIDADE NOVA|UNAI|MG|38610000	-16.3830143	-46.9068463	NOMINATIM	BAIRRO	2026-07-16 19:04:02.346	\N	\N	\N	\N	\N
49b72a84-0ee2-4493-ae58-7959d774d48c	24cd8c5c4495ee530061a33120eb5d4aab2afa63cb88047b4257e867e0822ece	RUA ALBA GONZAGA|741|CENTRO|UNAI|MG|38610000	-16.3634607	-46.9014457	NOMINATIM	LOGRADOURO	2026-07-16 19:11:24.681	\N	\N	\N	\N	\N
11fc32e7-9a2c-400a-88b9-db5b105e66fb	1e67788ad2cee1f0f7f0378bff455db5bf6b00b6d1d472ca5e48e5383d0a5aa5	RUA FREI FRANCISCO|346|NOVO HORIZONTE|UNAI|MG|38610000	-16.3771093	-46.9112358	NOMINATIM	LOGRADOURO	2026-07-16 19:11:53.335	\N	\N	\N	\N	\N
895ffe71-46ba-4bea-a0be-493f1a25b52d	ac874f1dcbc944fbf772d4f8bc13dd58eef79777cd74855a5dc2fc2d3cb8a5af	RUA AFONSO PENA|83|OLARIA|UNAI|MG|38610000	-16.3568032	-46.9028820	NOMINATIM	LOGRADOURO	2026-07-16 19:13:30.382	\N	\N	\N	\N	\N
47864b6a-401f-4cdd-a078-6bc6709c1b75	97240ae6f58b4d88a03f1e4a735db8502bf2af8557efbfe803cbcc43964ba10b	RUA TRES|95|SANTA LUZIA|UNAI|MG|38610000	-16.3702035	-46.8878092	NOMINATIM	LOGRADOURO	2026-07-16 19:13:43.809	\N	\N	\N	\N	\N
b9a6c7a4-5f24-41df-9b4f-ccbb09c87288	29f52ff7c11212b0cd317b8c27b9bd2027369939292c6aba37edcec806733951	RUA JURITI|175|FLORESTA|UNAI|MG|38610000	-16.3656609	-46.8876010	NOMINATIM	LOGRADOURO	2026-07-16 19:26:06.502	\N	\N	\N	\N	\N
1dadd5d7-3883-4226-8714-ca7a561560b5	d3b8e75af3523e08ddbe30e351d2b0e895908c6a7ae62fc42571b140559429a0	RUA VICENTE PAULA PESSOA|216|NOVO HORIZONTE|UNAI|MG|38610000	-16.3760766	-46.9110949	NOMINATIM	BAIRRO	2026-07-16 19:27:58.55	\N	\N	\N	\N	\N
420a7547-273d-4f25-b9f4-58a49648da15	8ad2706a248531e14c42a3b3f7942798a755a9d79c9db70a7d961cb9a69f5908	RUA JACANA, 04 CASA|10|CENTRO|UNAI|MG|38613545	-16.3925817	-46.9012543	NOMINATIM	LOGRADOURO	2026-07-16 19:39:28.499	\N	\N	\N	\N	\N
615616be-6f5f-4842-9fb9-21306e3c03b1	b828631eee861ea649dbebe7f76deba2e40be1843ecdef989607ed753ce5bc80	FAZ. GLEBA DO GADO BRAVO PARCELA|247|ZONA RURAL|DOM BOSCO|MG|38654000	-16.6516044	-46.2677917	NOMINATIM	CIDADE	2026-07-16 19:44:30.184	\N	\N	\N	\N	\N
8e09a425-13cc-4630-9e3f-70e0a556c98d	c5361429abdbd9f760871e4fcfa6ca17415ff07ece5c8432fab3f268843a1ece	RUA JURITI|89|FLORESTA|UNAÍ|MG|38613145	-16.3656609	-46.8876010	NOMINATIM	LOGRADOURO	2026-07-16 19:44:37.439	\N	\N	\N	\N	\N
301dade4-702e-4c24-8fc2-d5095e3b9d88	78b26a691c5a5c8ff7e407facc0cf5088429638300386dace897f992d5edb25f	RUA TESTE RECORRENTE|100|CENTRO|UNAÍ|MG|	-16.3593730	-46.9021793	NOMINATIM	BAIRRO	2026-07-18 23:39:21.145	\N	\N	\N	\N	\N
9861999e-59f0-4a7a-b381-586269513b38	c7f33197035600f9e477ca808517b59b2b66d602ef89188aef3cc12775115a72	RUA EVENTUAL UNICA|50||UNAÍ|MG|	-16.3628767	-46.8924130	NOMINATIM	CIDADE	2026-07-18 23:40:00.38	\N	\N	\N	\N	\N
7ed7f205-89a8-4dfc-aa6e-2a19e1a1ad9d	66970b4ee9bfca93f26156b34b20867fac82c8c12215409b4f752d76f46bebcb	RUA SEM ORIGEM|10||UNAÍ|MG|	-16.3628767	-46.8924130	NOMINATIM	CIDADE	2026-07-18 23:40:48.177	\N	\N	\N	\N	\N
6d3b4013-bcb7-42fc-b31a-269b7d85692b	c1b14a891c861af24ab30221cc4443a69b8547d9a4afb46a154b4e12a376d6e0	RUA CALIXTO MARTINS DE MELO|2027|CENTRO|UNAÍ|MG|38610039	-16.3615447	-46.8988756	NOMINATIM	LOGRADOURO	2026-07-25 00:31:51.622	\N	\N	\N	\N	\N
e094f462-3310-4107-aa0a-81d1c8a825e6	a317883cb3de0d2aec16af37c511a6a772673e6af30a65ceb3af0bd9af79bb44	RUA CACHOEIRA|120|CENTRO|UNAÍ|MG|38610051	-16.3574688	-46.9000988	NOMINATIM	LOGRADOURO	2026-07-25 00:32:59.772	\N	\N	\N	\N	\N
f89cb5fd-8e16-4bbe-8a4b-63f7930a9ed5	ecbc121c4da523142353ad933f9a6c88eddfbc1eff394155b720a84a36ef5ff0	RUA EDUARDO RODRIGUES BARBOSA|475|CENTRO|UNAÍ|MG|38610061	-16.3559474	-46.9013985	NOMINATIM	LOGRADOURO	2026-07-25 02:16:25.31	\N	\N	\N	\N	\N
94e6f020-d0db-4bf7-8eeb-143e804284bc	f40e4912d567b54141dd977e1a9d7d9d44db5ae5049c5b43d59bb18ee7c54f56	AV DELVITO ALVES DA SILVA|215|DIVINEIA|UNAI|MG|38610000	-16.3745889	-46.8922959	NOMINATIM	LOGRADOURO	2026-07-25 02:16:40.59	\N	\N	\N	\N	\N
ef91e53c-2499-49ce-9f5d-644bf3955eda	e32c630fb0f558167007188efcf4c17fe0667fd8df673c8e83a6cbd26ee72189	RUA LÚCIA DE SOUZA RIBEIRO|100|RESIDENCIAL CURVA DO RIO|UNAÍ|MG|38620886	-16.3625062	-46.8979151	CAMPO	CAMPO	2026-07-17 13:48:27.602	\N	\N	3	588	2026-08-15 12:14:48.379
b6f7868c-8b86-4f3f-8254-24285c689261	33481120d1fa39a727dbb88717f4be3ebaeda9dd5996b77647aa7e0f71567258	RUA CALIXTO MARTINS MELO|475|CENTRO|UNAI|MG|38610000	-16.3624897	-46.8978999	CAMPO	CAMPO	2026-07-13 19:55:46.026	\N	\N	5	663	2026-08-15 02:23:50.821
8727cd37-199f-4d72-ba26-548286dca29d	d642999d1042f593b107fb044809a2d0065c7f7c9678d4f09c6281abc5c80fe6	RUA SANTA LUZIA|1414|N. SRA. AP.|UNAI|MG|38610000	-16.3625053	-46.8979222	CAMPO	CAMPO	2026-07-13 19:55:09.165	\N	\N	6	840	2026-08-15 12:23:17.508
c7e46c33-9b03-4add-bbf3-266ed5543e35	4f31e38d83dee90e0116167f37781fe3377cdf186a50511b19c7a29c84c78c83	RUA DOS JAMBOS|34|PRIMAVERA|UNAÍ|MG|38612122	-16.3616630	-46.8857702	NOMINATIM	LOGRADOURO	2026-07-25 02:56:00.553	\N	\N	\N	\N	\N
b5a4672e-939b-46a0-b580-afcaf9544e37	e22570e05b8741f80d51991db0a93f27588b04d4c314dc14fabff003708a2037	FAZ. INHUMAS, SN||ZONA RURAL|UNAI|MG|38610000	-16.3628767	-46.8924130	NOMINATIM	CIDADE	2026-07-25 02:59:09.497	\N	\N	\N	\N	\N
7057046d-3a72-4324-940b-6cbc9452cc5f	8bcb4ac5ff80e569536225cfab6ea94d6ab69a17a2e5a45de0579405474c8d5a	RUA MARIA GALDINA|104|NOVA CANAÃ|UNAÍ|MG|38616449	-16.3575000	-46.9061100	BRASILAPI_CEP	CEP	2026-08-15 01:49:20.805	\N	\N	\N	\N	\N
8ec20cb5-385c-4bd5-b043-6c63a62ac7ee	273f09191bc68ca43c29dc23c10ee9ff93791bfefefcfeba69402218e0e65480	RUA JOZINDA DOS SANTOS CALDEIRA|641|SAGRADA FAMILIA|UNAI|MG|38610000	-16.3654390	-46.8911082	MANUAL	MANUAL	2026-07-25 02:59:17.243	2026-07-25 02:59:52.011	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N
cdcfd228-b92f-480c-ab53-b2e934f5d581	8b7a9e93f781f78146d3c4617c6cd73f4b2c5f56eb60b1596f99b404818abcf3	RUA EDUARDO RODRIGUES BARBOSA|100|CENTRO|UNAÍ|MG|38610061	-16.3559474	-46.9013985	NOMINATIM	LOGRADOURO	2026-07-25 23:29:52.479	\N	\N	\N	\N	\N
7e3b6f2e-a6d4-4dfd-a133-3afdf6e9293a	70986839f936fa203c18289151de3c09736e487cf969bf6860a8c4f1826c5838	AVENIDA CASTELO BRANCO|34|BARROCA|UNAÍ|MG|38616072	-16.3677285	-46.9001249	NOMINATIM	LOGRADOURO	2026-07-26 13:12:21.534	\N	\N	\N	\N	\N
7f3cb3de-1e9b-45e3-8afb-ae3d13c6e804	468b4244f39f4b0193fde1815420a614dc86597d2e105ee536c9731d651574a1	AV CASTELO BRANCO|120|BARROCA|UNAI|MG|38616072	-16.3725492	-46.9018030	NOMINATIM	LOGRADOURO	2026-07-26 13:30:09.512	\N	\N	\N	\N	\N
7fb71bcb-b1ad-4a15-823d-3ad943fdbd0e	4ce0e1036d8151e9f33811ad940e05999e923f1389a0d7936b624110708e37c0	RUA CALIXTO MARTINS DE MELO|100|CENTRO|UNAÍ|MG|38610039	-16.3615447	-46.8988756	NOMINATIM	LOGRADOURO	2026-07-29 19:41:23.461	\N	\N	\N	\N	\N
b1723a3f-7641-4bd6-8456-e4f3a0f9f748	9affa21308ad9ae6326f6500939fb270b5fdf28e4ae773da25cb5527e81428f9	AVENIDA SÃO JOÃO|200|DIVINÉIA|UNAÍ|MG|38613416	-16.3716511	-46.8982320	NOMINATIM	LOGRADOURO	2026-08-06 12:51:19.373	\N	\N	\N	\N	\N
28c96962-5b3e-42fd-aa40-38bdcf7891e5	74d1c0e96289f0e4b77830a69bc1cbb8c63c8014cb2506b6f66bfeacbe7f0f8b	CHACARA DO ZE GALINHA|S/N|ZONA RURAL|UNAÍ|MG|	-16.3628767	-46.8924130	NOMINATIM	CIDADE	2026-08-06 12:54:28.352	\N	\N	\N	\N	\N
5dc32031-f49f-45d3-9099-75ad23448b75	652070fd67b523592b79e8a335a18471c1d816d7e60fdca94287649f55ee14d1	RUA A|||||	\N	\N	\N	\N	2026-08-09 18:59:34.808	\N	\N	\N	\N	\N
d244ae46-f729-40a0-b54c-8312c470e64a	aaa784c27caf3bb12726772c0c2ac14b87905f178e40cfd751307abd6be1c5a0	RUA B|||||	\N	\N	\N	\N	2026-08-09 18:59:34.829	\N	\N	\N	\N	\N
7d0df115-e1bb-4afc-95c0-4fc4963fede5	1947909ef2c3bdc02aac3e2884b46a18a1e624d4de93304b410b6a6771bebe3a	RUA TESTE ROTEIRO 6|||UNAÍ|MG|	-16.3628767	-46.8924130	NOMINATIM	CIDADE	2026-08-09 22:52:56.895	\N	\N	\N	\N	\N
6d417c01-310b-41a2-abd8-592846ea8443	7c3ccdde58b33409a979470d78f2b2fc14e1743cdd3c16611fa5993ce037b5b6	RUA TESTE ROTEIRO 6 B|||UNAÍ|MG|	-16.3628767	-46.8924130	NOMINATIM	CIDADE	2026-08-09 22:53:34.607	\N	\N	\N	\N	\N
456a6016-2783-4277-826d-8f08f1b14be6	32015ce6ff0f1fdd9c8ec1d1d22a4ccfc0a13ac102770bf96fe06948fae51202	RUA TESTE ROTEIRO 8, 100|||UNAÍ|MG|	-16.3628767	-46.8924130	NOMINATIM	CIDADE	2026-08-10 00:25:18.567	\N	\N	\N	\N	\N
65bd5f78-081a-4924-9909-79e7441af901	53b9d2367a362b90ced3412252ceb4d1974902fe8769be4a90db03f7e06a5d2e	RUA TESTE ROTEIRO 8, 200|||UNAÍ|MG|	-16.3628767	-46.8924130	NOMINATIM	CIDADE	2026-08-10 00:25:26.328	\N	\N	\N	\N	\N
92bd290e-8ef9-4038-9288-06dfe1073e0b	482532d6a140a40e8ada83fd5db93e8048bf058bd477693dd875425fa04d7ef4	RUA TESTE ROTEIRO 8|300||UNAÍ|MG|	-16.3628767	-46.8924130	NOMINATIM	CIDADE	2026-08-10 00:45:15.432	\N	\N	\N	\N	\N
9ddad803-f7b4-405e-a8fe-c3bba49716bf	09fc9f319a47922f76aad82b56dfcaf4b62196bb7ce5181d9ac83f524b16891c	RUA TESTE ROTEIRO 8|400||UNAÍ|MG|	-16.3628767	-46.8924130	NOMINATIM	CIDADE	2026-08-10 00:45:23.943	\N	\N	\N	\N	\N
4aba2cbb-c8f5-4cf4-9e0e-32e3c7614853	1664ab7b7e8463fb65370459baffb2e14778767f73198d938087068b61f921bd	RUA CALIXTO MARTINS DE MELO|475|CENTRO|UNAÍ|MG|38610039	-16.3575000	-46.9061100	BRASILAPI_CEP	CEP	2026-08-10 18:03:30.871	\N	\N	\N	\N	\N
6579cade-f327-47b8-b6a6-1f93b63ab122	67c9204bb583e47c0da7dd5b1e9b1f8a3004a75cfcd904433e711439d4c646d9	RUA CALIXTO MARTINS DE MELO|500|CENTRO|UNAÍ|MG|38610039	-16.3575000	-46.9061100	BRASILAPI_CEP	CEP	2026-08-10 18:04:05.629	\N	\N	\N	\N	\N
2a2d3521-dd89-424c-af46-5e4c0f5428f6	9effea3d198b5316f255e9772251d8e0b64332159ee13988f9dca8adf24c2010	RUA CANABRAVA|1416|CACHOEIRA|UNAI|MG|38610000	-16.3572994	-46.8928211	NOMINATIM	LOGRADOURO	2026-08-11 11:40:23.91	\N	\N	\N	\N	\N
64d28d38-fa87-4db7-b842-9599fbed55cb	7435869bb0c02804a7165e5b49645ee85bae26282c75571de2584de3c78c377f	RUA ARI LACERDA|165|NOVO HORIZONTE|UNAÍ|MG|38616502	-16.3575000	-46.9061100	BRASILAPI_CEP	CEP	2026-08-11 14:21:09.881	\N	\N	\N	\N	\N
08372703-9d32-4272-8e77-55698ecb3020	da64fa06d71944010b3e1f4b2df5dd12161b52dd64eaf843f488105c61d66ffb	AVENIDA CASTELO BRANCO|200|BARROCA|UNAÍ|MG|38613416	-16.3575000	-46.9061100	BRASILAPI_CEP	CEP	2026-08-11 14:21:19.601	\N	\N	\N	\N	\N
37edb17b-b0ba-455c-a52a-3978c172976f	7fd6b7b6fcdbb56f3fdc3e2d0d2cc9563ae8ac71257539dca497e27a1398463b	AVENIDA FREI ANSELMO|125|DIVINÉIA|UNAÍ|MG|38613431	-16.3575000	-46.9061100	BRASILAPI_CEP	CEP	2026-08-11 14:50:31.858	\N	\N	\N	\N	\N
66e9089f-1fa3-4f8e-a25f-6c29760aeea2	7f38951d8dd052ee0674c9ce05cd24c6c535172426367993b6b7b2fc468fa58f	AVENIDA QUINTINO F. SILVA|165|VALE VERDE|UNAI|MG|38610000	-16.3575406	-46.8861289	NOMINATIM	BAIRRO	2026-08-11 14:50:44.941	\N	\N	\N	\N	\N
41a942d8-8a62-4b9a-b0e2-901a2f6f003b	01111317e55831cefbc010141edcee88e7019bfcde8fd3640dbb6db75507a213	AVENIDA CASTELO BRANCO|120|BARROCA|UNAÍ|MG|38616072	-16.3685815	-46.8998053	CAMPO	CAMPO	2026-07-26 13:13:20.341	\N	\N	4	101	2026-08-15 00:51:27.902
4293374b-9984-450a-aa00-8048058ee6a5	961893d5ff77e2d218cc4115ec194902fb65f5a6f9f18ab71efba9fbe3710f7c	FAZ. PICO, SN||ZONA RURAL|UNAI|MG|38610000	-16.3624969	-46.8979114	CAMPO	CAMPO	2026-08-14 23:41:15.809	\N	\N	3	848	2026-08-15 02:13:17.287
039f4b1b-18c7-4a8b-884c-166eceaaadab	c40111b897cf0a23259f5c53c9a58ed737e4c4135749cad37a5579d41a5eb46d	RUA DO PICO|21|PRIMAVERA 5|UNAÍ|MG|38612244	-16.3624902	-46.8978974	CAMPO	CAMPO	2026-08-06 12:50:11.936	\N	\N	3	697	2026-08-15 02:24:20.794
6e01dd8a-b8f7-476d-8b07-b282ca1f4125	9b5d7d1d7d0f4bb78f16d00abb75aaa72e2baee8e849a6004a07cd0af2505690	RUA DJALMA TORRES|1293|CACHOEIRA|UNAÍ|MG|38610259	-16.3575000	-46.9061100	BRASILAPI_CEP	CEP	2026-08-21 18:48:12.532	\N	\N	\N	\N	\N
\.


--
-- Data for Name: local_cliente; Type: TABLE DATA; Schema: logistica; Owner: capul_user
--

COPY logistica.local_cliente (id, filial_id, cliente_matricula, cliente_nome, tipo, nome, municipio, lat_consolidada, long_consolidada, confianca, n_marcacoes, raio_dispersao_m, consolidado_em, enviado_protheus_em, ativo, criado_em) FROM stdin;
365c4362-8e70-4930-87cf-60a94435700f	d764d838-e177-421f-a79d-cb71abdbda83	A05749	LUCIANO AFONSO DE CAMPOS E SILVA	PROPRIEDADE	FAZENDA SALOBRO, SN	POMPEU	-16.3684997	-46.8998306	PROVISORIA	1	0	2026-07-17 14:02:23.911	\N	t	2026-07-17 14:02:23.895
1ffbc333-7e9f-4e18-ba7b-e009806d6648	d764d838-e177-421f-a79d-cb71abdbda83	C57980	MILKREME LATICINIOS LTDA	PROPRIEDADE	R SEBASTIAO VALADARES, N 283	POMPEU	-16.3684978	-46.8998160	PROVISORIA	1	0	2026-07-17 14:03:28.622	\N	t	2026-07-17 14:03:28.606
af3c3035-bdf4-4332-90e8-83c3c7cdca03	d764d838-e177-421f-a79d-cb71abdbda83	C48688	JULIO CESAR APARECIDO DE OLIVEIRA	PROPRIEDADE	FAZENDA SACO BONITO, SN	ABAETE	-16.3684657	-46.8998604	PROVISORIA	1	0	2026-07-17 14:35:50.522	\N	t	2026-07-17 14:35:50.51
59c1a695-4f72-40ef-b0f5-ce4c73de9d5d	d764d838-e177-421f-a79d-cb71abdbda83	C57854	FERNANDO AMARILDO DE CAMPOS	PROPRIEDADE	FAZENDA SALOBRO, SN	POMPEU	-16.3684323	-46.8996837	PROVISORIA	1	0	2026-07-17 14:36:03.346	\N	t	2026-07-17 14:36:00.739
8776d3e6-dcdd-4b97-8d8c-c7ae984dc497	d764d838-e177-421f-a79d-cb71abdbda83	C54364	ASSOC. COM. DOS MORADORES DE PEDRINHAS	PROPRIEDADE	FAZENDA PEDRINHAS, SN	ARINOS	-16.3624993	-46.8979177	PROVISORIA	1	0	2026-08-01 03:03:59.909	\N	t	2026-08-01 03:03:45.945
9faf5503-502b-4678-98f1-91fa2f78d7f1	d764d838-e177-421f-a79d-cb71abdbda83	C56503	ARNALDA CARDOZO DO VALE	PROPRIEDADE	PA RIACHO CLARO LOTE 24	ARINOS	-16.3625046	-46.8979087	PROVISORIA	1	0	2026-08-01 03:04:06.799	\N	t	2026-08-01 03:03:54.488
ba8a3c9d-7997-4180-b939-593ed082a0e2	d764d838-e177-421f-a79d-cb71abdbda83	C13493	AUGUSTO PEDRO CARDOZO	PROPRIEDADE	FAZENDA MUTUCA, SN	URUCUIA	-16.3625096	-46.8979015	PROVISORIA	1	0	2026-08-02 15:55:34.933	\N	t	2026-08-02 15:55:34.924
55ea2903-1304-4a42-88b4-2f49601c8c4a	d764d838-e177-421f-a79d-cb71abdbda83	A00086	HUMBERTO EUSTAQUIO DE QUEIROZ	PROPRIEDADE	FAZ. BOQUEIRAO, SN	UNAI	-16.3625101	-46.8979107	PROVISORIA	1	0	2026-08-23 01:37:33.286	\N	t	2026-08-23 01:37:33.271
10503e5c-76f4-4c2d-8530-f230c52613ab	d764d838-e177-421f-a79d-cb71abdbda83	C57892	18.303.345 MARCOS ANTONIO SANTOS ALMEIDA	PROPRIEDADE	R DO QUIMICO, N 57	UNAI	-16.3625102	-46.8979084	PROVISORIA	2	1	2026-08-02 20:12:04.888	\N	t	2026-08-01 03:03:39.322
a4afc5a7-baa6-4c84-a197-794634b2e0b0	d764d838-e177-421f-a79d-cb71abdbda83	C49082	ACOUGUE SANTO ANTONIO UNAI LTDA	PROPRIEDADE	AV JOSE LUIZ ADJUTO, 719	UNAI	-16.3625105	-46.8978946	PROVISORIA	1	0	2026-08-02 20:12:19.959	\N	t	2026-08-02 20:12:19.948
6aa14f1e-071a-4813-b32e-62c018f3feeb	d764d838-e177-421f-a79d-cb71abdbda83	A02213	GABRIEL MENDES CORNELIO	PROPRIEDADE	FAZ. MACAUBAS, SN	UNAI	-16.3684919	-46.8998418	PROVISORIA	1	0	2026-08-01 03:06:58.681	\N	t	2026-07-27 20:49:17.77
73a6439e-1ce1-4ac7-b995-19e5de8eb222	d764d838-e177-421f-a79d-cb71abdbda83	A04517	ADAO PEDRO GONCALVES	PROPRIEDADE	FAZ. CONFINS, SN	RIACHINHO	-16.3624785	-46.8979319	PROVISORIA	1	0	2026-08-01 03:48:01.452	\N	t	2026-08-01 03:48:01.441
15a23ff9-4ea7-4b65-b7e7-7e2cec834282	d764d838-e177-421f-a79d-cb71abdbda83	A02710	ADELTON JOSE CAXITO	PROPRIEDADE	FAZ. P.A SANTA CLARA/FURADINHO, SN	UNAI	-16.3625998	-46.8978982	PROVISORIA	1	0	2026-08-01 03:54:22.352	\N	t	2026-08-01 03:54:22.341
6bed5a45-048b-43ac-b779-697ae013aa3c	d764d838-e177-421f-a79d-cb71abdbda83	C50676	51499292 CARLOS ALBERTO SUARES A SILVA F	PROPRIEDADE	AV LISBOA, 127	UNAI	-16.3625384	-46.8979016	PROVISORIA	1	0	2026-08-01 03:54:26.24	\N	t	2026-08-01 03:54:26.226
275925a5-d1b7-4fac-9aa2-359b4a384b50	d764d838-e177-421f-a79d-cb71abdbda83	C48822	CELMA ANDREIA DIOGO DOS SANTOS	PROPRIEDADE	ESTRADA ARINOS/URUCUIA 22KM DIREITA 7KM	ARINOS	-16.3624981	-46.8979175	PROVISORIA	1	0	2026-08-02 20:12:34.081	\N	t	2026-08-02 20:12:34.07
a3f4ce9d-5152-4c07-80a8-108aa04d2e09	d764d838-e177-421f-a79d-cb71abdbda83	C17492	ADALTO ANTONIO ARAUJO	PROPRIEDADE	RUA GERALDO FURTADO DOS SANTOS, 84	UNAI	-16.3625051	-46.8979179	PROVISORIA	1	0	2026-08-02 20:12:57.424	\N	t	2026-08-02 20:12:57.414
be277250-0ed8-4757-bec3-24df49557479	d764d838-e177-421f-a79d-cb71abdbda83	E02336	LIDYANE APARECIDA COSTA GONCALVES ROCHA	PROPRIEDADE	RUA DOMINGOS PINTO BROCH,287	UNAI	-16.3625188	-46.8978884	PROVISORIA	1	0	2026-08-02 20:22:00.168	\N	t	2026-08-02 20:22:00.156
31c6520e-8da4-4a9b-ac82-85daa7c2de6f	d764d838-e177-421f-a79d-cb71abdbda83	A05762	CLENIO MARCOS MENDES	PROPRIEDADE	FAZ. INHUMAS, SN	UNAI	-16.3625050	-46.8979083	CONFIRMADA	3	8	2026-08-23 01:37:33.334	\N	t	2026-08-01 14:34:39.111
f3c841d6-d6e6-4280-8a35-f9b66bf4ba60	d764d838-e177-421f-a79d-cb71abdbda83	A00086	HUMBERTO EUSTAQUIO DE QUEIROZ	PROPRIEDADE	FAZ. CAPAO DO ARROZ/RIACHO, SN	UNAI	-16.3684923	-46.8998438	PROVISORIA	2	1	2026-08-23 01:49:26.619	\N	t	2026-07-27 20:49:10.072
7d90dabd-3675-4467-a061-935f9831498a	d764d838-e177-421f-a79d-cb71abdbda83	E02460	TATIANE ALVES DE OLIVEIRA	PROPRIEDADE	RUA PARACATU,402 AP02	UNAI	-16.3625115	-46.8978886	PROVISORIA	1	0	2026-08-02 20:13:32.876	\N	t	2026-08-02 20:13:32.866
5f259e9c-1328-4bf1-94e8-4b464d7d26b8	d764d838-e177-421f-a79d-cb71abdbda83	C02521	VALDIRENE ALVES DE LIMA	PROPRIEDADE	RUA BENTIVI, 466	UNAI	-16.3625095	-46.8979018	PROVISORIA	1	0	2026-08-02 20:14:05.167	\N	t	2026-08-02 20:14:05.155
dd800a42-068c-49e7-89f3-bae76f80af3c	d764d838-e177-421f-a79d-cb71abdbda83	E02533	VALDIRENE MENDES FERREIRA	PROPRIEDADE	RUA ANTONIO BROCHADO, 1409	UNAI	-16.3625089	-46.8979121	PROVISORIA	1	0	2026-08-02 20:16:58.131	\N	t	2026-08-02 20:16:58.119
16d4cea5-760f-460c-83fb-23ee08845aec	d764d838-e177-421f-a79d-cb71abdbda83	C52945	ADALTO DE JESUS LEMOS	PROPRIEDADE	RUA ROMILDO ALVES , 55	BRASILANDIA DE MINAS	-16.3625089	-46.8979152	PROVISORIA	1	0	2026-08-02 20:22:29.324	\N	t	2026-08-02 20:22:29.312
0c0af13a-da98-4191-9143-f01e0a5c9ed1	d764d838-e177-421f-a79d-cb71abdbda83	A05014	ADAILSON ALVES DE ALMEIDA	PROPRIEDADE	FAZ. PICO/RABO FINO, SN	UNAI	-16.3684904	-46.8998351	PROVISORIA	1	0	2026-08-03 20:35:48.589	\N	t	2026-08-03 20:35:48.581
321cc0dc-c169-4ec9-9335-ea2268d439f2	d764d838-e177-421f-a79d-cb71abdbda83	A00850	DIRCEU JULIO GATTO	PROPRIEDADE	FAZ. BURITI, SN	UNAI	-16.3684823	-46.8998540	PROVISORIA	1	0	2026-08-03 20:36:05.355	\N	t	2026-08-03 20:36:05.347
aeefe928-2578-4338-8ae3-0c00018f5c98	d764d838-e177-421f-a79d-cb71abdbda83	A02027	VALDINEI PAULO DE OLIVEIRA	PROPRIEDADE	FAZ. PICO, SN	UNAI	-16.3625050	-46.8979065	CONFIRMADA	7	2	2026-08-23 01:35:36.179	\N	t	2026-08-01 03:06:38.436
8b14cc0c-a2fe-4af2-9a4e-37b1cbd93d9c	d764d838-e177-421f-a79d-cb71abdbda83	A04721	MARIA NEUZA MENDES	PROPRIEDADE	FAZ. INHUMAS, SN	UNAI	-16.3624987	-46.8979140	CONFIRMADA	4	2	2026-08-23 01:35:47.163	\N	t	2026-08-01 03:06:44.73
\.


--
-- Data for Name: local_parada; Type: TABLE DATA; Schema: logistica; Owner: capul_user
--

COPY logistica.local_parada (id, nome, ativo, criado_em, filial_id, departamento_id, veiculo_id) FROM stdin;
\.


--
-- Data for Name: manutencao_veiculo; Type: TABLE DATA; Schema: logistica; Owner: capul_user
--

COPY logistica.manutencao_veiculo (id, veiculo_id, tipo, km, data_manutencao, motivo, custo, reiniciou_ciclo, km_proxima_gerada, registrado_por_id, criado_em, despesa_id) FROM stdin;
550f6578-f336-45b8-b725-10503215b0ff	1e3ff606-9dc8-4cfc-8b70-fb5cc092e9c7	PREVENTIVA	30410	2026-07-12 17:44:39.882	Teste QA regressão Gestor	\N	t	\N	43920ca6-69c8-42c3-91bc-3f25d90aa64d	2026-07-12 17:44:39.883	\N
637c51e7-ae1a-4775-b04f-f3eb10206740	185fa4e1-792a-405b-9d68-7afb59bdcb5f	CORRETIVA	150	2026-07-13 00:00:00	REVISAO	\N	f	\N	5fb815a5-8170-44d3-8722-c4d233165682	2026-07-13 13:34:09.517	\N
10a42371-58ef-4344-ae67-55e1b487e442	298f284c-9258-4a57-a211-3f5bd574defd	CORRETIVA	190	2026-07-11 00:00:00	Troca de correia dentada (quebra inesperada)	90.00	f	\N	43920ca6-69c8-42c3-91bc-3f25d90aa64d	2026-07-11 13:58:55.208	c96b1166-abcf-439c-ba7d-c52aae22a03e
24d0256e-605b-43cb-8bf1-391b652427f0	298f284c-9258-4a57-a211-3f5bd574defd	PREVENTIVA	190	2026-07-11 00:00:00	Revisão preventiva de rotina	150.00	t	\N	43920ca6-69c8-42c3-91bc-3f25d90aa64d	2026-07-11 13:58:17.892	5dcde2a0-8d5f-4dc6-a298-c79e58deafb2
\.


--
-- Data for Name: parada; Type: TABLE DATA; Schema: logistica; Owner: capul_user
--

COPY logistica.parada (id, viagem_id, sequencia, entrega_id, local, latitude, longitude, km, data_hora, observacao, registrado_em, status, planejado_local, realizada_em, idempotency_key, atividade_id, cliente_matricula, cliente_nome, municipio, propriedade, local_cliente_id, precisao_m, no_local, motivo_pulada) FROM stdin;
2f009246-8741-4354-9445-afe507adc4c7	433e2817-304b-432e-aee5-0bda9a7df865	1	\N	VALDINEI PAULO DE OLIVEIRA (A02027) — FAZ. PICO, SN, ZONA RURAL, UNAI/MG	\N	\N	\N	\N	\N	2026-07-08 18:56:37.119	PLANEJADA	VALDINEI PAULO DE OLIVEIRA (A02027) — FAZ. PICO, SN, ZONA RURAL, UNAI/MG	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
1728128b-1b16-43b7-833f-34ddccb33d97	433e2817-304b-432e-aee5-0bda9a7df865	2	\N	FABRICA	\N	\N	\N	\N	\N	2026-07-08 18:56:37.119	PLANEJADA	FABRICA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
aabdeacc-bd7f-4c96-9ddb-9d7b6141fe31	4e5bccc2-f0b1-40b7-a68c-4c07c72db717	1	\N	\N	-16.3624913	-46.8979060	\N	2026-08-01 14:53:53.453	Clenio anotacao	2026-08-01 14:53:53.454	REALIZADA	\N	\N	\N	\N	A02027	VALDINEI PAULO DE OLIVEIRA	UNAI	FAZ. PICO, SN	aeefe928-2578-4338-8ae3-0c00018f5c98	16	t	\N
4c9fd911-066c-46c9-bb3e-af5f5c716bac	ccd8475c-e536-4cbe-9b1b-de0785db37c5	1	\N	\N	\N	\N	\N	2026-08-01 15:00:00	Teste roteiro 4.7 - cliente confirmou pedido	2026-08-02 00:45:55.426	REALIZADA	\N	\N	\N	\N	C06645	ANTONIO VALDINEI ALVES	MONTE AZUL	FAZENDA POCO PRETO, SN	\N	\N	\N	\N
f5fc8a25-1644-4ef8-b432-b82c076f2639	c9189912-d97c-401c-8748-215804e0889d	1	\N	ADRIANO DE CAMPOS MACIEL (A05222) — FAZ. VARGEM BONITA DE BAIXO, SN, ZONA RURAL, UNAI/MG	\N	\N	145	2026-07-09 18:50:51.373	\N	2026-07-09 18:26:46.824	REALIZADA	ADRIANO DE CAMPOS MACIEL (A05222) — FAZ. VARGEM BONITA DE BAIXO, SN, ZONA RURAL, UNAI/MG	2026-07-09 18:50:51.373	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
a034d756-1fe3-4846-9101-9d6148134615	a5403915-2303-412f-abab-3cc4d30f2149	1	\N	RAIMUNDO SAUER (A02938) — FAZ. TROMBAS, SN, ZONA RURAL, CABECEIRA GRANDE/MG	\N	\N	150	2026-07-10 15:59:30.044	\N	2026-07-09 18:28:00.702	REALIZADA	RAIMUNDO SAUER (A02938) — FAZ. TROMBAS, SN, ZONA RURAL, CABECEIRA GRANDE/MG	2026-07-10 15:59:30.044	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
d0f64d85-b969-4951-ba1b-31aa9a47cd73	e49c1893-eba9-4016-9a61-f7c3dcc84887	1	f204ccfc-b646-4885-b248-0bea8fc48dd1	\N	\N	\N	\N	\N	\N	2026-07-11 23:23:28.873	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
0a70797d-d341-46bc-a412-e06ce7c95630	7368cbdf-0b95-4b33-aa2b-feaeb53cbadc	2	\N	\N	-16.3625096	-46.8979015	\N	2026-08-02 14:23:39.37	\N	2026-08-02 14:23:39.371	REALIZADA	\N	\N	\N	\N	C13493	AUGUSTO PEDRO CARDOZO	URUCUIA	FAZENDA MUTUCA, SN	ba8a3c9d-7997-4180-b939-593ed082a0e2	14	t	\N
7edf4e44-b234-4bf6-bb0f-61d37e6205e6	e49c1893-eba9-4016-9a61-f7c3dcc84887	3	94c5c157-b79b-4315-8013-17bb82be05a3	\N	\N	\N	\N	\N	\N	2026-07-11 23:23:28.873	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
40d9caf9-5c81-435b-ba62-fa95cdd9a71f	e49c1893-eba9-4016-9a61-f7c3dcc84887	4	09b0b20d-896e-4361-96ba-b3bb85894c2b	\N	\N	\N	\N	\N	\N	2026-07-11 23:23:28.873	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
0c8e057a-c938-478e-99b0-f92e5801199c	e49c1893-eba9-4016-9a61-f7c3dcc84887	2	\N	Entrega #4 — Pedro Almeida	\N	\N	\N	\N	Não entregue (tentativa 1): Cliente ausente no momento da entrega	2026-07-11 23:23:28.873	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
97a5f59c-3832-42a6-a19b-6cf09c33a96d	f02d9aea-20bf-4cb7-8082-66b6c5083cc0	2	\N	\N	-16.3625105	-46.8978946	\N	2026-08-02 14:24:35.677	\N	2026-08-02 14:24:35.678	REALIZADA	\N	\N	\N	\N	C49082	ACOUGUE SANTO ANTONIO UNAI LTDA	UNAI	AV JOSE LUIZ ADJUTO, 719	a4afc5a7-baa6-4c84-a197-794634b2e0b0	20	t	\N
4b40ad6a-6d8c-4d74-8319-26581df06523	2f1ec1e7-dcdd-45f3-8cdb-af8a02b72bdd	1	\N	\N	-16.3625115	-46.8978886	\N	2026-08-02 15:23:11.992	\N	2026-08-02 15:23:11.992	REALIZADA	\N	\N	\N	\N	E02460	TATIANE ALVES DE OLIVEIRA	UNAI	RUA PARACATU,402 AP02	7d90dabd-3675-4467-a061-935f9831498a	14	t	\N
6df8c450-6b8b-42f3-9594-0f94e0ac16ee	2f1ec1e7-dcdd-45f3-8cdb-af8a02b72bdd	2	\N	\N	-16.3625095	-46.8979018	\N	2026-08-02 15:23:20.608	\N	2026-08-02 15:23:20.608	REALIZADA	\N	\N	\N	\N	C02521	VALDIRENE ALVES DE LIMA	UNAI	RUA BENTIVI, 466	5f259e9c-1328-4bf1-94e8-4b464d7d26b8	16	t	\N
e710e536-549b-435e-9623-4961c1b42a3b	1c028432-b6ee-4177-a47a-d276ef97feaa	4	\N	\N	-16.3684919	-46.8998796	\N	2026-08-03 20:35:34.874	Cliente 200 cabeça corte	2026-08-03 20:35:34.875	REALIZADA	\N	\N	8592f63d-afa0-483f-8522-381b12f7ced9	eba206cf-207b-4197-9d65-b69af1b72bb9	\N	Luiz antonio	Unai	\N	\N	11	t	\N
aacd364b-cb8a-4753-af98-0a3b3591ae88	14807237-1f69-4de7-9ccf-2f4f8e7f07ac	3	\N	\N	-16.3684938	-46.8998330	\N	2026-08-05 19:49:01.145	\N	2026-08-05 19:49:01.145	REALIZADA	\N	\N	\N	\N	A02213	GABRIEL MENDES CORNELIO	UNAI	FAZ. MACAUBAS, SN	\N	20	f	\N
da787f72-81c1-495c-b51c-8262512c1669	126a83c9-8f08-44d4-9419-cad69bfc2193	1	af7ab49f-3ec3-4b8d-b640-1a2c754fe221	\N	\N	\N	\N	\N	\N	2026-08-06 13:09:22.906	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
b409308c-5da9-4535-b951-541abc772459	126a83c9-8f08-44d4-9419-cad69bfc2193	2	53f30e8c-300b-4f70-aa18-4960b5e4226b	\N	\N	\N	\N	\N	\N	2026-08-06 13:09:22.906	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
dbeb0358-9545-46d9-afec-4e6c6f489856	33136350-2755-426e-b93a-00d2eac228f0	1	\N	ANTONIO ALVES PEREIRA (A06673) — FAZ. GLEBA DO GADO BRAVO, SN, ZONA RURAL, DOM BOSCO/MG	\N	\N	\N	2026-07-13 13:38:57.476	\N	2026-07-13 13:35:29.229	REALIZADA	ANTONIO ALVES PEREIRA (A06673) — FAZ. GLEBA DO GADO BRAVO, SN, ZONA RURAL, DOM BOSCO/MG	2026-07-13 13:38:57.476	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
20728f6f-e6f0-476b-9b5b-4ef976376f86	fad33b4a-d314-4c19-9e29-ea83b149c233	1	d2faaa20-4d91-40ad-8a80-00776161e140	\N	\N	\N	\N	\N	\N	2026-07-13 20:00:37.109	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
64fd9ebb-6784-4469-bd56-1084874a8873	fad33b4a-d314-4c19-9e29-ea83b149c233	2	9eca594c-5e2e-45b7-987b-c7852253e01b	\N	\N	\N	\N	\N	\N	2026-07-13 20:00:37.109	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
da4dca77-0a45-4def-9dee-00abcfa9ffd7	fad33b4a-d314-4c19-9e29-ea83b149c233	3	fc644086-17cd-4ce8-b6a9-96517d6b2452	\N	\N	\N	\N	\N	\N	2026-07-13 20:00:37.109	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9c34f82a-9ea7-4ba4-ba35-919c5bc0e3c7	fad33b4a-d314-4c19-9e29-ea83b149c233	4	15d1caa8-9613-4098-b78f-7fc0156187f0	\N	\N	\N	\N	\N	\N	2026-07-13 20:00:37.109	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
d3d0332b-98f1-46d2-b1f8-c7126edc5abb	fad33b4a-d314-4c19-9e29-ea83b149c233	5	1ed42b3e-fb4b-4910-982c-a6a044f14c51	\N	\N	\N	\N	\N	\N	2026-07-13 20:00:37.109	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4ae3252b-4f89-4b00-9690-adb58af37f6c	f52ef6d7-d0bd-4fea-a164-a2d39e3d679e	1	\N	COOP. AGROPECUARIA VALE RIO DOCE LTDA (A05370) — AVENIDA RIO BAIHA S/N KM, 415, PLANALTO, GOVERNADOR VALA/MG	\N	\N	\N	\N	\N	2026-07-14 12:55:38.269	PLANEJADA	COOP. AGROPECUARIA VALE RIO DOCE LTDA (A05370) — AVENIDA RIO BAIHA S/N KM, 415, PLANALTO, GOVERNADOR VALA/MG	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
47958e0b-a362-46c7-b7e9-edff7692e53f	f52ef6d7-d0bd-4fea-a164-a2d39e3d679e	2	\N	COOPERATIVA AGROPECUARIA UNAI LTDA (F00051) — RUA PREFEITO JOAO COSTA, 1455, PLANALTO, UNAI/MG	\N	\N	\N	\N	\N	2026-07-14 12:55:38.269	PLANEJADA	COOPERATIVA AGROPECUARIA UNAI LTDA (F00051) — RUA PREFEITO JOAO COSTA, 1455, PLANALTO, UNAI/MG	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
3f247556-ff37-42bf-8aac-f78978ee2d02	f52ef6d7-d0bd-4fea-a164-a2d39e3d679e	3	\N	TRES MARIA	\N	\N	\N	\N	\N	2026-07-14 12:55:38.269	PLANEJADA	TRES MARIA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
c78afa79-3905-44aa-9695-ae4cab1712fb	f52ef6d7-d0bd-4fea-a164-a2d39e3d679e	4	\N	JOAO PINHEIRO	\N	\N	\N	\N	\N	2026-07-14 12:55:38.269	PLANEJADA	JOAO PINHEIRO	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
950b9306-15b9-490c-a2c2-daddfd8bddf3	f52ef6d7-d0bd-4fea-a164-a2d39e3d679e	5	\N	PARACATU	\N	\N	\N	\N	\N	2026-07-14 12:55:38.269	PLANEJADA	PARACATU	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
677c5863-44ed-44b6-9a40-471402f49e4a	4d457e4d-7fc1-4f30-ab5f-acb805bc5586	1	\N	COOP. AGROPECUARIA VALE RIO DOCE LTDA (A05370) — AVENIDA RIO BAIHA S/N KM, 415, PLANALTO, GOVERNADOR VALA/MG	\N	\N	\N	\N	\N	2026-07-14 13:00:08.406	PLANEJADA	COOP. AGROPECUARIA VALE RIO DOCE LTDA (A05370) — AVENIDA RIO BAIHA S/N KM, 415, PLANALTO, GOVERNADOR VALA/MG	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
c758ce6f-7814-4b2f-8426-03126c2a3e69	4d457e4d-7fc1-4f30-ab5f-acb805bc5586	2	\N	COOPERATIVA AGROPECUARIA UNAI LTDA (F00051) — RUA PREFEITO JOAO COSTA, 1455, PLANALTO, UNAI/MG	\N	\N	\N	\N	\N	2026-07-14 13:00:08.406	PLANEJADA	COOPERATIVA AGROPECUARIA UNAI LTDA (F00051) — RUA PREFEITO JOAO COSTA, 1455, PLANALTO, UNAI/MG	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
77b699e4-971d-45e9-b17c-e7424b0f3f46	126a83c9-8f08-44d4-9419-cad69bfc2193	3	ca454d9e-a036-436d-b7c0-9d3e67a75c07	\N	\N	\N	\N	\N	\N	2026-08-06 13:09:22.906	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
11f3b331-b0b0-411e-949f-9647b231c718	b62e542e-8319-47e4-9691-36b47c8678cb	1	0b661b73-7740-492c-be50-09804fc81c1f	\N	\N	\N	\N	\N	\N	2026-08-10 00:28:21.035	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
01f7c6e7-7a75-4611-acfb-e04317f70c02	b62e542e-8319-47e4-9691-36b47c8678cb	2	09ad46a9-9dcd-438d-ac91-04ed340f8c53	\N	\N	\N	\N	\N	\N	2026-08-10 00:28:21.035	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
498fb5af-1fa5-4333-b2d8-055eb356ae0a	4e5bccc2-f0b1-40b7-a68c-4c07c72db717	2	\N	\N	-16.3625035	-46.8979165	\N	2026-08-01 14:53:57.741	Clenio anotacao	2026-08-01 14:53:57.742	REALIZADA	\N	\N	\N	\N	A04721	MARIA NEUZA MENDES	UNAI	FAZ. INHUMAS, SN	8b14cc0c-a2fe-4af2-9a4e-37b1cbd93d9c	16	t	\N
7293d50a-4720-42f5-82b7-39bd19d5c1c6	7368cbdf-0b95-4b33-aa2b-feaeb53cbadc	1	\N	\N	-16.3625083	-46.8978943	\N	2026-08-02 14:23:32.961	Clenio	2026-08-02 14:23:32.962	REALIZADA	\N	\N	\N	\N	A02027	VALDINEI PAULO DE OLIVEIRA	UNAI	FAZ. PICO, SN	aeefe928-2578-4338-8ae3-0c00018f5c98	15	t	\N
345c7a7d-722c-44d3-a106-e1e77e5e8dd1	7368cbdf-0b95-4b33-aa2b-feaeb53cbadc	3	\N	\N	\N	\N	\N	2026-08-02 14:23:49.8	Clenio	2026-08-02 14:23:49.8	REALIZADA	\N	\N	\N	\N	C31037	JOAO PAULO PEREIRA	SAO FRANCISCO	RUA LOURENCO DE CARVALHO, 518	\N	\N	\N	\N
17cf4121-0f2f-4c90-8d6b-ff9395efa8eb	f02d9aea-20bf-4cb7-8082-66b6c5083cc0	5	\N	\N	\N	\N	\N	2026-08-02 15:07:09.105	\N	2026-08-02 15:07:09.106	REALIZADA	\N	\N	\N	\N	C48293	JOAO ANILTON RIBEIRO DE SOUZA	ARINOS	ASSEN RIACHO CLARO, LT 10	\N	\N	\N	\N
b1bc2679-3463-4e7d-aa5e-8b0426b51711	1c028432-b6ee-4177-a47a-d276ef97feaa	1	\N	\N	-16.3685044	-46.8998282	\N	2026-08-03 20:31:34.517	Cliente	2026-08-03 20:31:34.518	REALIZADA	\N	\N	\N	\N	A02027	VALDINEI PAULO DE OLIVEIRA	UNAI	FAZ. PICO, SN	aeefe928-2578-4338-8ae3-0c00018f5c98	13	t	\N
2a1f1eb6-3ba3-4a6c-81c9-c8a66e85147b	15e6a273-9127-465b-85ed-a826c38893aa	1	b0c241e7-13ab-4d5d-87ae-214d786ed51e	\N	\N	\N	\N	\N	\N	2026-07-16 18:53:04.112	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
902bf3a3-75a2-4e1b-bd3c-d575431f9611	15e6a273-9127-465b-85ed-a826c38893aa	2	6cbe4df2-7860-404d-858e-5aaf3edd05ee	\N	\N	\N	\N	\N	\N	2026-07-16 18:53:04.112	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
03d3e5ea-cfa5-497d-a347-264f414943fb	15e6a273-9127-465b-85ed-a826c38893aa	3	dd63b899-2ee9-4006-89a8-8a71863d6f2c	\N	\N	\N	\N	\N	\N	2026-07-16 18:53:04.112	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
b6359977-791f-47b9-967c-52a1ff7f8420	15e6a273-9127-465b-85ed-a826c38893aa	4	49552006-8e83-44ad-a41b-14cfeb38819d	\N	\N	\N	\N	\N	\N	2026-07-16 18:53:04.112	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
63cd2726-bf20-435e-92aa-6cc830ca1835	15e6a273-9127-465b-85ed-a826c38893aa	5	5e5372d8-0613-4d53-bbee-3a24729610f7	\N	\N	\N	\N	\N	\N	2026-07-16 18:53:04.112	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
ea7b81aa-aac7-4c8c-8a2e-9c296d80694c	2274ce0b-e46e-4ab3-8499-10e8810767ec	1	822c1f9d-446e-49e1-b425-a29414f393ff	\N	\N	\N	\N	\N	\N	2026-07-16 19:06:55.372	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
53ded497-a03f-4483-8bfa-74f41ba654b2	2274ce0b-e46e-4ab3-8499-10e8810767ec	2	293e2a99-5442-4e3c-bb73-7fdf0471e437	\N	\N	\N	\N	\N	\N	2026-07-16 19:06:55.372	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
e94c86fe-4629-4856-902c-298e4de8ef77	2274ce0b-e46e-4ab3-8499-10e8810767ec	3	32b0307a-e0d9-4c1b-9b7a-292264c7e05a	\N	\N	\N	\N	\N	\N	2026-07-16 19:06:55.372	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
cb54ec05-2257-4561-991b-b4da51eb09ad	2274ce0b-e46e-4ab3-8499-10e8810767ec	4	390f735c-72e1-4a28-b77d-2c2b237cbfe4	\N	\N	\N	\N	\N	\N	2026-07-16 19:06:55.372	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
78324cae-ec33-4065-9932-e6ade9b1a448	2274ce0b-e46e-4ab3-8499-10e8810767ec	5	d2c94f2a-1acc-4a1e-abcc-0226894b603c	\N	\N	\N	\N	\N	\N	2026-07-16 19:06:55.372	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4f3146e3-a749-4770-8364-1b2b28c6ee03	2274ce0b-e46e-4ab3-8499-10e8810767ec	6	4bf35988-c620-4f7c-a5b4-b97a4f77696a	\N	\N	\N	\N	\N	\N	2026-07-16 19:06:55.372	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
68051fcc-67a9-4932-9fce-992c88c8d178	2274ce0b-e46e-4ab3-8499-10e8810767ec	7	2bc46547-019b-4a85-81af-9bc403b7eaf1	\N	\N	\N	\N	\N	\N	2026-07-16 19:06:55.372	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4c2d570f-13ee-461c-8cd3-82c41698368b	2274ce0b-e46e-4ab3-8499-10e8810767ec	8	040d4bf2-172e-498f-af94-4800e7d9a6fc	\N	\N	\N	\N	\N	\N	2026-07-16 19:06:55.372	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5de3a0e9-ffdd-4dc1-953b-9c293122c2e6	c2b7060a-8f0e-4f68-a33f-e72ce1f0f5c2	1	6e0ad0d4-7459-4f4c-84ab-351f038c3179	\N	\N	\N	\N	\N	\N	2026-07-16 19:15:10.079	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4ee6f3a0-6839-4dbc-846c-59bdaa7b1c83	c2b7060a-8f0e-4f68-a33f-e72ce1f0f5c2	2	cd478c38-7342-41ae-a780-244594828912	\N	\N	\N	\N	\N	\N	2026-07-16 19:15:10.079	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
21e7b425-8576-4e6f-aa70-1c70f07bda1a	c2b7060a-8f0e-4f68-a33f-e72ce1f0f5c2	3	0522f681-0ec3-45c1-ad27-f2c5b7b37d94	\N	\N	\N	\N	\N	\N	2026-07-16 19:15:10.079	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
23d14fd5-2c33-46dc-9e0c-f05417c98f11	c2b7060a-8f0e-4f68-a33f-e72ce1f0f5c2	4	33a5b6e0-e0fc-4faf-8409-c0ceaf01cc6b	\N	\N	\N	\N	\N	\N	2026-07-16 19:15:10.079	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
1c193b33-61ba-4204-92b5-f07de5a2f9e4	c2b7060a-8f0e-4f68-a33f-e72ce1f0f5c2	5	3e2d75db-e010-4183-93c6-02539d91fcb4	\N	\N	\N	\N	\N	\N	2026-07-16 19:15:10.079	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5fb9f893-5347-4bf7-97c8-e1cb517d6e10	c2b7060a-8f0e-4f68-a33f-e72ce1f0f5c2	6	c02df7f4-a9e8-4f3f-8c2d-4f1f22459468	\N	\N	\N	\N	\N	\N	2026-07-16 19:15:10.079	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
af7f6b12-c0b5-4392-aba7-6b06bab6589f	c2b7060a-8f0e-4f68-a33f-e72ce1f0f5c2	7	f47d566e-6ca0-4f40-92e8-99c5484793e6	\N	\N	\N	\N	\N	\N	2026-07-16 19:15:10.079	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
74fa5061-00c3-4d01-8d18-4f1eea0b6e27	d0863807-9da6-4edb-bc41-dbe7eafb4f3b	1	fcd8b0cb-ee5a-4ee9-8011-62e4d725c507	\N	\N	\N	\N	\N	\N	2026-07-16 19:29:23.545	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
67ec8c0f-a24b-4b72-80c7-10767b08f057	d0863807-9da6-4edb-bc41-dbe7eafb4f3b	2	04bb2316-9a23-429b-8b66-c3d6b54ead5d	\N	\N	\N	\N	\N	\N	2026-07-16 19:29:23.545	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
f62027d8-5228-43b1-9782-c87fa47e854e	d0863807-9da6-4edb-bc41-dbe7eafb4f3b	3	ee37f2ab-f4d9-43b8-ac08-f4df79b426cc	\N	\N	\N	\N	\N	\N	2026-07-16 19:29:23.545	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
912f5cb0-70f3-4f03-b350-ac2763514fc3	d0863807-9da6-4edb-bc41-dbe7eafb4f3b	4	e9cfd0bf-55d0-469c-9d30-c36ddca12197	\N	\N	\N	\N	\N	\N	2026-07-16 19:29:23.545	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
f7f2074a-fcb0-442b-845a-5a5c5f512c99	d0863807-9da6-4edb-bc41-dbe7eafb4f3b	5	ddcacada-4139-4e35-9fca-ab12c609c8f5	\N	\N	\N	\N	\N	\N	2026-07-16 19:29:23.545	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
36592dd3-c102-4e0d-b60c-3054f3f3ffa3	3e8d99fe-48ed-4ffc-875b-025927fd5067	1	c60df025-bff9-49b6-a6eb-d6e063dd01e0	\N	\N	\N	\N	\N	\N	2026-07-16 19:32:04.018	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
25f9ff84-af81-437c-959c-df5ad1490c39	3e8d99fe-48ed-4ffc-875b-025927fd5067	2	387f7a84-2836-4512-a28a-a4d362cb537c	\N	\N	\N	\N	\N	\N	2026-07-16 19:32:04.018	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
d21aa18d-9866-40b5-afbc-eab5cb8cd727	3e8d99fe-48ed-4ffc-875b-025927fd5067	3	9deb4885-6725-4272-8b65-7b86573ac569	\N	\N	\N	\N	\N	\N	2026-07-16 19:32:04.018	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
d7949c1b-0e7c-4a55-9bf0-cbf7f5539da7	bb55baee-4422-4df4-af91-3d080169a43d	1	96da6b9a-f26d-4710-ad26-2f8b6feb9d63	\N	\N	\N	\N	\N	\N	2026-07-16 19:40:12.494	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
69fced18-8dad-4dc1-bc55-a84888b500ba	bb55baee-4422-4df4-af91-3d080169a43d	2	b7a20fb4-7481-4e49-a64d-424df392d4d0	\N	\N	\N	\N	\N	\N	2026-07-16 19:40:12.494	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
ecb5466c-7af8-4964-88d8-7497f99b761e	bb55baee-4422-4df4-af91-3d080169a43d	3	a675ee3d-2476-4a06-b161-d9f9cdf71bd7	\N	\N	\N	\N	\N	\N	2026-07-16 19:40:12.494	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
76f18ca9-7c38-464a-8f44-5396b616f91c	bb55baee-4422-4df4-af91-3d080169a43d	4	e77608e5-772c-4037-a45f-3818e0625327	\N	\N	\N	\N	\N	\N	2026-07-16 19:40:12.494	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4241e8ee-76da-4d46-bfef-5476d0422b3e	2cac3079-82c2-4409-819b-420b3f4ac9b2	1	c6f274a3-697b-43b7-a92f-20a1c1b5892a	\N	\N	\N	\N	\N	\N	2026-07-16 19:46:20.063	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
cf864d80-d6d7-4751-8400-7ff32ffd0e09	2cac3079-82c2-4409-819b-420b3f4ac9b2	2	7d449f25-29f9-4b42-a872-3e5b801dfde0	\N	\N	\N	\N	\N	\N	2026-07-16 19:46:20.063	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9cc13c45-74b9-4cc8-a664-c75b0a9730e4	2cac3079-82c2-4409-819b-420b3f4ac9b2	3	7335841b-ee39-4659-9fc8-a51ec29e7061	\N	\N	\N	\N	\N	\N	2026-07-16 19:46:20.063	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
ddfa6360-ad3f-4e4d-b6c3-916b884f2e27	14807237-1f69-4de7-9ccf-2f4f8e7f07ac	1	\N	\N	-16.3684945	-46.8998557	\N	2026-08-05 19:48:49.194	Visita técnica  mensal sem alteração na ração	2026-08-05 19:48:49.195	REALIZADA	\N	\N	\N	\N	A02027	VALDINEI PAULO DE OLIVEIRA	UNAI	FAZ. PICO, SN	\N	15	f	\N
1db4da04-ff0d-4a35-b779-d4702f80d785	63251972-866f-43e0-a427-0c9d4c1986d0	1	ca9a033f-1918-4348-a39b-01e55aa1bcdc	\N	\N	\N	\N	\N	\N	2026-08-06 12:58:25.6	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
b849dd05-cabc-4026-85a5-0529a064092e	63251972-866f-43e0-a427-0c9d4c1986d0	2	f57d61db-4660-4bbb-9d76-9625b61fac70	\N	\N	\N	\N	\N	\N	2026-08-06 12:58:25.6	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
269c2059-0e7b-48d9-bffb-a528760c7f0c	63251972-866f-43e0-a427-0c9d4c1986d0	3	328c0ddd-0e28-415a-8fdd-d21e9b337d8c	\N	\N	\N	\N	\N	\N	2026-08-06 12:58:25.6	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
8cd5e078-d72d-47ee-9136-563ef618bac3	2cac3079-82c2-4409-819b-420b3f4ac9b2	4	7c9fc081-2355-4e47-840f-aae79ab4516f	\N	\N	\N	\N	\N	\N	2026-07-16 19:46:20.063	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
6f6e841e-49b8-4563-bf25-5c2135c2f1a6	2cac3079-82c2-4409-819b-420b3f4ac9b2	5	0d94fd5f-e85e-4326-8d91-22deb6fad05c	\N	\N	\N	\N	\N	\N	2026-07-16 19:46:20.063	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
2f6c6e98-5d5a-4f0c-85ff-c0b8a2054e4e	4e5bccc2-f0b1-40b7-a68c-4c07c72db717	3	\N	\N	-16.3624906	-46.8979143	\N	2026-08-01 14:54:03.644	Clenio anotacao	2026-08-01 14:54:03.644	REALIZADA	\N	\N	\N	\N	A05762	CLENIO MARCOS MENDES	UNAI	FAZ. INHUMAS, SN	31c6520e-8da4-4a9b-ac82-85daa7c2de6f	14	t	\N
b67f46d8-45b4-4f5f-a66e-53a9c447441f	2b72ea83-fa14-4236-a8e6-18f11c776420	1	c966f53b-7362-47fb-a670-b58aae199b1a	\N	\N	\N	\N	\N	\N	2026-07-17 13:48:58.79	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
922cf1de-d454-4bc8-a05e-0bcbd6afc133	2b72ea83-fa14-4236-a8e6-18f11c776420	2	327a1348-056d-4d41-ae63-2051282835f7	\N	\N	\N	\N	\N	\N	2026-07-17 13:48:58.79	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
841525b6-2d71-4ea9-ab18-2229456ae1ae	2b72ea83-fa14-4236-a8e6-18f11c776420	3	ceedca50-0189-43fb-a59f-b52ed8cde66e	\N	\N	\N	\N	\N	\N	2026-07-17 13:48:58.79	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4f724ac1-8e47-4e23-b6b9-be376f0c0ea9	f02d9aea-20bf-4cb7-8082-66b6c5083cc0	1	\N	\N	-16.3625102	-46.8979084	\N	2026-08-02 14:24:28.381	Clenio	2026-08-02 14:24:28.381	REALIZADA	\N	\N	\N	\N	C57892	18.303.345 MARCOS ANTONIO SANTOS ALMEIDA	UNAI	R DO QUIMICO, N 57	10503e5c-76f4-4c2d-8530-f230c52613ab	16	t	\N
992bd882-6bdb-4692-956b-11d302c1a0c5	f02d9aea-20bf-4cb7-8082-66b6c5083cc0	6	\N	\N	-16.3624981	-46.8979175	\N	2026-08-02 15:18:33.199	\N	2026-08-02 15:18:33.199	REALIZADA	\N	\N	\N	\N	C48822	CELMA ANDREIA DIOGO DOS SANTOS	ARINOS	ESTRADA ARINOS/URUCUIA 22KM DIREITA 7KM	275925a5-d1b7-4fac-9aa2-359b4a384b50	24	t	\N
f202dde1-585b-4d95-b8b0-7c3229f740a3	f02d9aea-20bf-4cb7-8082-66b6c5083cc0	4	\N	\N	\N	\N	\N	2026-08-02 14:25:34.6	\N	2026-08-02 14:25:34.601	REALIZADA	\N	\N	\N	\N	C41670	PEDRO ANASTACIO DA SILVA	UNAI	RUA PEDRO PEREIRA CARDOSO, 19	\N	\N	\N	\N
14677e6a-74fd-4a6f-8de3-24a8f353c60e	f02d9aea-20bf-4cb7-8082-66b6c5083cc0	3	\N	\N	-16.3625051	-46.8979179	\N	2026-08-02 14:24:41.73	Clenio	2026-08-02 14:24:41.731	REALIZADA	\N	\N	\N	\N	C17492	ADALTO ANTONIO ARAUJO	UNAI	RUA GERALDO FURTADO DOS SANTOS, 84	a3f4ce9d-5152-4c07-80a8-108aa04d2e09	16	t	\N
4eca4d11-8aae-4c1a-ab66-adba14bbf433	2f1ec1e7-dcdd-45f3-8cdb-af8a02b72bdd	3	\N	\N	-16.3625089	-46.8979121	\N	2026-08-02 15:23:29.586	\N	2026-08-02 15:23:29.586	REALIZADA	\N	\N	\N	\N	E02533	VALDIRENE MENDES FERREIRA	UNAI	RUA ANTONIO BROCHADO, 1409	dd800a42-068c-49e7-89f3-bae76f80af3c	15	t	\N
9cfd0855-3fba-42cc-b12c-83c19424f716	ae2d1371-b430-47ef-81b3-502b1606a879	5	\N	\N	-16.3625085	-46.8979108	\N	2026-08-02 20:21:44.762	Pontecial cliente	2026-08-02 20:21:44.763	REALIZADA	\N	\N	98eea472-7f55-4fa9-9289-7145320e65d8	\N	\N	Cllenio	\N	\N	\N	16	t	\N
1675ff7d-7b8e-40fb-9bfa-1d514e5fc263	ae2d1371-b430-47ef-81b3-502b1606a879	4	\N	\N	-16.3625188	-46.8978884	\N	2026-08-02 20:19:57.328	\N	2026-08-02 20:19:57.329	REALIZADA	\N	\N	\N	\N	E02336	LIDYANE APARECIDA COSTA GONCALVES ROCHA	UNAI	RUA DOMINGOS PINTO BROCH,287	be277250-0ed8-4757-bec3-24df49557479	16	t	\N
c434c95f-4c71-447f-b121-f47c58b230bc	ae2d1371-b430-47ef-81b3-502b1606a879	1	\N	\N	-16.3625040	-46.8979221	\N	2026-08-02 20:18:46.15	Anotacao clenio	2026-08-02 20:18:46.151	REALIZADA	\N	\N	\N	\N	A02027	VALDINEI PAULO DE OLIVEIRA	UNAI	FAZ. PICO, SN	aeefe928-2578-4338-8ae3-0c00018f5c98	15	t	\N
1fa230fe-0765-4ec4-b565-7748f00a4cdc	ae2d1371-b430-47ef-81b3-502b1606a879	2	\N	\N	-16.3625089	-46.8979152	\N	2026-08-02 20:19:22.13	\N	2026-08-02 20:19:22.13	REALIZADA	\N	\N	\N	\N	C52945	ADALTO DE JESUS LEMOS	BRASILANDIA DE MINAS	RUA ROMILDO ALVES , 55	16d4cea5-760f-460c-83fb-23ee08845aec	14	t	\N
90aef2ba-5986-4467-a803-58324a72e49a	ae2d1371-b430-47ef-81b3-502b1606a879	3	\N	\N	\N	\N	\N	2026-08-02 20:19:33.087	\N	2026-08-02 20:19:33.087	REALIZADA	\N	\N	\N	\N	C55343	ALEXANDRA MARIA DE JESUS DA COSTA	UNAI	SITIO PANTANAL RUA DA ONCA, 06	\N	\N	\N	\N
28e75674-a644-479e-92a6-acb75d1079fe	efde89c3-26f2-4fe6-8579-f6ec3d2ee9c5	1	\N	Paracatu	-16.3684829	-46.8998379	210	2026-07-17 19:49:51.615	\N	2026-07-17 19:37:32.985	REALIZADA	Paracatu	2026-07-17 19:49:51.615	\N	\N	\N	\N	\N	\N	\N	11	t	\N
da402101-fc0f-4d92-9824-f721f57f9495	efde89c3-26f2-4fe6-8579-f6ec3d2ee9c5	2	\N	Fazenda do Clenio	-16.3684841	-46.8998479	\N	2026-07-17 19:50:30.52	\N	2026-07-17 19:50:30.521	REALIZADA	\N	2026-07-17 19:50:30.52	2aab5aaa-bab5-4a04-a2ea-0b2437e96b46	\N	\N	\N	\N	\N	\N	14	t	\N
7e67dc81-5e87-46aa-ac7c-eaa14785d2b0	1c028432-b6ee-4177-a47a-d276ef97feaa	2	\N	\N	-16.3684904	-46.8998351	\N	2026-08-03 20:31:43.612	Titi	2026-08-03 20:31:43.613	REALIZADA	\N	\N	\N	\N	A05014	ADAILSON ALVES DE ALMEIDA	UNAI	FAZ. PICO/RABO FINO, SN	0c0af13a-da98-4191-9143-f01e0a5c9ed1	12	t	\N
f3108926-ef48-42c8-83fa-0f9c97da8608	1c028432-b6ee-4177-a47a-d276ef97feaa	3	\N	\N	-16.3684823	-46.8998540	\N	2026-08-03 20:31:52.479	Clenio obs	2026-08-03 20:31:52.48	REALIZADA	\N	\N	\N	\N	A00850	DIRCEU JULIO GATTO	UNAI	FAZ. BURITI, SN	321cc0dc-c169-4ec9-9335-ea2268d439f2	12	t	\N
f312013a-6efa-4ee5-8e1d-457552d84daf	14807237-1f69-4de7-9ccf-2f4f8e7f07ac	2	\N	\N	-16.3684945	-46.8998320	\N	2026-08-05 19:48:55.069	\N	2026-08-05 19:48:55.069	REALIZADA	\N	\N	\N	\N	A04721	MARIA NEUZA MENDES	UNAI	FAZ. INHUMAS, SN	\N	12	f	\N
d7aec3a2-2a5b-4204-904b-3a9506f32642	14807237-1f69-4de7-9ccf-2f4f8e7f07ac	4	\N	\N	-16.3684923	-46.8998438	\N	2026-08-05 19:49:08.178	\N	2026-08-05 19:49:08.179	REALIZADA	\N	\N	\N	\N	A00086	HUMBERTO EUSTAQUIO DE QUEIROZ	UNAI	FAZ. CAPAO DO ARROZ/RIACHO, SN	f3c841d6-d6e6-4280-8a35-f9b66bf4ba60	9	t	\N
84ae4d65-73c7-404e-bcfc-3bc8c27eca4f	63251972-866f-43e0-a427-0c9d4c1986d0	4	e475f288-ac1c-4e06-adf0-a61120107591	\N	\N	\N	\N	\N	\N	2026-08-06 12:58:25.6	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4842ed21-cd48-4f54-ab67-4dd23e2ea6d2	5e3555b8-3b59-49cf-bd7c-a7f14d6a741c	1	986068eb-e4e3-435e-b308-5cfa5d0787f5	\N	\N	\N	\N	\N	\N	2026-07-18 23:47:05.346	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
53616160-7987-48cf-a9ee-a5b5f4c3378d	63251972-866f-43e0-a427-0c9d4c1986d0	5	5b50e12d-f8e4-4f97-9a55-c2c5634d67f0	\N	\N	\N	\N	\N	\N	2026-08-06 12:58:25.6	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
f8cb0334-db83-45f2-82ed-3f592513764d	5e3555b8-3b59-49cf-bd7c-a7f14d6a741c	3	b95761e9-3091-4214-ba46-792e52758888	\N	\N	\N	\N	\N	\N	2026-07-18 23:47:05.346	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
17578f11-7220-4e68-b9a1-66f4a9d4ef4c	5e3555b8-3b59-49cf-bd7c-a7f14d6a741c	2	\N	Entrega #43 — CLENIO MARCOS MENDES	\N	\N	\N	\N	Não entregue (tentativa 1): Cliente ausente no endereço	2026-07-18 23:47:05.346	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
594c045e-57b7-4c32-a97e-106e125c0cd7	bda72278-06a4-42a3-b463-e4f631beee09	5	aec4a620-91f5-4561-964e-9e58c5c05c8e	\N	\N	\N	\N	\N	\N	2026-07-25 00:36:37.385	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
ca98ee05-5c71-46ef-b7bc-c96105c01875	bda72278-06a4-42a3-b463-e4f631beee09	1	0b2e3f62-d538-4cfe-85fe-d32b4960bf68	\N	\N	\N	\N	\N	\N	2026-07-25 00:36:37.385	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5b8f2315-9c0e-495f-aa0e-b33e3161992c	bda72278-06a4-42a3-b463-e4f631beee09	2	84c646bf-e023-41fb-9f66-3ad9af655b3e	\N	\N	\N	\N	\N	\N	2026-07-25 00:36:37.385	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
67a15f7b-5186-4e1a-84f9-f14ea83c27ca	bda72278-06a4-42a3-b463-e4f631beee09	3	1df8ae19-24bb-4d3a-8411-eaac1f1c4d8a	\N	\N	\N	\N	\N	\N	2026-07-25 00:36:37.385	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
c412342a-1eb5-4632-a0d2-715a6d650b15	bda72278-06a4-42a3-b463-e4f631beee09	4	b23bde51-021e-402f-ab16-d6b721e35990	\N	\N	\N	\N	\N	\N	2026-07-25 00:36:37.385	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9a8ce687-4cfe-4a3b-affc-2c38253b1b95	bda72278-06a4-42a3-b463-e4f631beee09	6	a33f6868-6b73-4a64-8635-8740264e8876	\N	\N	\N	\N	\N	\N	2026-07-25 00:36:37.385	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
b07bc78b-e927-4ef0-8089-ab921c891dbf	9de302c8-0363-4453-8687-09383cf86a0c	1	\N	Entrega #14 — Cliente Teste Roteiro 8 - B1	\N	\N	\N	\N	Não entregue (tentativa 1): sem motivo	2026-08-10 00:46:40.821	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
ca50832f-c09e-4ab9-b232-4cc3d0f948ca	2845921a-4a56-43d5-b3e1-36506c046f71	1	\N	Entrega #16 — Cliente Teste Roteiro 8 - A2-1	\N	\N	\N	\N	Não entregue (tentativa 1): sem motivo	2026-08-10 00:46:02.405	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
79b7a36b-8ae9-47f8-9858-9e40bdfcf38e	2845921a-4a56-43d5-b3e1-36506c046f71	2	\N	Entrega #17 — Cliente Teste Roteiro 8 - A2-2	\N	\N	\N	\N	Não entregue (tentativa 1): sem motivo	2026-08-10 00:46:02.405	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
d9bb84c4-40f0-4657-a3f6-4704a2a4a7d3	5b199bfc-a924-458d-a3c8-1db67835c2dc	1	4b59e26c-d53b-4ce2-ad60-c3a9a1995b8c	\N	\N	\N	\N	\N	\N	2026-07-25 02:36:08.291	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
93a598d7-9ba2-4ff5-8855-f1887df18a0d	5b199bfc-a924-458d-a3c8-1db67835c2dc	2	5a47d5fa-b90a-431c-b850-2866591f7594	\N	\N	\N	\N	\N	\N	2026-07-25 02:36:08.291	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5860a0a3-3de0-4cc8-a3dc-2e08ebd70215	5b199bfc-a924-458d-a3c8-1db67835c2dc	3	0845c44e-e6a8-42f6-b7b2-3e2923b799a2	\N	\N	\N	\N	\N	\N	2026-07-25 02:36:08.291	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
997d9dbf-a201-43df-adbc-1f5a4b95442d	5b199bfc-a924-458d-a3c8-1db67835c2dc	4	b489e51f-fe3b-4146-a3cb-e2068e6363ed	\N	\N	\N	\N	\N	\N	2026-07-25 02:36:08.291	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
b3cbe5bc-c376-440f-a1ef-7c5f06d16b74	5b199bfc-a924-458d-a3c8-1db67835c2dc	5	f7cddb93-b519-4ac3-88ed-587956f192d3	\N	\N	\N	\N	\N	\N	2026-07-25 02:36:08.291	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
0079aa4d-f1f7-4403-8784-19cbde042734	5b199bfc-a924-458d-a3c8-1db67835c2dc	6	fefbccac-113b-477b-aece-dc9bf1d30c48	\N	\N	\N	\N	\N	\N	2026-07-25 02:36:08.291	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
7eb629ac-403e-4f5b-916f-a712f5997fa3	df996e2e-93bd-4eef-be6b-2a437dfbab89	1	29c71160-555b-4589-8104-f634ab6c2656	\N	\N	\N	\N	\N	\N	2026-07-25 23:30:29.744	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
a4e79c9f-7a4f-4c62-9fbd-069ca5005a44	df996e2e-93bd-4eef-be6b-2a437dfbab89	2	edb14c3c-7cee-41ff-82f6-2008cced4150	\N	\N	\N	\N	\N	\N	2026-07-25 23:30:29.744	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
a2c12803-d840-4e6d-acc9-b13d06e8cb42	df996e2e-93bd-4eef-be6b-2a437dfbab89	3	07d182d1-cc48-42e8-9ca0-4dc00a3c7e33	\N	\N	\N	\N	\N	\N	2026-07-25 23:30:29.744	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
7408a7d0-3335-40e7-abf3-2fe17fa09935	df996e2e-93bd-4eef-be6b-2a437dfbab89	4	b89212e0-c6fa-425f-940c-6fe565d1472d	\N	\N	\N	\N	\N	\N	2026-07-25 23:30:29.744	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
ebb57b18-def8-4c69-8796-8b49f0f83c82	df996e2e-93bd-4eef-be6b-2a437dfbab89	5	be6b65bd-6797-466b-a1c7-ba521c87a6b0	\N	\N	\N	\N	\N	\N	2026-07-25 23:30:29.744	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
f13b9692-ae55-4420-9542-91fc6ca7bfde	df996e2e-93bd-4eef-be6b-2a437dfbab89	6	81f09e20-2fc5-4cfe-aeab-64336ff88b81	\N	\N	\N	\N	\N	\N	2026-07-25 23:30:29.744	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
0aa21ed8-a0f8-402f-b6e7-db042d2438fa	df996e2e-93bd-4eef-be6b-2a437dfbab89	7	2cb40ffa-ae13-4770-b0ac-4a630f75fec3	\N	\N	\N	\N	\N	\N	2026-07-25 23:30:29.744	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
b25b7c5e-891a-4199-be3b-825f9a47e03d	df996e2e-93bd-4eef-be6b-2a437dfbab89	8	96a1ff94-9d49-46a2-8a78-409da2e7fdb1	\N	\N	\N	\N	\N	\N	2026-07-25 23:30:29.744	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
7d108360-de5f-47d1-bc38-85e7ed240061	a8c7f119-1445-4d03-b0cb-0b936bca2264	1	63f0b171-4783-4196-86d4-4f890eca8317	\N	\N	\N	\N	\N	\N	2026-07-25 23:55:15.734	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
cd4a5879-a040-4b95-adba-bc33b9a61ed7	a8c7f119-1445-4d03-b0cb-0b936bca2264	2	b837a791-ef86-435d-a347-b23e6253a542	\N	\N	\N	\N	\N	\N	2026-07-25 23:55:15.734	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
c2b2a219-d772-45d9-8757-cf35fb8be42b	bd238b51-81ab-46fc-b456-b5c60624ad04	1	\N	\N	\N	\N	\N	2026-07-27 14:29:12.565	\N	2026-07-27 14:29:12.566	PLANEJADA	\N	\N	\N	\N	A02027	VALDINEI PAULO DE OLIVEIRA	UNAI	FAZ. PICO, SN	\N	\N	\N	\N
da35c434-06c3-4b2c-bf61-0589b7cde846	bd238b51-81ab-46fc-b456-b5c60624ad04	2	\N	\N	\N	\N	\N	2026-07-27 14:29:14.901	\N	2026-07-27 14:29:14.902	PLANEJADA	\N	\N	\N	\N	A04721	MARIA NEUZA MENDES	UNAI	FAZ. INHUMAS, SN	\N	\N	\N	\N
018638bd-4e11-47cb-b36d-60b5559c2df6	97fc97ea-2520-4ec9-80d6-88aec9071a89	1	\N	\N	-16.3684808	-46.8998481	\N	2026-07-27 14:54:34.229	\N	2026-07-27 14:54:34.229	REALIZADA	\N	\N	\N	\N	A00086	HUMBERTO EUSTAQUIO DE QUEIROZ	UNAI	FAZ. CAPAO DO ARROZ/RIACHO, SN	f3c841d6-d6e6-4280-8a35-f9b66bf4ba60	11	t	\N
78b2a5a0-2250-4293-83b6-df4a3a43ff03	97fc97ea-2520-4ec9-80d6-88aec9071a89	2	\N	\N	-16.3684919	-46.8998418	\N	2026-07-27 14:54:40.57	\N	2026-07-27 14:54:40.571	REALIZADA	\N	\N	\N	\N	A02213	GABRIEL MENDES CORNELIO	UNAI	FAZ. MACAUBAS, SN	6aa14f1e-071a-4813-b32e-62c018f3feeb	11	t	\N
0bab5205-fa6c-48dc-8764-13e0a4084e9f	2924d172-6268-4193-8bcd-9ed91a11f3d5	1	\N	\N	\N	\N	\N	2026-07-29 19:44:06.974	\N	2026-07-29 19:44:06.975	PLANEJADA	\N	\N	\N	\N	A02027	VALDINEI PAULO DE OLIVEIRA	UNAI	FAZ. PICO, SN	\N	\N	\N	\N
829ce0ae-2faf-4ba5-b5f4-16cfe0f96d60	2924d172-6268-4193-8bcd-9ed91a11f3d5	2	\N	\N	\N	\N	\N	2026-07-29 19:44:15.506	\N	2026-07-29 19:44:15.507	PLANEJADA	\N	\N	\N	\N	A04721	MARIA NEUZA MENDES	UNAI	FAZ. INHUMAS, SN	\N	\N	\N	\N
e0c29d5b-d94e-4c5a-b6d4-2b92c0120441	2924d172-6268-4193-8bcd-9ed91a11f3d5	3	\N	\N	\N	\N	\N	2026-07-29 19:44:19.88	\N	2026-07-29 19:44:19.881	PLANEJADA	\N	\N	\N	\N	\N	BRANDO	\N	\N	\N	\N	\N	\N
f25571dc-1a9d-4758-ac16-ede43130e018	2924d172-6268-4193-8bcd-9ed91a11f3d5	4	\N	\N	\N	\N	\N	2026-07-29 19:44:26.193	\N	2026-07-29 19:44:26.194	PLANEJADA	\N	\N	\N	\N	\N	ATHOS	\N	\N	\N	\N	\N	\N
2d188eb2-687a-4aa6-be76-3e0b6cbf26d1	bba461dd-b0f6-4aa1-9526-e9d4d485938d	1	\N	\N	-16.3625049	-46.8979165	\N	2026-08-01 03:00:32.139	\N	2026-08-01 03:00:32.14	REALIZADA	\N	\N	\N	\N	C57892	18.303.345 MARCOS ANTONIO SANTOS ALMEIDA	UNAI	R DO QUIMICO, N 57	10503e5c-76f4-4c2d-8530-f230c52613ab	15	t	\N
d4979186-6f82-454d-83dd-2c9fdd935d65	0e881e0a-6279-4740-9045-0956aa2f0fe7	1	\N	\N	-16.3625050	-46.8979065	\N	2026-08-01 02:58:48.016	\N	2026-08-01 02:58:48.017	REALIZADA	\N	\N	\N	\N	A02027	VALDINEI PAULO DE OLIVEIRA	UNAI	FAZ. PICO, SN	aeefe928-2578-4338-8ae3-0c00018f5c98	15	t	\N
eda40d8d-ec23-497e-b8d2-8ca461f3415e	bba461dd-b0f6-4aa1-9526-e9d4d485938d	2	\N	\N	-16.3624993	-46.8979177	\N	2026-08-01 03:00:37.337	\N	2026-08-01 03:00:37.338	REALIZADA	\N	\N	\N	\N	C54364	ASSOC. COM. DOS MORADORES DE PEDRINHAS	ARINOS	FAZENDA PEDRINHAS, SN	8776d3e6-dcdd-4b97-8d8c-c7ae984dc497	14	t	\N
1de70b13-b3da-4e2c-b0a6-94b8f3f2e9bb	bba461dd-b0f6-4aa1-9526-e9d4d485938d	3	\N	\N	-16.3625046	-46.8979087	\N	2026-08-01 03:00:41.764	\N	2026-08-01 03:00:41.765	REALIZADA	\N	\N	\N	\N	C56503	ARNALDA CARDOZO DO VALE	ARINOS	PA RIACHO CLARO LOTE 24	9faf5503-502b-4678-98f1-91fa2f78d7f1	13	t	\N
584998eb-27cb-45b8-a8ea-c68e6bb1a286	0e881e0a-6279-4740-9045-0956aa2f0fe7	2	\N	\N	-16.3624987	-46.8979140	\N	2026-08-01 02:58:53.172	\N	2026-08-01 02:58:53.173	REALIZADA	\N	\N	\N	\N	A04721	MARIA NEUZA MENDES	UNAI	FAZ. INHUMAS, SN	8b14cc0c-a2fe-4af2-9a4e-37b1cbd93d9c	14	t	\N
9143ff88-9974-4ab0-82c4-e3660f1c726d	0e881e0a-6279-4740-9045-0956aa2f0fe7	3	\N	\N	-16.3624568	-46.8980635	\N	2026-08-01 02:59:30.815	\N	2026-08-01 02:59:30.816	REALIZADA	\N	\N	\N	\N	A02213	GABRIEL MENDES CORNELIO	UNAI	FAZ. MACAUBAS, SN	6aa14f1e-071a-4813-b32e-62c018f3feeb	38	t	\N
7b249fb3-8e9b-437a-a2c8-36e94487008c	b773b545-a34b-4cfd-9dcc-0d49b1b7055c	1	\N	\N	-16.3624785	-46.8979319	\N	2026-08-01 03:13:46.515	\N	2026-08-01 03:13:46.516	REALIZADA	\N	\N	\N	\N	A04517	ADAO PEDRO GONCALVES	RIACHINHO	FAZ. CONFINS, SN	73a6439e-1ce1-4ac7-b995-19e5de8eb222	23	t	\N
8d28d402-b2ad-4033-88d1-06a9c665a1d1	5daae0ca-dd62-4cfe-9fc6-bb6aad117aaa	1	\N	\N	-16.3625030	-46.8979157	\N	2026-08-01 03:49:33.132	\N	2026-08-01 03:49:33.132	REALIZADA	\N	\N	\N	\N	\N	jose	\N	\N	\N	15	t	\N
935af8aa-10bd-40ea-bb54-869c72972679	5daae0ca-dd62-4cfe-9fc6-bb6aad117aaa	3	\N	\N	-16.3625384	-46.8979016	\N	2026-08-01 03:53:12.157	\N	2026-08-01 03:53:12.158	REALIZADA	\N	\N	\N	\N	C50676	51499292 CARLOS ALBERTO SUARES A SILVA F	UNAI	AV LISBOA, 127	6bed5a45-048b-43ac-b779-697ae013aa3c	18	t	\N
0ee2dd3d-e0b1-41e8-bb51-3d7ecb4e00ff	5daae0ca-dd62-4cfe-9fc6-bb6aad117aaa	2	\N	\N	-16.3625998	-46.8978982	\N	2026-08-01 03:49:40.877	\N	2026-08-01 03:49:40.878	REALIZADA	\N	\N	\N	\N	A02710	ADELTON JOSE CAXITO	UNAI	FAZ. P.A SANTA CLARA/FURADINHO, SN	15a23ff9-4ea7-4b65-b7e7-7e2cec834282	22	t	\N
d1faaa87-0cbe-455d-bc5b-0b50600667dd	696c9461-4d7b-47cd-86f5-f9a875a08e9a	1	\N	\N	-16.3625082	-46.8979079	\N	2026-08-01 14:32:04.442	\N	2026-08-01 14:32:04.443	REALIZADA	\N	\N	\N	\N	A02027	VALDINEI PAULO DE OLIVEIRA	UNAI	FAZ. PICO, SN	aeefe928-2578-4338-8ae3-0c00018f5c98	21	t	\N
d71fb386-1b6d-4767-a44c-8355183c688e	696c9461-4d7b-47cd-86f5-f9a875a08e9a	2	\N	\N	-16.3625006	-46.8979154	\N	2026-08-01 14:32:08.841	\N	2026-08-01 14:32:08.842	REALIZADA	\N	\N	\N	\N	A04721	MARIA NEUZA MENDES	UNAI	FAZ. INHUMAS, SN	8b14cc0c-a2fe-4af2-9a4e-37b1cbd93d9c	14	t	\N
af00d46f-61b4-43a2-b44b-1e4ece6ba852	696c9461-4d7b-47cd-86f5-f9a875a08e9a	3	\N	\N	-16.3625475	-46.8979635	\N	2026-08-01 14:32:17.656	\N	2026-08-01 14:32:17.657	REALIZADA	\N	\N	\N	\N	A05762	CLENIO MARCOS MENDES	UNAI	FAZ. INHUMAS, SN	31c6520e-8da4-4a9b-ac82-85daa7c2de6f	6	t	\N
d7d74fa8-fe84-4627-9ae7-f4cd78e1eed3	9de302c8-0363-4453-8687-09383cf86a0c	2	\N	Entrega #15 — Cliente Teste Roteiro 8 - B2	\N	\N	\N	\N	Não entregue (tentativa 1): sem motivo	2026-08-10 00:46:40.821	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
95a4da17-1d9b-40b5-8274-b8c3743f0fbc	fcb4b24d-a032-4735-96b2-2815310a8acc	1	e8628b49-023e-492f-97f5-a59bba5119cf	\N	\N	\N	\N	\N	\N	2026-08-10 18:19:29.41	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9692718a-df60-4c09-bad1-40feb2962294	fcb4b24d-a032-4735-96b2-2815310a8acc	2	78c03746-9731-4104-8c3e-1f951f750c30	\N	\N	\N	\N	\N	\N	2026-08-10 18:19:29.41	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
c6ce9953-91b8-4804-85ba-3c36080739df	fcb4b24d-a032-4735-96b2-2815310a8acc	3	6e21851a-eab0-4c8d-86ed-3eb370bcb235	\N	\N	\N	\N	\N	\N	2026-08-10 18:19:29.41	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
b4c9c8d8-046e-4737-9e34-5f4e282050a6	491259e3-c895-4f65-a00c-7c19ad2ba16c	1	10947a0a-53d2-4f85-b54d-a098b12fecc2	\N	\N	\N	\N	\N	\N	2026-08-10 18:47:10.708	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
a719434c-a7bc-4178-b2be-33dbde139ea1	491259e3-c895-4f65-a00c-7c19ad2ba16c	2	aa1f53c2-5e59-4f70-9fff-eed13bbc9af1	\N	\N	\N	\N	\N	\N	2026-08-10 18:47:10.708	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
f4e07eb1-25cf-41c1-badb-e64b385bc92c	3407a8f2-daa0-4f5c-a4ac-9c9131d1fc01	1	ee3f3688-3e14-42b7-8b93-a2f1f7fa7f64	\N	\N	\N	\N	\N	\N	2026-08-10 18:58:07.517	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
a90f7ff8-e985-40dc-b8e7-a50f3b44c9ad	3407a8f2-daa0-4f5c-a4ac-9c9131d1fc01	2	2640705b-0e3f-43b5-b054-5229b89571e4	\N	\N	\N	\N	\N	\N	2026-08-10 18:58:07.517	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
a7f11bab-b347-439a-afd4-4615fef440b5	ee0f51c8-6a29-4d72-9d8f-44dbd5aabd7f	1	02df40ea-0de3-43f8-90eb-ff0d04501539	\N	\N	\N	\N	\N	\N	2026-08-10 20:07:50.049	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
c8ef0500-3a41-4ca1-b2f2-a7352a54a7d1	ee0f51c8-6a29-4d72-9d8f-44dbd5aabd7f	2	2ed6a94e-97f3-4337-ba6c-48dc92733f52	\N	\N	\N	\N	\N	\N	2026-08-10 20:07:50.049	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
fb2f6433-a6fc-47aa-8cb8-a219cae15984	7f6db640-edf4-4719-9efe-2f76d6de4782	1	3193169c-ca33-47c8-b8f2-13f27fc9d66d	\N	\N	\N	\N	\N	\N	2026-08-10 20:56:09.009	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
2b05101c-543e-4569-9659-921a165b79f4	7f6db640-edf4-4719-9efe-2f76d6de4782	2	a74721eb-2379-4749-b1f4-0c060ef51bc4	\N	\N	\N	\N	\N	\N	2026-08-10 20:56:09.009	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
964a2baf-7507-4351-8a82-35dc2f52ffcb	487dad68-0379-44f0-b86c-3505a020f888	1	5ac7d4e2-1272-4aa8-a980-1022cc024909	\N	\N	\N	\N	\N	\N	2026-08-11 11:40:36.498	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
d51f06e4-3646-4bb6-a6d8-699d25fbfd43	487dad68-0379-44f0-b86c-3505a020f888	2	0a81ee73-f76a-4d78-8037-a7013f55f228	\N	\N	\N	\N	\N	\N	2026-08-11 11:40:36.498	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
64878bf7-79d1-436d-a728-a729c06219e6	487dad68-0379-44f0-b86c-3505a020f888	3	8228067d-56c4-4a4f-a04e-e2368148d6bd	\N	\N	\N	\N	\N	\N	2026-08-11 11:40:36.498	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
32521b6d-4757-4f6e-890a-b5c5a4eb97a0	487dad68-0379-44f0-b86c-3505a020f888	4	8147d5b0-3adb-4bec-b1d4-036a1ffff785	\N	\N	\N	\N	\N	\N	2026-08-11 11:40:36.498	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
597d03ea-de02-4969-96e9-54a6d1ed8be9	487dad68-0379-44f0-b86c-3505a020f888	5	efcecc81-544a-4d12-8b02-68c0d4cabd43	\N	\N	\N	\N	\N	\N	2026-08-11 11:40:36.498	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
694b2bbe-d601-4103-ba99-d96409c0889c	c4415f62-2573-4e23-96f5-d53dcbaa3def	1	9860fd6d-045a-4ce8-9db2-f495ac95b401	\N	\N	\N	\N	\N	\N	2026-08-11 14:30:12.478	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4cbb19f0-a899-479f-a98d-06166dc3fadf	c4415f62-2573-4e23-96f5-d53dcbaa3def	2	1f52fd80-a425-4cb4-b3d6-693057ca57d0	\N	\N	\N	\N	\N	\N	2026-08-11 14:30:12.478	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
31e38600-b844-4c0f-aa92-0479167c8b8c	c4415f62-2573-4e23-96f5-d53dcbaa3def	3	21469954-9602-483e-b1f7-58f51ca5f277	\N	\N	\N	\N	\N	\N	2026-08-11 14:30:12.478	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
a6417304-dca8-4d4c-ab2a-92a7ee0ae859	b845e238-1078-4645-b5c4-a0c28fcf0a20	1	4b9012ea-99a0-411c-9329-a218a9a0409b	\N	\N	\N	\N	\N	\N	2026-08-11 14:53:39.055	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
16ed0f37-4114-4ce6-93bb-5f010ff3111d	b845e238-1078-4645-b5c4-a0c28fcf0a20	2	7a02ddd9-50af-4b9c-bff1-f00c5d9b7305	\N	\N	\N	\N	\N	\N	2026-08-11 14:53:39.055	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9947b2c7-d64e-4c89-b901-1670c13bcd26	b845e238-1078-4645-b5c4-a0c28fcf0a20	3	a79c0098-97ea-46c3-a872-6c5b9b68e274	\N	\N	\N	\N	\N	\N	2026-08-11 14:53:39.055	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
e7872814-a906-4914-a9bd-599dbcff133c	b845e238-1078-4645-b5c4-a0c28fcf0a20	4	8576b6d1-36dc-4636-8aa2-401abe337c1c	\N	\N	\N	\N	\N	\N	2026-08-11 14:53:39.055	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
608a5362-14af-4fdd-945a-c9f952729f73	b93276fa-79f6-4b4f-b48e-06a3eaefaee2	1	383de6c8-b3e1-4760-a3d8-0a9de2f3dabb	\N	\N	\N	\N	\N	\N	2026-08-11 19:44:45.746	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
001c6e19-5e7a-4905-b0c9-82e5ee98c9a7	b93276fa-79f6-4b4f-b48e-06a3eaefaee2	2	ef23d77c-9eaf-41fa-bbd2-246a7a8be372	\N	\N	\N	\N	\N	\N	2026-08-11 19:44:45.746	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
f0f8d27c-b585-45ea-b7eb-a8b1c1d9f522	b93276fa-79f6-4b4f-b48e-06a3eaefaee2	3	6a31c42e-47c7-4207-bc62-4ffb7c664992	\N	\N	\N	\N	\N	\N	2026-08-11 19:44:45.746	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
55f9a103-0feb-42a5-8065-8d0118cb853e	b93276fa-79f6-4b4f-b48e-06a3eaefaee2	4	21a3383c-5663-4052-9340-4f780f6b5408	\N	\N	\N	\N	\N	\N	2026-08-11 19:44:45.746	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
82e3fe83-8a39-4699-84fb-3290841668b3	b93276fa-79f6-4b4f-b48e-06a3eaefaee2	5	c51b8444-fca3-46e5-9bac-60bc16225a96	\N	\N	\N	\N	\N	\N	2026-08-11 19:44:45.746	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
43224953-8f53-46fd-ae37-252698d7c06d	f4416387-9342-4528-95b1-180c9e720fdf	1	d357423a-3ff1-45d9-ab15-ca50be609936	\N	\N	\N	\N	\N	\N	2026-08-14 23:42:16.757	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
a860704e-9690-404e-91fa-56e26bda5f0e	f4416387-9342-4528-95b1-180c9e720fdf	2	dd843869-1d2d-4ac8-bad5-940aa12fc7a5	\N	\N	\N	\N	\N	\N	2026-08-14 23:42:16.757	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
d55fd538-1f6f-4bb7-80da-f0f675b07307	f4416387-9342-4528-95b1-180c9e720fdf	3	afdbdb4b-9e0e-4246-8ed7-afdeba3a17b3	\N	\N	\N	\N	\N	\N	2026-08-14 23:42:16.757	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
11bf97df-61eb-427d-84ab-cddf429fec13	5c8f9022-3adb-4f33-998d-7fa12aa475c2	1	06f0a27e-8534-4c9e-8f73-28f1a8207428	\N	\N	\N	\N	\N	\N	2026-08-15 00:18:38.821	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
a0caa15b-bf3f-4907-be9a-c2a05a35f6fb	5c8f9022-3adb-4f33-998d-7fa12aa475c2	2	45fd7af5-aeeb-474c-97e6-4625aeca099b	\N	\N	\N	\N	\N	\N	2026-08-15 00:18:38.821	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
bb88cafe-cd5a-4052-bdbf-3e19596fbc53	5354dd2f-fea3-497d-97ac-e952c04c2d64	1	09c36017-4c8e-447d-a8f1-bbc06b63c680	\N	\N	\N	\N	\N	\N	2026-08-15 00:47:44.135	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
80f31854-79d7-4ebb-8533-f06c5655bd07	5354dd2f-fea3-497d-97ac-e952c04c2d64	2	f8000e6d-67d6-40e1-919e-32abdd2afac1	\N	\N	\N	\N	\N	\N	2026-08-15 00:47:44.135	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
eb374a1b-b8ad-42f7-aef8-6fe57d6274d4	6b6c451e-8f97-47b4-8ef0-e2feea90ad4a	1	c51093d5-1bb0-44e6-afdf-4065d9849630	\N	\N	\N	\N	\N	\N	2026-08-15 01:01:00.887	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
bb5cbe3a-e048-43ea-b06f-61a613561bbe	6b6c451e-8f97-47b4-8ef0-e2feea90ad4a	2	883b3cf2-8eeb-46ae-9a96-f178659f88e9	\N	\N	\N	\N	\N	\N	2026-08-15 01:01:00.887	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9e2df328-bcd1-498b-9ed6-f32bc3f1d039	6b6c451e-8f97-47b4-8ef0-e2feea90ad4a	3	ef96c577-7711-4bf1-9346-95bf963a2a38	\N	\N	\N	\N	\N	\N	2026-08-15 01:01:00.887	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
8eca9262-4448-4572-bbca-02f1c270c29a	9cac5c5e-d263-4318-b7f8-a85a4085ca3b	1	7dccc911-fcaf-463f-b953-99641242017f	\N	\N	\N	\N	\N	\N	2026-08-15 01:15:54.271	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
dee2cfa4-cb30-43bf-a46b-097bef512265	9cac5c5e-d263-4318-b7f8-a85a4085ca3b	2	c919c755-9c4d-4cbf-b143-7db93c4a7e2e	\N	\N	\N	\N	\N	\N	2026-08-15 01:15:54.271	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
93048482-7449-4088-bd8f-39028d155e78	892c2d0d-aebc-44cf-928e-e2ab9d107e40	1	dd82218c-f4f3-4ba0-8fc0-57c1f8600ff8	\N	\N	\N	\N	\N	\N	2026-08-15 01:36:25.876	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
919e388d-0cfb-46d6-8234-468c80966c7e	892c2d0d-aebc-44cf-928e-e2ab9d107e40	2	65773a96-75de-4d84-a9b2-45217ffed0a1	\N	\N	\N	\N	\N	\N	2026-08-15 01:36:25.876	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
ee22985b-bc28-4ba9-8ab9-444ef358f59c	804e9e6d-7377-494b-9621-95f2b787bcab	1	487a9b8b-dade-456a-b4c0-f46a81e657d5	\N	\N	\N	\N	\N	\N	2026-08-15 01:50:21.847	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
3f6ef702-7ee9-4239-9e88-f4bafd7680c9	804e9e6d-7377-494b-9621-95f2b787bcab	2	d345fdae-2c60-4265-9505-e077786bc755	\N	\N	\N	\N	\N	\N	2026-08-15 01:50:21.847	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
fe34618d-9386-4e1c-bc32-027d16a35b59	4ce7c544-ee84-40cb-80e8-b2ec20a740c7	1	27af5ad5-bc0d-4cf3-93aa-314a0bc3ca22	\N	\N	\N	\N	\N	\N	2026-08-15 02:05:06.513	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
2e16f4f9-0edc-4ee0-9df3-7a3d48377016	4ce7c544-ee84-40cb-80e8-b2ec20a740c7	2	8b28ebe4-7d81-445e-80e8-0fbdaac124cb	\N	\N	\N	\N	\N	\N	2026-08-15 02:05:06.513	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
c13a8fab-4883-4afc-ae65-db1efff3b6b5	a53ed598-fe0f-44e0-8eac-ec19cf08e787	1	37fc47ae-a1e4-4aea-9b4d-2cae0989956c	\N	\N	\N	\N	\N	\N	2026-08-15 02:10:57.673	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
295a6540-9c5b-4647-9282-5df60e378280	a53ed598-fe0f-44e0-8eac-ec19cf08e787	2	d0b57591-0609-4e03-81dc-1e0132979798	\N	\N	\N	\N	\N	\N	2026-08-15 02:10:57.673	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
8803d80a-d9f6-475c-a756-70f8e77fec32	a53ed598-fe0f-44e0-8eac-ec19cf08e787	3	a3751d89-b21c-4dc4-9fab-028fb3f5b121	\N	\N	\N	\N	\N	\N	2026-08-15 02:10:57.673	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
7e89402c-2fa8-4379-ba79-883d27396c54	e1de5ac7-744e-4e77-bd0e-e3ee2d13a543	1	e0527e56-ceff-4589-b09e-9e3fb91f3780	\N	\N	\N	\N	\N	\N	2026-08-15 02:18:52.878	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
c008e384-60c7-4763-87c7-8d3f388c6eca	e1de5ac7-744e-4e77-bd0e-e3ee2d13a543	2	c30f4efd-d429-40f7-868f-3f7f41e8427d	\N	\N	\N	\N	\N	\N	2026-08-15 02:18:52.878	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
76999489-7f44-4955-af9f-0a3ab8918d16	e1de5ac7-744e-4e77-bd0e-e3ee2d13a543	3	33187004-e42d-463c-af4d-22f86c1aed91	\N	\N	\N	\N	\N	\N	2026-08-15 02:18:52.878	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
a0d93a53-bdba-48ec-addf-f87ca1da46d5	e1de5ac7-744e-4e77-bd0e-e3ee2d13a543	4	ac6848b3-edf7-4d39-a8f0-b06fd061548e	\N	\N	\N	\N	\N	\N	2026-08-15 02:18:52.878	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
c4e0e7d7-3eff-4794-b039-d6a52adedb1d	e108051f-5d0f-42aa-bc18-43f76aaf18a1	1	1225079c-03f0-4aab-9ed2-9d0dd386bd97	\N	\N	\N	\N	\N	\N	2026-08-15 02:41:24.495	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4fcddb5f-c68b-466f-9219-cb9ac6796517	e108051f-5d0f-42aa-bc18-43f76aaf18a1	2	135dded3-0f5f-4e5f-918a-7358ae9c210e	\N	\N	\N	\N	\N	\N	2026-08-15 02:41:24.495	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
f12ccbc3-fe93-4718-a4f3-f582870b8a6f	e108051f-5d0f-42aa-bc18-43f76aaf18a1	3	46ab9cc8-dcb2-4fd9-878d-c0870ffe7af7	\N	\N	\N	\N	\N	\N	2026-08-15 02:41:24.495	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
1ddb9a19-3cec-40cf-9f33-f1fa11fc976f	ce305fc4-cf35-417f-8ee5-8d77b57c89b5	1	45c1d862-bfca-4be2-88d0-337d0936a056	\N	\N	\N	\N	\N	\N	2026-08-15 02:50:48.01	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
15c3f53b-1876-4980-ab7b-03014041c172	ce305fc4-cf35-417f-8ee5-8d77b57c89b5	2	b48d04e9-69a4-4280-b31a-7e64657e0318	\N	\N	\N	\N	\N	\N	2026-08-15 02:50:48.01	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
ca635ac5-943f-430b-9ad8-fa88b724dae4	ce305fc4-cf35-417f-8ee5-8d77b57c89b5	3	0a05d2bb-cd38-42a4-bfda-dc7d5011792c	\N	\N	\N	\N	\N	\N	2026-08-15 02:50:48.01	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
a4331e5e-e1d6-4fdb-8f2a-d1e4d4c047ae	ddcc3bd4-b152-4a41-9847-b7aee2275b8b	1	32386c10-ed6d-4c2b-b341-4112298e7287	\N	\N	\N	\N	\N	\N	2026-08-15 03:21:10.567	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
e83f402e-02f9-4a80-ad61-88e8b4cd46f3	ddcc3bd4-b152-4a41-9847-b7aee2275b8b	2	1b3c9a61-25ee-42ed-99ee-2035ae5862ef	\N	\N	\N	\N	\N	\N	2026-08-15 03:21:10.567	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
44ef208c-f742-483e-8110-ef701b5a5b9e	ddcc3bd4-b152-4a41-9847-b7aee2275b8b	3	b71bc4b6-9be9-4113-9cba-d064205d60aa	\N	\N	\N	\N	\N	\N	2026-08-15 03:21:10.567	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
310dffca-f377-4c23-a5cf-87ad457facfa	06eca6cc-75f9-485e-bc4c-4273d06670b1	1	e14683b7-c195-4fb7-b2fc-3a82ba2c222b	\N	\N	\N	\N	\N	\N	2026-08-15 03:32:38.528	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4b1b318f-919a-484e-bdfe-29bd0db8dbc1	06eca6cc-75f9-485e-bc4c-4273d06670b1	2	70bc1992-0d81-4352-963b-1d4ab028bf2b	\N	\N	\N	\N	\N	\N	2026-08-15 03:32:38.528	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
8e72624e-f3da-413a-81bd-ae793b7779cb	06eca6cc-75f9-485e-bc4c-4273d06670b1	3	850246fe-1abe-4ccd-b8d1-be8eb8c925cb	\N	\N	\N	\N	\N	\N	2026-08-15 03:32:38.528	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
ceddb741-3293-4182-989c-0a63bca905da	19d33ee1-80af-4513-94a0-53a9233e2aeb	1	f915121f-4cfa-4576-9b7b-3c151f31e52c	\N	\N	\N	\N	\N	\N	2026-08-15 12:38:33.703	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
990756f6-19c7-47da-8e51-348eaefdda24	19d33ee1-80af-4513-94a0-53a9233e2aeb	2	da2b46e7-55ec-4634-a288-7b6fd1a63270	\N	\N	\N	\N	\N	\N	2026-08-15 12:38:33.703	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
ee4ab579-fe39-4c49-90ce-549243724092	19d33ee1-80af-4513-94a0-53a9233e2aeb	3	731c4259-f7eb-47c3-bec3-52def55a2ee0	\N	\N	\N	\N	\N	\N	2026-08-15 12:38:33.703	REALIZADA	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
6e94b192-39a8-422c-be4d-52a032b39309	887160d4-2b5a-460f-ae93-4b153096cfd4	1	\N	\N	\N	\N	\N	2026-08-21 18:33:08.732	\N	2026-08-21 18:33:08.733	PLANEJADA	\N	\N	\N	\N	A00086	HUMBERTO EUSTAQUIO DE QUEIROZ	UNAI	FAZ. CAPAO DO ARROZ/RIACHO, SN	\N	\N	\N	\N
5ee8155f-4e79-40c2-ba12-7dcf86cd2549	887160d4-2b5a-460f-ae93-4b153096cfd4	2	\N	\N	\N	\N	\N	2026-08-21 18:33:21.649	\N	2026-08-21 18:33:21.649	PLANEJADA	\N	\N	\N	\N	A07503	THIAGO MOREIRA DA COSTA SANTOS	UNAI	FAZ. LOGRADOURO/ PESCOCO FINO, SN	\N	\N	\N	\N
f87047ce-ffc5-4884-bd10-f84dc929301c	887160d4-2b5a-460f-ae93-4b153096cfd4	3	\N	\N	\N	\N	\N	2026-08-21 18:33:27.803	\N	2026-08-21 18:33:27.804	PLANEJADA	\N	\N	\N	\N	A04721	MARIA NEUZA MENDES	UNAI	FAZ. INHUMAS, SN	\N	\N	\N	\N
7c925817-8869-4584-bea9-6b639a26274b	887160d4-2b5a-460f-ae93-4b153096cfd4	4	\N	\N	\N	\N	\N	2026-08-21 18:33:35.362	\N	2026-08-21 18:33:35.363	PLANEJADA	\N	\N	\N	\N	A02027	VALDINEI PAULO DE OLIVEIRA	UNAI	FAZ. PICO, SN	\N	\N	\N	\N
7af84bdb-5bb6-49c9-8354-3c7e33fea72b	7a2c3f51-1ea1-439f-8143-e7359e2a9249	1	\N	VALDINEI PAULO DE OLIVEIRA (A02027) — FAZ. PICO, SN, ZONA RURAL, UNAI/MG	\N	\N	\N	\N	\N	2026-08-21 18:46:04.866	PLANEJADA	VALDINEI PAULO DE OLIVEIRA (A02027) — FAZ. PICO, SN, ZONA RURAL, UNAI/MG	\N	\N	\N	A02027	VALDINEI PAULO DE OLIVEIRA	\N	\N	\N	\N	\N	\N
c55dfc32-d663-4abe-91b5-b45f48c6523b	7a2c3f51-1ea1-439f-8143-e7359e2a9249	2	\N	FABRICIO	\N	\N	\N	\N	\N	2026-08-21 18:46:04.866	PLANEJADA	FABRICIO	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
34eccf91-065f-42c4-b8c4-e0a3785895cb	887160d4-2b5a-460f-ae93-4b153096cfd4	5	\N	\N	\N	\N	\N	2026-08-21 20:05:01.071	\N	2026-08-21 20:05:01.072	PLANEJADA	\N	\N	\N	\N	A00086	HUMBERTO EUSTAQUIO DE QUEIROZ	UNAI	FAZ. CAPAO DO ARROZ/RIACHO, SN	\N	\N	\N	\N
962b7816-ca55-43d4-af65-d337f2918e2c	e6cfd30a-9f27-4bd4-bbd5-05f069a9afed	1	\N	\N	\N	\N	\N	2026-08-21 20:18:40.718	\N	2026-08-21 20:18:40.718	PLANEJADA	\N	\N	\N	\N	A00086	TESTE REVISAO	Unai	\N	\N	\N	\N	\N
7f7d5af5-7bbf-4f9c-9716-2777fb46b83a	ee60ffe1-f494-4c00-86ca-c8b5026a33c6	1	\N	\N	\N	\N	\N	2026-08-24 15:00:00	\N	2026-08-21 20:55:03.245	PLANEJADA	\N	\N	\N	18064ce5-d29a-461e-bf9b-412929070fec	A00086	HUMBERTO EUSTAQUIO DE QUEIROZ	UNAI	FAZ. CAPAO DO ARROZ/RIACHO, SN	\N	\N	\N	\N
40ce025d-dcfb-4be8-8d8f-a4f85798b461	ee60ffe1-f494-4c00-86ca-c8b5026a33c6	2	\N	\N	\N	\N	\N	2026-08-25 15:00:00	\N	2026-08-21 20:55:38.185	PLANEJADA	\N	\N	\N	5d9092a0-acf6-49c9-8774-36416e9f9586	A00086	HUMBERTO EUSTAQUIO DE QUEIROZ	UNAI	FAZ. BOQUEIRAO, SN	\N	\N	\N	\N
8f51713b-53b2-441a-86ef-747fe8eebfdc	2af0727d-9df8-4988-9f91-e765a7135703	1	\N	\N	-16.3625046	-46.8979149	\N	2026-08-21 20:41:38.343	\N	2026-08-21 20:41:38.344	REALIZADA	\N	\N	\N	\N	A02027	VALDINEI PAULO DE OLIVEIRA	UNAI	FAZ. PICO, SN	aeefe928-2578-4338-8ae3-0c00018f5c98	16	t	\N
e75c0196-6f59-407d-8039-c44997e1cf07	fddc7f9b-de51-48a5-8e39-8d9fb03a4f76	1	\N	\N	-16.3624886	-46.8979033	\N	2026-08-23 01:27:29.448	\N	2026-08-23 01:27:29.449	REALIZADA	\N	\N	\N	\N	A02027	VALDINEI PAULO DE OLIVEIRA	UNAI	FAZ. PICO, SN	aeefe928-2578-4338-8ae3-0c00018f5c98	15	t	\N
b2043bb8-f7a5-4e6a-a951-6ad260fcd3f6	fddc7f9b-de51-48a5-8e39-8d9fb03a4f76	2	\N	\N	-16.3624854	-46.8979070	\N	2026-08-23 01:27:36.124	\N	2026-08-23 01:27:36.125	REALIZADA	\N	\N	\N	\N	A04721	MARIA NEUZA MENDES	UNAI	FAZ. INHUMAS, SN	8b14cc0c-a2fe-4af2-9a4e-37b1cbd93d9c	24	t	\N
0a4f7ed9-7a73-4f07-986f-772ac132ffec	fddc7f9b-de51-48a5-8e39-8d9fb03a4f76	4	\N	\N	-16.3625101	-46.8979107	\N	2026-08-23 01:27:48.833	\N	2026-08-23 01:27:48.834	REALIZADA	\N	\N	\N	\N	A00086	HUMBERTO EUSTAQUIO DE QUEIROZ	UNAI	FAZ. BOQUEIRAO, SN	55ea2903-1304-4a42-88b4-2f49601c8c4a	14	t	\N
28b21131-5e6d-4edd-9946-835c535e8c55	fddc7f9b-de51-48a5-8e39-8d9fb03a4f76	3	\N	\N	-16.3625050	-46.8979083	\N	2026-08-23 01:27:40.828	\N	2026-08-23 01:27:40.829	REALIZADA	\N	\N	\N	\N	A05762	CLENIO MARCOS MENDES	UNAI	FAZ. INHUMAS, SN	31c6520e-8da4-4a9b-ac82-85daa7c2de6f	24	t	\N
8c914596-8f41-49ed-a25f-a6257cc3211f	69f19d5f-2818-4d94-b3c2-0de0c377fc12	1	\N	\N	-16.3625003	-46.8979131	\N	2026-08-27 15:00:00	\N	2026-08-21 23:04:09.526	REALIZADA	\N	\N	\N	d481f9ee-5529-4ba8-b7f4-c5dc86bb1185	A00086	HUMBERTO EUSTAQUIO DE QUEIROZ	UNAI	FAZ. CAPAO DO ARROZ/RIACHO, SN	f3c841d6-d6e6-4280-8a35-f9b66bf4ba60	20	t	\N
95217961-67e9-4116-8bda-d58755342cda	fdfe6d25-f34c-4a90-8324-364e0433f896	1	\N	\N	\N	\N	\N	2026-08-26 15:00:00	\N	2026-08-21 23:02:49.707	PULADA	\N	\N	\N	eba206cf-207b-4197-9d65-b69af1b72bb9	A00086	HUMBERTO EUSTAQUIO DE QUEIROZ	UNAI	FAZ. CAPAO DO ARROZ/RIACHO, SN	\N	\N	\N	Não realizada — planejamento concluído sem apontamento.
\.


--
-- Data for Name: posicao_veiculo; Type: TABLE DATA; Schema: logistica; Owner: capul_user
--

COPY logistica.posicao_veiculo (id, viagem_id, latitude, longitude, precisao, velocidade, bateria, capturado_em, recebido_em) FROM stdin;
\.


--
-- Data for Name: supervisor; Type: TABLE DATA; Schema: logistica; Owner: capul_user
--

COPY logistica.supervisor (id, matricula, nome, filial_id, coordenador_id, ativo, criado_em, departamento_id) FROM stdin;
f0f5b030-4277-44aa-b7cc-81adede9ab08	E01047	CLENIO MARCOS MENDES	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	bf01c571-680c-48ce-9fb9-47efd8bfdfbd	t	2026-07-08 17:59:07.137	\N
34b6382a-340e-4ec0-8a62-3f9b595737df	E04848	JULIANA DA SILVA MARQUES	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	bf01c571-680c-48ce-9fb9-47efd8bfdfbd	t	2026-07-08 17:59:07.14	\N
576f8376-e324-4c50-833f-1997775c121b	SEED9001	SUPERVISOR SEED (TESTE)	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	bf01c571-680c-48ce-9fb9-47efd8bfdfbd	t	2026-07-08 17:59:07.143	\N
45c81a3a-e195-499b-8b72-363e2332db2b	SUPVEN01	SUPERVISOR VENDAS 01 (TESTE)	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	984cd0c0-65a7-483f-b4cc-8c174c14d5d2	t	2026-07-08 17:59:07.145	\N
33f66283-a227-4e16-90e0-371293f847f6	SUPVEN02	SUPERVISOR VENDAS 02 (TESTE)	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	984cd0c0-65a7-483f-b4cc-8c174c14d5d2	t	2026-07-08 17:59:07.147	\N
1d863003-928c-493f-a340-27cea3898362	SUPVEN03	SUPERVISOR VENDAS 03 (TESTE)	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	332fad8c-e746-453e-80b7-e47b01387f0f	t	2026-07-08 17:59:07.15	\N
a180f1fa-a3aa-4b19-b0ff-212fd39d5dcc	SUPVEN04	SUPERVISOR VENDAS 04 (TESTE)	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	332fad8c-e746-453e-80b7-e47b01387f0f	t	2026-07-08 17:59:07.152	\N
d07351ea-56cc-4e9e-83e2-36096f5000ea	SUPVEN05	SUPERVISOR VENDAS 05 (TESTE)	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	ba3913a1-62e0-43d7-bf13-fd6dcf5c3bc2	t	2026-07-08 17:59:07.155	\N
9adcb9cd-d48f-4275-b368-b12d68af7f5b	SUPVEN06	SUPERVISOR VENDAS 06 (TESTE)	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	ba3913a1-62e0-43d7-bf13-fd6dcf5c3bc2	t	2026-07-08 17:59:07.157	\N
311b4e69-4e96-49f2-a232-f898dac69503	SUPVEN07	SUPERVISOR VENDAS 07 (TESTE)	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	72a41049-a335-4eb7-af6b-c6af433050b9	t	2026-07-08 17:59:07.159	\N
b178c1a4-0592-4090-b2a8-31098cde190c	SUPVEN08	SUPERVISOR VENDAS 08 (TESTE)	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	72a41049-a335-4eb7-af6b-c6af433050b9	t	2026-07-08 17:59:07.162	\N
b5a67784-469d-4705-83f9-b0ff185e5a2e	005274	Kelver Eduardo dos Santos Florenço	d764d838-e177-421f-a79d-cb71abdbda83	187b1458-8eec-4c07-8e38-60c017441287	t	2026-07-14 20:36:33.914	ffaabe83-c038-4db4-8944-6b19926e8e94
c6b91940-8758-4be4-a8a3-4b8e6b76ffc6	003448	Fabricio Silva Neiva	d764d838-e177-421f-a79d-cb71abdbda83	\N	t	2026-07-18 01:16:27.128	ffaabe83-c038-4db4-8944-6b19926e8e94
\.


--
-- Data for Name: supervisor_departamento; Type: TABLE DATA; Schema: logistica; Owner: capul_user
--

COPY logistica.supervisor_departamento (id, filial_id, departamento_id, usuario_id, criado_em, criado_por_id) FROM stdin;
58e6c424-e6a1-4344-8eb0-0799e0ac3d77	4884c4bf-54b1-40a0-9b33-bd48e0190ff4	739c9209-89c9-4397-ba14-8678c07326a7	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	2026-07-27 21:09:41.269	BACKFILL_20260727180000
101151b7-482f-4fb3-842a-7d749e5370a0	8e843247-5b6b-4404-ba62-a74b84ccb287	72539802-0df7-4c46-ae22-7c57479bd748	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-27 21:09:41.269	BACKFILL_20260727180000
77a7d1a1-70d6-41d7-b2bd-c9d956f50fb2	cd644507-4dc3-448d-9f53-c6df8db329dc	823ba3c1-8e07-42ad-b9de-835ed22a1159	b87b26cf-fcd5-48d8-9e3d-3b50404440b8	2026-07-27 21:09:41.269	BACKFILL_20260727180000
e5989e8a-8d56-4ab9-9c52-9a4e07970509	d764d838-e177-421f-a79d-cb71abdbda83	ffaabe83-c038-4db4-8944-6b19926e8e94	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-08-01 02:06:49.484	3bb16284-0c24-40e0-adb3-d12b4bbe7a14
\.


--
-- Data for Name: tipo_despesa; Type: TABLE DATA; Schema: logistica; Owner: capul_user
--

COPY logistica.tipo_despesa (id, nome, descricao, ativo, criado_em, requer_aprovacao, categoria) FROM stdin;
935fd63a-7547-4fa8-aa01-9920ff3ad56e	Combustível	Abastecimento (gasolina, etanol, diesel)	t	2026-07-05 16:40:57.937	t	VEICULO
f94712ea-602d-40c7-adf1-78cd360c3502	Manutenção	Oficina mecânica, peças e serviços	t	2026-07-05 16:40:57.937	t	VEICULO
0f8e03c6-6ddf-4b88-aca3-2d2116a95e48	Pneu	Compra/troca de pneus	t	2026-07-05 16:40:57.937	t	VEICULO
703edff3-f76e-4a75-b895-c5e9632ffdfc	Pedágio	Pedágios da viagem	t	2026-07-05 16:40:57.937	t	VEICULO
b48e8e60-2b42-494a-87ef-bf14a2953fb6	Multa	Infrações de trânsito	t	2026-07-05 16:40:57.937	t	VEICULO
3da3b894-2caa-4a1b-bf59-6bc73f156906	IPVA	Imposto anual do veículo	t	2026-07-05 16:40:57.937	t	VEICULO
3d3abb5d-0c2b-44bb-8ea4-126ca402140a	Seguro	Seguro do veículo	t	2026-07-05 16:40:57.937	t	VEICULO
6e108550-29a0-4ce9-ac8b-ba0d2f989502	Outros	Despesas diversas	t	2026-07-05 16:40:57.937	t	VEICULO
2da1e44a-5e56-4f98-b44e-f8a75b02a5e2	Alimentação	Alimentação  durante viagem	t	2026-07-13 13:53:24.088	t	INDIVIDUO
\.


--
-- Data for Name: veiculo; Type: TABLE DATA; Schema: logistica; Owner: capul_user
--

COPY logistica.veiculo (id, filial_id, placa, renavam, chassi, modelo, marca, ano, cor, tipo, km_atual, capacidade_carga, situacao, departamento_lotacao_id, supervisor_id, ativo, criado_em, intervalo_manutencao_km, km_ultima_manutencao, km_proxima_manutencao, propriedade, porte, finalidade, supervisor_area_matricula, supervisor_area_nome) FROM stdin;
185fa4e1-792a-405b-9d68-7afb59bdcb5f	cd644507-4dc3-448d-9f53-c6df8db329dc	PVB1G87	\N	\N	CS ST MB	VW/SAVEIRO	2014	\N	CARRO	200	\N	DISPONIVEL	823ba3c1-8e07-42ad-b9de-835ed22a1159	b87b26cf-fcd5-48d8-9e3d-3b50404440b8	t	2026-07-09 18:19:30.582	\N	\N	\N	PROPRIO	LEVE	SERVICO	\N	\N
298f284c-9258-4a57-a211-3f5bd574defd	4884c4bf-54b1-40a0-9b33-bd48e0190ff4	SYS1D69	\N	\N	DUSTER INT 16	RENAULT	2023	\N	CARRO	210	\N	DISPONIVEL	739c9209-89c9-4397-ba14-8678c07326a7	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	t	2026-07-09 18:25:01.918	\N	190	\N	PROPRIO	LEVE	SERVICO	\N	\N
9a0ab60e-0fe7-4f62-8f99-a486030e67ce	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	TST0A01	\N	\N	Veículo de Teste (Saída)	\N	\N	\N	CARRO	45321	\N	EM_USO	811e4bf1-bb59-431a-87c3-405b85d3da0a	0a305767-0303-4ebe-8c09-ea7dcd0c48e1	t	2026-07-11 12:50:06.683	\N	\N	\N	PROPRIO	\N	\N	\N	\N
1e3ff606-9dc8-4cfc-8b70-fb5cc092e9c7	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	TST0A02	\N	\N	Veiculo Teste B	\N	\N	\N	CARRO	30410	\N	EM_USO	a83ac8c5-e9e6-4623-ab4f-dd54815254c1	bf01c571-680c-48ce-9fb9-47efd8bfdfbd	t	2026-07-11 13:12:13.939	\N	30410	\N	PROPRIO	\N	\N	\N	\N
3fc3020a-998a-4e99-b8f8-c8e35eeadc09	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	CLENIO	\N	\N	\N	\N	\N	\N	CARRO	1300	\N	EM_USO	811e4bf1-bb59-431a-87c3-405b85d3da0a	bf01c571-680c-48ce-9fb9-47efd8bfdfbd	t	2026-07-08 18:53:39.087	\N	\N	\N	PROPRIO	\N	PASSEIO	E02336	LIDYANE APARECIDA C G ROCHA
1c3550d2-179f-4236-b475-60aba9e68523	d764d838-e177-421f-a79d-cb71abdbda83	KELVER	\N	\N	\N	\N	\N	\N	CARRO	200	\N	EM_USO	ffaabe83-c038-4db4-8944-6b19926e8e94	3b89e857-5079-4498-bb6c-96bdbe41aac9	t	2026-07-14 18:57:37.348	\N	\N	\N	PROPRIO	LEVE	SERVICO	E05274	KELVER EDUARDO DOS S FLORENCO
a5f98a3b-3fc6-4ed5-b030-7f924bd90256	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	TST9Q99	\N	\N	\N	\N	\N	\N	CARRO	0	\N	DISPONIVEL	f13bcbe7-2cf7-4ea4-84ce-feb862747bb5	43920ca6-69c8-42c3-91bc-3f25d90aa64d	f	2026-08-09 20:06:08.743	\N	\N	\N	PROPRIO	\N	\N	\N	\N
7eaf3340-73d6-4ce7-9c2e-8c6c53f2a622	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	TST0A03	\N	\N	Veiculo Teste C	\N	\N	\N	CARRO	60540	\N	DISPONIVEL	ef97b4ea-7863-4152-9c8c-50eab5bc7521	bf01c571-680c-48ce-9fb9-47efd8bfdfbd	t	2026-07-11 13:12:14.053	\N	\N	\N	PROPRIO	\N	\N	\N	\N
9f6db697-80f6-454f-b5d3-40371d17f7c7	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	TST8K88	\N	\N	\N	\N	\N	\N	CARRO	5020	\N	DISPONIVEL	a24ac837-7ea6-41f7-a7bd-4b41cf33678d	bf01c571-680c-48ce-9fb9-47efd8bfdfbd	f	2026-08-10 00:26:59.018	\N	\N	\N	PROPRIO	\N	\N	\N	\N
cdbbb293-8357-4130-803a-d6581cc7a75b	8e843247-5b6b-4404-ba62-a74b84ccb287	SUP01	\N	\N	\N	\N	\N	\N	CARRO	1096	\N	EM_USO	72539802-0df7-4c46-ae22-7c57479bd748	f5519586-dae7-40c6-8d85-fb3195636e5a	t	2026-07-13 19:59:29.349	\N	\N	\N	PROPRIO	LEVE	ENTREGA	\N	\N
e4a24d8d-aba3-4645-908e-9b9b26034a76	d764d838-e177-421f-a79d-cb71abdbda83	LIDYANE	\N	\N	\N	\N	\N	\N	CARRO	450	\N	EM_USO	ffaabe83-c038-4db4-8944-6b19926e8e94	3b89e857-5079-4498-bb6c-96bdbe41aac9	t	2026-07-17 19:22:52.185	\N	\N	\N	PROPRIO	PESADO	ENTREGA	\N	\N
\.


--
-- Data for Name: veiculo_supervisor_area_historico; Type: TABLE DATA; Schema: logistica; Owner: capul_user
--

COPY logistica.veiculo_supervisor_area_historico (id, veiculo_id, matricula_anterior, matricula_nova, nome_novo, alterado_em, alterado_por_id) FROM stdin;
fa3ff6d0-9019-47f4-bc2b-24a1e5b98b45	3fc3020a-998a-4e99-b8f8-c8e35eeadc09	\N	E02336	LIDYANE APARECIDA C G ROCHA	2026-07-14 12:43:56.139	3bb16284-0c24-40e0-adb3-d12b4bbe7a14
980ef9e2-e9ee-4a5a-adb2-c8947a855ad9	1c3550d2-179f-4236-b475-60aba9e68523	\N	005274	KELVER EDUARDO DOS S FLORENCO	2026-07-14 18:58:35.059	3bb16284-0c24-40e0-adb3-d12b4bbe7a14
\.


--
-- Data for Name: veiculo_supervisor_historico; Type: TABLE DATA; Schema: logistica; Owner: capul_user
--

COPY logistica.veiculo_supervisor_historico (id, veiculo_id, supervisor_anterior_id, supervisor_novo_id, alterado_em, alterado_por_id) FROM stdin;
c04934ff-4885-45b4-8382-d851a5e7f211	3fc3020a-998a-4e99-b8f8-c8e35eeadc09	\N	bf01c571-680c-48ce-9fb9-47efd8bfdfbd	2026-07-08 18:53:39.094	3bb16284-0c24-40e0-adb3-d12b4bbe7a14
6b0d8200-513e-4f2d-a616-612f2b9c4a02	185fa4e1-792a-405b-9d68-7afb59bdcb5f	\N	b87b26cf-fcd5-48d8-9e3d-3b50404440b8	2026-07-09 18:19:30.586	5fb815a5-8170-44d3-8722-c4d233165682
3fbd2d1d-31ed-4cce-a050-fd4622e6a820	298f284c-9258-4a57-a211-3f5bd574defd	\N	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	2026-07-09 18:25:01.921	5fb815a5-8170-44d3-8722-c4d233165682
725b73f0-a5c7-4125-abd4-f554e4efebd1	7eaf3340-73d6-4ce7-9c2e-8c6c53f2a622	bf01c571-680c-48ce-9fb9-47efd8bfdfbd	b87b26cf-fcd5-48d8-9e3d-3b50404440b8	2026-07-11 14:05:40.164	43920ca6-69c8-42c3-91bc-3f25d90aa64d
9fc6a1fa-eeb6-4786-b4b6-f43e87ed5e4e	7eaf3340-73d6-4ce7-9c2e-8c6c53f2a622	b87b26cf-fcd5-48d8-9e3d-3b50404440b8	bf01c571-680c-48ce-9fb9-47efd8bfdfbd	2026-07-11 14:06:53.66	43920ca6-69c8-42c3-91bc-3f25d90aa64d
aa1d77ea-1821-4d31-b0dc-de023b163f13	cdbbb293-8357-4130-803a-d6581cc7a75b	\N	f5519586-dae7-40c6-8d85-fb3195636e5a	2026-07-13 19:59:29.355	3bb16284-0c24-40e0-adb3-d12b4bbe7a14
283a5a4c-8514-472a-8e6e-9088c7b8456a	1c3550d2-179f-4236-b475-60aba9e68523	\N	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-07-14 18:57:37.354	3bb16284-0c24-40e0-adb3-d12b4bbe7a14
8e77f87c-2cc6-472a-ac28-3ef892508ed7	e4a24d8d-aba3-4645-908e-9b9b26034a76	\N	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-07-17 19:22:52.191	3bb16284-0c24-40e0-adb3-d12b4bbe7a14
e58d1282-ea3d-4dfb-bf40-dfd986ff7688	a5f98a3b-3fc6-4ed5-b030-7f924bd90256	\N	43920ca6-69c8-42c3-91bc-3f25d90aa64d	2026-08-09 20:06:08.747	43920ca6-69c8-42c3-91bc-3f25d90aa64d
a0aa5f69-e664-4988-8067-9f971d9f45ac	9f6db697-80f6-454f-b5d3-40371d17f7c7	\N	bf01c571-680c-48ce-9fb9-47efd8bfdfbd	2026-08-10 00:26:59.021	3bb16284-0c24-40e0-adb3-d12b4bbe7a14
\.


--
-- Data for Name: viagem; Type: TABLE DATA; Schema: logistica; Owner: capul_user
--

COPY logistica.viagem (id, numero, filial_id, tipo, veiculo_id, motorista_id, departamento_solicitante_id, km_inicial, km_final, local_saida, data_hora_saida, observacoes_saida, data_hora_chegada, observacoes_chegada, situacao, criado_em, criado_por_id, condutor_matricula, condutor_nome, registrada_portaria, mes_referencia, adiantamento, status_planejamento, supervisor_registro_id, aprovado_por_id, aprovado_em, comentario_coordenador, porteiro_saida_matricula, porteiro_saida_nome, porteiro_retorno_matricula, porteiro_retorno_nome, rdv_viagem_id, acerto_encerrado_em, acerto_encerrado_por_id, fechado_forcado_em, fechado_forcado_por_id, fechado_em, fechado_por_id, cancelado_em, cancelado_por_id, motivo_cancelamento, departamento_aprovador_id) FROM stdin;
433e2817-304b-432e-aee5-0bda9a7df865	1	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	FROTA	3fc3020a-998a-4e99-b8f8-c8e35eeadc09	\N	811e4bf1-bb59-431a-87c3-405b85d3da0a	10	\N	\N	2026-07-08 18:56:37.104	\N	\N	\N	EM_CURSO	2026-07-08 18:56:37.105	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	E01047	CLENIO MARCOS MENDES	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
97fc97ea-2520-4ec9-80d6-88aec9071a89	24	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	\N	\N	\N	\N	\N	\N	2026-07-27 14:54:21.972	\N	2026-07-27 20:50:05.65	\N	CONCLUIDA	2026-07-27 14:54:21.973	bc6dd499-2d1c-4102-a33c-a1d75c06a596	005274	Kelver Eduardo dos Santos Florenço	f	202607	\N	CONCLUIDO	b5a67784-469d-4705-83f9-b0ff185e5a2e	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-07-27 20:48:40.533	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
2924d172-6268-4193-8bcd-9ed91a11f3d5	32	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	SUPERVISOR	\N	\N	\N	\N	\N	\N	2026-07-29 19:43:59.239	\N	\N	\N	EM_CURSO	2026-07-29 19:43:59.24	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	SEED9001	SUPERVISOR SEED (TESTE)	f	202607	\N	RASCUNHO	576f8376-e324-4c50-833f-1997775c121b	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
924165f8-dc7b-41cf-b34d-abf5b1f0b1d8	25	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	\N	\N	\N	\N	\N	\N	2026-08-01 01:36:50.443	\N	2026-08-01 02:58:08.932	\N	CONCLUIDA	2026-08-01 01:36:50.443	bc6dd499-2d1c-4102-a33c-a1d75c06a596	005274	Kelver Eduardo dos Santos Florenço	f	202607	\N	CONCLUIDO	b5a67784-469d-4705-83f9-b0ff185e5a2e	187b1458-8eec-4c07-8e38-60c017441287	2026-08-01 01:39:01.245	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
bba461dd-b0f6-4aa1-9526-e9d4d485938d	29	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	\N	\N	\N	\N	\N	\N	2026-08-01 03:00:09.853	\N	2026-08-01 03:05:41.476	\N	CONCLUIDA	2026-08-01 03:00:09.854	187b1458-8eec-4c07-8e38-60c017441287	003448	Fabricio Silva Neiva	f	202607	\N	CONCLUIDO	c6b91940-8758-4be4-a8a3-4b8e6b76ffc6	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-08-01 03:02:28.19	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
c9189912-d97c-401c-8748-215804e0889d	1	e2d9695c-4efa-4363-82a5-99d6dee1d47f	FROTA	298f284c-9258-4a57-a211-3f5bd574defd	\N	\N	100	190	CAPUL MATRIZ	2026-07-09 18:26:46.814	VISITA TECNICA	2026-07-09 18:51:06.082	\N	CONCLUIDA	2026-07-09 18:26:46.815	5fb815a5-8170-44d3-8722-c4d233165682	E04094	THUANY DE CAMPOS MACIEL	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
a5403915-2303-412f-abab-3cc4d30f2149	2	e2d9695c-4efa-4363-82a5-99d6dee1d47f	FROTA	185fa4e1-792a-405b-9d68-7afb59bdcb5f	\N	\N	100	150	CAPUL MATRIZ	2026-07-09 18:28:00.693	SERVIÇO	2026-07-10 16:00:04.974	\N	CONCLUIDA	2026-07-09 18:28:00.694	5fb815a5-8170-44d3-8722-c4d233165682	E03942	MARCELO JUNIO DE C SILVEIRA	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
14b34ee1-6c1e-4fa9-b487-b714ccd40bc2	50	d764d838-e177-421f-a79d-cb71abdbda83	FROTA	1c3550d2-179f-4236-b475-60aba9e68523	\N	ffaabe83-c038-4db4-8944-6b19926e8e94	200	\N	\N	2026-08-02 20:58:22.365	visita arinos	\N	\N	EM_CURSO	2026-08-02 20:58:22.373	3b89e857-5079-4498-bb6c-96bdbe41aac9	002336	Lidyane Aparecida Costa Rocha	f	\N	200.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
7368cbdf-0b95-4b33-aa2b-feaeb53cbadc	46	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	1c3550d2-179f-4236-b475-60aba9e68523	\N	\N	\N	\N	\N	2026-08-02 14:23:25.906	\N	2026-08-02 15:57:17.031	\N	CONCLUIDA	2026-08-02 14:23:25.907	bc6dd499-2d1c-4102-a33c-a1d75c06a596	005274	Kelver Eduardo dos Santos Florenço	f	202608	\N	CONCLUIDO	b5a67784-469d-4705-83f9-b0ff185e5a2e	187b1458-8eec-4c07-8e38-60c017441287	2026-08-02 15:18:58.498	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
b62e542e-8319-47e4-9691-36b47c8678cb	39	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	ENTREGA	7eaf3340-73d6-4ce7-9c2e-8c6c53f2a622	a33b01ad-75c5-470a-ad1c-cfeb1a557067	\N	60500	60520	\N	2026-08-10 00:28:42.572	\N	2026-08-10 00:33:03.644	\N	CONCLUIDA	2026-08-10 00:28:21.035	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
f84ccd50-801e-4d3f-ad55-ca3e53e17777	12	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	FROTA	1e3ff606-9dc8-4cfc-8b70-fb5cc092e9c7	\N	\N	30160	30410	\N	2026-07-11 14:29:09.34	\N	2026-07-11 14:45:39.62	\N	CONCLUIDA	2026-07-11 14:29:09.341	bd9dd6a3-8e61-4a5f-9443-bb3c968993cc	E01047	CLENIO MARCOS MENDES	f	\N	0.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
1144d9e4-fa9a-4b70-9d76-8ebbf629add2	9	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	FROTA	9a0ab60e-0fe7-4f62-8f99-a486030e67ce	\N	\N	45280	\N	\N	2026-07-11 14:01:19.817	\N	2026-07-11 14:03:35.789	❌ CANCELADA por Gestor de Frota 01 (TESTE): Saída registrada por engano durante teste - corrigindo.	CANCELADA	2026-07-11 14:01:19.818	a33b01ad-75c5-470a-ad1c-cfeb1a557067	E01047	Clenio M. Mendes (TESTE INDIVIDUAL)	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
29c5bb56-c634-4ed4-b539-696b1faaca51	10	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	FROTA	1e3ff606-9dc8-4cfc-8b70-fb5cc092e9c7	\N	\N	30000	30160	\N	2026-07-11 14:02:14.61	\N	2026-07-11 14:27:11.953	\N	CONCLUIDA	2026-07-11 14:02:14.611	a33b01ad-75c5-470a-ad1c-cfeb1a557067	E01047	Clenio M. Mendes (TESTE INDIVIDUAL)	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
88927c65-1f3d-4ef9-8d17-327966d3bed9	13	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	FROTA	7eaf3340-73d6-4ce7-9c2e-8c6c53f2a622	\N	\N	60000	60100	\N	2026-07-11 14:50:15.126	\N	2026-07-11 14:57:47.646	\N	CONCLUIDA	2026-07-11 14:50:15.127	a33b01ad-75c5-470a-ad1c-cfeb1a557067	E01047	Clenio M. Mendes (TESTE INDIVIDUAL)	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
91d07ce3-dfbe-4e0e-9e5b-d3cdaeb41e8b	14	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	FROTA	7eaf3340-73d6-4ce7-9c2e-8c6c53f2a622	\N	\N	60100	60420	\N	2026-07-11 22:20:29.633	\N	2026-07-11 22:21:53.263	\N	CONCLUIDA	2026-07-11 22:20:29.634	2245e7cf-f3ec-43d9-bab9-f46479d41bcf	E01047	CLENIO MARCOS MENDES	t	\N	\N	\N	\N	\N	\N	\N	E01047	CLENIO MARCOS MENDES	E01047	CLENIO MARCOS MENDES	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
e49c1893-eba9-4016-9a61-f7c3dcc84887	16	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	ENTREGA	9a0ab60e-0fe7-4f62-8f99-a486030e67ce	a33b01ad-75c5-470a-ad1c-cfeb1a557067	\N	\N	\N	\N	2026-07-11 23:24:25.53	\N	2026-07-11 23:31:29.48	\N	CONCLUIDA	2026-07-11 23:23:28.873	0a305767-0303-4ebe-8c09-ea7dcd0c48e1	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9508aab3-199b-4705-9eb4-6a6ff4fa16c1	23	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	FROTA	9a0ab60e-0fe7-4f62-8f99-a486030e67ce	\N	\N	45300	\N	\N	2026-07-12 16:27:12.994	Teste D1 API	2026-07-12 16:27:13.069	❌ CANCELADA por Gestor de Frota 01 (TESTE): cleanup teste D1 API	CANCELADA	2026-07-12 16:27:12.995	0a305767-0303-4ebe-8c09-ea7dcd0c48e1	E00301	Supervisor de Depto 01 (TESTE)	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
36c40bac-479c-41d1-8f45-ef3bd6411e52	26	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	FROTA	9a0ab60e-0fe7-4f62-8f99-a486030e67ce	\N	\N	45330	\N	\N	2026-07-12 16:55:19.418	D1 OK	2026-07-12 16:55:19.54	❌ CANCELADA por Gestor de Frota 01 (TESTE): cleanup D1 ok	CANCELADA	2026-07-12 16:55:19.419	0a305767-0303-4ebe-8c09-ea7dcd0c48e1	001047	Supervisor de Depto 01 (TESTE)	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
c6102448-c9fc-412a-969e-279e7ebf2758	24	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	FROTA	9a0ab60e-0fe7-4f62-8f99-a486030e67ce	\N	\N	45305	\N	\N	2026-07-12 16:34:05.322	Teste D1 API — matricula 001047	2026-07-12 16:34:05.492	❌ CANCELADA por Gestor de Frota 01 (TESTE): cleanup D1 API 001047	CANCELADA	2026-07-12 16:34:05.323	0a305767-0303-4ebe-8c09-ea7dcd0c48e1	001047	Supervisor de Depto 01 (TESTE)	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
c5b989d4-cacd-4bd3-b5a9-92a7b71e7ef8	25	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	FROTA	9a0ab60e-0fe7-4f62-8f99-a486030e67ce	\N	\N	45305	45320	\N	2026-07-12 16:50:44.379	Teste QA Supervisor - Bloco D1	2026-07-12 16:52:14.661	\N	CONCLUIDA	2026-07-12 16:50:44.38	0a305767-0303-4ebe-8c09-ea7dcd0c48e1	001047	Supervisor de Depto 01 (TESTE)	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
901f1bea-3df2-460b-8006-62b3df88525c	8	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	FROTA	9a0ab60e-0fe7-4f62-8f99-a486030e67ce	\N	\N	45000	45280	\N	2026-07-11 13:49:50.042	\N	2026-07-11 13:56:42.234	\N	CONCLUIDA	2026-07-11 13:49:50.043	a33b01ad-75c5-470a-ad1c-cfeb1a557067	E01047	Clenio M. Mendes (TESTE INDIVIDUAL)	f	\N	500.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
550de3fe-16e7-4702-851c-2b7f92a359f3	3	e2d9695c-4efa-4363-82a5-99d6dee1d47f	FROTA	298f284c-9258-4a57-a211-3f5bd574defd	\N	\N	190	200	CAPUL MATRIZ	2026-07-13 13:26:59.737	manutencao	2026-07-13 13:29:09.612	\N	CONCLUIDA	2026-07-13 13:26:59.738	5fb815a5-8170-44d3-8722-c4d233165682	E03942	Marcelo Junio De Castro Silveira	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
57574567-af94-4f13-b177-67efe7ef3982	4	e2d9695c-4efa-4363-82a5-99d6dee1d47f	FROTA	298f284c-9258-4a57-a211-3f5bd574defd	\N	\N	200	210	\N	2026-07-13 13:30:18.544	SERVICO	2026-07-13 16:35:44.328	\N	CONCLUIDA	2026-07-13 13:30:18.545	5fb815a5-8170-44d3-8722-c4d233165682	E03942	Marcelo Junio De Castro Silveira	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
11370327-000a-4ffd-a729-10c37f8aac19	15	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	FROTA	7eaf3340-73d6-4ce7-9c2e-8c6c53f2a622	\N	\N	60450	60451	\N	2026-07-11 22:29:08.143	\N	2026-07-14 12:46:39.089	\N	CONCLUIDA	2026-07-11 22:29:08.144	2245e7cf-f3ec-43d9-bab9-f46479d41bcf	E01047	CLENIO MARCOS MENDES	t	\N	\N	\N	\N	\N	\N	\N	E01047	CLENIO MARCOS MENDES	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
33136350-2755-426e-b93a-00d2eac228f0	5	e2d9695c-4efa-4363-82a5-99d6dee1d47f	FROTA	185fa4e1-792a-405b-9d68-7afb59bdcb5f	\N	\N	150	170	\N	2026-07-13 13:35:29.219	BUSVAR OPERADOR	2026-07-13 13:39:02.239	\N	CONCLUIDA	2026-07-13 13:35:29.22	5fb815a5-8170-44d3-8722-c4d233165682	E03942	Marcelo Junio De Castro Silveira	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
b4e001ad-250f-44bc-9012-2b2e62c98d03	6	e2d9695c-4efa-4363-82a5-99d6dee1d47f	FROTA	185fa4e1-792a-405b-9d68-7afb59bdcb5f	\N	\N	170	180	\N	2026-07-13 13:39:50.636	BUSCAR EMPILHADEIRA	2026-07-13 13:49:51.793	\N	CONCLUIDA	2026-07-13 13:39:50.637	5fb815a5-8170-44d3-8722-c4d233165682	E03942	Marcelo Junio De Castro Silveira	f	\N	500.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
fad33b4a-d314-4c19-9e29-ea83b149c233	1	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	15	25	\N	2026-07-13 20:00:44.01	\N	2026-07-16 18:47:00.309	\N	CONCLUIDA	2026-07-13 20:00:37.109	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
bbb265f7-d31e-4f79-aaaa-99b4514b8143	7	e2d9695c-4efa-4363-82a5-99d6dee1d47f	FROTA	185fa4e1-792a-405b-9d68-7afb59bdcb5f	\N	\N	180	200	\N	2026-07-13 13:50:50.789	BUSCAR PCS EM GOIANIA	2026-07-13 13:55:29.973	\N	CONCLUIDA	2026-07-13 13:50:50.79	5fb815a5-8170-44d3-8722-c4d233165682	E03942	Marcelo Junio De Castro Silveira	f	\N	1000.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
b773b545-a34b-4cfd-9dcc-0d49b1b7055c	31	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	\N	\N	\N	\N	\N	\N	2026-08-01 03:13:35.062	\N	2026-08-01 03:48:09.378	\N	CONCLUIDA	2026-08-01 03:13:35.062	187b1458-8eec-4c07-8e38-60c017441287	003448	Fabricio Silva Neiva	f	202608	\N	CONCLUIDO	c6b91940-8758-4be4-a8a3-4b8e6b76ffc6	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-08-01 03:47:14.598	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
f52ef6d7-d0bd-4fea-a164-a2d39e3d679e	27	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	FROTA	9a0ab60e-0fe7-4f62-8f99-a486030e67ce	\N	a24ac837-7ea6-41f7-a7bd-4b41cf33678d	45320	45321	\N	2026-07-14 12:55:38.257	\N	2026-07-14 12:58:15.939	\N	CONCLUIDA	2026-07-14 12:55:38.258	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	E02336	LIDYANE APARECIDA C G ROCHA	t	\N	\N	\N	\N	\N	\N	\N	E01047	CLENIO MARCOS MENDES	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4d457e4d-7fc1-4f30-ab5f-acb805bc5586	28	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	FROTA	9a0ab60e-0fe7-4f62-8f99-a486030e67ce	\N	a24ac837-7ea6-41f7-a7bd-4b41cf33678d	45321	\N	\N	2026-07-14 13:00:08.395	\N	\N	\N	EM_CURSO	2026-07-14 13:00:08.396	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	E02336	LIDYANE APARECIDA C G ROCHA	t	\N	\N	\N	\N	\N	\N	\N	E01047	CLENIO MARCOS MENDES	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
0f08e2e9-6b64-4794-9203-c4c6414ca684	26	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	\N	\N	\N	\N	\N	\N	2026-08-01 01:39:37.251	\N	2026-08-01 02:57:30.86	\N	CONCLUIDA	2026-08-01 01:39:37.252	187b1458-8eec-4c07-8e38-60c017441287	003448	Fabricio Silva Neiva	f	202607	\N	CONCLUIDO	c6b91940-8758-4be4-a8a3-4b8e6b76ffc6	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-08-01 01:43:16.429	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5daae0ca-dd62-4cfe-9fc6-bb6aad117aaa	30	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	\N	\N	\N	\N	\N	\N	2026-08-01 03:13:04.128	\N	2026-08-01 03:55:02.547	\N	CONCLUIDA	2026-08-01 03:13:04.128	3b89e857-5079-4498-bb6c-96bdbe41aac9	003448	Fabricio Silva Neiva	f	202608	\N	CONCLUIDO	c6b91940-8758-4be4-a8a3-4b8e6b76ffc6	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-08-01 03:52:47.96	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
15e6a273-9127-465b-85ed-a826c38893aa	2	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	\N	\N	\N	2026-07-16 18:59:57.054	\N	2026-07-16 19:05:52.458	\N	CONCLUIDA	2026-07-16 18:53:04.112	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
696c9461-4d7b-47cd-86f5-f9a875a08e9a	40	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	1c3550d2-179f-4236-b475-60aba9e68523	\N	\N	\N	\N	\N	2026-08-01 14:31:50.533	\N	2026-08-02 15:54:56.285	\N	CONCLUIDA	2026-08-01 14:31:50.534	bc6dd499-2d1c-4102-a33c-a1d75c06a596	005274	Kelver Eduardo dos Santos Florenço	f	202608	\N	CONCLUIDO	b5a67784-469d-4705-83f9-b0ff185e5a2e	187b1458-8eec-4c07-8e38-60c017441287	2026-08-01 14:32:58.192	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
f02d9aea-20bf-4cb7-8082-66b6c5083cc0	47	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	\N	\N	\N	\N	\N	\N	2026-08-02 14:24:19.398	\N	2026-08-02 20:13:03.016	\N	CONCLUIDA	2026-08-02 14:24:19.399	187b1458-8eec-4c07-8e38-60c017441287	003448	Fabricio Silva Neiva	f	202608	\N	CONCLUIDO	c6b91940-8758-4be4-a8a3-4b8e6b76ffc6	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-08-02 15:52:45.968	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
14807237-1f69-4de7-9ccf-2f4f8e7f07ac	52	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	1c3550d2-179f-4236-b475-60aba9e68523	\N	\N	\N	\N	\N	2026-08-05 19:48:39.136	\N	2026-08-05 19:57:39.75	\N	CONCLUIDA	2026-08-05 19:48:39.137	bc6dd499-2d1c-4102-a33c-a1d75c06a596	005274	Kelver Eduardo dos Santos Florenço	f	202608	\N	CONCLUIDO	b5a67784-469d-4705-83f9-b0ff185e5a2e	187b1458-8eec-4c07-8e38-60c017441287	2026-08-05 19:50:06.688	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
1c028432-b6ee-4177-a47a-d276ef97feaa	51	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	1c3550d2-179f-4236-b475-60aba9e68523	\N	\N	\N	\N	\N	2026-08-03 20:31:24.35	\N	2026-08-03 20:36:56.396	\N	CONCLUIDA	2026-08-03 20:31:24.351	bc6dd499-2d1c-4102-a33c-a1d75c06a596	005274	Kelver Eduardo dos Santos Florenço	f	202608	\N	CONCLUIDO	b5a67784-469d-4705-83f9-b0ff185e5a2e	187b1458-8eec-4c07-8e38-60c017441287	2026-08-03 20:32:42.068	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
2274ce0b-e46e-4ab3-8499-10e8810767ec	3	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	45	\N	2026-07-16 19:07:04.555	\N	2026-07-16 19:18:15.625	\N	CONCLUIDA	2026-07-16 19:06:55.372	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
c2b7060a-8f0e-4f68-a33f-e72ce1f0f5c2	4	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	\N	2026-07-16 19:21:20.602	\N	2026-07-16 19:24:03.529	\N	CONCLUIDA	2026-07-16 19:15:10.079	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
52ddd7f8-3807-4c11-a614-bb75dfedcd2a	33	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	FROTA	7eaf3340-73d6-4ce7-9c2e-8c6c53f2a622	\N	e1310cd9-8c92-4c36-ae4d-eb5485e1ef7d	60451	60455	\N	2026-08-06 13:19:17.541	Garantia	2026-08-06 13:22:08.639	\N	CONCLUIDA	2026-08-06 13:19:17.562	c1b73153-450a-4b78-a027-c8ba184afb3b	E04099	TAUANY DE OLIVEIRA MENDES	f	\N	500.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-08-06 13:22:08.639	c1b73153-450a-4b78-a027-c8ba184afb3b	\N	\N	\N	\N
d0863807-9da6-4edb-bc41-dbe7eafb4f3b	5	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	\N	\N	\N	2026-07-16 19:29:40.814	\N	2026-07-16 19:30:56.702	\N	CONCLUIDA	2026-07-16 19:29:23.545	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
3e8d99fe-48ed-4ffc-875b-025927fd5067	6	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	50	\N	2026-07-16 19:32:10.061	\N	2026-07-16 19:34:03.197	\N	CONCLUIDA	2026-07-16 19:32:04.018	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
e2da10a7-4e6d-460b-9a98-445b4119a7d7	36	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	FROTA	7eaf3340-73d6-4ce7-9c2e-8c6c53f2a622	\N	a24ac837-7ea6-41f7-a7bd-4b41cf33678d	60455	60480	\N	2026-08-09 20:33:28.515	Roteiro 3 - teste	2026-08-09 22:22:17.1	\N	CONCLUIDA	2026-08-09 20:33:28.526	a33b01ad-75c5-470a-ad1c-cfeb1a557067	E01047	Clenio M. Mendes (TESTE INDIVIDUAL)	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-08-09 22:22:17.101	a33b01ad-75c5-470a-ad1c-cfeb1a557067	\N	\N	\N	a24ac837-7ea6-41f7-a7bd-4b41cf33678d
bb55baee-4422-4df4-af91-3d080169a43d	7	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	\N	\N	2026-07-16 19:41:59.934	\N	2026-07-16 19:43:50.473	\N	CONCLUIDA	2026-07-16 19:40:12.494	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
2cac3079-82c2-4409-819b-420b3f4ac9b2	8	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	55	75	\N	2026-07-16 19:47:05.338	\N	2026-07-16 19:49:54.484	\N	CONCLUIDA	2026-07-16 19:46:20.063	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
2b72ea83-fa14-4236-a8e6-18f11c776420	31	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	ENTREGA	1e3ff606-9dc8-4cfc-8b70-fb5cc092e9c7	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	\N	30411	\N	\N	2026-07-17 13:49:05.353	\N	\N	\N	EM_CURSO	2026-07-17 13:48:58.79	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
788b9ddf-e1f3-4ff0-a098-fe4090f88076	10	d764d838-e177-421f-a79d-cb71abdbda83	FROTA	1c3550d2-179f-4236-b475-60aba9e68523	\N	\N	120	150	\N	2026-07-17 19:14:48.455	\N	2026-07-18 01:06:51.741	\N	CONCLUIDA	2026-07-17 19:14:48.455	bc6dd499-2d1c-4102-a33c-a1d75c06a596	005274	Kelver Eduardo dos Santos Florenço	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
efde89c3-26f2-4fe6-8579-f6ec3d2ee9c5	11	d764d838-e177-421f-a79d-cb71abdbda83	FROTA	e4a24d8d-aba3-4645-908e-9b9b26034a76	\N	ffaabe83-c038-4db4-8944-6b19926e8e94	120	350	\N	2026-07-17 19:37:32.974	Treinamento TMS	2026-07-17 19:52:55.105	\N	CONCLUIDA	2026-07-17 19:37:32.975	3b89e857-5079-4498-bb6c-96bdbe41aac9	002336	Lidyane Aparecida Costa Rocha	f	\N	1200.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
6a98ef89-f784-4a49-809c-a8bc1eeba6f0	12	d764d838-e177-421f-a79d-cb71abdbda83	FROTA	e4a24d8d-aba3-4645-908e-9b9b26034a76	\N	\N	350	400	\N	2026-07-17 23:44:19.827	\N	2026-07-17 23:45:10.307	Teste A10 - retorno individual sem senha	CONCLUIDA	2026-07-17 23:44:19.828	3b89e857-5079-4498-bb6c-96bdbe41aac9	002336	Lidyane Aparecida Costa Rocha	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
2845921a-4a56-43d5-b3e1-36506c046f71	40	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	ENTREGA	7eaf3340-73d6-4ce7-9c2e-8c6c53f2a622	a33b01ad-75c5-470a-ad1c-cfeb1a557067	\N	\N	60540	\N	2026-08-10 00:46:17.842	\N	2026-08-10 00:47:15.001	Teste roteiro 8 - 8.6 forcar encerramento	CONCLUIDA	2026-08-10 00:46:02.405	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-08-10 00:47:15.001	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	\N	\N	\N	\N	\N	\N
ee0f51c8-6a29-4d72-9d8f-44dbd5aabd7f	24	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	996	997	\N	2026-08-10 20:07:57.504	\N	2026-08-10 20:47:30.862	\N	CONCLUIDA	2026-08-10 20:07:50.049	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
557c1c38-efe2-476e-9825-339206ad26bd	27	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	\N	\N	\N	\N	\N	\N	2026-08-01 02:04:36.337	\N	2026-08-01 02:57:25.342	\N	CONCLUIDA	2026-08-01 02:04:36.338	187b1458-8eec-4c07-8e38-60c017441287	003448	Fabricio Silva Neiva	f	202607	\N	CONCLUIDO	c6b91940-8758-4be4-a8a3-4b8e6b76ffc6	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-08-01 02:35:45.093	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
487dad68-0379-44f0-b86c-3505a020f888	26	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	998	1000	\N	2026-08-11 11:40:39.607	\N	2026-08-11 14:27:24.41	\N	CONCLUIDA	2026-08-11 11:40:36.498	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
fcb4b24d-a032-4735-96b2-2815310a8acc	21	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	992	993	\N	2026-08-10 18:19:31.912	\N	2026-08-10 18:34:54.569	\N	CONCLUIDA	2026-08-10 18:19:29.41	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
b845e238-1078-4645-b5c4-a0c28fcf0a20	28	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	1050	1080	\N	2026-08-11 14:53:50.957	\N	2026-08-11 14:55:25.887	\N	CONCLUIDA	2026-08-11 14:53:39.055	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
ae2d1371-b430-47ef-81b3-502b1606a879	32	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	\N	\N	\N	\N	\N	\N	2026-08-01 04:30:41.305	\N	2026-08-02 20:55:15.493	\N	CONCLUIDA	2026-08-01 04:30:41.306	187b1458-8eec-4c07-8e38-60c017441287	003448	Fabricio Silva Neiva	f	202608	\N	CONCLUIDO	c6b91940-8758-4be4-a8a3-4b8e6b76ffc6	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-08-02 20:20:30.699	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
514d497f-4afe-4e9a-845c-c4cb08960127	19	d764d838-e177-421f-a79d-cb71abdbda83	FROTA	e4a24d8d-aba3-4645-908e-9b9b26034a76	\N	\N	400	450	\N	2026-07-18 03:09:50.714	\N	2026-07-18 03:10:58.564	\N	CONCLUIDA	2026-07-18 03:09:50.715	3b89e857-5079-4498-bb6c-96bdbe41aac9	002336	Lidyane Aparecida Costa Rocha	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5c8f9022-3adb-4f33-998d-7fa12aa475c2	31	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	1087	1087	\N	2026-08-15 00:18:42.157	\N	2026-08-15 00:46:21.875	\N	CONCLUIDA	2026-08-15 00:18:38.821	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
892c2d0d-aebc-44cf-928e-e2ab9d107e40	35	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	1092	1092	\N	2026-08-15 01:36:29.286	\N	2026-08-15 01:50:05.956	\N	CONCLUIDA	2026-08-15 01:36:25.876	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
7c44a2e0-e301-4c90-a5ea-221bb27f9009	20	d764d838-e177-421f-a79d-cb71abdbda83	FROTA	1c3550d2-179f-4236-b475-60aba9e68523	\N	\N	150	200	\N	2026-07-18 03:23:45.183	\N	2026-07-18 03:24:23.535	\N	CONCLUIDA	2026-07-18 03:23:45.184	3b89e857-5079-4498-bb6c-96bdbe41aac9	002336	Lidyane Aparecida Costa Rocha	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
63251972-866f-43e0-a427-0c9d4c1986d0	19	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	978	990	\N	2026-08-06 12:58:30.212	\N	2026-08-06 13:07:15.085	\N	CONCLUIDA	2026-08-06 12:58:25.6	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
ccd8475c-e536-4cbe-9b1b-de0785db37c5	45	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	1c3550d2-179f-4236-b475-60aba9e68523	\N	\N	\N	\N	\N	2026-08-02 00:45:21.113	\N	2026-08-02 15:55:07.877	\N	CONCLUIDA	2026-08-02 00:45:21.114	bc6dd499-2d1c-4102-a33c-a1d75c06a596	005274	Kelver Eduardo dos Santos Florenço	f	202608	\N	CONCLUIDO	b5a67784-469d-4705-83f9-b0ff185e5a2e	187b1458-8eec-4c07-8e38-60c017441287	2026-08-02 00:47:24.583	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
3407a8f2-daa0-4f5c-a4ac-9c9131d1fc01	23	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	995	996	\N	2026-08-10 18:58:12.364	\N	2026-08-10 20:07:11.049	\N	CONCLUIDA	2026-08-10 18:58:07.517	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
6b6c451e-8f97-47b4-8ef0-e2feea90ad4a	33	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	1090	1091	\N	2026-08-15 01:01:04.59	\N	2026-08-15 01:06:54.021	\N	CONCLUIDA	2026-08-15 01:01:00.887	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
3c538f9f-9961-401c-9134-d9e67a2ebf80	34	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	FROTA	\N	\N	\N	\N	\N	\N	2026-08-09 18:40:09.205	Viagem de onibus - prestacao de contas	2026-08-09 18:40:55.874	❌ CANCELADA por Administrador: Registro de teste do ponto 3 — removido	CANCELADA	2026-08-09 18:40:09.222	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	E02336	LIDYANE APARECIDA C G ROCHA	f	\N	300.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	ffaabe83-c038-4db4-8944-6b19926e8e94
256ea20b-fc14-4499-bb16-9e3cb55ca493	37	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	FROTA	\N	\N	a24ac837-7ea6-41f7-a7bd-4b41cf33678d	\N	\N	\N	2026-08-09 22:32:01.539	viagem de ônibus - Roteiro 5 teste	2026-08-09 22:48:35.947	❌ CANCELADA por Administrador: Desfazer roteiro 5 - viagem de teste	CANCELADA	2026-08-09 22:32:01.55	a33b01ad-75c5-470a-ad1c-cfeb1a557067	E01047	Clenio M. Mendes (TESTE INDIVIDUAL)	f	\N	0.50	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	a24ac837-7ea6-41f7-a7bd-4b41cf33678d
804e9e6d-7377-494b-9621-95f2b787bcab	36	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	1092	1092	\N	2026-08-15 01:50:24.462	\N	2026-08-15 01:59:05.609	\N	CONCLUIDA	2026-08-15 01:50:21.847	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4ce7c544-ee84-40cb-80e8-b2ec20a740c7	37	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	1092	1092	\N	2026-08-15 02:05:09.872	\N	2026-08-15 02:09:42.208	\N	CONCLUIDA	2026-08-15 02:05:06.513	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
a53ed598-fe0f-44e0-8eac-ec19cf08e787	38	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	1092	1093	\N	2026-08-15 02:11:01.254	\N	2026-08-15 02:14:16.33	\N	CONCLUIDA	2026-08-15 02:10:57.673	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
e1de5ac7-744e-4e77-bd0e-e3ee2d13a543	39	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	1093	1093	\N	2026-08-15 02:21:42.258	\N	2026-08-15 02:40:54.065	\N	CONCLUIDA	2026-08-15 02:18:52.878	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
e108051f-5d0f-42aa-bc18-43f76aaf18a1	40	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	1093	1094	\N	2026-08-15 02:41:27.025	\N	2026-08-15 02:43:56.329	\N	CONCLUIDA	2026-08-15 02:41:24.495	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
2f1ec1e7-dcdd-45f3-8cdb-af8a02b72bdd	48	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	\N	\N	\N	\N	\N	\N	2026-08-02 14:30:00.784	\N	2026-08-21 20:34:02.642	\N	CONCLUIDA	2026-08-02 14:30:00.785	187b1458-8eec-4c07-8e38-60c017441287	003448	Fabricio Silva Neiva	f	202608	\N	CONCLUIDO	c6b91940-8758-4be4-a8a3-4b8e6b76ffc6	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-08-02 15:24:12.31	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
bd238b51-81ab-46fc-b456-b5c60624ad04	23	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	\N	\N	\N	\N	\N	\N	2026-07-27 14:29:04.362	\N	\N	\N	CANCELADA	2026-07-27 14:29:04.363	187b1458-8eec-4c07-8e38-60c017441287	003448	Fabricio Silva Neiva	f	202607	\N	CANCELADO	c6b91940-8758-4be4-a8a3-4b8e6b76ffc6	3b89e857-5079-4498-bb6c-96bdbe41aac9	2026-07-27 14:30:41.85	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-07-27 20:47:50.485	3b89e857-5079-4498-bb6c-96bdbe41aac9	teste	\N
5e3555b8-3b59-49cf-bd7c-a7f14d6a741c	9	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	\N	\N	\N	2026-07-18 23:48:29.36	\N	2026-07-18 23:50:50.3	\N	CONCLUIDA	2026-07-18 23:47:05.346	f5519586-dae7-40c6-8d85-fb3195636e5a	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
fb64d02b-55a1-444c-9007-0cb3f9f8539a	17	8e843247-5b6b-4404-ba62-a74b84ccb287	FROTA	cdbbb293-8357-4130-803a-d6581cc7a75b	\N	72539802-0df7-4c46-ae22-7c57479bd748	976	977	\N	2026-07-26 21:59:48.623	\N	2026-07-26 22:00:26.665	\N	CONCLUIDA	2026-07-26 21:59:48.631	0117ccd5-cafc-4f3b-89b1-d681f600588c	E03422	RAYDE APARECIDA V B CASTRO	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-07-26 22:00:26.666	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	\N
7f6db640-edf4-4719-9efe-2f76d6de4782	25	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	997	998	\N	2026-08-10 20:56:12.47	\N	2026-08-10 21:15:38.273	\N	CONCLUIDA	2026-08-10 20:56:09.009	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
0e881e0a-6279-4740-9045-0956aa2f0fe7	28	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	\N	\N	\N	\N	\N	\N	2026-08-01 02:58:36.259	\N	2026-08-01 03:07:00.644	\N	CONCLUIDA	2026-08-01 02:58:36.26	bc6dd499-2d1c-4102-a33c-a1d75c06a596	005274	Kelver Eduardo dos Santos Florenço	f	202607	\N	CONCLUIDO	b5a67784-469d-4705-83f9-b0ff185e5a2e	187b1458-8eec-4c07-8e38-60c017441287	2026-08-01 03:01:16.578	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
bda72278-06a4-42a3-b463-e4f631beee09	10	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	\N	80	\N	2026-07-25 00:36:46.148	\N	2026-07-25 01:50:06.974	\N	CONCLUIDA	2026-07-25 00:36:37.385	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5b199bfc-a924-458d-a3c8-1db67835c2dc	11	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	\N	85	\N	2026-07-25 02:36:11.167	\N	2026-07-25 22:45:32.278	\N	CONCLUIDA	2026-07-25 02:36:08.291	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
c4415f62-2573-4e23-96f5-d53dcbaa3def	27	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	1000	1050	\N	2026-08-11 14:30:23.467	\N	2026-08-11 14:52:56.068	\N	CONCLUIDA	2026-08-11 14:30:12.478	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
d708c387-13a8-424f-8611-122d2b0bad99	18	8e843247-5b6b-4404-ba62-a74b84ccb287	FROTA	cdbbb293-8357-4130-803a-d6581cc7a75b	\N	72539802-0df7-4c46-ae22-7c57479bd748	977	978	\N	2026-07-26 22:09:03.226	\N	2026-07-26 22:09:42.056	\N	CONCLUIDA	2026-07-26 22:09:03.24	0117ccd5-cafc-4f3b-89b1-d681f600588c	E03422	RAYDE APARECIDA V B CASTRO	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-07-26 22:09:42.057	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	\N
df996e2e-93bd-4eef-be6b-2a437dfbab89	12	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	86	90	\N	2026-07-25 23:30:32.686	\N	2026-07-25 23:53:31.185	\N	CONCLUIDA	2026-07-25 23:30:29.744	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4e5bccc2-f0b1-40b7-a68c-4c07c72db717	42	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	1c3550d2-179f-4236-b475-60aba9e68523	\N	\N	\N	\N	\N	2026-08-01 14:53:44.087	\N	2026-08-01 15:10:04.118	\N	CONCLUIDA	2026-08-01 14:53:44.088	bc6dd499-2d1c-4102-a33c-a1d75c06a596	005274	Kelver Eduardo dos Santos Florenço	f	202608	\N	CONCLUIDO	b5a67784-469d-4705-83f9-b0ff185e5a2e	187b1458-8eec-4c07-8e38-60c017441287	2026-08-01 14:55:09.231	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
a8c7f119-1445-4d03-b0cb-0b936bca2264	13	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	902	905	\N	2026-07-25 23:55:20.48	\N	2026-07-25 23:57:02.233	\N	CONCLUIDA	2026-07-25 23:55:15.734	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
b93276fa-79f6-4b4f-b48e-06a3eaefaee2	29	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	1080	1085	\N	2026-08-11 19:44:49.49	\N	2026-08-11 20:15:13.513	\N	CONCLUIDA	2026-08-11 19:44:45.746	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
404fb17a-0792-454d-9829-12f4a0271ef2	14	8e843247-5b6b-4404-ba62-a74b84ccb287	FROTA	cdbbb293-8357-4130-803a-d6581cc7a75b	\N	\N	905	910	\N	2026-07-26 15:00:00	\N	2026-07-26 21:06:02.068	\N	CONCLUIDA	2026-07-26 20:39:05.302	0117ccd5-cafc-4f3b-89b1-d681f600588c	E01047	CLENIO MARCOS MENDES	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
8c71b455-3ddc-4045-9c5b-5010bb824bd0	15	8e843247-5b6b-4404-ba62-a74b84ccb287	FROTA	cdbbb293-8357-4130-803a-d6581cc7a75b	\N	\N	910	975	\N	2026-07-26 15:39:19.968	\N	2026-07-26 21:39:20.669	\N	CONCLUIDA	2026-07-26 21:39:20.64	0117ccd5-cafc-4f3b-89b1-d681f600588c	E01047	CLENIO MARCOS MENDES	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-07-26 21:39:20.67	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	\N
f2200cb2-a145-45e0-89a8-aa184d68eea0	16	8e843247-5b6b-4404-ba62-a74b84ccb287	FROTA	cdbbb293-8357-4130-803a-d6581cc7a75b	\N	\N	975	976	\N	2026-07-26 21:43:46.931	\N	2026-07-26 21:44:09.516	\N	CONCLUIDA	2026-07-26 21:43:46.943	0117ccd5-cafc-4f3b-89b1-d681f600588c	E03422	RAYDE APARECIDA V B CASTRO	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-07-26 21:44:09.517	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	\N	\N
f4416387-9342-4528-95b1-180c9e720fdf	30	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	1085	1086	\N	2026-08-14 23:42:19.847	\N	2026-08-14 23:50:16.4	\N	CONCLUIDA	2026-08-14 23:42:16.757	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
491259e3-c895-4f65-a00c-7c19ad2ba16c	22	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	994	994	\N	2026-08-10 18:47:14.108	\N	2026-08-10 18:53:16.65	\N	CONCLUIDA	2026-08-10 18:47:10.708	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
b0664578-f36d-433e-bb66-86c084a545ed	22	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	FROTA	9a0ab60e-0fe7-4f62-8f99-a486030e67ce	\N	\N	45280	45290	\N	2026-07-12 01:06:41.955	E2E	\N	\N	EM_CURSO	2026-07-12 01:06:41.956	89384c99-9623-4e59-99ee-28c39e6f3d56	SUPVEN01	SUPERVISOR VENDAS 01 (LOGIN)	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
a9edeef7-49ee-4e99-b185-46062d8ce225	35	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	FROTA	7eaf3340-73d6-4ce7-9c2e-8c6c53f2a622	\N	\N	60456	\N	\N	2026-08-09 19:56:38.466	TESTE fix listagem	2026-08-09 19:57:20.38	❌ CANCELADA por Administrador: Teste da correcao de listagem — removido	CANCELADA	2026-08-09 19:56:38.484	a33b01ad-75c5-470a-ad1c-cfeb1a557067	E01047	Clenio M. Mendes (TESTE INDIVIDUAL)	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	a24ac837-7ea6-41f7-a7bd-4b41cf33678d
5354dd2f-fea3-497d-97ac-e952c04c2d64	32	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	1087	1088	\N	2026-08-15 00:47:47.431	\N	2026-08-15 00:51:52.004	\N	CONCLUIDA	2026-08-15 00:47:44.135	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
e33e9b34-4600-4bf1-879d-4de12bb23e7c	38	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	FROTA	\N	\N	a24ac837-7ea6-41f7-a7bd-4b41cf33678d	\N	\N	\N	2026-08-09 23:06:05.479	Roteiro 7 - travessia	2026-08-09 23:41:04.978	❌ CANCELADA por Administrador: Desfazer roteiro 7 - viagem de teste	CANCELADA	2026-08-09 23:06:05.485	a33b01ad-75c5-470a-ad1c-cfeb1a557067	E01047	Clenio M. Mendes (TESTE INDIVIDUAL)	f	\N	50.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	a24ac837-7ea6-41f7-a7bd-4b41cf33678d
9de302c8-0363-4453-8687-09383cf86a0c	41	a21ba0dc-0bdf-4ab0-a8ae-537ee98dd386	ENTREGA	9f6db697-80f6-454f-b5d3-40371d17f7c7	a33b01ad-75c5-470a-ad1c-cfeb1a557067	\N	\N	5020	\N	2026-08-10 00:47:30.614	\N	2026-08-10 00:49:31.191	Desfazer roteiro 8	CONCLUIDA	2026-08-10 00:46:40.821	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-08-10 00:49:31.191	3bb16284-0c24-40e0-adb3-d12b4bbe7a14	\N	\N	\N	\N	\N	\N
126a83c9-8f08-44d4-9419-cad69bfc2193	20	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	990	991	\N	2026-08-06 13:09:46.649	\N	2026-08-10 18:18:18.251	\N	CONCLUIDA	2026-08-06 13:09:22.906	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9cac5c5e-d263-4318-b7f8-a85a4085ca3b	34	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	1091	1092	\N	2026-08-15 01:15:58.362	\N	2026-08-15 01:18:10.316	\N	CONCLUIDA	2026-08-15 01:15:54.271	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
ce305fc4-cf35-417f-8ee5-8d77b57c89b5	41	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	1094	1094	\N	2026-08-15 02:50:52.015	\N	2026-08-15 03:20:34.409	\N	CONCLUIDA	2026-08-15 02:50:48.01	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
ddcc3bd4-b152-4a41-9847-b7aee2275b8b	42	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	1094	1096	\N	2026-08-15 03:21:13.148	\N	2026-08-15 03:28:36.183	\N	CONCLUIDA	2026-08-15 03:21:10.567	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
06eca6cc-75f9-485e-bc4c-4273d06670b1	43	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	1096	1096	\N	2026-08-15 03:32:41.179	\N	2026-08-15 12:38:12.426	\N	CONCLUIDA	2026-08-15 03:32:38.528	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
19d33ee1-80af-4513-94a0-53a9233e2aeb	44	8e843247-5b6b-4404-ba62-a74b84ccb287	ENTREGA	cdbbb293-8357-4130-803a-d6581cc7a75b	cb8c650f-4e49-45b6-b422-338e1c071685	\N	1096	\N	\N	2026-08-15 12:38:43.082	\N	\N	\N	EM_CURSO	2026-08-15 12:38:33.703	0117ccd5-cafc-4f3b-89b1-d681f600588c	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
7a2c3f51-1ea1-439f-8143-e7359e2a9249	54	d764d838-e177-421f-a79d-cb71abdbda83	FROTA	e4a24d8d-aba3-4645-908e-9b9b26034a76	\N	ffaabe83-c038-4db4-8944-6b19926e8e94	450	\N	\N	2026-08-21 18:46:04.823	\N	\N	\N	EM_CURSO	2026-08-21 18:46:04.849	187b1458-8eec-4c07-8e38-60c017441287	003448	Fabricio Silva Neiva	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	ffaabe83-c038-4db4-8944-6b19926e8e94
887160d4-2b5a-460f-ae93-4b153096cfd4	53	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	1c3550d2-179f-4236-b475-60aba9e68523	\N	\N	\N	\N	\N	2026-08-21 18:32:56.549	\N	\N	\N	EM_CURSO	2026-08-21 18:32:56.551	bc6dd499-2d1c-4102-a33c-a1d75c06a596	005274	Kelver Eduardo dos Santos Florenço	f	202608	\N	APROVADO	b5a67784-469d-4705-83f9-b0ff185e5a2e	187b1458-8eec-4c07-8e38-60c017441287	2026-08-21 20:05:09.437	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
ee60ffe1-f494-4c00-86ca-c8b5026a33c6	57	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	1c3550d2-179f-4236-b475-60aba9e68523	\N	\N	\N	\N	\N	2026-08-21 20:54:29.516	\N	\N	\N	EM_CURSO	2026-08-21 20:54:29.517	bc6dd499-2d1c-4102-a33c-a1d75c06a596	005274	Kelver Eduardo dos Santos Florenço	f	202608	\N	APROVADO	b5a67784-469d-4705-83f9-b0ff185e5a2e	187b1458-8eec-4c07-8e38-60c017441287	2026-08-21 21:07:24.545	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
69f19d5f-2818-4d94-b3c2-0de0c377fc12	59	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	1c3550d2-179f-4236-b475-60aba9e68523	\N	\N	\N	\N	\N	2026-08-21 23:03:44.632	\N	2026-08-23 01:49:32.41	\N	CONCLUIDA	2026-08-21 23:03:44.632	bc6dd499-2d1c-4102-a33c-a1d75c06a596	005274	Kelver Eduardo dos Santos Florenço	f	202608	\N	CONCLUIDO	b5a67784-469d-4705-83f9-b0ff185e5a2e	187b1458-8eec-4c07-8e38-60c017441287	2026-08-23 01:49:03.807	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
e6cfd30a-9f27-4bd4-bbd5-05f069a9afed	55	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	1c3550d2-179f-4236-b475-60aba9e68523	\N	\N	\N	\N	\N	2026-08-21 20:15:05.595	\N	\N	\N	CANCELADA	2026-08-21 20:15:05.596	bc6dd499-2d1c-4102-a33c-a1d75c06a596	005274	Kelver Eduardo dos Santos Florenço	f	202608	\N	CANCELADO	b5a67784-469d-4705-83f9-b0ff185e5a2e	187b1458-8eec-4c07-8e38-60c017441287	2026-08-21 20:18:40.789	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-08-21 20:19:17.866	187b1458-8eec-4c07-8e38-60c017441287	planejamento de TESTE da revisao tecnica 21/08 — desconsiderar	\N
5c94c8d2-e48b-4d34-99a1-73dd0a1899f0	60	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	1c3550d2-179f-4236-b475-60aba9e68523	\N	\N	\N	\N	\N	2026-08-21 23:40:00.091	\N	\N	\N	CANCELADA	2026-08-21 23:40:00.091	bc6dd499-2d1c-4102-a33c-a1d75c06a596	005274	Kelver Eduardo dos Santos Florenço	f	202608	\N	CANCELADO	b5a67784-469d-4705-83f9-b0ff185e5a2e	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-08-22 00:04:32.694	187b1458-8eec-4c07-8e38-60c017441287	orfao do teste do roteiro 21/08 (falha F2, ja corrigida) — desconsiderar	\N
fdfe6d25-f34c-4a90-8324-364e0433f896	58	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	1c3550d2-179f-4236-b475-60aba9e68523	\N	\N	\N	\N	\N	2026-08-21 23:02:27.646	\N	2026-08-23 02:18:07.689	\N	CONCLUIDA	2026-08-21 23:02:27.647	bc6dd499-2d1c-4102-a33c-a1d75c06a596	005274	Kelver Eduardo dos Santos Florenço	f	202608	\N	CONCLUIDO	b5a67784-469d-4705-83f9-b0ff185e5a2e	187b1458-8eec-4c07-8e38-60c017441287	2026-08-21 23:34:32.256	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
2af0727d-9df8-4988-9f91-e765a7135703	56	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	1c3550d2-179f-4236-b475-60aba9e68523	\N	\N	\N	\N	\N	2026-08-21 20:41:25.913	\N	2026-08-23 01:35:17.397	\N	CONCLUIDA	2026-08-21 20:41:25.914	bc6dd499-2d1c-4102-a33c-a1d75c06a596	005274	Kelver Eduardo dos Santos Florenço	f	202608	\N	CONCLUIDO	b5a67784-469d-4705-83f9-b0ff185e5a2e	187b1458-8eec-4c07-8e38-60c017441287	2026-08-21 20:42:12.292	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
fddc7f9b-de51-48a5-8e39-8d9fb03a4f76	61	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	1c3550d2-179f-4236-b475-60aba9e68523	\N	\N	\N	\N	\N	2026-08-23 01:27:17.547	\N	2026-08-23 01:37:45.043	\N	CONCLUIDA	2026-08-23 01:27:17.548	bc6dd499-2d1c-4102-a33c-a1d75c06a596	005274	Kelver Eduardo dos Santos Florenço	f	202608	\N	CONCLUIDO	b5a67784-469d-4705-83f9-b0ff185e5a2e	187b1458-8eec-4c07-8e38-60c017441287	2026-08-23 01:29:12.482	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
99f85c2d-2337-47f7-9b85-c0abbc421ae3	62	d764d838-e177-421f-a79d-cb71abdbda83	SUPERVISOR	1c3550d2-179f-4236-b475-60aba9e68523	\N	\N	\N	\N	\N	2026-08-23 02:55:49.721	\N	\N	\N	CANCELADA	2026-08-23 02:55:49.722	bc6dd499-2d1c-4102-a33c-a1d75c06a596	005274	Kelver Eduardo dos Santos Florenço	f	202607	\N	CANCELADO	b5a67784-469d-4705-83f9-b0ff185e5a2e	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-08-23 02:55:49.936	187b1458-8eec-4c07-8e38-60c017441287	planejamento de TESTE da virada de mes 23/08 — desconsiderar	\N
91eb8d70-31d7-4ca8-8edb-830714b61315	64	d764d838-e177-421f-a79d-cb71abdbda83	FROTA	\N	\N	\N	\N	999999	\N	2026-08-23 19:53:50.818	\N	2026-08-23 19:55:03.752	\N	CANCELADA	2026-08-23 19:53:50.822	187b1458-8eec-4c07-8e38-60c017441287	003448	Fabricio Silva Neiva	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-08-23 19:55:03.753	187b1458-8eec-4c07-8e38-60c017441287	\N	\N	viagem de TESTE da revisao 23/08 — desconsiderar	ffaabe83-c038-4db4-8944-6b19926e8e94
00b9be2f-ac98-434b-8080-1d39bf140995	63	d764d838-e177-421f-a79d-cb71abdbda83	FROTA	\N	\N	\N	\N	999999	\N	2026-08-23 19:53:50.794	\N	2026-08-23 19:55:03.723	\N	CANCELADA	2026-08-23 19:53:50.8	bc6dd499-2d1c-4102-a33c-a1d75c06a596	005274	Kelver Eduardo dos Santos Florenço	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5c94c8d2-e48b-4d34-99a1-73dd0a1899f0	\N	\N	\N	\N	2026-08-23 19:55:03.724	bc6dd499-2d1c-4102-a33c-a1d75c06a596	\N	\N	viagem de TESTE da revisao 23/08 — desconsiderar	ffaabe83-c038-4db4-8944-6b19926e8e94
\.


--
-- Name: adiantamento adiantamento_pkey; Type: CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.adiantamento
    ADD CONSTRAINT adiantamento_pkey PRIMARY KEY (id);


--
-- Name: anexo_despesa anexo_despesa_pkey; Type: CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.anexo_despesa
    ADD CONSTRAINT anexo_despesa_pkey PRIMARY KEY (id);


--
-- Name: atividade_visita atividade_visita_pkey; Type: CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.atividade_visita
    ADD CONSTRAINT atividade_visita_pkey PRIMARY KEY (id);


--
-- Name: cliente_local cliente_local_pkey; Type: CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.cliente_local
    ADD CONSTRAINT cliente_local_pkey PRIMARY KEY (id);


--
-- Name: contador_sequencial contador_sequencial_pkey; Type: CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.contador_sequencial
    ADD CONSTRAINT contador_sequencial_pkey PRIMARY KEY (filial_id, escopo);


--
-- Name: despesa_veiculo despesa_veiculo_pkey; Type: CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.despesa_veiculo
    ADD CONSTRAINT despesa_veiculo_pkey PRIMARY KEY (id);


--
-- Name: endereco_entrega endereco_entrega_pkey; Type: CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.endereco_entrega
    ADD CONSTRAINT endereco_entrega_pkey PRIMARY KEY (id);


--
-- Name: entrega_cupom entrega_cupom_pkey; Type: CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.entrega_cupom
    ADD CONSTRAINT entrega_cupom_pkey PRIMARY KEY (id);


--
-- Name: entrega entrega_pkey; Type: CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.entrega
    ADD CONSTRAINT entrega_pkey PRIMARY KEY (id);


--
-- Name: fechamento_rdv fechamento_rdv_pkey; Type: CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.fechamento_rdv
    ADD CONSTRAINT fechamento_rdv_pkey PRIMARY KEY (id);


--
-- Name: fornecedor_despesa fornecedor_despesa_pkey; Type: CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.fornecedor_despesa
    ADD CONSTRAINT fornecedor_despesa_pkey PRIMARY KEY (id);


--
-- Name: geocode_cache geocode_cache_pkey; Type: CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.geocode_cache
    ADD CONSTRAINT geocode_cache_pkey PRIMARY KEY (id);


--
-- Name: local_cliente local_cliente_pkey; Type: CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.local_cliente
    ADD CONSTRAINT local_cliente_pkey PRIMARY KEY (id);


--
-- Name: local_parada local_parada_pkey; Type: CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.local_parada
    ADD CONSTRAINT local_parada_pkey PRIMARY KEY (id);


--
-- Name: manutencao_veiculo manutencao_veiculo_pkey; Type: CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.manutencao_veiculo
    ADD CONSTRAINT manutencao_veiculo_pkey PRIMARY KEY (id);


--
-- Name: parada parada_pkey; Type: CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.parada
    ADD CONSTRAINT parada_pkey PRIMARY KEY (id);


--
-- Name: posicao_veiculo posicao_veiculo_pkey; Type: CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.posicao_veiculo
    ADD CONSTRAINT posicao_veiculo_pkey PRIMARY KEY (id);


--
-- Name: supervisor_departamento supervisor_departamento_pkey; Type: CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.supervisor_departamento
    ADD CONSTRAINT supervisor_departamento_pkey PRIMARY KEY (id);


--
-- Name: supervisor supervisor_pkey; Type: CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.supervisor
    ADD CONSTRAINT supervisor_pkey PRIMARY KEY (id);


--
-- Name: tipo_despesa tipo_despesa_pkey; Type: CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.tipo_despesa
    ADD CONSTRAINT tipo_despesa_pkey PRIMARY KEY (id);


--
-- Name: veiculo veiculo_pkey; Type: CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.veiculo
    ADD CONSTRAINT veiculo_pkey PRIMARY KEY (id);


--
-- Name: veiculo_supervisor_area_historico veiculo_supervisor_area_historico_pkey; Type: CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.veiculo_supervisor_area_historico
    ADD CONSTRAINT veiculo_supervisor_area_historico_pkey PRIMARY KEY (id);


--
-- Name: veiculo_supervisor_historico veiculo_supervisor_historico_pkey; Type: CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.veiculo_supervisor_historico
    ADD CONSTRAINT veiculo_supervisor_historico_pkey PRIMARY KEY (id);


--
-- Name: viagem viagem_pkey; Type: CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.viagem
    ADD CONSTRAINT viagem_pkey PRIMARY KEY (id);


--
-- Name: adiantamento_supervisor_id_mes_referencia_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX adiantamento_supervisor_id_mes_referencia_idx ON logistica.adiantamento USING btree (supervisor_id, mes_referencia);


--
-- Name: anexo_despesa_despesa_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX anexo_despesa_despesa_id_idx ON logistica.anexo_despesa USING btree (despesa_id);


--
-- Name: atividade_visita_filial_id_nome_key; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE UNIQUE INDEX atividade_visita_filial_id_nome_key ON logistica.atividade_visita USING btree (filial_id, nome);


--
-- Name: cliente_local_filial_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX cliente_local_filial_id_idx ON logistica.cliente_local USING btree (filial_id);


--
-- Name: cliente_local_nome_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX cliente_local_nome_idx ON logistica.cliente_local USING btree (nome);


--
-- Name: cliente_local_telefone_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX cliente_local_telefone_idx ON logistica.cliente_local USING btree (telefone);


--
-- Name: despesa_veiculo_doc_unico; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE UNIQUE INDEX despesa_veiculo_doc_unico ON logistica.despesa_veiculo USING btree (veiculo_id, numero_documento, tipo_despesa_id) WHERE (numero_documento IS NOT NULL);


--
-- Name: despesa_veiculo_filial_id_situacao_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX despesa_veiculo_filial_id_situacao_idx ON logistica.despesa_veiculo USING btree (filial_id, situacao);


--
-- Name: despesa_veiculo_fornecedor_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX despesa_veiculo_fornecedor_id_idx ON logistica.despesa_veiculo USING btree (fornecedor_id);


--
-- Name: despesa_veiculo_idempotency_key_key; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE UNIQUE INDEX despesa_veiculo_idempotency_key_key ON logistica.despesa_veiculo USING btree (idempotency_key);


--
-- Name: despesa_veiculo_tipo_despesa_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX despesa_veiculo_tipo_despesa_id_idx ON logistica.despesa_veiculo USING btree (tipo_despesa_id);


--
-- Name: despesa_veiculo_veiculo_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX despesa_veiculo_veiculo_id_idx ON logistica.despesa_veiculo USING btree (veiculo_id);


--
-- Name: despesa_veiculo_viagem_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX despesa_veiculo_viagem_id_idx ON logistica.despesa_veiculo USING btree (viagem_id);


--
-- Name: endereco_entrega_cliente_local_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX endereco_entrega_cliente_local_id_idx ON logistica.endereco_entrega USING btree (cliente_local_id);


--
-- Name: endereco_entrega_filial_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX endereco_entrega_filial_id_idx ON logistica.endereco_entrega USING btree (filial_id);


--
-- Name: endereco_entrega_matricula_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX endereco_entrega_matricula_idx ON logistica.endereco_entrega USING btree (matricula);


--
-- Name: entrega_criado_em_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX entrega_criado_em_idx ON logistica.entrega USING btree (criado_em);


--
-- Name: entrega_cupom_entrega_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX entrega_cupom_entrega_id_idx ON logistica.entrega_cupom USING btree (entrega_id);


--
-- Name: entrega_filial_id_data_entrega_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX entrega_filial_id_data_entrega_idx ON logistica.entrega USING btree (filial_id, data_entrega);


--
-- Name: entrega_filial_id_numero_key; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE UNIQUE INDEX entrega_filial_id_numero_key ON logistica.entrega USING btree (filial_id, numero);


--
-- Name: entrega_filial_id_status_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX entrega_filial_id_status_idx ON logistica.entrega USING btree (filial_id, status);


--
-- Name: entrega_matricula_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX entrega_matricula_idx ON logistica.entrega USING btree (matricula);


--
-- Name: fechamento_rdv_supervisor_id_mes_referencia_key; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE UNIQUE INDEX fechamento_rdv_supervisor_id_mes_referencia_key ON logistica.fechamento_rdv USING btree (supervisor_id, mes_referencia);


--
-- Name: fornecedor_despesa_nome_key; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE UNIQUE INDEX fornecedor_despesa_nome_key ON logistica.fornecedor_despesa USING btree (nome);


--
-- Name: geocode_cache_chave_key; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE UNIQUE INDEX geocode_cache_chave_key ON logistica.geocode_cache USING btree (chave);


--
-- Name: local_cliente_cliente_matricula_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX local_cliente_cliente_matricula_idx ON logistica.local_cliente USING btree (cliente_matricula);


--
-- Name: local_cliente_cliente_matricula_tipo_nome_key; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE UNIQUE INDEX local_cliente_cliente_matricula_tipo_nome_key ON logistica.local_cliente USING btree (cliente_matricula, tipo, nome);


--
-- Name: local_cliente_filial_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX local_cliente_filial_id_idx ON logistica.local_cliente USING btree (filial_id);


--
-- Name: local_parada_filial_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX local_parada_filial_id_idx ON logistica.local_parada USING btree (filial_id);


--
-- Name: local_parada_veiculo_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX local_parada_veiculo_id_idx ON logistica.local_parada USING btree (veiculo_id);


--
-- Name: manutencao_veiculo_despesa_id_key; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE UNIQUE INDEX manutencao_veiculo_despesa_id_key ON logistica.manutencao_veiculo USING btree (despesa_id);


--
-- Name: manutencao_veiculo_veiculo_id_data_manutencao_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX manutencao_veiculo_veiculo_id_data_manutencao_idx ON logistica.manutencao_veiculo USING btree (veiculo_id, data_manutencao);


--
-- Name: parada_atividade_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX parada_atividade_id_idx ON logistica.parada USING btree (atividade_id);


--
-- Name: parada_entrega_id_key; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE UNIQUE INDEX parada_entrega_id_key ON logistica.parada USING btree (entrega_id);


--
-- Name: parada_idempotency_key_key; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE UNIQUE INDEX parada_idempotency_key_key ON logistica.parada USING btree (idempotency_key);


--
-- Name: parada_local_cliente_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX parada_local_cliente_id_idx ON logistica.parada USING btree (local_cliente_id);


--
-- Name: parada_viagem_id_sequencia_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX parada_viagem_id_sequencia_idx ON logistica.parada USING btree (viagem_id, sequencia);


--
-- Name: posicao_veiculo_viagem_id_capturado_em_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX posicao_veiculo_viagem_id_capturado_em_idx ON logistica.posicao_veiculo USING btree (viagem_id, capturado_em);


--
-- Name: supervisor_coordenador_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX supervisor_coordenador_id_idx ON logistica.supervisor USING btree (coordenador_id);


--
-- Name: supervisor_departamento_filial_id_departamento_id_key; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE UNIQUE INDEX supervisor_departamento_filial_id_departamento_id_key ON logistica.supervisor_departamento USING btree (filial_id, departamento_id);


--
-- Name: supervisor_departamento_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX supervisor_departamento_id_idx ON logistica.supervisor USING btree (departamento_id);


--
-- Name: supervisor_departamento_usuario_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX supervisor_departamento_usuario_id_idx ON logistica.supervisor_departamento USING btree (usuario_id);


--
-- Name: supervisor_filial_id_matricula_key; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE UNIQUE INDEX supervisor_filial_id_matricula_key ON logistica.supervisor USING btree (filial_id, matricula);


--
-- Name: tipo_despesa_nome_key; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE UNIQUE INDEX tipo_despesa_nome_key ON logistica.tipo_despesa USING btree (nome);


--
-- Name: veiculo_departamento_lotacao_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX veiculo_departamento_lotacao_id_idx ON logistica.veiculo USING btree (departamento_lotacao_id);


--
-- Name: veiculo_filial_id_placa_key; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE UNIQUE INDEX veiculo_filial_id_placa_key ON logistica.veiculo USING btree (filial_id, placa);


--
-- Name: veiculo_filial_id_situacao_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX veiculo_filial_id_situacao_idx ON logistica.veiculo USING btree (filial_id, situacao);


--
-- Name: veiculo_supervisor_area_historico_veiculo_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX veiculo_supervisor_area_historico_veiculo_id_idx ON logistica.veiculo_supervisor_area_historico USING btree (veiculo_id);


--
-- Name: veiculo_supervisor_area_matricula_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX veiculo_supervisor_area_matricula_idx ON logistica.veiculo USING btree (supervisor_area_matricula);


--
-- Name: veiculo_supervisor_historico_veiculo_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX veiculo_supervisor_historico_veiculo_id_idx ON logistica.veiculo_supervisor_historico USING btree (veiculo_id);


--
-- Name: veiculo_supervisor_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX veiculo_supervisor_id_idx ON logistica.veiculo USING btree (supervisor_id);


--
-- Name: viagem_departamento_aprovador_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX viagem_departamento_aprovador_id_idx ON logistica.viagem USING btree (departamento_aprovador_id);


--
-- Name: viagem_filial_id_numero_key; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE UNIQUE INDEX viagem_filial_id_numero_key ON logistica.viagem USING btree (filial_id, numero);


--
-- Name: viagem_filial_id_situacao_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX viagem_filial_id_situacao_idx ON logistica.viagem USING btree (filial_id, situacao);


--
-- Name: viagem_motorista_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX viagem_motorista_id_idx ON logistica.viagem USING btree (motorista_id);


--
-- Name: viagem_rdv_viagem_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX viagem_rdv_viagem_id_idx ON logistica.viagem USING btree (rdv_viagem_id);


--
-- Name: viagem_supervisor_registro_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX viagem_supervisor_registro_id_idx ON logistica.viagem USING btree (supervisor_registro_id);


--
-- Name: viagem_tipo_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX viagem_tipo_idx ON logistica.viagem USING btree (tipo);


--
-- Name: viagem_veiculo_id_idx; Type: INDEX; Schema: logistica; Owner: capul_user
--

CREATE INDEX viagem_veiculo_id_idx ON logistica.viagem USING btree (veiculo_id);


--
-- Name: adiantamento adiantamento_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.adiantamento
    ADD CONSTRAINT adiantamento_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES logistica.supervisor(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: anexo_despesa anexo_despesa_despesa_id_fkey; Type: FK CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.anexo_despesa
    ADD CONSTRAINT anexo_despesa_despesa_id_fkey FOREIGN KEY (despesa_id) REFERENCES logistica.despesa_veiculo(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: despesa_veiculo despesa_veiculo_fornecedor_id_fkey; Type: FK CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.despesa_veiculo
    ADD CONSTRAINT despesa_veiculo_fornecedor_id_fkey FOREIGN KEY (fornecedor_id) REFERENCES logistica.fornecedor_despesa(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: despesa_veiculo despesa_veiculo_tipo_despesa_id_fkey; Type: FK CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.despesa_veiculo
    ADD CONSTRAINT despesa_veiculo_tipo_despesa_id_fkey FOREIGN KEY (tipo_despesa_id) REFERENCES logistica.tipo_despesa(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: despesa_veiculo despesa_veiculo_veiculo_id_fkey; Type: FK CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.despesa_veiculo
    ADD CONSTRAINT despesa_veiculo_veiculo_id_fkey FOREIGN KEY (veiculo_id) REFERENCES logistica.veiculo(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: despesa_veiculo despesa_veiculo_viagem_id_fkey; Type: FK CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.despesa_veiculo
    ADD CONSTRAINT despesa_veiculo_viagem_id_fkey FOREIGN KEY (viagem_id) REFERENCES logistica.viagem(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: endereco_entrega endereco_entrega_cliente_local_id_fkey; Type: FK CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.endereco_entrega
    ADD CONSTRAINT endereco_entrega_cliente_local_id_fkey FOREIGN KEY (cliente_local_id) REFERENCES logistica.cliente_local(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: entrega entrega_cliente_local_id_fkey; Type: FK CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.entrega
    ADD CONSTRAINT entrega_cliente_local_id_fkey FOREIGN KEY (cliente_local_id) REFERENCES logistica.cliente_local(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: entrega_cupom entrega_cupom_entrega_id_fkey; Type: FK CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.entrega_cupom
    ADD CONSTRAINT entrega_cupom_entrega_id_fkey FOREIGN KEY (entrega_id) REFERENCES logistica.entrega(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: entrega entrega_endereco_entrega_id_fkey; Type: FK CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.entrega
    ADD CONSTRAINT entrega_endereco_entrega_id_fkey FOREIGN KEY (endereco_entrega_id) REFERENCES logistica.endereco_entrega(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: fechamento_rdv fechamento_rdv_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.fechamento_rdv
    ADD CONSTRAINT fechamento_rdv_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES logistica.supervisor(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: manutencao_veiculo manutencao_veiculo_despesa_id_fkey; Type: FK CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.manutencao_veiculo
    ADD CONSTRAINT manutencao_veiculo_despesa_id_fkey FOREIGN KEY (despesa_id) REFERENCES logistica.despesa_veiculo(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: manutencao_veiculo manutencao_veiculo_veiculo_id_fkey; Type: FK CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.manutencao_veiculo
    ADD CONSTRAINT manutencao_veiculo_veiculo_id_fkey FOREIGN KEY (veiculo_id) REFERENCES logistica.veiculo(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: parada parada_atividade_id_fkey; Type: FK CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.parada
    ADD CONSTRAINT parada_atividade_id_fkey FOREIGN KEY (atividade_id) REFERENCES logistica.atividade_visita(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: parada parada_entrega_id_fkey; Type: FK CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.parada
    ADD CONSTRAINT parada_entrega_id_fkey FOREIGN KEY (entrega_id) REFERENCES logistica.entrega(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: parada parada_local_cliente_id_fkey; Type: FK CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.parada
    ADD CONSTRAINT parada_local_cliente_id_fkey FOREIGN KEY (local_cliente_id) REFERENCES logistica.local_cliente(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: parada parada_viagem_id_fkey; Type: FK CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.parada
    ADD CONSTRAINT parada_viagem_id_fkey FOREIGN KEY (viagem_id) REFERENCES logistica.viagem(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: posicao_veiculo posicao_veiculo_viagem_id_fkey; Type: FK CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.posicao_veiculo
    ADD CONSTRAINT posicao_veiculo_viagem_id_fkey FOREIGN KEY (viagem_id) REFERENCES logistica.viagem(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: veiculo_supervisor_area_historico veiculo_supervisor_area_historico_veiculo_id_fkey; Type: FK CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.veiculo_supervisor_area_historico
    ADD CONSTRAINT veiculo_supervisor_area_historico_veiculo_id_fkey FOREIGN KEY (veiculo_id) REFERENCES logistica.veiculo(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: veiculo_supervisor_historico veiculo_supervisor_historico_veiculo_id_fkey; Type: FK CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.veiculo_supervisor_historico
    ADD CONSTRAINT veiculo_supervisor_historico_veiculo_id_fkey FOREIGN KEY (veiculo_id) REFERENCES logistica.veiculo(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: viagem viagem_rdv_viagem_id_fkey; Type: FK CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.viagem
    ADD CONSTRAINT viagem_rdv_viagem_id_fkey FOREIGN KEY (rdv_viagem_id) REFERENCES logistica.viagem(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: viagem viagem_supervisor_registro_id_fkey; Type: FK CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.viagem
    ADD CONSTRAINT viagem_supervisor_registro_id_fkey FOREIGN KEY (supervisor_registro_id) REFERENCES logistica.supervisor(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: viagem viagem_veiculo_id_fkey; Type: FK CONSTRAINT; Schema: logistica; Owner: capul_user
--

ALTER TABLE ONLY logistica.viagem
    ADD CONSTRAINT viagem_veiculo_id_fkey FOREIGN KEY (veiculo_id) REFERENCES logistica.veiculo(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict CZlVKYA6pP8yjzso8ZRiEKVgKncwPFioZpOt8iEc15Ibg10iK3x9yIsdKCNr4BN

