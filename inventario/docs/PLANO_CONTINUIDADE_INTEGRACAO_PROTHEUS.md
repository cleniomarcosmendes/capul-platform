# PLANO DE CONTINUIDADE - INTEGRAÇÃO PROTHEUS

**Data:** 24/11/2025
**Status:** AGUARDANDO CONTINUAÇÃO
**Fase Atual:** Dicionário de dados criado

---

## 📊 SITUAÇÃO ATUAL

### ✅ O que foi concluído

#### 1. Análise das Tabelas Protheus (CONCLUÍDO)
- ✅ **SB7 (Inventário)**: 34 campos analisados, campos obrigatórios identificados
- ✅ **SD3 (Transferência)**: 116+ campos analisados, campos obrigatórios identificados
- ✅ **Tabelas Z disponíveis**: Verificado que ZIV está livre para uso

#### 2. Dicionário ZIV010 Criado na CAPULHLG (CONCLUÍDO)
- ✅ **SX2010**: 1 registro da tabela criado
  - Alias: ZIV
  - Nome: HISTORICO INVENTARIO SISTEMA
  - Arquivo: ZIV010
  - Modo: Compartilhado (C)

- ✅ **SX3010**: 38 campos criados
  - 22 campos Character
  - 11 campos Numéricos
  - 5 campos Data

- ✅ **SIX010**: 4 índices criados
  1. Chave primária: FILIAL + INVNOM + CODIGO + LOTECT + ARMAZE
  2. Por data: FILIAL + DTOS(INVDAT) + ARMAZE
  3. Por produto: FILIAL + CODIGO
  4. Por status: FILIAL + STATUS

#### 3. Documentação Criada (CONCLUÍDO)
- ✅ **PLANO_INTEGRACAO_PROTHEUS_v1.0.md**: Plano detalhado de integração (55 páginas)
  - Análise completa SB7 e SD3
  - Estrutura da ZIV010 proposta
  - Mapeamento de dados
  - Regras de negócio
  - API de integração
  - Cronograma

- ✅ **scripts/create_ziv_sx3.sql**: Script SQL com todos os 38 campos da ZIV

---

## 🎯 PRÓXIMAS ETAPAS

### FASE 1: Criação da Tabela Física no Oracle (1-2 horas)

**Objetivo**: Criar a tabela física ZIV010 no banco de dados Oracle

**Tarefas**:
1. **Conectar ao Protheus** via SmartClient ou SIGACFG
2. **Executar atualização de dicionário**:
   - Menu: Atualização de Dicionários
   - Selecionar: Tabelas
   - Processar tabela ZIV
3. **Verificar criação da tabela física**:
   ```sql
   SELECT * FROM TOTVS_PRD.ZIV010 WHERE ROWNUM <= 1;
   DESC TOTVS_PRD.ZIV010;
   ```
4. **Validar índices criados**:
   ```sql
   SELECT INDEX_NAME, COLUMN_NAME
   FROM ALL_IND_COLUMNS
   WHERE TABLE_NAME = 'ZIV010'
   ORDER BY INDEX_NAME, COLUMN_POSITION;
   ```

**Responsável**: Analista Protheus ou DBA

**Dependências**: Acesso ao ambiente CAPULHLG

**Resultado Esperado**: Tabela ZIV010 criada fisicamente no Oracle com todos os campos e índices

---

### FASE 2: Criar API REST no Protheus (3-5 dias)

**Objetivo**: Criar endpoint REST no Protheus para receber dados de inventário

#### 2.1 Criar Web Service REST (AdvPL)

**Arquivo**: `WSINV001.prw`

