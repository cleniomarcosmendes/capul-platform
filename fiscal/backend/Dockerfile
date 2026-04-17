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
RUN npm run build

# ---------- Stage 2: runtime ----------
FROM node:22-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat tzdata && \
    cp /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime && \
    echo "America/Sao_Paulo" > /etc/timezone && \
    apk del tzdata

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Diretório montado em runtime: /app/certs (read-only) — certificado A1 .pfx
# Diretório montado em runtime: /app/xmls (read-write) — XMLs baixados (cache de disco opcional)
RUN mkdir -p /app/certs /app/xmls

ENV NODE_ENV=production
ENV TZ=America/Sao_Paulo

EXPOSE 3002

# Healthcheck usa o endpoint público /api/v1/fiscal/health que verifica DB+Redis+SMTP.
# 200 → saudável (ok ou degraded); 503 → down (DB/Redis off).
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3002/api/v1/fiscal/health || exit 1

CMD ["node", "dist/main.js"]
