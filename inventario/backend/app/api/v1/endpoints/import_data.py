"""
API endpoints para importação de dados
"""
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.models.models import SB1010, SBZ010, SB2010, SB8010, SLK010, DA1010, SBM010, SZD010, SZE010, SZF010
from app.core.exceptions import safe_error_response

router = APIRouter(prefix="/import", tags=["import"])

MAX_IMPORT_RECORDS = 50000

class ImportRecord(BaseModel):
    """Modelo para um registro de importação"""
    data: Dict[str, Any] = Field(..., description="Dados do registro")
    line_number: int = Field(..., description="Número da linha no arquivo")

class ImportRequest(BaseModel):
    """Modelo para requisição de importação"""
    table_name: str = Field(..., description="Nome da tabela (SB1010, SBZ010, etc.)")
    records: List[ImportRecord] = Field(..., description="Lista de registros para importar")
    update_existing: bool = Field(default=True, description="Se deve atualizar registros existentes")

class ImportResult(BaseModel):
    """Modelo para resultado da importação"""
    success_count: int = Field(..., description="Registros importados com sucesso")
    error_count: int = Field(..., description="Registros com erro")
    errors: List[Dict[str, Any]] = Field(default=[], description="Lista de erros")
    total_processed: int = Field(..., description="Total de registros processados")

@router.post("/bulk", response_model=ImportResult)
async def import_bulk_data(
    request: ImportRequest,
    db: Session = Depends(get_db)
):
    """
    Importa dados em lote para as tabelas do sistema
    """
    if len(request.records) > MAX_IMPORT_RECORDS:
        raise HTTPException(
            status_code=413,
            detail=f"Limite de registros excedido (maximo: {MAX_IMPORT_RECORDS})"
        )

    success_count = 0
    error_count = 0
    errors = []
    
    # Mapeamento de tabelas para modelos
    table_models = {
        'SB1010': SB1010,
        'SBZ010': SBZ010,
        'SB2010': SB2010,
        'SB8010': SB8010,
        'SLK010': SLK010,
        'DA1010': DA1010,
        'SBM010': SBM010,
        'SZD010': SZD010,
        'SZE010': SZE010,
        'SZF010': SZF010
    }
    
    if request.table_name not in table_models:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tabela '{request.table_name}' não suportada"
        )
    
    model_class = table_models[request.table_name]
    
    try:
        # Processar em lotes de 50 registros para melhor performance e estabilidade
        batch_size = 50
        total_records = len(request.records)
        
        for batch_start in range(0, total_records, batch_size):
            batch_end = min(batch_start + batch_size, total_records)
            batch_records = request.records[batch_start:batch_end]
            
            print(f"Processando lote {batch_start//batch_size + 1}: registros {batch_start+1} a {batch_end}")
            
            batch_success = 0
            
            for record in batch_records:
                try:
                    # Processar registro baseado na tabela
                    if request.table_name == 'SB1010':
                        db_record = process_sb1010_record(record.data, db, request.update_existing)
                    elif request.table_name == 'SBZ010':
                        db_record = process_sbz010_record(record.data, db)
                    elif request.table_name == 'SB2010':
                        db_record = process_sb2010_record(record.data, db)
                    elif request.table_name == 'SB8010':
                        db_record = process_sb8010_record(record.data, db)
                    elif request.table_name == 'SLK010':
                        db_record = process_slk010_record(record.data, db)
                    elif request.table_name == 'DA1010':
                        db_record = process_da1010_record(record.data, db)
                    elif request.table_name == 'SBM010':
                        db_record = process_sbm010_record(record.data, db)
                    elif request.table_name == 'SZD010':
                        db_record = process_szd010_record(record.data, db)
                    elif request.table_name == 'SZE010':
                        db_record = process_sze010_record(record.data, db)
                    elif request.table_name == 'SZF010':
                        db_record = process_szf010_record(record.data, db)
                    else:
                        raise ValueError(f"Processador não implementado para {request.table_name}")
                    
                    if db_record is None and request.table_name == 'SB1010':
                        # SB1010 foi processado via SQL UPSERT direto
                        batch_success += 1
                        success_count += 1
                    elif db_record:
                        # Usar merge para outras tabelas
                        merged_record = db.merge(db_record)
                        batch_success += 1
                        success_count += 1
                    else:
                        error_count += 1
                        errors.append({
                            "line": record.line_number,
                            "error": "Registro não processado"
                        })
                        
                except Exception as e:
                    error_count += 1
                    errors.append({
                        "line": record.line_number,
                        "error": str(e),
                        "data": record.data
                    })
            
            # Commit do lote atual
            if batch_success > 0:
                try:
                    db.commit()
                    print(f"Lote {batch_start//batch_size + 1} commitado: {batch_success} registros")
                except Exception as e:
                    print(f"Erro ao commitar lote {batch_start//batch_size + 1}: {e}")
                    db.rollback()
                    # Marcar todos os registros do lote como erro
                    for record in batch_records:
                        if record.line_number not in [err["line"] for err in errors]:
                            error_count += 1
                            success_count -= 1 if success_count > 0 else 0
                            errors.append({
                                "line": record.line_number,
                                "error": f"Erro de commit do lote: {str(e)}"
                            })
            
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "durante importação")
        )
    
    return ImportResult(
        success_count=success_count,
        error_count=error_count,
        errors=errors,
        total_processed=len(request.records)
    )

