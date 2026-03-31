/**
 * clerk-metadata.ts
 *
 * Shared helper for updating Clerk publicMetadata during onboarding flows.
 *
 * WHY THIS EXISTS
 * ---------------
 * All five onboarding route handlers previously duplicated:
 *   (await clerkClient()) as unknown as ClerkMetadataClient
 * and the update call. The double `as unknown as` cast bypasses TypeScript
 * completely. Centralising here means the cast is audited in one place
 * and the calling convention is consistent.
 *
 * ORDERING INVARIANT — READ THIS BEFORE USING
 * --------------------------------------------
 * This function MUST be called BEFORE IdempotencyService.complete().
 *
 * Reason: if the Clerk update fails silently (which it can), and the
 * idempotency record has already been marked "completed", any retry will
 * return the cached success response without re-attempting the Clerk update.
 * The user ends up with DB isOnboarded=true but stale Clerk metadata,
 * breaking every middleware auth check.
 *
 * Correct sequence:
 *   1. Execute domain logic
 *   2. updateClerkOnboardingMetadata()   ← this file
 *   3. IdempotencyService.complete()
 *   4. return apiSuccess()
 *
 * Failure handling: Clerk metadata is NOT source of truth for auth — the DB
 * is. A failure here is logged but does NOT fail the request. The user can
 * still access the app; the Clerk token will be refreshed on next sign-in.
 */

import { clerkClient } from "@clerk/nextjs/server";
import { getClientLogger } from "@/app/lib/api/resilient-api";

const logger = getClientLogger();

export type ClerkOnboardingMetadata = {
  role: string;
  isOnboarded: true;
  isProfileComplete?: true;
};

/**
 * Updates Clerk publicMetadata for the given clerkId.
 * Never throws — failures are logged and swallowed intentionally.
 * DB is source of truth; Clerk metadata is a cache for middleware performance.
 *
 * @param clerkId   The Clerk user ID to update.
 * @param metadata  The metadata to set. `isOnboarded` is always true here.
 * @param context   Logging context (correlationId, operation name).
 */
export async function updateClerkOnboardingMetadata(
  clerkId: string,
  metadata: ClerkOnboardingMetadata,
  context: { correlationId?: string; operation: string },
): Promise<void> {
  try {
    const client = (await clerkClient()) as {
      users: {
        updateUserMetadata: (
          userId: string,
          data: { publicMetadata: ClerkOnboardingMetadata },
        ) => Promise<unknown>;
      };
    };
    await client.users.updateUserMetadata(clerkId, {
      publicMetadata: metadata,
    });
  } catch (error) {
    // Log but never rethrow — DB is source of truth.
    // The user's Clerk token will reflect the updated role on next sign-in.
    logger.error(
      `Failed to update Clerk metadata during ${context.operation}`,
      error instanceof Error ? error : new Error(String(error)),
      { correlationId: context.correlationId, clerkId },
    );
  }
}