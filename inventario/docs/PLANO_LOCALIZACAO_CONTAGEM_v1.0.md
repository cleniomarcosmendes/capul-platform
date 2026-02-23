# Plano de Implementação: Localização de Produtos nas Telas de Contagem

**Versão:** 1.0
**Data:** 17/12/2025
**Status:** Aguardando Decisão
**Solicitante:** Usuários (validação do sistema)

---

## 1. Contexto da Solicitação

Durante as validações do sistema, os usuários identificaram a necessidade de visualizar a **localização física dos produtos** nas telas de contagem (MOBILE e DESKTOP).

### Informações da Fonte (Protheus)

| Campo | Tabela | Descrição |
|-------|--------|-----------|
| BZ_XLOCAL1 | SBZ010 | Localização física nível 1 (ex: Corredor, Gôndola) |
| BZ_XLOCAL2 | SBZ010 | Localização física nível 2 (ex: Prateleira, Seção) |
| BZ_XLOCAL3 | SBZ010 | Localização física nível 3 (ex: Posição) |

### Regra de Negócio (Conceitual)

> "Conceitualmente, entendemos que o ARMAZÉM/LOCAL define qual localização utilizar. Exemplo: Armazém 02 usa BZ_XLOCAL1, Armazéns 03/04 usam BZ_XLOCAL2. Porém, não existe cadastro formal dessa regra. No relatório do ERP-Protheus, listamos as 3 colunas e o usuário interpreta qual usar baseado no armazém que está contando."

---

## 2. Situação Atual no Sistema

### 2.1 Backend - Dados Disponíveis

| Componente | Status | Detalhes |
|------------|--------|----------|
| Tabela SBZ010 | ✅ OK | Campos bz_xlocal1, bz_xlocal2, bz_xlocal3 existem |
| Snapshot | ✅ OK | Dados copiados para `inventory_items_snapshot` |
| Endpoint API | ✅ OK | Retornados em `snapshot.location_1/2/3` |
| Frontend | ❌ Pendente | **NÃO exibidos nas telas de contagem** |

### 2.2 Análise de Uso por Armazém

Consulta realizada em 17/12/2025:

| Armazém | Total Produtos | Usa Local1 | Usa Local2 | Usa Local3 | Observação |
|---------|----------------|------------|------------|------------|------------|
| 02 | 57 | 9 (16%) | 9 (16%) | 0 | Usa L1 e L2 |
| 04 | 10 | 10 (100%) | 10 (100%) | 0 | L2 = "ZZZZZZZZZZ" (placeholder?) |
| 06 | 8 | 6 (75%) | 7 (88%) | 0 | Usa L1 e L2 |
| 08 | 3 | 2 (67%) | 0 | 0 | Apenas L1 |

**Conclusões:**
- Local3 praticamente não é utilizado
- Local1 e Local2 são os mais usados
- Valor "ZZZZZZZZZZ" aparece como possível placeholder no armazém 04
- Não há regra clara de "armazém X usa localização Y"

### 2.3 Exemplos de Dados Reais

```
Produto  | Armazém | Local1      | Local2      | Local3
---------|---------|-------------|-------------|--------
00011221 | 06      | GD 07       | GV 09       |
00010693 | 04      | B 106       | ZZZZZZZZZZ  |
00010190 | 02      | BALCAO      | GP 01       |
00020006 | 08      | CAROCO ALG  |             |
00003255 | 06      | GD 07       | DET         |
```

---

## 3. Layout Atual das Telas

### 3.1 Tela MOBILE (`counting_mobile.html`)

```
┌─────────────────────────────────────────────┐
│ 00010693                                    │  ← Código
│ PARAFUSO SEXTAVADO 10MM GALVANIZADO         │  ← Descrição
│ Estoque: 150 | Entregas: +10 | Total: 160   │  ← Apenas SUPERVISOR/ADMIN
│ [Com Lote] [Contado]                        │  ← Badges
│                                      150,00 │  ← Quantidade contada
└─────────────────────────────────────────────┘
```

**Características:**
- Cards empilhados verticalmente
- Otimizado para touch/mobile
- Informações condensadas
- Badges indicam lote e status

### 3.2 Tela DESKTOP (`counting_improved.html`)

