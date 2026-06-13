# ============================================================
# Logística Backend — multi-stage build
# Base: node:22-alpine (mesma dos demais backends da plataforma)
# ============================================================

# ---------- Stage 1: builder ----------
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY src ./src/
RUN npx prisma generate
# Segundo cliente Prisma — COFRE de comprovante (banco isolado). Gera em
# node_modules/@prisma-cofre/client; o runtime copia node_modules do builder.
RUN npx prisma generate --schema=prisma/cofre/schema.prisma
RUN npm run build

# ---------- Stage 2: runtime ----------
FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat tzdata && \
    cp /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime && \
    echo "America/Sao_Paulo" > /etc/timezone && \
    apk del tzdata
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder --chown=appuser:appgroup /app/package*.json ./
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/prisma ./prisma
USER appuser
ENV NODE_ENV=production
ENV TZ=America/Sao_Paulo
EXPOSE 3003
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3003/api/v1/logistica/health || exit 1
CMD ["node", "dist/main.js"]
