import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@build/db";
import { IdempotencyStatus } from "@prisma/client";
import {
  err,
  ok,
  type DomainError,
  type Result,
} from "@/app/lib/errors/result";
import {
  isAdminRole,
  normalizeRole,
  type AppAdminRole,
  type AppRole,
} from "@/app/lib/security/roles";
import {
  CLERK_ONBOARDING_FINALIZATION_RETRY_MESSAGE,
  finalizeClerkOnboardingTransition,
  type ClerkOnboardingMetadata,
} from "./clerk-metadata";

export type OnboardingRemediationActor = {
  userId: string;
  role: "ADMIN";
  adminRole: AppAdminRole;
  correlationId?: string;
};

export type OnboardingRemediationErrorCode =
  | "forbidden"
  | "not_found"
  | "invalid_input"
  | "invalid_state"
  | "conflict"
  | "clerk_sync_failed"
  | "internal";

export type OnboardingRemediationError =
  DomainError<OnboardingRemediationErrorCode>;

export type OnboardingRemediationResult<T> = Result<
  T,
  OnboardingRemediationError
>;

type OnboardingStateSnapshot = {
  role: AppRole | null;
  status: string | null;
  isOnboarded: boolean | null;
  isProfileComplete: boolean | null;
};

export type ReconciliationMismatch =
  "role" | "status" | "isOnboarded" | "isProfileComplete";

export type ReconciliationReport = {
  userId: string;
  clerkId: string;
  db: OnboardingStateSnapshot;
  clerk: OnboardingStateSnapshot;
  mismatches: ReconciliationMismatch[];
  inSync: boolean;
  pendingOnboardingIdempotencyKeys: number;
};

export type ClerkSyncResult = {
  userId: string;
  clerkId: string;
  metadata: ClerkOnboardingMetadata;
  synced: true;
};

export type IdempotencyReconciliationResult = {
  key: string;
  scope: string;
  previousStatus: "PENDING";
  currentStatus: "FAILED";
  reconciled: true;
};

type ClerkReadClient = {
  users: {
    getUser: (
      userId: string,
    ) => Promise<{ publicMetadata?: Record<string, unknown> }>;
  };
};

function validateAdminActor(
  actor: OnboardingRemediationActor,
): OnboardingRemediationError | null {
  if (!actor.userId.trim()) {
    return {
      error: "invalid_input",
      message: "Actor userId is required",
      status: 400,
    };
  }

  if (actor.role !== "ADMIN" || !isAdminRole(actor.adminRole)) {
    return {
      error: "forbidden",
      message: "Admin role is required",
      status: 403,
    };
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function toString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

async function readClerkOnboardingSnapshot(
  clerkId: string,
): Promise<OnboardingStateSnapshot> {
  const client = (await clerkClient()) as unknown as ClerkReadClient;
  const clerkUser = await client.users.getUser(clerkId);
  const publicMetadata = isRecord(clerkUser.publicMetadata)
    ? clerkUser.publicMetadata
    : {};

  return {
    role: normalizeRole(publicMetadata.role) ?? null,
    status: toString(publicMetadata.status),
    isOnboarded: toBoolean(publicMetadata.isOnboarded),
    isProfileComplete: toBoolean(publicMetadata.isProfileComplete),
  };
}

function requiresOnboardedState(status: string): boolean {
  return status !== "ONBOARDING";
}

function toDbOnboardingSnapshot(params: {
  role: AppRole | null;
  status: string;
  isProfileComplete: boolean;
}): OnboardingStateSnapshot {
  return {
    role: params.role,
    status: params.status,
    isOnboarded: requiresOnboardedState(params.status),
    isProfileComplete: params.isProfileComplete,
  };
}

function collectMismatches(
  dbSnapshot: OnboardingStateSnapshot,
  clerkSnapshot: OnboardingStateSnapshot,
): ReconciliationMismatch[] {
  const mismatches: ReconciliationMismatch[] = [];

  if (clerkSnapshot.role !== dbSnapshot.role) {
    mismatches.push("role");
  }

  if (clerkSnapshot.status !== dbSnapshot.status) {
    mismatches.push("status");
  }

  if (clerkSnapshot.isOnboarded !== dbSnapshot.isOnboarded) {
    mismatches.push("isOnboarded");
  }

  if (clerkSnapshot.isProfileComplete !== dbSnapshot.isProfileComplete) {
    mismatches.push("isProfileComplete");
  }

  return mismatches;
}

async function getOnboardingTargetUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      clerkId: true,
      role: true,
      status: true,
      isProfileComplete: true,
    },
  });
}

