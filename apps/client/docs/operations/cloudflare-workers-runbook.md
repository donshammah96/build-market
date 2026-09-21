# Cloudflare Workers & OpenNext Runbook (`apps/client`)

> See canonical root reference: [CLOUDFLARE_WORKERS_RUNBOOK.md](../../../docs/CLOUDFLARE_WORKERS_RUNBOOK.md)

---

## Quick Reference

| Service         | Environment    | Domain / Route                                                   | Status |
| :-------------- | :------------- | :--------------------------------------------------------------- | :----- |
| **Client App**  | Staging        | `https://build-market-client-staging.donshammah1.workers.dev`    | Active |
| **Client App**  | Production     | `https://build-market-client-production.donshammah1.workers.dev` | Active |
| **Scan Worker** | Staging / Prod | `upload-scan-queue` (Consumer/Producer)                          | Active |

---

## Deployment Commands

```powershell
# Deploy Staging
wrangler deploy --config apps/client/wrangler.toml --env staging

# Deploy Production
wrangler deploy --config apps/client/wrangler.toml --env production

# Tail Realtime Invocation Logs
wrangler tail build-market-client-production
```

## Critical Invariants

1. **V8 Isolate Compatibility:** No native C++ addons (`.node`) in the bundle. `sharp` is processed asynchronously by `apps/workers` daemon.
2. **Asset Limits:** Max 25 MiB per file verified by `scripts/check-worker-asset-budget.mjs`.
3. **Secrets:** Managed via `wrangler secret put <KEY> --name <WORKER_NAME>`.
