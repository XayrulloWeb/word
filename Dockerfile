FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate
RUN npm run build
RUN npm --prefix web ci && npm run build:web

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma/

RUN npm ci --omit=dev && npm install -g pm2 prisma

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/web/dist ./web/dist
COPY ecosystem.config.cjs ./

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && pm2-runtime start ecosystem.config.cjs"]
