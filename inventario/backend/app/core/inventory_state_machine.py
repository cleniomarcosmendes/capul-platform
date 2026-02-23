"""
Máquina de Estados Centralizada para Sistema de Inventário
=========================================================

Este módulo implementa uma máquina de estados robusta que define
claramente todos os estados possíveis de uma lista de inventário
e as transições válidas entre eles.

Estados do Sistema:
------------------
1. DRAFT - Lista criada, sem atribuições
2. PENDING_ASSIGNMENT - Lista com produtos, aguardando atribuição de usuários  
3. ASSIGNED - Lista com atribuições criadas, pronta para liberação
4. RELEASED_CYCLE_1 - Lista liberada para 1ª contagem
5. COUNTING_CYCLE_1 - Contagem do 1º ciclo em andamento
6. PENDING_CLOSURE_1 - 1º ciclo contado, aguardando encerramento
7. RELEASED_CYCLE_2 - Lista liberada para 2ª contagem (apenas divergências)
8. COUNTING_CYCLE_2 - Contagem do 2º ciclo em andamento  
9. PENDING_CLOSURE_2 - 2º ciclo contado, aguardando encerramento
10. RELEASED_CYCLE_3 - Lista liberada para 3ª contagem (contagem final)
11. COUNTING_CYCLE_3 - Contagem do 3º ciclo em andamento
12. PENDING_CLOSURE_3 - 3º ciclo contado, aguardando encerramento
13. COMPLETED - Inventário completamente finalizado

Transições Válidas:
------------------
DRAFT → PENDING_ASSIGNMENT (adicionar produtos)
PENDING_ASSIGNMENT → ASSIGNED (criar atribuições)
ASSIGNED → RELEASED_CYCLE_1 (liberar para 1ª contagem)
RELEASED_CYCLE_1 → COUNTING_CYCLE_1 (usuário inicia contagem)
COUNTING_CYCLE_1 → PENDING_CLOSURE_1 (contagem finalizada)
PENDING_CLOSURE_1 → RELEASED_CYCLE_2 (encerrar 1º ciclo, iniciar 2º)
PENDING_CLOSURE_1 → COMPLETED (sem divergências, finalizar)
... e assim por diante

"""

from enum import Enum
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, case
import logging

logger = logging.getLogger(__name__)

class InventoryState(Enum):
    """Estados possíveis de uma lista de inventário"""
    DRAFT = "DRAFT"
    PENDING_ASSIGNMENT = "PENDING_ASSIGNMENT"  
    ASSIGNED = "ASSIGNED"
    RELEASED_CYCLE_1 = "RELEASED_CYCLE_1"
    COUNTING_CYCLE_1 = "COUNTING_CYCLE_1"
    PENDING_CLOSURE_1 = "PENDING_CLOSURE_1"
    RELEASED_CYCLE_2 = "RELEASED_CYCLE_2"
    COUNTING_CYCLE_2 = "COUNTING_CYCLE_2"
    PENDING_CLOSURE_2 = "PENDING_CLOSURE_2"
    RELEASED_CYCLE_3 = "RELEASED_CYCLE_3"
    COUNTING_CYCLE_3 = "COUNTING_CYCLE_3"
    PENDING_CLOSURE_3 = "PENDING_CLOSURE_3"
    COMPLETED = "COMPLETED"

class InventoryAction(Enum):
    """Ações possíveis no sistema"""
    ADD_PRODUCTS = "ADD_PRODUCTS"
    ASSIGN_USERS = "ASSIGN_USERS"
    RELEASE_FOR_COUNTING = "RELEASE_FOR_COUNTING"
    START_COUNTING = "START_COUNTING"
    CLOSE_ROUND = "CLOSE_ROUND"
    FINALIZE_INVENTORY = "FINALIZE_INVENTORY"
    REASSIGN_USERS = "REASSIGN_USERS"

