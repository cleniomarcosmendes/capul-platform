# Plano de Sincronização - API Protheus (v2.14.0)

**Data**: 23/10/2025
**Objetivo**: Implementar sincronização automática de cadastros básicos (hierarquia mercadológica) via API Protheus
**Tabelas Alvo**: SBM010, SZD010, SZE010, SZF010

---

## 🎯 Visão Geral

### **Contexto**
Sistema de inventário está em fase final de desenvolvimento com feedback positivo dos usuários. Próximo passo é eliminar importação manual de dados e migrar para **sincronização automática via API do ERP Protheus**.

### **Objetivo**
Criar sistema de sincronização que:
1. **Busca** dados da API Protheus (hierarquia mercadológica completa)
2. **Atualiza** registros existentes no PostgreSQL
3. **Insere** novos registros
4. **Remove (soft delete)** registros órfãos (existem no banco mas não na API)
5. **Fornece feedback** visual ao usuário sobre o processo

### **Tabelas de Destino**
| Tabela | Descrição | Campos PostgreSQL | Campos JSON | PK |
|--------|-----------|-------------------|-------------|-----|
| **SBM010** | Grupos de Produtos | `bm_filial`, `bm_grupo`, `bm_desc` | `bm_grupo`, `bm_desc` | `bm_filial + bm_grupo` |
| **SZD010** | Categorias | `zd_filial`, `zd_xcod`, `zd_xdesc` | `zd_xcod`, `zd_xdesc` | `zd_filial + zd_xcod` |
| **SZE010** | SubCategorias | `ze_filial`, `ze_xcod`, `ze_xdesc` | `ze_xcod`, `ze_xdesc` | `ze_filial + ze_xcod` |
| **SZF010** | Segmentos | `zf_filial`, `zf_xcod`, `zf_xdesc` | `zf_xcod`, `zf_xdesc` | `zf_filial + zf_xcod` |

**Observação**: Campo `filial` sempre vazio (tabelas compartilhadas entre todas as filiais)

---

## 📊 Análise Técnica

### **Estrutura do JSON da API Protheus**

**Endpoint**: `https://apiportal.capul.com.br:443/rest/api/INFOCLIENTES/hierarquiaMercadologica`
**Autenticação**: `Basic QVBJQ0FQVUw6QXAxQzRwdTFQUkQ=`

**Estrutura Hierárquica**:
```json
{
  "resultado": [
    {
      "bm_grupo": "0001",
      "bm_desc": "MEDICAMENTOS VETERINARIOS",
      "categoria": [
        {
          "zd_xcod": "0001",
          "zd_xdesc": "AGENER UNIAO QUIMICA",
          "subcategoria": [
            {
              "ze_xcod": "0005",
              "ze_xdesc": "EQUINOS",
              "segmento": [
                {
                  "zf_xcod": "580068",
                  "zf_xdesc": "ANESTESICO 02"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

**Características**:
- ✅ JSON hierárquico (Grupo → Categoria → Subcategoria → Segmento)
- ✅ 1 Grupo contém N Categorias
- ✅ 1 Categoria contém N Subcategorias
- ✅ 1 Subcategoria contém N Segmentos
- ❌ Não possui campo `filial` (usar string vazia)

### **Estrutura das Tabelas PostgreSQL**

**Campos Comuns**:
- `{prefix}_filial`: VARCHAR(10) - Sempre vazio (tabelas compartilhadas)
- `{prefix}_xcod` ou `{prefix}_grupo`: VARCHAR - Código único (PK)
- `{prefix}_desc` ou `{prefix}_xdesc`: VARCHAR - Descrição
- `created_at`: TIMESTAMP - Data de criação
- `updated_at`: TIMESTAMP - Data da última atualização
- `is_active`: BOOLEAN - Soft delete (true = ativo, false = inativo/órfão)

**Chaves Primárias**:
- SBM010: (`bm_filial`, `bm_grupo`)
- SZD010: (`zd_filial`, `zd_xcod`)
- SZE010: (`ze_filial`, `ze_xcod`)
- SZF010: (`zf_filial`, `zf_xcod`)

---

## 🏗️ Arquitetura da Solução

### **Fluxo de Sincronização**

```
┌─────────────────┐
│  USUÁRIO        │
│  (Frontend)     │
└────────┬────────┘
         │ 1. Clica "Sincronizar Dados"
         ▼
