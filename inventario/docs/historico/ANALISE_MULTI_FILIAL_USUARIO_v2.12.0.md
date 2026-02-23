# ANÁLISE E PLANO: Sistema Multi-Filial por Usuário v2.12.0

**Data**: 20/10/2025
**Versão**: 2.12.0
**Status**: 📋 EM ANÁLISE - Aguardando aprovação

---

## 📋 1. RESUMO DA PROPOSTA

### Objetivo
Permitir que **um usuário acesse múltiplas filiais**, selecionando qual filial deseja trabalhar no momento do login.

### Proposta do Usuário
1. **Cadastro de Usuário**: Adicionar listbox com todas as filiais, permitindo seleção múltipla
2. **Tela de Login**: Após validar credenciais, mostrar listbox com filiais que o usuário tem permissão
3. **Seleção de Filial**: Usuário escolhe qual filial acessar naquela sessão
4. **Variável de Sistema**: Preencher `store_id` na sessão mantendo lógica atual

---

## 🔍 2. ANÁLISE DA ESTRUTURA ATUAL

### 2.1 Banco de Dados

#### Modelo User (models.py:81-104)
```python
class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "inventario"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100))
    role = Column(Enum(UserRole), nullable=False, default=UserRole.OPERATOR)
    store_id = Column(UUID(as_uuid=True), ForeignKey("inventario.stores.id"))  # ⚠️ FK ÚNICA
    is_active = Column(Boolean, nullable=False, default=True)
    # ...

    # Relacionamento 1:1 com Store
    store = relationship("Store", back_populates="users")
```

**Limitação Atual**: Campo `store_id` permite apenas **UMA loja por usuário** (FK direta)

#### Modelo Store (models.py:55-75)
```python
class Store(Base):
    __tablename__ = "stores"
    __table_args__ = {"schema": "inventario"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(10), nullable=False, unique=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    address = Column(String(200))
    is_active = Column(Boolean, nullable=False, default=True)
    # ...
```

---

### 2.2 Fluxo de Autenticação Atual

#### Token JWT (security.py:193-207)
```python
def create_user_tokens(user) -> Dict[str, str]:
    """Cria tokens de acesso para usuário"""
    token_data = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role,
        "store_id": str(user.store_id) if user.store_id else None  # ⚠️ Store vem do User
    }

    access_token = create_access_token(token_data)

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }
```

**Problema**: `store_id` é extraído direto do usuário no momento de gerar o token

#### Frontend (login.html:533-561)
```javascript
async function fetchUserData(token) {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const userData = await response.json();

    // Salvar dados do usuário
    localStorage.setItem('user_data', JSON.stringify(userData));
    localStorage.setItem('user_name', userData.full_name || userData.username);
    localStorage.setItem('user_role', userData.role);
    localStorage.setItem('store_id', userData.store_id || '');  // ⚠️ Store única

    return userData;
}
```

**Problema**: Frontend salva apenas uma `store_id`, assumindo que usuário tem apenas uma loja

---

### 2.3 Uso do store_id no Sistema

#### Filtro por Loja (stores.py:20-66)
```python
@router.get("/", summary="Listar lojas")
async def list_stores(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "ADMIN":
        stores = db.query(Store).filter(Store.is_active == True).all()  # ✅ Admin vê todas
    else:
        stores = db.query(Store).filter(
            Store.id == current_user.store_id,  # ⚠️ Filtro por store_id do User
            Store.is_active == True
        ).all()
    # ...
```

**Impacto**: TODOS os endpoints usam `current_user.store_id` para filtrar dados

---

## ✅ 3. VIABILIDADE DA PROPOSTA

### 3.1 Resposta Direta
**SIM, É TOTALMENTE VIÁVEL!** ✅

A proposta está **correta e bem estruturada**. Não impacta a lógica atual porque:
- Sistema continuará usando `store_id` como identificador da filial ativa
- Mudança é apenas na **origem** do `store_id` (da sessão em vez do cadastro do usuário)

---

## 🎯 4. PLANO DE IMPLEMENTAÇÃO