**Estrutura**:
```advpl
#INCLUDE "PROTHEUS.CH"
#INCLUDE "RESTFUL.CH"

/*/{Protheus.doc} WSINV001
    Web Service REST para integração de inventário
    @type  Function
    @author Sistema Inventário
    @since  24/11/2025
/*/
WSRESTFUL INVENTARIO DESCRIPTION "API Inventario Sistema Auxiliar"

    WSDATA filial       AS STRING
    WSDATA invnom       AS STRING
    WSDATA invdat       AS DATE

    WSMETHOD POST ZIV_HISTORICO ;
        DESCRIPTION "Grava historico do inventario" ;
        WSSYNTAX "/inventario/historico" ;
        PATH "/inventario/historico"

END WSRESTFUL

/*/{Protheus.doc} POST ZIV_HISTORICO
    Recebe JSON com dados do inventário e grava na ZIV010
    @type  Method
    @author Sistema Inventário
    @since  24/11/2025
/*/
WSMETHOD POST ZIV_HISTORICO WSRECEIVE WSREST INVENTARIO

    Local lRet       := .T.
    Local oJson      := Nil
    Local cBody      := ::GetContent()
    Local aErros     := {}
    Local nRecords   := 0

    // Parse JSON
    oJson := JsonObject():New()
    lRet  := oJson:FromJson(cBody)

    If !lRet
        SetRestFault(400, "JSON invalido")
        Return .F.
    EndIf

    // Processar registros
    BEGIN TRANSACTION

        nRecords := ProcessaInventario(oJson, @aErros)

        If Len(aErros) > 0
            DisarmTransaction()
            SetRestFault(500, "Erro ao gravar: " + aErros[1])
            lRet := .F.
        EndIf

    END TRANSACTION

    // Retornar resposta
    If lRet
        ::SetResponse('{"success": true, "records": ' + cValToChar(nRecords) + '}')
    EndIf

Return lRet

/*/{Protheus.doc} ProcessaInventario
    Processa o JSON e grava registros na ZIV010
    @type  Function
    @author Sistema Inventário
    @since  24/11/2025
/*/
Static Function ProcessaInventario(oJson, aErros)

    Local nRecords := 0
    Local nI       := 0
    Local oItem    := Nil

    DbSelectArea("ZIV")
    ZIV->(DbSetOrder(1)) // FILIAL + INVNOM + CODIGO + LOTECT + ARMAZE

    For nI := 1 To Len(oJson["items"])

        oItem := oJson["items"][nI]

        RecLock("ZIV", .T.)
            ZIV->ZIV_FILIAL := oItem["filial"]
            ZIV->ZIV_INVNOM := oItem["invnom"]
            ZIV->ZIV_INVDAT := STOD(oItem["invdat"])
            ZIV->ZIV_ARMAZE := oItem["armaze"]
            ZIV->ZIV_ARMCOM := oItem["armcom"]
            ZIV->ZIV_TIPO   := oItem["tipo"]
            ZIV->ZIV_CODIGO := oItem["codigo"]
            ZIV->ZIV_DESCRI := oItem["descri"]
            ZIV->ZIV_LOTECT := oItem["lotect"]
            ZIV->ZIV_LOTEFO := oItem["lotefo"]
            ZIV->ZIV_SALDO  := oItem["saldo"]
            ZIV->ZIV_ENTPOS := oItem["entpos"]
            ZIV->ZIV_CONT1  := oItem["cont1"]
            ZIV->ZIV_CONT2  := oItem["cont2"]
            ZIV->ZIV_CONT3  := oItem["cont3"]
            ZIV->ZIV_USRC1  := oItem["usrc1"]
            ZIV->ZIV_USRC2  := oItem["usrc2"]
            ZIV->ZIV_USRC3  := oItem["usrc3"]
            ZIV->ZIV_DATC1  := IIF(Empty(oItem["datc1"]), STOD(""), STOD(oItem["datc1"]))
            ZIV->ZIV_DATC2  := IIF(Empty(oItem["datc2"]), STOD(""), STOD(oItem["datc2"]))
            ZIV->ZIV_DATC3  := IIF(Empty(oItem["datc3"]), STOD(""), STOD(oItem["datc3"]))
            ZIV->ZIV_HORAC1 := oItem["horac1"]
            ZIV->ZIV_HORAC2 := oItem["horac2"]
            ZIV->ZIV_HORAC3 := oItem["horac3"]
            ZIV->ZIV_QTFINA := oItem["qtfina"]
            ZIV->ZIV_DIFERE := oItem["difere"]
            ZIV->ZIV_VLRDIF := oItem["vlrdif"]
            ZIV->ZIV_CUSTOM := oItem["custom"]
            ZIV->ZIV_STATUS := oItem["status"]
            ZIV->ZIV_QTRANS := oItem["qtrans"]
            ZIV->ZIV_ARMTRA := oItem["armtra"]
            ZIV->ZIV_TIPTR  := oItem["tiptr"]
            ZIV->ZIV_ECONOM := oItem["econom"]
            ZIV->ZIV_OBSERV := oItem["observ"]
            ZIV->ZIV_USRINC := oItem["usrinc"]
            ZIV->ZIV_DATINC := Date()
            ZIV->ZIV_HORINC := Time()
            ZIV->ZIV_ORIGIN := "CAPUL_INV"
        MsUnlock()

        nRecords++

    Next nI

Return nRecords
```