┌─────────────────────────────────────┐
│  BACKEND (FastAPI)                  │
│  /api/v1/sync/protheus/hierarchy    │
└────────┬────────────────────────────┘
         │ 2. Chama API Protheus
         ▼
┌─────────────────────────────────────┐
│  API PROTHEUS                       │
│  /rest/api/.../hierarquiaMercadologica │
└────────┬────────────────────────────┘
         │ 3. Retorna JSON hierárquico
         ▼
┌─────────────────────────────────────┐
│  BACKEND - Processamento            │
│  • Achatar JSON hierárquico         │
│  • Comparar com banco               │
│  • UPDATE existentes                │
│  • INSERT novos                     │
│  • DELETE órfãos (soft)             │
└────────┬────────────────────────────┘
         │ 4. Retorna relatório
         ▼
┌─────────────────┐
│  FRONTEND       │
│  Exibe resultado│
└─────────────────┘
```

### **Lógica de Sincronização (UPDATE + INSERT + DELETE)**

**1. FETCH (Buscar dados da API)**:
```python
async def fetch_protheus_hierarchy():
    response = requests.get(
        "https://apiportal.capul.com.br:443/rest/api/INFOCLIENTES/hierarquiaMercadologica",
        headers={"Authorization": "Basic QVBJQ0FQVUw6QXAxQzRwdTFQUkQ="},
        timeout=30
    )
    return response.json()["resultado"]
```

**2. FLATTEN (Achatar hierarquia)**:
```python
def flatten_hierarchy(data):
    grupos = []
    categorias = []
    subcategorias = []
    segmentos = []

    for grupo in data:
        grupos.append({"bm_grupo": grupo["bm_grupo"], "bm_desc": grupo["bm_desc"]})

        for cat in grupo.get("categoria", []):
            categorias.append({"zd_xcod": cat["zd_xcod"], "zd_xdesc": cat["zd_xdesc"]})

            for sub in cat.get("subcategoria", []):
                subcategorias.append({"ze_xcod": sub["ze_xcod"], "ze_xdesc": sub["ze_xdesc"]})

                for seg in sub.get("segmento", []):
                    segmentos.append({"zf_xcod": seg["zf_xcod"], "zf_xdesc": seg["zf_xdesc"]})

    return grupos, categorias, subcategorias, segmentos
```

**3. SYNC (Sincronizar com banco)**:
```python
async def sync_table(db: Session, table_name: str, api_records: list, code_field: str, desc_field: str):
    stats = {"inserted": 0, "updated": 0, "deleted": 0, "unchanged": 0}

    # Buscar registros existentes
    existing = db.execute(f"SELECT {code_field}, {desc_field}, is_active FROM {table_name}").fetchall()
    existing_codes = {r[code_field]: r for r in existing}
    api_codes = {r[code_field]: r for r in api_records}

    # INSERT: Novos na API mas não no banco
    for code, record in api_codes.items():
        if code not in existing_codes:
            db.execute(f"""
                INSERT INTO inventario.{table_name} ({code_field}, {desc_field}, filial, is_active, created_at)
                VALUES (:code, :desc, '', true, NOW())
            """, {"code": code, "desc": record[desc_field]})
            stats["inserted"] += 1

    # UPDATE: Existem em ambos (atualizar descrição se mudou)
    for code in set(existing_codes.keys()) & set(api_codes.keys()):
        old_record = existing_codes[code]
        new_record = api_codes[code]

        if old_record[desc_field] != new_record[desc_field] or not old_record["is_active"]:
            db.execute(f"""
                UPDATE inventario.{table_name}
                SET {desc_field} = :desc, is_active = true, updated_at = NOW()
                WHERE {code_field} = :code
            """, {"code": code, "desc": new_record[desc_field]})
            stats["updated"] += 1
        else:
            stats["unchanged"] += 1

    # DELETE (soft): Existem no banco mas não na API
    for code in set(existing_codes.keys()) - set(api_codes.keys()):
        if existing_codes[code]["is_active"]:
            db.execute(f"""
                UPDATE inventario.{table_name}
                SET is_active = false, updated_at = NOW()
                WHERE {code_field} = :code
            """, {"code": code})
            stats["deleted"] += 1

    db.commit()
    return stats