### 4.1 Fase 1: Banco de Dados (Migração)

#### 4.1.1 Nova Tabela Intermediária
Criar tabela `user_stores` para relacionamento N:N

```sql
-- Migration: database/migrations/003_multi_store_users.sql

CREATE TABLE inventario.user_stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES inventario.users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES inventario.stores(id) ON DELETE CASCADE,
    is_default BOOLEAN DEFAULT FALSE,  -- Loja padrão do usuário
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES inventario.users(id),

    -- Constraints
    CONSTRAINT user_stores_unique UNIQUE (user_id, store_id),
    CONSTRAINT user_stores_one_default CHECK (
        -- Apenas uma loja padrão por usuário (validado via trigger)
        TRUE
    )
);

-- Índices para performance
CREATE INDEX idx_user_stores_user ON inventario.user_stores(user_id);
CREATE INDEX idx_user_stores_store ON inventario.user_stores(store_id);
CREATE INDEX idx_user_stores_default ON inventario.user_stores(user_id, is_default);

-- Trigger: Garantir apenas uma loja padrão por usuário
CREATE OR REPLACE FUNCTION inventario.enforce_single_default_store()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = TRUE THEN
        -- Desmarcar outras lojas padrão do mesmo usuário
        UPDATE inventario.user_stores
        SET is_default = FALSE
        WHERE user_id = NEW.user_id AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_enforce_single_default_store
BEFORE INSERT OR UPDATE ON inventario.user_stores
FOR EACH ROW
EXECUTE FUNCTION inventario.enforce_single_default_store();

-- Comentários
COMMENT ON TABLE inventario.user_stores IS 'Relacionamento N:N entre usuários e lojas/filiais';
COMMENT ON COLUMN inventario.user_stores.is_default IS 'Loja padrão sugerida no login (apenas uma por usuário)';
```

#### 4.1.2 Migração de Dados Existentes
Migrar dados atuais de `users.store_id` para `user_stores`

```sql
-- Migration: database/migrations/004_migrate_existing_stores.sql

-- Migrar store_id existentes para user_stores
INSERT INTO inventario.user_stores (user_id, store_id, is_default)
SELECT
    id AS user_id,
    store_id,
    TRUE AS is_default  -- Store atual vira padrão
FROM inventario.users
WHERE store_id IS NOT NULL;

-- Logs
DO $$
DECLARE
    migrated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO migrated_count FROM inventario.user_stores;
    RAISE NOTICE 'Migrados % registros de users.store_id para user_stores', migrated_count;
END $$;
```

#### 4.1.3 Ajuste na Tabela Users (OPCIONAL)
**IMPORTANTE**: Mantemos `store_id` por compatibilidade durante transição

```sql
-- OPÇÃO 1: Manter store_id (RECOMENDADO para transição gradual)
-- Não fazer nada, manter coluna por compatibilidade

-- OPÇÃO 2: Depreciar store_id (Apenas após 100% migrado)
-- ALTER TABLE inventario.users ALTER COLUMN store_id DROP NOT NULL;
-- COMMENT ON COLUMN inventario.users.store_id IS 'DEPRECATED: Use user_stores table';
```

**Recomendação**: Manter `store_id` como **loja padrão** na Fase 1, remover apenas na Fase 3 (após testes completos)

---

### 4.2 Fase 2: Backend (Modelos e Endpoints)

#### 4.2.1 Novo Modelo UserStore
Adicionar em `backend/app/models/models.py`

