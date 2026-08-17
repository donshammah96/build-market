# ==============================================================================
# Build Stage 1: Turbo Prune
# ==============================================================================
FROM node:24-alpine AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo@^2.10.5
COPY . .
# Note: Turborepo 2.x uses positional argument syntax: turbo prune <target> --docker
RUN turbo prune workers --docker

# ==============================================================================
# Build Stage 2: Dependency Installer & Builder
# ==============================================================================
FROM node:24-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

# Copy pruned lockfile and manifests
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml

RUN pnpm install --frozen-lockfile

# Copy pruned source code
COPY --from=pruner /app/out/full/ .

# Generate Prisma Client & Build Worker
RUN pnpm --filter @build/db run postinstall
RUN pnpm --filter workers run build

# ==============================================================================
# Build Stage 3: Minimal Production Runner
# ==============================================================================
FROM node:24-alpine AS runner
RUN apk add --no-cache libc6-compat wget
WORKDIR /app

ENV NODE_ENV=production
ENV HEALTH_PORT=8080

# Run as non-root user for security isolation
USER node

# Copy built artifacts and necessary node_modules
COPY --chown=node:node --from=builder /app ./

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:8080/healthz || exit 1

ENTRYPOINT ["node", "apps/workers/dist/index.js"]
