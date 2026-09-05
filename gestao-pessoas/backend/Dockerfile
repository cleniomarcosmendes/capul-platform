# ============================================================
# Gestão de Pessoas Backend — multi-stage build
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
# O seed roda por `npx prisma db seed` DENTRO do container (padrao da casa) e e
# TypeScript: precisa dos tsconfig e do `src`, porque prisma/seed.ts importa
# src/modelo/distribuir-peso. Sem isto o seed falha so na hora de semear, que e
# tarde — descoberto subindo no DEV em 05/09/2026.
COPY --from=builder --chown=appuser:appgroup /app/tsconfig.json /app/tsconfig.seed.json ./
COPY --from=builder --chown=appuser:appgroup /app/src ./src
USER appuser
ENV NODE_ENV=production
ENV TZ=America/Sao_Paulo
# ---------- Identidade do build ----------
# Gravada na IMAGEM (não em runtime): diz QUAL CÓDIGO está no ar, e o /health a
# devolve para a tela Versao. Fica no fim do arquivo de propósito —
# muda a cada build e invalidaria o cache das camadas acima.
# Preencher com `scripts/build-com-versao.sh`; sem os args, o serviço se declara
# "desconhecido" (ver src/common/versao.ts) em vez de mentir uma versão.
ARG APP_COMMIT=desconhecido
ARG APP_BUILD_TIME=
ENV APP_COMMIT=$APP_COMMIT
ENV APP_BUILD_TIME=$APP_BUILD_TIME

EXPOSE 3004
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3004/api/v1/gestao-pessoas/health || exit 1
CMD ["node", "dist/main.js"]