```python
# =================================
# MODELO: USER_STORE (v2.12.0)
# =================================

class UserStore(Base):
    """
    Relacionamento N:N entre usuários e lojas/filiais.
    Permite que um usuário acesse múltiplas lojas.
    """
    __tablename__ = "user_stores"
    __table_args__ = {"schema": "inventario"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id", ondelete="CASCADE"), nullable=False)
    store_id = Column(UUID(as_uuid=True), ForeignKey("inventario.stores.id", ondelete="CASCADE"), nullable=False)
    is_default = Column(Boolean, default=False)  # Loja padrão do usuário
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("inventario.users.id"))

    # Relacionamentos
    user = relationship("User", back_populates="user_stores")
    store = relationship("Store", back_populates="user_stores")
    created_by_user = relationship("User", foreign_keys=[created_by])

# Atualizar modelo User
class User(Base):
    # ... (campos existentes)

    # NOVO: Relacionamento N:N com lojas
    user_stores = relationship("UserStore", back_populates="user", cascade="all, delete-orphan")

    # NOVO: Property para obter lista de lojas do usuário
    @property
    def stores(self):
        """Retorna lista de lojas que o usuário tem acesso"""
        return [us.store for us in self.user_stores]

    @property
    def default_store_id(self):
        """Retorna ID da loja padrão do usuário"""
        default = next((us.store_id for us in self.user_stores if us.is_default), None)
        return default or (self.user_stores[0].store_id if self.user_stores else None)

# Atualizar modelo Store
class Store(Base):
    # ... (campos existentes)

    # NOVO: Relacionamento N:N com usuários
    user_stores = relationship("UserStore", back_populates="store", cascade="all, delete-orphan")
```

#### 4.2.2 Novos Endpoints (users.py)

```python
# =================================
# ENDPOINT: Obter lojas do usuário
# =================================

@router.get("/users/{user_id}/stores")
async def get_user_stores(
    user_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retorna todas as lojas que o usuário tem permissão de acessar

    **Regras de Acesso:**
    - ADMIN: Pode consultar qualquer usuário
    - SUPERVISOR/OPERATOR: Pode consultar apenas a si mesmo
    """
    # Validar permissão
    if current_user.role != "ADMIN" and str(current_user.id) != user_id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Buscar usuário
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # Buscar lojas do usuário
    user_stores = db.query(UserStore).filter(
        UserStore.user_id == user_id
    ).all()

    stores = []
    for us in user_stores:
        store = db.query(Store).filter(Store.id == us.store_id).first()
        if store:
            stores.append({
                "id": str(store.id),
                "code": store.code,
                "name": store.name,
                "is_default": us.is_default
            })

    return {
        "success": True,
        "data": stores
    }

# =================================
# ENDPOINT: Atualizar lojas do usuário
# =================================

@router.put("/users/{user_id}/stores")
async def update_user_stores(
    user_id: str,
    stores_data: dict,  # { "store_ids": ["uuid1", "uuid2"], "default_store_id": "uuid1" }
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Atualiza as lojas que o usuário tem acesso

    **Payload:**
    ```json
    {
        "store_ids": ["uuid1", "uuid2", "uuid3"],
        "default_store_id": "uuid1"  // Opcional
    }
    ```
    """
    # Validar permissão (apenas ADMIN pode alterar)
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Apenas administradores podem alterar lojas")

    # Buscar usuário
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # Se usuário é ADMIN, não deve ter lojas
    if user.role == "ADMIN":
        raise HTTPException(status_code=400, detail="Usuários ADMIN não devem ter lojas atribuídas")

    store_ids = stores_data.get("store_ids", [])
    default_store_id = stores_data.get("default_store_id")

    # Validar que ao menos uma loja foi selecionada
    if not store_ids:
        raise HTTPException(status_code=400, detail="Selecione ao menos uma loja")

    # Validar que lojas existem
    stores = db.query(Store).filter(Store.id.in_(store_ids)).all()
    if len(stores) != len(store_ids):
        raise HTTPException(status_code=400, detail="Uma ou mais lojas não encontradas")

    # Validar loja padrão
    if default_store_id and default_store_id not in store_ids:
        raise HTTPException(status_code=400, detail="Loja padrão deve estar na lista de lojas")

    # Remover lojas antigas
    db.query(UserStore).filter(UserStore.user_id == user_id).delete()

    # Adicionar novas lojas
    for store_id in store_ids:
        user_store = UserStore(
            user_id=user_id,
            store_id=store_id,
            is_default=(store_id == default_store_id) if default_store_id else (store_id == store_ids[0]),
            created_by=current_user.id
        )
        db.add(user_store)

    db.commit()

    return {
        "success": True,
        "message": f"{len(store_ids)} lojas atribuídas ao usuário"
    }
```

