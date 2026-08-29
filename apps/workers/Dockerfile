# ==============================================================================
# Build Stage 1: Turbo Prune
# ==============================================================================
FROM node:24-alpine AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo@^2.10.10
COPY . .
# Note: Turborepo 2.x uses positional argument syntax: turbo prune <target> --docker
RUN turbo prune workers --docker

# ==============================================================================
# Build Stage 2: Dependency Installer, Builder & Prod Prune
# ==============================================================================
FROM node:24-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pinned pnpm, turbo, and prisma CLI tools (exact version match for @prisma/client)
RUN npm install -g pnpm@11.1.2 turbo@^2.10.10 prisma@7.10.0

# Copy pruned lockfile and manifests
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Configure pnpm network resilience
RUN pnpm config set fetch-retries 5 && \
    pnpm config set fetch-retry-maxtimeout 180000 && \
    pnpm config set fetch-timeout 300000

# Install workspace dependencies without premature lifecycle scripts
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy scripts and pruned source code
COPY scripts/ /app/scripts/
COPY --from=pruner /app/out/full/ .

# Generate Prisma Client & Build Worker Daemon with all workspace dependencies
RUN prisma generate --schema=packages/db/prisma/schema.prisma
RUN turbo run build --filter=workers...

# Deploy isolated workers package with production dependencies only
RUN pnpm --filter workers --prod --legacy --ignore-scripts deploy /prod/workers

# Copy schema and generate Prisma Client into the deployed production virtual store
RUN cp -r /app/packages/db/prisma /prod/workers/prisma
WORKDIR /prod/workers
RUN prisma generate --schema=./prisma/schema.prisma && rm -rf ./prisma

# ==============================================================================
# Build Stage 3: Minimal Hardened Production Runner
# ==============================================================================
FROM node:24-alpine AS runner
RUN apk add --no-cache libc6-compat wget dumb-init
WORKDIR /app

ENV NODE_ENV=production
ENV HEALTH_PORT=8080

# Run as non-root user for security isolation
USER node

# Copy ONLY the deployed worker directory (no monorepo root, devDependencies, or other apps)
COPY --chown=node:node --from=builder /prod/workers ./

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:8080/healthz || exit 1

ENTRYPOINT ["dumb-init", "--", "node", "dist/index.js"]
