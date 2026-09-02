/**
 * BullMQ Two-Way Queue Backend Reconciliation Utility
 *
 * Usage:
 *   pnpm tsx scripts/reconcile-queue-backend.ts --queue maintenance-jobs --from postgres --to redis
 *   pnpm tsx scripts/reconcile-queue-backend.ts --queue mpesa-payments --inspect
 */

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { Queue } from "bullmq";
import { createRedisConnection } from "@build/redis/tcp";
import { getPostgresQueueConnectionOptions } from "@build/queue-server";

function loadEnvIfMissing() {
  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "apps/workers/.env.local"),
    path.resolve(process.cwd(), "apps/workers/.env"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate });
    }
  }
}

loadEnvIfMissing();

interface CliArgs {
  queue?: string;
  from?: "postgres" | "redis";
  to?: "postgres" | "redis";
  inspect?: boolean;
  dryRun?: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--queue" && args[i + 1]) {
      result.queue = args[++i];
    } else if (args[i] === "--from" && args[i + 1]) {
      result.from = args[++i] as "postgres" | "redis";
    } else if (args[i] === "--to" && args[i + 1]) {
      result.to = args[++i] as "postgres" | "redis";
    } else if (args[i] === "--inspect") {
      result.inspect = true;
    } else if (args[i] === "--dry-run") {
      result.dryRun = true;
    }
  }

  return result;
}

function createQueueInstance(
  queueName: string,
  backend: "postgres" | "redis",
): Queue {
  if (backend === "postgres") {
    return new Queue(queueName, {
      connection: getPostgresQueueConnectionOptions(queueName) as any,
    });
  }
  return new Queue(queueName, {
    connection: createRedisConnection(),
  });
}

async function inspectQueue(queueName: string) {
  console.log(`\n=== Inspecting Queue: ${queueName} ===\n`);

  const redisQueue = createQueueInstance(queueName, "redis");
  const pgQueue = createQueueInstance(queueName, "postgres");

  try {
    const [redisWaiting, redisDelayed, redisFailed] = await Promise.all([
      redisQueue.getWaitingCount().catch(() => -1),
      redisQueue.getDelayedCount().catch(() => -1),
      redisQueue.getFailedCount().catch(() => -1),
    ]);

    const [pgWaiting, pgDelayed, pgFailed] = await Promise.all([
      pgQueue.getWaitingCount().catch(() => -1),
      pgQueue.getDelayedCount().catch(() => -1),
      pgQueue.getFailedCount().catch(() => -1),
    ]);

    console.log("Redis Backend Counts:");
    console.log(`  Waiting: ${redisWaiting >= 0 ? redisWaiting : "N/A"}`);
    console.log(`  Delayed: ${redisDelayed >= 0 ? redisDelayed : "N/A"}`);
    console.log(`  Failed:  ${redisFailed >= 0 ? redisFailed : "N/A"}`);

    console.log("\nPostgreSQL Backend Counts:");
    console.log(`  Waiting: ${pgWaiting >= 0 ? pgWaiting : "N/A"}`);
    console.log(`  Delayed: ${pgDelayed >= 0 ? pgDelayed : "N/A"}`);
    console.log(`  Failed:  ${pgFailed >= 0 ? pgFailed : "N/A"}`);
  } finally {
    await redisQueue.close().catch(() => {});
    await pgQueue.close().catch(() => {});
  }
}

async function reconcileQueue(
  queueName: string,
  from: "postgres" | "redis",
  to: "postgres" | "redis",
  dryRun: boolean,
) {
  console.log(
    `\n=== Reconciling Queue '${queueName}' (${from} -> ${to}) ${dryRun ? "[DRY-RUN]" : ""} ===\n`,
  );

  const sourceQueue = createQueueInstance(queueName, from);
  const targetQueue = createQueueInstance(queueName, to);

  try {
    const jobs = await sourceQueue.getJobs(["waiting", "delayed"]);
    console.log(
      `Found ${jobs.length} in-flight / delayed jobs in ${from} backend.`,
    );

    let migratedCount = 0;

    for (const job of jobs) {
      console.log(
        `  Job ID: ${job.id} | Name: ${job.name} | Delay: ${job.delay}ms`,
      );

      if (!dryRun) {
        // Enqueue on target with original parameters
        await targetQueue.add(job.name, job.data, {
          jobId: job.id,
          delay: job.delay,
          attempts: job.opts.attempts,
          backoff: job.opts.backoff,
        });

        // Remove from source after successful transfer
        await job.remove();
        migratedCount++;
      }
    }

    if (!dryRun) {
      console.log(
        `\nSuccessfully transferred ${migratedCount} jobs from ${from} to ${to}.`,
      );
    } else {
      console.log(`\n[DRY-RUN] Would have transferred ${jobs.length} jobs.`);
    }
  } finally {
    await sourceQueue.close().catch(() => {});
    await targetQueue.close().catch(() => {});
  }
}

async function main() {
  const args = parseArgs();

  if (!args.queue) {
    console.error("Error: --queue <name> is required.");
    console.log(
      "Available queues: maintenance-jobs, notification-retries, gdpr-data-export, security-incidents, compliance-notifications, newsletter-confirmation-email, newsletter-esp-sync, uploads-image-processing, license-verification, mpesa-payments, mpesa-reconciliation",
    );
    process.exit(1);
  }

  if (args.inspect) {
    await inspectQueue(args.queue);
  } else if (args.from && args.to) {
    if (args.from === args.to) {
      console.error("Error: --from and --to cannot be the same backend.");
      process.exit(1);
    }
    await reconcileQueue(args.queue, args.from, args.to, Boolean(args.dryRun));
  } else {
    console.error(
      "Error: Specify either --inspect or both --from and --to backends.",
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error during queue reconciliation:", err);
  process.exit(1);
});
