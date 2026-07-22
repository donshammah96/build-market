/**
 * Sole entrypoint for the newsletter background-job process. This file
 * (and ONLY this file) may import the *.worker.ts modules — importing a
 * Worker anywhere under app/api/** or app/** opens a stray Redis
 * connection per serverless invocation. Enforce this with the eslint
 * import-restriction rule described in NEWSLETTER_AUDIT.md (A-2).
 *
 * Deploy target: a persistent container (ECS Fargate task, ECS service,
 * or a single long-running EC2/Fly/Render process at MVP scale) — never
 * Vercel. This process has no HTTP server of its own beyond the health
 * check below; its job is to stay alive and keep both Workers polling.
 */
import { newsletterEspSyncWorker } from "./esp-sync.worker";
import { newsletterConfirmationEmailWorker } from "./confirmation-email.worker";
import { getBullMQConnectionSummary } from "@build/queue-server";
import { StructuredLogger } from "@build/resilience";
import http from "node:http";
import { envConfig } from "@/app/lib/infrastructure/env";

const logger = new StructuredLogger("newsletter-worker-process");
const workers = [newsletterEspSyncWorker, newsletterConfirmationEmailWorker];

// Log resolved Redis connection info on startup to verify connectivity (A-1 / Wiring section 3)
try {
  const summary = getBullMQConnectionSummary();
  logger.info(
    `Resolved Redis connection target: host=${summary.host}, port=${summary.port}, tls=${summary.tls}`,
    {},
  );
} catch (err) {
  logger.warn("Could not determine Redis connection target info", {
    error: err instanceof Error ? err.message : String(err),
  });
}

// ---------------------------------------------------------------------
// Health/readiness endpoint
// ---------------------------------------------------------------------
// ECS/k8s need something to poll. Report unhealthy if either worker's
// underlying Redis connection is not 'ready' so the orchestrator restarts
// a stuck container rather than leaving it running-but-deaf.
const server = http.createServer((req, res) => {
  if (req.url !== "/healthz") {
    res.writeHead(404).end();
    return;
  }
  const allReady = workers.every((w) => w.isRunning() && !w.closing);
  res.writeHead(allReady ? 200 : 503, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: allReady }));
});

const healthPort = envConfig.newsletter.workerHealthPort ?? 8080;
server.listen(healthPort, () => {
  logger.info(`Health check endpoint listening on port ${healthPort}`, {});
});

// ---------------------------------------------------------------------
// Consolidated shutdown
// ---------------------------------------------------------------------
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}, draining newsletter workers`, {});

  server.close();
  const results = await Promise.allSettled(workers.map((w) => w.close()));
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      logger.error(
        `Worker ${i} failed to close cleanly`,
        r.reason instanceof Error ? r.reason : new Error(String(r.reason)),
        {},
      );
    }
  });

  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

// Crash loudly and let the orchestrator restart rather than limping on
// with an unknown-state Worker.
process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception in worker process", err, {});
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  logger.error(
    "Unhandled rejection in worker process",
    reason instanceof Error ? reason : new Error(String(reason)),
    {},
  );
  process.exit(1);
});

logger.info("Newsletter worker process started", {
  workersCount: workers.length,
});
