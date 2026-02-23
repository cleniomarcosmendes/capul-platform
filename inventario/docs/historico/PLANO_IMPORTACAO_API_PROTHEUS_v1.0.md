# 📥 PLANO DE IMPORTAÇÃO DE DADOS VIA API - Protheus v1.0

**Data**: 20/10/2025
**Versão**: v1.0
**Status**: 📋 **PLANEJAMENTO**

---

## 📋 SUMÁRIO EXECUTIVO

### Objetivo
Implementar sistema de **importação automatizada** de dados do ERP Protheus via **API de terceiro**, mantendo sincronização entre sistemas.

### Escopo
Importação de **10 tabelas base** do Protheus para PostgreSQL com validação, transformação e auditoria completas.

### Benefícios
- ✅ **Sincronização automática** entre Protheus e sistema de inventário
- ✅ **Dados sempre atualizados** sem intervenção manual
- ✅ **Rastreabilidade total** com logs de importação
- ✅ **Validação de integridade** antes de persistir dados
- ✅ **Performance otimizada** com importação em lote

---

## 📊 TABELAS DO PROTHEUS

### Tabelas Identificadas (10)

| Tabela | Descrição | Campos | Prioridade | Complexidade |
|--------|-----------|--------|------------|--------------|
| **SB1010** | Cadastro de Produtos | 15 | 🔴 ALTA | Média |
| **SBZ010** | Indicador de Produtos | 9 | 🔴 ALTA | Baixa |
| **SB2010** | Saldo em Estoque por Armazém | 10 | 🔴 ALTA | Média |
| **SB8010** | Saldo por Armazém e Lote | 10 | 🔴 ALTA | Alta |
| **SLK010** | Código de Barras | 9 | 🟠 MÉDIA | Baixa |
| **DA1010** | Tabela de Preço | 10 | 🟠 MÉDIA | Média |
| **SBM010** | Grupos de Produtos | 6 | 🟡 BAIXA | Baixa |
| **SZD010** | Categorias (xcatgor) | 6 | 🟡 BAIXA | Baixa |
| **SZE010** | Subcategorias (xsubcat) | 6 | 🟡 BAIXA | Baixa |
| **SZF010** | Segmentos (xsegmen) | 6 | 🟡 BAIXA | Baixa |

### Relacionamentos entre Tabelas

```
SBM010 (Grupos)
    ↓ b1_grupo
SB1010 (Produtos) ←→ SBZ010 (Indicadores)
    ↓ b1_cod            ↓ bz_cod
    ├→ SB2010 (Saldos por Armazém)
    │   ↓ b2_cod, b2_local
    │   └→ SB8010 (Saldos por Lote)
    │       ↓ b8_produto, b8_local, b8_lotectl
    ├→ SLK010 (Código de Barras)
    │   ↓ slk_produto
    └→ DA1010 (Tabela de Preço)
        ↓ da1_codpro

SZD010 (Categorias) ← b1_xcatgor
SZE010 (Subcategorias) ← b1_xsubcat
SZF010 (Segmentos) ← b1_xsegmen
```

---

## 🗂️ ESTRUTURAS JSON PROPOSTAS

### 1. SB1010 - Cadastro de Produtos

**Descrição**: Tabela principal de produtos (similar a SB1 do Protheus)

**JSON Model**:
```json
{
  "b1_filial": "01",
  "b1_cod": "00010001",
  "b1_codbar": "7891234567890",
  "b1_desc": "PRODUTO EXEMPLO 1KG",
  "b1_tipo": "PA",
  "b1_um": "UN",
  "b1_locpad": "01",
  "b1_grupo": "0001",
  "b1_xcatgor": "CAT001",
  "b1_xsubcat": "SUB001",
  "b1_xsegmen": "SEG001",
  "b1_xgrinve": "GRINV01",
  "b1_rastro": "L"
}
```

