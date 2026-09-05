import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@build/db";
import {
  parseStagingIdentitySlots,
  type StagingSlotConfig,
} from "@build/db/staging-test-runs";
import { err, ok, type Result } from "@/app/lib/errors/result";
import { env } from "@/app/lib/infrastructure/env";
import type { IdentityLease } from "./identity-repository";
import type { TestControlError } from "./service";

const DEFAULT_STAGING_SLOTS: readonly StagingSlotConfig[] = [
  {
    slot: "pro-1",
    role: "PROFESSIONAL",
    email: "e2e_pro_1@staging.buildmarket.app",
  },
  {
    slot: "pro-2",
    role: "PROFESSIONAL",
    email: "e2e_pro_2@staging.buildmarket.app",
  },
  {
    slot: "client-1",
    role: "CLIENT",
    email: "e2e_client_1@staging.buildmarket.app",
  },
  {
    slot: "client-2",
    role: "CLIENT",
    email: "e2e_client_2@staging.buildmarket.app",
  },
];

function resolveAllowedPoolEmails(): Set<string> {
  const envSlots = env.stagingTestControl?.identitySlots;
  const slots = envSlots
    ? parseStagingIdentitySlots(envSlots, {
        isProduction: env.isProd,
      })
    : DEFAULT_STAGING_SLOTS;

  return new Set(slots.map((s) => s.email.toLowerCase()));
}

/**
 * Restores Clerk identity baseline for a leased test identity.
 * Narrow and guarded: verifies the user email belongs to the configured test pool,
 * resets metadata strictly to documented baseline, and revokes all active sessions.
 */
export async function restoreClerkIdentityBaseline(
  lease: IdentityLease,
): Promise<Result<void, TestControlError>> {
  try {
    const clerk = (await clerkClient()) as any;

    // 1. Fetch Clerk user to verify identity pool containment
    const user = await clerk.users.getUser(lease.clerkId);
    if (!user) {
      await markLeaseFailed(lease.id);
      return err({
        error: "CLERK_USER_NOT_FOUND",
        message: `Clerk user ${lease.clerkId} was not found`,
        status: 404,
      });
    }

    const allowedEmails = resolveAllowedPoolEmails();
    const userEmails = (user.emailAddresses || []).map((e: any) =>
      e.emailAddress.toLowerCase(),
    );
    const isPoolUser = userEmails.some((e: string) => allowedEmails.has(e));

    if (!isPoolUser) {
      // Hard stop: refuse to touch users outside the staging pool
      return err({
        error: "NON_POOL_CLERK_USER",
        message: `Clerk user ${lease.clerkId} does not belong to the approved staging identity pool`,
        status: 403,
      });
    }

    // 2. Set metadata strictly to documented baseline
    await clerk.users.updateUserMetadata(lease.clerkId, {
      publicMetadata: {
        role: lease.role,
        onboardingComplete: false,
      },
      unsafeMetadata: {},
    });

    // 3. Revoke all active sessions
    const sessions = await clerk.sessions.getSessionList({
      userId: lease.clerkId,
    });
    if (sessions?.data) {
      for (const session of sessions.data) {
        if (session.status === "active") {
          await clerk.sessions.revokeSession(session.id);
        }
      }
    }

    return ok(undefined);
  } catch (error: any) {
    await markLeaseFailed(lease.id);
    return err({
      error: "CLERK_BASELINE_RESET_FAILED",
      message:
        error?.message || "Failed to restore Clerk baseline for test identity",
      status: 502,
    });
  }
}

async function markLeaseFailed(leaseId: string): Promise<void> {
  try {
    await prisma.stagingTestIdentityLease.update({
      where: { id: leaseId },
      data: { state: "FAILED" },
    });
  } catch {
    // Non-blocking catch on audit update error
  }
}