```

---

## 🛠️ Implementação

### **ETAPA 1: Backend - Endpoint de Sincronização**

**Arquivo**: `backend/app/api/v1/endpoints/sync_protheus.py` (NOVO)

**Endpoint**: `POST /api/v1/sync/protheus/hierarchy`

**Funcionalidades**:
- ✅ Buscar dados da API Protheus (com retry em caso de falha)
- ✅ Achatar estrutura hierárquica em 4 listas planas
- ✅ Sincronizar cada tabela (SBM010, SZD010, SZE010, SZF010)
- ✅ Retornar estatísticas detalhadas (inserted, updated, deleted, unchanged)
- ✅ Logs detalhados de cada operação
- ✅ Tratamento de erros (timeout, auth error, JSON parsing)

**Response Schema**:
```json
{
  "success": true,
  "timestamp": "2025-10-23T18:30:00",
  "duration_seconds": 3.5,
  "tables": {
    "SBM010": {
      "inserted": 5,
      "updated": 12,
      "deleted": 2,
      "unchanged": 150,
      "total_api": 167,
      "total_db_after": 165
    },
    "SZD010": { ... },
    "SZE010": { ... },
    "SZF010": { ... }
  },
  "totals": {
    "inserted": 25,
    "updated": 48,
    "deleted": 10,
    "unchanged": 800
  }
}
```

**Código Exemplo**:
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import requests
import logging
from datetime import datetime

router = APIRouter()
logger = logging.getLogger(__name__)

PROTHEUS_API_URL = "https://apiportal.capul.com.br:443/rest/api/INFOCLIENTES/hierarquiaMercadologica"
PROTHEUS_AUTH = "Basic QVBJQ0FQVUw6QXAxQzRwdTFQUkQ="

@router.post("/sync/protheus/hierarchy")
async def sync_protheus_hierarchy(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)  # ✅ Validação JWT
):
    # ✅ RBAC: Apenas ADMIN e SUPERVISOR podem sincronizar
    if current_user.role not in ["ADMIN", "SUPERVISOR"]:
        raise HTTPException(
            status_code=403,
            detail="Acesso negado. Apenas ADMIN e SUPERVISOR podem executar sincronização."
        )

    logger.info(f"🔄 Sincronização iniciada por {current_user.username} (role: {current_user.role})")
    start_time = datetime.now()

    try:
        # 1. Buscar dados da API
        logger.info("🔄 Iniciando sincronização com API Protheus...")
        response = requests.get(
            PROTHEUS_API_URL,
            headers={"Authorization": PROTHEUS_AUTH},
            timeout=30
        )
        response.raise_for_status()
        data = response.json()["resultado"]

        # 2. Achatar hierarquia
        grupos, categorias, subcategorias, segmentos = flatten_hierarchy(data)

        # 3. Sincronizar cada tabela
        sbm_stats = await sync_table(db, "sbm010", grupos, "bm_grupo", "bm_desc")
        szd_stats = await sync_table(db, "szd010", categorias, "zd_xcod", "zd_xdesc")
        sze_stats = await sync_table(db, "sze010", subcategorias, "ze_xcod", "ze_xdesc")
        szf_stats = await sync_table(db, "szf010", segmentos, "zf_xcod", "zf_xdesc")

        # 4. Calcular totais
        totals = {
            "inserted": sbm_stats["inserted"] + szd_stats["inserted"] + sze_stats["inserted"] + szf_stats["inserted"],
            "updated": sbm_stats["updated"] + szd_stats["updated"] + sze_stats["updated"] + szf_stats["updated"],
            "deleted": sbm_stats["deleted"] + szd_stats["deleted"] + sze_stats["deleted"] + szf_stats["deleted"],
            "unchanged": sbm_stats["unchanged"] + szd_stats["unchanged"] + sze_stats["unchanged"] + szf_stats["unchanged"]
        }

        duration = (datetime.now() - start_time).total_seconds()

        logger.info(f"✅ Sincronização concluída em {duration:.2f}s - {totals}")

        return {
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "duration_seconds": duration,
            "tables": {
                "SBM010": sbm_stats,
                "SZD010": szd_stats,
                "SZE010": sze_stats,
                "SZF010": szf_stats
            },
            "totals": totals
        }

    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Timeout ao conectar com API Protheus")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Erro ao buscar dados: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Erro na sincronização: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")
```

