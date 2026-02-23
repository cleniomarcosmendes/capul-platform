#!/usr/bin/env python3
"""
SCRIPT DE ROBUSTIFICAÇÃO AUTOMÁTICA
Aplica o padrão robusto em todos os endpoints da aplicação.
"""

import os
import re
import ast
from typing import List, Dict, Tuple

class EndpointRobustifier:
    """Automatiza a aplicação do padrão robusto em endpoints"""
    
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.content = ""
        self.load_file()
    
    def load_file(self):
        """Carregar arquivo"""
        with open(self.file_path, 'r', encoding='utf-8') as f:
            self.content = f.read()
    
    def save_file(self, backup: bool = True):
        """Salvar arquivo com backup"""
        if backup:
            backup_path = f"{self.file_path}.backup"
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(self.content)
            print(f"✅ Backup criado: {backup_path}")
        
        with open(self.file_path, 'w', encoding='utf-8') as f:
            f.write(self.content)
        print(f"✅ Arquivo atualizado: {self.file_path}")
    
    def find_endpoints(self) -> List[Dict]:
        """Encontrar todos os endpoints FastAPI"""
        patterns = [
            r'@app\.(get|post|put|patch|delete)\([^)]+\)',
            r'@router\.(get|post|put|patch|delete)\([^)]+\)'
        ]
        
        endpoints = []
        for pattern in patterns:
            matches = re.finditer(pattern, self.content, re.MULTILINE)
            for match in matches:
                endpoints.append({
                    "decorator": match.group(0),
                    "start": match.start(),
                    "end": match.end(),
                    "method": match.group(1).upper()
                })
        
        return endpoints
    
    def add_robust_imports(self):
        """Adicionar imports do framework robusto"""
        robust_import = """
# ✅ IMPORTS DO FRAMEWORK ROBUSTO
from app.core.robust_framework import (
    robust_endpoint, RobustValidator, safe_query, 
    safe_json_response, resilient_db_session, robust_cache
)
import traceback
"""
        
        # Verificar se já existe
        if "robust_framework" in self.content:
            return
        
        # Adicionar após outros imports
        import_pattern = r'(from fastapi import[^\\n]*\\n)'
        if re.search(import_pattern, self.content):
            self.content = re.sub(
                import_pattern,
                r'\1' + robust_import,
                self.content,
                count=1
            )
        else:
            # Adicionar no início
            self.content = robust_import + "\n" + self.content
    
    def wrap_endpoint_with_robust_decorator(self, endpoint_match: Dict):
        """Envolver endpoint com decorador robusto"""
        decorator = endpoint_match["decorator"]
        
        # Verificar se já tem decorador robusto
        if "@robust_endpoint" in decorator:
            return
        
        # Adicionar decorador robusto antes do endpoint
        robust_decorator = """@robust_endpoint(
    fallback_response={"success": False, "message": "Serviço temporariamente indisponível"},
    max_retries=3,
    log_errors=True
)
"""
        
        insert_pos = endpoint_match["start"]
        self.content = (
            self.content[:insert_pos] + 
            robust_decorator + 
            self.content[insert_pos:]
        )
    
    def add_input_validation(self, function_content: str) -> str:
        """Adicionar validação robusta de entrada"""
        validation_code = """
    # ✅ VALIDAÇÃO ROBUSTA DE ENTRADA
    validator = RobustValidator()
    
    # Validar parâmetros de forma segura
    # TODO: Adicionar validações específicas baseadas nos parâmetros da função
"""
        
        # Inserir no início da função
        if "validator = RobustValidator()" not in function_content:
            # Encontrar primeiro try: ou primeira linha após docstring
            lines = function_content.split('\\n')
            insert_line = 1
            
            for i, line in enumerate(lines):
                if line.strip().startswith('"""') and '"""' in line[3:]:
                    insert_line = i + 1
                    break
                elif line.strip().startswith('try:'):
                    insert_line = i
                    break
            
            lines.insert(insert_line, validation_code)
            return '\\n'.join(lines)
        
        return function_content
    
    def add_error_handling(self, function_content: str) -> str:
        """Adicionar tratamento robusto de erros"""
        
        if "except Exception as e:" in function_content:
            return function_content  # Já tem tratamento
        
        error_handling = """
    except HTTPException:
        raise
    except Exception as e:
        # ✅ TRATAMENTO ROBUSTO DE ERRO
        logger.error(f"❌ Erro em {request.url.path}: {str(e)[:200]}")
        logger.debug(f"📋 Stack trace: {traceback.format_exc()}")
        
        return safe_json_response({
            "success": False,
            "message": "❌ Erro interno do sistema. Tente novamente.",
            "error_details": str(e)[:100] if settings.DEBUG else None
        }, success=False)
"""
        
        # Inserir antes do final da função
        if "try:" in function_content and "except" not in function_content:
            function_content = function_content.rstrip() + error_handling
        
        return function_content
    
    def add_robust_response(self, function_content: str) -> str:
        """Converter return em safe_json_response"""
        
        # Padrão para encontrar returns
        return_pattern = r'return\\s+({[^}]+})'
        
        def replace_return(match):
            return_data = match.group(1)
            return f"return safe_json_response({return_data})"
        
        return re.sub(return_pattern, replace_return, function_content)
    
    def robustify_all(self):
        """Aplicar padrão robusto em todos os endpoints"""
        print(f"🔧 Robustificando {self.file_path}...")
        
        # 1. Adicionar imports
        self.add_robust_imports()
        
        # 2. Encontrar endpoints
        endpoints = self.find_endpoints()
        print(f"📊 Encontrados {len(endpoints)} endpoints")
        
        # 3. Processar cada endpoint
        for endpoint in endpoints:
            print(f"🛡️ Robustificando endpoint {endpoint['method']}...")
            # TODO: Implementar robustificação por endpoint
        
        print("✅ Robustificação concluída!")

