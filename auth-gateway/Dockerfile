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

EXPOSE 3000

CMD ["node", "dist/main.js"]
