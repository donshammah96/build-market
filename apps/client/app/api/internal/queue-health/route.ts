import { NextRequest, NextResponse } from "next/server";
import {
  getPaymentsQueue,
  getQueueBackendType,
  MPESA_QUEUE_NAMES,
} from "@build/queue-server";
import { edgeEnv } from "@/app/lib/infrastructure/edge-env";
import { env } from "@/app/lib/infrastructure/env";
import {
  ensureValidInternalSecret,
  timingSafeEqualStrings,
} from "@/app/lib/security/internal-secret";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const internalSecret = request.headers.get("x-internal-secret");
  const hasValidInternalSecret = Boolean(
    internalSecret && ensureValidInternalSecret(internalSecret) === null,
  );

  const stagingSecret = request.headers.get("x-staging-secret");
  const expectedStagingSecret =
    edgeEnv.stagingAuthSecret || env.stagingAuth?.secret;
  const hasValidStagingSecret = Boolean(
    stagingSecret &&
    expectedStagingSecret &&
    timingSafeEqualStrings(stagingSecret, expectedStagingSecret),
  );

  if (!hasValidInternalSecret && !hasValidStagingSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const backend = getQueueBackendType(MPESA_QUEUE_NAMES.PAYMENTS);
  const queueName = MPESA_QUEUE_NAMES.PAYMENTS;

  const redisUrl = edgeEnv.redisUrl?.trim();
  if (backend === "redis" && !redisUrl) {
    return NextResponse.json({
      backend,
      connected: false,
      queueName,
      waiting: 0,
      active: 0,
      consumerSeenAt: null,
      error: "REDIS_URL is not configured",
    });
  }

  try {
    const queue = getPaymentsQueue();
    const [counts, workers] = await Promise.all([
      queue.getJobCounts("waiting", "active", "completed", "failed"),
      queue.getWorkers().catch(() => []),
    ]);

    let consumerSeenAt: string | null =
      workers.length > 0 ? new Date().toISOString() : null;

    if (!consumerSeenAt) {
      // If no workers currently connected, check latest finished job timestamp
      const recentCompleted = await queue.getCompleted(0, 0).catch(() => []);
      if (recentCompleted[0]?.finishedOn) {
        consumerSeenAt = new Date(recentCompleted[0].finishedOn).toISOString();
      }
    }

    return NextResponse.json({
      backend,
      connected: true,
      queueName,
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      consumerCount: workers.length,
      consumerSeenAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err || "");
    return NextResponse.json({
      backend,
      connected: false,
      queueName,
      waiting: 0,
      active: 0,
      consumerSeenAt: null,
      error: message,
    });
  }
}
