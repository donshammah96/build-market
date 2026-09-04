import { z } from "zod";
import type { StagingScenario } from "./contracts.js";

export const STAGING_IDENTITY_LEASE_STATES = [
  "LEASED",
  "RESETTING",
  "READY",
  "RELEASED",
  "FAILED",
] as const;

export type StagingIdentityLeaseState =
  (typeof STAGING_IDENTITY_LEASE_STATES)[number];

export const ACTIVE_LEASE_STATES: readonly StagingIdentityLeaseState[] = [
  "LEASED",
  "RESETTING",
  "READY",
];

export const ALLOWED_IDENTITY_LEASE_SCENARIOS = [
  "onboarding",
  "verification",
] as const;

export type AllowedIdentityLeaseScenario =
  (typeof ALLOWED_IDENTITY_LEASE_SCENARIOS)[number];

export function isAllowedScenarioForIdentityLease(
  scenario: string,
): scenario is AllowedIdentityLeaseScenario {
  return (ALLOWED_IDENTITY_LEASE_SCENARIOS as readonly string[]).includes(
    scenario,
  );
}

export interface StagingIdentityLease {
  id: string;
  stagingTestRunId: string;
  slot: string;
  role: "CLIENT" | "PROFESSIONAL";
  userId: string;
  clerkId: string;
  state: StagingIdentityLeaseState;
  leaseExpiresAt: Date;
  resetAt?: Date | null;
  releasedAt?: Date | null;
}

export type StagingTestIdentityLeaseSnapshot = StagingIdentityLease;

export function canLeaseIdentity(
  lease: StagingIdentityLease | undefined,
  now = new Date(),
): boolean {
  if (!lease) return true;
  if (!ACTIVE_LEASE_STATES.includes(lease.state)) return true;
  return new Date(lease.leaseExpiresAt).getTime() <= now.getTime();
}

export function canResetIdentity(
  lease: StagingIdentityLease,
  runId: string,
  scenario: string,
  now = new Date(),
): boolean {
  if (lease.stagingTestRunId !== runId) return false;
  if (!isAllowedScenarioForIdentityLease(scenario)) return false;
  if (lease.state === "RELEASED" || lease.state === "FAILED") return false;
  return new Date(lease.leaseExpiresAt).getTime() > now.getTime();
}

export function releaseIdentityLease(
  lease: StagingIdentityLease,
  now = new Date(),
): StagingIdentityLease {
  if (lease.state === "RELEASED") return lease;
  return { ...lease, state: "RELEASED", releasedAt: now };
}

export const StagingSlotRoleSchema = z.enum(["CLIENT", "PROFESSIONAL"]);
export type StagingSlotRole = z.infer<typeof StagingSlotRoleSchema>;

export const StagingSlotConfigSchema = z.object({
  slot: z.string().min(1),
  role: StagingSlotRoleSchema,
  email: z.string().email(),
});

export type StagingSlotConfig = z.infer<typeof StagingSlotConfigSchema>;

export function parseStagingIdentitySlots(
  rawJson: string,
  options: { isProduction?: boolean } = {},
): StagingSlotConfig[] {
  if (options.isProduction) {
    throw new Error(
      "Cannot configure or parse staging identity slots in a production environment",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    throw new Error(
      `Failed to parse STAGING_TEST_IDENTITY_SLOTS JSON: ${(err as Error).message}`,
    );
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(
      "STAGING_TEST_IDENTITY_SLOTS must be a non-empty JSON array",
    );
  }

  const slotSet = new Set<string>();
  const emailSet = new Set<string>();
  const validatedSlots: StagingSlotConfig[] = [];

  for (const item of parsed) {
    const validated = StagingSlotConfigSchema.parse(item);

    if (slotSet.has(validated.slot)) {
      throw new Error(
        `Duplicate slot detected in STAGING_TEST_IDENTITY_SLOTS: "${validated.slot}"`,
      );
    }
    slotSet.add(validated.slot);

    const normalizedEmail = validated.email.toLowerCase();
    if (emailSet.has(normalizedEmail)) {
      throw new Error(
        `Duplicate email detected in STAGING_TEST_IDENTITY_SLOTS: "${validated.email}"`,
      );
    }
    emailSet.add(normalizedEmail);

    validatedSlots.push(validated);
  }

  return validatedSlots;
}

export function findAvailableSlotForRole(
  slots: readonly StagingSlotConfig[],
  role: StagingSlotRole,
  activeSlots: Set<string>,
): StagingSlotConfig | null {
  for (const slot of slots) {
    if (slot.role === role && !activeSlots.has(slot.slot)) {
      return slot;
    }
  }
  return null;
}
