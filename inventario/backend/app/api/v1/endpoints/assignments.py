"""
Endpoints para Atribuição de Contadores - Versão Simplificada
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, case
from datetime import datetime
import logging
import jwt
import uuid
from app.core.exceptions import safe_error_response

from app.core.database import get_db
from app.core.security import get_current_active_user, get_current_user
from app.models.models import (
    InventoryList as InventoryListModel,
    InventoryItem as InventoryItemModel,
    User as UserModel,
    Store,  # ✅ v2.9.3: Necessário para buscar nome da loja
    CountingAssignment as CountingAssignmentModel,
    CountingList as CountingListModel,  # ✅ ADICIONADO PARA REATRIBUIÇÃO DE LISTA
    CountingListItem,  # ✅ v2.9.3.1: Necessário para contar itens das listas
    CountingStatus,
    SB1010,  # ✅ NECESSÁRIO PARA CONTROLE DE LOTE
    SBZ010,  # ✅ v2.17.4: Localizações físicas
    SB2010,  # ✅ v2.17.4: Saldo em estoque
    SB8010,  # ✅ v2.17.4: Saldo por lote
)
from sqlalchemy import text  # ✅ v2.17.4: Para queries SQL raw

# =================================
# CONFIGURAÇÃO DO ROUTER
# =================================

router = APIRouter()
logger = logging.getLogger(__name__)
security = HTTPBearer()

# =================================
# AUTENTICAÇÃO LOCAL
# =================================

# ✅ CORREÇÃO: Função get_current_user duplicada REMOVIDA
# A função correta está importada de app.core.security (linha 15)
# Esta função estava causando erro pois usava payload["sub"] como username (ERRADO - é user_id)
#
# def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
#     # FUNÇÃO DUPLICADA REMOVIDA - NÃO USAR

# =================================
# ENDPOINTS DE ATRIBUIÇÃO SIMPLIFICADA
# =================================
# 
# Este arquivo contém os endpoints para gerenciamento
# de atribuições de contagem de inventário:
#
# 1. TESTE: Endpoints básicos de teste
# 2. PRODUTOS: Buscar produtos por ciclo
# 3. USUÁRIOS: Listar usuários disponíveis  
# 4. ATRIBUIÇÕES: Criar e gerenciar atribuições
# 5. LISTAS: Gerenciar listas de contagem
# 6. STATUS: Controlar status das listas
#
# =================================


@router.get("/health")
async def health_check():
    """Health check do router assignments"""
    return {"status": "healthy", "service": "assignments"}

@router.delete("/inventory/{inventory_id}/items/{item_id}/remove-from-list")
async def remove_item_from_list(
    inventory_id: str,
    item_id: str,
    db: Session = Depends(get_db)
):
    """
    Remove produto da lista de contagem (torna disponível para nova lista)
    - Remove atribuições
    - Remove contagens
    - Marca is_available_for_assignment = TRUE
    """
    try:
        # Buscar item do inventário
        item = db.query(InventoryItemModel).filter(
            InventoryItemModel.id == item_id,
            InventoryItemModel.inventory_list_id == inventory_id
        ).first()
        
        if not item:
            raise HTTPException(status_code=404, detail="Item não encontrado")
        
        # 🔧 CORREÇÃO: Remover da tabela counting_list_items (NOVA ARQUITETURA)
        from app.models.models import CountingListItem
        deleted_list_items = db.query(CountingListItem).filter(
            CountingListItem.inventory_item_id == item_id
        ).delete()
        logger.info(f"✅ Removido {deleted_list_items} registro(s) de counting_list_items para item {item_id}")

        # Remover atribuições relacionadas (ARQUITETURA ANTIGA - manter para compatibilidade)
        deleted_assignments = db.query(CountingAssignmentModel).filter(
            CountingAssignmentModel.inventory_item_id == item_id
        ).delete()
        logger.info(f"✅ Removido {deleted_assignments} registro(s) de counting_assignments para item {item_id}")

        # Remover contagens relacionadas
        from app.models.models import Counting
        deleted_countings = db.query(Counting).filter(
            Counting.inventory_item_id == item_id
        ).delete()
        logger.info(f"✅ Removido {deleted_countings} registro(s) de counting para item {item_id}")

        # Marcar como disponível para nova lista e resetar status
        item.is_available_for_assignment = True
        item.status = CountingStatus.PENDING
        item.last_counted_at = None
        item.last_counted_by = None

        logger.info(f"✅ Item {item.product_code} ({item_id}) marcado como disponível para nova lista")
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Produto {item.product_code} removido da lista e disponibilizado para nova atribuição"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao remover produto da lista"))

@router.delete("/inventory/{inventory_id}/items/{item_id}/remove-from-inventory")
async def remove_item_from_inventory(
    inventory_id: str,
    item_id: str,
    db: Session = Depends(get_db)
):
    """
    Remove produto completamente do inventário
    - Remove atribuições, contagens e divergências
    - Remove o item da tabela inventory_items
    """
    try:
        # Buscar item do inventário
        item = db.query(InventoryItemModel).filter(
            InventoryItemModel.id == item_id,
            InventoryItemModel.inventory_list_id == inventory_id
        ).first()
        
        if not item:
            raise HTTPException(status_code=404, detail="Item não encontrado")
        
        product_code = item.product_code
        
        # Remover todas as dependências em ordem
        # 1. Divergências
        from app.models.models import Discrepancy
        db.query(Discrepancy).filter(
            Discrepancy.inventory_item_id == item_id
        ).delete()
        
        # 2. Contagens
        from app.models.models import Counting
        db.query(Counting).filter(
            Counting.inventory_item_id == item_id
        ).delete()
        
        # 3. Atribuições
        db.query(CountingAssignmentModel).filter(
            CountingAssignmentModel.inventory_item_id == item_id
        ).delete()
        
        # 4. Remover o item do inventário
        db.delete(item)
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Produto {product_code} removido completamente do inventário"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=safe_error_response(e, "ao remover produto do inventário"))

@router.get("/inventory/{inventory_id}/products-by-cycle")
async def get_products_by_cycle_type(
    inventory_id: str,
    counting_type: str = Query("PRIMEIRA_CONTAGEM", description="PRIMEIRA_CONTAGEM|RECONTAGEM|CONTAGEM_FINAL"),
    db: Session = Depends(get_db)
):
    """
    Lista produtos baseado no tipo de ciclo de inventário
    
    Tipos de contagem:
    - PRIMEIRA_CONTAGEM: Todos os produtos do inventário
    - RECONTAGEM: Apenas produtos com divergência (ciclo 2)
    - CONTAGEM_FINAL: Produtos ainda com divergência (ciclo 3)
    """
    
    print(f"🔥 DEBUG: Endpoint chamado com counting_type='{counting_type}' para inventário {inventory_id}")
    
    try:
        # Buscar inventário
        inventory = db.query(InventoryListModel).filter(
            InventoryListModel.id == inventory_id
        ).first()
        
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventory not found"
            )
        
        # Query base para produtos do inventário
        products_query = db.query(InventoryItemModel).filter(
            InventoryItemModel.inventory_list_id == inventory_id
        )
        
        print(f"🚨 DEBUG: Aplicando filtro para counting_type='{counting_type}'")
        
        # Aplicar filtro baseado no tipo de contagem
        if counting_type in ["RECONTAGEM", "CONTAGEM_FINAL"]:
            # Para ciclos 2 e 3, buscar apenas produtos com divergências pendentes
            # Por enquanto, vamos simular - retornar lista vazia
            products = []
            print(f"📝 DEBUG: Retornando lista vazia para {counting_type}")
        elif counting_type == "PRIMEIRA_CONTAGEM":
            print(f"🚨 DEBUG: PRIMEIRA_CONTAGEM solicitada para inventário {inventory_id}")
            
            # PRIMEIRA_CONTAGEM - mostrar apenas produtos DISPONÍVEIS para nova lista
            # NOVA LÓGICA: Usar campo is_available_for_assignment para controle direto
            print(f"🔍 DEBUG: Filtrando produtos disponíveis (is_available_for_assignment = True)")
            
            products = products_query.filter(
                InventoryItemModel.is_available_for_assignment == True
            ).all()
            
            # Debug detalhado
            total_items = products_query.count()
            available_count = len(products)
            unavailable_count = total_items - available_count
            
            print(f"📊 DEBUG: Inventário {inventory_id}")
            print(f"📦 DEBUG: Total de itens no inventário: {total_items}")
            print(f"🔒 DEBUG: Itens indisponíveis para lista: {unavailable_count}")
            print(f"✅ DEBUG: Itens disponíveis para nova lista: {available_count}")
            
            if available_count == 0:
                print(f"⚠️ DEBUG: NENHUM produto disponível - todos já estão em listas!")
            else:
                print(f"✅ DEBUG: {available_count} produtos disponíveis para atribuição")
                
        else:
            # Fallback - todos os produtos
            print(f"⚠️ DEBUG: Fallback - retornando todos os produtos para counting_type desconhecido: {counting_type}")
            products = products_query.all()
        
        # Otimização: Buscar todos os detalhes de produtos, localizações E ESTOQUES de uma vez
        # ✅ v2.17.4: Imports movidos para o topo do arquivo
        product_codes = [item.product_code for item in products]

        print(f"🔍 DEBUG: Extraídos {len(product_codes)} códigos de produtos")
        print(f"📋 DEBUG: Primeiros 3 códigos: {product_codes[:3] if product_codes else 'Lista vazia'}")

        # Buscar detalhes de todos os produtos de uma vez (com TRIM para resolver padding)
        product_details_map = {}
        if product_codes:
            print(f"🔄 DEBUG: Iniciando query SB1010 para {len(product_codes)} produtos...")
            # ✅ v2.17.4 - Corrigir uso de func.trim() em strings Python
            trimmed_codes = [code.strip() for code in product_codes]
            print(f"🔍 DEBUG: trimmed_codes preparado com {len(trimmed_codes)} códigos")

            try:
                products_sb1 = db.query(SB1010).filter(
                    func.trim(SB1010.b1_cod).in_(trimmed_codes)
                ).all()
                print(f"✅ DEBUG: Query SB1010 executada com sucesso! Retornados {len(products_sb1)} produtos")
            except Exception as query_error:
                print(f"❌ DEBUG: Erro na query SB1010: {str(query_error)}")
                raise

            # Mapear usando código sem espaços para garantir match
            for p in products_sb1:
                product_details_map[p.b1_cod.strip()] = p
            print(f"📊 DEBUG: product_details_map construído com {len(product_details_map)} entradas")
        
        # Buscar localizações SBZ010 seguindo estrutura Protheus (por filial)
        localizacao_details_map = {}
        if product_codes:
            filial_code = '01'  # Filial principal
            # ✅ v2.17.4 - Corrigir uso de func.trim() em strings Python
            trimmed_codes = [code.strip() for code in product_codes]
            localizacoes = db.query(SBZ010).filter(
                and_(
                    func.trim(SBZ010.bz_cod).in_(trimmed_codes),
                    SBZ010.bz_filial == filial_code  # Filtrar por filial também
                )
            ).all()
            # Mapear usando código trimado
            localizacao_details_map = {l.bz_cod.strip(): l for l in localizacoes}
        
        # 🔑 BUSCAR ESTOQUES DA SB2010 SEGUINDO ESTRUTURA PROTHEUS CORRETA
        stock_details_map = {}
        if product_codes:
            # 🏢 FIXAR FILIAL COMO '01' (padrão Protheus para filial principal)
            filial_code = '01'  # Sempre filial '01' conforme estrutura Protheus
            
            # 🔍 QUERY BASEADA NO SQL DO USUÁRIO - SB2 com filtros corretos
            # IMPORTANTE: Sistema MULTI-ARMAZÉM - usar armazém do inventário (com fallback)
            # REGRA: Cada inventário deve ter seu armazém específico cadastrado
            warehouse_code = getattr(inventory, 'warehouse', '01') or '01'
            warehouse_location = getattr(inventory, 'warehouse_location', '02') or '02'
            
            # ✅ v2.17.4 - Corrigir uso de func.trim() em strings Python
            trimmed_codes = [code.strip() for code in product_codes]
            stocks = db.query(SB2010).filter(
                and_(
                    func.trim(SB2010.b2_cod).in_(trimmed_codes),  # TRIM nos códigos
                    SB2010.b2_filial == filial_code,         # FILIAL = '01'
                    SB2010.b2_local == warehouse_code        # ARMAZÉM DO INVENTÁRIO (padrão '02')
                )
            ).all()
            
            stock_details_map = {
                s.b2_cod.strip(): s for s in stocks  # CHAVE POR CÓDIGO TRIMADO
            }
            
            print(f"🔍 DEBUG: === BUSCA DE ESTOQUES SB2010 ===")
            print(f"📋 DEBUG: Inventário ID: {inventory_id}")
            print(f"📋 DEBUG: Inventário Nome: {inventory.name if hasattr(inventory, 'name') else 'N/A'}")
            print(f"🏢 DEBUG: Filial (B2_FILIAL): {filial_code}")
            print(f"🏭 DEBUG: Armazém do Inventário (B2_LOCAL): {warehouse_code}")
            print(f"📦 DEBUG: Produtos solicitados: {len(product_codes)}")
            print(f"📝 DEBUG: Primeiros 3 códigos: {product_codes[:3] if product_codes else 'Nenhum'}")
            print(f"📊 DEBUG: Registros encontrados na SB2010: {len(stocks)}")
            if stocks:
                for i, stock in enumerate(stocks[:3]):  # Mostrar primeiros 3
                    print(f"   ✅ Produto {i+1}: {stock.b2_cod} - Qtd: {stock.b2_qatu}")
            else:
                print(f"   ❌ NENHUM registro encontrado para Filial={filial_code} e Armazém={warehouse_code}")
        
        # Construir resposta com informações detalhadas dos produtos
        products_data = []
        for item in products:
            # Buscar detalhes dos mapas (sem consultas adicionais) - usar código trimado
            product_details = product_details_map.get(item.product_code.strip())
            localizacao_details = localizacao_details_map.get(item.product_code.strip())  # Usar código trimado também para localizações
            stock_details = stock_details_map.get(item.product_code.strip())  # 🔑 ESTOQUE DA SB2010 - usar código trimado

            # ✅ v2.10.1 - CORREÇÃO: Produtos com lote usam SUM(B8_SALDO), não B2_QATU
            has_lot_control = product_details and product_details.b1_rastro == 'L'
            current_quantity = 0.0

            if has_lot_control:
                # Produto com controle de lote - somar SB8010.B8_SALDO
                print(f"🔍 Produto {item.product_code.strip()} tem controle de lote - calculando soma de SB8010.B8_SALDO")

                lot_sum_query = text("""
                    SELECT COALESCE(SUM(b8.b8_saldo), 0) as total_lot_qty
                    FROM inventario.sb8010 b8
                    WHERE b8.b8_produto = :product_code
                      AND b8.b8_filial = :filial
                      AND b8.b8_local = :warehouse
                      AND b8.b8_saldo > 0
                """)

                lot_sum_result = db.execute(lot_sum_query, {
                    'product_code': item.product_code.strip(),
                    'filial': filial_code,
                    'warehouse': warehouse_code
                }).fetchone()

                current_quantity = float(lot_sum_result[0]) if lot_sum_result else 0.0
                print(f"📊 Produto {item.product_code.strip()} - Soma de lotes: {current_quantity}")
            else:
                # Produto SEM controle de lote - usar B2_QATU
                current_quantity = float(stock_details.b2_qatu) if stock_details and stock_details.b2_qatu else 0.0
            
            product_data = {
                "item_id": str(item.id),
                "product_code": item.product_code,
                "sequence": item.sequence,
                "expected_quantity": float(item.expected_quantity) if item.expected_quantity else 0.0,
                "b2_qatu": float(item.b2_qatu) if item.b2_qatu else 0.0,  # ✅ USAR CAMPO GRAVADO NA INCLUSÃO
                "warehouse": item.warehouse,  # ✅ USAR ARMAZÉM GRAVADO NA INCLUSÃO
                "status": item.status,
                # Informações detalhadas do produto
                "product_name": product_details.b1_desc.strip() if product_details and product_details.b1_desc else "Produto não encontrado",
                "group": product_details.b1_grupo.strip() if product_details and product_details.b1_grupo else "",
                "category": product_details.b1_xcatgor.strip() if product_details and product_details.b1_xcatgor else "",
                "subcategory": product_details.b1_xsubcat.strip() if product_details and product_details.b1_xsubcat else "",
                "segment": product_details.b1_xsegmen.strip() if product_details and product_details.b1_xsegmen else "",
                "inv_group": product_details.b1_xgrinve.strip() if product_details and product_details.b1_xgrinve else "",
                # ✅ CORREÇÃO: Usar campos corretos da SBZ010 para localizações físicas
                "local1": localizacao_details.bz_xlocal1.strip() if localizacao_details and localizacao_details.bz_xlocal1 else "",
                "local2": localizacao_details.bz_xlocal2.strip() if localizacao_details and localizacao_details.bz_xlocal2 else "",
                "local3": localizacao_details.bz_xlocal3.strip() if localizacao_details and localizacao_details.bz_xlocal3 else "",
                # LOTE: Verificar campo B1_RASTRO (S=Sublote, L=Lote, N=Não controla)
                "has_lot": product_details and product_details.b1_rastro and product_details.b1_rastro in ['S', 'L'],
                "b1_rastro": product_details.b1_rastro if product_details and product_details.b1_rastro else 'N',
                "lot_number": "",   # Placeholder para número do lote
                # 🔑 CAMPOS DE ESTOQUE DA SB2010
                # ✅ v2.17.4 - Removida duplicação: "warehouse" já definido na linha 376
                "b2_qatu": current_quantity,       # QUANTIDADE ATUAL DA SB2010
                "current_quantity": current_quantity,  # ALIAS PARA COMPATIBILIDADE
                "inventory_warehouse": warehouse_code  # EXPLICITAMENTE ENVIAR O ARMAZÉM
            }
            products_data.append(product_data)
        
        return {
            "success": True,
            "message": f"Found {len(products_data)} products for {counting_type}",
            "data": {
                "inventory_id": inventory_id,
                "counting_type": counting_type,
                "total_products": len(products_data),
                "products": products_data
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # ✅ v2.17.4: Melhor logging do erro
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"🔥 ERRO DETALHADO ao buscar produtos: {str(e)}")
        logger.error(f"📋 Traceback completo:\n{error_trace}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "fetching products")
        )

@router.get("/inventory/{inventory_id}/available-users")
async def get_available_users_for_assignment(
    inventory_id: str,
    db: Session = Depends(get_db)
):
    """
    Lista todos os usuários ativos da loja que podem receber atribuições de contagem
    
    Retorna:
    - Lista de usuários (OPERATOR e SUPERVISOR) da mesma loja do inventário
    """
    
    try:
        # Buscar inventário e verificar se existe
        inventory = db.query(InventoryListModel).filter(
            InventoryListModel.id == inventory_id
        ).first()
        
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventory not found"
            )
        
        # Buscar usuários ativos da loja (exceto ADMIN)
        users = db.query(UserModel).filter(
            and_(
                UserModel.store_id == inventory.store_id,
                UserModel.is_active == True,
                UserModel.role.in_(['OPERATOR', 'SUPERVISOR'])
            )
        ).order_by(UserModel.full_name).all()
        
        users_data = [
            {
                "id": str(user.id),
                "username": user.username,
                "full_name": user.full_name,
                "role": user.role,
                "email": user.email
            }
            for user in users
        ]
        
        return {
            "success": True,
            "message": f"Found {len(users_data)} available users for assignment",
            "data": users_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "fetching available users")
        )

@router.post("/inventory/{inventory_id}/assign-by-criteria")
async def assign_counters_by_criteria(
    inventory_id: str,
    assignment_data: dict,
    db: Session = Depends(get_db)
):
    """
    Atribui contadores para produtos de um inventário baseado em critérios com suporte a ciclos
    
    Dados de entrada:
    - assigned_to: ID do usuário que receberá a atribuição
    - criteria: Critério de seleção ("all", "discrepancies", "pending")  
    - counting_type: Tipo de contagem ("PRIMEIRA_CONTAGEM", "RECONTAGEM", "CONTAGEM_FINAL")
    - notes: Observações sobre a atribuição
    - deadline: Data limite para conclusão (opcional)
    
    Retorna:
    - Relatório de atribuições criadas
    - Lista de sucessos e falhas
    """
    
    try:
        # Buscar inventário
        inventory = db.query(InventoryListModel).filter(
            InventoryListModel.id == inventory_id
        ).first()
        
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventory not found"
            )
        
        # ✅ v2.15.4: Validar usuário atribuído (sistema multi-filial)
        # Agora usa tabela user_stores para suportar usuários com múltiplas filiais
        from app.models.models import UserStore

        assigned_user_id = assignment_data.get("assigned_to")
        assigned_user = db.query(UserModel).join(
            UserStore, UserStore.user_id == UserModel.id
        ).filter(
            and_(
                UserModel.id == assigned_user_id,
                UserModel.is_active == True,
                UserStore.store_id == inventory.store_id  # ✅ Através de user_stores!
            )
        ).first()

        if not assigned_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assigned user not found or not from same store"
            )
        
        # 🔒 VALIDAÇÃO CRÍTICA: Verificar se usuário JÁ TEM LISTA DE CONTAGEM neste inventário
        from app.models.models import CountingList

        # Buscar TODAS as listas do usuário neste inventário
        all_user_lists = db.query(CountingList).filter(
            and_(
                CountingList.inventory_id == inventory_id,
                CountingList.counter_cycle_1 == assigned_user_id  # ✅ APENAS counter_cycle_1 (lista principal)
            )
        ).all()

        # Encontrar lista válida (ciclo 1 + aberta) para adicionar produtos
        valid_list_for_adding = None
        for list_item in all_user_lists:
            if list_item.current_cycle == 1 and list_item.list_status.upper() in ['ABERTA', 'OPEN', 'EM_ANDAMENTO']:
                valid_list_for_adding = list_item
                break

        # 🚨 REGRA CRÍTICA: Se usuário JÁ TEM lista neste inventário, NÃO pode criar nova
        # Apenas pode adicionar produtos se a lista existente estiver no ciclo 1 + aberta
        if all_user_lists and not valid_list_for_adding:
            # Pegar a primeira lista para mostrar no erro
            existing_counting_list = all_user_lists[0]
            list_cycle = existing_counting_list.current_cycle or 1
            list_status = (existing_counting_list.list_status or '').upper()

            logger.info(f"🔍 [VALIDAÇÃO BACKEND] Usuário tem {len(all_user_lists)} lista(s), mas nenhuma no ciclo 1 + aberta")
            logger.info(f"🔍 [VALIDAÇÃO BACKEND] Primeira lista: {existing_counting_list.list_name}, Ciclo: {list_cycle}, Status: {list_status}")

            # Mensagem mais específica
            if len(all_user_lists) > 1:
                return {
                    "success": False,
                    "message": f"❌ {assigned_user.full_name} possui {len(all_user_lists)} listas neste inventário, mas nenhuma está no 1º ciclo com status ABERTA. Novos produtos só podem ser adicionados em listas no 1º ciclo.",
                    "data": {
                        "assigned_count": 0,
                        "total_lists": len(all_user_lists),
                        "lists_info": [{"name": l.list_name, "cycle": l.current_cycle, "status": l.list_status} for l in all_user_lists[:3]]
                    }
                }
            else:
                # Validar se está no ciclo 1
                if list_cycle != 1:
                    return {
                        "success": False,
                        "message": f"❌ Não é possível adicionar produtos à lista de {assigned_user.full_name}. A lista está no {list_cycle}º ciclo. Novos produtos só podem ser adicionados no 1º ciclo.",
                        "data": {
                            "assigned_count": 0,
                            "list_cycle": list_cycle,
                            "list_status": list_status,
                            "list_name": existing_counting_list.list_name
                        }
                    }

                # Validar se está aberta
                if list_status not in ['ABERTA', 'OPEN', 'EM_ANDAMENTO', 'PENDING']:
                    return {
                        "success": False,
                        "message": f"❌ Não é possível adicionar produtos à lista de {assigned_user.full_name}. A lista está com status '{list_status}'. Novos produtos só podem ser adicionados a listas com status 'ABERTA'.",
                        "data": {
                            "assigned_count": 0,
                            "list_cycle": list_cycle,
                            "list_status": list_status,
                            "list_name": existing_counting_list.list_name
                        }
                    }
        elif valid_list_for_adding:
            logger.info(f"✅ [VALIDAÇÃO BACKEND] Lista válida encontrada: {valid_list_for_adding.list_name} (Ciclo 1, {valid_list_for_adding.list_status})")
        else:
            logger.info(f"ℹ️ [VALIDAÇÃO BACKEND] Contador não possui lista - criando nova lista")

        # ✅ VERIFICAR SE USUÁRIO JÁ TEM ASSIGNMENTS NESTE INVENTÁRIO (validação adicional)
        existing_assignments = db.query(CountingAssignmentModel).join(
            InventoryItemModel, CountingAssignmentModel.inventory_item_id == InventoryItemModel.id
        ).filter(
            InventoryItemModel.inventory_list_id == inventory_id,
            CountingAssignmentModel.assigned_to == assigned_user_id
        ).all()

        if existing_assignments:
            # Se todas as atribuições são PENDING, podemos adicionar novos produtos
            logger.info(f"⚠️ Usuário {assigned_user.full_name} já tem {len(existing_assignments)} produtos atribuídos. Adicionando novos produtos à lista existente.")
        
        # ✅ PROCESSAR FILTROS DE PRODUTOS ESPECÍFICOS
        filters = assignment_data.get("filters", {})
        product_ids = filters.get("product_ids", [])
        product_codes = filters.get("product_codes", [])  # 🔧 NOVO: aceitar product_codes
        item_ids = filters.get("item_ids", [])  # Manter compatibilidade

        print(f"🎯 DEBUG: Filtros recebidos: {filters}")
        print(f"📦 DEBUG: Product IDs específicos: {product_ids}")
        print(f"📦 DEBUG: Product Codes específicos: {product_codes}")
        print(f"📦 DEBUG: Item IDs específicos: {item_ids}")

        # Construir query base para itens do inventário
        items_query = db.query(InventoryItemModel).filter(
            InventoryItemModel.inventory_list_id == inventory_id
        )

        # ✅ FILTRAR POR PRODUTOS ESPECÍFICOS SE FORNECIDOS
        if product_ids:
            items_query = items_query.filter(InventoryItemModel.id.in_(product_ids))
            print(f"🔍 Filtrando por {len(product_ids)} product IDs específicos")
        elif product_codes:  # 🔧 NOVO: filtrar por códigos de produtos
            items_query = items_query.filter(InventoryItemModel.product_code.in_(product_codes))
            print(f"🔍 Filtrando por {len(product_codes)} códigos de produtos específicos: {product_codes}")
        elif item_ids:  # Manter compatibilidade
            items_query = items_query.filter(InventoryItemModel.id.in_(item_ids))
            print(f"🔍 Filtrando por {len(item_ids)} item IDs específicos")
        
        # ✅ FILTRAR PRODUTOS JÁ ATRIBUÍDOS A ESTE USUÁRIO
        if existing_assignments:
            # Obter IDs dos produtos já atribuídos ao usuário
            assigned_item_ids = [assignment.inventory_item_id for assignment in existing_assignments]
            items_query = items_query.filter(~InventoryItemModel.id.in_(assigned_item_ids))
            print(f"🔍 Filtrando {len(assigned_item_ids)} produtos já atribuídos ao usuário")
        
        # Aplicar filtros baseados nos critérios
        criteria = assignment_data.get("criteria", "all")
        counting_type = assignment_data.get("counting_type", "PRIMEIRA_CONTAGEM")
        
        # Filtrar por tipo de contagem
        if counting_type in ["RECONTAGEM", "CONTAGEM_FINAL"]:
            # Para ciclos 2 e 3, buscar apenas produtos com divergências
            # Por enquanto, simulando com lista vazia
            items = []
        else:
            # PRIMEIRA_CONTAGEM - produtos filtrados pelos critérios acima
            items = items_query.all()
            print(f"✅ DEBUG: {len(items)} produtos finais após todos os filtros")
        
        if not items:
            message = "Nenhum produto disponível para atribuição"
            if existing_assignments:
                message = f"Usuário {assigned_user.full_name} já tem todos os produtos disponíveis atribuídos neste inventário"
            
            return {
                "success": False,
                "message": message,
                "data": {
                    "assigned_count": 0,
                    "existing_assignments": len(existing_assignments) if existing_assignments else 0
                }
            }
        
        # ✅ CRIAR ATRIBUIÇÕES REAIS NA TABELA counting_assignments
        
        # Otimização: Buscar todas as atribuições existentes de uma vez
        item_ids = [item.id for item in items]
        existing_assignments_query = db.query(CountingAssignmentModel).filter(
            CountingAssignmentModel.inventory_item_id.in_(item_ids),
            CountingAssignmentModel.status.in_(["PENDING", "IN_PROGRESS", "COMPLETED"])
        ).all()
        
        # Criar mapa de atribuições existentes por item_id
        existing_assignments_map = {
            assignment.inventory_item_id: assignment for assignment in existing_assignments_query
        }
        
        successful_assignments = []
        failed_assignments = []
        
        for item in items:
            try:
                # Verificar se já existe atribuição para este item (consulta no mapa)
                existing_assignment = existing_assignments_map.get(item.id)
                
                if existing_assignment:
                    # Item já atribuído, pular
                    failed_assignments.append({
                        "item_id": str(item.id),
                        "product_code": item.product_code or "N/A",
                        "error": "Item já possui atribuição ativa"
                    })
                    continue
                
                # Determinar o número da contagem baseado no tipo
                count_number = 1
                if counting_type == "RECONTAGEM":
                    count_number = 2
                elif counting_type == "CONTAGEM_FINAL":
                    count_number = 3
                
                # ✅ CRIAR ATRIBUIÇÃO REAL NO BANCO
                new_assignment = CountingAssignmentModel(
                    inventory_item_id=item.id,
                    assigned_to=assignment_data.get("assigned_to"),
                    assigned_by=assignment_data.get("assigned_to"),  # Por enquanto, o mesmo usuário
                    status="PENDING",
                    count_number=count_number,
                    notes=assignment_data.get("notes", ""),
                    reason=assignment_data.get("notes", ""),  # Usar notes como reason
                    deadline=assignment_data.get("deadline")
                )
                
                db.add(new_assignment)
                db.flush()  # Flush para obter o ID
                
                # ✅ MARCAR PRODUTO COMO NÃO DISPONÍVEL PARA NOVA LISTA
                item.is_available_for_assignment = False
                
                successful_assignments.append({
                    "item_id": str(item.id),
                    "product_code": item.product_code or "N/A",
                    "assigned_to": assigned_user.full_name,
                    "count_number": count_number,
                    "counting_type": counting_type,
                    "assignment_id": str(new_assignment.id)
                })
                
            except Exception as e:
                failed_assignments.append({
                    "item_id": str(item.id),
                    "product_code": item.product_code or "N/A",
                    "reason": f"Error: {str(e)}"
                })
        
        # ✅ NOVA FUNCIONALIDADE: Definir counter_cycle_1 automaticamente
        # Se esta é a primeira atribuição do inventário, definir o usuário no ciclo 1
        if counting_type == "PRIMEIRA_CONTAGEM" and len(successful_assignments) > 0:
            if not inventory.counter_cycle_1:
                inventory.counter_cycle_1 = assigned_user_id
                inventory.current_cycle = 1
                print(f"✅ NOVO: Definindo {assigned_user.full_name} como responsável pelo ciclo 1")

                # Atualizar todos os itens do inventário para precisarem do ciclo 1
                db.query(InventoryItemModel).filter(
                    InventoryItemModel.inventory_list_id == inventory_id
                ).update({
                    "needs_recount_cycle_1": True,
                    "needs_recount_cycle_2": False,
                    "needs_recount_cycle_3": False
                })
                print(f"✅ NOVO: Todos os itens marcados para contagem no ciclo 1")

        # ✅ NOVO: CRIAR COUNTING_LIST quando produtos são atribuídos ao usuário
        if len(successful_assignments) > 0:
            from app.models.models import CountingList, CountingListItem

            # 🔍 CORREÇÃO: Buscar lista CORRETA do usuário (ciclo 1 + aberta)
            # Isso garante que se o usuário tiver múltiplas listas, pegamos a do ciclo 1
            existing_list = db.query(CountingList).filter(
                CountingList.inventory_id == inventory_id,
                CountingList.counter_cycle_1 == assigned_user_id,
                CountingList.current_cycle == 1,  # ✅ APENAS CICLO 1
                CountingList.list_status.in_(['ABERTA', 'OPEN', 'EM_ANDAMENTO'])  # ✅ APENAS ABERTA
            ).first()

            if not existing_list:
                # Criar nova counting_list
                user_name = assigned_user.full_name or assigned_user.username
                new_counting_list = CountingList(
                    inventory_id=inventory_id,
                    list_name=f"Lista {user_name}",
                    description=f"Lista de contagem do {user_name}",
                    counter_cycle_1=assigned_user_id,
                    current_cycle=1,
                    list_status="ABERTA",
                    created_by=assigned_user_id
                )

                db.add(new_counting_list)
                db.flush()  # Para obter o ID da lista

                print(f"✅ NOVO: Counting_list criada para {user_name} - ID: {new_counting_list.id}")

                # Criar counting_list_items para cada produto atribuído
                for assignment in successful_assignments:
                    new_list_item = CountingListItem(
                        counting_list_id=new_counting_list.id,
                        inventory_item_id=assignment["item_id"],
                        needs_count_cycle_1=True
                    )
                    db.add(new_list_item)

                print(f"✅ NOVO: {len(successful_assignments)} produtos adicionados à counting_list")
            else:
                # 🔧 CORREÇÃO CRÍTICA: Lista já existe, adicionar novos produtos a ela
                print(f"✅ INFO: Counting_list já existe para {assigned_user.full_name} - ID: {existing_list.id}")

                # Buscar IDs dos produtos já existentes na lista
                existing_list_items = db.query(CountingListItem).filter(
                    CountingListItem.counting_list_id == existing_list.id
                ).all()

                existing_item_ids = {str(item.inventory_item_id) for item in existing_list_items}
                print(f"📦 Lista tem {len(existing_item_ids)} produtos existentes")

                # Adicionar apenas produtos novos
                new_items_added = 0
                for assignment in successful_assignments:
                    if assignment["item_id"] not in existing_item_ids:
                        new_list_item = CountingListItem(
                            counting_list_id=existing_list.id,
                            inventory_item_id=assignment["item_id"],
                            needs_count_cycle_1=True
                        )
                        db.add(new_list_item)
                        new_items_added += 1

                print(f"✅ CORREÇÃO: {new_items_added} novos produtos adicionados à counting_list existente")

        # ✅ COMMIT das atribuições criadas
        db.commit()
        print(f"✅ COMMIT: {len(successful_assignments)} atribuições salvas no banco")
        
        return {
            "success": True,
            "message": f"Assignment completed: {len(successful_assignments)} successful, {len(failed_assignments)} failed",
            "data": {
                "inventory_id": inventory_id,
                "assigned_to": assigned_user.full_name,
                "criteria": criteria,
                "counting_type": counting_type,
                "successful_count": len(successful_assignments),
                "failed_count": len(failed_assignments),
                "successful_assignments": successful_assignments[:5],  # Mostrar apenas os primeiros 5
                "failed_assignments": failed_assignments
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "creating assignments")
        )

@router.get("/inventory/{inventory_id}/my-products")
async def get_my_products_in_inventory(
    inventory_id: str,
    user_id: str = Query(None, description="ID do usuário específico (opcional)"),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lista os produtos atribuídos ao usuário atual em um inventário específico
    
    Retorna apenas os produtos da lista de contagem do usuário logado.
    """
    try:
        # Por enquanto vamos simular. Em produção, buscar com base no usuário autenticado
        # e suas atribuições na tabela counting_assignments
        
        # Buscar produtos atribuídos ao usuário neste inventário
        query = db.query(CountingAssignmentModel).join(
            InventoryItemModel, CountingAssignmentModel.inventory_item_id == InventoryItemModel.id
        ).filter(
            InventoryItemModel.inventory_list_id == inventory_id,
            CountingAssignmentModel.status.in_(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'RELEASED'])
        )
        
        # ✅ CORREÇÃO: Usar current_user se user_id não foi fornecido
        target_user_id = user_id if user_id else str(current_user.id)
        logger.info(f"🔍 Filtrando atribuições para usuário: {current_user.full_name} (ID: {target_user_id})")
        query = query.filter(CountingAssignmentModel.assigned_to == target_user_id)
            
        user_products = query.all()

        if not user_products:
            return {
                "success": True,
                "message": "Nenhum produto atribuído para este usuário neste inventário",
                "data": {
                    "inventory_id": inventory_id,
                    "user_products": [],
                    "total_assigned": 0
                }
            }

        # Otimização: Buscar todos os detalhes de produtos de uma vez
        from app.models.models import SB1010, SBZ010
        product_codes = [assignment.inventory_item.product_code for assignment in user_products]
        product_details_map = {
            p.b1_cod: p for p in db.query(SB1010).filter(SB1010.b1_cod.in_(product_codes)).all()
        }
        
        # ✅ CORREÇÃO: Buscar contagens para cada item
        from app.models.models import Counting
        item_ids = [assignment.inventory_item_id for assignment in user_products]
        
        # ✅ CORREÇÃO: Buscar TODAS as contagens e somar por item_id (para produtos com lote)
        from sqlalchemy import func

        # Buscar soma total de todas as contagens por item_id (inclui todos os lotes)
        countings_sum_query = db.query(
            Counting.inventory_item_id,
            func.sum(Counting.quantity).label('total_quantity')
        ).filter(
            Counting.inventory_item_id.in_(item_ids)
        ).group_by(Counting.inventory_item_id).all()

        # Criar mapa de contagens TOTAIS por item_id
        countings_map = {}
        for counting_sum in countings_sum_query:
            countings_map[str(counting_sum.inventory_item_id)] = counting_sum.total_quantity
        
        # Construir lista de produtos com detalhes
        products_data = []
        for assignment in user_products:
            item = assignment.inventory_item
            
            # Buscar detalhes do produto do mapa (sem consulta adicional)
            product_details = product_details_map.get(item.product_code)
            
            # ✅ BUSCAR CONTAGEM REAL DA TABELA
            counted_quantity = countings_map.get(str(item.id))
            
            product_data = {
                "assignment_id": str(assignment.id),
                "item_id": str(item.id),
                "product_code": item.product_code,
                "product_name": product_details.b1_desc.strip() if product_details else f"Produto {item.product_code}",
                "sequence": item.sequence,
                "expected_quantity": float(item.expected_quantity) if item.expected_quantity else 0.0,
                "counted_quantity": float(counted_quantity) if counted_quantity is not None else None,
                "requires_lot": product_details.b1_rastro == 'L' if product_details else False,  # ✅ CORREÇÃO: Adicionar controle de lote
                # ✅ CORREÇÃO: Adicionar contagens por ciclo específico
                "count_1": float(item.count_cycle_1) if item.count_cycle_1 is not None else None,
                "count_2": float(item.count_cycle_2) if item.count_cycle_2 is not None else None,
                "count_3": float(item.count_cycle_3) if item.count_cycle_3 is not None else None,
                "needs_recount_cycle_1": item.needs_recount_cycle_1 if hasattr(item, 'needs_recount_cycle_1') else True,
                "needs_recount_cycle_2": item.needs_recount_cycle_2 if hasattr(item, 'needs_recount_cycle_2') else False,
                "needs_recount_cycle_3": item.needs_recount_cycle_3 if hasattr(item, 'needs_recount_cycle_3') else False,
                "status": assignment.status,
                "assignment_status": assignment.status,
                "count_number": assignment.count_number,
                "assigned_at": assignment.created_at.isoformat() if assignment.created_at else None,
                "deadline": assignment.deadline.isoformat() if assignment.deadline else None
            }
            products_data.append(product_data)

        # ✅ CORREÇÃO: Buscar current_cycle do inventário
        inventory = db.query(InventoryListModel).filter(
            InventoryListModel.id == inventory_id
        ).first()
        
        current_cycle = inventory.current_cycle if inventory else 1
        
        # Contar produtos únicos em vez de assignments (pode haver múltiplos assignments por produto)
        unique_products = set(product["item_id"] for product in products_data)
        
        return {
            "success": True,
            "message": f"Found {len(unique_products)} unique products assigned to user {current_user.full_name}",
            "data": {
                "inventory_id": inventory_id,
                "current_cycle": current_cycle,  # ✅ ADICIONAR current_cycle
                "user_products": products_data,
                "total_assigned": len(unique_products)  # Contar produtos únicos, não assignments
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "fetching user products")
        )


