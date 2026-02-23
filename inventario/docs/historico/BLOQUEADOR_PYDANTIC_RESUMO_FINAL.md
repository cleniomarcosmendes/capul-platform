# 🚨 BLOQUEADOR CRÍTICO: Pydantic v2 + FastAPI
**Data**: 16/10/2025 09:04
**Status**: ⛔ **NÃO RESOLVIDO** após 12 tentativas
**Tempo investido**: ~1h30min

---

## 📋 Resumo Executivo

**Problema**: Routers de inventário não registram devido a erro `name 'Optional' is not defined` do Pydantic v2.

**Impacto**: Sistema de Snapshot v2.10.0 não pode ser testado porque endpoint `/items/{item_id}/lots-snapshot` retorna 404.

**Routers afetados**:
- ❌ `inventory_router`
- ❌ `lots_router` (temporário criado para contornar)
- ❌ `warehouses_router`
- ❌ `counting_lists_router`

---

## 🔍 Histórico de Tentativas

### Tentativa 1-3: Remover `response_model` ❌
- Convertido `/lists` e `/lots-snapshot` para `response_model=None` + retorno dict
- **Resultado**: Erro persiste (FastAPI valida TODOS os endpoints do router)

### Tentativa 4: Criar router isolado (Solução C) ❌
- Criado `inventory_lots.py` separado apenas com endpoint crítico
- **Resultado**: Erro persiste mesmo com router isolado

### Tentativa 5: Corrigir ambiguous relationships ❌
- Adicionado `foreign_keys=[...]` em 8 relationships do `models.py`
- Removido duplicate relationship em `CountingListItem`
- **Resultado**: Erro persiste

### Tentativa 6: Remover código de builtins ✅ → ❌
- Removido `builtins.Optional = Optional` e `builtins._SessionBind = _SessionBind`
- **Resultado**: Removeu erro original de `_SessionBind`, MAS criou novo erro `Optional not defined`

### Tentativa 7: Remover `from __future__ import annotations` ❌
- Removido de `inventory.py`, `models.py`
- **Resultado**: Criou erros de forward references (`InventoryItem not defined`)

### Tentativa 8-10: Adicionar aspas em forward references ❌
- Adicionado aspas em `item: Optional["InventoryItem"]`
- Corrigido 3 referências em `schemas.py`
- **Resultado**: Erro `Optional not defined` persiste

### Tentativa 11: Remover de TODOS os schemas ❌
- Removido `from __future__` de `schemas.py`, `inventory_schemas.py`, `counting_list_schemas.py`
- **Resultado**: Mesmo erro

### Tentativa 12: Adicionar de volta com correções ❌
- Readicionado `from __future__ import annotations` em TODOS os arquivos
- Mantido as correções de foreign_keys e aspas
- SEM código de builtins
- **Resultado**: **MESMO ERRO** - `name 'Optional' is not defined`

---

## 🎯 Causa Raiz (Hipótese Final)

O erro `name 'Optional' is not defined` vem do Pydantic v2 ao tentar avaliar annotations de tipo.

**Possíveis causas restantes:**
1. Há algum schema ou model usando `Optional` de forma dinâmica (eval/exec)
2. Há circular imports entre schemas que o Pydantic não consegue resolver
3. Bug do Pydantic v2.5 com SQLAlchemy ORM models específicos
4. Há algum arquivo que importa schemas SEM importar typing.Optional

**Observação crítica**: O erro acontece em 4 routers DIFERENTES mas alguns routers (assignments, lot_draft, users) funcionam perfeitamente. Isso sugere que o problema está em alguma dependência COMUM entre os routers que falham.

---

## ✅ O Que Funciona

- ✅ Router de importação
- ✅ Router de usuários
- ✅ Router de assignments
- ✅ Router de rascunhos de lotes
- ✅ Banco de dados 100% funcional
- ✅ Models SQLAlchemy com relationships corretas
- ✅ Frontend preparado
- ✅ SnapshotService funcionando perfeitamente

---

## 🚫 O Que NÃO Funciona

- ❌ Router de inventário (inventory.py) - 15 endpoints
- ❌ Router de lotes temporário (inventory_lots.py) - 1 endpoint
- ❌ Router de armazéns (warehouses.py)
- ❌ Router de listas de contagem (counting_lists.py)

**Padrão identificado**: Todos os routers que falham importam de `inventory_schemas.py` ou dependem de models complexos de inventário.

---

## 💡 Soluções Recomendadas (em ordem de viabilidade)

### 🥇 Solução A: Downgrade Pydantic para v1
**Viabilidade**: ALTA
**Tempo estimado**: 30 minutos
**Impacto**: Baixo (Pydantic v1 é estável)

