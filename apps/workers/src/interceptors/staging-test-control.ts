import { createHash } from "node:crypto";
import { prisma } from "@build/db";
import type { WorkerEnv } from "../env.js";

export interface StagingTestControlMetadata {
  stagingTestRunId?: string;
  simulateFailure?: "CRASH" | "TIMEOUT" | "TRANSIENT_ERROR";
  failAttempts?: number;
}

/**
 * Produces a deterministic, non-reversible SHA-256 hash of a recipient address or phone.
 */
export function hashRecipient(recipient: string): string {
  return createHash("sha256")
    .update(recipient.trim().toLowerCase())
    .digest("hex");
}

/**
 * Strips PII / secrets from metadata payloads before persistence into test deliveries sink.
 */
export function redactMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const redacted: Record<string, unknown> = { ...metadata };
  const sensitivePatterns = [
    "phone",
    "email",
    "nationalid",
    "krapin",
    "password",
    "token",
    "secret",
    "authorization",
  ];

  for (const key of Object.keys(redacted)) {
    const lowerKey = key.toLowerCase();
    if (sensitivePatterns.some((pattern) => lowerKey.includes(pattern))) {
      redacted[key] = "[REDACTED]";
    }
  }

  return redacted;
}

/**
 * Intercepts outbound notifications/emails/SMS in staging environment.
 * Records the attempt into `staging_test_outbound_deliveries` and prevents live provider dispatch.
 */
export async function interceptOutboundDelivery(
  params: {
    stagingTestRunId: string;
    channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH";
    recipient: string;
    subject?: string;
    templateId?: string;
    metadata?: Record<string, unknown>;
  },
  workerEnv: WorkerEnv,
): Promise<{ intercepted: boolean; deliveryId?: string }> {
  const isStaging =
    workerEnv.DD_ENV === "staging" || workerEnv.NODE_ENV === "test";

  if (!isStaging || !params.stagingTestRunId) {
    return { intercepted: false };
  }

  // An arbitrary job payload must not turn normal staging traffic into a test
  // delivery. Ownership remains authoritative until the run has expired.
  const run = await prisma.stagingTestRun.findUnique({
    where: { id: params.stagingTestRunId },
    select: { state: true, expiresAt: true },
  });
  if (!run || run.state !== "ACTIVE" || run.expiresAt <= new Date()) {
    return { intercepted: false };
  }

  const delivery = await prisma.stagingTestOutboundDelivery.create({
    data: {
      stagingTestRunId: params.stagingTestRunId,
      channel: params.channel,
      recipientHash: hashRecipient(params.recipient),
      // Subjects can contain customer data. Test evidence records only that a
      // subject was present, never its contents.
      subject: params.subject ? "[REDACTED]" : undefined,
      templateId: params.templateId,
      redactedMetadata: redactMetadata(params.metadata || {}) as any,
    },
  });

  return { intercepted: true, deliveryId: delivery.id };
}

/**
 * Simulates worker failures (crash, timeout, transient error) for queue-failure recovery tests.
 * Active strictly when in staging/test and explicitly requested by a test control payload.
 */
export function checkSimulatedFailure(
  testControl?: StagingTestControlMetadata,
  workerEnv?: WorkerEnv,
  attemptsMade = 0,
): void {
  const isStaging =
    workerEnv?.DD_ENV === "staging" || workerEnv?.NODE_ENV === "test";

  if (
    !isStaging ||
    !testControl?.stagingTestRunId ||
    !testControl.simulateFailure
  ) {
    return;
  }

  if (testControl.failAttempts !== undefined) {
    if (
      !Number.isInteger(testControl.failAttempts) ||
      testControl.failAttempts < 1 ||
      testControl.failAttempts > 2
    ) {
      throw new Error(
        "[SimulatedFailure:INVALID_POLICY] failAttempts must be 1 or 2",
      );
    }
    if (attemptsMade >= testControl.failAttempts) return;
  }

  if (testControl.simulateFailure === "CRASH") {
    throw new Error(
      "[SimulatedFailure:CRASH] Forced worker crash for staging test recovery validation",
    );
  }

  if (testControl.simulateFailure === "TIMEOUT") {
    throw new Error(
      "[SimulatedFailure:TIMEOUT] Forced execution timeout for staging test recovery validation",
    );
  }

  if (testControl.simulateFailure === "TRANSIENT_ERROR") {
    throw new Error(
      "[SimulatedFailure:TRANSIENT_ERROR] Forced transient error for queue retry validation",
    );
  }
}