**Campos**:
- `b1_filial` (VARCHAR 10) - Código da filial/loja
- `b1_cod` (VARCHAR 50) - **PK** Código do produto (único)
- `b1_codbar` (VARCHAR 50) - Código de barras principal
- `b1_desc` (VARCHAR 100) - Descrição do produto
- `b1_tipo` (VARCHAR 2) - Tipo (PA=Produto Acabado, MP=Matéria Prima, etc)
- `b1_um` (VARCHAR 2) - Unidade de medida (UN, KG, LT, etc)
- `b1_locpad` (VARCHAR 10) - Armazém padrão
- `b1_grupo` (VARCHAR 10) - FK → SBM010.bm_grupo (grupo do produto)
- `b1_xcatgor` (VARCHAR 10) - FK → SZD010.zd_xcod (categoria customizada)
- `b1_xsubcat` (VARCHAR 10) - FK → SZE010.ze_xcod (subcategoria customizada)
- `b1_xsegmen` (VARCHAR 10) - FK → SZF010.zf_xcod (segmento customizado)
- `b1_xgrinve` (VARCHAR 10) - Grupo de inventário (customizado)
- `b1_rastro` (VARCHAR 1) - Controle de rastreabilidade (L=Lote, S=Série, N=Não)

**Validações**:
- ✅ `b1_cod` obrigatório e único por filial
- ✅ `b1_desc` obrigatório
- ✅ `b1_rastro` deve ser 'L', 'S' ou 'N' (default 'N')
- ✅ Se `b1_rastro='L'` → deve ter registros em SB8010

---

### 2. SBZ010 - Indicador de Produtos

**Descrição**: Complemento de dados do produto (locais de estoque customizados)

**JSON Model**:
```json
{
  "bz_filial": "01",
  "bz_cod": "00010001",
  "bz_local": "01",
  "bz_xlocal1": "CORREDOR 1",
  "bz_xlocal2": "PRATELEIRA A",
  "bz_xlocal3": "POSICAO 5",
  "is_active": true
}
```

**Campos**:
- `bz_filial` (VARCHAR 10) - Código da filial
- `bz_cod` (VARCHAR 50) - **PK** Código do produto (FK → SB1010.b1_cod)
- `bz_local` (VARCHAR 10) - **PK** Código do armazém
- `bz_xlocal1` (VARCHAR 50) - Localização nível 1 (corredor)
- `bz_xlocal2` (VARCHAR 50) - Localização nível 2 (prateleira)
- `bz_xlocal3` (VARCHAR 50) - Localização nível 3 (posição)
- `is_active` (BOOLEAN) - Registro ativo

**Relacionamento**: 1:N com SB1010 (um produto pode ter múltiplas localizações)

---

### 3. SB2010 - Saldo em Estoque por Armazém

**Descrição**: Saldos de estoque agregados por armazém (sem lote)

**JSON Model**:
```json
{
  "b2_filial": "01",
  "b2_cod": "00010001",
  "b2_local": "01",
  "b2_qatu": 150.0000,
  "b2_vatu1": 4500.00,
  "b2_cm1": 30.0000,
  "b2_qemp": 10.0000,
  "b2_reserva": 5.0000
}
```

**Campos**:
- `b2_filial` (VARCHAR 10) - Código da filial
- `b2_cod` (VARCHAR 50) - **PK** Código do produto
- `b2_local` (VARCHAR 10) - **PK** Código do armazém
- `b2_qatu` (NUMERIC 15,4) - Quantidade atual em estoque
- `b2_vatu1` (NUMERIC 15,2) - Valor total do estoque (custo médio × qty)
- `b2_cm1` (NUMERIC 15,4) - Custo médio unitário
- `b2_qemp` (NUMERIC 15,4) - Quantidade empenhada (reservada para pedidos)
- `b2_reserva` (NUMERIC 15,4) - Quantidade em reserva

**Regras de Negócio**:
- ✅ Estoque disponível = `b2_qatu - b2_qemp - b2_reserva`
- ✅ Se produto tem `b1_rastro='L'` → saldo REAL = SUM(SB8010.b8_saldo)
- ⚠️ **IMPORTANTE**: Para produtos com lote, SB2010.b2_qatu pode estar incorreto (usar SB8010)

---

### 4. SB8010 - Saldo em Estoque por Armazém e Lote

**Descrição**: Saldos detalhados por lote/validade (produtos rastreáveis)