def process_sb1010_record(data: Dict[str, Any], db: Session, update_existing: bool = True) -> Optional[SB1010]:
    """Processa um registro da SB1010 com suporte a UPSERT usando SQL UPSERT"""
    try:
        # LIMPEZA RIGOROSA: remover aspas duplas e espaços de todos os campos
        cleaned_data = {}
        for key, value in data.items():
            if isinstance(value, str):
                # Remove aspas duplas e espaços extras
                cleaned_value = value.strip().strip('"').strip()
                cleaned_data[key] = cleaned_value
            else:
                cleaned_data[key] = value
        
        # Usar dados limpos
        data = cleaned_data
        
        # Garantir que b1_filial e b1_cod existem
        b1_filial = data.get('b1_filial', '')
        b1_cod = data.get('b1_cod', '')
        
        if not b1_cod:
            raise ValueError("b1_cod é obrigatório")
        
        # Garantir que b1_rastro existe com valor padrão 'N'
        if 'b1_rastro' not in data:
            data['b1_rastro'] = 'N'
        
        # Usar SQL ON CONFLICT para UPSERT nativo do PostgreSQL
        from sqlalchemy import text
        
        # Preparar campos e valores
        fields = list(data.keys())
        placeholders = [f":{field}" for field in fields]
        
        # Campos para UPDATE (excluir chaves primárias)
        update_fields = [f for f in fields if f not in ['b1_filial', 'b1_cod', 'created_at']]
        update_clause = ', '.join([f"{field} = EXCLUDED.{field}" for field in update_fields])
        
        # SQL UPSERT
        sql = f"""
            INSERT INTO inventario.sb1010 ({', '.join(fields)})
            VALUES ({', '.join(placeholders)})
            ON CONFLICT (b1_filial, b1_cod) 
            DO UPDATE SET {update_clause}
        """
        
        # Executar UPSERT
        db.execute(text(sql), data)
        
        # Retornar None para indicar que foi processado via SQL direto
        return None
            
    except Exception as e:
        raise ValueError(f"Erro ao processar SB1010: {str(e)}")