**Tarefas**:
1. Criar arquivo `WSINV001.prw` no repositório de fontes
2. Compilar no ambiente CAPULHLG
3. Cadastrar no configurador (SIGACFG)
4. Testar endpoint via Postman/Insomnia

**Responsável**: Analista Protheus Sênior

**Tempo estimado**: 2-3 dias

---

### FASE 3: Criar Endpoint de Envio no Sistema Inventário (2-3 dias)

**Objetivo**: Criar endpoint Python para enviar dados ao Protheus

**Arquivo**: `backend/app/api/v1/endpoints/integration_ziv.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import httpx
from datetime import datetime

router = APIRouter()

# Configurações
PROTHEUS_API_URL = "https://apiportal.capul.com.br/rest/api/INVENTARIO/historico"
PROTHEUS_AUTH = "QVBJQ0FQVUw6QXAxQzRwdTFQUkQ="  # Base64 de "APICAPUL:Ap1C4pu1PRD"

@router.post("/integration/protheus/send-ziv")
async def send_inventory_to_protheus(
    inventory_id: str,
    db: Session = Depends(get_db)
):
    """
    Envia dados do inventário para o Protheus (tabela ZIV010)
    """

    # 1. Buscar dados do inventário
    inventory = db.query(InventoryList).filter(
        InventoryList.id == inventory_id
    ).first()

    if not inventory:
        raise HTTPException(status_code=404, detail="Inventário não encontrado")

    # 2. Buscar itens do inventário com snapshot
    query = """
        SELECT
            il.store_id,
            il.name as inv_nome,
            il.closed_at as inv_data,
            il.warehouse as armazem_principal,
            ii.product_code,
            ii.expected_quantity as saldo_sistema,
            ii.count_cycle_1,
            ii.count_cycle_2,
            ii.count_cycle_3,
            sn.b1_desc as descricao,
            sn.b2_xentpos as entrega_posterior,
            sn.b2_cm1 as custo_medio,
            ls.b8_lotectl as lote,
            ls.b8_lotefor as lote_fornecedor,
            c1.username as usuario_ciclo1,
            c1.created_at as data_ciclo1,
            c2.username as usuario_ciclo2,
            c2.created_at as data_ciclo2,
            c3.username as usuario_ciclo3,
            c3.created_at as data_ciclo3
        FROM inventario.inventory_items ii
        LEFT JOIN inventario.inventory_lists il ON il.id = ii.inventory_list_id
        LEFT JOIN inventario.snapshot_data sn ON sn.inventory_list_id = il.id
            AND sn.product_code = ii.product_code
        LEFT JOIN inventario.inventory_lots_snapshot ls ON ls.inventory_list_id = il.id
            AND ls.product_code = ii.product_code
        LEFT JOIN inventario.countings c1 ON c1.inventory_item_id = ii.id AND c1.cycle_number = 1
        LEFT JOIN inventario.countings c2 ON c2.inventory_item_id = ii.id AND c2.cycle_number = 2
        LEFT JOIN inventario.countings c3 ON c3.inventory_item_id = ii.id AND c3.cycle_number = 3
        WHERE ii.inventory_list_id = :inventory_id
    """

    items = db.execute(query, {"inventory_id": inventory_id}).fetchall()

    # 3. Montar JSON para envio
    json_data = {
        "items": []
    }

    for item in items:
        # Calcular quantidade final (último ciclo não nulo)
        qtd_final = item.count_cycle_3 or item.count_cycle_2 or item.count_cycle_1 or 0
        diferenca = qtd_final - (item.saldo_sistema or 0)
        valor_diferenca = diferenca * (item.custo_medio or 0)

        # Determinar status
        if qtd_final == 0 and item.saldo_sistema == 0:
            status = "Z"  # Zero confirmado
        elif diferenca != 0:
            status = "D"  # Divergente
        elif item.count_cycle_1 is None:
            status = "P"  # Pendente
        else:
            status = "C"  # Conferido

        json_data["items"].append({
            "filial": item.store_id,
            "invnom": item.inv_nome[:50],
            "invdat": item.inv_data.strftime("%Y%m%d"),
            "armaze": item.armazem_principal,
            "armcom": "",  # Se comparativo
            "tipo": "S",  # S=Simples, C=Comparativo
            "codigo": item.product_code,
            "descri": (item.descricao or "")[:50],
            "lotect": (item.lote or "")[:40],
            "lotefo": (item.lote_fornecedor or "")[:40],
            "saldo": float(item.saldo_sistema or 0),
            "entpos": float(item.entrega_posterior or 0),
            "cont1": float(item.count_cycle_1 or 0),
            "cont2": float(item.count_cycle_2 or 0),
            "cont3": float(item.count_cycle_3 or 0),
            "usrc1": (item.usuario_ciclo1 or "")[:30],
            "usrc2": (item.usuario_ciclo2 or "")[:30],
            "usrc3": (item.usuario_ciclo3 or "")[:30],
            "datc1": item.data_ciclo1.strftime("%Y%m%d") if item.data_ciclo1 else "",
            "datc2": item.data_ciclo2.strftime("%Y%m%d") if item.data_ciclo2 else "",
            "datc3": item.data_ciclo3.strftime("%Y%m%d") if item.data_ciclo3 else "",
            "horac1": item.data_ciclo1.strftime("%H:%M:%S") if item.data_ciclo1 else "",
            "horac2": item.data_ciclo2.strftime("%H:%M:%S") if item.data_ciclo2 else "",
            "horac3": item.data_ciclo3.strftime("%H:%M:%S") if item.data_ciclo3 else "",
            "qtfina": float(qtd_final),
            "difere": float(diferenca),
            "vlrdif": float(valor_diferenca),
            "custom": float(item.custo_medio or 0),
            "status": status,
            "qtrans": 0.0,  # Se transferência
            "armtra": "",
            "tiptr": "",
            "econom": 0.0,
            "observ": "",
            "usrinc": "SIST_INV"
        })

    # 4. Enviar para Protheus
    headers = {
        "Authorization": f"Basic {PROTHEUS_AUTH}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient(verify=False, timeout=300.0) as client:
        response = await client.post(
            PROTHEUS_API_URL,
            json=json_data,
            headers=headers
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Erro ao enviar para Protheus: {response.text}"
        )

    # 5. Retornar resultado
    result = response.json()

    return {
        "success": True,
        "inventory_id": inventory_id,
        "records_sent": len(json_data["items"]),
        "protheus_response": result
    }
```