---

### **ETAPA 2: Frontend - Interface de Sincronização**

**Opção A**: **Adaptar página existente** `frontend/import.html`
**Opção B**: **Criar nova página** `frontend/sync_protheus.html`

**Recomendação**: **Opção A** (adaptar import.html)

**Modificações**:
1. **Adicionar seção "Sincronização API Protheus"** acima das tabelas de importação
2. **Botão principal**: "🔄 Sincronizar com Protheus"
3. **Modal de progresso** com barra animada
4. **Tabela de resultados** (4 linhas, 1 por tabela)
5. **Log de operações** em tempo real

**Layout Proposto**:
```html
<!-- Seção de Sincronização API (NOVO) -->
<!-- ✅ ID para controle de visibilidade via JavaScript (RBAC) -->
<div class="row mb-5" id="syncProtheusSection" style="display: none;">
    <div class="col-12">
        <div class="card border-primary">
            <div class="card-header bg-primary text-white">
                <h4 class="mb-0">
                    <i class="bi bi-cloud-arrow-down me-2"></i>
                    Sincronização Automática - API Protheus
                </h4>
            </div>
            <div class="card-body">
                <div class="alert alert-info">
                    <i class="bi bi-info-circle me-2"></i>
                    <strong>Sincronização inteligente:</strong> Busca dados diretamente do ERP Protheus,
                    atualiza registros existentes e remove cadastros órfãos automaticamente.
                </div>

                <div class="row mb-3">
                    <div class="col-md-8">
                        <h6>Tabelas que serão sincronizadas:</h6>
                        <ul class="list-unstyled">
                            <li><i class="bi bi-check-circle text-success"></i> <strong>SBM010</strong> - Grupos de Produtos</li>
                            <li><i class="bi bi-check-circle text-success"></i> <strong>SZD010</strong> - Categorias</li>
                            <li><i class="bi bi-check-circle text-success"></i> <strong>SZE010</strong> - SubCategorias</li>
                            <li><i class="bi bi-check-circle text-success"></i> <strong>SZF010</strong> - Segmentos</li>
                        </ul>
                    </div>
                    <div class="col-md-4 text-end">
                        <button class="btn btn-primary btn-lg" onclick="syncProtheusHierarchy()">
                            <i class="bi bi-cloud-arrow-down me-2"></i>
                            Sincronizar Agora
                        </button>
                        <small class="d-block text-muted mt-2">
                            <i class="bi bi-clock"></i> Última sincronização: <span id="lastSync">Nunca</span>
                        </small>
                    </div>
                </div>

                <!-- Tabela de Resultados (oculta inicialmente) -->
                <div id="syncResultsContainer" style="display: none;">
                    <hr>
                    <h6>Resultados da Sincronização:</h6>
                    <table class="table table-bordered table-sm">
                        <thead class="table-light">
                            <tr>
                                <th>Tabela</th>
                                <th class="text-center">Inseridos</th>
                                <th class="text-center">Atualizados</th>
                                <th class="text-center">Removidos</th>
                                <th class="text-center">Inalterados</th>
                                <th class="text-center">Total API</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody id="syncResultsTable">
                            <!-- Preenchido via JavaScript -->
                        </tbody>
                    </table>

                    <div class="alert alert-success" id="syncSuccessMessage">
                        <!-- Preenchido via JavaScript -->
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
```

