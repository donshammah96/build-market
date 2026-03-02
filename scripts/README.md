# Example: Run NATS producer & consumer (compiled JS)

Prereqs
- Docker (recommended) or local installs of Redis and NATS with JetStream
- Node and `pnpm` available

Start infrastructure (Docker)

```bash
# Start Redis
docker run --rm -p 6379:6379 redis:7-alpine

# Start NATS with JetStream
docker run --rm -p 4222:4222 -p 8222:8222 nats:latest -js
```

Install workspace deps (repo root)

```bash
pnpm install
```

Build TypeScript packages (NATS package includes a `build` script)

```bash
pnpm -w -F @build/nats run build
```

Compile example scripts to JS

```bash
# From repo root
npx tsc -p scripts/tsconfig.json
```

Run the consumer (keeps running for ~30s)

```bash
node scripts/dist/consumer.js
```

In another terminal run the producer (one-off publish)

```bash
node scripts/dist/producer.js
```

Notes
- Default clients connect to `nats://localhost:4222`. To override, set `NATS_URL`.
- These scripts use the TypeScript source under `packages/nats/src` and compile to `scripts/dist`.
- If you prefer not to compile, you can use `pnpm dlx ts-node scripts/producer.ts` and `pnpm dlx ts-node scripts/consumer.ts` (requires `ts-node`)
# Scripts

This directory contains utility scripts for development and deployment workflows.

## Available Scripts

### create-pr.ps1 (PowerShell)
PowerShell script for creating a feature branch, committing changes, and creating a pull request.

**Usage (Windows PowerShell):**
```powershell
.\scripts\create-pr.ps1
```

### create-pr.sh (Bash)
Bash script for creating a feature branch, committing changes, and creating a pull request.

**Usage (Linux/Mac/Git Bash):**
```bash
chmod +x scripts/create-pr.sh
./scripts/create-pr.sh
```

## Features

Both scripts automate the following workflow:
- ✅ Create a new feature branch from current branch
- ✅ Stage and commit changes with conventional commit message
- ✅ Push the branch to remote
- ✅ Create a Pull Request (if GitHub CLI is installed)
- ✅ Provide fallback instructions if GitHub CLI is not available

## Requirements

- Git installed and configured
- GitHub CLI (`gh`) - Optional, but recommended for automatic PR creation
  - Install from: https://cli.github.com/

## Notes

- The scripts include proper error handling at each step
- Colored output for better visibility
- Automatically generates descriptive PR descriptions

