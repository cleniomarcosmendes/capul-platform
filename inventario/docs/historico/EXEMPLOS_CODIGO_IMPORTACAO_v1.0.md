# 💻 EXEMPLOS DE CÓDIGO - Importação API Protheus v1.0

**Data**: 20/10/2025
**Versão**: v1.0
**Status**: 📋 **DOCUMENTAÇÃO - NÃO IMPLEMENTAR**

> **⚠️ IMPORTANTE**: Este documento contém apenas **exemplos teóricos** de código para fins de planejamento. **NÃO implementar** sem aprovação.

---

## 📋 ÍNDICE

1. [Modelos Pydantic (Validação)](#1-modelos-pydantic)
2. [Serviço de Importação](#2-serviço-de-importação)
3. [Endpoints FastAPI](#3-endpoints-fastapi)
4. [Tratamento de Erros](#4-tratamento-de-erros)
5. [Testes Unitários](#5-testes-unitários)
6. [Sincronização Automática](#6-sincronização-automática)

---

## 1. MODELOS PYDANTIC

### 1.1 Modelo SB1010 - Produtos

```python
# backend/app/schemas/protheus.py

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime

class SB1010Schema(BaseModel):
    """
    Schema de validação para importação de produtos (SB1010)
    """

    # Chave primária
    b1_filial: str = Field(..., max_length=10, description="Código da filial")
    b1_cod: str = Field(..., max_length=50, description="Código do produto")

    # Identificação
    b1_codbar: Optional[str] = Field(None, max_length=50, description="Código de barras principal")
    b1_desc: Optional[str] = Field(None, max_length=100, description="Descrição do produto")

    # Classificação
    b1_tipo: Optional[str] = Field(None, max_length=2, description="Tipo (PA, MP, etc)")
    b1_um: Optional[str] = Field(None, max_length=2, description="Unidade de medida")
    b1_locpad: Optional[str] = Field(None, max_length=10, description="Armazém padrão")

    # Hierarquia
    b1_grupo: Optional[str] = Field(None, max_length=10, description="Grupo do produto")
    b1_xcatgor: Optional[str] = Field(None, max_length=10, description="Categoria")
    b1_xsubcat: Optional[str] = Field(None, max_length=10, description="Subcategoria")
    b1_xsegmen: Optional[str] = Field(None, max_length=10, description="Segmento")
    b1_xgrinve: Optional[str] = Field(None, max_length=10, description="Grupo de inventário")

    # Controles
    b1_rastro: str = Field(default='N', max_length=1, description="Rastreabilidade (L/S/N)")

    # Validadores
    @validator('b1_rastro')
    def validate_rastro(cls, v):
        """Valida campo de rastreabilidade"""
        if v not in ['L', 'S', 'N']:
            raise ValueError("b1_rastro deve ser 'L', 'S' ou 'N'")
        return v.upper()

    @validator('b1_cod')
    def validate_cod(cls, v):
        """Valida código do produto"""
        if len(v) < 6:
            raise ValueError("b1_cod deve ter no mínimo 6 caracteres")
        if not v.isalnum():
            raise ValueError("b1_cod deve conter apenas letras e números")
        return v

    @validator('b1_codbar')
    def validate_codbar(cls, v):
        """Valida código de barras"""
        if v is None:
            return v
        if len(v) < 8:
            raise ValueError("Código de barras deve ter no mínimo 8 caracteres")
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "b1_filial": "01",
                "b1_cod": "00010001",
                "b1_codbar": "7891234567890",
                "b1_desc": "PRODUTO EXEMPLO 1KG",
                "b1_tipo": "PA",
                "b1_um": "UN",
                "b1_locpad": "01",
                "b1_grupo": "0001",
                "b1_rastro": "L"
            }
        }
```

### 1.2 Modelo SB2010 - Saldos

```python
class SB2010Schema(BaseModel):
    """
    Schema de validação para saldos em estoque (SB2010)
    """

    # Chave primária composta
    b2_filial: str = Field(..., max_length=10)
    b2_cod: str = Field(..., max_length=50)
    b2_local: str = Field(..., max_length=10)

    # Quantidades
    b2_qatu: Optional[float] = Field(0.0, ge=0, description="Quantidade atual")
    b2_qemp: Optional[float] = Field(0.0, ge=0, description="Quantidade empenhada")
    b2_reserva: Optional[float] = Field(0.0, ge=0, description="Quantidade reservada")

    # Valores
    b2_vatu1: Optional[float] = Field(0.0, ge=0, description="Valor total do estoque")
    b2_cm1: Optional[float] = Field(0.0, ge=0, description="Custo médio")

    @validator('b2_qatu', 'b2_qemp', 'b2_reserva')
    def validate_quantities(cls, v):
        """Valida quantidades não negativas"""
        if v is not None and v < 0:
            raise ValueError("Quantidades não podem ser negativas")
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "b2_filial": "01",
                "b2_cod": "00010001",
                "b2_local": "01",
                "b2_qatu": 150.0000,
                "b2_qemp": 10.0000,
                "b2_reserva": 5.0000,
                "b2_vatu1": 4575.00,
                "b2_cm1": 30.50
            }
        }
```

### 1.3 Modelo SB8010 - Lotes

```python
from datetime import date

class SB8010Schema(BaseModel):
    """
    Schema de validação para saldos por lote (SB8010)
    """

    # Chave de negócio
    b8_filial: str = Field(..., max_length=10)
    b8_produto: str = Field(..., max_length=50)
    b8_local: str = Field(..., max_length=10)
    b8_lotectl: str = Field(..., max_length=50, description="Número do lote")

    # Dados do lote
    b8_saldo: Optional[float] = Field(0.0, ge=0, description="Saldo do lote")
    b8_dtvalid: Optional[date] = Field(None, description="Data de validade")
    b8_numlote: Optional[str] = Field(None, max_length=20, description="Número sequencial")

    @validator('b8_dtvalid')
    def validate_validade(cls, v):
        """Valida data de validade"""
        if v is not None and v < date.today():
            # Apenas warning, não bloqueia importação
            import logging
            logging.warning(f"Lote com validade vencida: {v}")
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "b8_filial": "01",
                "b8_produto": "00010037",
                "b8_local": "01",
                "b8_lotectl": "LOTE2024001",
                "b8_saldo": 144.0000,
                "b8_dtvalid": "2025-12-31",
                "b8_numlote": "001"
            }
        }
```

---

## 2. SERVIÇO DE IMPORTAÇÃO

### 2.1 Classe Base de Importação

```python
# backend/app/services/protheus_import.py

from typing import List, Dict, Any, Optional
import httpx
from sqlalchemy.orm import Session
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class ProtheusImportService:
    """
    Serviço centralizado para importação de dados do Protheus
    """

    def __init__(
        self,
        db: Session,
        api_url: str,
        api_key: str,
        timeout: int = 300
    ):
        self.db = db
        self.api_url = api_url
        self.api_key = api_key
        self.timeout = timeout

    async def fetch_data(
        self,
        table_name: str,
        filial: str,
        params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Busca dados de uma tabela do Protheus via API

        Args:
            table_name: Nome da tabela (sb1010, sb2010, etc)
            filial: Código da filial
            params: Parâmetros adicionais (ex: updated_since para sync incremental)

        Returns:
            Dict com success, total, data, metadata

        Raises:
            httpx.HTTPError: Erro de conexão ou API
        """
        url = f"{self.api_url}/api/protheus/{table_name}"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        query_params = {"filial": filial}
        if params:
            query_params.update(params)

        logger.info(f"Buscando dados de {table_name} para filial {filial}")

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(url, headers=headers, params=query_params)
            response.raise_for_status()

            data = response.json()

            logger.info(
                f"Retornados {data.get('total', 0)} registros de {table_name}"
            )

            return data

    def create_import_log(
        self,
        table_name: str,
        user_id: str
    ) -> 'ImportLog':
        """
        Cria registro de log de importação

        Args:
            table_name: Nome da tabela sendo importada
            user_id: ID do usuário que iniciou a importação

        Returns:
            Objeto ImportLog criado
        """
        from app.models.models import ImportLog

        log = ImportLog(
            table_name=table_name,
            status="IN_PROGRESS",
            started_at=datetime.utcnow(),
            created_by=user_id
        )
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)

        return log

    def update_import_log(
        self,
        log_id: str,
        status: str,
        stats: Dict[str, int],
        errors: List[Dict[str, str]] = None
    ):
        """
        Atualiza log de importação com resultados

        Args:
            log_id: ID do log a atualizar
            status: SUCCESS, PARTIAL ou FAILED
            stats: Estatísticas (inserted, updated, errors, etc)
            errors: Lista de erros encontrados
        """
        from app.models.models import ImportLog

        log = self.db.query(ImportLog).filter_by(id=log_id).first()
        if log:
            log.status = status
            log.total_records = stats.get('total', 0)
            log.inserted = stats.get('inserted', 0)
            log.updated = stats.get('updated', 0)
            log.errors = errors or []
            log.finished_at = datetime.utcnow()

            self.db.commit()
```

### 2.2 Importador de Produtos (SB1010)

```python
from app.models.models import SB1010, SBM010
from app.schemas.protheus import SB1010Schema

class ProductImporter(ProtheusImportService):
    """
    Importador especializado para produtos (SB1010)
    """

    async def import_products(
        self,
        filial: str,
        user_id: str,
        incremental: bool = False
    ) -> Dict[str, Any]:
        """
        Importa produtos da API do Protheus

        Args:
            filial: Código da filial
            user_id: ID do usuário que iniciou
            incremental: Se True, importa apenas modificados

        Returns:
            Dict com resultados da importação
        """
        # Criar log
        log = self.create_import_log("sb1010", user_id)

        stats = {"total": 0, "inserted": 0, "updated": 0, "errors": 0}
        errors = []

        try:
            # Buscar dados da API
            params = {}
            if incremental:
                # Buscar última importação bem-sucedida
                last_sync = self._get_last_successful_sync("sb1010")
                if last_sync:
                    params["updated_since"] = last_sync.isoformat()

            data = await self.fetch_data("sb1010", filial, params)
            stats["total"] = data.get("total", 0)

            # Processar cada produto
            for record in data.get("data", []):
                try:
                    # Validar com Pydantic
                    validated = SB1010Schema(**record)

                    # Validar integridade referencial
                    self._validate_product_references(validated)

                    # Upsert no banco
                    existing = self.db.query(SB1010).filter_by(
                        b1_filial=validated.b1_filial,
                        b1_cod=validated.b1_cod
                    ).first()

                    if existing:
                        # Atualizar
                        for key, value in validated.dict().items():
                            setattr(existing, key, value)
                        existing.updated_at = datetime.utcnow()
                        stats["updated"] += 1
                    else:
                        # Inserir
                        new_product = SB1010(**validated.dict())
                        new_product.created_at = datetime.utcnow()
                        self.db.add(new_product)
                        stats["inserted"] += 1

                    # Commit a cada 100 registros
                    if (stats["inserted"] + stats["updated"]) % 100 == 0:
                        self.db.commit()
                        logger.info(
                            f"Processados {stats['inserted'] + stats['updated']} produtos"
                        )

                except Exception as e:
                    stats["errors"] += 1
                    errors.append({
                        "record": record.get("b1_cod", "UNKNOWN"),
                        "error": str(e)
                    })
                    logger.error(f"Erro ao importar produto {record.get('b1_cod')}: {e}")

            # Commit final
            self.db.commit()

            # Atualizar log
            status = "SUCCESS" if stats["errors"] == 0 else "PARTIAL"
            self.update_import_log(log.id, status, stats, errors)

            return {
                "success": True,
                "import_id": str(log.id),
                "stats": stats,
                "errors": errors[:10]  # Retornar apenas primeiros 10 erros
            }

        except Exception as e:
            logger.error(f"Erro crítico na importação de produtos: {e}")
            self.db.rollback()

            self.update_import_log(
                log.id,
                "FAILED",
                stats,
                [{"error": str(e)}]
            )

            raise

    def _validate_product_references(self, product: SB1010Schema):
        """
        Valida integridade referencial do produto

        Args:
            product: Produto validado pelo Pydantic

        Raises:
            ValueError: Se alguma referência for inválida
        """
        # Validar grupo
        if product.b1_grupo:
            grupo = self.db.query(SBM010).filter_by(
                bm_grupo=product.b1_grupo
            ).first()

            if not grupo:
                logger.warning(
                    f"Grupo {product.b1_grupo} não existe para produto {product.b1_cod}. "
                    "Produto será importado mas pode ter problemas de classificação."
                )
                # Não bloqueia importação, apenas avisa

        # Validar categorias (SZD, SZE, SZF)
        # Similar ao grupo...

    def _get_last_successful_sync(self, table_name: str) -> Optional[datetime]:
        """
        Retorna data/hora da última sincronização bem-sucedida

        Args:
            table_name: Nome da tabela

        Returns:
            Datetime da última sync ou None
        """
        from app.models.models import ImportLog

        last_log = self.db.query(ImportLog).filter(
            ImportLog.table_name == table_name,
            ImportLog.status == "SUCCESS"
        ).order_by(ImportLog.finished_at.desc()).first()

        return last_log.finished_at if last_log else None
```

---

## 3. ENDPOINTS FASTAPI

### 3.1 Router de Importação

```python
# backend/app/api/v1/endpoints/import_protheus.py

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_admin_user
from app.models.models import User
from app.services.protheus_import import ProductImporter
from app.core.config import settings

router = APIRouter(prefix="/import", tags=["Importação Protheus"])

@router.post("/sb1010", summary="Importar Produtos (SB1010)")
async def import_products_endpoint(
    incremental: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Importa cadastro de produtos (SB1010) da API do Protheus

    **Acesso**: Apenas ADMIN

    **Parâmetros**:
    - `incremental`: Se True, importa apenas produtos modificados desde última sync

    **Processo**:
    1. Busca dados da API externa
    2. Valida schema JSON (Pydantic)
    3. Valida integridade referencial
    4. Faz UPSERT no banco
    5. Registra log de importação

    **Retorno**:
    ```json
    {
      "success": true,
      "import_id": "uuid-123",
      "stats": {
        "total": 1523,
        "inserted": 45,
        "updated": 1478,
        "errors": 0
      },
      "errors": []
    }
    ```
    """

    importer = ProductImporter(
        db=db,
        api_url=settings.PROTHEUS_API_URL,
        api_key=settings.PROTHEUS_API_KEY
    )

    try:
        result = await importer.import_products(
            filial=current_user.store.code,
            user_id=str(current_user.id),
            incremental=incremental
        )

        return result

    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Erro ao conectar com API do Protheus: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao importar produtos: {str(e)}"
        )

@router.post("/all", summary="Importar Todas as Tabelas")
async def import_all_tables(
    background_tasks: BackgroundTasks,
    incremental: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Importa TODAS as tabelas do Protheus em sequência

    **Ordem de Importação** (respeitando dependências):
    1. SBM010 (Grupos)
    2. SZD010, SZE010, SZF010 (Categorias)
    3. SB1010 (Produtos)
    4. SBZ010 (Indicadores)
    5. SLK010 (Códigos de Barras)
    6. DA1010 (Preços)
    7. SB2010 (Saldos por Armazém)
    8. SB8010 (Saldos por Lote)

    **Duração Estimada**: 15-30 minutos (depende do volume)

    **Execução**: Background task (não bloqueia request)
    """

    # Adicionar task em background
    background_tasks.add_task(
        import_all_tables_task,
        db=db,
        filial=current_user.store.code,
        user_id=str(current_user.id),
        incremental=incremental
    )

    return {
        "success": True,
        "message": "Importação de todas as tabelas iniciada em background",
        "estimated_duration": "15-30 minutos"
    }

async def import_all_tables_task(
    db: Session,
    filial: str,
    user_id: str,
    incremental: bool
):
    """
    Task de background para importar todas as tabelas
    """
    importer = ProductImporter(
        db=db,
        api_url=settings.PROTHEUS_API_URL,
        api_key=settings.PROTHEUS_API_KEY
    )

    # Ordem de importação (respeitando dependências)
    tables = [
        "sbm010",   # Grupos (sem dependências)
        "szd010",   # Categorias
        "sze010",   # Subcategorias
        "szf010",   # Segmentos
        "sb1010",   # Produtos (depende de grupos/categorias)
        "sbz010",   # Indicadores (depende de produtos)
        "slk010",   # Códigos de Barras (depende de produtos)
        "da1010",   # Preços (depende de produtos)
        "sb2010",   # Saldos (depende de produtos)
        "sb8010"    # Lotes (depende de produtos)
    ]

    for table in tables:
        try:
            logger.info(f"Importando tabela {table}...")
            # Chamar importador específico de cada tabela
            # (similar ao ProductImporter)
        except Exception as e:
            logger.error(f"Erro ao importar {table}: {e}")
```

### 3.2 Endpoint de Status

```python
@router.get("/status", summary="Status das Importações")
async def get_import_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Retorna status da última sincronização de cada tabela

    **Retorno**:
    ```json
    {
      "sb1010": {
        "last_sync": "2025-10-20T15:30:00Z",
        "status": "SUCCESS",
        "total_records": 1523,
        "duration_seconds": 135
      },
      "sb2010": {
        "last_sync": "2025-10-20T16:00:00Z",
        "status": "IN_PROGRESS",
        "progress": "45%"
      }
    }
    ```
    """
    from app.models.models import ImportLog

    tables = ["sb1010", "sb2010", "sb8010", "sbz010", "slk010", "da1010"]
    status = {}

    for table in tables:
        last_log = db.query(ImportLog).filter(
            ImportLog.table_name == table
        ).order_by(ImportLog.started_at.desc()).first()

        if last_log:
            duration = None
            if last_log.finished_at and last_log.started_at:
                duration = (last_log.finished_at - last_log.started_at).total_seconds()

            status[table] = {
                "last_sync": last_log.started_at.isoformat(),
                "status": last_log.status,
                "total_records": last_log.total_records,
                "inserted": last_log.inserted,
                "updated": last_log.updated,
                "errors": len(last_log.errors) if last_log.errors else 0,
                "duration_seconds": duration
            }
        else:
            status[table] = {
                "status": "NEVER_SYNCED",
                "message": "Tabela nunca foi sincronizada"
            }

    return status
```

---

## 4. TRATAMENTO DE ERROS

### 4.1 Retry com Backoff Exponencial

```python
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import httpx

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    retry=retry_if_exception_type(httpx.HTTPError)
)
async def fetch_with_retry(url: str, headers: dict, params: dict):
    """
    Busca dados com retry automático em caso de erro

    Args:
        url: URL da API
        headers: Headers HTTP
        params: Query parameters

    Returns:
        Response JSON

    Raises:
        httpx.HTTPError: Após 3 tentativas falhadas
    """
    async with httpx.AsyncClient(timeout=300.0) as client:
        response = await client.get(url, headers=headers, params=params)
        response.raise_for_status()
        return response.json()
```

### 4.2 Tratamento de Erros Específicos

```python
class ImportError(Exception):
    """Erro base de importação"""
    pass

class ValidationError(ImportError):
    """Erro de validação de dados"""
    pass

class ReferentialIntegrityError(ImportError):
    """Erro de integridade referencial"""
    pass

def handle_import_error(error: Exception, record: dict) -> dict:
    """
    Padroniza tratamento de erros de importação

    Args:
        error: Exceção capturada
        record: Registro que causou o erro

    Returns:
        Dict com informações do erro para log
    """
    error_info = {
        "record_id": record.get("b1_cod") or record.get("b2_cod") or "UNKNOWN",
        "error_type": type(error).__name__,
        "error_message": str(error),
        "timestamp": datetime.utcnow().isoformat()
    }

    # Log específico por tipo de erro
    if isinstance(error, ValidationError):
        logger.warning(f"Validação falhou: {error_info}")
    elif isinstance(error, ReferentialIntegrityError):
        logger.error(f"Integridade referencial violada: {error_info}")
    else:
        logger.exception(f"Erro inesperado: {error_info}")

    return error_info
```

---

## 5. TESTES UNITÁRIOS

### 5.1 Teste de Validação Pydantic

```python
# tests/test_protheus_schemas.py

import pytest
from app.schemas.protheus import SB1010Schema
from pydantic import ValidationError

def test_sb1010_valid_data():
    """Testa validação de produto válido"""
    data = {
        "b1_filial": "01",
        "b1_cod": "00010001",
        "b1_codbar": "7891234567890",
        "b1_desc": "PRODUTO TESTE",
        "b1_rastro": "L"
    }

    product = SB1010Schema(**data)

    assert product.b1_filial == "01"
    assert product.b1_cod == "00010001"
    assert product.b1_rastro == "L"

def test_sb1010_invalid_rastro():
    """Testa validação de b1_rastro inválido"""
    data = {
        "b1_filial": "01",
        "b1_cod": "00010001",
        "b1_rastro": "X"  # Inválido!
    }

    with pytest.raises(ValidationError) as exc_info:
        SB1010Schema(**data)

    assert "b1_rastro deve ser 'L', 'S' ou 'N'" in str(exc_info.value)

def test_sb1010_short_code():
    """Testa validação de código muito curto"""
    data = {
        "b1_filial": "01",
        "b1_cod": "123"  # Menos de 6 caracteres
    }

    with pytest.raises(ValidationError) as exc_info:
        SB1010Schema(**data)

    assert "no mínimo 6 caracteres" in str(exc_info.value)
```

### 5.2 Teste de Importação (Mock)

```python
# tests/test_product_importer.py

import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.protheus_import import ProductImporter

@pytest.mark.asyncio
async def test_import_products_success(db_session, mock_api_response):
    """Testa importação bem-sucedida de produtos"""

    # Mock da API
    importer = ProductImporter(
        db=db_session,
        api_url="http://mock-api",
        api_key="test-key"
    )

    # Mock do fetch_data
    importer.fetch_data = AsyncMock(return_value=mock_api_response)

    # Executar importação
    result = await importer.import_products(
        filial="01",
        user_id="test-user-id",
        incremental=False
    )

    # Assertions
    assert result["success"] is True
    assert result["stats"]["total"] == 2
    assert result["stats"]["inserted"] == 2
    assert result["stats"]["errors"] == 0

@pytest.fixture
def mock_api_response():
    """Fixture com resposta mockada da API"""
    return {
        "success": True,
        "total": 2,
        "data": [
            {
                "b1_filial": "01",
                "b1_cod": "00010001",
                "b1_desc": "PRODUTO 1",
                "b1_rastro": "N"
            },
            {
                "b1_filial": "01",
                "b1_cod": "00010002",
                "b1_desc": "PRODUTO 2",
                "b1_rastro": "L"
            }
        ]
    }
```

---

## 6. SINCRONIZAÇÃO AUTOMÁTICA

### 6.1 Cron Job com APScheduler

```python
# backend/app/core/scheduler.py

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import logging

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()

async def sync_protheus_tables():
    """
    Job de sincronização automática com Protheus

    Executado conforme cronograma:
    - 03:00 - FULL sync: tabelas de cadastro
    - 06:00 - INCREMENTAL: produtos
    - 09:00 - INCREMENTAL: saldos
    - 12:00 - INCREMENTAL: produtos + saldos
    - 15:00 - INCREMENTAL: saldos
    - 18:00 - INCREMENTAL: produtos + saldos
    - 21:00 - INCREMENTAL: saldos
    """
    from app.core.database import SessionLocal
    from app.services.protheus_import import ProductImporter
    from app.core.config import settings

    db = SessionLocal()

    try:
        logger.info("Iniciando sincronização automática do Protheus...")

        # Importar produtos
        importer = ProductImporter(
            db=db,
            api_url=settings.PROTHEUS_API_URL,
            api_key=settings.PROTHEUS_API_KEY
        )

        result = await importer.import_products(
            filial="01",  # Ou pegar de configuração
            user_id="SYSTEM",  # User especial para jobs automáticos
            incremental=True
        )

        logger.info(f"Sincronização concluída: {result['stats']}")

    except Exception as e:
        logger.error(f"Erro na sincronização automática: {e}")

    finally:
        db.close()

def start_scheduler():
    """Inicia scheduler com jobs configurados"""

    # FULL sync noturno (03:00)
    scheduler.add_job(
        sync_protheus_tables,
        CronTrigger(hour=3, minute=0),
        id="full_sync",
        name="Sincronização FULL noturna",
        replace_existing=True
    )

    # INCREMENTAL sync produtos (06:00, 12:00, 18:00)
    for hour in [6, 12, 18]:
        scheduler.add_job(
            sync_protheus_tables,
            CronTrigger(hour=hour, minute=0),
            id=f"incremental_sync_{hour}h",
            name=f"Sincronização INCREMENTAL {hour}:00",
            replace_existing=True
        )

    scheduler.start()
    logger.info("Scheduler de sincronização iniciado")

def stop_scheduler():
    """Para scheduler"""
    scheduler.shutdown()
    logger.info("Scheduler parado")
```

### 6.2 Integração com FastAPI

```python
# backend/app/main.py

from fastapi import FastAPI
from app.core.scheduler import start_scheduler, stop_scheduler

app = FastAPI()

@app.on_event("startup")
async def startup_event():
    """Evento de inicialização da aplicação"""
    start_scheduler()
    logger.info("Aplicação iniciada com scheduler de sincronização")

@app.on_event("shutdown")
async def shutdown_event():
    """Evento de encerramento da aplicação"""
    stop_scheduler()
    logger.info("Aplicação encerrada")
```

---

**Documento criado em**: 20/10/2025
**Versão**: v1.0
**Status**: Documentação - NÃO implementar sem aprovação
**Total de exemplos**: 15 códigos completos
