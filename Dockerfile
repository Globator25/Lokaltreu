# build
# syntax=docker/dockerfile:1.6
FROM node:22-slim AS builder

# syntax directive at top enables BuildKit features
WORKDIR /app

# Cache-buster for deps layer (set via --build-arg FORCE_REBUILD=<ts>)
ARG FORCE_REBUILD=0

# Copy lockfile and workspace manifests explicitly
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json

# Install deps for workspaces using the root lockfile (cache npm dir) and tie cache-bust here
RUN --mount=type=cache,target=/root/.npm \
    echo "cache-bust=${FORCE_REBUILD}" > /dev/null && \
    npm ci --workspaces --include-workspace-root --no-audit --fund=false
COPY . .
RUN npm run build

# runtime
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/apps/web/.next/standalone apps/web/.next/standalone
COPY --from=builder /app/apps/web/.next/static     apps/web/.next/static
COPY --from=builder /app/apps/web/public           apps/web/public
ENV PORT=8080
EXPOSE 8080
CMD ["node", "apps/web/.next/standalone/apps/web/server.js"]