def process_sbz010_record(data: Dict[str, Any], db: Session) -> Optional[SBZ010]:
    """
    Processa um registro da SBZ010 - Importação direta do Protheus
    Filosofia: Aceitar dados como vêm do ERP sem validações rígidas
    """
    try:
        # LIMPEZA MÍNIMA: apenas remover aspas duplas se existirem
        cleaned_data = {}
        for key, value in data.items():
            if isinstance(value, str):
                # Remove apenas aspas duplas externas, preserva espaços
                if value.startswith('"') and value.endswith('"'):
                    cleaned_value = value[1:-1]
                else:
                    cleaned_value = value
                cleaned_data[key] = cleaned_value
            else:
                cleaned_data[key] = value
        
        # Usar dados limpos
        data = cleaned_data
        
        # Converter campos para minúsculas se necessário
        fields_map = {
            'BZ_FILIAL': 'bz_filial',
            'BZ_COD': 'bz_cod',
            'BZ_LOCPAD': 'bz_locpad',
            'BZ_XLOCAL1': 'bz_xlocal1',
            'BZ_XLOCAL2': 'bz_xlocal2',
            'BZ_XLOCAL3': 'bz_xlocal3'
        }
        
        for old_key, new_key in fields_map.items():
            if old_key in data:
                data[new_key] = data.pop(old_key)
        
        # Verificar se já existe (chave: bz_filial + bz_cod)
        existing = db.query(SBZ010).filter(
            SBZ010.bz_filial == data.get('bz_filial', ''),
            SBZ010.bz_cod == data.get('bz_cod', '')
        ).first()
        
        if existing:
            # Atualizar registro existente
            for key, value in data.items():
                if hasattr(existing, key) and key not in ['created_at']:
                    setattr(existing, key, value)
            return existing
        else:
            # Criar novo registro - aceitar dados como estão
            return SBZ010(**data)
            
    except Exception as e:
        raise ValueError(f"Erro ao processar SBZ010: {str(e)}")

def process_sb2010_record(data: Dict[str, Any], db: Session) -> Optional[SB2010]:
    """
    Processa um registro da SB2010 - Importação direta do Protheus
    Filosofia: Aceitar dados como vêm do ERP sem validações rígidas
    """
    try:
        # LIMPEZA MÍNIMA: apenas remover aspas duplas se existirem
        cleaned_data = {}
        for key, value in data.items():
            if isinstance(value, str):
                # Remove apenas aspas duplas externas, preserva espaços
                if value.startswith('"') and value.endswith('"'):
                    cleaned_value = value[1:-1]
                else:
                    cleaned_value = value
                cleaned_data[key] = cleaned_value
            else:
                cleaned_data[key] = value
        
        # Usar dados limpos
        data = cleaned_data
        
        # Converter campos de chave primária para minúsculas se necessário
        if 'B2_FILIAL' in data:
            data['b2_filial'] = data.pop('B2_FILIAL')
        if 'B2_COD' in data:
            data['b2_cod'] = data.pop('B2_COD')
        if 'B2_LOCAL' in data:
            data['b2_local'] = data.pop('B2_LOCAL')
        if 'B2_QATU' in data:
            data['b2_qatu'] = data.pop('B2_QATU')
        if 'B2_RESERVA' in data:
            data['b2_reserva'] = data.pop('B2_RESERVA')
        if 'B2_QEMP' in data:
            data['b2_qemp'] = data.pop('B2_QEMP')
        
        # NÃO forçar store_id - deixar NULL se não vier do Protheus
        # NÃO alterar b2_local - usar exatamente como vem do Protheus
        
        # Verificar se já existe (chave: b2_filial + b2_cod + b2_local)
        existing = db.query(SB2010).filter(
            SB2010.b2_filial == data.get('b2_filial', ''),
            SB2010.b2_cod == data.get('b2_cod', ''),
            SB2010.b2_local == data.get('b2_local', '')
        ).first()
        
        if existing:
            # Atualizar registro existente
            for key, value in data.items():
                if hasattr(existing, key) and key not in ['created_at', 'id']:
                    setattr(existing, key, value)
            return existing
        else:
            # Criar novo registro - aceitar dados como estão
            return SB2010(**data)
            
    except Exception as e:
        raise ValueError(f"Erro ao processar SB2010: {str(e)}")