#### 4.2.3 Novo Endpoint de Login com Seleção de Filial

```python
# Em backend/app/main.py ou backend/app/api/auth.py

# =================================
# ENDPOINT: Validar credenciais (Etapa 1 do login)
# =================================

@app.post("/api/v1/auth/validate-credentials")
async def validate_credentials(credentials: dict, db: Session = Depends(get_db)):
    """
    Valida credenciais e retorna lojas disponíveis para o usuário.
    NÃO gera token ainda, apenas valida username/password.

    **Payload:**
    ```json
    {
        "username": "operador1",
        "password": "123456"
    }
    ```

    **Response:**
    ```json
    {
        "success": true,
        "user_id": "uuid-do-usuario",
        "username": "operador1",
        "full_name": "Operador 1",
        "role": "OPERATOR",
        "stores": [
            {"id": "uuid1", "code": "01", "name": "Matriz", "is_default": true},
            {"id": "uuid2", "code": "02", "name": "Filial 1", "is_default": false}
        ]
    }
    ```
    """
    username = credentials.get("username")
    password = credentials.get("password")

    # Autenticar usuário
    user = authenticate_user(db, username, password)
    if not user:
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    # Buscar lojas do usuário
    if user.role == "ADMIN":
        # Admin não tem lojas específicas (acessa todas)
        stores = []
    else:
        user_stores = db.query(UserStore).filter(UserStore.user_id == user.id).all()
        stores = []
        for us in user_stores:
            store = db.query(Store).filter(Store.id == us.store_id).first()
            if store:
                stores.append({
                    "id": str(store.id),
                    "code": store.code,
                    "name": store.name,
                    "is_default": us.is_default
                })

    return {
        "success": True,
        "user_id": str(user.id),
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "stores": stores
    }

# =================================
# ENDPOINT: Login com Filial (Etapa 2 do login)
# =================================

@app.post("/api/v1/auth/login-with-store")
async def login_with_store(login_data: dict, db: Session = Depends(get_db)):
    """
    Gera token JWT com filial selecionada pelo usuário.

    **Payload:**
    ```json
    {
        "user_id": "uuid-do-usuario",
        "store_id": "uuid-da-loja-selecionada"
    }
    ```

    **Response:**
    ```json
    {
        "access_token": "jwt-token-here",
        "token_type": "bearer",
        "user": { ... },
        "store": { ... }
    }
    ```
    """
    user_id = login_data.get("user_id")
    store_id = login_data.get("store_id")

    # Buscar usuário
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuário inválido ou inativo")

    # Validar que usuário tem acesso à loja selecionada
    if user.role != "ADMIN":
        user_store = db.query(UserStore).filter(
            UserStore.user_id == user_id,
            UserStore.store_id == store_id
        ).first()

        if not user_store:
            raise HTTPException(status_code=403, detail="Usuário não tem acesso a esta loja")

    # Buscar dados da loja
    store = db.query(Store).filter(Store.id == store_id).first() if store_id else None

    # Gerar token JWT com store_id selecionada
    token_data = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role,
        "store_id": store_id  # ✅ Store vem da SELEÇÃO do usuário, não do cadastro!
    }

    access_token = create_access_token(token_data)

    # Atualizar last_login
    user.last_login = datetime.utcnow()
    db.commit()

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role
        },
        "store": {
            "id": str(store.id),
            "code": store.code,
            "name": store.name
        } if store else None
    }
```

---

### 4.3 Fase 3: Frontend (Interface)

#### 4.3.1 Tela de Cadastro de Usuário (users.html)

**Modificações:**
1. Substituir `<select>` de loja única por `<select multiple>` com checkboxes
2. Adicionar checkbox "Loja Padrão" para cada loja