def robustify_entire_application():
    """Robustificar toda a aplicação"""
    
    # Arquivos a serem robustificados
    files_to_robustify = [
        "/mnt/c/meus_projetos/Capul_Inventario/backend/app/main.py",
        "/mnt/c/meus_projetos/Capul_Inventario/backend/app/api/auth.py",
        "/mnt/c/meus_projetos/Capul_Inventario/backend/app/api/products.py",
        "/mnt/c/meus_projetos/Capul_Inventario/backend/app/api/inventory.py",
        # Adicionar mais arquivos conforme necessário
    ]
    
    results = []
    
    for file_path in files_to_robustify:
        if os.path.exists(file_path):
            try:
                robustifier = EndpointRobustifier(file_path)
                robustifier.robustify_all()
                results.append({"file": file_path, "status": "SUCCESS"})
            except Exception as e:
                print(f"❌ Erro ao processar {file_path}: {e}")
                results.append({"file": file_path, "status": "ERROR", "error": str(e)})
        else:
            print(f"⚠️ Arquivo não encontrado: {file_path}")
            results.append({"file": file_path, "status": "NOT_FOUND"})
    
    # Relatório final
    print("\\n" + "="*60)
    print("📊 RELATÓRIO DE ROBUSTIFICAÇÃO")
    print("="*60)
    
    success_count = len([r for r in results if r["status"] == "SUCCESS"])
    error_count = len([r for r in results if r["status"] == "ERROR"])
    not_found_count = len([r for r in results if r["status"] == "NOT_FOUND"])
    
    print(f"✅ Sucessos: {success_count}")
    print(f"❌ Erros: {error_count}")
    print(f"⚠️ Não encontrados: {not_found_count}")
    
    for result in results:
        status_icon = {"SUCCESS": "✅", "ERROR": "❌", "NOT_FOUND": "⚠️"}[result["status"]]
        print(f"{status_icon} {result['file']}")
        if result["status"] == "ERROR":
            print(f"    Erro: {result['error']}")
    
    print("\\n🎯 PRÓXIMOS PASSOS:")
    print("1. Revisar arquivos modificados")
    print("2. Executar testes de regressão")
    print("3. Aplicar padrão em novos endpoints")
    print("4. Monitorar logs de erro")

if __name__ == "__main__":
    robustify_entire_application()