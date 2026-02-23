# =================================
# SISTEMA DE INVENTÁRIO PROTHEUS
# Dockerfile - Backend FastAPI
# =================================

# Imagem base Python otimizada
FROM python:3.11-slim

# Metadados
LABEL maintainer="Sistema Inventário Protheus"
LABEL version="2.0.0"
LABEL description="Backend FastAPI para Sistema de Inventário Protheus"

# Variáveis de ambiente
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV PORT=8000

# Diretório de trabalho
WORKDIR /app

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Criar usuário não-root para segurança
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# Copiar requirements primeiro (para cache do Docker)
COPY requirements.txt .

# Instalar dependências Python
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copiar código da aplicação
COPY . .

# Criar diretórios necessários
RUN mkdir -p /app/logs /app/uploads /app/temp

# Copiar script de entrypoint
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Ajustar permissões
RUN chown -R appuser:appgroup /app
RUN chmod +x /app/scripts/entrypoint.sh 2>/dev/null || true

# Expor portas (HTTP e HTTPS)
EXPOSE 8000
EXPOSE 8443

# Health check (tenta HTTPS primeiro, fallback HTTP)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f -k https://localhost:8443/health || curl -f http://localhost:8000/health || exit 1

# Usar usuário não-root
USER appuser

# Comando padrão (usa entrypoint para suportar SSL)
CMD ["/app/entrypoint.sh"]