```html
<!-- Em frontend/users.html (dentro do modal de cadastro) -->

<!-- ANTES (Select único) -->
<div class="mb-3">
    <label for="userStore" class="form-label">Loja/Filial *</label>
    <select class="form-control" id="userStore" required>
        <option value="">Selecione uma loja</option>
        <!-- Options carregadas dinamicamente -->
    </select>
</div>

<!-- DEPOIS (Select múltiplo com checkboxes) -->
<div class="mb-3">
    <label class="form-label">Lojas/Filiais * <small>(Selecione uma ou mais)</small></label>
    <div id="storesList" class="border rounded p-3" style="max-height: 200px; overflow-y: auto;">
        <!-- Checkboxes carregados dinamicamente -->
        <!-- Exemplo:
        <div class="form-check">
            <input type="checkbox" class="form-check-input store-checkbox"
                   id="store_uuid1" value="uuid1" data-store-code="01" data-store-name="Matriz">
            <label class="form-check-label" for="store_uuid1">
                [01] Matriz
            </label>
            <input type="radio" name="default_store" value="uuid1" class="ms-2" title="Loja padrão">
        </div>
        -->
    </div>
    <small class="text-muted">
        <i class="bi bi-info-circle"></i> Use o radio button (○) para marcar a loja padrão
    </small>
</div>

<script>
// Função para carregar lojas no formulário
async function loadStoresForForm() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/stores/`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
        });

        const data = await response.json();
        const storesList = document.getElementById('storesList');
        storesList.innerHTML = '';

        data.data.forEach((store, index) => {
            const div = document.createElement('div');
            div.className = 'form-check d-flex align-items-center';
            div.innerHTML = `
                <input type="checkbox" class="form-check-input store-checkbox"
                       id="store_${store.id}" value="${store.id}"
                       data-store-code="${store.code}" data-store-name="${store.name}">
                <label class="form-check-label flex-grow-1" for="store_${store.id}">
                    [${store.code}] ${store.name}
                </label>
                <div class="form-check form-check-inline ms-2">
                    <input type="radio" name="default_store" value="${store.id}"
                           class="form-check-input default-store-radio"
                           id="default_${store.id}" ${index === 0 ? 'checked' : ''}>
                    <label class="form-check-label" for="default_${store.id}" title="Loja padrão">
                        Padrão
                    </label>
                </div>
            `;
            storesList.appendChild(div);
        });

    } catch (error) {
        console.error('Erro ao carregar lojas:', error);
        showAlert('Erro ao carregar lojas', 'danger');
    }
}

// Função para obter lojas selecionadas
function getSelectedStores() {
    const checkboxes = document.querySelectorAll('.store-checkbox:checked');
    const defaultStoreRadio = document.querySelector('input[name="default_store"]:checked');

    const storeIds = Array.from(checkboxes).map(cb => cb.value);
    const defaultStoreId = defaultStoreRadio ? defaultStoreRadio.value : (storeIds[0] || null);

    return {
        store_ids: storeIds,
        default_store_id: defaultStoreId
    };
}

