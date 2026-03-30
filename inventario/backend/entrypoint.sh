#!/bin/bash
# =================================
# Entrypoint para Backend FastAPI
# Suporta HTTP e HTTPS (SSL/TLS)
# =================================

set -e

echo "🚀 Iniciando Sistema de Inventário Protheus..."

# Verificar se certificados SSL existem
if [ -f "${SSL_CERT_FILE}" ] && [ -f "${SSL_KEY_FILE}" ]; then
    echo "🔒 Certificados SSL encontrados!"
    echo "📄 Certificado: ${SSL_CERT_FILE}"
    echo "🔑 Chave privada: ${SSL_KEY_FILE}"
    echo ""
    echo "✅ Iniciando servidor HTTPS na porta 8443..."
    echo "✅ Também disponível HTTP na porta 8000 (redirect para HTTPS)"
    echo ""

    # Iniciar uvicorn com SSL
    exec uvicorn app.main:app \
        --host 0.0.0.0 \
        --port 8443 \
        --ssl-keyfile "${SSL_KEY_FILE}" \
        --ssl-certfile "${SSL_CERT_FILE}" \
        --workers 1 \
        --log-level info &

    # Também iniciar HTTP na porta 8000 para compatibilidade
    exec uvicorn app.main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --workers 1 \
        --log-level info
else
    echo "⚠️  Certificados SSL não encontrados"
    echo "📍 Procurado em: ${SSL_CERT_FILE}"
    echo "📍 Procurado em: ${SSL_KEY_FILE}"
    echo ""
    echo "✅ Iniciando servidor HTTP apenas na porta 8000..."
    echo ""

    # Iniciar uvicorn sem SSL
    exec uvicorn app.main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --workers 1 \
        --log-level info
fi
