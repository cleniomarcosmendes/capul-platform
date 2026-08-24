FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine

WORKDIR /app

# Cria appuser/appgroup ANTES do COPY — permite usar --chown em cada COPY
# (evita `chown -R /app` recursivo no final, que demora ~3min em node_modules
# com ~80k+ arquivos via copy-on-write do overlay2). Auditoria 25/04/2026 #2.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package*.json ./
COPY --from=builder --chown=appuser:appgroup /app/prisma ./prisma

USER appuser

# ---------- Identidade do build ----------
# Gravada na IMAGEM (não em runtime): diz QUAL CÓDIGO está no ar, e o /health a
# devolve para a tela "Sobre" do app. Fica no fim do arquivo de propósito —
# muda a cada build e invalidaria o cache das camadas acima.
# Preencher com `scripts/build-com-versao.sh`; sem os args, o serviço se declara
# "desconhecido" (ver src/common/versao.ts) em vez de mentir uma versão.
ARG APP_COMMIT=desconhecido
ARG APP_BUILD_TIME=
ENV APP_COMMIT=$APP_COMMIT
ENV APP_BUILD_TIME=$APP_BUILD_TIME

EXPOSE 3000

CMD ["node", "dist/main.js"]
