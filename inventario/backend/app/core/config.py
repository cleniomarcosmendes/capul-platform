# backend/app/core/config.py
"""
Configurações do Sistema de Inventário Protheus
"""
import os
from typing import List

class Settings:
    """Configurações da aplicação"""
    
    # Informações básicas
    APP_NAME: str = "Sistema de Inventário Protheus"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    
    # Servidor
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))
    
    # Banco de dados
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://inventario_user:inventario_2024!@postgres:5432/inventario_protheus"
    )
    
    # Extrair informações do DATABASE_URL para compatibilidade
    @property
    def DATABASE_HOST(self) -> str:
        if "postgresql://" in self.DATABASE_URL:
            # Extrair host de postgresql://user:pass@host:port/db
            parts = self.DATABASE_URL.split("@")[1].split(":")[0]
            return parts
        return "postgres"
    
    @property 
    def DATABASE_NAME(self) -> str:
        if "postgresql://" in self.DATABASE_URL:
            # Extrair nome do banco
            return self.DATABASE_URL.split("/")[-1]
        return "inventario_protheus"
    
    # Segurança
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production-256-bits")
    # ✅ v2.19.8: Aumentado de 60 para 480 minutos (8 horas) para evitar expiração durante uso
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 480))
    ALGORITHM: str = "HS256"

    # ✅ NOVO v2.14.0: API Protheus (Sincronização)
    # ✅ v2.19.47: Atualizado endpoint para porta 8104
    PROTHEUS_API_URL: str = os.getenv(
        "PROTHEUS_API_URL",
        "https://apiportal.capul.com.br:8104/rest/api/INFOCLIENTES/hierarquiaMercadologica"
    )
    PROTHEUS_API_AUTH: str = os.getenv(
        "PROTHEUS_API_AUTH",
        "Basic QVBJQ0FQVUw6QXAxQzRwdTFQUkQ="
    )
    PROTHEUS_API_TIMEOUT: int = int(os.getenv("PROTHEUS_API_TIMEOUT", 30))

    # CORS
    # ✅ SEGURANÇA v2.19.13: CORS configurável via variável de ambiente
    @property
    def CORS_ORIGINS(self) -> List[str]:
        """
        Origens CORS permitidas.
        Em produção, use variável de ambiente com domínios específicos.
        Formato: CORS_ORIGINS=https://app.example.com,https://admin.example.com
        """
        cors_env = os.getenv("CORS_ORIGINS", "")
        if cors_env:
            return [origin.strip() for origin in cors_env.split(",") if origin.strip()]
        # Em produção, se não configurado, usar lista restrita
        if self.ENVIRONMENT == "production":
            return ["https://localhost:8443"]
        # Em desenvolvimento, permitir localhost e IPs de rede local
        return ["*"]  # Permite todas as origens em desenvolvimento (necessário para acesso mobile via IP)
    
    # Logs
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # ✅ PERFORMANCE v2.19.13: Cache Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")

    # ✅ SEGURANÇA v2.19.13: Controle de endpoints de teste
    # Apenas habilitar explicitamente em desenvolvimento, NUNCA em produção
    @property
    def ENABLE_TEST_ENDPOINTS(self) -> bool:
        # Em produção, sempre desabilitado independente da variável de ambiente
        if self.ENVIRONMENT == "production":
            return False
        # Em dev/staging, default FALSE para maior segurança (requer opt-in explícito)
        return os.getenv("ENABLE_TEST_ENDPOINTS", "false").lower() == "true"

# Instância global das configurações
settings = Settings()

# Função para validar configurações
def validate_settings():
    """Validar configurações críticas"""
    errors = []
    warnings = []

    # ✅ SEGURANÇA v2.19.13: Validações mais rigorosas

    # Validar SECRET_KEY
    default_secret_keys = [
        "your-secret-key-change-in-production-256-bits",
        "your-secret-key-here-should-be-very-secure",
        "gerar-chave-256-bits-aqui-usando-openssl-rand-hex-32"
    ]
    if not settings.SECRET_KEY or settings.SECRET_KEY in default_secret_keys:
        if settings.ENVIRONMENT == "production":
            errors.append("SECRET_KEY deve ser uma chave segura em produção (use: openssl rand -hex 32)")
        else:
            warnings.append("SECRET_KEY usando valor padrão - altere em produção!")

    # Validar DATABASE_URL
    if not settings.DATABASE_URL:
        errors.append("DATABASE_URL é obrigatória")

    # Validar PROTHEUS_API_AUTH
    default_auth = "Basic QVBJQ0FQVUw6QXAxQzRwdTFQUkQ="
    if settings.ENVIRONMENT == "production" and settings.PROTHEUS_API_AUTH == default_auth:
        warnings.append("PROTHEUS_API_AUTH pode estar usando credencial padrão")

    # Exibir warnings
    for warning in warnings:
        print(f"⚠️ AVISO: {warning}")

    # Erros são fatais em produção
    if errors:
        raise ValueError("Erros de configuração:\n" + "\n".join(f"- {error}" for error in errors))

    return True

# Auto-validação (exceto em testes)
if os.getenv("TESTING") != "1":
    try:
        validate_settings()
    except ValueError as e:
        print(f"⚠️ Aviso de configuração: {e}")

print(f"✅ Configurações carregadas - Ambiente: {settings.ENVIRONMENT}")