**JSON Model**:
```json
{
  "b8_filial": "01",
  "b8_produto": "00010001",
  "b8_local": "01",
  "b8_lotectl": "LOTE2024001",
  "b8_saldo": 50.0000,
  "b8_dtvalid": "2025-12-31",
  "b8_numlote": "001"
}
```

**Campos**:
- `id` (UUID) - **PK** Identificador único (auto-gerado)
- `b8_filial` (VARCHAR 10) - Código da filial
- `b8_produto` (VARCHAR 50) - Código do produto (FK → SB1010.b1_cod)
- `b8_local` (VARCHAR 10) - Código do armazém
- `b8_lotectl` (VARCHAR 50) - Número do lote (identificação)
- `b8_saldo` (NUMERIC 15,4) - Saldo do lote específico
- `b8_dtvalid` (DATE) - Data de validade do lote
- `b8_numlote` (VARCHAR 20) - Número sequencial do lote

**Regras**:
- ✅ Apenas produtos com `b1_rastro='L'` devem ter registros
- ✅ Saldo total por produto = SUM(b8_saldo) GROUP BY b8_produto, b8_local
- ✅ Lotes vencidos: `b8_dtvalid < CURRENT_DATE`

---

### 5. SLK010 - Código de Barras

**Descrição**: Códigos de barras adicionais por produto (um produto pode ter múltiplos)

**JSON Model**:
```json
{
  "slk_filial": "01",
  "slk_codbar": "7891234567891",
  "slk_produto": "00010001"
}
```

**Campos**:
- `id` (UUID) - **PK** Auto-gerado
- `slk_filial` (VARCHAR 10) - Código da filial
- `slk_codbar` (VARCHAR 50) - Código de barras adicional (único)
- `slk_produto` (VARCHAR 50) - FK → SB1010.b1_cod
- `product_id` (UUID) - FK → products.id (relacionamento interno)
- `store_id` (UUID) - FK → stores.id (relacionamento interno)

**Relacionamento**: N:1 com SB1010 (múltiplos códigos de barras para um produto)

---

### 6. DA1010 - Tabela de Preço

**Descrição**: Preços de venda por produto/tabela/vigência

**JSON Model**:
```json
{
  "da1_filial": "01",
  "da1_codtab": "001",
  "da1_codpro": "00010001",
  "da1_item": "0001",
  "da1_prcven": 45.90,
  "da1_moeda": 1,
  "da1_tpoper": "1",
  "da1_datvig": "2025-01-01"
}
```

**Campos**:
- `da1_filial` (VARCHAR 10) - Código da filial
- `da1_codtab` (VARCHAR 10) - **PK** Código da tabela de preço
- `da1_codpro` (VARCHAR 50) - **PK** FK → SB1010.b1_cod
- `da1_item` (VARCHAR 10) - **PK** Item sequencial
- `da1_prcven` (NUMERIC 15,2) - Preço de venda
- `da1_moeda` (INTEGER) - Tipo de moeda (1=Real)
- `da1_tpoper` (VARCHAR 2) - Tipo de operação
- `da1_datvig` (DATE) - Data de vigência do preço

**Regras**:
- ✅ Preço vigente = maior `da1_datvig <= CURRENT_DATE`
- ✅ Múltiplas tabelas de preço (atacado, varejo, promocional, etc)

---

### 7. SBM010 - Grupos de Produtos

**Descrição**: Cadastro de grupos de produtos (usado em SB1010.b1_grupo)

**JSON Model**:
```json
{
  "bm_filial": "01",
  "bm_grupo": "0001",
  "bm_desc": "ALIMENTOS",
  "is_active": true
}
```

**Campos**:
- `bm_filial` (VARCHAR 10) - Código da filial
- `bm_grupo` (VARCHAR 10) - **PK** Código do grupo
- `bm_desc` (VARCHAR 100) - Descrição do grupo
- `is_active` (BOOLEAN) - Grupo ativo

**Relacionamento**: 1:N com SB1010 (um grupo tem vários produtos)

---

### 8. SZD010 - Categorias (Customizado)

**Descrição**: Categorias customizadas de produtos (campo b1_xcatgor)

