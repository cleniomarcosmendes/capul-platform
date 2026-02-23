"""
Serviço para criação automática de listas de contagem
"""

from sqlalchemy.orm import Session
from datetime import datetime
import uuid
import logging

logger = logging.getLogger(__name__)


async def create_default_counting_lists(db: Session, inventory_id: str, created_by_user_id: str, store_id: str):
    """
    Cria listas de contagem automáticas para um inventário
    Busca usuários operadores da loja e cria uma lista para cada um
    """
    try:
        from app.models.models import User, CountingList

        # Buscar usuários operadores da mesma loja
        operators = db.query(User).filter(
            User.store_id == store_id,
            User.role.in_(['OPERATOR', 'SUPERVISOR']),
            User.is_active == True
        ).limit(5).all()  # Máximo 5 listas por inventário

        logger.info(f"🔍 Encontrados {len(operators)} operadores para criar listas automáticas")

        if not operators:
            logger.warning("⚠️ Nenhum operador encontrado na loja. Criando lista padrão.")
            # Se não há operadores, criar uma lista padrão
            operators = [type('obj', (object,), {
                'id': created_by_user_id,
                'username': 'admin',
                'full_name': 'Lista Principal'
            })]

        # Criar uma lista para cada operador
        for i, operator in enumerate(operators):
            list_name = f"Lista {operator.full_name or operator.username}"
            description = f"Lista de contagem do(a) {operator.full_name or operator.username}"

            # Se houver múltiplos operadores, dividir por setor/área
            if len(operators) > 1:
                sectors = ['Setor A', 'Setor B', 'Setor C', 'Setor D', 'Setor E']
                list_name += f" - {sectors[i]}"
                description += f" - {sectors[i]}"

            new_counting_list = CountingList(
                id=str(uuid.uuid4()),
                inventory_id=inventory_id,
                list_name=list_name,
                description=description,
                current_cycle=1,
                list_status='PREPARACAO',
                counter_cycle_1=str(operator.id),
                created_by=created_by_user_id,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )

            db.add(new_counting_list)
            logger.info(f"✅ Lista criada: {list_name} para operador {operator.username}")

        # Marcar inventário como usando múltiplas listas
        from app.models.models import InventoryList
        inventory = db.query(InventoryList).filter(InventoryList.id == inventory_id).first()
        if inventory:
            inventory.use_multiple_lists = True
            inventory.total_lists = len(operators)

        db.commit()
        logger.info(f"✅ {len(operators)} listas de contagem criadas automaticamente para inventário {inventory_id}")

        # 🔄 DISTRIBUIR PRODUTOS AUTOMATICAMENTE ENTRE AS LISTAS
        logger.info(f"🔄 Iniciando distribuição automática de produtos para inventário {inventory_id}")
        try:
            await distribute_products_to_counting_lists(db, inventory_id)
            logger.info(f"✅ Distribuição automática concluída para inventário {inventory_id}")
        except Exception as dist_error:
            logger.error(f"❌ Erro na distribuição automática: {dist_error}")
            import traceback
            logger.error(f"❌ Stacktrace distribuição: {traceback.format_exc()}")
            # Continua sem falhar a criação das listas

    except Exception as e:
        logger.error(f"❌ Erro ao criar listas automáticas: {e}")
        db.rollback()


async def distribute_products_to_counting_lists(db: Session, inventory_id: str, force_redistribution: bool = False):
    """
    Distribui automaticamente os produtos do inventário entre as listas de contagem

    Args:
        db: Sessão do banco
        inventory_id: ID do inventário
        force_redistribution: Se True, limpa distribuição existente e redistribui
    """
    try:
        from app.models.models import InventoryItem, CountingList, CountingListItem

        # Buscar produtos do inventário
        products = db.query(InventoryItem).filter(
            InventoryItem.inventory_list_id == inventory_id
        ).all()

        if not products:
            logger.warning(f"⚠️ Nenhum produto encontrado no inventário {inventory_id}")
            return {"success": False, "message": "Nenhum produto encontrado no inventário"}

        # Buscar listas de contagem
        counting_lists = db.query(CountingList).filter(
            CountingList.inventory_id == inventory_id
        ).all()

        if not counting_lists:
            logger.warning(f"⚠️ Nenhuma lista de contagem encontrada para inventário {inventory_id}")
            return {"success": False, "message": "Nenhuma lista de contagem encontrada"}

        # Se forçar redistribuição, limpar distribuição existente
        if force_redistribution:
            logger.info(f"🧹 Limpando distribuição existente para inventário {inventory_id}")
            deleted = db.query(CountingListItem).filter(
                CountingListItem.counting_list_id.in_([cl.id for cl in counting_lists])
            ).delete(synchronize_session=False)
            logger.info(f"🗑️ {deleted} itens removidos")

        # Verificar se já existe distribuição
        existing_items = db.query(CountingListItem).filter(
            CountingListItem.counting_list_id.in_([cl.id for cl in counting_lists])
        ).count()

        if existing_items > 0 and not force_redistribution:
            logger.info(f"⚠️ Já existem {existing_items} produtos distribuídos. Use force_redistribution=True para redistribuir")
            return {"success": False, "message": f"Já existem {existing_items} produtos distribuídos"}

        logger.info(f"🔄 Distribuindo {len(products)} produtos entre {len(counting_lists)} listas")

        # Distribuir produtos de forma equilibrada
        products_per_list = len(products) // len(counting_lists)
        remaining_products = len(products) % len(counting_lists)

        product_index = 0
        distribution_summary = []

        for list_index, counting_list in enumerate(counting_lists):
            # Calcular quantos produtos esta lista deve receber
            products_for_this_list = products_per_list
            if list_index < remaining_products:
                products_for_this_list += 1

            logger.info(f"📦 Lista {counting_list.list_name}: {products_for_this_list} produtos")
            list_products = []

            # Atribuir produtos a esta lista
            for i in range(products_for_this_list):
                if product_index < len(products):
                    product = products[product_index]

                    # Verificar se este item já existe (evitar duplicatas)
                    existing = db.query(CountingListItem).filter(
                        CountingListItem.counting_list_id == counting_list.id,
                        CountingListItem.inventory_item_id == product.id
                    ).first()

                    if not existing:
                        counting_list_item = CountingListItem(
                            id=str(uuid.uuid4()),
                            counting_list_id=counting_list.id,
                            inventory_item_id=product.id,
                            needs_count_cycle_1=True,
                            created_at=datetime.now(),
                            updated_at=datetime.now()
                        )
                        db.add(counting_list_item)
                        list_products.append(product.product_code)

                    product_index += 1

            distribution_summary.append({
                "list_name": counting_list.list_name,
                "products_count": products_for_this_list,
                "products": list_products
            })

        db.commit()
        logger.info(f"✅ Produtos distribuídos com sucesso entre as listas de contagem")

        return {
            "success": True,
            "message": f"Produtos distribuídos com sucesso entre {len(counting_lists)} listas",
            "distribution": distribution_summary
        }

    except Exception as e:
        logger.error(f"❌ Erro ao distribuir produtos: {e}")
        db.rollback()
        return {"success": False, "message": f"Erro ao distribuir produtos: {str(e)}"}