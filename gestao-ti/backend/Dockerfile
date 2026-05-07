FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

FROM node:22-alpine

WORKDIR /app

# Cria appuser/appgroup ANTES do COPY — permite usar --chown em cada COPY
# (evita `chown -R /app` recursivo no final, que demora ~2min em node_modules
# com ~80k+ arquivos via copy-on-write do overlay2). Auditoria 25/04/2026 #2.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./
COPY --from=builder --chown=appuser:appgroup /app/prisma ./prisma
COPY --from=builder --chown=appuser:appgroup /app/tsconfig.json ./
COPY --from=builder --chown=appuser:appgroup /app/tsconfig.seed.json ./

# Pré-criar diretórios de upload com owner correto (fix preventivo 04/05/2026)
# Antes: pastas eram criadas em runtime via mkdirSync — quando container roda
# como appuser mas o volume já existe (named volume com owner root de deploy
# antigo), upload falha com EACCES silencioso. Pré-criar no build resolve.
# Cobre todos os módulos que aceitam upload: chamados, paradas, projetos,
# conhecimento (base de conhecimento), contratos, notas-fiscais, pendencias.
RUN mkdir -p /app/uploads/chamados \
             /app/uploads/paradas \
             /app/uploads/projetos \
             /app/uploads/conhecimento \
             /app/uploads/contratos \
             /app/uploads/notas-fiscais \
             /app/uploads/pendencias \
    && chown -R appuser:appgroup /app/uploads
USER appuser

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/main.js"]