**Tarefas**:
1. Criar arquivo `integration_ziv.py`
2. Registrar router no `main.py`
3. Criar testes unitários
4. Criar página no frontend para acionar integração

**Responsável**: Desenvolvedor Backend Python

**Tempo estimado**: 2 dias

---

### FASE 4: Implementar Geração de SB7 e SD3 (5-7 dias)

**Objetivo**: Criar rotinas para gerar movimentações de inventário (SB7) e transferências (SD3) no Protheus

#### 4.1 Rotina de Geração SB7 (Ajuste de Inventário)

**Arquivo**: `MATA270A.prw` (customização)

**Lógica**:
1. Ler dados da ZIV010
2. Para cada item com divergência (ZIV_DIFERE <> 0):
   - Gerar linha no SB7010
   - Campos obrigatórios:
     - B7_FILIAL, B7_COD, B7_LOCAL, B7_DOC, B7_DATA
     - B7_QUANT, B7_DESC, B7_TIPO, B7_LOTECTL
3. Processar ajuste de estoque (MATA270)

#### 4.2 Rotina de Geração SD3 (Transferência)

**Arquivo**: `MATA261A.prw` (customização)

**Lógica**:
1. Ler dados da ZIV010 onde ZIV_QTRANS > 0
2. Para cada transferência:
   - Gerar 2 registros no SD3010:
     - Saída (D3_TM = "RE3")
     - Entrada (D3_TM = "RE4")
   - Campos obrigatórios:
     - D3_FILIAL, D3_COD, D3_LOCAL, D3_TM, D3_DOC, D3_EMISSAO
     - D3_QUANT, D3_UM, D3_TIPO, D3_GRUPO, D3_CUSTO1
