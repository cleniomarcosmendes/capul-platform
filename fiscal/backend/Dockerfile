# ============================================================
# Fiscal Backend — multi-stage build
# Base: node:22-alpine (mesma do gestao-ti-backend)
# ============================================================

# ---------- Stage 1: builder ----------
FROM node:22-alpine AS builder

WORKDIR /app

# Dependências de sistema mínimas para build (prisma + native deps)
RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src/

RUN npx prisma generate
# Cliente Prisma da base RFB dedicada (banco separado) — gerado em
# node_modules/@prisma-rfb/client; o runtime copia node_modules do builder.
RUN npx prisma generate --schema=prisma/rfb/schema.prisma
RUN npm run build

# ---------- Stage 2: runtime ----------
FROM node:22-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat tzdata && \
    cp /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime && \
    echo "America/Sao_Paulo" > /etc/timezone && \
    apk del tzdata

# Cria appuser/appgroup ANTES do COPY — permite usar --chown em cada COPY
# (evita `chown -R /app` recursivo no final, que demora ~3min em node_modules
# com ~80k+ arquivos via copy-on-write do overlay2). Auditoria 25/04/2026 #2.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder --chown=appuser:appgroup /app/package*.json ./
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/prisma ./prisma

# Diretórios montados em runtime:
#   /app/certs — read-write — Configurador faz upload do A1; volume host
#     ./fiscal/backend/certs é montado por cima (appuser precisa ler .pfx
#     pre-existente e gravar novos uploads)
#   /app/xmls  — read-write — cache de XMLs baixados (opcional)
RUN mkdir -p /app/certs /app/xmls && chown -R appuser:appgroup /app/certs /app/xmls

USER appuser

ENV NODE_ENV=production
ENV TZ=America/Sao_Paulo

EXPOSE 3002

# Healthcheck usa o endpoint público /api/v1/fiscal/health que verifica DB+Redis+SMTP.
# 200 → saudável (ok ou degraded); 503 → down (DB/Redis off).
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3002/api/v1/fiscal/health || exit 1

CMD ["node", "dist/main.js"]