**JSON Model**:
```json
{
  "zd_filial": "01",
  "zd_xcod": "CAT001",
  "zd_xdesc": "CATEGORIA EXEMPLO",
  "is_active": true
}
```

**Campos**:
- `zd_filial` (VARCHAR 10) - Código da filial
- `zd_xcod` (VARCHAR 10) - **PK** Código da categoria
- `zd_xdesc` (VARCHAR 100) - Descrição da categoria
- `is_active` (BOOLEAN) - Categoria ativa

---

### 9. SZE010 - Subcategorias (Customizado)

**Descrição**: Subcategorias customizadas (campo b1_xsubcat)

**JSON Model**:
```json
{
  "ze_filial": "01",
  "ze_xcod": "SUB001",
  "ze_xdesc": "SUBCATEGORIA EXEMPLO",
  "is_active": true
}
```

**Campos**:
- `ze_filial` (VARCHAR 10) - Código da filial
- `ze_xcod` (VARCHAR 10) - **PK** Código da subcategoria
- `ze_xdesc` (VARCHAR 100) - Descrição
- `is_active` (BOOLEAN) - Ativo

---

### 10. SZF010 - Segmentos (Customizado)

**Descrição**: Segmentos customizados de produtos (campo b1_xsegmen)

**JSON Model**:
```json
{
  "zf_filial": "01",
  "zf_xcod": "SEG001",
  "zf_xdesc": "SEGMENTO EXEMPLO",
  "is_active": true
}
```

**Campos**:
- `zf_filial` (VARCHAR 10) - Código da filial
- `zf_xcod` (VARCHAR 10) - **PK** Código do segmento
- `zf_xdesc` (VARCHAR 100) - Descrição
- `is_active` (BOOLEAN) - Ativo

---

## 🏗️ ARQUITETURA DA API DE IMPORTAÇÃO

### Modelo Geral

```
┌─────────────────────────────────────────────────────────┐
│         API TERCEIRA (Protheus Webservice)              │
│  Expõe endpoints REST para consulta de dados            │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP/JSON
                      ↓
┌─────────────────────────────────────────────────────────┐
│      CAMADA DE IMPORTAÇÃO (Backend FastAPI)             │
│  ┌─────────────────────────────────────────────┐        │
│  │  1. Validação de JSON                       │        │
│  │  2. Transformação de Dados                  │        │
│  │  3. Validação de Integridade Referencial    │        │
│  │  4. Upsert (Insert ou Update)               │        │
│  │  5. Log de Importação                       │        │
│  └─────────────────────────────────────────────┘        │
└─────────────────────┬───────────────────────────────────┘
                      │ SQLAlchemy
                      ↓
┌─────────────────────────────────────────────────────────┐
│             PostgreSQL 15 (inventario_protheus)         │
│  Tabelas: SB1010, SB2010, SB8010, etc.                  │
└─────────────────────────────────────────────────────────┘
```

### Componentes

#### 1. API de Terceiro (Externa)
**Responsabilidade**: Fornecer dados do Protheus via REST API

**Endpoints Esperados**:
```
GET /api/protheus/sb1010?filial=01          # Cadastro de Produtos
GET /api/protheus/sb2010?filial=01          # Saldos por Armazém
GET /api/protheus/sb8010?filial=01&produto=X # Saldos por Lote
GET /api/protheus/sbz010?filial=01          # Indicadores
GET /api/protheus/slk010?filial=01          # Códigos de Barras
GET /api/protheus/da1010?filial=01          # Tabela de Preço
GET /api/protheus/sbm010?filial=01          # Grupos
GET /api/protheus/szd010?filial=01          # Categorias
GET /api/protheus/sze010?filial=01          # Subcategorias
GET /api/protheus/szf010?filial=01          # Segmentos
```

**Formato de Resposta**:
```json
{
  "success": true,
  "total": 1523,
  "page": 1,
  "per_page": 100,
  "data": [
    { ...objeto SB1010... },
    { ...objeto SB1010... }
  ],
  "metadata": {
    "last_sync": "2025-10-20T15:30:00Z",
    "version": "1.0"
  }
}
```

