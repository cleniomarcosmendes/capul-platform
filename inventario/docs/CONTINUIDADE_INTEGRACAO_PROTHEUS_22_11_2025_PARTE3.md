# Continuidade - Integração Protheus v2.19.3
**Data:** 22/11/2025 - Parte 3 (Atualizado)
**Sessão anterior:** CONTINUIDADE_INTEGRACAO_PROTHEUS_22_11_2025_PARTE2.md

---

## Resumo da Sessão

### 0. Correção da Lógica de Transferência (CRÍTICO)

**Problema:** A direção da transferência estava invertida.

**Lógica CORRETA:**
- **Origem** = onde tem FALTA física (saldo > contado, sistema diz ter mais do que tem)
- **Destino** = onde tem SOBRA física (contado > saldo, tem mais do que sistema diz)
- Transferir SALDO do sistema de FALTA → SOBRA

**Exemplo validado (produto 00003255):**
| Inventário | Saldo | Contado | Div.Bruta | Transf | Saldo.Aj | Dif.Final |
|------------|-------|---------|-----------|--------|----------|-----------|
| ARM.06 | 14 | 3 | -11 (FALTA) | -11 | 3 | **0** ✅ |
| ARM.02 | 160 | 200 | +40 (SOBRA) | +11 | 171 | **+29** |

**Correção aplicada em `integration_protheus.py` (linhas 368-386):**
```python
# Caso 1: A tem SOBRA (contou mais), B tem FALTA (contou menos)
# Transferir SALDO de B (FALTA) para A (SOBRA)
if div_a > 0 and div_b < 0:
    transfer_qty = min(div_a, abs(div_b))
    source_wh = inventory_b["warehouse"]  # B é origem (FALTA - saldo sai)
    target_wh = inventory_a["warehouse"]  # A é destino (SOBRA - saldo entra)
    saldo_b_ajustado = expected_b - transfer_qty  # Saldo de B diminui
    saldo_a_ajustado = expected_a + transfer_qty  # Saldo de A aumenta

# Caso 2: B tem SOBRA (contou mais), A tem FALTA (contou menos)
# Transferir SALDO de A (FALTA) para B (SOBRA)
elif div_b > 0 and div_a < 0:
    transfer_qty = min(div_b, abs(div_a))
    source_wh = inventory_a["warehouse"]  # A é origem (FALTA - saldo sai)
    target_wh = inventory_b["warehouse"]  # B é destino (SOBRA - saldo entra)
    saldo_a_ajustado = expected_a - transfer_qty  # Saldo de A diminui
    saldo_b_ajustado = expected_b + transfer_qty  # Saldo de B aumenta
```

---

### 1. Transferência por LOTE Individual (Correção Crítica)

**Problema:** A transferência no Protheus é realizada por LOTE INDIVIDUAL, não por produto agregado. O sistema estava mostrando `qty=0` nas linhas de lote.

**Causa:** Fórmula de divergência invertida no cálculo de transferência por lote.

**Correção aplicada em `integration_protheus.py` (linha 444):**
```python
# ANTES (incorreto):
lot_divergence = lot_balance - lot_counted  # saldo - contado

# DEPOIS (correto):
lot_divergence = lot_counted - lot_balance  # contado - saldo = excesso físico
```

**Resultado dos testes:**
```
=== TRANSFERÊNCIAS (produtos com lote) ===
AGGREGATE    | 00010037   | qty=  73.0
LOT_DETAIL   | 00010037   | lot=000000000021555 | qty=  28.0
LOT_DETAIL   | 00010037   | lot=000000000022629 | qty=  45.0  (28+45=73 ✅)

AGGREGATE    | 00011377   | qty=  17.0
LOT_DETAIL   | 00011377   | lot=000000000017963 | qty=   8.0
LOT_DETAIL   | 00011377   | lot=000000000020014 | qty=   9.0  (8+9=17 ✅)
```

---

### 2. Transferência por Lote nos Ajustes (adjustments_a e adjustments_b)

