"""
Serviço para operações de inventário
Integração com tabelas Protheus SB2010 e SB8010
"""

from typing import Optional, Dict, List
from sqlalchemy.orm import Session
from sqlalchemy import text
import logging

logger = logging.getLogger(__name__)

class InventoryService:
    """Serviço para operações relacionadas ao inventário"""
    
    @staticmethod
    def get_expected_quantity(
        db: Session,
        filial: str,
        product_code: str,
        warehouse_location: str,
        has_lot: bool = False
    ) -> Dict:
        """
        Busca quantidade esperada de um produto em um local específico
        
        Args:
            db: Sessão do banco de dados
            filial: Código da filial
            product_code: Código do produto
            warehouse_location: Local/Armazém
            has_lot: Se o produto tem controle de lote
            
        Returns:
            Dict com informações de quantidade esperada
        """
        
        if not has_lot:
            # Produtos SEM controle de lote - buscar em SB2010 com JOIN na tabela products
            # Considera registros da filial específica OU compartilhados (' ')
            query = text("""
                SELECT 
                    sb2.b2_qatu as quantity,
                    COALESCE(sb2.b2_reserva, 0) as reserved,
                    COALESCE(sb2.b2_qemp, 0) as committed,
                    (COALESCE(sb2.b2_qatu, 0) - COALESCE(sb2.b2_reserva, 0) - COALESCE(sb2.b2_qemp, 0)) as available,
                    p.name as product_name,
                    p.unit as product_unit
                FROM inventario.products p
                LEFT JOIN inventario.sb2010 sb2 ON (
                    TRIM(p.code) = TRIM(sb2.b2_cod) 
                    AND (sb2.b2_filial = :filial OR sb2.b2_filial = ' ')
                    AND sb2.b2_local = :warehouse_location
                )
                WHERE p.code = :product_code
            """)
            
            result = db.execute(query, {
                'filial': filial,
                'product_code': product_code,
                'warehouse_location': warehouse_location
            }).fetchone()
            
            if result:
                return {
                    'expected_quantity': float(result.quantity or 0),
                    'reserved_quantity': float(result.reserved or 0),
                    'committed_quantity': float(result.committed or 0),
                    'available_quantity': float(result.available or 0),
                    'has_lot': False
                }
            else:
                return {
                    'expected_quantity': 0.0,
                    'reserved_quantity': 0.0,
                    'committed_quantity': 0.0,
                    'available_quantity': 0.0,
                    'has_lot': False
                }
        
        else:
            # Produtos COM controle de lote - buscar em SB8010 com JOIN na tabela products
            # Considera registros da filial específica OU compartilhados (' ')
            query = text("""
                SELECT
                    sb8.b8_lotectl as lot_number,
                    sb8.b8_lotefor as lot_supplier,
                    sb8.b8_saldo as quantity,
                    sb8.b8_dtvalid as expiry_date
                FROM inventario.products p
                LEFT JOIN inventario.sb8010 sb8 ON (
                    p.code = sb8.b8_produto
                    AND (sb8.b8_filial = :filial OR sb8.b8_filial = ' ')
                    AND sb8.b8_local = :warehouse_location
                    AND sb8.b8_saldo > 0
                )
                WHERE p.code = :product_code
                  AND sb8.b8_saldo > 0
                ORDER BY sb8.b8_dtvalid
            """)
            
            results = db.execute(query, {
                'filial': filial,
                'product_code': product_code,
                'warehouse_location': warehouse_location
            }).fetchall()
            
            lots = []
            total_quantity = 0.0
            
            for row in results:
                lots.append({
                    'lot_number': row.lot_number,
                    'quantity': float(row.quantity or 0),
                    'expiry_date': row.expiry_date.isoformat() if row.expiry_date else None
                })
                total_quantity += float(row.quantity or 0)
            
            return {
                'expected_quantity': total_quantity,
                'has_lot': True,
                'lots': lots
            }
    
    @staticmethod
    def update_inventory_items_quantities(
        db: Session,
        inventory_list_id: str,
        filial: str,
        warehouse_location: str
    ) -> int:
        """
        Atualiza as quantidades esperadas de todos os itens de um inventário
        baseado no local do inventário
        
        Args:
            db: Sessão do banco de dados
            inventory_list_id: ID da lista de inventário
            filial: Código da filial
            warehouse_location: Local/Armazém do inventário
            
        Returns:
            Número de itens atualizados
        """
        
        # Query para atualizar produtos sem lote
        # Considera registros da filial específica OU compartilhados (' ')
        update_no_lot = text("""
            UPDATE inventario.inventory_items ii
            SET expected_quantity = COALESCE(sb2.b2_qatu, 0),
                updated_at = CURRENT_TIMESTAMP
            FROM inventario.products p
            LEFT JOIN inventario.sb2010 sb2 ON (
                (sb2.b2_filial = :filial OR sb2.b2_filial = ' ')
                AND sb2.b2_cod = p.code
                AND sb2.b2_local = :warehouse_location
            )
            WHERE ii.product_id = p.id
              AND ii.inventory_list_id = :inventory_list_id
              AND (p.b1_rastro IS NULL OR p.b1_rastro != 'L')
        """)
        
        # Query para atualizar produtos com lote
        # ✅ CORREÇÃO: Para produtos com lote, usar SB2010.b2_qatu (sintética) em vez de soma da SB8010
        # A SB8010 será usada apenas para contagem por lote, não para expected_quantity
        update_with_lot = text("""
            UPDATE inventario.inventory_items ii
            SET expected_quantity = COALESCE(sb2.b2_qatu, 0),
                updated_at = CURRENT_TIMESTAMP
            FROM inventario.products p
            LEFT JOIN inventario.sb2010 sb2 ON (
                (sb2.b2_filial = :filial OR sb2.b2_filial = ' ')
                AND sb2.b2_cod = p.code
                AND sb2.b2_local = :warehouse_location
            )
            WHERE ii.product_id = p.id
              AND ii.inventory_list_id = :inventory_list_id
              AND p.b1_rastro = 'L'
        """)
        
        # Executar atualizações
        params = {
            'inventory_list_id': inventory_list_id,
            'filial': filial,
            'warehouse_location': warehouse_location
        }
        
        result1 = db.execute(update_no_lot, params)
        result2 = db.execute(update_with_lot, params)
        
        total_updated = result1.rowcount + result2.rowcount
        
        logger.info(f"Atualizadas quantidades esperadas para {total_updated} itens do inventário {inventory_list_id}")
        
        return total_updated