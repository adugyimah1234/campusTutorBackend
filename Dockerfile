FROM node:20-bullseye-slim AS builder
WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./
RUN npm install

COPY backend .
RUN npm run build

FROM node:20-bullseye-slim
WORKDIR /app

RUN apt-get update && \
    apt-get install -y default-mysql-client && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/scripts ./scripts
COPY database ./database

RUN chmod +x ./scripts/docker-entrypoint.sh

ENV NODE_ENV=production

EXPOSE 4000
CMD ["./scripts/docker-entrypoint.sh"]
