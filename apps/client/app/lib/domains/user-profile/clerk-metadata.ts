import "server-only";

/**
 * clerk-metadata.ts
 *
 * Shared transition finalizer for updating Clerk publicMetadata during
 * onboarding flows.
 *
 * WHY THIS EXISTS
 * ---------------
 * All onboarding transition adapters need one audited place that:
 * - performs the Clerk metadata write
 * - preserves the critical ordering invariant
 * - fails closed when Clerk cannot confirm the role transition
 *
 * ORDERING INVARIANT — READ THIS BEFORE USING
 * ------------------------------------------
 * Clerk metadata finalization MUST happen BEFORE IdempotencyService.complete().
 *
 * Correct sequence:
 *   1. Execute domain logic
 *   2. finalizeClerkOnboardingTransition()   ← this file
 *   3. IdempotencyService.complete()
 *   4. return success response
 *
 * If the Clerk write fails after the DB transition but before the response is
 * finalized, the adapter must fail closed and keep the mutation retryable.
 */

import { clerkClient } from "@clerk/nextjs/server";

export const CLERK_ONBOARDING_FINALIZATION_RETRY_MESSAGE =
  "Unable to finalize account state. Please retry.";

export type ClerkOnboardingMetadata = {
  role: string;
  isOnboarded: true;
  status?: string;
  isProfileComplete?: true;
};

/**
 * Updates Clerk publicMetadata for the given clerkId.
 * This is a fail-closed write for role/onboarding transitions and will throw
 * if Clerk cannot confirm the mutation.
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
    console.error(
      `Failed to update Clerk metadata during ${context.operation}`,
      {
        correlationId: context.correlationId,
        hasClerkId: Boolean(clerkId),
        error: error instanceof Error ? error.message : String(error),
      },
    );

    throw error instanceof Error ? error : new Error(String(error));
  }
}

export async function finalizeClerkOnboardingTransition(params: {
  clerkId: string;
  metadata: ClerkOnboardingMetadata;
  context: { correlationId?: string; operation: string };
  onFailure?: () => Promise<void> | void;
}): Promise<void> {
  try {
    await updateClerkOnboardingMetadata(
      params.clerkId,
      params.metadata,
      params.context,
    );
  } catch (error) {
    if (params.onFailure) {
      try {
        await params.onFailure();
      } catch (failureError) {
        console.error(
          `Failed to mark onboarding transition retryable during ${params.context.operation}`,
          {
            correlationId: params.context.correlationId,
            hasClerkId: Boolean(params.clerkId),
            error:
              failureError instanceof Error
                ? failureError.message
                : String(failureError),
          },
        );
      }
    }

    throw error;
  }
}