// Modificar função de salvar usuário
async function saveUser(userData) {
    const storesData = getSelectedStores();

    // Validar que ao menos uma loja foi selecionada (exceto ADMIN)
    if (userData.role !== 'ADMIN' && storesData.store_ids.length === 0) {
        showAlert('Selecione ao menos uma loja para o usuário', 'warning');
        return;
    }

    // Criar usuário
    const userResponse = await fetch(`${API_BASE_URL}/api/v1/users/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify(userData)
    });

    const userResult = await userResponse.json();

    if (!userResponse.ok) {
        throw new Error(userResult.detail || 'Erro ao criar usuário');
    }

    const userId = userResult.data.id;

    // Atualizar lojas do usuário (se não for ADMIN)
    if (userData.role !== 'ADMIN') {
        await fetch(`${API_BASE_URL}/api/v1/users/${userId}/stores`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            },
            body: JSON.stringify(storesData)
        });
    }

    showAlert('Usuário criado com sucesso!', 'success');
    loadUsers();  // Recarregar lista
}
</script>
```

#### 4.3.2 Tela de Login (login.html)

**Modificações:**
1. Alterar fluxo para 2 etapas: validar credenciais → selecionar filial
2. Adicionar modal/card de seleção de filial

```html
<!-- Em frontend/login.html -->

<!-- NOVO: Modal de Seleção de Filial -->
<div class="modal fade" id="storeSelectionModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header bg-primary text-white">
                <h5 class="modal-title">
                    <i class="bi bi-shop"></i> Selecione a Filial
                </h5>
            </div>
            <div class="modal-body">
                <p class="text-muted mb-3">
                    <i class="bi bi-person-circle"></i>
                    <strong id="storeModalUsername"></strong>, selecione qual filial deseja acessar:
                </p>

                <div id="storesListLogin" class="list-group">
                    <!-- Lojas carregadas dinamicamente -->
                    <!-- Exemplo:
                    <button type="button" class="list-group-item list-group-item-action store-option"
                            data-store-id="uuid1" data-store-code="01" data-store-name="Matriz">
                        <div class="d-flex w-100 justify-content-between align-items-center">
                            <div>
                                <h6 class="mb-1">
                                    <i class="bi bi-shop text-primary"></i> [01] Matriz
                                </h6>
                                <small class="text-muted">Rua Example, 123</small>
                            </div>
                            <span class="badge bg-success">Padrão</span>
                        </div>
                    </button>
                    -->
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="cancelStoreSelection()">
                    <i class="bi bi-x-circle"></i> Cancelar
                </button>
            </div>
        </div>
    </div>
</div>

<script>
// =================================
// NOVO FLUXO DE LOGIN (2 ETAPAS)
// =================================

let tempUserData = null;  // Armazena dados temporários do usuário

async function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    // Validações...

    try {
        // ETAPA 1: Validar credenciais
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/validate-credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            showAlert(data.detail || 'Credenciais inválidas', 'danger');
            return;
        }

        // Armazenar dados temporários
        tempUserData = data;

        // Se usuário é ADMIN ou tem apenas 1 loja, pular seleção
        if (data.role === 'ADMIN' || data.stores.length === 1) {
            const storeId = data.stores.length === 1 ? data.stores[0].id : null;
            await completeLogin(data.user_id, storeId);
        } else {
            // ETAPA 2: Mostrar modal de seleção de filial
            showStoreSelectionModal(data);
        }

    } catch (error) {
        console.error('Erro no login:', error);
        showAlert('Erro de conexão com o servidor', 'danger');
    }
}

function showStoreSelectionModal(userData) {
    // Preencher nome do usuário
    document.getElementById('storeModalUsername').textContent = userData.full_name;

    // Preencher lista de lojas
    const storesList = document.getElementById('storesListLogin');
    storesList.innerHTML = '';

    userData.stores.forEach(store => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'list-group-item list-group-item-action store-option';
        button.dataset.storeId = store.id;
        button.dataset.storeCode = store.code;
        button.dataset.storeName = store.name;

        button.innerHTML = `
            <div class="d-flex w-100 justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">
                        <i class="bi bi-shop text-primary"></i> [${store.code}] ${store.name}
                    </h6>
                </div>
                ${store.is_default ? '<span class="badge bg-success">Padrão</span>' : ''}
            </div>
        `;

        button.onclick = () => selectStore(store.id);
        storesList.appendChild(button);
    });

    // Abrir modal
    const modal = new bootstrap.Modal(document.getElementById('storeSelectionModal'));
    modal.show();
}

async function selectStore(storeId) {
    try {
        await completeLogin(tempUserData.user_id, storeId);

        // Fechar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('storeSelectionModal'));
        modal.hide();

    } catch (error) {
        console.error('Erro ao selecionar loja:', error);
        showAlert('Erro ao selecionar loja', 'danger');
    }
}

async function completeLogin(userId, storeId) {
    // ETAPA 2: Gerar token com loja selecionada
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login-with-store`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, store_id: storeId })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.detail || 'Erro ao completar login');
    }

    // Salvar token e dados no localStorage
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('token_type', data.token_type);
    localStorage.setItem('login_time', Date.now().toString());
    localStorage.setItem('user_data', JSON.stringify(data.user));
    localStorage.setItem('user_name', data.user.full_name);
    localStorage.setItem('user_role', data.user.role);
    localStorage.setItem('store_id', storeId || '');  // ✅ Store da SESSÃO
    localStorage.setItem('store_name', data.store?.name || '');
    localStorage.setItem('store_code', data.store?.code || '');

    showAlert('Login realizado com sucesso!', 'success', 2000);

    // Redirecionar baseado no role
    setTimeout(() => {
        if (data.user.role === 'OPERATOR') {
            window.location.href = 'counting_improved.html';
        } else {
            window.location.href = 'dashboard.html';
        }
    }, 1500);
}

