# syntax=docker/dockerfile:1
ARG BASE=node:22-slim
FROM ${BASE}
ENV NODE_ENV=production PORT=3300
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/gateway/package.json packages/gateway/package.json
COPY apps/gateway/package.json apps/gateway/package.json
RUN npm ci --omit=dev --workspace @oss-commerce/gateway-runtime --no-audit --no-fund
COPY packages/gateway packages/gateway
COPY apps/gateway apps/gateway
WORKDIR /app/apps/gateway
EXPOSE 3300
USER node
CMD ["./node_modules/.bin/tsx", "src/main.ts"]
