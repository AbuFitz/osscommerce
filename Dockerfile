# Mirror of services/engine/Dockerfile at the repository root so Railway's first build detects it. Keep the two identical.
# syntax=docker/dockerfile:1
# One image runs a cell: the API server, the job worker, or both (MODE). Build from the repository root:
#   docker build -f services/engine/Dockerfile -t osc-cell .
ARG BASE=node:22-slim
FROM ${BASE}
ENV NODE_ENV=production
WORKDIR /app
# The shared contracts package is a local dependency of the engine.
COPY packages/contracts packages/contracts
# Plain npm installs, so hosted builders (Railway) that do not support secret mounts can build this. Behind a TLS-inspecting proxy, build locally with --build-arg npm_config_cafile pointing at a CA file copied into the context.
RUN cd packages/contracts && npm install --omit=dev --no-package-lock --no-audit --no-fund
COPY services/engine/package.json services/engine/package-lock.json services/engine/
RUN cd services/engine && npm ci --omit=dev --no-audit --no-fund
COPY services/engine/src services/engine/src
COPY services/engine/tsconfig.json services/engine/
WORKDIR /app/services/engine
ENV PORT=3000 MODE=both
EXPOSE 3000
USER node
# Pending migrations are applied at boot (migrationsRun). The process exits non-zero if configuration is missing or unsafe.
CMD ["npx", "tsx", "src/main.ts"]