#### 2. Backend FastAPI (Nosso Sistema)

**Novos Endpoints de Importação**:

```python
# 1. Importação Manual (Admin trigger)
POST /api/v1/import/sb1010          # Importar produtos
POST /api/v1/import/sb2010          # Importar saldos
POST /api/v1/import/sb8010          # Importar lotes
POST /api/v1/import/sbz010          # Importar indicadores
POST /api/v1/import/slk010          # Importar códigos de barras
POST /api/v1/import/da1010          # Importar preços
POST /api/v1/import/all             # Importar TODAS as tabelas (sequencial)

# 2. Sincronização Automática (Cron Job)
POST /api/v1/sync/protheus          # Sincronizar todas as tabelas (agendado)
GET  /api/v1/sync/status            # Ver status da última sincronização

# 3. Logs e Auditoria
GET  /api/v1/import/logs            # Listar logs de importação
GET  /api/v1/import/logs/{id}       # Detalhes de uma importação
```

**Estrutura de Resposta**:
```json
{
  "success": true,
  "import_id": "uuid-123",
  "table": "sb1010",
  "started_at": "2025-10-20T15:30:00Z",
  "finished_at": "2025-10-20T15:32:15Z",
  "duration_seconds": 135,
  "stats": {
    "total_fetched": 1523,
    "inserted": 45,
    "updated": 1478,
    "errors": 0,
    "skipped": 0
  },
  "errors": []
}
```

---

## 🔄 ESTRATÉGIAS DE SINCRONIZAÇÃO

### Opção 1: Sincronização FULL (Recomendado para início)

**Como funciona**:
1. Deletar TODOS os registros da tabela PostgreSQL
2. Buscar TODOS os registros da API do Protheus
3. Inserir tudo novamente

**Prós**:
- ✅ Simples de implementar
- ✅ Garante dados 100% iguais ao Protheus
- ✅ Sem risco de registros órfãos

**Contras**:
- ❌ Lento para tabelas grandes (SB1010 com 10k+ produtos)
- ❌ Downtime durante importação
- ❌ Alto consumo de recursos

**Quando usar**:
- Sincronização diária noturna
- Primeira importação
- Após erros de sincronização

---

### Opção 2: Sincronização INCREMENTAL (Recomendado para produção)

**Como funciona**:
1. API Protheus retorna apenas registros modificados desde última sync
2. Sistema faz UPSERT (Insert se não existe, Update se existe)
3. Registros deletados no Protheus são marcados como `is_active=false`

**Requer na API de Terceiro**:
```json
GET /api/protheus/sb1010?filial=01&updated_since=2025-10-20T10:00:00Z
```

**Prós**:
- ✅ Muito mais rápido (apenas delta)
- ✅ Sem downtime
- ✅ Baixo consumo de recursos

**Contras**:
- ❌ Mais complexo de implementar
- ❌ API terceira precisa suportar filtro por data
- ❌ Requer auditoria no Protheus (`updated_at`)

**Quando usar**:
- Sincronização horária em produção
- Ambientes com muitos dados

---

### Opção 3: Sincronização HÍBRIDA (Recomendação Final)

**Estratégia**:
- **Tabelas de Cadastro** (SBM, SZD, SZE, SZF, SLK, DA1): FULL 1x/dia (noturno)
- **Tabelas de Produtos** (SB1, SBZ): INCREMENTAL a cada 4 horas
- **Tabelas de Estoque** (SB2, SB8): INCREMENTAL a cada 1 hora (dados mudam muito)

**Cronograma Proposto**:
```
03:00 - FULL sync: SBM, SZD, SZE, SZF (tabelas pequenas)
06:00 - INCREMENTAL: SB1, SBZ (produtos novos/alterados)
09:00 - INCREMENTAL: SB2, SB8 (saldos atualizados)
12:00 - INCREMENTAL: SB1, SBZ, SB2, SB8
15:00 - INCREMENTAL: SB2, SB8
18:00 - INCREMENTAL: SB1, SBZ, SB2, SB8
21:00 - INCREMENTAL: SB2, SB8
```

---

## ✅ VALIDAÇÕES E TRATAMENTO DE ERROS