def process_sb8010_record(data: Dict[str, Any], db: Session) -> Optional[SB8010]:
    """
    Processa um registro da SB8010 - Importação direta do Protheus
    Filosofia: Aceitar dados como vêm do ERP sem validações rígidas
    """
    try:
        # LIMPEZA MÍNIMA: apenas remover aspas duplas se existirem
        cleaned_data = {}
        for key, value in data.items():
            if isinstance(value, str):
                # Remove apenas aspas duplas externas, preserva espaços
                if value.startswith('"') and value.endswith('"'):
                    cleaned_value = value[1:-1]
                else:
                    cleaned_value = value
                cleaned_data[key] = cleaned_value
            else:
                cleaned_data[key] = value
        
        # Usar dados limpos
        data = cleaned_data
        
        # Converter campos para minúsculas se necessário
        fields_map = {
            'B8_FILIAL': 'b8_filial',
            'B8_PRODUTO': 'b8_produto', 
            'B8_LOCAL': 'b8_local',
            'B8_LOTECTL': 'b8_lotectl',
            'B8_NUMLOTE': 'b8_numlote',
            'B8_SALDO': 'b8_saldo',
            'B8_DTVALID': 'b8_dtvalid',
            'B8_QTDORI': 'b8_qtdori',
            'B8_DATA': 'b8_data',
            'B8_EMPENHO': 'b8_empenho',
            'B8_LOTEFOR': 'b8_lotefor',
            'B8_DOC': 'b8_doc',
            'B8_SERIE': 'b8_serie',
            'B8_CLIFOR': 'b8_clifor',
            'B8_LOJA': 'b8_loja'
        }
        
        for old_key, new_key in fields_map.items():
            if old_key in data:
                data[new_key] = data.pop(old_key)
        
        # Garantir que b8_numlote tenha um valor se não vier do CSV
        if 'b8_numlote' not in data or not data['b8_numlote']:
            data['b8_numlote'] = '      '  # Valor padrão como no CSV
        
        # Converter data de validade se vier no formato YYYYMMDD
        if 'b8_dtvalid' in data and data['b8_dtvalid']:
            try:
                # Converter de YYYYMMDD para YYYY-MM-DD
                date_str = data['b8_dtvalid']
                if len(date_str) == 8 and date_str.isdigit():
                    data['b8_dtvalid'] = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
            except:
                pass  # Manter valor original se falhar
        
        # NÃO forçar store_id - deixar NULL se não vier do Protheus
        
        # Verificar se já existe (usando chave natural)
        existing = db.query(SB8010).filter(
            SB8010.b8_filial == data.get('b8_filial', ''),
            SB8010.b8_produto == data.get('b8_produto', ''),
            SB8010.b8_local == data.get('b8_local', ''),
            SB8010.b8_lotectl == data.get('b8_lotectl', ''),
            SB8010.b8_numlote == data.get('b8_numlote', '')
        ).first()
        
        if existing:
            # Atualizar registro existente
            for key, value in data.items():
                if hasattr(existing, key) and key not in ['created_at', 'id']:
                    setattr(existing, key, value)
            return existing
        else:
            # Criar novo registro - aceitar dados como estão
            return SB8010(**data)
            
    except Exception as e:
        raise ValueError(f"Erro ao processar SB8010: {str(e)}")