3. Processar transferência (MATA261)

**Responsável**: Analista Protheus Sênior

**Tempo estimado**: 5-7 dias

---

### FASE 5: Testes e Validação (3-5 dias)

#### 5.1 Testes Unitários
- [ ] Teste de gravação na ZIV010
- [ ] Teste de geração de SB7
- [ ] Teste de geração de SD3
- [ ] Teste de validação de campos obrigatórios

#### 5.2 Testes de Integração
- [ ] Teste end-to-end: Sistema Inventário → Protheus
- [ ] Teste de rollback em caso de erro
- [ ] Teste de performance (1000+ registros)
- [ ] Teste de concorrência

#### 5.3 Testes de Aceitação
- [ ] Validação com usuários chave
- [ ] Validação com equipe fiscal
- [ ] Validação com gestão

**Responsável**: QA + Analistas + Usuários Chave

**Tempo estimado**: 3-5 dias

---

## 📋 CHECKLIST DE CONTINUAÇÃO

### Antes de Continuar
- [ ] Revisar documento **PLANO_INTEGRACAO_PROTHEUS_v1.0.md**
- [ ] Verificar se a tabela ZIV está no dicionário (SX2/SX3/SIX)
- [ ] Confirmar acesso ao ambiente CAPULHLG
- [ ] Definir analista Protheus responsável
- [ ] Agendar reunião de alinhamento com equipe

### Durante o Desenvolvimento
- [ ] Manter documentação atualizada
- [ ] Criar logs de todas as operações
- [ ] Implementar tratamento de erros robusto
- [ ] Fazer commits frequentes com mensagens claras
- [ ] Realizar code review

### Antes do Deploy em Produção
- [ ] Todos os testes passando (unitários + integração)
- [ ] Documentação de usuário criada
- [ ] Manual de troubleshooting criado
- [ ] Backup do dicionário e fontes
- [ ] Aprovação formal da gestão

---

## 🔧 AMBIENTES

### CAPULHLG (Homologação)
- **Banco**: Oracle 192.168.7.92:1521/capulhlg
- **Usuário**: totvs_prd / totvs_prd
- **Status**: Dicionário ZIV criado ✅

### CAPULBI (Produção)
- **Banco**: Oracle 192.168.7.92:1521/capulbi
- **Status**: Aguardando deploy após testes

---

## 📞 PONTOS DE CONTATO

| Função | Responsável | Contato |
|--------|-------------|---------|
| Gestor TI | (a definir) | |
| Analista Protheus | (a definir) | |
| Desenvolvedor Backend | (a definir) | |
| QA | (a definir) | |
| Usuário Chave | (a definir) | |

---

## 📚 DOCUMENTOS DE REFERÊNCIA