function cancelStoreSelection() {
    tempUserData = null;
    const modal = bootstrap.Modal.getInstance(document.getElementById('storeSelectionModal'));
    modal.hide();
    showAlert('Login cancelado', 'info');
}
</script>
```

---

## 📊 5. IMPACTO E RISCOS

### 5.1 Impacto na Lógica Existente

| Componente | Impacto | Risco | Mitigação |
|------------|---------|-------|-----------|
| **Token JWT** | ⚠️ Médio | Baixo | `store_id` ainda está no token, mas vem da seleção |
| **Endpoints** | ✅ Nenhum | Baixo | Continuam usando `current_user.store_id` do token |
| **Filtros de Dados** | ✅ Nenhum | Baixo | Lógica permanece igual (`store_id` no contexto) |
| **Frontend** | ⚠️ Médio | Médio | Novo fluxo de login (2 etapas) |
| **Cadastro de Usuário** | ⚠️ Médio | Médio | Nova UI de seleção múltipla |

**Conclusão**: Impacto **controlado**, lógica de negócio mantém-se intacta

---

### 5.2 Compatibilidade

#### Durante a Transição (Fase 1-2)
✅ **100% Compatível**
- Usuários existentes continuam funcionando (store_id migrado para user_stores)
- Novos usuários podem ter múltiplas lojas
- Login antigo funciona com store_id padrão

#### Após Implementação Completa (Fase 3)
✅ **100% Compatível**
- Sistema migrado completamente para user_stores
- Fluxo de login novo (2 etapas) para todos
- Opção de depreciar `users.store_id` (aguardar 1-2 meses de testes)

---

## ⏱️ 6. ESTIMATIVA DE TEMPO

| Fase | Tarefas | Tempo Estimado | Complexidade |
|------|---------|----------------|--------------|
| **Fase 1** | Migração do banco (3 scripts SQL) | 2-3 horas | Baixa |
| **Fase 2** | Backend (modelo + 3 endpoints) | 6-8 horas | Média |
| **Fase 3** | Frontend (cadastro + login) | 8-10 horas | Média-Alta |
| **Testes** | Testes integrados + correções | 4-6 horas | Média |
| **Documentação** | Atualizar CLAUDE.md e docs | 2-3 horas | Baixa |

**Total**: **22-30 horas** (~3-4 dias de desenvolvimento)

---

## ✅ 7. CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Banco de Dados
- [ ] Criar migration `003_multi_store_users.sql`
- [ ] Criar trigger `enforce_single_default_store()`
- [ ] Criar migration `004_migrate_existing_stores.sql`
- [ ] Testar migração em ambiente de desenvolvimento
- [ ] Validar que todos os usuários migraram corretamente
- [ ] Backup do banco antes de aplicar em produção

### Fase 2: Backend
- [ ] Adicionar modelo `UserStore` em `models.py`
- [ ] Atualizar modelos `User` e `Store` com relationships
- [ ] Criar endpoint `/users/{user_id}/stores` (GET)
- [ ] Criar endpoint `/users/{user_id}/stores` (PUT)
- [ ] Criar endpoint `/auth/validate-credentials` (POST)
- [ ] Criar endpoint `/auth/login-with-store` (POST)
- [ ] Atualizar endpoint `/users/` (POST) para usar user_stores
- [ ] Testar todos os endpoints com Postman/Swagger

### Fase 3: Frontend
- [ ] Modificar `users.html` - select múltiplo com checkboxes
- [ ] Adicionar função `loadStoresForForm()`
- [ ] Adicionar função `getSelectedStores()`
- [ ] Modificar função `saveUser()` para chamar `/users/{id}/stores`
- [ ] Criar modal de seleção de filial em `login.html`
- [ ] Modificar `handleLogin()` para fluxo em 2 etapas
- [ ] Criar função `showStoreSelectionModal()`
- [ ] Criar função `selectStore()` e `completeLogin()`
- [ ] Testar fluxo completo de login

### Fase 4: Testes
- [ ] Testar criação de usuário com 1 loja
- [ ] Testar criação de usuário com múltiplas lojas
- [ ] Testar usuário ADMIN (sem lojas)
- [ ] Testar login com 1 loja (deve pular modal)
- [ ] Testar login com múltiplas lojas (deve abrir modal)
- [ ] Testar mudança de loja padrão
- [ ] Validar que dados filtrados correspondem à loja selecionada
- [ ] Testar migração de usuários existentes

### Fase 5: Documentação
- [ ] Atualizar CLAUDE.md com informações da v2.12.0
- [ ] Criar CHANGELOG_v2.12.0.md
- [ ] Documentar endpoints novos no Swagger
- [ ] Atualizar README.md (se aplicável)

---

## 🎯 8. RECOMENDAÇÕES

### 8.1 Ordem de Implementação Recomendada
1. **Fase 1 (Banco)** → Independente, pode ser feita primeiro
2. **Fase 2 (Backend)** → Depende da Fase 1
3. **Fase 3 (Frontend)** → Depende da Fase 2
4. **Testes Integrados** → Após Fase 3

### 8.2 Estratégia de Rollout
**Opção A: Big Bang (Recomendada)**
- Implementar tudo de uma vez em ambiente de desenvolvimento
- Testar exaustivamente por 1-2 semanas
- Aplicar em produção de uma só vez (com backup)

**Opção B: Gradual**
- Fase 1: Migrar banco mas manter lógica antiga (users.store_id)
- Fase 2: Ativar novos endpoints mas manter login antigo
- Fase 3: Ativar novo login apenas para usuários teste
- Fase 4: Rollout completo após validação

**Recomendação**: **Opção A** (Big Bang) porque mudança é isolada e não há lógica crítica afetada

### 8.3 Pontos de Atenção
⚠️ **Usuários ADMIN**: Não devem ter lojas atribuídas (validar no backend)
⚠️ **Migração de Dados**: Testar com cópia do banco de produção antes
⚠️ **Token JWT**: Garantir que `store_id` vem da seleção, não do cadastro
⚠️ **Loja Padrão**: Apenas uma por usuário (trigger no banco)
⚠️ **UX do Login**: Modal deve ser intuitivo e rápido

---

## 📝 9. RESUMO EXECUTIVO

### Viabilidade
✅ **TOTALMENTE VIÁVEL** - Proposta bem estruturada e não quebra lógica existente

### Benefícios
- ✅ Usuário pode acessar múltiplas filiais
- ✅ Flexibilidade operacional (um operador em várias lojas)
- ✅ Lógica atual permanece intacta (store_id no contexto)
- ✅ Fácil rollback (user.store_id ainda existe)

### Riscos
- ⚠️ Migração de dados (mitigado com testes)
- ⚠️ Novo fluxo de login (mitigado com UX intuitiva)
- ⚠️ Tempo de desenvolvimento (~3-4 dias)

### Recomendação Final
✅ **APROVAR IMPLEMENTAÇÃO** seguindo o plano das 5 fases

---

## 🔗 10. PRÓXIMOS PASSOS

1. **Aprovação**: Usuário/Cliente aprovar o plano
2. **Priorização**: Definir quando implementar (sprint/iteração)
3. **Desenvolvimento**: Seguir checklist das fases 1-5
4. **Testes**: Validar em ambiente de desenvolvimento
5. **Deploy**: Aplicar em produção com backup

---

**Documento criado em**: 20/10/2025
**Responsável**: Claude Code (Análise Técnica)
**Status**: Aguardando aprovação do cliente