**Implementação:** Cada linha de lote agora mostra sua própria quantidade de transferência.

**Lógica aplicada:**
- Se inventário é ORIGEM (tem sobra) → lotes com sobra ENVIAM (transfer negativo)
- Se inventário é DESTINO (tem falta) → lotes com falta RECEBEM (transfer positivo)

**Código em `adjustments_a` (linhas 556-604):**
```python
# Calcular transferência POR LOTE para ajustes
if tracking and tracking.strip() == "L" and item_a.get("lots"):
    lots_a = item_a.get("lots", [])
    total_lot_transfer_a = 0

    for lot in lots_a:
        lot_divergence = lot_expected - lot_counted  # positivo = sobra
        lot_transfer = 0

        if transfer_qty_a < 0 and lot_divergence > 0:
            # A envia: este lote tem sobra, pode transferir
            lot_transfer = -min(lot_divergence, abs(transfer_qty_a) - total_lot_transfer_a)
            total_lot_transfer_a += abs(lot_transfer)
        # ... continua
```

**Mesma lógica aplicada em `adjustments_b` (linhas 632-682).**

---

### 3. Frontend - Exibição de Valores por Lote

**Modificações em `integration_protheus.html`:**

1. **Coluna TRANSF** - Agora mostra valor em todas as linhas (agregado e lote):
```javascript
// ANTES:
const transfDisplay = isLotRow ? '-' : formatNumberInt(Math.abs(transferencia));

// DEPOIS:
const transfDisplay = transferencia === 0 ? '-' : formatNumberInt(Math.abs(transferencia));
```

2. **Colunas EST.AJ e DIF.FIN** - Removidas verificações que ocultavam valores nas linhas de lote.

3. **Tabela de Transferências** - Quantidade por lote agora é exibida corretamente.

---

### 4. Validação de Inventário Já Integrado (NOVA FEATURE)

**Regra de Negócio:** Um inventário que já foi integrado com Protheus (status SENT/CONFIRMED/PROCESSING) NÃO pode ser usado em outra integração.

**Funções criadas:**

#### `check_inventory_already_integrated(db, inventory_id)`
```python
"""
Verifica se um inventário já foi integrado com Protheus (como A ou B).
Retorna None se disponível, ou Dict com dados da integração existente.
"""
# Busca em protheus_integrations onde:
# - inventory_a_id = inv_id OR inventory_b_id = inv_id
# - status IN ('SENT', 'CONFIRMED', 'PROCESSING')
```

#### `get_inventories_already_integrated(db, store_id)`
```python
"""
Retorna lista de IDs de inventários já integrados de uma loja.
Usada para filtrar inventários disponíveis.
"""
```

**Endpoints modificados:**

| Endpoint | Validação |
|----------|-----------|
| `GET /compatible-inventories/{id}` | Inventário de referência já integrado → `blocked=true`, lista vazia |
| `GET /compatible-inventories/{id}` | Inventários já integrados aparecem em `blocked_inventories` |
| `POST /preview` | Inventário A já integrado → HTTP 400 |
| `POST /preview` | Inventário B já integrado → HTTP 400 |

**Exemplo de resposta bloqueada:**
```json
{
  "reference_inventory": {...},
  "compatible_inventories": [],
  "total": 0,
  "blocked": true,
  "blocked_reason": "Inventário já integrado com Protheus (status: CONFIRMED)",
  "existing_integration": {
    "integration_id": "uuid...",
    "status": "CONFIRMED",
    "partner_inventory_name": "clenio_00_02",
    "partner_warehouse": "02"
  }
}
```

**Exemplo de erro no preview:**
```
HTTP 400: Inventário A já foi integrado com Protheus
(status: CONFIRMED, usado como: A, parceiro: clenio_00_02 ARM.02)
```

---

## Arquivos Modificados

