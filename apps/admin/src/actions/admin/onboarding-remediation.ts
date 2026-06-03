"use server";

import { adminEnvConfig } from "@/lib/infrastructure/env";
import {
  callClientApi,
  requireAdminGranularRole,
  safeAction,
  type ActionResponse,
} from "./shared";

const ONBOARDING_REMEDIATION_ALLOWED_ROLES = ["SUPER_ADMIN"] as const;

type RemediationActorPayload = {
  userId: string;
  adminRole: string;
};

export type AdminOnboardingReconciliationResult = {
  userId: string;
  clerkId: string;
  db: {
    role: string | null;
    status: string | null;
    isOnboarded: boolean | null;
    isProfileComplete: boolean | null;
  };
  clerk: {
    role: string | null;
    status: string | null;
    isOnboarded: boolean | null;
    isProfileComplete: boolean | null;
  };
  mismatches: Array<"role" | "status" | "isOnboarded" | "isProfileComplete">;
  inSync: boolean;
  pendingOnboardingIdempotencyKeys: number;
};

export type AdminOnboardingClerkSyncResult = {
  userId: string;
  clerkId: string;
  metadata: {
    role: string;
    isOnboarded: true;
    status?: string;
    isProfileComplete?: true;
  };
  synced: true;
};

export type AdminOnboardingIdempotencyReconcileResult = {
  key: string;
  scope: string;
  previousStatus: "PENDING";
  currentStatus: "FAILED";
  reconciled: true;
};

function getInternalRemediationSecret(): string {
  const secret = adminEnvConfig.INTERNAL_API_SECRET;
  if (!secret) {
    throw new Error("Internal onboarding remediation secret is not configured");
  }

  return secret;
}

function buildRemediationActorPayload(
  adminUserId: string,
  adminRole: string,
): RemediationActorPayload {
  return {
    userId: adminUserId,
    adminRole,
  };
}

function requireNonEmptyInput(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required`);
  }

  return normalized;
}

export async function onboardingReconcile(
  userId: string,
): Promise<ActionResponse<AdminOnboardingReconciliationResult>> {
  return safeAction("onboardingReconcile", async ({ adminUserId }) => {
    const normalizedUserId = requireNonEmptyInput(userId, "userId");
    const adminRole = await requireAdminGranularRole(
      ONBOARDING_REMEDIATION_ALLOWED_ROLES,
      adminUserId,
    );

    const response = await callClientApi<{
      success: true;
      data: AdminOnboardingReconciliationResult;
    }>("/api/internal/onboarding-remediation/reconcile", {
      method: "POST",
      headers: {
        "x-internal-secret": getInternalRemediationSecret(),
      },
      body: {
        userId: normalizedUserId,
        actor: buildRemediationActorPayload(adminUserId, adminRole),
      },
    });

    return response.data;
  });
}

export async function onboardingClerkSync(
  userId: string,
): Promise<ActionResponse<AdminOnboardingClerkSyncResult>> {
  return safeAction("onboardingClerkSync", async ({ adminUserId }) => {
    const normalizedUserId = requireNonEmptyInput(userId, "userId");
    const adminRole = await requireAdminGranularRole(
      ONBOARDING_REMEDIATION_ALLOWED_ROLES,
      adminUserId,
    );

    const response = await callClientApi<{
      success: true;
      data: AdminOnboardingClerkSyncResult;
    }>("/api/internal/onboarding-remediation/clerk-sync", {
      method: "POST",
      headers: {
        "x-internal-secret": getInternalRemediationSecret(),
      },
      body: {
        userId: normalizedUserId,
        actor: buildRemediationActorPayload(adminUserId, adminRole),
      },
    });

    return response.data;
  });
}

export async function onboardingIdempotencyReconcile(
  key: string,
): Promise<ActionResponse<AdminOnboardingIdempotencyReconcileResult>> {
  return safeAction(
    "onboardingIdempotencyReconcile",
    async ({ adminUserId }) => {
      const normalizedKey = requireNonEmptyInput(key, "key");
      const adminRole = await requireAdminGranularRole(
        ONBOARDING_REMEDIATION_ALLOWED_ROLES,
        adminUserId,
      );

      const response = await callClientApi<{
        success: true;
        data: AdminOnboardingIdempotencyReconcileResult;
      }>("/api/internal/onboarding-remediation/idempotency-reconcile", {
        method: "POST",
        headers: {
          "x-internal-secret": getInternalRemediationSecret(),
        },
        body: {
          key: normalizedKey,
          actor: buildRemediationActorPayload(adminUserId, adminRole),
        },
      });

      return response.data;
    },
  );
}
