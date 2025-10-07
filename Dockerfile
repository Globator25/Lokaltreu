# build
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json apps/web/
COPY apps/api/package*.json apps/api/
RUN npm ci
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