**JavaScript**:
```javascript
// ✅ Controle de visibilidade baseado em RBAC
document.addEventListener('DOMContentLoaded', function() {
    const userRole = localStorage.getItem('user_role'); // Assume que role está salvo no login
    const syncSection = document.getElementById('syncProtheusSection');

    // Exibir seção apenas para ADMIN e SUPERVISOR
    if (userRole === 'ADMIN' || userRole === 'SUPERVISOR') {
        syncSection.style.display = 'block';
    } else {
        syncSection.style.display = 'none'; // OPERATOR não vê a seção
    }
});

async function syncProtheusHierarchy() {
    // Confirmar ação
    const confirm = await Swal.fire({
        title: 'Sincronizar com Protheus?',
        html: `
            Esta operação irá:<br><br>
            ✅ Buscar dados atualizados do ERP Protheus<br>
            ✅ Atualizar registros existentes<br>
            ✅ Inserir novos cadastros<br>
            ⚠️ Remover (desativar) registros órfãos<br><br>
            <strong>Deseja continuar?</strong>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sim, sincronizar',
        cancelButtonText: 'Cancelar'
    });

    if (!confirm.isConfirmed) return;

    // Mostrar loading
    Swal.fire({
        title: 'Sincronizando...',
        html: 'Aguarde enquanto buscamos os dados do Protheus...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        // Chamar API de sincronização
        const response = await fetch('/api/v1/sync/protheus/hierarchy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        // Fechar loading
        Swal.close();

        // Exibir resultados
        displaySyncResults(result);

        // Atualizar timestamp
        document.getElementById('lastSync').textContent = new Date().toLocaleString('pt-BR');

        // Sucesso
        Swal.fire({
            title: 'Sincronização Concluída!',
            html: `
                <div class="text-start">
                    <p><strong>Estatísticas gerais:</strong></p>
                    <ul>
                        <li>✅ Inseridos: <strong>${result.totals.inserted}</strong></li>
                        <li>🔄 Atualizados: <strong>${result.totals.updated}</strong></li>
                        <li>🗑️ Removidos: <strong>${result.totals.deleted}</strong></li>
                        <li>📊 Inalterados: <strong>${result.totals.unchanged}</strong></li>
                    </ul>
                    <p><small>Duração: ${result.duration_seconds.toFixed(2)}s</small></p>
                </div>
            `,
            icon: 'success',
            confirmButtonText: 'OK'
        });

    } catch (error) {
        console.error('Erro na sincronização:', error);
        Swal.fire({
            title: 'Erro na Sincronização',
            text: `Não foi possível sincronizar: ${error.message}`,
            icon: 'error',
            confirmButtonText: 'OK'
        });
    }
}

function displaySyncResults(result) {
    const container = document.getElementById('syncResultsContainer');
    const tbody = document.getElementById('syncResultsTable');
    const successMsg = document.getElementById('syncSuccessMessage');

    // Limpar tabela
    tbody.innerHTML = '';

    // Preencher cada linha
    const tables = ['SBM010', 'SZD010', 'SZE010', 'SZF010'];
    tables.forEach(tableName => {
        const stats = result.tables[tableName];
        const totalDb = stats.inserted + stats.updated + stats.unchanged;

        const row = `
            <tr>
                <td><strong>${tableName}</strong></td>
                <td class="text-center"><span class="badge bg-success">${stats.inserted}</span></td>
                <td class="text-center"><span class="badge bg-info">${stats.updated}</span></td>
                <td class="text-center"><span class="badge bg-warning text-dark">${stats.deleted}</span></td>
                <td class="text-center"><span class="badge bg-secondary">${stats.unchanged}</span></td>
                <td class="text-center"><strong>${stats.total_api}</strong></td>
                <td><i class="bi bi-check-circle text-success"></i> Sincronizado</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });

    // Mensagem de sucesso
    successMsg.innerHTML = `
        <i class="bi bi-check-circle me-2"></i>
        <strong>Sincronização concluída com sucesso!</strong><br>
        <small>Total de registros processados: <strong>${result.totals.inserted + result.totals.updated + result.totals.unchanged}</strong> |
        Duração: <strong>${result.duration_seconds.toFixed(2)}s</strong></small>
    `;

    // Exibir container
    container.style.display = 'block';
}
```

---

### **ETAPA 3: Configuração e Segurança**

**1. Armazenar credenciais de forma segura**:
```python
# backend/app/core/config.py
class Settings(BaseSettings):
    # ... configurações existentes ...

    # API Protheus
    PROTHEUS_API_URL: str = "https://apiportal.capul.com.br:443/rest/api/INFOCLIENTES/hierarquiaMercadologica"
    PROTHEUS_API_AUTH: str = "Basic QVBJQ0FQVUw6QXAxQzRwdTFQUkQ="
    PROTHEUS_API_TIMEOUT: int = 30

    class Config:
        env_file = ".env"
```

**2. Variáveis de ambiente** (`.env`):
```env
PROTHEUS_API_URL=https://apiportal.capul.com.br:443/rest/api/INFOCLIENTES/hierarquiaMercadologica
PROTHEUS_API_AUTH=Basic QVBJQ0FQVUw6QXAxQzRwdTFQUkQ=
PROTHEUS_API_TIMEOUT=30
```

**3. Controle de acesso (RBAC)**:
- ✅ Usuários **ADMIN** e **SUPERVISOR** podem executar sincronização
- ✅ Usuários **OPERATOR** NÃO têm acesso (apenas visualização)
- ✅ Validar token JWT no endpoint
- ✅ Registrar log de auditoria (quem executou, quando, resultado)

---

## 🧪 Plano de Testes

### **Teste 1: Sincronização Completa (Fresh Install)**
1. Limpar todas as 4 tabelas (`DELETE FROM inventario.sbm010 WHERE true`)
2. Executar sincronização
3. Verificar:
   - ✅ Todos registros inseridos (inserted > 0)
   - ✅ Nenhum atualizado ou deletado
   - ✅ Campos `created_at` populados
   - ✅ `is_active = true` em todos

### **Teste 2: Sincronização Incremental (Atualizar)**
1. Modificar descrição de 1 registro manualmente no banco
2. Executar sincronização
3. Verificar:
   - ✅ 1 registro atualizado (descrição volta ao original)
   - ✅ Campo `updated_at` atualizado
   - ✅ Demais registros inalterados

### **Teste 3: Detecção de Órfãos (Soft Delete)**
1. Inserir registro fake manualmente (`bm_grupo = 'FAKE999'`)
2. Executar sincronização
3. Verificar:
   - ✅ 1 registro deletado (soft delete)
   - ✅ `is_active = false` no registro fake
   - ✅ Registro ainda existe no banco (não foi deletado fisicamente)

### **Teste 4: Tratamento de Erros**
1. **Timeout**: Simular API lenta (timeout < 1s)
   - Esperado: HTTP 504 + mensagem clara
2. **Auth Error**: Usar credenciais inválidas
   - Esperado: HTTP 401/403 + mensagem clara
3. **JSON Inválido**: Simular resposta malformada
   - Esperado: HTTP 500 + mensagem "Erro ao processar resposta"

### **Teste 5: Performance**
1. Medir tempo de sincronização completa
2. Verificar se < 10 segundos (baseline)
3. Otimizar se necessário (batch inserts, transações)

---

## 📋 Checklist de Implementação

### **Backend** (`backend/app/api/v1/endpoints/sync_protheus.py`)
- [ ] Criar arquivo novo `sync_protheus.py`
- [ ] Implementar função `fetch_protheus_hierarchy()` (GET na API)
- [ ] Implementar função `flatten_hierarchy()` (achatar JSON)
- [ ] Implementar função `sync_table()` (UPDATE + INSERT + DELETE)
- [ ] Criar endpoint `POST /api/v1/sync/protheus/hierarchy`
- [ ] Adicionar validação RBAC (ADMIN e SUPERVISOR)
- [ ] Adicionar tratamento de erros (timeout, auth, JSON parsing)
- [ ] Adicionar logging detalhado
- [ ] Registrar no router principal (`backend/app/main.py`)

### **Frontend** (`frontend/import.html`)
- [ ] Adicionar seção "Sincronização API Protheus" acima das tabelas
- [ ] Criar botão "Sincronizar Agora" com ícone
- [ ] Implementar função `syncProtheusHierarchy()` (JavaScript)
- [ ] Criar modal de confirmação (SweetAlert2)
- [ ] Criar modal de progresso (loading)
- [ ] Criar tabela de resultados (4 linhas, 6 colunas)
- [ ] Implementar função `displaySyncResults()` (preencher tabela)
- [ ] Adicionar timestamp "Última sincronização"
- [ ] Adicionar controle de acesso (exibir apenas para ADMIN e SUPERVISOR)

### **Configuração**
- [ ] Adicionar variáveis de ambiente em `.env`
- [ ] Atualizar `backend/app/core/config.py` com novas settings
- [ ] Documentar credenciais de forma segura

### **Testes**
- [ ] Executar Teste 1: Fresh Install
- [ ] Executar Teste 2: Atualizar existentes
- [ ] Executar Teste 3: Soft delete órfãos
- [ ] Executar Teste 4: Tratamento de erros
- [ ] Executar Teste 5: Performance

### **Documentação**
- [ ] Atualizar `CLAUDE.md` com feature v2.14.0
- [ ] Criar `GUIA_SINCRONIZACAO_PROTHEUS.md` para usuários
- [ ] Documentar endpoint no Swagger/Redoc

---

## 📚 Referências

- **API Protheus**: `https://apiportal.capul.com.br:443/rest/api/INFOCLIENTES/hierarquiaMercadologica`
- **JSON de Exemplo**: `/mnt/c/meus_projetos/Capul_Inventario/Diego/Diego_hierarquiaMercadologica.json`
- **Página de Importação Atual**: `frontend/import.html`
- **Tabelas PostgreSQL**: `inventario.sbm010`, `inventario.szd010`, `inventario.sze010`, `inventario.szf010`

---

## 🎯 Próximos Passos (Futuro)

Após implementação das 4 tabelas de hierarquia, considerar:
1. **Sincronizar outras tabelas**: SB1010, SB2010, SB8010, SBZ010
2. **Agendamento automático**: Cron job para sincronizar diariamente
3. **Histórico de sincronizações**: Tabela de auditoria com logs
4. **Notificações**: Email/SMS quando houver muitas mudanças
5. **Dashboard de monitoramento**: Gráficos de evolução dos dados

---

**Status**: 📝 **PLANEJADO** - Pronto para implementação
**Estimativa**: 1 dia de desenvolvimento + 0.5 dia de testes
**Prioridade**: ⭐⭐⭐ **ALTA** (elimina importação manual)