```
┌────┬──────────┬─────────────────────┬─────────┬──────────┬───────┬──────────┬──────┬────────┬───────┐
│ #  │ Código   │ Descrição           │ Estoque │ Entregas │ Total │ Contagem │ Dif  │ Status │ Ações │
├────┼──────────┼─────────────────────┼─────────┼──────────┼───────┼──────────┼──────┼────────┼───────┤
│ 1  │ 00010693 │ PARAFUSO SEXT...    │ 150,00  │ +10,00   │160,00 │ 155,00   │-5,00 │   ⚠️   │  ✏️   │
│ 2  │ 00011221 │ PORCA QUADRADA...   │ 200,00  │ +0,00    │200,00 │ 200,00   │ 0,00 │   ✅   │  ✏️   │
└────┴──────────┴─────────────────────┴─────────┴──────────┴───────┴──────────┴──────┴────────┴───────┘
```

**Características:**
- Tabela com 10 colunas
- Visão completa dos dados
- Colunas de quantidade esperada visíveis
- Ações de edição inline

---

## 4. Opções de Implementação

### Opção A: Linha Adicional com Localização Concatenada

**Descrição:** Exibir as 3 localizações concatenadas com separador.

**MOBILE:**
```
┌─────────────────────────────────────────────┐
│ 00010693                                    │
│ PARAFUSO SEXTAVADO 10MM GALVANIZADO         │
│ 📍 B 106 | ZZZZZZZZZZ                       │  ← NOVA LINHA
│ [Com Lote] [Contado]                        │
│                                      150,00 │
└─────────────────────────────────────────────┘
```

**DESKTOP:** Nova coluna "Localização" ou texto abaixo da descrição

| Prós | Contras |
|------|---------|
| Simples de implementar | Ocupa espaço vertical (mobile) |
| Usuário vê toda informação | Pode poluir visualmente |
| Não requer regra de negócio | Exibe placeholders indesejados |

**Complexidade:** ⭐ Baixa
**Tempo estimado:** 2-3 horas

---

### Opção B: Localização Dinâmica por Armazém (Regra de Negócio)

**Descrição:** Criar mapeamento que define qual localização exibir por armazém.

**Configuração (exemplo):**
```javascript
const LOCALIZACAO_POR_ARMAZEM = {
    '02': 'local1',  // Armazém 02 → Exibir Local1
    '03': 'local2',  // Armazém 03 → Exibir Local2
    '04': 'local2',  // Armazém 04 → Exibir Local2
    '06': 'local1',  // Armazém 06 → Exibir Local1
    '08': 'local1',  // Armazém 08 → Exibir Local1
    'default': 'local1'  // Fallback
};
```

**Resultado:**
```
┌─────────────────────────────────────────────┐
│ 00010693                     (Armazém: 04)  │
│ PARAFUSO SEXTAVADO 10MM GALVANIZADO         │
│ 📍 ZZZZZZZZZZ                               │  ← Apenas Local2 (regra)
│ [Com Lote]                                  │
└─────────────────────────────────────────────┘
```

| Prós | Contras |
|------|---------|
| Exibe apenas o relevante | Requer definir regra de negócio |
| Mais limpo visualmente | Menos flexível |
| Alinhado com uso no Protheus | Precisa manter mapeamento |

**Complexidade:** ⭐⭐ Média
**Tempo estimado:** 3-4 horas

---

### Opção C: Ícone com Tooltip/Popover

**Descrição:** Adicionar ícone 📍 clicável que abre popover com todas as localizações.

**MOBILE:**
```
┌─────────────────────────────────────────────┐
│ 00010693                              📍    │  ← Ícone clicável
│ PARAFUSO SEXTAVADO 10MM GALVANIZADO         │
│ [Com Lote] [Contado]                        │
└─────────────────────────────────────────────┘

    ┌─────────────────────┐
    │ 📍 Localização      │  ← Popover ao clicar
    │ Local 1: B 106      │
    │ Local 2: ZZZZZZZZZZ │
    │ Local 3: -          │
    └─────────────────────┘
```

**DESKTOP:** Ícone na coluna de código ou ações

| Prós | Contras |
|------|---------|
| Não polui o layout | Requer clique adicional |
| Informação completa disponível | Menos visível à primeira vista |
| Layout inalterado | UX pode ser confusa no mobile |

**Complexidade:** ⭐⭐ Média
**Tempo estimado:** 3-4 horas

---

### Opção D: Exibição SMART (Valores Válidos)

**Descrição:** Concatenar apenas campos não-vazios, ignorando placeholders conhecidos.

**Regras:**
1. Ignorar valores vazios, nulos ou apenas espaços
2. Ignorar placeholders conhecidos (ex: "ZZZZZZZZZZ")
3. Concatenar com " | " apenas valores válidos
4. Se nenhum valor válido, não exibir linha de localização

**Configuração de placeholders:**
```javascript
const PLACEHOLDERS_IGNORAR = ['ZZZZZZZZZZ', '-', 'N/A', ''];
```