| Arquivo | Alterações |
|---------|------------|
| `backend/app/api/v1/endpoints/integration_protheus.py` | Correção fórmula transferência por lote, funções de validação, validações nos endpoints |
| `frontend/integration_protheus.html` | Exibição de TRANSF/EST.AJ/DIF.FIN por lote |

---

## Status Atual

### Funcionalidades Implementadas ✅
- [x] Transferência calculada por LOTE individual
- [x] Soma das quantidades por lote = quantidade agregada
- [x] Frontend exibe valores por lote
- [x] Validação de inventário já integrado
- [x] Bloqueio de reutilização de inventários integrados

### Pendências para Validação
- [ ] Testar página no browser: http://localhost/integration_protheus.html
- [ ] Verificar se colunas TRANSF por lote estão corretas
- [ ] Realizar integração de teste (salvar como DRAFT)
- [ ] Enviar integração (mudar para SENT)
- [ ] Verificar bloqueio após integração enviada

---

## Inventários de Teste

- **Inventário A**: `d6497ca3-d516-483c-91ea-4099174bb34d` (clenio_00_06 - ARM.06)
- **Inventário B**: `e55c5ec2-ab4e-4676-bfe1-a4afcd2452b8` (clenio_00_02 - ARM.02)

### Produtos com Lote para Teste
| Código | Descrição | Lotes |
|--------|-----------|-------|
| 00010037 | COLOSSO PULV.OF 25ML | 000000000021555, 000000000022629, 000000000022631 |
| 00011377 | CLORETO SODIO 0,9% 500ML | 000000000017963, 000000000020014 |

---

## Comandos Úteis

```bash
# Reiniciar backend
docker-compose restart backend

# Ver logs do backend
docker-compose logs -f backend

# Obter token
curl -s -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' | python3 -c "import json,sys; print(json.load(sys.stdin).get('access_token',''))"

# Testar API de preview
curl -s "http://localhost:8000/api/v1/integration/protheus/preview?inventory_a_id=d6497ca3-d516-483c-91ea-4099174bb34d&inventory_b_id=e55c5ec2-ab4e-4676-bfe1-a4afcd2452b8" \
  -X POST -H "Authorization: Bearer TOKEN"

# Testar inventários compatíveis
curl -s "http://localhost:8000/api/v1/integration/protheus/compatible-inventories/d6497ca3-d516-483c-91ea-4099174bb34d" \
  -H "Authorization: Bearer TOKEN"

# Ver histórico de integrações
curl -s "http://localhost:8000/api/v1/integration/protheus/history" \
  -H "Authorization: Bearer TOKEN"

# Acessar página
http://localhost/integration_protheus.html?inventory_id=d6497ca3-d516-483c-91ea-4099174bb34d
```

---

## Fluxo de Teste Recomendado

1. **Acessar página** → http://localhost/integration_protheus.html
2. **Selecionar Inventário A** → clenio_00_06 (ARM.06)
3. **Selecionar Inventário B** → clenio_00_02 (ARM.02)
4. **Gerar Preview** → Verificar:
   - Aba Transferências: quantidades por lote
   - Aba Inventário A: TRANSF/EST.AJ/DIF.FIN por lote
   - Aba Inventário B: TRANSF/EST.AJ/DIF.FIN por lote
5. **Salvar Rascunho** → Status = DRAFT
6. **Integrar com Protheus** → Status = SENT (simulação)
7. **Tentar nova análise** → Deve ser bloqueado

---

## Observações Importantes

1. **Status que BLOQUEIAM reutilização:**
   - `SENT` - Enviado ao Protheus
   - `CONFIRMED` - Confirmado pelo Protheus
   - `PROCESSING` - Em processamento

2. **Status que PERMITEM nova integração:**
   - `DRAFT` - Rascunho
   - `PENDING` - Aguardando envio
   - `ERROR` - Erro na integração
   - `CANCELLED` - Cancelado

3. **Histórico atual:** Vazio (nenhuma integração realizada ainda)

---

**Última atualização:** 22/11/2025 19:50
**Versão:** v2.19.3