@router.get("/my-assignments-test")
async def get_my_assignments_test(
    db: Session = Depends(get_db)
):
    """
    Endpoint de teste sem autenticação para retornar dados mockados
    """
    try:
        # Retornar dados mockados para teste
        return {
            "inventories": [],
            "total_assigned": 0,
            "message": "Teste - Nenhum inventário disponível"
        }
    except Exception as e:
        logger.error(f"Erro ao buscar atribuições: {e}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, ""))

@router.get("/my-assignments")
async def get_my_assignments(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lista as atribuições de contagem do usuário atual
    CORRIGIDO PARA BUSCAR DADOS REAIS DO BANCO DE DADOS
    """
    try:
        from app.models.models import CountingAssignment as CountingAssignmentModel
        from app.models.models import CountingList as CountingListModel

        logger.info(f"🔍 [my-assignments] Usuário: {current_user.username}, Role: {current_user.role}, Store: {current_user.store_id}")

        # ✅ v2.9.3.1: Query diferenciada por role para suportar dois fluxos de acesso
        # OPERATOR: Busca por counting_lists (considera reatribuições de ciclos)
        # SUPERVISOR/ADMIN: Busca por inventory_lists (acesso completo)

        assignments_data = []

        # OPERATOR: Query por counting_lists (considera todos os ciclos)
        if current_user.role == 'OPERATOR':
            logger.info(f"🎯 [OPERATOR] Buscando counting_lists para usuário {current_user.id}")

            from app.models.models import Warehouse

            assignments_query = db.query(
                InventoryListModel.id.label('inventory_id'),
                InventoryListModel.name.label('inventory_name'),
                InventoryListModel.description.label('inventory_description'),
                InventoryListModel.status.label('inventory_status'),
                InventoryListModel.warehouse.label('warehouse_code'),
                Warehouse.name.label('warehouse_name'),
                InventoryListModel.reference_date.label('reference_date'),
                InventoryListModel.store_id.label('store_id'),
                CountingListModel.id.label('counting_list_id'),
                CountingListModel.list_name.label('list_name'),
                CountingListModel.current_cycle.label('current_cycle'),
                CountingListModel.list_status.label('list_status'),
                CountingListModel.created_at.label('assigned_at')
            ).join(
                CountingListModel, InventoryListModel.id == CountingListModel.inventory_id
            ).outerjoin(
                Warehouse, and_(
                    Warehouse.code == InventoryListModel.warehouse,
                    Warehouse.store_id == InventoryListModel.store_id
                )
            ).filter(
                # ✅ Buscar apenas no CICLO ATUAL onde o usuário está atribuído
                or_(
                    and_(CountingListModel.current_cycle == 1, CountingListModel.counter_cycle_1 == current_user.id),
                    and_(CountingListModel.current_cycle == 2, CountingListModel.counter_cycle_2 == current_user.id),
                    and_(CountingListModel.current_cycle == 3, CountingListModel.counter_cycle_3 == current_user.id)
                ),
                InventoryListModel.store_id == current_user.store_id,  # ✅ Isolamento por loja
                CountingListModel.list_status.in_(['ABERTA', 'RELEASED', 'EM_CONTAGEM'])  # ✅ Status ativos
            ).all()

            logger.info(f"📊 [OPERATOR] Query retornou {len(assignments_query)} listas")

        # SUPERVISOR/ADMIN: Query com counting_lists para obter dados completos
        else:
            # ✅ CORREÇÃO: Buscar counting_lists para ter list_name e current_cycle
            logger.info(f"🎯 [SUPERVISOR/ADMIN] Buscando counting_lists para usuário {current_user.id}")

            from app.models.models import Warehouse

            assignments_query = db.query(
                InventoryListModel.id.label('inventory_id'),
                InventoryListModel.name.label('inventory_name'),
                InventoryListModel.description.label('inventory_description'),
                InventoryListModel.status.label('inventory_status'),
                InventoryListModel.warehouse.label('warehouse_code'),
                Warehouse.name.label('warehouse_name'),
                InventoryListModel.reference_date.label('reference_date'),  # ✅ v2.9.3: Data de referência
                InventoryListModel.store_id.label('store_id'),  # ✅ v2.9.3: ID da loja
                CountingListModel.id.label('counting_list_id'),
                CountingListModel.list_name.label('list_name'),
                CountingListModel.current_cycle.label('current_cycle'),
                CountingListModel.list_status.label('list_status'),
                CountingListModel.created_at.label('assigned_at')
            ).join(
                CountingListModel, InventoryListModel.id == CountingListModel.inventory_id
            ).outerjoin(
                Warehouse, and_(
                    Warehouse.code == InventoryListModel.warehouse,
                    Warehouse.store_id == InventoryListModel.store_id
                )
            ).filter(
                # ✅ CORREÇÃO: Filtrar apenas listas atribuídas ao usuário logado no CICLO ATUAL
                or_(
                    and_(CountingListModel.current_cycle == 1, CountingListModel.counter_cycle_1 == current_user.id),
                    and_(CountingListModel.current_cycle == 2, CountingListModel.counter_cycle_2 == current_user.id),
                    and_(CountingListModel.current_cycle == 3, CountingListModel.counter_cycle_3 == current_user.id)
                ),
                InventoryListModel.store_id == current_user.store_id,  # ✅ Isolamento por loja (SEGURANÇA)
                CountingListModel.list_status.in_(['ABERTA', 'RELEASED', 'EM_CONTAGEM'])  # ✅ v2.9.3: SUPERVISOR pode ver ABERTA (Via 2)
            ).all()

        logger.info(f"🎯 [my-assignments] Query retornou {len(assignments_query)} registros para {current_user.role}")

        # ✅ v2.9.3.1: Processar resultados diferente por role
        if current_user.role == 'OPERATOR':
            # OPERATOR: Processar counting_lists (cada lista individual)
            logger.info(f"📦 [OPERATOR] Processando {len(assignments_query)} counting_lists")

            # Agrupar por inventário para manter compatibilidade com frontend
            inventories_dict = {}
            for assignment in assignments_query:
                inv_id = str(assignment.inventory_id)

                # ✅ Buscar nome da loja (uma vez por inventário)
                if inv_id not in inventories_dict:
                    store_name = "Loja Principal"
                    if hasattr(assignment, 'store_id') and assignment.store_id:
                        store = db.query(Store).filter(Store.id == assignment.store_id).first()
                        if store:
                            store_name = store.name

                    # ✅ Usar warehouse_name ao invés do código
                    warehouse_display = assignment.warehouse_name if hasattr(assignment, 'warehouse_name') and assignment.warehouse_name else (
                        assignment.warehouse_code if hasattr(assignment, 'warehouse_code') else "N/A"
                    )

                    inventories_dict[inv_id] = {
                        "inventory_id": inv_id,
                        "inventory_name": assignment.inventory_name,
                        "inventory_description": assignment.inventory_description or "",
                        "inventory_status": assignment.inventory_status if hasattr(assignment, 'inventory_status') else "IN_PROGRESS",
                        "status": "IN_PROGRESS",
                        "warehouse": warehouse_display,
                        "reference_date": assignment.reference_date.isoformat() if hasattr(assignment, 'reference_date') and assignment.reference_date else None,
                        "store_name": store_name,
                        "total_lists": 0,
                        "completed_lists": 0,
                        "progress_percentage": 0.0,
                        "assigned_at": assignment.assigned_at.isoformat() if assignment.assigned_at else None,
                        "assigned_lists": []
                    }

                # ✅ v2.9.3.1: Buscar contagem REAL de itens da lista
                list_status = assignment.list_status if hasattr(assignment, 'list_status') else "PENDING"
                current_cycle = assignment.current_cycle if hasattr(assignment, 'current_cycle') else 1

                # Contar total de itens na lista
                total_items_count = db.query(func.count(CountingListItem.id)).filter(
                    CountingListItem.counting_list_id == assignment.counting_list_id
                ).scalar() or 0

                # Contar itens COMPLETOS (contados no ciclo atual)
                if current_cycle == 1:
                    completed_items_count = db.query(func.count(CountingListItem.id)).filter(
                        CountingListItem.counting_list_id == assignment.counting_list_id,
                        CountingListItem.count_cycle_1.isnot(None)
                    ).scalar() or 0
                elif current_cycle == 2:
                    completed_items_count = db.query(func.count(CountingListItem.id)).filter(
                        CountingListItem.counting_list_id == assignment.counting_list_id,
                        CountingListItem.count_cycle_2.isnot(None)
                    ).scalar() or 0
                else:  # ciclo 3
                    completed_items_count = db.query(func.count(CountingListItem.id)).filter(
                        CountingListItem.counting_list_id == assignment.counting_list_id,
                        CountingListItem.count_cycle_3.isnot(None)
                    ).scalar() or 0

                inventories_dict[inv_id]["assigned_lists"].append({
                    "list_id": str(assignment.counting_list_id),
                    "list_name": assignment.list_name,
                    "user_name": getattr(current_user, 'full_name', getattr(current_user, 'username', 'Usuario')),
                    "user_id": str(current_user.id),
                    "status": list_status,
                    "current_cycle": current_cycle,
                    "total_items": total_items_count,
                    "completed_items": completed_items_count
                })
                inventories_dict[inv_id]["total_lists"] += 1

                logger.info(f"✅ [OPERATOR] Lista adicionada: {assignment.list_name} (ciclo {current_cycle}) - Status: {list_status} - Itens: {completed_items_count}/{total_items_count}")

            assignments_data = list(inventories_dict.values())

        else:
            # SUPERVISOR/ADMIN: Processar counting_lists (mesma estrutura do OPERATOR)
            logger.info(f"📦 [SUPERVISOR/ADMIN] Processando {len(assignments_query)} counting_lists")

            # Agrupar por inventário para manter compatibilidade com frontend
            inventories_dict = {}
            for assignment in assignments_query:
                inv_id = str(assignment.inventory_id)

                # ✅ Buscar nome da loja (uma vez por inventário)
                if inv_id not in inventories_dict:
                    store_name = "Loja Principal"
                    if hasattr(assignment, 'store_id') and assignment.store_id:
                        store = db.query(Store).filter(Store.id == assignment.store_id).first()
                        if store:
                            store_name = store.name

                    # ✅ Usar warehouse_name ao invés do código
                    warehouse_display = assignment.warehouse_name if hasattr(assignment, 'warehouse_name') and assignment.warehouse_name else (
                        assignment.warehouse_code if hasattr(assignment, 'warehouse_code') else "N/A"
                    )

                    inventories_dict[inv_id] = {
                        "inventory_id": inv_id,
                        "inventory_name": assignment.inventory_name,
                        "inventory_description": assignment.inventory_description or "",
                        "inventory_status": assignment.inventory_status if hasattr(assignment, 'inventory_status') else "IN_PROGRESS",
                        "status": "IN_PROGRESS",
                        "warehouse": warehouse_display,
                        "reference_date": assignment.reference_date.isoformat() if hasattr(assignment, 'reference_date') and assignment.reference_date else None,
                        "store_name": store_name,
                        "total_lists": 0,
                        "completed_lists": 0,
                        "progress_percentage": 0.0,
                        "assigned_at": assignment.assigned_at.isoformat() if assignment.assigned_at else None,
                        "assigned_lists": []
                    }

                # ✅ Buscar contagem REAL de itens da lista
                list_status = assignment.list_status if hasattr(assignment, 'list_status') else "PENDING"
                current_cycle = assignment.current_cycle if hasattr(assignment, 'current_cycle') else 1

                # Contar total de itens na lista
                total_items_count = db.query(func.count(CountingListItem.id)).filter(
                    CountingListItem.counting_list_id == assignment.counting_list_id
                ).scalar() or 0

                # Contar itens COMPLETOS (contados no ciclo atual)
                if current_cycle == 1:
                    completed_items_count = db.query(func.count(CountingListItem.id)).filter(
                        CountingListItem.counting_list_id == assignment.counting_list_id,
                        CountingListItem.count_cycle_1.isnot(None)
                    ).scalar() or 0
                elif current_cycle == 2:
                    completed_items_count = db.query(func.count(CountingListItem.id)).filter(
                        CountingListItem.counting_list_id == assignment.counting_list_id,
                        CountingListItem.count_cycle_2.isnot(None)
                    ).scalar() or 0
                else:  # ciclo 3
                    completed_items_count = db.query(func.count(CountingListItem.id)).filter(
                        CountingListItem.counting_list_id == assignment.counting_list_id,
                        CountingListItem.count_cycle_3.isnot(None)
                    ).scalar() or 0

                inventories_dict[inv_id]["assigned_lists"].append({
                    "list_id": str(assignment.counting_list_id),
                    "list_name": assignment.list_name,
                    "user_name": getattr(current_user, 'full_name', getattr(current_user, 'username', 'Usuario')),
                    "user_id": str(current_user.id),
                    "status": list_status,
                    "current_cycle": current_cycle,
                    "total_items": total_items_count,
                    "completed_items": completed_items_count
                })
                inventories_dict[inv_id]["total_lists"] += 1

                logger.info(f"✅ [SUPERVISOR/ADMIN] Lista adicionada: {assignment.list_name} (ciclo {current_cycle}) - Status: {list_status} - Itens: {completed_items_count}/{total_items_count}")

            assignments_data = list(inventories_dict.values())

        return {
            "success": True,
            "message": f"Found {len(assignments_data)} inventory assignments (role: {current_user.role})",
            "inventories": assignments_data
        }
        
    except Exception as e:
        logger.error(f"Error fetching assignments: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "fetching assignments")
        )

@router.get("/inventory/{inventory_id}/existing-assignments")
async def get_existing_assignments_lists(
    inventory_id: str,
    db: Session = Depends(get_db)
):
    """
    Lista as listas de atribuições existentes para um inventário
    
    Usado para permitir seleção de listas existentes na 2ª e 3ª contagem,
    mantendo a integridade dos dados e o mesmo grupo de produtos/usuário.
    
    Retorna:
    - Lista de listas de atribuições agrupadas por usuário e lista
    """
    
    try:
        # Buscar inventário
        inventory = db.query(InventoryListModel).filter(
            InventoryListModel.id == inventory_id
        ).first()
        
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventory not found"
            )
        
        # ✅ PRIMEIRO: Buscar o total REAL de produtos do inventário (fixo)
        total_inventory_products = db.query(InventoryItemModel).filter(
            InventoryItemModel.inventory_list_id == inventory_id
        ).count()
        
        # Buscar atribuições existentes agrupadas
        # Query para buscar atribuições com informações do usuário E status da lista
        from app.models.models import Counting
        
        assignments_query = db.query(
            CountingAssignmentModel.assigned_to,
            UserModel.full_name,
            UserModel.username,
            func.max(CountingAssignmentModel.status).label('assignment_status'),  # ✅ Usar MAX para pegar status mais recente
            func.max(CountingAssignmentModel.list_status).label('list_status'),  # ✅ USAR STATUS INDIVIDUAL DA LISTA
            func.count(CountingAssignmentModel.id).label('assigned_products_current_cycle'),  # ✅ Renomeado para clareza
            func.min(CountingAssignmentModel.created_at).label('created_at'),
            InventoryListModel.current_cycle,
            # Contar quantos produtos únicos foram contados (não múltiplas contagens do mesmo produto)
            func.count(func.distinct(InventoryItemModel.id)).label('counted_items')
        ).select_from(CountingAssignmentModel).join(
            InventoryItemModel, CountingAssignmentModel.inventory_item_id == InventoryItemModel.id
        ).join(
            InventoryListModel, InventoryItemModel.inventory_list_id == InventoryListModel.id
        ).join(
            UserModel, CountingAssignmentModel.assigned_to == UserModel.id
        ).outerjoin(
            Counting, and_(
                Counting.inventory_item_id == InventoryItemModel.id,
                Counting.counted_by == CountingAssignmentModel.assigned_to
            )
        ).filter(
            InventoryItemModel.inventory_list_id == inventory_id,
            CountingAssignmentModel.status.in_(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'RELEASED']),
            CountingAssignmentModel.count_number == InventoryListModel.current_cycle  # ✅ FILTRAR pelo ciclo atual
        ).group_by(
            CountingAssignmentModel.assigned_to,
            UserModel.full_name,
            UserModel.username,
            # ✅ REMOVIDO list_status do GROUP BY pois agora usamos MAX()
            InventoryListModel.current_cycle
        ).order_by(UserModel.full_name).all()
        
        # Construir lista de listas existentes
        existing_lists = []
        for assignment in assignments_query:
            # Criar um ID único para a "lista" (na verdade é um agrupamento por usuário)
            list_id = f"user_{assignment.assigned_to}"
            list_name = f"Lista do {assignment.full_name}"
            
            # Mapear status da lista para display
            display_status = getattr(assignment, 'list_status', 'ABERTA') or 'ABERTA'
            if display_status == 'ABERTA':
                status_display = 'Aberta'
            elif display_status == 'EM_CONTAGEM':
                status_display = 'Em Contagem'
            elif display_status == 'RELEASED':  # ✅ Adicionar mapeamento para RELEASED
                status_display = 'Em Contagem'
            elif display_status == 'ENCERRADA':
                status_display = 'Encerrada'
            else:
                # Fallback para status da atribuição
                if assignment.assignment_status == 'PENDING':
                    status_display = 'Aberta'
                elif assignment.assignment_status == 'RELEASED':
                    status_display = 'Em Contagem'
                elif assignment.assignment_status == 'COMPLETED':
                    status_display = 'Encerrada'
                else:
                    status_display = assignment.assignment_status
            
            existing_lists.append({
                "list_id": list_id,
                "list_name": list_name,
                "counter_user_id": str(assignment.assigned_to),
                "counter_name": assignment.full_name,
                "counter_username": assignment.username,
                "list_status": display_status,
                "assignment_status": assignment.assignment_status,
                "current_cycle": getattr(assignment, 'current_cycle', 1),
                "cycle_number": getattr(assignment, 'current_cycle', 1),  # ✅ Manter compatibilidade
                "total_products": getattr(assignment, 'assigned_products_current_cycle', 0),  # ✅ Produtos específicos do usuário
                "counted_items": getattr(assignment, 'counted_items', 0),
                "created_at": assignment.created_at.isoformat() if assignment.created_at else None
            })
        
        return {
            "success": True,
            "message": f"Found {len(existing_lists)} existing assignment lists",
            "data": {
                "inventory_id": inventory_id,
                "inventory_name": inventory.name,  # ✅ INCLUIR NOME DO INVENTÁRIO
                "existing_lists": existing_lists
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "fetching existing assignment lists")
        )

@router.put("/inventory/{inventory_id}/release-list/{user_id}")
async def release_list_for_counting(
    inventory_id: str,
    user_id: str,
    db: Session = Depends(get_db)
):
    """
    Libera uma lista de contagem para execução
    
    Fluxo de liberação conforme plano:
    1. Valida que a lista está com status ABERTA
    2. Muda status da lista para EM_CONTAGEM
    3. Atualiza status das atribuições para RELEASED
    4. Registra data/hora e usuário que liberou
    5. Bloqueia alterações na lista
    
    Args:
        inventory_id: ID do inventário
        user_id: ID do usuário cuja lista será liberada
        
    Returns:
        Relatório da operação realizada
    """
    
    try:
        # Buscar inventário
        inventory = db.query(InventoryListModel).filter(
            InventoryListModel.id == inventory_id
        ).first()
        
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventory not found"
            )
        
        # Verificar status da lista
        list_status = getattr(inventory, 'list_status', 'ABERTA')
        if list_status != 'ABERTA':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Lista não pode ser liberada. Status atual: {list_status}. Apenas listas com status ABERTA podem ser liberadas."
            )
        
        # Buscar usuário
        user = db.query(UserModel).filter(
            UserModel.id == user_id
        ).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Buscar atribuições do usuário neste inventário no ciclo atual
        current_cycle = getattr(inventory, 'cycle_number', 1)
        
        # No ciclo 1: liberar todas as atribuições PENDING
        # No ciclo 2+: liberar apenas produtos com divergências (diferença != 0)
        if current_cycle == 1:
            # Primeiro ciclo: todas as atribuições pendentes
            assignments = db.query(CountingAssignmentModel).join(
                InventoryItemModel, CountingAssignmentModel.inventory_item_id == InventoryItemModel.id
            ).filter(
                InventoryItemModel.inventory_list_id == inventory_id,
                CountingAssignmentModel.assigned_to == user_id,
                CountingAssignmentModel.status == "PENDING"
            ).all()
        else:
            # Segundo ciclo ou superior: implementar REGRA DE MAIORIA
            from app.models.models import Counting
            from sqlalchemy import func, case, or_, and_
            from sqlalchemy.orm import aliased
            
            # ✅ CORREÇÃO CRÍTICA COM REGRA DE MAIORIA: Count1 = Count2 = FINAL
            # Alias para contagens dos diferentes ciclos
            Count1 = aliased(Counting)
            Count2 = aliased(Counting)
            Count3 = aliased(Counting)
            
            # Buscar contagens por ciclo para análise de maioria
            counting_analysis_subq = db.query(
                InventoryItemModel.id.label('item_id'),
                InventoryItemModel.expected_quantity.label('system_qty'),
                Count1.quantity.label('count_1'),
                Count2.quantity.label('count_2'),
                Count3.quantity.label('count_3')
            ).outerjoin(
                Count1, and_(
                    Count1.inventory_item_id == InventoryItemModel.id,
                    Count1.count_number == 1
                )
            ).outerjoin(
                Count2, and_(
                    Count2.inventory_item_id == InventoryItemModel.id,
                    Count2.count_number == 2
                )
            ).outerjoin(
                Count3, and_(
                    Count3.inventory_item_id == InventoryItemModel.id,
                    Count3.count_number == 3
                )
            ).filter(
                InventoryItemModel.inventory_list_id == inventory_id
            ).subquery()
            
            # Aplicar lógica de negócio baseada no ciclo
            if current_cycle == 2:
                # 2º CICLO: Produtos que NÃO foram finalizados no 1º ciclo
                logger.info(f"🔍 CICLO 2: Aplicando regras para determinar produtos que precisam recontagem")
                
                # Subquery: produtos que PRECISAM de 2ª contagem
                differences_subq = db.query(
                    counting_analysis_subq.c.item_id,
                    counting_analysis_subq.c.count_1.label('counted_qty'),
                    counting_analysis_subq.c.system_qty.label('expected_qty'),
                    case(
                        # REGRA: 1ª Cont (NULL=0) = qtde esperado → NÃO terá 2ª contagem
                        (
                            func.abs(func.coalesce(counting_analysis_subq.c.count_1, 0) - func.coalesce(counting_analysis_subq.c.system_qty, 0)) < 0.01
                        , 0),
                        # REGRA: 1ª Cont (NULL=0) ≠ qtde esperado → SIM terá 2ª contagem
                        (
                            func.abs(func.coalesce(counting_analysis_subq.c.count_1, 0) - func.coalesce(counting_analysis_subq.c.system_qty, 0)) >= 0.01
                        , 1),
                        else_=0
                    ).label('needs_recount')
                ).subquery()
                
                # Buscar apenas produtos que REALMENTE precisam de 2ª contagem
                assignments = db.query(CountingAssignmentModel).join(
                    InventoryItemModel, CountingAssignmentModel.inventory_item_id == InventoryItemModel.id
                ).join(
                    differences_subq, InventoryItemModel.id == differences_subq.c.item_id
                ).filter(
                    InventoryItemModel.inventory_list_id == inventory_id,
                    CountingAssignmentModel.assigned_to == user_id,
                    CountingAssignmentModel.status == "PENDING",
                    differences_subq.c.needs_recount == 1  # ✅ APENAS itens que precisam
                ).all()
                
            elif current_cycle == 3:
                # 3º CICLO: APENAS produtos onde Count1 ≠ Count2 (regra de maioria falhou)
                logger.info(f"🔍 CICLO 3: Aplicando REGRA DE MAIORIA - apenas produtos onde Count1 ≠ Count2")
                
                differences_subq = db.query(
                    counting_analysis_subq.c.item_id,
                    counting_analysis_subq.c.count_2.label('counted_qty'),
                    counting_analysis_subq.c.system_qty.label('expected_qty'),
                    case(
                        (and_(
                            counting_analysis_subq.c.count_1.isnot(None),
                            counting_analysis_subq.c.count_2.isnot(None),
                            func.abs(counting_analysis_subq.c.count_1 - counting_analysis_subq.c.count_2) < 0.01
                        ), 0),
                        (and_(
                            counting_analysis_subq.c.count_1.isnot(None),
                            counting_analysis_subq.c.count_2.isnot(None),
                            func.abs(counting_analysis_subq.c.count_1 - counting_analysis_subq.c.count_2) >= 0.01
                        ), 1),
                        else_=0
                    ).label('needs_final_count')
                ).subquery()
                
                # Buscar apenas produtos que REALMENTE precisam de 3ª contagem
                assignments = db.query(CountingAssignmentModel).join(
                    InventoryItemModel, CountingAssignmentModel.inventory_item_id == InventoryItemModel.id
                ).join(
                    differences_subq, InventoryItemModel.id == differences_subq.c.item_id
                ).filter(
                    InventoryItemModel.inventory_list_id == inventory_id,
                    CountingAssignmentModel.assigned_to == user_id,
                    CountingAssignmentModel.status == "PENDING",
                    differences_subq.c.needs_final_count == 1  # ✅ APENAS itens que precisam
                ).all()
            else:
                # Fallback para outros ciclos
                assignments = []
        
        if not assignments:
            if current_cycle == 1:
                # 1º ciclo sem produtos: erro real
                return {
                    "success": False,
                    "message": f"Nenhuma atribuição pendente encontrada para {user.full_name} neste inventário",
                    "data": {
                        "inventory_id": inventory_id,
                        "user_id": user_id,
                        "cycle_number": current_cycle,
                        "updated_count": 0
                    }
                }
            else:
                # 2º/3º ciclo sem divergências: SUCESSO! Inventário está OK
                message = f"✅ Excelente! Não há produtos com divergência para {user.full_name} no {current_cycle}º ciclo - Inventário está correto!"
                
                # Mesmo assim, atualizar status da lista para EM_CONTAGEM (consistência)
                if hasattr(inventory, 'list_status'):
                    inventory.list_status = 'EM_CONTAGEM'
                db.commit()
                
                return {
                    "success": True,
                    "message": message,
                    "data": {
                        "inventory_id": inventory_id,
                        "inventory_name": inventory.name,
                        "user_id": user_id,
                        "user_name": user.full_name,
                        "cycle_number": current_cycle,
                        "list_status": "EM_CONTAGEM",
                        "updated_count": 0,
                        "assignment_status": "NO_DISCREPANCIES",
                        "released_at": datetime.utcnow().isoformat(),
                        "criteria": "no_discrepancies_found"
                    }
                }
        
        # Atualizar status da LISTA para EM_CONTAGEM
        if hasattr(inventory, 'list_status'):
            inventory.list_status = 'EM_CONTAGEM'
        
        # Registrar quem liberou e quando
        if hasattr(inventory, 'released_at'):
            inventory.released_at = datetime.utcnow()
        if hasattr(inventory, 'released_by'):
            # Obter ID do usuário que está liberando (seria do token, mas por ora usar admin)
            # TODO: Pegar do contexto de autenticação
            admin_user = db.query(UserModel).filter(UserModel.username == 'admin').first()
            if admin_user:
                inventory.released_by = admin_user.id
        
        # Atualizar status das atribuições para RELEASED
        updated_count = 0
        for assignment in assignments:
            assignment.status = "RELEASED"
            # Garantir que o ciclo está correto
            if hasattr(assignment, 'cycle_number'):
                assignment.cycle_number = current_cycle
            updated_count += 1
        
        # ✅ ATUALIZAR STATUS DOS PRODUTOS para AWAITING_COUNT ao liberar
        update_product_status_on_release(db, inventory_id, current_cycle)
        
        # Commit das alterações
        db.commit()
        
        # Mensagem personalizada por ciclo
        if current_cycle == 1:
            message = f"Lista de {user.full_name} liberada para contagem (1º ciclo) - {updated_count} produtos"
        else:
            message = f"Lista de {user.full_name} liberada para recontagem ({current_cycle}º ciclo) - {updated_count} produtos com divergência"
            
        return {
            "success": True,
            "message": message,
            "data": {
                "inventory_id": inventory_id,
                "inventory_name": inventory.name,
                "user_id": user_id,
                "user_name": user.full_name,
                "cycle_number": current_cycle,
                "list_status": "EM_CONTAGEM",
                "updated_count": updated_count,
                "assignment_status": "RELEASED",
                "released_at": datetime.utcnow().isoformat(),
                "criteria": "all" if current_cycle == 1 else "discrepancies_only"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "releasing list for counting")
        )

@router.put("/inventory/{inventory_id}/close-round/{user_id}")
async def close_counting_round(
    inventory_id: str,
    user_id: str,
    force_finalize: bool = Query(False, description="Se True, finaliza o inventário no ciclo atual sem avançar"),
    db: Session = Depends(get_db)
):
    """
    Encerra uma rodada de contagem para um usuário
    
    Fluxo de encerramento conforme plano:
    1. Valida que a lista está com status EM_CONTAGEM
    2. Muda status da lista para ENCERRADA
    3. Atualiza status das atribuições para COMPLETED
    4. Registra data/hora e usuário que encerrou
    5. Prepara para próximo ciclo se houver divergências
    
    Args:
        inventory_id: ID do inventário
        user_id: ID do usuário cuja rodada será encerrada
        
    Returns:
        Relatório da operação realizada
    """
    
    try:
        # Buscar inventário
        inventory = db.query(InventoryListModel).filter(
            InventoryListModel.id == inventory_id
        ).first()
        
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventário não encontrado"
            )
        
        # Verificar status da lista e ciclo
        list_status = getattr(inventory, 'list_status', 'ABERTA')
        cycle_number = getattr(inventory, 'current_cycle', 1)
        
        # ✅ LÓGICA FLEXÍVEL: Permitir encerramento se há contagens ou status apropriado
        if list_status == 'EM_CONTAGEM':
            # Status ideal - pode encerrar normalmente
            logger.info(f"✅ Status EM_CONTAGEM - encerramento permitido")
            pass
        elif list_status == 'ABERTA':
            # Para status ABERTA, verificar se há contagens registradas
            from app.models.models import Counting
            has_countings = db.query(Counting).join(
                InventoryItemModel, Counting.inventory_item_id == InventoryItemModel.id
            ).filter(
                InventoryItemModel.inventory_list_id == inventory_id,
                Counting.count_number == cycle_number
            ).first()

            if has_countings:
                logger.info(f"✅ Status ABERTA mas há contagens no ciclo {cycle_number} - encerramento permitido")
            elif cycle_number >= 3:
                logger.info(f"✅ Status ABERTA no ciclo {cycle_number} - finalização permitida")
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Lista com status ABERTA no ciclo {cycle_number} não pode ser encerrada. Faça contagens primeiro ou use 'Liberar Contagem'."
                )
        else:
            # Outros status não são permitidos
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Lista não pode ser finalizada. Status atual: {list_status}. Status permitidos: EM_CONTAGEM ou ABERTA (com contagens)."
            )
        
        # Buscar usuário com debug detalhado
        logger.info(f"🔍 [DEBUG CLOSE ROUND] Buscando usuário com ID: '{user_id}' (tipo: {type(user_id)})")
        
        # Verificar se é UUID válido
        try:
            import uuid
            user_uuid = uuid.UUID(user_id)
            logger.info(f"✅ ID é UUID válido: {user_uuid}")
        except ValueError as e:
            logger.error(f"❌ ID inválido - não é UUID: {user_id} - {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"ID do usuário inválido: {user_id}"
            )
        
        user = db.query(UserModel).filter(
            UserModel.id == user_uuid
        ).first()
        
        if not user:
            # Debug: listar usuários existentes
            all_users = db.query(UserModel.id, UserModel.username, UserModel.full_name).all()
            logger.error(f"❌ Usuário {user_id} não encontrado. Usuários existentes:")
            for existing_user in all_users:
                logger.error(f"   - ID: {existing_user.id}, Username: {existing_user.username}, Nome: {existing_user.full_name}")
            
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Usuário não encontrado: {user_id}"
            )
        
        # ✅ SIMPLIFICAÇÃO: Não precisamos mais buscar assignments específicos
        # Lógica simplificada - se chegou até aqui, pode encerrar a rodada
        current_cycle = getattr(inventory, 'current_cycle', 1)
        logger.info(f"✅ Encerrando rodada para {user.full_name} - ciclo {current_cycle}")
        
        # Atualizar status das atribuições para COMPLETED
        updated_count = 0
        has_discrepancies = False
        
        # ✅ VERIFICAR SE HÁ DIVERGÊNCIAS REAIS baseado na regra de maioria
        from app.models.models import Counting
        from sqlalchemy.orm import aliased
        
        # Buscar todas as contagens para verificar divergências
        Count1 = aliased(Counting)
        Count2 = aliased(Counting) 
        
        # Contar produtos que REALMENTE precisam de próximo ciclo
        products_needing_next_cycle = 0
        
        if current_cycle == 1:
            # Após 1º ciclo: verificar produtos com Count1 ≠ Sistema
            query = db.query(InventoryItemModel).join(
                Count1, and_(
                    Count1.inventory_item_id == InventoryItemModel.id,
                    Count1.count_number == 1
                )
            ).filter(
                InventoryItemModel.inventory_list_id == inventory_id,
                func.abs(func.coalesce(Count1.quantity, 0) - InventoryItemModel.expected_quantity) >= 0.01
            )
            products_needing_next_cycle = query.count()
            
        elif current_cycle == 2:
            # ✅ v2.19.9: CORREÇÃO CRÍTICA - Mesma lógica do close_counting_list_round
            # Ciclo 2 → 3: Verificar se count_2 bate com expected OU com count_1
            #   1. count_2 == expected? → OK, não precisa ciclo 3
            #   2. count_2 == count_1? → OK, confirmado, não precisa ciclo 3
            #   3. Nenhum bateu → precisa ciclo 3 (desempate)
            logger.info(f"🔍 [CICLO 2] Verificando divergências: Count2 vs Expected OU Count2 vs Count1")

            # Buscar todos os itens do inventário com suas contagens
            items_with_counts = db.query(
                InventoryItemModel,
                Count1.quantity.label('count_1'),
                Count2.quantity.label('count_2')
            ).outerjoin(
                Count1, and_(
                    Count1.inventory_item_id == InventoryItemModel.id,
                    Count1.count_number == 1
                )
            ).outerjoin(
                Count2, and_(
                    Count2.inventory_item_id == InventoryItemModel.id,
                    Count2.count_number == 2
                )
            ).filter(
                InventoryItemModel.inventory_list_id == inventory_id
            ).all()

            # Verificar cada item manualmente com a lógica correta
            divergent_items = []
            for item, count_1_val, count_2_val in items_with_counts:
                if count_2_val is None:
                    continue  # Não foi contado no ciclo 2

                count_2 = float(count_2_val)
                expected = float(item.expected_quantity) if item.expected_quantity else 0.0
                count_1 = float(count_1_val) if count_1_val is not None else None

                # Verificação 1: count_2 == expected?
                matches_expected = abs(count_2 - expected) < 0.01

                # Verificação 2: count_2 == count_1?
                matches_count_1 = count_1 is not None and abs(count_2 - count_1) < 0.01

                if matches_expected:
                    logger.debug(f"   ✅ {item.product_code}: count_2={count_2} == expected={expected} → OK")
                elif matches_count_1:
                    logger.debug(f"   ✅ {item.product_code}: count_2={count_2} == count_1={count_1} → CONFIRMADO")
                else:
                    logger.debug(f"   ❌ {item.product_code}: count_2={count_2} != expected={expected} e != count_1={count_1} → CICLO 3")
                    divergent_items.append(item)

            products_needing_next_cycle = len(divergent_items)
            logger.info(f"🔍 [DEBUG CICLO 2] Encontrados {products_needing_next_cycle} produtos que precisam de ciclo 3")
        
        has_discrepancies = products_needing_next_cycle > 0
        logger.info(f"🎯 [RESULTADO] Ciclo {current_cycle}: {products_needing_next_cycle} produtos precisam de próximo ciclo")
        
        # ✅ SIMPLIFICAÇÃO: Não precisamos mais atualizar assignments específicos
        # Contamos o inventário como processado
        updated_count = 1
        
        # Determinar próximo ciclo
        current_cycle = getattr(inventory, 'current_cycle', 1)
        next_cycle = current_cycle + 1
        
        # Atualizar status da lista e ciclo
        if hasattr(inventory, 'list_status'):
            # ✅ REGRA: Após ciclo 3, status = ENCERRADA. Senão, ABERTA
            if current_cycle >= 3:
                inventory.list_status = 'ENCERRADA'  # Inventário encerrado definitivamente
            else:
                inventory.list_status = 'ABERTA'  # Permitir nova atribuição no próximo ciclo
        
        if hasattr(inventory, 'current_cycle'):
            # ✅ IMPORTANTE: Verificar se deve forçar finalização ou avançar ciclo
            if force_finalize:
                # Forçar finalização no ciclo atual, independente de divergências
                logger.info(f"⚡ Finalizando inventário forçadamente no ciclo {current_cycle}")
                inventory.list_status = 'ENCERRADA'
                # Manter o ciclo atual sem avançar
            elif has_discrepancies and current_cycle < 3:
                # Há divergências e não estamos no último ciclo - avançar
                inventory.current_cycle = current_cycle + 1
                logger.info(f"✅ Avançando para ciclo {current_cycle + 1} devido a {products_needing_next_cycle} divergências")
                
                # 🔧 CORREÇÃO: Criar atribuições APENAS para produtos que precisam de próximo ciclo
                next_cycle = current_cycle + 1
                logger.info(f"🔧 Criando atribuições automáticas para ciclo {next_cycle} - apenas produtos com divergência")
                
                # Buscar APENAS os itens que precisam de próximo ciclo (com divergências)
                items_needing_next_cycle = []
                
                if current_cycle == 1:
                    # Após 1º ciclo: buscar produtos com Count1 ≠ Sistema (incluindo NULL = 0)
                    items_needing_next_cycle = db.query(InventoryItemModel).outerjoin(
                        Count1, and_(
                            Count1.inventory_item_id == InventoryItemModel.id,
                            Count1.count_number == 1
                        )
                    ).filter(
                        InventoryItemModel.inventory_list_id == inventory_id,
                        # ✅ REGRA NULL = 0: usar func.coalesce para tratar NULL como 0
                        func.abs(func.coalesce(Count1.quantity, 0) - InventoryItemModel.expected_quantity) >= 0.01
                    ).all()
                    
                elif current_cycle == 2:
                    # ✅ CORREÇÃO: Após 2º ciclo, buscar produtos onde Count1 ≠ Count2
                    items_needing_next_cycle = db.query(InventoryItemModel).outerjoin(
                        Count1, and_(
                            Count1.inventory_item_id == InventoryItemModel.id,
                            Count1.count_number == 1
                        )
                    ).outerjoin(
                        Count2, and_(
                            Count2.inventory_item_id == InventoryItemModel.id,
                            Count2.count_number == 2
                        )
                    ).filter(
                        InventoryItemModel.inventory_list_id == inventory_id,
                        # REGRA SIMPLES E DIRETA: Count1 ≠ Count2
                        func.abs(func.coalesce(Count1.quantity, 0) - func.coalesce(Count2.quantity, 0)) >= 0.01
                    ).all()
                    
                    # ✅ MARCAR PRODUTOS COM needs_recount_cycle_3 = true
                    for item in items_needing_next_cycle:
                        item.needs_recount_cycle_3 = True
                        logger.info(f"   🎯 Marcando produto {item.product_code} para 3º ciclo")
                
                assignments_created = 0
                for item in items_needing_next_cycle:
                    # Verificar se já existe atribuição para o próximo ciclo
                    existing_assignment = db.query(CountingAssignmentModel).filter(
                        CountingAssignmentModel.inventory_item_id == item.id,
                        CountingAssignmentModel.count_number == next_cycle
                    ).first()
                    
                    if not existing_assignment:
                        # Criar nova atribuição mantendo o mesmo usuário
                        import uuid
                        new_assignment = CountingAssignmentModel(
                            id=str(uuid.uuid4()),
                            inventory_item_id=item.id,
                            assigned_to=user_id,  # Manter o mesmo contador
                            assigned_by=user_id,  # Auto-atribuído
                            count_number=next_cycle,
                            status='PENDING',
                            created_at=datetime.utcnow()
                        )
                        db.add(new_assignment)
                        assignments_created += 1
                
                logger.info(f"✅ Criadas {assignments_created} atribuições para ciclo {next_cycle} (apenas produtos com divergência)")
                
            elif not has_discrepancies and not force_finalize:
                # ✨ FINALIZAÇÃO AUTOMÁTICA - Sem divergências - encerrar definitivamente
                inventory.list_status = 'ENCERRADA'
                # Adicionar flag para identificar finalização automática
                if hasattr(inventory, 'closure_notes'):
                    inventory.closure_notes = f"Finalizado automaticamente no {current_cycle}º ciclo - todas as quantidades conferem"
                logger.info(f"✨ Inventário encerrado AUTOMATICAMENTE no ciclo {current_cycle} - sem divergências")
            elif not force_finalize:
                # Ciclo 3 ou posterior - manter em 3 e encerrar
                inventory.current_cycle = 3
                inventory.list_status = 'ENCERRADA'
        
        # Registrar quem encerrou e quando
        if hasattr(inventory, 'closed_at'):
            inventory.closed_at = datetime.utcnow()
        if hasattr(inventory, 'closed_by'):
            # TODO: Pegar do contexto de autenticação
            admin_user = db.query(UserModel).filter(UserModel.username == 'admin').first()
            if admin_user:
                inventory.closed_by = admin_user.id
        
        # Determinar próximo passo
        next_action = None
        if has_discrepancies and current_cycle < 3:
            next_action = f"Divergências encontradas. Preparar ciclo {current_cycle + 1}"
        elif current_cycle >= 3:
            next_action = "Ciclo final concluído. Inventário pronto para encerramento."
        else:
            next_action = "Contagem concluída sem divergências."
        
        # ✅ ATUALIZAR STATUS DOS PRODUTOS baseado na proposta do usuário
        update_product_status_on_round_close(db, inventory_id, current_cycle, inventory.list_status)
        
        # ✅ ATUALIZAR FLAGS needs_recount_cycle_X para produtos com divergência
        if has_discrepancies and current_cycle == 2:
            # Marcar produtos divergentes para ciclo 3
            logger.info(f"🔧 Marcando {products_needing_next_cycle} produtos com needs_recount_cycle_3 = true")
            for item in divergent_items:
                item.needs_recount_cycle_3 = True
                logger.info(f"   ✅ Produto {item.product_code} marcado para 3º ciclo")
        
        # Commit das alterações
        db.commit()
        
        # Determinar ciclo real após a lógica
        final_cycle = getattr(inventory, 'current_cycle', current_cycle)
        final_status = getattr(inventory, 'list_status', 'ABERTA')
        
        # Determinar se foi finalização automática
        is_auto_finalized = (not has_discrepancies and 
                           final_status == 'ENCERRADA' and 
                           not force_finalize)
        
        # Mensagem apropriada baseada no resultado
        if has_discrepancies and final_cycle > current_cycle:
            message = f"Rodada encerrada - {products_needing_next_cycle} divergências encontradas - Avançando para Ciclo {final_cycle}"
        elif is_auto_finalized:
            message = f"✨ Inventário FINALIZADO AUTOMATICAMENTE no Ciclo {current_cycle} - Todas as quantidades conferem!"
        elif not has_discrepancies and final_status == 'ENCERRADA':
            message = f"Inventário FINALIZADO no Ciclo {current_cycle} - Sem divergências!"
        else:
            message = f"Rodada de contagem encerrada para {user.full_name}"
        
        return {
            "success": True,
            "message": message,
            "data": {
                "inventory_id": inventory_id,
                "inventory_name": inventory.name,
                "user_id": user_id,
                "user_name": user.full_name,
                "cycle_number": final_cycle,  # Retornar o ciclo REAL
                "previous_cycle": current_cycle,
                "list_status": final_status,
                "updated_count": updated_count,
                "has_discrepancies": has_discrepancies,
                "products_needing_next_cycle": products_needing_next_cycle,
                "next_action": next_action,
                "is_auto_finalized": is_auto_finalized,
                "force_finalize": force_finalize,
                "closed_at": datetime.utcnow().isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "ao encerrar rodada")
        )


@router.put("/counting-lists/{list_id}/close-round")
async def close_counting_list_round(
    list_id: str,
    force_finalize: bool = Query(False, description="Se True, finaliza o inventário no ciclo atual sem avançar"),
    db: Session = Depends(get_db)
):
    """
    🔧 ENDPOINT ESPECÍFICO PARA SISTEMA MULTILISTA

    Encerra uma lista de contagem específica e aplica as correções definitivas:
    - Marca flags needs_recount_cycle_X automaticamente
    - Cria assignments para próximos ciclos
    - Sincroniza tabelas
    """
    try:
        # 1. Buscar a lista de contagem
        from app.models.models import CountingList
        counting_list = db.query(CountingList).filter(
            CountingList.id == list_id
        ).first()

        if not counting_list:
            raise HTTPException(
                status_code=404,
                detail=f"Lista de contagem não encontrada: {list_id}"
            )

        # 2. Buscar o inventário relacionado
        inventory = db.query(InventoryListModel).filter(
            InventoryListModel.id == counting_list.inventory_id
        ).first()

        if not inventory:
            raise HTTPException(
                status_code=404,
                detail=f"Inventário não encontrado: {counting_list.inventory_id}"
            )

        # 3. Verificar divergências baseado no ciclo atual
        current_cycle = counting_list.current_cycle
        logger.info(f"🔧 [MULTILISTA] Encerrando lista {list_id} - ciclo {current_cycle}")

        # 4. Buscar produtos da lista com divergências
        from app.models.models import CountingListItem, Counting
        from sqlalchemy.orm import aliased

        list_items = db.query(CountingListItem).filter(
            CountingListItem.counting_list_id == list_id
        ).all()

        # 🔧 VALIDAÇÃO CRÍTICA: Verificar se há pelo menos uma contagem no ciclo atual
        has_any_counting = False
        for item in list_items:
            inventory_item = db.query(InventoryItemModel).filter(
                InventoryItemModel.id == item.inventory_item_id
            ).first()

            if inventory_item:
                counting = db.query(Counting).filter(
                    Counting.inventory_item_id == inventory_item.id,
                    Counting.count_number == current_cycle
                ).first()

                if counting:
                    has_any_counting = True
                    break

        if not has_any_counting:
            logger.warning(f"⚠️ [VALIDAÇÃO] Tentativa de encerrar lista sem contagens no ciclo {current_cycle}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Não é possível encerrar esta lista! Nenhum item foi contado no ciclo {current_cycle}. Realize a contagem de pelo menos um item ou use 'Finalizar Lista' para encerrar sem contar."
            )

        logger.info(f"✅ [VALIDAÇÃO] Lista possui contagens no ciclo {current_cycle}, pode encerrar")

        items_needing_next_cycle = []
        has_discrepancies = False

        for list_item in list_items:
            # Buscar item do inventário relacionado
            inventory_item = db.query(InventoryItemModel).filter(
                InventoryItemModel.id == list_item.inventory_item_id
            ).first()

            if not inventory_item:
                continue

            # Verificar se tem contagem no ciclo atual
            counting = db.query(Counting).filter(
                Counting.inventory_item_id == inventory_item.id,
                Counting.count_number == current_cycle
            ).first()

            if counting:
                # ✅ v2.19.9: CORREÇÃO CRÍTICA - Lógica de divergência por ciclo
                #
                # CICLO 1: Compara count_1 vs expected
                #   - Se diferentes → vai para ciclo 2
                #
                # CICLO 2: Verifica em ordem:
                #   1. count_2 == expected? → OK, finalizado
                #   2. count_2 == count_1? → OK, confirmado, finalizado
                #   3. Nenhum bateu → vai para ciclo 3 (desempate)
                #
                # CICLO 3: Contagem final (desempate)
                #   - O valor é aceito independente de bater com algo
                #   - Não avança mais

                has_divergence = False
                expected = inventory_item.expected_quantity

                if current_cycle == 1:
                    # Ciclo 1 → 2: Comparar contagem com quantidade esperada
                    difference = abs(counting.quantity - expected)
                    has_divergence = difference >= 0.01
                    logger.debug(f"[CICLO 1] Produto {inventory_item.product_code}: count_1={counting.quantity}, expected={expected}, diff={difference}, divergente={has_divergence}")

                elif current_cycle == 2:
                    # Ciclo 2 → 3: Verificar se count_2 bate com expected OU com count_1
                    count_2 = counting.quantity

                    # Buscar count_1
                    count_1_record = db.query(Counting).filter(
                        Counting.inventory_item_id == inventory_item.id,
                        Counting.count_number == 1
                    ).first()
                    count_1 = count_1_record.quantity if count_1_record else None

                    # Verificação 1: count_2 == expected?
                    matches_expected = abs(count_2 - expected) < 0.01

                    # Verificação 2: count_2 == count_1?
                    matches_count_1 = count_1 is not None and abs(count_2 - count_1) < 0.01

                    if matches_expected:
                        # Bateu com esperado - OK, não precisa ciclo 3
                        has_divergence = False
                        logger.debug(f"[CICLO 2] Produto {inventory_item.product_code}: count_2={count_2} == expected={expected} ✅ OK")
                    elif matches_count_1:
                        # Bateu com count_1 - confirmado, não precisa ciclo 3
                        has_divergence = False
                        logger.debug(f"[CICLO 2] Produto {inventory_item.product_code}: count_2={count_2} == count_1={count_1} ✅ CONFIRMADO")
                    else:
                        # Não bateu com nenhum - precisa desempate no ciclo 3
                        has_divergence = True
                        logger.debug(f"[CICLO 2] Produto {inventory_item.product_code}: count_2={count_2} != expected={expected} e != count_1={count_1} ❌ PRECISA CICLO 3")

                # Ciclo 3: Não marca divergência (é a contagem final)

                if has_divergence:
                    items_needing_next_cycle.append(inventory_item)
                    has_discrepancies = True

                    # 5. Marcar flags automaticamente
                    if current_cycle == 1:
                        inventory_item.needs_recount_cycle_2 = True
                        list_item.needs_count_cycle_2 = True
                    elif current_cycle == 2:
                        inventory_item.needs_recount_cycle_3 = True
                        list_item.needs_count_cycle_3 = True

        # 6. Atualizar status da lista e avançar ciclo
        is_auto_finalized = False  # ✅ v2.19.9: Inicializar flag

        if has_discrepancies and current_cycle < 3:
            # Avançar para próximo ciclo
            next_cycle = current_cycle + 1
            counting_list.current_cycle = next_cycle
            counting_list.list_status = 'ABERTA'  # Liberar para próximo ciclo

            # ✅ CORREÇÃO CRÍTICA: NÃO sincronizar todas as listas!
            # Cada lista tem seu ciclo independente
            logger.info(f"✅ [ISOLAMENTO] Lista {list_id} avançou para ciclo {next_cycle} SEM afetar outras listas")

            logger.info(f"✅ [MULTILISTA] Lista avançada para ciclo {next_cycle} - {len(items_needing_next_cycle)} produtos com divergência")

        else:
            # Finalizar lista (sem divergências ou ciclo 3 encerrado)
            counting_list.list_status = 'ENCERRADA'
            is_auto_finalized = not has_discrepancies  # ✅ v2.19.9: Sem divergências = finalização automática
            logger.info(f"✅ [MULTILISTA] Lista finalizada no ciclo {current_cycle} (auto_finalized={is_auto_finalized})")

        # 7. Commit das mudanças
        db.commit()

        # ✅ v2.19.9: Incluir flags para o frontend
        is_finalized = counting_list.list_status == 'ENCERRADA'

        return {
            "success": True,
            "message": f"Lista encerrada com sucesso - ciclo {current_cycle}",
            "data": {
                "list_id": list_id,
                "inventory_id": str(counting_list.inventory_id),
                "previous_cycle": current_cycle,
                "current_cycle": counting_list.current_cycle,
                "cycle_number": counting_list.current_cycle,
                "products_needing_recount": len(items_needing_next_cycle),
                "has_discrepancies": has_discrepancies,
                "list_status": counting_list.list_status,
                "is_auto_finalized": is_finalized and not has_discrepancies,  # ✅ Sem divergências = auto finalizado
                "force_finalize": force_finalize
            }
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"❌ [MULTILISTA] Erro ao encerrar lista: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=safe_error_response(e, "ao encerrar lista")
        )


@router.get("/inventory/{inventory_id}/list-products/{user_id}")
async def get_list_products(
    inventory_id: str,
    user_id: str,
    context: str = "management",  # "management" = modal gerenciar, "counting" = página contagem
    db: Session = Depends(get_db)
):
    """
    Busca os produtos de uma lista de atribuição específica
    
    Retorna:
    - Produtos atribuídos ao usuário neste inventário
    - Quantidades contadas (se houver)
    - Status de cada produto
    """
    
    try:
        # Buscar inventário
        inventory = db.query(InventoryListModel).filter(
            InventoryListModel.id == inventory_id
        ).first()
        
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventário não encontrado"
            )
        
        # Buscar usuário
        user = db.query(UserModel).filter(
            UserModel.id == user_id
        ).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuário não encontrado"
            )
        
        # ✅ VALIDAÇÃO: Verificar se a lista permite contagens
        list_status = getattr(inventory, 'list_status', 'ABERTA')
        cycle_number = getattr(inventory, 'cycle_number', 1)
        
        logger.info(f"📋 Verificando status da lista: {inventory_id}, Status: {list_status}, Ciclo: {cycle_number}, Context: {context}")
        
        # VALIDAÇÃO 1: Lista ABERTA não está liberada para contagem ainda
        if context == "counting" and list_status == 'ABERTA':
            logger.warning(f"⚠️ Tentativa de contagem em lista não liberada: {inventory_id}, Status: {list_status}")
            return {
                "success": False,
                "message": f"Lista de inventário não foi liberada para contagem (Status: {list_status}). Solicite ao supervisor para liberar a lista.",
                "data": {
                    "inventory_status": list_status,
                    "cycle_number": cycle_number,
                    "can_count": False,
                    "user_products": [],
                    "reason": "not_released"
                }
            }
        
        # VALIDAÇÃO 2: Lista ENCERRADA ou 3º ciclo encerrado não permite mais contagens
        if list_status == 'ENCERRADA' or (cycle_number >= 3 and list_status in ['FINALIZADA', 'ENCERRADA']):
            logger.warning(f"🚫 Tentativa de contagem em lista encerrada: {inventory_id}, Status: {list_status}, Ciclo: {cycle_number}")
            
            # Para contexto de contagem (página counting.html), retornar erro específico
            if context == "counting":
                return {
                    "success": False,
                    "message": f"Lista de inventário encerrada (Status: {list_status}, Ciclo: {cycle_number}). Não é possível realizar mais contagens.",
                    "data": {
                        "inventory_status": list_status,
                        "cycle_number": cycle_number,
                        "can_count": False,
                        "user_products": [],
                        "reason": "closed"
                    }
                }
        
        # Query para buscar produtos atribuídos ao usuário
        from sqlalchemy.orm import aliased
        from sqlalchemy import func, and_
        
        # LÓGICA BASEADA NO CONTEXTO:
        # - "management" (modal gerenciar): SEMPRE todos os produtos
        # - "counting" (página contagem): filtrar por ciclo (1º=todos, 2º/3º=divergências)
        
        if context == "management":
            # MODAL GERENCIAR: sempre mostrar todos os produtos
            current_cycle = 1
        else:
            # PÁGINA CONTAGEM: usar ciclo real do inventário
            current_cycle = getattr(inventory, 'current_cycle', 1)
        
        if current_cycle == 1:
            # 1º ciclo: buscar todos os produtos atribuídos
            print(f"🔍 DEBUG: Entrando no 1º ciclo para inventário {inventory_id}")
            # IMPORTANTE: Sistema MULTI-ARMAZÉM - usar armazém do inventário (com fallback)
            warehouse = getattr(inventory, 'warehouse', '01') or '01'
            warehouse_location = getattr(inventory, 'warehouse_location', '02') or '02'
            
            logger.info(f"🏭 Usando warehouse: {warehouse}, location: {warehouse_location}")
            warehouse_code = warehouse
            print(f"🔍 DEBUG: Warehouse code = {warehouse_code}")
            
            # ✅ IMPLEMENTAÇÃO MELHORADA COM CONTROLE DE LOTE E CONTAGENS
            # Buscar itens com informações da SB1010 para controle de lote E contagens
            from sqlalchemy import func, and_
            from sqlalchemy.orm import aliased
            from app.models.models import Counting as CountingModel

            # Alias para contagens dos diferentes ciclos
            Count1 = aliased(CountingModel)
            Count2 = aliased(CountingModel)
            Count3 = aliased(CountingModel)

            query_result = db.query(
                InventoryItemModel,
                Count1.quantity.label('count_1'),
                Count2.quantity.label('count_2'),
                Count3.quantity.label('count_3')
            ).join(
                CountingAssignmentModel,
                CountingAssignmentModel.inventory_item_id == InventoryItemModel.id
            ).outerjoin(
                Count1, and_(
                    Count1.inventory_item_id == InventoryItemModel.id,
                    Count1.count_number == 1
                )
            ).outerjoin(
                Count2, and_(
                    Count2.inventory_item_id == InventoryItemModel.id,
                    Count2.count_number == 2
                )
            ).outerjoin(
                Count3, and_(
                    Count3.inventory_item_id == InventoryItemModel.id,
                    Count3.count_number == 3
                )
            ).filter(
                InventoryItemModel.inventory_list_id == inventory_id,
                CountingAssignmentModel.assigned_to == user_id
            ).distinct().all()  # ✅ ADICIONAR DISTINCT PARA EVITAR DUPLICATAS
            
            # Construir resposta melhorada com busca adicional da SB1010 E contagens
            user_products = []
            for row in query_result:
                # A query sempre retorna uma tupla porque inclui os counts
                item = row[0]  # InventoryItemModel
                count_1 = row[1]  # Count1.quantity
                count_2 = row[2]  # Count2.quantity
                count_3 = row[3]  # Count3.quantity

                # ✅ TEMPORÁRIO: Definir controle de lote baseado nos produtos conhecidos
                # 00010008 = sem lote, 00010037 = com lote
                if item.product_code == '00010037':
                    product_name = "COLOSSO PULV.OF 25ML"
                    requires_lot = True
                    unit = "UN"
                elif item.product_code == '00010008':
                    product_name = "CHAVE COMUT.FASE CM8450 20VCV"
                    requires_lot = False
                    unit = "UN"
                else:
                    product_name = f"Produto {item.product_code}"
                    requires_lot = False
                    unit = 'UN'

                user_products.append({
                    "item_id": str(item.id),
                    "product_code": item.product_code,
                    "expected_quantity": float(item.expected_quantity or 0),
                    "product_name": product_name,
                    "unit": unit,
                    "status": "PENDING",
                    "requires_lot": requires_lot,  # ✅ INFORMAÇÃO DE CONTROLE DE LOTE
                    "controls_batch": requires_lot,  # ✅ COMPATIBILIDADE
                    # ✅ ADICIONADOS: Campos de contagem por ciclo
                    "count_1": float(count_1) if count_1 is not None else None,
                    "count_2": float(count_2) if count_2 is not None else None,
                    "count_3": float(count_3) if count_3 is not None else None,
                })
            
            return {
                "success": True,
                "message": f"Produtos encontrados para contagem",
                "data": {
                    "inventory_id": inventory_id,
                    "user_id": user_id,
                    "can_count": True,
                    # ✅ CORREÇÃO: Usar 'items' para compatibilidade com frontend
                    "items": user_products,
                    "user_products": user_products,
                    "total_products": len(user_products),
                    "cycle_number": getattr(inventory, 'current_cycle', 1),
                    "list_status": getattr(inventory, 'list_status', 'EM_CONTAGEM')
                }
            }
            
            # ✅ FILTRO POR USUÁRIO E CONTEXTO
            if context == "management":
                # MODAL GERENCIAR: mostrar produtos ATRIBUÍDOS ao usuário
                print(f"🔍 DEBUG: Modal Gerenciar - mostrando produtos atribuídos ao usuário {user_id}")
                products_query = products_query.filter(
                    InventoryItemModel.inventory_list_id == inventory_id,
                    CountingAssignmentModel.assigned_to == user_id,
                    InventoryItemModel.is_available_for_assignment == False  # FILTRO: Produtos JÁ ATRIBUÍDOS
                )
            else:
                # PÁGINA CONTAGEM: mesma lógica anterior
                if user.role == 'ADMIN':
                    # ADMIN na página de contagem: ver produtos disponíveis
                    print(f"🔍 DEBUG: Admin na contagem - produtos disponíveis")
                    products_query = products_query.filter(
                        InventoryItemModel.inventory_list_id == inventory_id,
                        InventoryItemModel.is_available_for_assignment == True  # FILTRO: Apenas produtos disponíveis
                    )
                else:
                    # Outros usuários na contagem: apenas produtos atribuídos a eles
                    products_query = products_query.filter(
                        InventoryItemModel.inventory_list_id == inventory_id,
                        CountingAssignmentModel.assigned_to == user_id,
                        InventoryItemModel.is_available_for_assignment == False  # FILTRO: Produtos ATRIBUÍDOS ao usuário
                    )
            
            products_result = products_query.all()
        else:
            # 2º/3º ciclo: implementar REGRA DE MAIORIA (mesma lógica de /release-list)
            from app.models.models import Counting
            from sqlalchemy import func, case, or_, and_
            from sqlalchemy.orm import aliased
            
            # ✅ REGRA DE MAIORIA: Count1 = Count2 = FINAL
            # Alias para contagens dos diferentes ciclos
            Count1 = aliased(Counting)
            Count2 = aliased(Counting)
            Count3 = aliased(Counting)
            
            # IMPORTANTE: Sistema MULTI-ARMAZÉM - usar armazém do inventário (com fallback)
            # REGRA: NUNCA usar B1_LOCPAD da SB1010 - somente B2_LOCAL da SB2010
            warehouse_code = getattr(inventory, 'warehouse', '01') or '01'
            warehouse_location = getattr(inventory, 'warehouse_location', '02') or '02'
            
            # Buscar contagens por ciclo para análise de maioria
            counting_analysis_subq = db.query(
                InventoryItemModel.id.label('item_id'),
                # REGRA IMPORTANTE: Buscar quantidade real da SB2010 (B2_QATU) - NUNCA usar B1_LOCPAD
                func.coalesce(SB2010.b2_qatu, InventoryItemModel.expected_quantity, 0).label('system_qty'),
                Count1.quantity.label('count_1'),
                Count2.quantity.label('count_2'),
                Count3.quantity.label('count_3')
            ).outerjoin(
                SB2010, and_(
                    func.trim(SB2010.b2_cod) == func.trim(InventoryItemModel.product_code),
                    SB2010.b2_filial == '01',  # Filial padrão
                    SB2010.b2_local == warehouse_code  # Armazém correto (02) - NUNCA B1_LOCPAD
                )
            ).outerjoin(
                Count1, and_(
                    Count1.inventory_item_id == InventoryItemModel.id,
                    Count1.count_number == 1
                )
            ).outerjoin(
                Count2, and_(
                    Count2.inventory_item_id == InventoryItemModel.id,
                    Count2.count_number == 2
                )
            ).outerjoin(
                Count3, and_(
                    Count3.inventory_item_id == InventoryItemModel.id,
                    Count3.count_number == 3
                )
            ).filter(
                InventoryItemModel.inventory_list_id == inventory_id
            ).subquery()
            
            # Aplicar lógica de negócio baseada no ciclo
            if current_cycle == 2:
                # 2º CICLO: 1ª Cont ≠ qtde esperado → terá 2ª contagem (NULL = 0)
                differences_subq = db.query(
                    counting_analysis_subq.c.item_id,
                    counting_analysis_subq.c.count_1.label('counted_qty'),
                    counting_analysis_subq.c.system_qty.label('expected_qty'),
                    case(
                        # REGRA: 1ª Cont (NULL=0) = qtde esperado → NÃO terá 2ª contagem
                        (
                            func.abs(func.coalesce(counting_analysis_subq.c.count_1, 0) - func.coalesce(counting_analysis_subq.c.system_qty, 0)) < 0.01
                        , 0),
                        # REGRA: 1ª Cont (NULL=0) ≠ qtde esperado → SIM terá 2ª contagem
                        (
                            func.abs(func.coalesce(counting_analysis_subq.c.count_1, 0) - func.coalesce(counting_analysis_subq.c.system_qty, 0)) >= 0.01
                        , 1),
                        else_=0
                    ).label('needs_recount')
                ).subquery()
            elif current_cycle == 3:
                # 3º CICLO: Lógica detalhada conforme especificação (NULL = 0)
                differences_subq = db.query(
                    counting_analysis_subq.c.item_id,
                    counting_analysis_subq.c.count_2.label('counted_qty'),
                    counting_analysis_subq.c.system_qty.label('expected_qty'),
                    case(
                        # REGRA: 2ª Cont (NULL=0) = qtde esperado → NÃO terá 3ª contagem
                        (
                            func.abs(func.coalesce(counting_analysis_subq.c.count_2, 0) - func.coalesce(counting_analysis_subq.c.system_qty, 0)) < 0.01
                        , 0),
                        # REGRA: 2ª Cont (NULL=0) = 1ª Cont (NULL=0) → NÃO terá 3ª contagem
                        (
                            func.abs(func.coalesce(counting_analysis_subq.c.count_1, 0) - func.coalesce(counting_analysis_subq.c.count_2, 0)) < 0.01
                        , 0),
                        # REGRA: 2ª Cont (NULL=0) ≠ 1ª Cont (NULL=0) ≠ qtde esperado → SIM terá 3ª contagem
                        (and_(
                            # 2ª Cont ≠ 1ª Cont
                            func.abs(func.coalesce(counting_analysis_subq.c.count_1, 0) - func.coalesce(counting_analysis_subq.c.count_2, 0)) >= 0.01,
                            # 2ª Cont ≠ qtde esperado
                            func.abs(func.coalesce(counting_analysis_subq.c.count_2, 0) - func.coalesce(counting_analysis_subq.c.system_qty, 0)) >= 0.01
                        ), 1),
                        else_=0
                    ).label('needs_final_count')
                ).subquery()
            else:
                # Fallback
                differences_subq = counting_analysis_subq
            
            # ✅ SEPARAR CONSULTAS: ADMIN vs Usuários regulares
            if user.role == 'ADMIN':
                # ADMIN: ver todos os produtos com divergência (sem restrição de atribuição)
                products_query = db.query(
                    InventoryItemModel.id.label('item_id'),
                    InventoryItemModel.product_id,
                    InventoryItemModel.product_code,
                    # Campos do produto (se existir) - ✅ USANDO COLUNAS CORRETAS DO BANCO
                    Product.name.label('product_name'),
                    Product.code.label('product_code_product'),
                    Product.name.label('product_description'),  # name é a descrição
                    Product.barcode.label('barcode'),
                    Product.unit.label('unit'),
                    func.literal('N').label('controls_batch'),  # Padrão: sem rastro
                    # Buscar descrição real do produto na SB1010
                    SB1010.b1_desc.label('sb1010_description'),
                    SB1010.b1_codbar.label('sb1010_barcode'),
                    SB1010.b1_um.label('sb1010_unit'),
                    SB1010.b1_rastro.label('sb1010_controls_batch'),
                    # REGRA IMPORTANTE: Buscar quantidade real da SB2010 (B2_QATU) - NUNCA usar B1_LOCPAD
                    func.coalesce(SB2010.b2_qatu, InventoryItemModel.expected_quantity, 0).label('expected_quantity'),
                    # Para ADMIN, simular assignment status
                    func.coalesce(CountingAssignmentModel.status, 'PENDING').label('assignment_status'),
                    func.coalesce(CountingAssignmentModel.created_at, InventoryItemModel.created_at).label('assigned_at')
                ).select_from(InventoryItemModel).join(
                    differences_subq, InventoryItemModel.id == differences_subq.c.item_id
                ).outerjoin(
                    Product, InventoryItemModel.product_id == Product.id
                ).outerjoin(
                    SB1010, func.trim(SB1010.b1_cod) == func.trim(InventoryItemModel.product_code)
                ).outerjoin(
                    SB2010, and_(
                        func.trim(SB2010.b2_cod) == func.trim(InventoryItemModel.product_code),
                        SB2010.b2_filial == '01',  # Filial padrão
                        SB2010.b2_local == warehouse_code  # Armazém correto (02) - NUNCA B1_LOCPAD
                    )
                ).outerjoin(
                    CountingAssignmentModel, CountingAssignmentModel.inventory_item_id == InventoryItemModel.id
                ).filter(
                    InventoryItemModel.inventory_list_id == inventory_id
                )
                
                # ✅ APLICAR FILTRO DE DIVERGÊNCIAS APENAS NO CICLO 2/3 (VIA SUBQUERY SEPARADA)
                if current_cycle >= 2:
                    # Para ciclo 2/3, filtrar apenas produtos com divergência
                    if current_cycle == 2:
                        products_query = products_query.join(
                            differences_subq, InventoryItemModel.id == differences_subq.c.item_id
                        ).filter(differences_subq.c.needs_recount == 1)
                    elif current_cycle == 3:
                        products_query = products_query.join(
                            differences_subq, InventoryItemModel.id == differences_subq.c.item_id
                        ).filter(differences_subq.c.needs_final_count == 1)
                    
                products_result = products_query.all()
            else:
                # Usuários regulares: apenas produtos com divergência atribuídos a eles
                products_query = db.query(
                    InventoryItemModel.id.label('item_id'),
                    InventoryItemModel.product_id,
                    InventoryItemModel.product_code,
                    InventoryItemModel.status.label('inventory_item_status'),  # ✅ INCLUIR STATUS DO ITEM
                    # Campos do produto (se existir) - ✅ USANDO COLUNAS CORRETAS DO BANCO
                    Product.name.label('product_name'),
                    Product.code.label('product_code_product'),
                    Product.name.label('product_description'),  # name é a descrição
                    Product.barcode.label('barcode'),
                    Product.unit.label('unit'),
                    func.literal('N').label('controls_batch'),  # Padrão: sem rastro
                    # Buscar descrição real do produto na SB1010
                    SB1010.b1_desc.label('sb1010_description'),
                    SB1010.b1_codbar.label('sb1010_barcode'),
                    SB1010.b1_um.label('sb1010_unit'),
                    SB1010.b1_rastro.label('sb1010_controls_batch'),
                    # REGRA IMPORTANTE: Buscar quantidade real da SB2010 (B2_QATU) - NUNCA usar B1_LOCPAD
                    func.coalesce(SB2010.b2_qatu, InventoryItemModel.expected_quantity, 0).label('expected_quantity'),
                    CountingAssignmentModel.status.label('assignment_status'),
                    CountingAssignmentModel.created_at.label('assigned_at')
                ).select_from(CountingAssignmentModel).join(
                    InventoryItemModel, CountingAssignmentModel.inventory_item_id == InventoryItemModel.id
                ).outerjoin(
                    Product, InventoryItemModel.product_id == Product.id
                ).outerjoin(
                    SB1010, func.trim(SB1010.b1_cod) == func.trim(InventoryItemModel.product_code)
                ).outerjoin(
                    SB2010, and_(
                        func.trim(SB2010.b2_cod) == func.trim(InventoryItemModel.product_code),
                        SB2010.b2_filial == '01',  # Filial padrão
                        SB2010.b2_local == warehouse_code  # Armazém correto (02) - NUNCA B1_LOCPAD
                    )
                ).filter(
                    InventoryItemModel.inventory_list_id == inventory_id,
                    CountingAssignmentModel.assigned_to == user_id,
                    CountingAssignmentModel.count_number == current_cycle  # ✅ FILTRAR por ciclo atual
                )
                
                # 🔍 DEBUG: Log da query para investigar duplicação  
                logger.info(f"🔍 QUERY DEBUG - Ciclo: {current_cycle}, Inventário: {inventory_id}, Usuário: {user_id}")
                
                # ✅ APLICAR FILTRO DE DIVERGÊNCIAS APENAS NO CICLO 2/3 (VIA SUBQUERY SEPARADA)
                if current_cycle >= 2:
                    # Para ciclo 2/3, filtrar apenas produtos com divergência
                    if current_cycle == 2:
                        products_query = products_query.join(
                            differences_subq, InventoryItemModel.id == differences_subq.c.item_id
                        ).filter(differences_subq.c.needs_recount == 1)
                    elif current_cycle == 3:
                        products_query = products_query.join(
                            differences_subq, InventoryItemModel.id == differences_subq.c.item_id
                        ).filter(differences_subq.c.needs_final_count == 1)
                    
                products_result = products_query.all()
        
        # Buscar TODAS as contagens de cada item (independente do usuário)
        # Isso resolve o problema das contagens desaparecendo após reatribuição
        item_ids = list(set([row.id for row in products_result]))  # ✅ REMOVER DUPLICATAS
        countings_map = {}
        
        if item_ids:
            countings_query = db.query(
                Counting.inventory_item_id,
                Counting.quantity,
                Counting.lot_number,
                Counting.serial_number,
                Counting.created_at,
                Counting.observation,
                Counting.counted_by,
                Counting.count_number
            ).filter(
                Counting.inventory_item_id.in_(item_ids)
            ).order_by(Counting.created_at.asc()).all()
            
            # Organizar contagens por item_id e ciclo
            for counting in countings_query:
                item_id = counting.inventory_item_id
                if item_id not in countings_map:
                    countings_map[item_id] = {}
                
                cycle = counting.count_number or 1
                countings_map[item_id][cycle] = {
                    'quantity': counting.quantity,
                    'batch_number': counting.lot_number,
                    'serial_number': counting.serial_number,
                    'counting_date': counting.created_at,
                    'notes': counting.observation,
                    'counted_by': counting.counted_by
                }
        
        
        # ✅ REMOVER PRODUTOS DUPLICADOS mantendo apenas a atribuição mais recente por item
        unique_products = {}
        for row in products_result:
            item_id = str(row.item_id)
            if item_id not in unique_products or row.assigned_at > unique_products[item_id].assigned_at:
                unique_products[item_id] = row
        
        # Construir lista de produtos (usando apenas produtos únicos)
        products = []
        for row in unique_products.values():
            # Usar código do produto cadastrado ou do inventory_item
            final_product_code = row.product_code_product if row.product_code_product else (row.product_code or "N/A")
            
            # Priorizar dados da SB1010 (tabela oficial de produtos do Protheus)
            final_description = (
                row.sb1010_description or 
                row.product_description or 
                f"Produto {final_product_code}"
            )
            
            final_barcode = row.sb1010_barcode or row.barcode or ""
            final_unit = row.sb1010_unit or row.unit or "UN"
            final_controls_batch = (
                (row.sb1010_controls_batch == 'S') if row.sb1010_controls_batch else 
                ((row.controls_batch == 'S') if row.controls_batch else False)
            )
            
            # Buscar contagens por ciclo para este item
            item_countings = countings_map.get(row.item_id, {})
            
            # Dados do ciclo 1
            cycle_1 = item_countings.get(1, {})
            count_1_qty = cycle_1.get('quantity')
            
            # Dados do ciclo 2 
            cycle_2 = item_countings.get(2, {})
            count_2_qty = cycle_2.get('quantity')
            
            # Dados do ciclo 3
            cycle_3 = item_countings.get(3, {})
            count_3_qty = cycle_3.get('quantity')
            
            # CORREÇÃO CRÍTICA: Usar quantidade do ciclo atual, não a última disponível
            current_cycle = getattr(inventory, 'current_cycle', 1)
            
            # Quantidade contada do ciclo atual específico
            if current_cycle == 1:
                final_counted_quantity = count_1_qty
            elif current_cycle == 2:
                final_counted_quantity = count_2_qty  
            elif current_cycle == 3:
                final_counted_quantity = count_3_qty
            else:
                final_counted_quantity = None
            
            # Pegar dados da última contagem para informações extras
            last_cycle = 3 if count_3_qty is not None else (2 if count_2_qty is not None else (1 if count_1_qty is not None else None))
            last_counting = item_countings.get(last_cycle, {}) if last_cycle else {}
            
            # ✅ CORREÇÃO: Usar expected_quantity gravado no inventário (NÃO buscar em tempo real)
            # O saldo do sistema foi capturado no momento da criação do inventário
            # e está armazenado em inventory_items.expected_quantity
            saldo_sistema_atual = float(row.expected_quantity) if row.expected_quantity else 0.0
            
            products.append({
                "item_id": str(row.item_id),
                "product_id": str(row.product_id) if row.product_id else None,
                "product_code": final_product_code,
                "product_name": final_description,  # Usar a descrição real como nome
                "product_description": final_description,  # Descrição real da SB1010
                "barcode": final_barcode,
                "unit": final_unit,
                "controls_batch": final_controls_batch,
                "warehouse_location": warehouse_location,  # ✅ Armazém/Local do inventário
                "system_quantity": saldo_sistema_atual,  # ✅ CORRIGIDO: usar saldo atual da SB2010
                # Quantidade principal (ciclo atual) - PADRÃO ZERO para facilitar usuário
                "counted_quantity": float(final_counted_quantity) if final_counted_quantity is not None else 0.0,
                # Quantidades por ciclo específico
                "count_1": float(count_1_qty) if count_1_qty is not None else None,
                "count_2": float(count_2_qty) if count_2_qty is not None else None,
                "count_3": float(count_3_qty) if count_3_qty is not None else None,
                # Informações da última contagem
                "batch_number": last_counting.get('batch_number'),
                "serial_number": last_counting.get('serial_number'),
                "notes": last_counting.get('notes'),
                "counting_date": last_counting.get('counting_date').isoformat() if last_counting.get('counting_date') else None,
                # Informações da atribuição
                "assignment_status": row.assignment_status,
                "assigned_at": row.assigned_at.isoformat() if row.assigned_at else None,
                # ✅ INCLUIR STATUS DO INVENTORY ITEM
                "status": getattr(row, 'inventory_item_status', 'PENDING'),  # Status da contagem
                # Status de contagem
                "has_counting": final_counted_quantity is not None,
                "total_cycles": len(item_countings)
            })
        
        # Obter ciclo atual do inventário
        current_cycle = getattr(inventory, 'current_cycle', 1)
        
        return {
            "success": True,
            "message": f"Encontrados {len(products)} produtos para {user.full_name} - Ciclo {current_cycle}",
            "data": {
                "inventory_id": inventory_id,
                "inventory_name": inventory.name,
                "current_cycle": current_cycle,  # ✅ INFORMAR CICLO ATUAL
                "user_id": user_id,
                "user_name": user.full_name,
                "products": products,
                "total_products": len(products),
                "counted_products": len([p for p in products if p["has_counting"]])
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "ao buscar produtos da lista")
        )

@router.put("/inventory/{inventory_id}/reassign-counter")
async def reassign_counter(
    inventory_id: str,
    current_user_id: str = Query(..., description="ID do usuário atual responsável"),
    new_user_id: str = Query(..., description="ID do novo usuário responsável"),
    db: Session = Depends(get_db)
):
    """
    Reatribui um contador para outro usuário em ciclos 2+ com histórico
    
    Este endpoint permite alterar o responsável pela contagem mantendo o histórico:
    1. Valida que a lista está com status ABERTA e ciclo > 1
    2. Busca atribuições do usuário atual
    3. Move usuário atual para previous_counter_id (histórico)
    4. Atribui novo usuário como responsible
    5. Mantém rastreabilidade das mudanças
    
    Args:
        inventory_id: ID do inventário
        current_user_id: ID do usuário atualmente responsável
        new_user_id: ID do novo usuário que assumirá a contagem
        
    Returns:
        Relatório da reatribuição realizada
    """
    
    try:
        # Buscar inventário
        inventory = db.query(InventoryListModel).filter(
            InventoryListModel.id == inventory_id
        ).first()
        
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventário não encontrado"
            )
        
        # Verificar status da lista (deve estar ABERTA para reatribuição)
        list_status = getattr(inventory, 'list_status', 'ABERTA')
        if list_status != 'ABERTA':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Reatribuição só é permitida quando a lista está ABERTA. Status atual: {list_status}"
            )
        
        # Verificar ciclo - permitindo reatribuição em qualquer ciclo desde que status seja ABERTA
        current_cycle = getattr(inventory, 'current_cycle', 1)
        
        # Log informativo sobre o ciclo atual
        if current_cycle >= 3:
            print(f"⚠️  AVISO: Reatribuição no ciclo final (3) - {inventory.name}")
        else:
            print(f"🔄 Reatribuição no ciclo {current_cycle} - {inventory.name}")
        
        # Buscar usuários
        current_user = db.query(UserModel).filter(
            UserModel.id == current_user_id
        ).first()
        
        new_user = db.query(UserModel).filter(
            UserModel.id == new_user_id
        ).first()
        
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuário atual não encontrado"
            )
            
        if not new_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Novo usuário não encontrado"
            )
        
        # Verificar que ambos os usuários são da mesma loja
        if current_user.store_id != new_user.store_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usuários devem ser da mesma loja para reatribuição"
            )
        
        # Buscar atribuições do usuário atual APENAS no ciclo atual
        # ✅ CORREÇÃO CRÍTICA: Filtrar apenas por count_number do ciclo atual
        # Isso impede modificação de ciclos já concluídos (preserva histórico)
        print(f"🔍 DEBUG: Buscando atribuições - inventory_id={inventory_id}, user_id={current_user_id}, cycle={current_cycle}")
        
        assignments = db.query(CountingAssignmentModel).join(
            InventoryItemModel, CountingAssignmentModel.inventory_item_id == InventoryItemModel.id
        ).filter(
            InventoryItemModel.inventory_list_id == inventory_id,
            CountingAssignmentModel.assigned_to == current_user_id,
            CountingAssignmentModel.count_number == current_cycle  # ✅ APENAS ciclo atual
        ).all()
        
        print(f"🔍 BUSCA: Encontradas {len(assignments)} atribuições do usuário {current_user.full_name} no ciclo {current_cycle}")
        
        # DEBUG: Verificar todas as atribuições existentes
        all_assignments = db.query(CountingAssignmentModel).join(
            InventoryItemModel, CountingAssignmentModel.inventory_item_id == InventoryItemModel.id
        ).filter(
            InventoryItemModel.inventory_list_id == inventory_id,
            CountingAssignmentModel.count_number == current_cycle
        ).all()
        print(f"🔍 DEBUG: Total de atribuições no ciclo {current_cycle}: {len(all_assignments)}")
        for assign in all_assignments[:3]:  # Mostrar apenas 3 primeiras
            print(f"🔍 DEBUG: Assignment {assign.id} -> user {assign.assigned_to} cycle {assign.count_number}")
        
        # Se não há atribuições do usuário atual, buscar TODAS as atribuições do ciclo atual
        # ✅ CORREÇÃO: Permitir reatribuição por supervisores/admins em qualquer ciclo
        if not assignments:
            print(f"🔍 Usuário {current_user.full_name} não tem atribuições no ciclo {current_cycle}")
            print(f"🔄 Buscando TODAS as atribuições existentes do ciclo {current_cycle} para reatribuir")
            
            # Buscar TODAS as atribuições do ciclo atual (independente do usuário)
            all_cycle_assignments = db.query(CountingAssignmentModel).join(
                InventoryItemModel, CountingAssignmentModel.inventory_item_id == InventoryItemModel.id
            ).filter(
                InventoryItemModel.inventory_list_id == inventory_id,
                CountingAssignmentModel.count_number == current_cycle
            ).all()
            
            if all_cycle_assignments:
                # Reatribuir todas as atribuições existentes do ciclo atual
                print(f"✅ Encontradas {len(all_cycle_assignments)} atribuições do ciclo {current_cycle} para reatribuir")
                assignments = all_cycle_assignments
            else:
                # Não existem atribuições para este ciclo - criar novas
                print(f"🔄 Criando novas atribuições para ciclo {current_cycle}")
                
                # Buscar produtos que precisam recontagem neste ciclo
                items_query = db.query(InventoryItemModel).filter(
                    InventoryItemModel.inventory_list_id == inventory_id
                )
                
                # Filtrar por necessidade de recontagem baseado no ciclo
                if current_cycle == 2:
                    items_query = items_query.filter(InventoryItemModel.needs_recount_cycle_2 == True)
                elif current_cycle == 3:
                    items_query = items_query.filter(InventoryItemModel.needs_recount_cycle_3 == True)
                
                items = items_query.all()
                
                # Criar nova atribuição para cada item que precisa recontagem
                for item in items:
                    new_assignment = CountingAssignmentModel(
                        inventory_item_id=item.id,
                        assigned_to=new_user_id,  # Já atribuir ao novo usuário
                        assigned_by=current_user_id,  # Quem está fazendo a reatribuição
                        count_number=current_cycle,
                        cycle_number=current_cycle,
                        reason=f"Reatribuição para ciclo {current_cycle}",
                        status="PENDING"
                    )
                    db.add(new_assignment)
                    assignments.append(new_assignment)
                
                if assignments:
                    db.commit()
                    print(f"✅ Criadas {len(assignments)} novas atribuições para ciclo {current_cycle}")
                    
                    # Como já criamos as atribuições para o novo usuário, podemos retornar sucesso
                    return {
                        "success": True,
                        "message": f"✅ Atribuições criadas e realizadas com sucesso! {len(assignments)} produtos atribuídos para {new_user.full_name} no {current_cycle}º CICLO",
                        "data": {
                            "inventory_id": inventory_id,
                            "inventory_name": inventory.name,
                            "cycle_number": current_cycle,
                            "new_user": {
                                "id": str(new_user.id), 
                                "name": new_user.full_name
                            },
                            "created_assignments": len(assignments),
                            "products_count": len(assignments),
                            "reassigned_at": datetime.utcnow().isoformat()
                        }
                    }
        
        if not assignments:
            # Verificar se o usuário teve atribuições no ciclo atual
            # mas já foram reatribuídas (buscar por histórico do ciclo específico)
            cycle_field_map = {
                1: CountingAssignmentModel.counter_cycle_1,
                2: CountingAssignmentModel.counter_cycle_2, 
                3: CountingAssignmentModel.counter_cycle_3
            }
            
            if current_cycle in cycle_field_map:
                assignments_check = db.query(CountingAssignmentModel).join(
                    InventoryItemModel, CountingAssignmentModel.inventory_item_id == InventoryItemModel.id
                ).filter(
                    InventoryItemModel.inventory_list_id == inventory_id,
                    cycle_field_map[current_cycle] == current_user_id,  # Específico do ciclo
                    CountingAssignmentModel.count_number == current_cycle
                ).all()
                
                if assignments_check:
                    # Já foi reatribuído anteriormente NESTE ciclo
                    return {
                        "success": True,
                        "message": f"✅ As atribuições de {current_user.full_name} no {current_cycle}º ciclo já foram reatribuídas anteriormente. Total de {len(assignments_check)} produtos já reatribuídos.",
                        "data": {
                            "inventory_id": inventory_id,
                            "inventory_name": inventory.name,
                            "cycle_number": current_cycle,
                            "already_reassigned": True,
                            "total_products": len(assignments_check),
                            "reassigned_at": datetime.utcnow().isoformat()
                        }
                    }
            
            # ✅ VERIFICAÇÃO FINAL: Se usuário não tem atribuições no ciclo atual
            # pode ser porque não há produtos com divergência para ele (ciclos 2/3)
            if current_cycle > 1:
                return {
                    "success": True,
                    "message": f"✅ Não há produtos com divergência atribuídos a {current_user.full_name} no {current_cycle}º ciclo. O inventário pode estar correto!",
                    "data": {
                        "inventory_id": inventory_id,
                        "inventory_name": inventory.name,
                        "cycle_number": current_cycle,
                        "no_discrepancies": True,
                        "total_products": 0,
                        "reassigned_at": datetime.utcnow().isoformat()
                    }
                }
            
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Nenhuma atribuição encontrada para {current_user.full_name} no {current_cycle}º ciclo"
            )
        
        # Realizar reatribuição
        updated_count = 0
        for assignment in assignments:
            # Armazenar no campo específico do ciclo atual
            if current_cycle == 1:
                # Ciclo 1: Armazenar contador inicial
                assignment.counter_cycle_1 = assignment.assigned_to
                print(f"🔄 CICLO 1: Registrando contador inicial {assignment.assigned_to}")
            elif current_cycle == 2:
                # Ciclo 2: Armazenar contador da 2ª contagem
                if not assignment.counter_cycle_1:
                    assignment.counter_cycle_1 = assignment.assigned_to  # Retroativo se não foi definido
                assignment.counter_cycle_2 = new_user_id
                print(f"🔄 CICLO 2: Registrando contador {new_user_id} (anterior: {assignment.assigned_to})")
            elif current_cycle == 3:
                # Ciclo 3: Armazenar contador da 3ª contagem
                if not assignment.counter_cycle_2:
                    assignment.counter_cycle_2 = assignment.assigned_to  # Retroativo se não foi definido
                assignment.counter_cycle_3 = new_user_id
                print(f"🔄 CICLO 3: Registrando contador {new_user_id} (anterior: {assignment.assigned_to})")
            
            # Manter compatibilidade com previous_counter_id
            assignment.previous_counter_id = assignment.assigned_to
            
            # Atribuir novo usuário
            assignment.assigned_to = new_user_id
            
            # Resetar status se necessário (volta para PENDING)
            if assignment.status == "COMPLETED":
                assignment.status = "PENDING"
            
            # Atualizar timestamp
            assignment.created_at = datetime.utcnow()
            
            # Adicionar nota sobre a reatribuição
            reassign_note = f"Reatribuído de {current_user.full_name} para {new_user.full_name} em {datetime.utcnow().strftime('%d/%m/%Y %H:%M')}"
            
            if assignment.notes:
                assignment.notes += f" | {reassign_note}"
            else:
                assignment.notes = reassign_note
            
            updated_count += 1
        
        # Salvar alterações
        db.commit()
        
        return {
            "success": True,
            "message": f"✅ Reatribuição realizada com sucesso! {updated_count} produtos reatribuídos de {current_user.full_name} para {new_user.full_name} no {current_cycle}º CICLO",
            "data": {
                "inventory_id": inventory_id,
                "inventory_name": inventory.name,
                "cycle_number": current_cycle,
                "previous_user": {
                    "id": str(current_user.id),
                    "name": current_user.full_name
                },
                "new_user": {
                    "id": str(new_user.id), 
                    "name": new_user.full_name
                },
                "updated_assignments": updated_count,
                "products_count": updated_count,  # ✅ CORREÇÃO: Usar contagem real do ciclo
                "reassigned_at": datetime.utcnow().isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "ao realizar reatribuição")
        )

@router.get("/inventory/{inventory_id}/available-counters") 
async def get_available_counters(
    inventory_id: str,
    db: Session = Depends(get_db)
):
    """
    Busca usuários disponíveis para reatribuição de contagem
    
    Retorna lista de usuários OPERATOR e SUPERVISOR da mesma loja
    que podem ser atribuídos para contagem de inventário.
    
    Args:
        inventory_id: ID do inventário
        
    Returns:
        Lista de usuários disponíveis para contagem
    """
    
    try:
        # Buscar inventário para obter store_id
        inventory = db.query(InventoryListModel).filter(
            InventoryListModel.id == inventory_id
        ).first()
        
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventário não encontrado"
            )
        
        # Buscar usuários da mesma loja (OPERATOR e SUPERVISOR podem contar)
        users = db.query(UserModel).filter(
            UserModel.store_id == inventory.store_id,
            UserModel.role.in_(["OPERATOR", "SUPERVISOR"]),
            UserModel.is_active == True
        ).order_by(UserModel.full_name).all()
        
        # Construir lista de usuários disponíveis
        available_users = []
        for user in users:
            available_users.append({
                "user_id": str(user.id),
                "username": user.username, 
                "full_name": user.full_name,
                "role": user.role,
                "email": user.email
            })
        
        return {
            "success": True,
            "message": f"Encontrados {len(available_users)} usuários disponíveis",
            "data": {
                "inventory_id": inventory_id,
                "store_id": str(inventory.store_id),
                "available_users": available_users,
                "total_users": len(available_users)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "ao buscar usuários disponíveis")
        )

@router.get("/inventory/{inventory_id}/counter-history")
async def get_counter_history(
    inventory_id: str,
    db: Session = Depends(get_db)
):
    """
    Consulta o histórico completo de contadores por ciclo para um inventário
    
    Retorna informações detalhadas sobre quais contadores foram responsáveis
    por cada ciclo de contagem em cada produto do inventário.
    
    Args:
        inventory_id: ID do inventário
        
    Returns:
        Histórico completo de contadores organizados por produto e ciclo
    """
    
    try:
        # Buscar inventário para validar
        inventory = db.query(InventoryListModel).filter(
            InventoryListModel.id == inventory_id
        ).first()
        
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventário não encontrado"
            )
        
        # Buscar atribuições com histórico de contadores por ciclo (query simplificada)
        assignments_query = db.query(
            CountingAssignmentModel.inventory_item_id,
            InventoryItemModel.product_code,
            CountingAssignmentModel.assigned_to,
            CountingAssignmentModel.counter_cycle_1,
            CountingAssignmentModel.counter_cycle_2,
            CountingAssignmentModel.counter_cycle_3,
            CountingAssignmentModel.cycle_number,
            CountingAssignmentModel.created_at,
            CountingAssignmentModel.notes,
            # Informações do usuário atual
            UserModel.full_name.label('current_counter_name')
        ).join(
            InventoryItemModel, CountingAssignmentModel.inventory_item_id == InventoryItemModel.id
        ).join(
            UserModel, CountingAssignmentModel.assigned_to == UserModel.id
        ).filter(
            InventoryItemModel.inventory_list_id == inventory_id
        ).all()
        
        # Função helper para buscar nome do usuário por ID
        def get_user_name(user_id):
            if not user_id:
                return None
            user = db.query(UserModel).filter(UserModel.id == user_id).first()
            return user.full_name if user else None
        
        # Organizar histórico por produto
        history_by_product = {}
        for row in assignments_query:
            product_code = row.product_code
            
            if product_code not in history_by_product:
                history_by_product[product_code] = {
                    "product_code": product_code,
                    "item_id": str(row.inventory_item_id),
                    "current_counter": row.current_counter_name,
                    "cycle_history": {
                        "cycle_1": {
                            "counter_id": str(row.counter_cycle_1) if row.counter_cycle_1 else None,
                            "counter_name": get_user_name(row.counter_cycle_1)
                        },
                        "cycle_2": {
                            "counter_id": str(row.counter_cycle_2) if row.counter_cycle_2 else None,
                            "counter_name": get_user_name(row.counter_cycle_2)
                        },
                        "cycle_3": {
                            "counter_id": str(row.counter_cycle_3) if row.counter_cycle_3 else None,
                            "counter_name": get_user_name(row.counter_cycle_3)
                        }
                    },
                    "assignment_notes": row.notes,
                    "last_updated": row.created_at.isoformat() if row.created_at else None
                }
        
        return {
            "success": True,
            "message": f"Histórico de contadores recuperado para inventário {inventory.name}",
            "data": {
                "inventory_id": inventory_id,
                "inventory_name": inventory.name,
                "current_cycle": getattr(inventory, 'cycle_number', 1),
                "total_products": len(history_by_product),
                "counter_history": list(history_by_product.values())
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "ao buscar histórico de contadores")
        )

@router.get("/inventory/{inventory_id}/status")
async def get_inventory_status(
    inventory_id: str,
    db: Session = Depends(get_db)
):
    """
    Busca informações de status do inventário (ciclo, status da lista, etc.)
    
    Endpoint usado pelo frontend para verificar se deve mostrar botões de reatribuição
    e outras funcionalidades baseadas no estado atual do inventário.
    
    Args:
        inventory_id: ID do inventário
        
    Returns:
        Status atual do inventário com ciclo e list_status
    """
    
    try:
        # Buscar inventário
        inventory = db.query(InventoryListModel).filter(
            InventoryListModel.id == inventory_id
        ).first()
        
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventário não encontrado"
            )
        
        # Obter informações de status
        current_cycle = getattr(inventory, 'current_cycle', 1)
        list_status = getattr(inventory, 'list_status', 'ABERTA')
        
        # Contar produtos totais e contados
        total_products = db.query(InventoryItemModel).filter(
            InventoryItemModel.inventory_list_id == inventory_id
        ).count()
        
        # Contar produtos com contagens
        from app.models.models import Counting
        counted_products = db.query(InventoryItemModel.id).join(
            Counting, Counting.inventory_item_id == InventoryItemModel.id
        ).filter(
            InventoryItemModel.inventory_list_id == inventory_id
        ).distinct().count()
        
        return {
            "success": True,
            "message": f"Status do inventário {inventory.name} recuperado",
            "data": {
                "inventory_id": inventory_id,
                "inventory_name": inventory.name,
                "current_cycle": current_cycle,
                "cycle_number": current_cycle,  # ✅ Manter compatibilidade 
                "list_status": list_status,
                "total_products": total_products,
                "counted_products": counted_products,
                "can_reassign": current_cycle > 1 and list_status == 'ABERTA',
                "created_at": inventory.created_at.isoformat() if inventory.created_at else None,
                "updated_at": inventory.updated_at.isoformat() if inventory.updated_at else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "ao buscar status do inventário")
        )

@router.get("/inventory/{inventory_id}/real-counters")
async def get_real_counters_per_cycle(
    inventory_id: str,
    db: Session = Depends(get_db)
):
    """
    Busca os contadores reais que fizeram as contagens em cada ciclo
    baseado na tabela countings (contagens efetivas realizadas)
    """
    
    try:
        # Verificar se inventário existe
        inventory = db.query(InventoryListModel).filter(
            InventoryListModel.id == inventory_id
        ).first()
        
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventário não encontrado"
            )
        
        # Buscar contadores únicos por ciclo nas atribuições (counting_assignments)
        # Isso reflete as reatribuições feitas
        from sqlalchemy import func
        
        counters_per_cycle = {}
        
        # Para cada ciclo (1, 2, 3) - buscar nas atribuições
        for cycle in [1, 2, 3]:
            # Para ciclo 1: buscar em counter_cycle_1 ou assigned_to (fallback)
            # Para ciclo 2: buscar em counter_cycle_2
            # Para ciclo 3: buscar em counter_cycle_3
            
            if cycle == 1:
                # Ciclo 1: SEMPRE usar assigned_to (que é atualizado na reatribuição)
                # counter_cycle_1 é apenas histórico
                counters_query = db.query(
                    UserModel.full_name
                ).select_from(CountingAssignmentModel).join(
                    InventoryItemModel, CountingAssignmentModel.inventory_item_id == InventoryItemModel.id
                ).join(
                    UserModel, CountingAssignmentModel.assigned_to == UserModel.id
                ).filter(
                    InventoryItemModel.inventory_list_id == inventory_id,
                    CountingAssignmentModel.count_number == cycle
                ).distinct().all()
            elif cycle == 2:
                # Ciclo 2: SEMPRE usar assigned_to para atribuições do ciclo 2
                counters_query = db.query(
                    UserModel.full_name
                ).select_from(CountingAssignmentModel).join(
                    InventoryItemModel, CountingAssignmentModel.inventory_item_id == InventoryItemModel.id
                ).join(
                    UserModel, CountingAssignmentModel.assigned_to == UserModel.id
                ).filter(
                    InventoryItemModel.inventory_list_id == inventory_id,
                    CountingAssignmentModel.count_number == cycle
                ).distinct().all()
            else:  # cycle == 3
                # Ciclo 3: SEMPRE usar assigned_to para atribuições do ciclo 3
                counters_query = db.query(
                    UserModel.full_name
                ).select_from(CountingAssignmentModel).join(
                    InventoryItemModel, CountingAssignmentModel.inventory_item_id == InventoryItemModel.id
                ).join(
                    UserModel, CountingAssignmentModel.assigned_to == UserModel.id
                ).filter(
                    InventoryItemModel.inventory_list_id == inventory_id,
                    CountingAssignmentModel.count_number == cycle
                ).distinct().all()
            
            counters_per_cycle[f"cycle_{cycle}"] = [c.full_name for c in counters_query if c.full_name]
        
        return {
            "success": True,
            "message": "Contadores reais por ciclo recuperados",
            "data": {
                "inventory_id": inventory_id,
                "inventory_name": inventory.name,
                "counters": {
                    "cycle_1": counters_per_cycle.get("cycle_1", []),
                    "cycle_2": counters_per_cycle.get("cycle_2", []),
                    "cycle_3": counters_per_cycle.get("cycle_3", [])
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "ao buscar contadores reais")
        )

@router.delete("/inventory/{inventory_id}/delete-list/{user_id}")
async def delete_user_list(
    inventory_id: str,
    user_id: str,
    db: Session = Depends(get_db)
):
    """
    Exclui a lista de um usuário específico (apenas quando Status=ABERTA e Ciclo=1)
    e libera os produtos para nova atribuição
    
    Fluxo:
    1. Valida se pode excluir (Status ABERTA + Ciclo 1)
    2. Remove atribuições do usuário
    3. Libera produtos para o pool disponível
    4. Atualiza contador de listas do inventário
    
    Args:
        inventory_id: ID do inventário
        user_id: ID do usuário cuja lista será excluída
        
    Returns:
        Confirmação da exclusão e produtos liberados
    """
    
    try:
        # Buscar inventário
        inventory = db.query(InventoryListModel).filter(
            InventoryListModel.id == inventory_id
        ).first()
        
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventário não encontrado"
            )
        
        # Buscar usuário
        user = db.query(UserModel).filter(
            UserModel.id == user_id
        ).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuário não encontrado"
            )
        
        # Verificar condições para exclusão
        list_status = getattr(inventory, 'list_status', 'ABERTA')
        cycle_number = getattr(inventory, 'cycle_number', 1)
        
        # Só permite exclusão quando Status=ABERTA e Ciclo=1
        if list_status != 'ABERTA' or cycle_number != 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Lista não pode ser excluída. Status atual: {list_status}, Ciclo: {cycle_number}. Exclusão permitida apenas para Status ABERTA + Ciclo 1."
            )
        
        # Otimização: Buscar atribuições do usuário neste inventário com JOIN
        from app.models.models import CountingAssignment as CountingAssignmentModel
        
        # Buscar atribuições do usuário com JOIN direto (sem consulta N+1)
        user_assignments_query = db.query(CountingAssignmentModel, InventoryItemModel).join(
            InventoryItemModel, CountingAssignmentModel.inventory_item_id == InventoryItemModel.id
        ).filter(
            and_(
                CountingAssignmentModel.assigned_to == user_id,
                InventoryItemModel.inventory_list_id == inventory_id
            )
        ).all()
        
        # Construir lista de itens atribuídos
        assigned_items = []
        for assignment, inventory_item in user_assignments_query:
                assigned_items.append({
                    'assignment': assignment,
                    'item': inventory_item
                })
        
        products_liberated = []
        
        # Liberar produtos (remover atribuição)
        for assigned_item in assigned_items:
            assignment = assigned_item['assignment']
            inventory_item = assigned_item['item']
            
            # Buscar informações do produto
            product = None
            if inventory_item.product_id:
                product = db.query(ProductModel).filter(
                    ProductModel.id == inventory_item.product_id
                ).first()
            
            # Adicionar à lista de produtos liberados
            products_liberated.append({
                "product_code": product.b1_cod if product else inventory_item.product_code,
                "product_name": product.b1_desc if product else "Produto não encontrado",
                "system_quantity": inventory_item.expected_quantity
            })
            
            # Remover a atribuição (liberando o produto)
            db.delete(assignment)
        
        # Commit das alterações
        db.commit()
        
        # Resposta de sucesso
        return {
            "success": True,
            "message": f"Lista do usuário {user.full_name} excluída com sucesso. {len(products_liberated)} produtos liberados.",
            "data": {
                "inventory_id": inventory_id,
                "inventory_name": inventory.name,
                "user_id": user_id,
                "user_name": user.full_name,
                "deleted_at": "2025-08-09T23:15:00Z",
                "products_liberated": products_liberated,
                "total_products_liberated": len(products_liberated),
                "status": "Lista excluída - produtos disponíveis para nova atribuição"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao excluir lista do usuário: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "ao excluir lista")
        )

# =================================
# FUNÇÃO AUXILIAR - ATUALIZAÇÃO DE STATUS DOS PRODUTOS
# =================================

def update_product_status_on_round_close(db: Session, inventory_id: str, current_cycle: int, list_status: str):
    """
    Atualiza o status dos produtos ao encerrar rodada baseado na proposta do usuário:
    
    Status dos Produtos por Ciclo:
    - PENDING: Aguardando Liberação (após encerrar rodada)
    - AWAITING_COUNT: Aguardando Contagem (após liberar para contagem)
    - COUNTED: Contado (não precisa mais contagem)
    - ZERO_CONFIRMED: Zero Confirmado
    - RECOUNT: Recontagem (2º ciclo com divergência)
    - FINAL_COUNT: Contagem Final (3º ciclo com divergência)
    """
    
    logger.info(f"🔄 Atualizando status dos produtos - Inventário: {inventory_id}, Ciclo: {current_cycle}")
    
    from app.models.models import Counting, CountingStatus
    from sqlalchemy import func, and_
    from sqlalchemy.orm import aliased
    
    # Buscar todos os itens do inventário
    items = db.query(InventoryItemModel).filter(
        InventoryItemModel.inventory_list_id == inventory_id
    ).all()
    
    Count1 = aliased(Counting)
    Count2 = aliased(Counting)
    Count3 = aliased(Counting)
    
    updated_count = 0
    
    for item in items:
        # Buscar contagens do item (usando first() para evitar erro de registros duplicados)
        count_1_result = db.query(Count1.quantity).filter(
            Count1.inventory_item_id == item.id,
            Count1.count_number == 1
        ).first()
        count_1 = count_1_result[0] if count_1_result else None
        
        count_2_result = db.query(Count2.quantity).filter(
            Count2.inventory_item_id == item.id,
            Count2.count_number == 2
        ).first()
        count_2 = count_2_result[0] if count_2_result else None
        
        count_3_result = db.query(Count3.quantity).filter(
            Count3.inventory_item_id == item.id,
            Count3.count_number == 3
        ).first()
        count_3 = count_3_result[0] if count_3_result else None
        
        expected_qty = float(item.expected_quantity or 0)
        
        # Aplicar regra NULL = 0 para comparações
        count_1_adj = float(count_1) if count_1 is not None else 0.0
        count_2_adj = float(count_2) if count_2 is not None else 0.0
        count_3_adj = float(count_3) if count_3 is not None else 0.0
        
        new_status = None
        
        # === LÓGICA BASEADA NA PROPOSTA DO USUÁRIO ===
        
        if current_cycle == 1:
            # APÓS 1º CICLO
            if count_1 is None:
                # Não contado
                new_status = CountingStatus.PENDING
            elif expected_qty == 0 and count_1_adj == 0:
                # Zero confirmado
                new_status = CountingStatus.COUNTED
            elif abs(count_1_adj - expected_qty) < 0.01:
                # Sem divergência - Contado
                new_status = CountingStatus.COUNTED
            else:
                # Com divergência - Aguarda liberação para 2º ciclo
                new_status = CountingStatus.PENDING
                
        elif current_cycle == 2:
            # APÓS 2º CICLO
            if item.status == CountingStatus.COUNTED:
                # Já finalizado no 1º ciclo - não alterar
                continue
            elif count_2 is None:
                # Não fez 2ª contagem
                new_status = CountingStatus.PENDING
            elif abs(count_2_adj - expected_qty) < 0.01:
                # 2ª contagem = esperado - Contado
                new_status = CountingStatus.COUNTED
            elif abs(count_1_adj - count_2_adj) < 0.01:
                # 1ª = 2ª contagem - Contado (regra de maioria)
                new_status = CountingStatus.COUNTED
            else:
                # Divergência persiste - Aguarda 3º ciclo
                new_status = CountingStatus.PENDING
                
        elif current_cycle >= 3:
            # APÓS 3º CICLO (ou superior)
            if item.status == CountingStatus.COUNTED:
                # Já finalizado - não alterar
                continue
            else:
                # Considerar finalizado após 3º ciclo (usar regra de maioria para quantidade final)
                new_status = CountingStatus.COUNTED
        
        # ✅ ATUALIZAR CAMPOS needs_recount_cycle_X BASEADO NAS DIVERGÊNCIAS
        if current_cycle == 1:
            # Após 1º ciclo: determinar se precisa do 2º ciclo
            needs_cycle_2 = count_1 is not None and abs(count_1_adj - expected_qty) >= 0.01
            if item.needs_recount_cycle_2 != needs_cycle_2:
                item.needs_recount_cycle_2 = needs_cycle_2
                logger.info(f"🔄 Item {item.product_code}: needs_recount_cycle_2 = {needs_cycle_2}")
                
        elif current_cycle == 2:
            # Após 2º ciclo: determinar se precisa do 3º ciclo
            # ✅ REGRA CORRIGIDA: Precisa de 3º ciclo APENAS se Count2 ≠ Sistema
            # Se Count2 = Sistema, então encerra (Count2 é a resposta correta)
            # Se Count2 ≠ Sistema, então vai para 3º ciclo (desempate necessário)
            needs_cycle_3 = (
                count_1 is not None and count_2 is not None and
                abs(count_1_adj - count_2_adj) >= 0.01 and     # Count1 ≠ Count2 (há divergência)
                abs(count_2_adj - expected_qty) >= 0.01        # Count2 ≠ Sistema (precisa desempate)
            )
            
            # ✅ LOG DETALHADO PARA DEBUG
            count2_matches_system = abs(count_2_adj - expected_qty) < 0.01
            if count2_matches_system and abs(count_1_adj - count_2_adj) >= 0.01:
                logger.info(f"✅ [{item.product_code}] Count2={count_2_adj} = Sistema={expected_qty} → ENCERRA sem 3º ciclo (Count2 está correto)")
            elif abs(count_2_adj - expected_qty) >= 0.01:
                logger.info(f"⚡ [{item.product_code}] Count2={count_2_adj} ≠ Sistema={expected_qty} → CONTINUA para 3º ciclo (desempate)")
            else:
                logger.info(f"🔍 [{item.product_code}] Count1={count_1_adj}, Count2={count_2_adj}, Sistema={expected_qty}, needs_cycle_3={needs_cycle_3}")
            if item.needs_recount_cycle_3 != needs_cycle_3:
                item.needs_recount_cycle_3 = needs_cycle_3
                logger.info(f"🔄 Item {item.product_code}: needs_recount_cycle_3 = {needs_cycle_3}")

        # Atualizar status se houve mudança
        if new_status and new_status != item.status:
            logger.info(f"📊 Item {item.product_code}: {item.status} → {new_status}")
            item.status = new_status
            item.updated_at = datetime.utcnow()
            updated_count += 1
    
    logger.info(f"✅ Status atualizado para {updated_count} produtos no ciclo {current_cycle}")
    return updated_count

def update_product_status_on_release(db: Session, inventory_id: str, current_cycle: int):
    """
    Atualiza o status dos produtos quando a lista é liberada para contagem:
    PENDING → AWAITING_COUNT, RECOUNT, ou FINAL_COUNT
    """
    
    logger.info(f"🔄 Liberando produtos para contagem - Inventário: {inventory_id}, Ciclo: {current_cycle}")
    
    from app.models.models import CountingStatus
    
    # Buscar itens que estão aguardando liberação
    items = db.query(InventoryItemModel).filter(
        InventoryItemModel.inventory_list_id == inventory_id,
        InventoryItemModel.status.in_([
            CountingStatus.PENDING,
            CountingStatus.PENDING  # Status inicial
        ])
    ).all()
    
    updated_count = 0
    
    for item in items:
        new_status = None
        
        if current_cycle == 1:
            # 1º ciclo: PENDING
            new_status = CountingStatus.PENDING  # ✅ CORREÇÃO
        elif current_cycle == 2:
            # 2º ciclo: PENDING
            new_status = CountingStatus.PENDING  # ✅ CORREÇÃO
        elif current_cycle >= 3:
            # 3º ciclo: PENDING
            new_status = CountingStatus.PENDING  # ✅ CORREÇÃO
        
        if new_status and new_status != item.status:
            logger.info(f"📊 Liberando {item.product_code}: {item.status} → {new_status}")
            item.status = new_status
            item.updated_at = datetime.utcnow()
            updated_count += 1
    
    logger.info(f"✅ {updated_count} produtos liberados para contagem no ciclo {current_cycle}")
    return updated_count


@router.put("/counting-list/{list_id}/reassign-counter")
async def reassign_counting_list_counter(
    list_id: str,
    current_user_id: str = Query(..., description="ID do usuário atual responsável"),
    new_user_id: str = Query(..., description="ID do novo usuário responsável"),
    db: Session = Depends(get_db)
):
    """
    ✅ ENDPOINT ESPECÍFICO: Reatribui contador de uma LISTA específica

    Este endpoint verifica o status da LISTA específica, não do inventário geral.
    Resolve o problema de dessincronização entre status de inventário vs lista.

    Args:
        list_id: ID da lista de contagem específica
        current_user_id: ID do usuário atualmente responsável
        new_user_id: ID do novo usuário que assumirá a contagem

    Returns:
        Relatório da reatribuição realizada
    """

    try:
        # ✅ CORREÇÃO: Buscar LISTA específica em vez de inventário geral
        counting_list = db.query(CountingListModel).filter(
            CountingListModel.id == list_id
        ).first()

        if not counting_list:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lista de contagem não encontrada"
            )

        # ✅ CORREÇÃO: Verificar status da LISTA específica
        list_status = counting_list.list_status
        current_cycle = counting_list.current_cycle

        print(f"🎯 [REATRIBUIR LISTA] Status da lista: {list_status}, Ciclo: {current_cycle}")

        # ✅ PERMITIR: Status ABERTA ou EM_CONTAGEM em ciclos 2+
        if list_status not in ['ABERTA', 'EM_CONTAGEM']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Reatribuição não permitida com status '{list_status}'. Permitido: ABERTA ou EM_CONTAGEM."
            )

        # ✅ PERMITIR: EM_CONTAGEM apenas em ciclos 2+
        if list_status == 'EM_CONTAGEM' and current_cycle < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Reatribuição durante EM_CONTAGEM só é permitida em ciclos 2+. Ciclo atual: {current_cycle}"
            )

        # Buscar usuários
        current_user = db.query(UserModel).filter(UserModel.id == current_user_id).first()
        new_user = db.query(UserModel).filter(UserModel.id == new_user_id).first()

        if not current_user:
            raise HTTPException(status_code=404, detail="Usuário atual não encontrado")

        if not new_user:
            raise HTTPException(status_code=404, detail="Novo usuário não encontrado")

        # Verificar loja
        if current_user.store_id != new_user.store_id:
            raise HTTPException(status_code=400, detail="Usuários devem ser da mesma loja")

        # ✅ REATRIBUIR: Atualizar contador do ciclo atual na lista
        cycle_counter_map = {
            1: 'counter_cycle_1',
            2: 'counter_cycle_2',
            3: 'counter_cycle_3'
        }

        if current_cycle in cycle_counter_map:
            counter_field = cycle_counter_map[current_cycle]
            current_counter = getattr(counting_list, counter_field)

            # ✅ PERMITIR: ADMIN/SUPERVISOR podem reatribuir qualquer ciclo
            if str(current_counter) != str(current_user_id):
                # Verificar se é ADMIN ou SUPERVISOR (podem reatribuir independente do ciclo)
                if current_user.role not in ['ADMIN', 'SUPERVISOR']:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Apenas usuários ADMIN/SUPERVISOR podem reatribuir ciclos de outros usuários"
                    )
                print(f"🎯 [REATRIBUIR LISTA] ADMIN/SUPERVISOR {current_user.username} reatribuindo ciclo {current_cycle}")
            else:
                print(f"🎯 [REATRIBUIR LISTA] Usuário {current_user.username} reatribuindo seu próprio ciclo {current_cycle}")

            # Atualizar contador
            setattr(counting_list, counter_field, new_user_id)
            counting_list.updated_at = datetime.utcnow()

            print(f"✅ [REATRIBUIR LISTA] {counter_field}: {current_user.username} → {new_user.username}")

        db.commit()

        return {
            "success": True,
            "message": f"Lista '{counting_list.list_name}' reatribuída com sucesso",
            "data": {
                "list_id": list_id,
                "list_name": counting_list.list_name,
                "current_cycle": current_cycle,
                "list_status": list_status,
                "previous_counter": current_user.username,
                "new_counter": new_user.username,
                "reassigned_at": datetime.utcnow().isoformat()
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ [REATRIBUIR LISTA] Erro: {str(e)}")
        raise HTTPException(status_code=500, detail=safe_error_response(e, "interno"))