**Resultado:**
```
Produto 00010693 (Armazém 04):
  Local1: "B 106", Local2: "ZZZZZZZZZZ", Local3: ""
  Exibição: 📍 B 106  (ignora ZZZZZZZZZZ)

Produto 00003255 (Armazém 06):
  Local1: "GD 07", Local2: "DET", Local3: ""
  Exibição: 📍 GD 07 | DET

Produto sem localização:
  Local1: "", Local2: "", Local3: ""
  Exibição: (nada - linha omitida)
```

**MOBILE:**
```
┌─────────────────────────────────────────────┐
│ 00010693                                    │
│ PARAFUSO SEXTAVADO 10MM GALVANIZADO         │
│ 📍 B 106                                    │  ← Apenas valores válidos
│ [Com Lote] [Contado]                        │
└─────────────────────────────────────────────┘
```

| Prós | Contras |
|------|---------|
| Limpo e inteligente | Precisa definir lista de placeholders |
| Só mostra o relevante | Pode ocultar info que usuário quer ver |
| Sem poluição visual | Lógica um pouco mais complexa |
| Não requer regra por armazém | - |

**Complexidade:** ⭐⭐ Média
**Tempo estimado:** 3-4 horas

---

### Opção E: Híbrida (D + B como fallback)

**Descrição:** Usar Opção D (SMART) como padrão, mas permitir configuração por armazém se necessário.

**Fluxo:**
1. Tentar exibir localização SMART (valores válidos concatenados)
2. Se configuração específica existir para o armazém, usar apenas aquela coluna
3. Se nenhum valor válido e nenhuma config, não exibir

| Prós | Contras |
|------|---------|
| Máxima flexibilidade | Maior complexidade |
| Atende todos os cenários | Mais código para manter |
| Configurável por armazém | - |

**Complexidade:** ⭐⭐⭐ Alta
**Tempo estimado:** 4-5 horas

---

## 5. Posicionamento Sugerido

### MOBILE

| Posição | Descrição | Impacto no Layout |
|---------|-----------|-------------------|
| **Abaixo da descrição** | Nova linha com fonte menor e cor cinza | Mínimo - espaço vertical |
| Abaixo dos badges | Junto com contadores | Pode ficar confuso |
| No header do card | Ao lado do código | Espaço limitado |

**Recomendação:** Abaixo da descrição, fonte 11px, cor #6c757d (cinza)

### DESKTOP

| Posição | Descrição | Impacto no Layout |
|---------|-----------|-------------------|
| **Nova coluna após Código** | Coluna "Local" dedicada | +1 coluna na tabela |
| Abaixo da descrição | Texto menor na mesma célula | Célula maior |
| Tooltip no código | Hover mostra localização | Sem impacto visual |

**Recomendação:** Nova coluna "Local" após "Código" (largura ~100px)

---

## 6. Perguntas para Decisão

### 6.1 Sobre os Dados

1. **O valor "ZZZZZZZZZZ" é placeholder?**
   - [ ] Sim, ignorar na exibição
   - [ ] Não, exibir normalmente
   - [ ] Verificar com usuários

2. **Existem outros placeholders a ignorar?**
   - [ ] Não
   - [ ] Sim: _______________

3. **A regra de armazém → localização é fixa?**
   - [ ] Sim, podemos criar mapeamento
   - [ ] Não, varia por produto
   - [ ] Parcialmente, alguns armazéns têm regra

### 6.2 Sobre a Exibição

4. **Qual opção prefere?**
   - [ ] Opção A: Concatenar todas
   - [ ] Opção B: Por regra de armazém
   - [ ] Opção C: Tooltip/Popover
   - [ ] Opção D: SMART (valores válidos)
   - [ ] Opção E: Híbrida

5. **Prioridade de exibição (se usar SMART):**
   - [ ] Local1 > Local2 > Local3
   - [ ] Todos com mesmo peso
   - [ ] Outra: _______________

6. **Deve exibir mesmo sem localização?**
   - [ ] Não, omitir a linha
   - [ ] Sim, exibir "Sem localização" ou "-"

### 6.3 Sobre o Layout

7. **No DESKTOP, prefere:**
   - [ ] Nova coluna "Local"
   - [ ] Texto abaixo da descrição
   - [ ] Tooltip no hover

8. **No MOBILE, prefere:**
   - [ ] Nova linha no card
   - [ ] Badge/ícone
   - [ ] Tooltip ao tocar

---

## 7. Arquivos a Modificar

| Arquivo | Modificação | Complexidade |
|---------|-------------|--------------|
| `frontend/counting_mobile.html` | Adicionar linha de localização no card | Baixa |
| `frontend/counting_improved.html` | Adicionar coluna ou texto de localização | Baixa |
| (Opcional) `backend/app/main.py` | Mover location para nível raiz da resposta | Baixa |