export const onboardingRemediationService = {
  async reconcileOnboardingState(
    actor: OnboardingRemediationActor,
    userId: string,
  ): Promise<OnboardingRemediationResult<ReconciliationReport>> {
    const actorValidationError = validateAdminActor(actor);
    if (actorValidationError) {
      return err(actorValidationError);
    }

    const targetUserId = userId.trim();
    if (!targetUserId) {
      return err({
        error: "invalid_input",
        message: "Target userId is required",
        status: 400,
      });
    }

    const user = await getOnboardingTargetUser(targetUserId);

    if (!user) {
      return err({
        error: "not_found",
        message: "User not found",
        status: 404,
      });
    }

    const dbSnapshot = toDbOnboardingSnapshot({
      role: normalizeRole(user.role) ?? null,
      status: user.status,
      isProfileComplete: user.isProfileComplete,
    });

    let clerkSnapshot: OnboardingStateSnapshot;
    try {
      clerkSnapshot = await readClerkOnboardingSnapshot(user.clerkId);
    } catch {
      return err({
        error: "internal",
        message: "Failed to fetch Clerk metadata",
        status: 500,
      });
    }

    const pendingOnboardingIdempotencyKeys = await prisma.idempotencyKey.count({
      where: {
        userId: user.id,
        scope: "onboarding",
        status: IdempotencyStatus.PENDING,
      },
    });

    const mismatches = collectMismatches(dbSnapshot, clerkSnapshot);

    return ok({
      userId: user.id,
      clerkId: user.clerkId,
      db: dbSnapshot,
      clerk: clerkSnapshot,
      mismatches,
      inSync: mismatches.length === 0,
      pendingOnboardingIdempotencyKeys,
    });
  },

  async syncClerkMetadata(
    actor: OnboardingRemediationActor,
    userId: string,
  ): Promise<OnboardingRemediationResult<ClerkSyncResult>> {
    const actorValidationError = validateAdminActor(actor);
    if (actorValidationError) {
      return err(actorValidationError);
    }

    const targetUserId = userId.trim();
    if (!targetUserId) {
      return err({
        error: "invalid_input",
        message: "Target userId is required",
        status: 400,
      });
    }

    const user = await getOnboardingTargetUser(targetUserId);

    if (!user) {
      return err({
        error: "not_found",
        message: "User not found",
        status: 404,
      });
    }

    const metadata: ClerkOnboardingMetadata = {
      role: user.role,
      isOnboarded: true,
      status: user.status,
      ...(user.isProfileComplete ? { isProfileComplete: true } : {}),
    };

    try {
      await finalizeClerkOnboardingTransition({
        clerkId: user.clerkId,
        metadata,
        context: {
          correlationId: actor.correlationId,
          operation: "sync_clerk_metadata",
        },
      });
    } catch {
      return err({
        error: "clerk_sync_failed",
        message: CLERK_ONBOARDING_FINALIZATION_RETRY_MESSAGE,
        status: 503,
      });
    }

    return ok({
      userId: user.id,
      clerkId: user.clerkId,
      metadata,
      synced: true,
    });
  },

  async reconcileIdempotencyKey(
    actor: OnboardingRemediationActor,
    key: string,
  ): Promise<OnboardingRemediationResult<IdempotencyReconciliationResult>> {
    const actorValidationError = validateAdminActor(actor);
    if (actorValidationError) {
      return err(actorValidationError);
    }

    const normalizedKey = key.trim();
    if (!normalizedKey) {
      return err({
        error: "invalid_input",
        message: "Idempotency key is required",
        status: 400,
      });
    }

    const idempotencyKey = await prisma.idempotencyKey.findUnique({
      where: { key: normalizedKey },
      select: {
        key: true,
        scope: true,
        status: true,
        userId: true,
      },
    });

    if (!idempotencyKey) {
      return err({
        error: "not_found",
        message: "Idempotency key not found",
        status: 404,
      });
    }

    if (idempotencyKey.scope !== "onboarding") {
      return err({
        error: "invalid_input",
        message: "Only onboarding scope is supported",
        status: 400,
      });
    }

    if (idempotencyKey.status !== IdempotencyStatus.PENDING) {
      return err({
        error: "invalid_state",
        message: "Idempotency key is not in PENDING state",
        status: 409,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: idempotencyKey.userId, deletedAt: null },
      select: {
        status: true,
        isProfileComplete: true,
      },
    });

    if (user && user.isProfileComplete) {
      return err({
        error: "conflict",
        message: "Onboarding mutation appears to have completed",
        status: 409,
      });
    }

    await prisma.idempotencyKey.update({
      where: { key: normalizedKey },
      data: { status: IdempotencyStatus.FAILED },
    });

    return ok({
      key: normalizedKey,
      scope: idempotencyKey.scope,
      previousStatus: "PENDING",
      currentStatus: "FAILED",
      reconciled: true,
    });
  },
};
