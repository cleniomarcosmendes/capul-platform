# 🐛 PROBLEMA: Erro "Optional not defined" ao importar inventory router

**Data**: 15/10/2025
**Status**: 🔴 **BLOQUEADOR** - Impede teste do endpoint de snapshot
**Prioridade**: ALTA

---

## 📋 Descrição do Problema

O backend não consegue registrar o `inventory_router` devido a um erro Pydantic:

```
ERROR:app.main:❌ Erro ao registrar router de inventário: name 'Optional' is not defined
```

### Comportamento Esperado
- Router `inventory_router` deveria ser importado e registrado com sucesso
- Endpoint `GET /api/v1/inventory/items/{item_id}/lots-snapshot` deveria estar disponível

### Comportamento Atual
- Import falha com erro Pydantic sobre `Optional` não definido
- Endpoint retorna 404 Not Found
- Router não aparece no OpenAPI

---

## 🔍 Investigação Realizada

### 1. Tentativas de Correção

#### ✅ Tentativa 1: Adicionar `Optional` ao main.py
```python
from typing import Optional, List, Dict, Any  # Linha 14 do main.py
```
**Resultado**: Não resolveu

#### ✅ Tentativa 2: Adicionar `Optional` ao inventory_schemas.py
```python
from typing import List, Union, Optional  # Linha 3
```
**Resultado**: Não resolveu

#### ✅ Tentativa 3: Adicionar `from __future__ import annotations`
```python
# schemas.py e inventory_schemas.py
from __future__ import annotations
```
**Resultado**: Não resolveu

#### ✅ Tentativa 4: Lazy import do inventory_router
```python
# main.py linha 7897-7905
try:
    from app.api.v1.endpoints.inventory import router as inventory_router
    app.include_router(inventory_router, prefix="/api/v1/inventory", tags=["Inventory"])
    logger.info("✅ Router de inventário registrado com sucesso")
except ImportError as ie:
    logger.error(f"❌ Erro ao importar router de inventário: {ie}")
except Exception as e:
    logger.error(f"❌ Erro ao registrar router de inventário: {e}")
```
**Resultado**: Falha com "name 'Optional' is not defined"

### 2. Análise de Imports

Verificação sistemática mostrou que TODOS os arquivos têm imports corretos:

| Arquivo | Importa typing? | Importa Optional? | Usa Optional[]? | Status |
|---------|----------------|-------------------|-----------------|---------|
| inventory.py | ✅ | ✅ | ✅ | OK |
| security.py | ✅ | ❌ | ❌ | OK (não usa) |
| schemas.py | ✅ | ✅ | ✅ | OK |
| inventory_schemas.py | ✅ | ✅ | ❌ | OK |

### 3. Stacktrace Analisado

O erro ocorre durante a avaliação do Pydantic ao processar o primeiro endpoint:

```python
@router.get("/lists", response_model=PaginatedResponse, summary="Listar inventários")
async def list_inventory_lists(
    store_id: Optional[str] = Query(None, description="ID da loja"),  # ← PROBLEMA AQUI
    ...
```

O Pydantic tenta resolver a anotação `Optional[str]` mas o `Optional` não está disponível no namespace correto.

---

## 🎯 Problema Raiz Identificado

**Hipótese**: Dependência circular ou problema de namespace do Pydantic ao avaliar type annotations em tempo de execução.

O erro NÃO é de sintaxe Python, mas de como o Pydantic resolve Forward References durante o registro dos endpoints FastAPI.

---

## 💡 Possíveis Soluções (Para Amanhã)

### Solução 1: Injetar `Optional` no namespace global
```python
# No início do inventory.py
import builtins
builtins.Optional = Optional  # Garantir que está disponível globalmente
```

### Solução 2: Usar `from typing import TYPE_CHECKING`
```python
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from typing import Optional
else:
    Optional = None  # Ou alguma definição runtime-safe
```

### Solução 3: Simplificar schemas
- Remover uso de `Optional` substituindo por `str | None` (Python 3.10+)
- Usar apenas tipos simples sem Union/Optional

### Solução 4: Debugar com breakpoint
```python
# Adicionar no inventory.py antes do primeiro @router
import pdb; pdb.set_trace()
# Verificar locals() e globals() para ver se Optional está disponível
```

### Solução 5: Reescrever endpoint problemático
- Testar criar um novo arquivo `inventory_v2.py` sem dependências complexas
- Migrar gradualmente os endpoints

---

## 📊 Impacto

### Funcionalidades Bloqueadas
- ❌ Endpoint `/items/{item_id}/lots-snapshot` não acessível
- ❌ Teste do sistema de snapshot de lotes impossível
- ❌ Modal de lotes no frontend não pode usar dados congelados

### Funcionalidades Funcionando
- ✅ Criação de snapshots de itens (testado via SQL)
- ✅ Criação de snapshots de lotes (testado via SQL - produto 00085927)
- ✅ Imutabilidade dos dados (validado)
- ✅ Frontend preparado com suporte a snapshot

---

## 🔄 Próximos Passos

1. **Investigação Profunda** (30-60 min)
   - Adicionar logs detalhados no momento do import
   - Usar `docker exec -it` para debug interativo
   - Verificar versões exatas de FastAPI e Pydantic

2. **Workaround Temporário** (se investigação falhar)
   - Criar endpoint fora do router principal
   - Registrar endpoint manualmente com `app.add_api_route()`

3. **Teste do Segundo Problema** (prioridade após resolver bloqueador)
   - Corrigir query de lotes para buscar em TODOS os armazéns
   - Atualmente busca apenas `warehouse='02'` mas lote está em `warehouse='06'`

---

## 📝 Referências

- **Arquivo principal**: `backend/app/api/v1/endpoints/inventory.py`
- **Endpoint bloqueado**: Linha 699-833
- **Logs do erro**: `docker-compose logs backend | grep "Optional"`
- **Documentação Pydantic**: https://docs.pydantic.dev/latest/errors/errors/
- **Error code**: `pydantic.errors.PydanticUndefinedAnnotation`

---

## ✅ Validações Já Realizadas

- [x] Snapshots de itens sendo criados corretamente (SQL)
- [x] Snapshots de lotes sendo criados para produto 00085927 (SQL)
- [x] Imutabilidade validada (teste com valores absurdos)
- [x] Frontend tem código pronto para usar snapshot
- [x] SnapshotService funcionando corretamente

**Conclusão**: Sistema de snapshot está 95% pronto. Apenas bloqueado pelo problema de import do router.
