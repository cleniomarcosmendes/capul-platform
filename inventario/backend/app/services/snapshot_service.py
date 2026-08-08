"""
Serviço de Snapshot de Inventário v2.10.0
Congela dados de produtos (SB1, SB2, SB8, SBZ) no momento da inclusão no inventário
Garante imutabilidade e consistência dos dados ao longo do processo de contagem
"""

from datetime import date
from typing import Optional, Dict, List
from sqlalchemy.orm import Session
from sqlalchemy import text
from uuid import UUID
import logging

from app.models.models import InventoryItemSnapshot, InventoryLotSnapshot

logger = logging.getLogger(__name__)


class SnapshotService:
    """Serviço para operações de snapshot de dados de inventário"""

    @staticmethod
    def get_product_snapshot_data(
        db: Session,
        product_code: str,
        filial: str,
        warehouse: str
    ) -> Optional[Dict]:
        """
        Busca dados congelados de um produto das tabelas SB1, SB2 e SBZ

        Args:
            db: Sessão do banco de dados
            product_code: Código do produto (B2_COD)
            filial: Código da filial (B2_FILIAL)
            warehouse: Código do armazém (B2_LOCAL)

        Returns:
            Dict com dados do snapshot ou None se produto não encontrado

        Estrutura do retorno:
            {
                # SB2: Dados de Estoque
                'b2_filial': str,
                'b2_cod': str,
                'b2_local': str,
                'b2_qatu': Decimal,  # Quantidade atual
                'b2_cm1': Decimal,   # Custo médio

                # SB1: Dados do Produto
                'b1_desc': str,
                'b1_rastro': str,    # L=Lote, S=Série, N=Não rastreia
                'b1_grupo': str,
                'b1_xcatgor': str,
                'b1_xsubcat': str,
                'b1_xsegmen': str,
                'b1_xgrinve': str,

                # SBZ: Localizações
                'bz_xlocal1': str,
                'bz_xlocal2': str,
                'bz_xlocal3': str
            }
        """

        logger.info(f"📸 Buscando snapshot para produto {product_code} (filial={filial}, armazém={warehouse})")

        # Query unificada com JOINs das 3 tabelas
        query = text("""
            SELECT
                -- SB2: Dados de Estoque por Armazém
                b2.b2_filial,
                b2.b2_cod,
                b2.b2_local,
                COALESCE(b2.b2_qatu, 0) as b2_qatu,
                COALESCE(b2.b2_cm1, 0) as b2_cm1,
                COALESCE(b2.b2_xentpos, 0) as b2_xentpos,

                -- SB1: Dados do Cadastro de Produtos
                b1.b1_desc,
                COALESCE(b1.b1_rastro, 'N') as b1_rastro,
                b1.b1_grupo,
                b1.b1_xcatgor,
                b1.b1_xsubcat,
                b1.b1_xsegmen,
                b1.b1_xgrinve,

                -- SBZ: Dados de Indicadores (Localizações)
                bz.bz_xlocal1,
                bz.bz_xlocal2,
                bz.bz_xlocal3

            FROM inventario.sb2010 b2
            INNER JOIN inventario.sb1010 b1 ON b1.b1_cod = b2.b2_cod
            LEFT JOIN inventario.sbz010 bz ON (
                bz.bz_cod = b2.b2_cod
                AND bz.bz_filial = b2.b2_filial
            )
            WHERE b2.b2_cod = :product_code
              AND b2.b2_filial = :filial
              AND b2.b2_local = :warehouse
            LIMIT 1
        """)

        result = db.execute(query, {
            'product_code': product_code,
            'filial': filial,
            'warehouse': warehouse
        }).fetchone()

        if not result:
            logger.warning(f"⚠️ Produto {product_code} não encontrado em SB2010 (filial={filial}, armazém={warehouse})")
            return None

        # Converter para dict
        snapshot_data = {
            # SB2
            'b2_filial': result.b2_filial,
            'b2_cod': result.b2_cod,
            'b2_local': result.b2_local,
            'b2_qatu': float(result.b2_qatu),
            'b2_cm1': float(result.b2_cm1),
            'b2_xentpos': float(result.b2_xentpos),  # ✅ v2.17.0

            # SB1
            'b1_desc': result.b1_desc,
            'b1_rastro': result.b1_rastro,
            'b1_grupo': result.b1_grupo,
            'b1_xcatgor': result.b1_xcatgor,
            'b1_xsubcat': result.b1_xsubcat,
            'b1_xsegmen': result.b1_xsegmen,
            'b1_xgrinve': result.b1_xgrinve,

            # SBZ
            'bz_xlocal1': result.bz_xlocal1,
            'bz_xlocal2': result.bz_xlocal2,
            'bz_xlocal3': result.bz_xlocal3
        }

        # ✅ v2.19.55 - Sempre usar B2_QATU como saldo de referência (saldo oficial do ERP Protheus)
        # Para produtos com lote, SUM(B8_SALDO) pode divergir de B2_QATU por ajustes pendentes no ERP
        # Os snapshots de lotes individuais continuam sendo criados para detalhe na contagem
        if result.b1_rastro == 'L':
            logger.info(f"📦 Produto {product_code} com lote: usando B2_QATU={snapshot_data['b2_qatu']} (saldo oficial ERP)")

        logger.info(f"✅ Snapshot capturado: {product_code} | Qty: {snapshot_data['b2_qatu']} | Custo: {snapshot_data['b2_cm1']}")

        return snapshot_data

    @staticmethod
    def get_product_lots_snapshot(
        db: Session,
        product_code: str,
        filial: str,
        warehouse: str,
        reference_date: Optional[date] = None,
    ) -> List[Dict]:
        """
        Busca lotes congelados de um produto da tabela SB8
        Apenas para produtos com controle de lote (b1_rastro='L')

        Args:
            db: Sessão do banco de dados
            product_code: Código do produto (B8_PRODUTO)
            filial: Código da filial (B8_FILIAL)
            warehouse: Código do armazém (B8_LOCAL)

        Returns:
            Lista de dicts com dados dos lotes

        Estrutura de cada item:
            {
                'b8_lotectl': str,     # Número do lote
                'b8_saldo': Decimal,   # Saldo do lote
                'b8_lotefor': str,     # Lote do fornecedor
                'b8_dtvalid': str      # Validade YYYYMMDD (migration 021)
            }

        ⚠️ DOIS FILTROS, e eles têm naturezas diferentes:

        `b8_saldo > 0` — o que o sistema ESPERA encontrar. Não é a lista do que
        pode ser contado: lote com saldo zero pode ter físico na prateleira,
        exatamente como produto com saldo zero, que o módulo já oferece para
        contagem. Quem cobre esse caso é o "informar outro lote" na tela, e não
        trazer os zerados aqui — são 86% dos lotes (20.509 de 23.940 nos
        armazéns 02 e 06, medido em 08/08) e afogariam o contador: 7,2 lotes por
        item em média e até 108, contra 1,0 e 10 filtrando.

        `b8_dtvalid >= data de referência` — REGRA DE NEGÓCIO (Clenio, 08/08):
        produto vencido não pode estar na gôndola, e oferecê-lo para contagem é
        o sistema aceitando que pode. Validade é gerenciada pelo Protheus, em
        relatório próprio. Custa pouco: 21 lotes vencidos em 23.940.

        A comparação é contra a DATA DE REFERÊNCIA do inventário, não contra
        hoje: é o recorte que manda, e um inventário longo não pode ir perdendo
        lote conforme os dias passam.
        """

        logger.info(
            f"📦 Buscando lotes para produto {product_code} "
            f"(filial={filial}, armazém={warehouse}, referência={reference_date or 'hoje'})"
        )

        # `b8_dtvalid` é varchar YYYYMMDD (formato do Protheus) — comparação
        # lexicográfica ordena igual à cronológica, sem conversão.
        corte = (reference_date or date.today()).strftime('%Y%m%d')

        query = text("""
            SELECT
                b8.b8_lotectl,
                COALESCE(b8.b8_saldo, 0) as b8_saldo,
                COALESCE(b8.b8_lotefor, '') as b8_lotefor,
                COALESCE(TRIM(b8.b8_dtvalid), '') as b8_dtvalid
            FROM inventario.sb8010 b8
            WHERE b8.b8_produto = :product_code
              AND b8.b8_filial = :filial
              AND b8.b8_local = :warehouse
              AND b8.b8_saldo > 0
              -- Lote sem data cadastrada NÃO é tratado como vencido: a ausência
              -- é falha de cadastro, e sumir com o lote esconderia estoque real.
              AND (COALESCE(TRIM(b8.b8_dtvalid), '') = '' OR TRIM(b8.b8_dtvalid) >= :corte)
            ORDER BY b8.b8_lotectl
        """)

        results = db.execute(query, {
            'product_code': product_code,
            'filial': filial,
            'warehouse': warehouse,
            'corte': corte,
        }).fetchall()

        lots = []
        for row in results:
            lots.append({
                'b8_lotectl': row.b8_lotectl,
                'b8_saldo': float(row.b8_saldo),
                'b8_lotefor': row.b8_lotefor,
                'b8_dtvalid': row.b8_dtvalid or None,
            })

        logger.info(f"✅ {len(lots)} lote(s) válido(s) para produto {product_code}")

        return lots

    @staticmethod
    def create_item_snapshot(
        db: Session,
        inventory_item_id: UUID,
        product_code: str,
        filial: str,
        warehouse: str,
        created_by: UUID
    ) -> Optional[InventoryItemSnapshot]:
        """
        Cria snapshot de dados do produto (SB1+SB2+SBZ) no momento da inclusão

        Args:
            db: Sessão do banco de dados
            inventory_item_id: UUID do item de inventário
            product_code: Código do produto
            filial: Código da filial
            warehouse: Código do armazém
            created_by: UUID do usuário que está criando

        Returns:
            InventoryItemSnapshot criado ou None se dados não encontrados
        """

        # Buscar dados do produto
        snapshot_data = SnapshotService.get_product_snapshot_data(
            db=db,
            product_code=product_code,
            filial=filial,
            warehouse=warehouse
        )

        if not snapshot_data:
            logger.error(f"❌ Não foi possível criar snapshot para produto {product_code}")
            return None

        # Criar registro de snapshot
        snapshot = InventoryItemSnapshot(
            inventory_item_id=inventory_item_id,
            created_by=created_by,
            # SB2
            b2_filial=snapshot_data['b2_filial'],
            b2_cod=snapshot_data['b2_cod'],
            b2_local=snapshot_data['b2_local'],
            b2_qatu=snapshot_data['b2_qatu'],
            b2_cm1=snapshot_data['b2_cm1'],
            b2_xentpos=snapshot_data['b2_xentpos'],  # ✅ v2.17.0
            # SB1
            b1_desc=snapshot_data['b1_desc'],
            b1_rastro=snapshot_data['b1_rastro'],
            b1_grupo=snapshot_data['b1_grupo'],
            b1_xcatgor=snapshot_data['b1_xcatgor'],
            b1_xsubcat=snapshot_data['b1_xsubcat'],
            b1_xsegmen=snapshot_data['b1_xsegmen'],
            b1_xgrinve=snapshot_data['b1_xgrinve'],
            # SBZ
            bz_xlocal1=snapshot_data['bz_xlocal1'],
            bz_xlocal2=snapshot_data['bz_xlocal2'],
            bz_xlocal3=snapshot_data['bz_xlocal3']
        )

        db.add(snapshot)

        logger.info(f"✅ Snapshot criado para inventory_item_id={inventory_item_id}")

        return snapshot

    @staticmethod
    def create_lots_snapshots(
        db: Session,
        inventory_item_id: UUID,
        product_code: str,
        filial: str,
        warehouse: str,
        created_by: UUID,
        reference_date: Optional[date] = None,
    ) -> List[InventoryLotSnapshot]:
        """
        Cria snapshots de múltiplos lotes (SB8) para produtos rastreados

        Args:
            db: Sessão do banco de dados
            inventory_item_id: UUID do item de inventário
            product_code: Código do produto
            filial: Código da filial
            warehouse: Código do armazém
            created_by: UUID do usuário que está criando

        Returns:
            Lista de InventoryLotSnapshot criados
        """

        # Buscar lotes do produto
        lots_data = SnapshotService.get_product_lots_snapshot(
            db=db,
            product_code=product_code,
            filial=filial,
            warehouse=warehouse,
            reference_date=reference_date,
        )

        if not lots_data:
            logger.info(f"ℹ️ Produto {product_code} não possui lotes ou não tem rastreamento")
            return []

        # Criar registros de snapshot de lotes
        lot_snapshots = []
        for lot_data in lots_data:
            lot_snapshot = InventoryLotSnapshot(
                inventory_item_id=inventory_item_id,
                created_by=created_by,
                b8_lotectl=lot_data['b8_lotectl'],
                b8_saldo=lot_data['b8_saldo'],
                b8_lotefor=lot_data.get('b8_lotefor', ''),
                # Migration 021 — congelada junto: é o recorte que decide o que
                # estava válido, não a data de hoje.
                b8_dtvalid=lot_data.get('b8_dtvalid')
            )
            db.add(lot_snapshot)
            lot_snapshots.append(lot_snapshot)

        logger.info(f"✅ {len(lot_snapshots)} snapshot(s) de lotes criados para inventory_item_id={inventory_item_id}")

        return lot_snapshots