### Validações de Dados

#### Nível 1: Validação de Schema JSON
```python
from pydantic import BaseModel, Field, validator

class SB1010Model(BaseModel):
    b1_filial: str = Field(..., max_length=10)
    b1_cod: str = Field(..., max_length=50)
    b1_desc: str = Field(..., max_length=100)
    b1_rastro: str = Field(default='N', regex='^[LSN]$')

    @validator('b1_rastro')
    def validate_rastro(cls, v):
        if v not in ['L', 'S', 'N']:
            raise ValueError('b1_rastro deve ser L, S ou N')
        return v
```

#### Nível 2: Validação de Integridade Referencial
```python
# Antes de inserir SB1010, verificar se grupo existe
grupo = db.query(SBM010).filter_by(bm_grupo=data['b1_grupo']).first()
if not grupo:
    logger.warning(f"Grupo {data['b1_grupo']} não existe, criando...")
    # Criar grupo automaticamente OU rejeitar produto
```

#### Nível 3: Validação de Regras de Negócio
```python
# Se produto tem rastro por lote, deve ter saldo em SB8
if produto.b1_rastro == 'L':
    lotes = db.query(SB8010).filter_by(b8_produto=produto.b1_cod).count()
    if lotes == 0:
        logger.warning(f"Produto {produto.b1_cod} com rastro 'L' mas sem lotes em SB8")
```

### Tratamento de Erros

**Estratégia de Retry**:
```python
@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
async def fetch_protheus_data(table: str):
    response = await httpx.get(f"{PROTHEUS_API_URL}/api/protheus/{table}")
    response.raise_for_status()
    return response.json()
```

**Log de Erros**:
```python
class ImportLog(Base):
    id = Column(UUID, primary_key=True)
    table_name = Column(String)
    status = Column(Enum('SUCCESS', 'PARTIAL', 'FAILED'))
    total_records = Column(Integer)
    inserted = Column(Integer)
    updated = Column(Integer)
    errors = Column(JSON)  # [{record_id: "X", error: "..."}]
    started_at = Column(DateTime)
    finished_at = Column(DateTime)
```

**Ações em Caso de Erro**:
1. ❌ **Erro de Conexão**: Retry 3x com backoff exponencial
2. ❌ **Erro de Validação**: Log erro, pular registro, continuar importação
3. ❌ **Erro Crítico** (DB down): Abortar importação, notificar admin
4. ❌ **Timeout**: Aumentar tempo de espera, dividir request em páginas menores

---

## 📈 ESTRATÉGIA DE IMPLEMENTAÇÃO (FASES)

### **FASE 1: Tabelas de Cadastro Auxiliares** (Semana 1)
**Prioridade**: 🟡 BAIXA
**Complexidade**: Baixa
**Tempo Estimado**: 8-12 horas

**Tabelas**:
- ✅ SBM010 - Grupos de Produtos
- ✅ SZD010 - Categorias
- ✅ SZE010 - Subcategorias
- ✅ SZF010 - Segmentos

**Entregáveis**:
- Modelos Pydantic para validação
- Endpoints `/api/v1/import/{tabela}`
- Upsert básico (INSERT ON CONFLICT DO UPDATE)
- Logs de importação
- Testes unitários

**Critério de Sucesso**:
- 100% dos registros importados sem erro
- Tempo de importação < 30 segundos por tabela

---

### **FASE 2: Produtos e Indicadores** (Semana 2)
**Prioridade**: 🔴 ALTA
**Complexidade**: Média
**Tempo Estimado**: 16-20 horas

**Tabelas**:
- ✅ SB1010 - Cadastro de Produtos
- ✅ SBZ010 - Indicador de Produtos

**Dependências**:
- SBM010 deve estar importado (validação de b1_grupo)
- SZD/SZE/SZF devem estar importados (validação de categorias)

**Entregáveis**:
- Validação de integridade referencial
- Endpoint `/api/v1/import/products` (SB1+SBZ juntos)
- Sincronização incremental (se API suportar)
- Tratamento de produtos duplicados
- Dashboard de status de importação

**Critério de Sucesso**:
- 10.000 produtos importados em < 5 minutos
- Zero produtos órfãos (sem grupo válido)