def process_slk010_record(data: Dict[str, Any], db: Session) -> Optional[SLK010]:
    """
    Processa um registro da SLK010 - Importação direta do Protheus
    Filosofia: Aceitar dados como vêm do ERP sem validações rígidas
    """
    try:
        # LIMPEZA MÍNIMA: apenas remover aspas duplas se existirem
        cleaned_data = {}
        for key, value in data.items():
            if isinstance(value, str):
                # Remove apenas aspas duplas externas, preserva espaços
                if value.startswith('"') and value.endswith('"'):
                    cleaned_value = value[1:-1]
                else:
                    cleaned_value = value
                cleaned_data[key] = cleaned_value
            else:
                cleaned_data[key] = value
        
        # Usar dados limpos
        data = cleaned_data
        
        # Converter campos para minúsculas se necessário
        if 'LK_FILIAL' in data:
            data['lk_filial'] = data.pop('LK_FILIAL')
        if 'LK_CODIGO' in data:
            data['lk_codigo'] = data.pop('LK_CODIGO')
        if 'LK_CODBAR' in data:
            data['lk_codbar'] = data.pop('LK_CODBAR')
        
        # Mapear lk_codigo para slk_produto se necessário
        if 'lk_codigo' in data and 'slk_produto' not in data:
            data['slk_produto'] = data['lk_codigo']
        
        # NÃO forçar store_id ou product_id - deixar NULL se não vier do Protheus
        
        # Verificar se já existe (chave: lk_filial + lk_codigo + lk_codbar)
        existing = db.query(SLK010).filter(
            SLK010.lk_filial == data.get('lk_filial', ''),
            SLK010.lk_codigo == data.get('lk_codigo', ''),
            SLK010.lk_codbar == data.get('lk_codbar', '')
        ).first()
        
        if existing:
            # Atualizar registro existente
            for key, value in data.items():
                if hasattr(existing, key) and key not in ['created_at', 'id']:
                    setattr(existing, key, value)
            return existing
        else:
            # Criar novo registro - aceitar dados como estão
            return SLK010(**data)
            
    except Exception as e:
        raise ValueError(f"Erro ao processar SLK010: {str(e)}")

def process_da1010_record(data: Dict[str, Any], db: Session) -> Optional[DA1010]:
    """Processa um registro da DA1010"""
    try:
        # Implementar lógica específica da DA1010
        return DA1010(**data)
    except Exception as e:
        raise ValueError(f"Erro ao processar DA1010: {str(e)}")

@router.get("/tables")
async def get_supported_tables():
    """Retorna lista de tabelas suportadas para importação"""
    return {
        "tables": [
            {"name": "SB1010", "description": "Cadastro de Produtos"},
            {"name": "SBZ010", "description": "Parâmetros por Filial"},
            {"name": "SB2010", "description": "Saldos por Local"},
            {"name": "SB8010", "description": "Saldos por Lote"},
            {"name": "SLK010", "description": "Códigos de Barras"},
            {"name": "DA1010", "description": "Tabela de Preços"},
            {"name": "SBM010", "description": "Grupos de Produtos"},
            {"name": "SZD010", "description": "Categorias"},
            {"name": "SZE010", "description": "Subcategorias"},
            {"name": "SZF010", "description": "Segmentos"}
        ]
    }

@router.post("/validate")
async def validate_import_data(request: ImportRequest):
    """Valida dados antes da importação"""
    validation_errors = []
    
    for i, record in enumerate(request.records):
        errors = validate_record(request.table_name, record.data)
        if errors:
            validation_errors.append({
                "line": record.line_number,
                "errors": errors
            })
    
    return {
        "valid": len(validation_errors) == 0,
        "errors": validation_errors,
        "total_records": len(request.records)
    }

@router.delete("/clear/{table_name}")
async def clear_table_data(
    table_name: str,
    db: Session = Depends(get_db)
):
    """
    Limpa todos os dados de uma tabela específica
    CUIDADO: Esta operação é irreversível!
    """
    # Mapeamento de tabelas para modelos
    table_models = {
        'SB1010': SB1010,
        'SBZ010': SBZ010,
        'SB2010': SB2010,
        'SB8010': SB8010,
        'SLK010': SLK010,
        'DA1010': DA1010,
        'SBM010': SBM010,
        'SZD010': SZD010,
        'SZE010': SZE010,
        'SZF010': SZF010
    }
    
    if table_name not in table_models:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tabela '{table_name}' não suportada"
        )
    
    model_class = table_models[table_name]
    
    try:
        # Contar registros antes da exclusão
        count_before = db.query(model_class).count()
        
        # Limpar todos os registros da tabela
        db.query(model_class).delete()
        db.commit()
        
        return {
            "message": f"✅ Tabela {table_name} limpa com sucesso",
            "deleted_records": count_before,
            "table": table_name
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=safe_error_response(e, "ao limpar tabela {table_name}")
        )