1. **PLANO_INTEGRACAO_PROTHEUS_v1.0.md** - Plano completo de integração
2. **scripts/create_ziv_sx3.sql** - Script de criação dos campos
3. **CLAUDE.md** - Documentação principal do projeto
4. **CHANGELOG_RECENTE_v2.15-v2.18.md** - Histórico de versões

---

## ⚠️ PONTOS DE ATENÇÃO

### Decisões Pendentes
1. **Nome da rotina de integração**: Automática vs Manual com preview?
2. **Momento da geração SB7/SD3**: Junto com ZIV ou separado?
3. **Tratamento de erros**: Rollback total ou parcial?
4. **Logs**: Onde armazenar (Protheus, Sistema Inventário, ambos)?
5. **Notificações**: Email/SMS quando integração concluir?

### Riscos Identificados
1. **Performance**: Inventários grandes (10.000+ itens) podem ser lentos
   - **Mitigação**: Processar em lotes de 500 registros
2. **Concorrência**: Múltiplos inventários simultâneos
   - **Mitigação**: Fila de processamento
3. **Falhas de rede**: API pode cair durante envio
   - **Mitigação**: Retry automático + log de falhas
4. **Validações Protheus**: Campos podem ter validações não documentadas
   - **Mitigação**: Testes extensivos em homologação

---

## 🎯 CRITÉRIOS DE SUCESSO

### MVP (Mínimo Viável)
- [ ] Gravar histórico completo na ZIV010
- [ ] API REST funcionando
- [ ] Logs de todas operações
- [ ] Tratamento de erros básico

### Versão Completa
- [ ] Geração automática de SB7
- [ ] Geração automática de SD3
- [ ] Dashboard de acompanhamento
- [ ] Notificações por email
- [ ] Relatórios de auditoria

---

## 📅 CRONOGRAMA ESTIMADO

| Fase | Duração | Início | Fim | Status |
|------|---------|--------|-----|--------|
| Análise e Dicionário | 4h | 24/11 09:00 | 24/11 13:00 | ✅ Concluído |
| Criação Tabela Física | 2h | (a definir) | (a definir) | ⏳ Aguardando |
| API REST Protheus | 3 dias | (a definir) | (a definir) | ⏳ Aguardando |
| Endpoint Python | 2 dias | (a definir) | (a definir) | ⏳ Aguardando |
| Rotinas SB7/SD3 | 7 dias | (a definir) | (a definir) | ⏳ Aguardando |
| Testes | 5 dias | (a definir) | (a definir) | ⏳ Aguardando |
| **TOTAL** | **~20 dias úteis** | | | |

---

## 💡 SUGESTÕES DE MELHORIA FUTURA

1. **Dashboard de Integração**
   - Status em tempo real
   - Gráficos de sucesso/falha
   - Histórico de integrações

2. **Sincronização Bidirecional**
   - Protheus → Sistema Inventário
   - Atualizar saldos em tempo real

3. **Integração com BI**
   - ZIV como fonte de dados para análises
   - Dashboards gerenciais

4. **Automação Completa**
   - Ao finalizar inventário, enviar automaticamente
   - Gerar SB7/SD3 sem intervenção manual

---

**Documento criado em:** 24/11/2025
**Última atualização:** 24/11/2025
**Versão:** 1.0
**Status:** ATIVO - AGUARDANDO CONTINUAÇÃO

---

## 🚀 PRÓXIMA SESSÃO

**Para retomar o projeto:**

1. Abra este documento: `PLANO_CONTINUIDADE_INTEGRACAO_PROTHEUS.md`
2. Revise a seção "SITUAÇÃO ATUAL"
3. Escolha a próxima fase (recomendado: FASE 1 - Criação da Tabela Física)
4. Consulte o arquivo `PLANO_INTEGRACAO_PROTHEUS_v1.0.md` para detalhes técnicos
5. Execute as tarefas da fase escolhida

**Comando para Claude:**
> "Continue o projeto de integração Protheus a partir da FASE X do arquivo PLANO_CONTINUIDADE_INTEGRACAO_PROTHEUS.md"