```bash
pip install "pydantic<2.0"
```

**Vantagens**:
- Pydantic v1 não tem esse problema de `_SessionBind`
- Código já funciona com v1 (sistema vem de versão anterior)
- Solução rápida e comprovada

**Desvantagens**:
- Pydantic v1 está deprecated (EOL em 2024)
- Eventual migração para v2 será necessária

---

### 🥈 Solução B: Investigação profunda com debugger
**Viabilidade**: MÉDIA
**Tempo estimado**: 2-3 horas
**Impacto**: Médio

1. Adicionar logs de debug em cada import de schema
2. Usar Python debugger (pdb) para rastrear onde Optional não está definido
3. Identificar o arquivo/linha EXATA do problema
4. Corrigir especificamente esse ponto

**Comandos de debug**:
```python
import sys
print(f"Optional in globals: {'Optional' in globals()}")
print(f"Optional in dir(typing): {'Optional' in dir(__import__('typing'))}")
```

---

### 🥉 Solução C: Refatoração completa dos schemas
**Viabilidade**: BAIXA
**Tempo estimado**: 6-8 horas
**Impacto**: ALTO

1. Separar todos os schemas em arquivos independentes por domínio
2. Usar TYPE_CHECKING para imports condicionais
3. Aplicar `response_model=None` em TODOS os 15 endpoints
4. Converter todos os retornos para dict puro

**Exemplo**:
```python
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from typing import Optional
    from app.schemas.inventory_schemas import InventoryItem
```

---

## 📊 Arquivos Modificados Nesta Sessão

| Arquivo | Modificações | Status |
|---------|--------------|--------|
| `inventory.py` | Removido builtins inject, alterado response_model | ✅ Modificado |
| `inventory_lots.py` | Criado router temporário | ✅ Criado |
| `models.py` | Corrigido 8 relationships, removido duplicates | ✅ Corrigido |
| `schemas.py` | Adicionado aspas em 3 forward references | ✅ Corrigido |
| `inventory_schemas.py` | Adicionado/removido `from __future__` | ✅ Modificado |
| `counting_list_schemas.py` | Adicionado/removido `from __future__` | ✅ Modificado |
| `main.py` | Registrado lots_router temporário | ✅ Registrado |

**Total**: 7 arquivos modificados com ~100 alterações

---

## 🔄 Estado Atual do Sistema

**Versão**: v2.10.0-BLOCKED
**Progresso do Snapshot**: 95% completo

**Componentes Prontos**:
- ✅ SQL migrations (003_add_inventory_snapshot_tables.sql)
- ✅ Models de snapshot (InventoryItemSnapshot, InventoryLotSnapshot)
- ✅ SnapshotService com métodos create_item_snapshot() e create_lots_snapshots()
- ✅ Snapshots sendo criados corretamente (validado em SQL)
- ✅ Frontend com código para usar endpoint
- ✅ Documentação completa em PLANO_SNAPSHOT_INVENTARIO_v1.0.md

**Bloqueador Ativo**:
- ❌ Endpoint `/items/{item_id}/lots-snapshot` retorna 404
- ❌ Router não registra devido a erro Pydantic

---

## 🎬 Próximos Passos Imediatos

### Opção 1: Continuar investigação (2-3h adicionais)
1. Adicionar debug logging intensivo
2. Usar pdb para rastrear import chain
3. Identificar arquivo/linha exata do problema
4. **Risco**: Pode não resolver e consumir mais tempo

### Opção 2: Downgrade Pydantic (30min) ⭐ RECOMENDADO
1. `pip install "pydantic<2.0"` em requirements.txt
2. Rebuild containers
3. Testar registro dos routers
4. **Benefício**: Solução rápida e comprovada

### Opção 3: Workaround temporário (1h)
1. Manter apenas router lot_draft funcionando
2. Modificar frontend para NÃO buscar lotes de snapshot
3. Usar lotes direto de SB8010 (comportamento antigo)
4. **Benefício**: Sistema volta a funcionar sem snapshot de lotes

---

## 📞 Contato com Comunidade

Se optar por continuar investigação, considerar:
- Postar issue no GitHub do FastAPI
- Consultar Stack Overflow com erro específico
- Verificar issues conhecidos do Pydantic v2.5

**Link do erro**: https://errors.pydantic.dev/2.5/u/undefined-annotation

---

**Conclusão**: Após 12 tentativas de correção, o problema persiste de forma idêntica. A solução mais pragmática é o downgrade para Pydantic v1 ou investigação profunda com debugger Python.

**Decisão recomendada**: **Downgrade para Pydantic v1** para desbloquear desenvolvimento e planejar migração para v2 em sprint futuro.