def process_sbm010_record(data: Dict[str, Any], db: Session) -> Optional[SBM010]:
    """Processa um registro da SBM010 - Grupos de Produtos"""
    try:
        # Verificar se já existe (chave: bm_filial + bm_grupo)
        existing = db.query(SBM010).filter(
            SBM010.bm_filial == data.get('bm_filial', ''),
            SBM010.bm_grupo == data.get('bm_grupo', '')
        ).first()
        
        if existing:
            # Atualizar registro existente
            for key, value in data.items():
                if hasattr(existing, key):
                    setattr(existing, key, value)
            return existing
        else:
            # Criar novo registro
            return SBM010(**data)
            
    except Exception as e:
        raise ValueError(f"Erro ao processar SBM010: {str(e)}")

def process_szd010_record(data: Dict[str, Any], db: Session) -> Optional[SZD010]:
    """Processa um registro da SZD010 - Categorias"""
    try:
        # Verificar se já existe (chave: zd_filial + zd_xcod)
        existing = db.query(SZD010).filter(
            SZD010.zd_filial == data.get('zd_filial', ''),
            SZD010.zd_xcod == data.get('zd_xcod', '')
        ).first()
        
        if existing:
            # Atualizar registro existente
            for key, value in data.items():
                if hasattr(existing, key):
                    setattr(existing, key, value)
            return existing
        else:
            # Criar novo registro
            return SZD010(**data)
            
    except Exception as e:
        raise ValueError(f"Erro ao processar SZD010: {str(e)}")

def process_sze010_record(data: Dict[str, Any], db: Session) -> Optional[SZE010]:
    """Processa um registro da SZE010 - Subcategorias"""
    try:
        # Verificar se já existe (chave: ze_filial + ze_xcod)
        existing = db.query(SZE010).filter(
            SZE010.ze_filial == data.get('ze_filial', ''),
            SZE010.ze_xcod == data.get('ze_xcod', '')
        ).first()
        
        if existing:
            # Atualizar registro existente
            for key, value in data.items():
                if hasattr(existing, key):
                    setattr(existing, key, value)
            return existing
        else:
            # Criar novo registro
            return SZE010(**data)
            
    except Exception as e:
        raise ValueError(f"Erro ao processar SZE010: {str(e)}")

def process_szf010_record(data: Dict[str, Any], db: Session) -> Optional[SZF010]:
    """Processa um registro da SZF010 - Segmentos"""
    try:
        # Verificar se já existe (chave: zf_filial + zf_xcod)
        existing = db.query(SZF010).filter(
            SZF010.zf_filial == data.get('zf_filial', ''),
            SZF010.zf_xcod == data.get('zf_xcod', '')
        ).first()
        
        if existing:
            # Atualizar registro existente
            for key, value in data.items():
                if hasattr(existing, key):
                    setattr(existing, key, value)
            return existing
        else:
            # Criar novo registro
            return SZF010(**data)
            
    except Exception as e:
        raise ValueError(f"Erro ao processar SZF010: {str(e)}")

def validate_record(table_name: str, data: Dict[str, Any]) -> List[str]:
    """Valida um registro individual"""
    errors = []
    
    if table_name == 'SB1010':
        if not data.get('b1_cod'):
            errors.append("B1_COD é obrigatório")
    elif table_name == 'SBZ010':
        if not data.get('bz_filial'):
            errors.append("BZ_FILIAL é obrigatório")
        if not data.get('bz_cod'):
            errors.append("BZ_COD é obrigatório")
    elif table_name == 'SBM010':
        if not data.get('bm_grupo'):
            errors.append("BM_GRUPO é obrigatório")
    elif table_name == 'SZD010':
        if not data.get('zd_xcod'):
            errors.append("ZD_XCOD é obrigatório")
    elif table_name == 'SZE010':
        if not data.get('ze_xcod'):
            errors.append("ZE_XCOD é obrigatório")
    elif table_name == 'SZF010':
        if not data.get('zf_xcod'):
            errors.append("ZF_XCOD é obrigatório")
    
    return errors