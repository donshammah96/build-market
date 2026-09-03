import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  STAGING_SCENARIOS,
  type StagingScenario,
} from "@build/db/staging-test-runs";

export const STAGING_GRANT_AUDIENCE = "buildmarket-staging-test-control";
export const MAX_GRANT_LIFETIME_SECONDS = 300; // 5 minutes
export const STAGING_GRANT_ACTIONS = [
  "seed-scenario",
  "issue-session-handoff",
  "seed-mpesa-transaction",
  "get-run-projection",
  "cleanup-run",
] as const;
export type StagingGrantAction = (typeof STAGING_GRANT_ACTIONS)[number];

export const StagingGrantPayloadSchema = z.object({
  runId: z.string().min(1),
  scenario: z.enum(STAGING_SCENARIOS),
  actions: z.array(z.enum(STAGING_GRANT_ACTIONS)).min(1),
  aud: z.literal(STAGING_GRANT_AUDIENCE),
  iat: z.number().int(),
  exp: z.number().int(),
});

export type StagingGrantPayload = z.infer<typeof StagingGrantPayloadSchema>;

/** Never use this outside the Vitest process; staging requires a configured secret. */
export const TEST_ONLY_STAGING_CONTROL_SECRET = "staging-control-secret";

export function resolveStagingControlSecret(
  configuredSecret: string | undefined,
  isTest: boolean,
): string | null {
  if (configuredSecret) return configuredSecret;
  return isTest ? TEST_ONLY_STAGING_CONTROL_SECRET : null;
}

/**
 * Creates a signed, base64url-encoded HMAC-SHA256 staging grant token.
 */
export function signStagingGrant(
  payload: Omit<StagingGrantPayload, "aud" | "iat" | "exp">,
  secret: string,
  lifetimeSeconds = MAX_GRANT_LIFETIME_SECONDS,
): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + Math.min(lifetimeSeconds, MAX_GRANT_LIFETIME_SECONDS);

  const fullPayload: StagingGrantPayload = {
    ...payload,
    aud: STAGING_GRANT_AUDIENCE,
    iat,
    exp,
  };

  const serialized = Buffer.from(JSON.stringify(fullPayload)).toString(
    "base64url",
  );
  const signature = createHmac("sha256", secret)
    .update(serialized)
    .digest("base64url");

  return `${serialized}.${signature}`;
}

/**
 * Verifies a staging grant token. Returns the validated payload or null if invalid/expired.
 */
export function verifyStagingGrant(
  token: string,
  secret: string,
  expectedRunId?: string,
): StagingGrantPayload | null {
  if (!token || !secret) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [serialized, signature] = parts;
  if (!serialized || !signature) return null;

  const expectedSig = createHmac("sha256", secret)
    .update(serialized)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);

  if (
    sigBuf.length !== expectedBuf.length ||
    !timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const raw = JSON.parse(Buffer.from(serialized, "base64url").toString("utf-8"));
    const parsed = StagingGrantPayloadSchema.safeParse(raw);
    if (!parsed.success) return null;

    const grant = parsed.data;
    const now = Math.floor(Date.now() / 1000);

    // Enforce expiry and maximum lifetime window
    if (now >= grant.exp || grant.exp > grant.iat + MAX_GRANT_LIFETIME_SECONDS) {
      return null;
    }

    if (expectedRunId && grant.runId !== expectedRunId) {
      return null;
    }

    return grant;
  } catch {
    return null;
  }
}

// ============================================================================
// Action Schemas
// ============================================================================

export const CreateRunActionSchema = z.object({
  action: z.literal("create-run"),
  scenario: z.enum(STAGING_SCENARIOS),
  actorLabel: z.string().min(1).max(100),
  gitSha: z.string().optional(),
  workflowRunId: z.string().optional(),
});

export const IssueSessionHandoffActionSchema = z.object({
  action: z.literal("issue-session-handoff"),
  runId: z.string().min(1),
  role: z.enum(["CLIENT", "PROFESSIONAL"]),
});

export const SeedScenarioActionSchema = z.object({
  action: z.literal("seed-scenario"),
  runId: z.string().min(1),
  scenario: z.enum(STAGING_SCENARIOS),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const SeedMpesaTransactionActionSchema = z.object({
  action: z.literal("seed-mpesa-transaction"),
  runId: z.string().min(1),
  amount: z.number().positive(),
  phoneNumber: z.string().min(9),
  checkoutRequestId: z.string().optional(),
  merchantRequestId: z.string().optional(),
});

export const GetRunProjectionActionSchema = z.object({
  action: z.literal("get-run-projection"),
  runId: z.string().min(1),
});

export const CleanupRunActionSchema = z.object({
  action: z.literal("cleanup-run"),
  runId: z.string().min(1),
});

export const TestControlActionSchema = z.discriminatedUnion("action", [
  CreateRunActionSchema,
  IssueSessionHandoffActionSchema,
  SeedScenarioActionSchema,
  SeedMpesaTransactionActionSchema,
  GetRunProjectionActionSchema,
  CleanupRunActionSchema,
]);

export type TestControlAction = z.infer<typeof TestControlActionSchema>;