---

## 8. Próximos Passos

1. **Usuário decide** qual opção implementar (A, B, C, D ou E)
2. **Usuário responde** perguntas da seção 6
3. **Implementação** seguindo este documento
4. **Testes** em ambiente de desenvolvimento
5. **Validação** com usuários finais
6. **Deploy** em produção

---

## 9. Histórico de Decisões

| Data | Decisão | Responsável |
|------|---------|-------------|
| 17/12/2025 | Documento criado | Claude |
| 19/12/2025 | **Opção B escolhida** (Localização Dinâmica por Armazém) com campo `ZB_XSBZLCZ` na tabela SZB010 | Usuário |
| 19/12/2025 | Implementação concluída (v2.19.8) | Claude |
| - | Validação pendente | - |

---

## 10. Implementação v2.19.8 (19/12/2025)

### Resumo da Implementação

**Opção Escolhida:** Opção B - Localização Dinâmica por Armazém, com configuração no banco de dados

**Arquitetura:**
```
SZB010 (Armazéns)          →  ZB_XSBZLCZ (1, 2 ou 3)
        ↓
SBZ010 (Produtos)          →  BZ_XLOCAL1, BZ_XLOCAL2, BZ_XLOCAL3
        ↓
Snapshot                   →  bz_xlocal1, bz_xlocal2, bz_xlocal3
        ↓
Backend (CASE WHEN)        →  location (dinâmico baseado em ZB_XSBZLCZ)
        ↓
Frontend (MOBILE/DESKTOP)  →  📍 Exibição da localização
```

### Mudanças no Banco de Dados

```sql
-- Nova coluna na tabela szb010
ALTER TABLE inventario.szb010
ADD COLUMN zb_xsbzlcz CHAR(1) DEFAULT '1';

-- Valores preenchidos:
-- Armazém 01 → '1' (usa BZ_XLOCAL1) - 24 registros
-- Armazém 02 → '2' (usa BZ_XLOCAL2) - 25 registros
-- Armazém 03 → '3' (usa BZ_XLOCAL3) - 16 registros
-- Demais     → '1' (default)
```

### Mudanças no Backend

**Arquivo:** `backend/app/main.py` (endpoint `/api/v1/counting-lists/{list_id}/products`)

```sql
-- JOIN adicionado
JOIN inventario.stores st ON cl.store_id = st.id
LEFT JOIN inventario.szb010 szb_loc ON szb_loc.zb_filial = st.code
                                    AND szb_loc.zb_xlocal = ii.warehouse

-- CASE WHEN para localização dinâmica
CASE COALESCE(szb_loc.zb_xsbzlcz, '1')
    WHEN '1' THEN NULLIF(TRIM(iis.bz_xlocal1), '')
    WHEN '2' THEN NULLIF(TRIM(iis.bz_xlocal2), '')
    WHEN '3' THEN NULLIF(TRIM(iis.bz_xlocal3), '')
    ELSE NULLIF(TRIM(iis.bz_xlocal1), '')
END as location
```

**Resposta da API:**
```json
{
  "location": "GD 07",  // ← Novo campo (nível raiz)
  "snapshot": {
    "location_1": "GD 07",
    "location_2": "GV 09",
    "location_3": null,
    "location": "GD 07"  // ← Também adicionado no snapshot
  }
}
```

### Mudanças no Frontend

**MOBILE (`counting_mobile.html`):**
- Card do produto: linha com 📍 localização abaixo da descrição
- Modal de contagem: localização exibida abaixo do nome do produto

**DESKTOP (`counting_improved.html`):**
- Nova coluna "Local" na tabela (após "Descrição")
- Ícone 📍 com localização ou "-" se vazio

### Ordenação dos Produtos

**Nova ordenação (v2.19.8):**
1. **Localização** (NULLS LAST - produtos sem localização aparecem por último)
2. **Descrição do Produto** (alfabético)

```sql
ORDER BY
    location NULLS LAST,
    product_description
```

### Benefícios da Implementação

1. **Configurável por banco** - Não precisa alterar código para mudar regra
2. **Pronto para API Protheus** - Quando a API estiver pronta, já carregará ZB_XSBZLCZ
3. **Flexível por armazém** - Cada armazém pode usar localização diferente
4. **UX limpa** - Exibe apenas a localização relevante, não polui com dados vazios
5. **Ordenação lógica** - Produtos agrupados por localização facilitam contagem física

---

**Documento gerado em:** 17/12/2025
**Última atualização:** 19/12/2025
**Versão do Sistema:** v2.19.8