---

### **FASE 3: Códigos de Barras e Preços** (Semana 3)
**Prioridade**: 🟠 MÉDIA
**Complexidade**: Média
**Tempo Estimado**: 12-16 horas

**Tabelas**:
- ✅ SLK010 - Código de Barras
- ✅ DA1010 - Tabela de Preço

**Entregáveis**:
- Relacionamento N:1 (múltiplos códigos de barras por produto)
- Validação de códigos de barras duplicados
- Preços vigentes (filtro por data)
- Endpoint de consulta `/api/v1/products/{code}/prices`

**Critério de Sucesso**:
- Todos códigos de barras vinculados a produtos existentes
- Preços com vigência correta

---

### **FASE 4: Saldos de Estoque** (Semana 4)
**Prioridade**: 🔴 ALTA
**Complexidade**: Alta
**Tempo Estimado**: 20-24 horas

**Tabelas**:
- ✅ SB2010 - Saldo em Estoque por Armazém
- ✅ SB8010 - Saldo por Armazém e Lote

**Desafios**:
- Sincronização em tempo real (dados mudam constantemente)
- Validação: SUM(SB8.b8_saldo) = SB2.b2_qatu (para produtos com lote)
- Performance: muitos registros (1 produto × N armazéns × M lotes)

**Entregáveis**:
- Sincronização INCREMENTAL obrigatória
- Validação de consistência SB2 vs SB8
- Endpoint `/api/v1/products/{code}/stock`
- Relatório de divergências de estoque
- Otimização de queries (índices, caching)

**Critério de Sucesso**:
- Sincronização de 50.000 registros em < 10 minutos
- Consistência 100% entre SB2 e SB8
- Latência < 500ms para consulta de estoque

---

### **FASE 5: Automação e Monitoramento** (Semana 5)
**Prioridade**: 🔴 ALTA
**Complexidade**: Média
**Tempo Estimado**: 16-20 horas

**Entregáveis**:
- Cron job para sincronização automática
- Dashboard de monitoramento (Grafana?)
- Alertas de falha (email/Slack)
- Endpoint `/api/v1/sync/status` (última sync, próxima, erros)
- Relatório de auditoria (quem importou, quando, quantos registros)
- Documentação completa (Swagger atualizado)

**Critério de Sucesso**:
- Sincronização automática funcionando 24/7
- Alertas disparados em < 5 minutos após erro
- Dashboard mostrando métricas em tempo real

---

## 📊 CRONOGRAMA RESUMIDO

| Fase | Descrição | Duração | Data Início | Data Fim |
|------|-----------|---------|-------------|----------|
| 1 | Tabelas Auxiliares | 8-12h | Semana 1 | Semana 1 |
| 2 | Produtos e Indicadores | 16-20h | Semana 2 | Semana 2 |
| 3 | Códigos de Barras e Preços | 12-16h | Semana 3 | Semana 3 |
| 4 | Saldos de Estoque | 20-24h | Semana 4 | Semana 4 |
| 5 | Automação e Monitoramento | 16-20h | Semana 5 | Semana 5 |
| **TOTAL** | **5 fases** | **72-92h** | **~5 semanas** | **~1.2 meses** |

---

## 🔐 CONSIDERAÇÕES DE SEGURANÇA

### Autenticação na API de Terceiro
```python
PROTHEUS_API_URL = "https://api-protheus.empresa.com.br"
PROTHEUS_API_KEY = "secret-key-123"  # Variável de ambiente!

headers = {
    "Authorization": f"Bearer {PROTHEUS_API_KEY}",
    "Content-Type": "application/json"
}
```

### Rate Limiting
- Máximo 100 requests/minuto para API do Protheus
- Implementar throttling com `asyncio.Semaphore`

### Dados Sensíveis
- **Preços (DA1010)**: Acesso restrito a ADMIN/SUPERVISOR
- **Custos (SB2.b2_cm1)**: Acesso restrito a ADMIN
- Logs de importação NÃO devem conter dados sensíveis

---

## 📝 MODELO DE ENDPOINT DE IMPORTAÇÃO

