# syntax=docker/dockerfile:1

# ---------- Сборка ----------
FROM node:22-slim AS build
WORKDIR /app

# better-sqlite3 — нативный модуль, для сборки нужен компилятор.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig*.json vite.config.ts ./
COPY shared ./shared
COPY server ./server
COPY web ./web
COPY scripts ./scripts

RUN npm run build

# ---------- Только production-зависимости ----------
FROM node:22-slim AS deps
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- Финальный образ ----------
FROM node:22-slim AS runtime
WORKDIR /app

# sqlite3 нужен для scripts/backup.sh, curl — для healthcheck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends sqlite3 curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/vacations.db \
    VACATION_YEAR=2027

COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY scripts ./scripts

# Каталог данных принадлежит непривилегированному пользователю node (uid 1000).
RUN mkdir -p /app/data && chown -R node:node /app/data

USER node
EXPOSE 3000

CMD ["node", "dist/server/index.js"]