class InventoryStateMachine:
    """
    Máquina de Estados Central para Inventário
    
    Esta classe é responsável por:
    1. Determinar o estado atual de uma lista
    2. Validar transições entre estados
    3. Determinar ações disponíveis para cada estado
    4. Garantir consistência do sistema
    """
    
    # Transições válidas: estado_origem → [estados_destino_possíveis]
    VALID_TRANSITIONS = {
        InventoryState.DRAFT: [InventoryState.PENDING_ASSIGNMENT],
        InventoryState.PENDING_ASSIGNMENT: [InventoryState.ASSIGNED],
        InventoryState.ASSIGNED: [InventoryState.RELEASED_CYCLE_1],
        InventoryState.RELEASED_CYCLE_1: [InventoryState.COUNTING_CYCLE_1],
        InventoryState.COUNTING_CYCLE_1: [InventoryState.PENDING_CLOSURE_1],
        InventoryState.PENDING_CLOSURE_1: [InventoryState.RELEASED_CYCLE_2, InventoryState.COMPLETED],
        InventoryState.RELEASED_CYCLE_2: [InventoryState.COUNTING_CYCLE_2],
        InventoryState.COUNTING_CYCLE_2: [InventoryState.PENDING_CLOSURE_2],
        InventoryState.PENDING_CLOSURE_2: [InventoryState.RELEASED_CYCLE_3, InventoryState.COMPLETED],
        InventoryState.RELEASED_CYCLE_3: [InventoryState.COUNTING_CYCLE_3],
        InventoryState.COUNTING_CYCLE_3: [InventoryState.PENDING_CLOSURE_3],
        InventoryState.PENDING_CLOSURE_3: [InventoryState.COMPLETED],
        InventoryState.COMPLETED: []  # Estado final
    }
    
    # Ações disponíveis para cada estado
    AVAILABLE_ACTIONS = {
        InventoryState.DRAFT: [InventoryAction.ADD_PRODUCTS],
        InventoryState.PENDING_ASSIGNMENT: [InventoryAction.ASSIGN_USERS, InventoryAction.ADD_PRODUCTS],
        InventoryState.ASSIGNED: [InventoryAction.RELEASE_FOR_COUNTING, InventoryAction.REASSIGN_USERS],
        InventoryState.RELEASED_CYCLE_1: [InventoryAction.START_COUNTING],
        InventoryState.COUNTING_CYCLE_1: [],  # Usuário está contando
        InventoryState.PENDING_CLOSURE_1: [InventoryAction.CLOSE_ROUND, InventoryAction.FINALIZE_INVENTORY],
        InventoryState.RELEASED_CYCLE_2: [InventoryAction.START_COUNTING],
        InventoryState.COUNTING_CYCLE_2: [],
        InventoryState.PENDING_CLOSURE_2: [InventoryAction.CLOSE_ROUND, InventoryAction.FINALIZE_INVENTORY],
        InventoryState.RELEASED_CYCLE_3: [InventoryAction.START_COUNTING],
        InventoryState.COUNTING_CYCLE_3: [],
        InventoryState.PENDING_CLOSURE_3: [InventoryAction.FINALIZE_INVENTORY],
        InventoryState.COMPLETED: []
    }

    def __init__(self, db: Session):
        self.db = db
    
    def get_current_state(self, inventory_id: str) -> Tuple[InventoryState, Dict]:
        """
        Determina o estado atual de uma lista baseado nos dados do banco
        
        Returns:
            Tuple[InventoryState, Dict]: Estado atual e dados contextuais
        """
        from app.models.models import (
            InventoryList as InventoryListModel,
            InventoryItem as InventoryItemModel, 
            CountingAssignment as CountingAssignmentModel,
            Counting as CountingModel
        )
        
        # Buscar lista
        inventory = self.db.query(InventoryListModel).filter(
            InventoryListModel.id == inventory_id
        ).first()
        
        if not inventory:
            raise ValueError(f"Inventory {inventory_id} not found")
        
        # Buscar estatísticas dos itens
        items_stats = self.db.query(
            func.count(InventoryItemModel.id).label('total_items')
        ).filter(
            InventoryItemModel.inventory_list_id == inventory_id
        ).first()
        
        # Buscar estatísticas das atribuições
        assignments_stats = self.db.query(
            func.count(CountingAssignmentModel.id).label('total_assignments'),
            func.count(case((CountingAssignmentModel.status == 'PENDING', 1))).label('pending_assignments'),
            func.count(case((CountingAssignmentModel.status == 'RELEASED', 1))).label('released_assignments'),
            func.count(case((CountingAssignmentModel.status == 'COMPLETED', 1))).label('completed_assignments')
        ).join(
            InventoryItemModel, CountingAssignmentModel.inventory_item_id == InventoryItemModel.id
        ).filter(
            InventoryItemModel.inventory_list_id == inventory_id
        ).first()
        
        # Buscar estatísticas das contagens
        counting_stats = self.db.query(
            func.count(CountingModel.id).label('total_counts'),
            func.count(func.distinct(CountingModel.inventory_item_id)).label('items_counted')
        ).join(
            InventoryItemModel, CountingModel.inventory_item_id == InventoryItemModel.id  
        ).filter(
            InventoryItemModel.inventory_list_id == inventory_id
        ).first()
        
        # Dados contextuais
        context = {
            'inventory_id': inventory_id,
            'cycle_number': inventory.cycle_number,
            'list_status': inventory.list_status,
            'total_items': items_stats.total_items or 0,
            'total_assignments': assignments_stats.total_assignments or 0,
            'pending_assignments': assignments_stats.pending_assignments or 0,
            'released_assignments': assignments_stats.released_assignments or 0,
            'completed_assignments': assignments_stats.completed_assignments or 0,
            'total_counts': counting_stats.total_counts or 0,
            'items_counted': counting_stats.items_counted or 0
        }
        
        # Lógica para determinar estado atual
        state = self._analyze_state(context)
        
        logger.info(f"Estado determinado para {inventory_id}: {state.value} - Contexto: {context}")
        
        return state, context
    
    def _analyze_state(self, context: Dict) -> InventoryState:
        """Analisa contexto e determina estado atual"""
        
        total_items = context['total_items']
        total_assignments = context['total_assignments']
        pending_assignments = context['pending_assignments']
        released_assignments = context['released_assignments']
        completed_assignments = context['completed_assignments']
        cycle_number = context['cycle_number']
        items_counted = context['items_counted']
        
        # 1. DRAFT - Sem itens
        if total_items == 0:
            return InventoryState.DRAFT
            
        # 2. PENDING_ASSIGNMENT - Com itens, sem atribuições
        if total_items > 0 and total_assignments == 0:
            return InventoryState.PENDING_ASSIGNMENT
            
        # 3. ASSIGNED - Com atribuições pendentes, nenhuma liberada
        if pending_assignments > 0 and released_assignments == 0:
            return InventoryState.ASSIGNED
            
        # Estados baseados no ciclo
        if cycle_number == 1:
            # 4. RELEASED_CYCLE_1 - Todas atribuições liberadas, não contadas
            if released_assignments > 0 and items_counted == 0:
                return InventoryState.RELEASED_CYCLE_1
                
            # 5. COUNTING_CYCLE_1 - Algumas contadas, não todas
            if released_assignments > 0 and 0 < items_counted < total_items:
                return InventoryState.COUNTING_CYCLE_1
                
            # 6. PENDING_CLOSURE_1 - Todas contadas no ciclo 1
            if released_assignments > 0 and items_counted >= total_items:
                return InventoryState.PENDING_CLOSURE_1
                
        elif cycle_number == 2:
            # Estados do ciclo 2 (similar ao ciclo 1)
            if released_assignments > 0 and items_counted == 0:
                return InventoryState.RELEASED_CYCLE_2
            elif released_assignments > 0 and 0 < items_counted < total_items:
                return InventoryState.COUNTING_CYCLE_2
            elif released_assignments > 0 and items_counted >= total_items:
                return InventoryState.PENDING_CLOSURE_2
                
        elif cycle_number == 3:
            # Estados do ciclo 3
            if released_assignments > 0 and items_counted == 0:
                return InventoryState.RELEASED_CYCLE_3
            elif released_assignments > 0 and 0 < items_counted < total_items:
                return InventoryState.COUNTING_CYCLE_3
            elif released_assignments > 0 and items_counted >= total_items:
                return InventoryState.PENDING_CLOSURE_3
                
        # Estado final
        if completed_assignments == total_assignments and cycle_number >= 3:
            return InventoryState.COMPLETED
            
        # Fallback para estado indeterminado
        logger.warning(f"Estado indeterminado para contexto: {context}")
        return InventoryState.DRAFT
    
    def can_transition(self, current_state: InventoryState, target_state: InventoryState) -> bool:
        """Verifica se uma transição é válida"""
        return target_state in self.VALID_TRANSITIONS.get(current_state, [])
    
    def get_available_actions(self, state: InventoryState) -> List[InventoryAction]:
        """Retorna ações disponíveis para um estado"""
        return self.AVAILABLE_ACTIONS.get(state, [])
    
    def get_ui_state(self, state: InventoryState, context: Dict) -> Dict:
        """
        Converte estado interno para dados de UI
        
        Returns:
            Dict com informações para o frontend:
            - status_text: Texto para exibir
            - status_color: Cor do badge
            - show_release_button: Se deve mostrar botão liberar
            - show_close_button: Se deve mostrar botão encerrar
            - available_actions: Lista de ações disponíveis
        """
        
        ui_mappings = {
            InventoryState.DRAFT: {
                'status_text': '📝 Em Preparação',
                'status_color': 'secondary',
                'show_release_button': False,
                'show_close_button': False
            },
            InventoryState.PENDING_ASSIGNMENT: {
                'status_text': '👥 Aguardando Atribuições',
                'status_color': 'warning',
                'show_release_button': False,
                'show_close_button': False
            },
            InventoryState.ASSIGNED: {
                'status_text': '🟡 Lista Pronta',
                'status_color': 'warning',
                'show_release_button': True,
                'show_close_button': False
            },
            InventoryState.RELEASED_CYCLE_1: {
                'status_text': '🔵 Lista Liberada - Iniciar Contagem',
                'status_color': 'primary',
                'show_release_button': False,
                'show_close_button': False
            },
            InventoryState.COUNTING_CYCLE_1: {
                'status_text': '🔵 1ª Contagem em Andamento',
                'status_color': 'primary',
                'show_release_button': False,
                'show_close_button': False
            },
            InventoryState.PENDING_CLOSURE_1: {
                'status_text': '🟠 1ª Contagem Finalizada',
                'status_color': 'warning',
                'show_release_button': False,
                'show_close_button': True
            },
            # ... outros estados
            InventoryState.COMPLETED: {
                'status_text': '🟢 Inventário Finalizado',
                'status_color': 'success',
                'show_release_button': False,
                'show_close_button': False
            }
        }
        
        ui_state = ui_mappings.get(state, {
            'status_text': '❓ Estado Desconhecido',
            'status_color': 'secondary',
            'show_release_button': False,
            'show_close_button': False
        })
        
        ui_state['available_actions'] = [action.value for action in self.get_available_actions(state)]
        ui_state['current_state'] = state.value
        ui_state['context'] = context
        
        return ui_state