```python
# backend/app/api/v1/endpoints/import_protheus.py

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
import httpx

router = APIRouter()

@router.post("/import/sb1010")
async def import_sb1010(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)  # Apenas ADMIN
):
    """
    Importa cadastro de produtos (SB1010) da API do Protheus

    **Processo**:
    1. Busca dados da API externa
    2. Valida schema JSON
    3. Valida integridade referencial
    4. Faz UPSERT no banco
    5. Registra log de importação
    """

    # Criar log de importação
    import_log = ImportLog(
        table_name="sb1010",
        status="IN_PROGRESS",
        started_at=datetime.utcnow(),
        created_by=current_user.id
    )
    db.add(import_log)
    db.commit()

    try:
        # 1. Buscar dados da API
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.get(
                f"{PROTHEUS_API_URL}/api/protheus/sb1010",
                params={"filial": current_user.store.code},
                headers={"Authorization": f"Bearer {PROTHEUS_API_KEY}"}
            )
            response.raise_for_status()
            data = response.json()

        # 2. Validar e importar
        stats = {"inserted": 0, "updated": 0, "errors": 0}
        errors = []

        for record in data["data"]:
            try:
                # Validar com Pydantic
                validated = SB1010Model(**record)

                # Upsert
                existing = db.query(SB1010).filter_by(
                    b1_filial=validated.b1_filial,
                    b1_cod=validated.b1_cod
                ).first()

                if existing:
                    for key, value in validated.dict().items():
                        setattr(existing, key, value)
                    existing.updated_at = datetime.utcnow()
                    stats["updated"] += 1
                else:
                    new_record = SB1010(**validated.dict())
                    db.add(new_record)
                    stats["inserted"] += 1

            except Exception as e:
                stats["errors"] += 1
                errors.append({
                    "record": record.get("b1_cod"),
                    "error": str(e)
                })
                logger.error(f"Erro ao importar produto {record.get('b1_cod')}: {e}")

        db.commit()

        # Atualizar log
        import_log.status = "SUCCESS" if stats["errors"] == 0 else "PARTIAL"
        import_log.total_records = len(data["data"])
        import_log.inserted = stats["inserted"]
        import_log.updated = stats["updated"]
        import_log.errors = errors
        import_log.finished_at = datetime.utcnow()
        db.commit()

        return {
            "success": True,
            "import_id": str(import_log.id),
            "stats": stats,
            "errors": errors
        }

    except Exception as e:
        import_log.status = "FAILED"
        import_log.errors = [{"error": str(e)}]
        import_log.finished_at = datetime.utcnow()
        db.commit()
        raise HTTPException(status_code=500, detail=str(e))
```

---

## 🎯 PRÓXIMOS PASSOS

### Imediatos (Esta Semana)
1. ✅ Validar estruturas JSON com time do Protheus
2. ✅ Obter credenciais da API de terceiro
3. ✅ Testar conectividade com API
4. ✅ Revisar e aprovar este plano

### Curto Prazo (Próximas 2 Semanas)
1. ⏳ Implementar FASE 1 (Tabelas Auxiliares)
2. ⏳ Criar modelos Pydantic
3. ⏳ Desenvolver endpoints de importação
4. ⏳ Testes de integração

### Médio Prazo (1 Mês)
1. ⏳ Implementar FASES 2-4
2. ⏳ Sincronização incremental
3. ⏳ Dashboard de monitoramento
4. ⏳ Deploy em staging

### Longo Prazo (2 Meses)
1. ⏳ Automação completa (FASE 5)
2. ⏳ Deploy em produção
3. ⏳ Treinamento de usuários
4. ⏳ Documentação final

---

## 📚 REFERÊNCIAS

- **FastAPI**: https://fastapi.tiangolo.com/
- **Pydantic**: https://docs.pydantic.dev/
- **SQLAlchemy**: https://docs.sqlalchemy.org/
- **httpx**: https://www.python-httpx.org/
- **Protheus**: Documentação interna (a definir)

---

**Documento criado em**: 20/10/2025
**Versão**: v1.0
**Status**: Aguardando aprovação
**Próxima revisão**: Após validação com equipe Protheus
